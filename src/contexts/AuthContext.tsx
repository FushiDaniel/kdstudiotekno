'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { User, EmploymentType, AvailabilityStatus } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, fullname: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set persistence to LOCAL
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // Handle redirect result first
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await handleGoogleUserSetup(result.user, result);
        }
      })
      .catch((error) => {
        console.error('Redirect sign-in error:', error);
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({
            uid: firebaseUser.uid,
            fullname: userData.fullname || '',
            email: userData.email || firebaseUser.email || '',
            profileImageUrl: userData.profileImageUrl || '',
            isAdmin: userData.isAdmin || false,
            phoneNumber: userData.phoneNumber || '',
            bio: userData.bio || '',
            skills: userData.skills || [],
            availabilityStatus: userData.availabilityStatus || AvailabilityStatus.IDLE,
            employmentType: userData.employmentType || EmploymentType.FREELANCE,
            staffId: userData.staffId || '',
            bankName: userData.bankName || '',
            bankAccountNumber: userData.bankAccountNumber || '',
            homeAddress: userData.homeAddress || '',
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: userData.updatedAt?.toDate() || new Date()
          });
        } else {
          // If user doesn't exist in Firestore, create them
          await handleGoogleUserSetup(firebaseUser, null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Update user's availability status
    if (result.user) {
      const defaultEmploymentType = EmploymentType.FREELANCE;
      const staffId = `${defaultEmploymentType}${result.user.uid.slice(-3)}`;
      
      await updateDoc(doc(db, 'users', result.user.uid), {
        employmentType: defaultEmploymentType,
        staffId: staffId,
        availabilityStatus: AvailabilityStatus.IDLE,
        updatedAt: Timestamp.fromDate(new Date())
      });
    }
  };

  const handleGoogleUserSetup = async (user: FirebaseUser, result: any) => {
    // Check if user exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    const defaultEmploymentType = EmploymentType.FREELANCE;
    const staffId = `${defaultEmploymentType}${user.uid.slice(-3)}`;
    
    if (!userDoc.exists()) {
      // Create new user document
      const userData = {
        fullname: user.displayName || '',
        email: user.email || '',
        profileImageUrl: user.photoURL || '',
        isAdmin: false,
        phoneNumber: '',
        bio: '',
        skills: [],
        availabilityStatus: AvailabilityStatus.IDLE,
        employmentType: defaultEmploymentType,
        staffId: staffId,
        bankName: '',
        bankAccountNumber: '',
        homeAddress: '',
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
    } else {
      // Update existing user's availability status
      await updateDoc(doc(db, 'users', user.uid), {
        availabilityStatus: AvailabilityStatus.IDLE,
        updatedAt: Timestamp.fromDate(new Date())
      });
    }
  };

  const signInWithGoogle = async () => {
    // Detect mobile and use appropriate method
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Also check for small screens and touch devices
    const hasSmallScreen = window.innerWidth <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    const shouldUseRedirect = isMobile || (hasSmallScreen && isTouchDevice);
    
    if (shouldUseRedirect) {
      // Use redirect for mobile/touch devices
      console.log('Using redirect for mobile device');
      await signInWithRedirect(auth, googleProvider);
    } else {
      // Use popup for desktop
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          await handleGoogleUserSetup(result.user, result);
        }
      } catch (error) {
        console.error('Google sign-in error:', error);
        // Fallback to redirect if popup fails
        if ((error as any).code === 'auth/popup-blocked') {
          console.log('Popup blocked, falling back to redirect');
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw error;
        }
      }
    }
  };

  const signUp = async (email: string, password: string, fullname: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    if (result.user) {
      const defaultEmploymentType = EmploymentType.FREELANCE;
      const staffId = `${defaultEmploymentType}${result.user.uid.slice(-3)}`;
      
      const userData = {
        fullname: fullname,
        email: email,
        profileImageUrl: '',
        isAdmin: false,
        phoneNumber: '',
        bio: '',
        skills: [],
        availabilityStatus: AvailabilityStatus.IDLE,
        employmentType: defaultEmploymentType,
        staffId: staffId,
        bankName: '',
        bankAccountNumber: '',
        homeAddress: '',
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userData);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!firebaseUser) return;
    
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      ...userData,
      updatedAt: Timestamp.fromDate(new Date())
    });
  };

  const value = {
    user,
    firebaseUser,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}