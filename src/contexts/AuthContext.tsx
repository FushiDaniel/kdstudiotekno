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

  // Auto status tracking when app is active
  useEffect(() => {
    if (!user) return;

    let activityTimeout: NodeJS.Timeout;
    
    const updateStatusToOnline = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          availabilityStatus: AvailabilityStatus.DALAM_TALIAN,
          lastActivity: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        });
      } catch (error) {
        console.error('Error updating status to online:', error);
      }
    };

    const updateStatusToInactive = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          availabilityStatus: AvailabilityStatus.TIDAK_AKTIF,
          updatedAt: Timestamp.fromDate(new Date())
        });
      } catch (error) {
        console.error('Error updating status to inactive:', error);
      }
    };

    const handleActivity = () => {
      clearTimeout(activityTimeout);
      updateStatusToOnline();
      
      // Set user as inactive after 5 minutes of no activity
      activityTimeout = setTimeout(updateStatusToInactive, 5 * 60 * 1000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateStatusToOnline();
      } else {
        updateStatusToInactive();
      }
    };

    // Set initial online status
    updateStatusToOnline();

    // Listen for user activity
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set initial activity timeout
    activityTimeout = setTimeout(updateStatusToInactive, 5 * 60 * 1000);

    return () => {
      clearTimeout(activityTimeout);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        // Set persistence to LOCAL with error handling
        await setPersistence(auth, browserLocalPersistence);
        console.log('Auth persistence set to LOCAL');
      } catch (error) {
        console.warn('Failed to set auth persistence:', error);
        // Continue anyway, this is not critical
      }

      // Check if we have a sign-in attempt flag
      const signInAttempt = localStorage.getItem('googleSignInAttempt');
      const hasAuthCallback = window.location.search.includes('code=') || 
                             window.location.search.includes('state=') || 
                             window.location.hash.includes('access_token');
      
      if (signInAttempt || hasAuthCallback) {
        console.log('Detected potential OAuth callback or sign-in attempt, checking redirect result...');
        try {
          // Clear the attempt flag first
          localStorage.removeItem('googleSignInAttempt');
          
          const result = await getRedirectResult(auth);
          if (result?.user && mounted) {
            console.log('Redirect result found, setting up user:', result.user.email);
            await handleGoogleUserSetup(result.user, result);
          } else if (hasAuthCallback) {
            console.log('Auth callback detected but no redirect result - this is the storage partition issue');
            // Clear the URL to prevent repeated attempts
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (error) {
          console.error('Redirect sign-in error:', error);
          const errorMessage = (error as Error).message || '';
          
          if (errorMessage.includes('missing initial state') || errorMessage.includes('storage')) {
            console.log('Storage partition error detected - clearing URL and showing error');
            // Clear the problematic URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Show user-friendly message
            alert('Login gagal kerana masalah teknikal. Sila cuba lagi dengan menggunakan browser yang berbeza atau mode incognito.');
          }
        }
      }
    };

    initializeAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email || 'No user');
      
      if (!mounted) return;
      
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        
        try {
          // Fetch user data from Firestore with timeout
          const userDocPromise = getDoc(doc(db, 'users', firebaseUser.uid));
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore timeout')), 10000)
          );
          
          const userDoc = await Promise.race([userDocPromise, timeoutPromise]) as any;
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              fullname: userData.fullname || firebaseUser.displayName || '',
              email: userData.email || firebaseUser.email || '',
              profileImageUrl: userData.profileImageUrl || firebaseUser.photoURL || '',
              isAdmin: userData.isAdmin || false,
              isApproved: userData.isApproved || false,
              phoneNumber: userData.phoneNumber || '',
              bio: userData.bio || '',
              skills: userData.skills || [],
              availabilityStatus: userData.availabilityStatus || AvailabilityStatus.IDLE,
              employmentType: userData.employmentType || EmploymentType.FREELANCE,
              staffId: userData.staffId || `FL${firebaseUser.uid.slice(-3)}`,
              bankName: userData.bankName || '',
              bankAccountNumber: userData.bankAccountNumber || '',
              homeAddress: userData.homeAddress || '',
              createdAt: userData.createdAt?.toDate() || new Date(),
              updatedAt: userData.updatedAt?.toDate() || new Date()
            });
          } else {
            // If user doesn't exist in Firestore, create them
            console.log('User not found in Firestore, creating new user document');
            await handleGoogleUserSetup(firebaseUser, null);
          }
        } catch (error) {
          console.error('Error setting up user data:', error);
          // Set basic user info even if Firestore fails
          setUser({
            uid: firebaseUser.uid,
            fullname: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            profileImageUrl: firebaseUser.photoURL || '',
            isAdmin: false,
            isApproved: false,
            phoneNumber: '',
            bio: '',
            skills: [],
            availabilityStatus: AvailabilityStatus.DALAM_TALIAN,
            employmentType: EmploymentType.FREELANCE,
            staffId: `FL${firebaseUser.uid.slice(-3)}`,
            bankName: '',
            bankAccountNumber: '',
            homeAddress: '',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
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
        availabilityStatus: AvailabilityStatus.DALAM_TALIAN,
        updatedAt: Timestamp.fromDate(new Date())
      });
    }
  };

  const handleGoogleUserSetup = async (user: FirebaseUser, _result: unknown) => {
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
        isApproved: false,
        phoneNumber: '',
        bio: '',
        skills: [],
        availabilityStatus: AvailabilityStatus.DALAM_TALIAN,
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
        availabilityStatus: AvailabilityStatus.DALAM_TALIAN,
        updatedAt: Timestamp.fromDate(new Date())
      });
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google sign-in...');
      
      // Always try popup first for all devices
      // This avoids the sessionStorage/storage partition issues entirely
      try {
        console.log('Attempting popup sign-in...');
        const result = await signInWithPopup(auth, googleProvider);
        if (result?.user) {
          console.log('Popup sign-in successful:', result.user.email);
          await handleGoogleUserSetup(result.user, result);
          return;
        }
      } catch (popupError) {
        console.error('Popup sign-in failed:', popupError);
        const error = popupError as { code?: string; message?: string };
        
        // Only use redirect as last resort and with better handling
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
          console.log('Popup blocked/closed, trying redirect...');
          
          // Clear any existing session storage that might cause issues
          try {
            sessionStorage.clear();
            localStorage.removeItem('firebase:authUser:AIzaSyBGqOsOhjB6KskPI9me3mdbgqlrtMjkSXA:[DEFAULT]');
          } catch (storageError) {
            console.warn('Could not clear storage:', storageError);
          }
          
          // Set a flag to track redirect attempt
          localStorage.setItem('googleSignInAttempt', JSON.stringify({
            timestamp: Date.now(),
            userAgent: navigator.userAgent
          }));
          
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw popupError;
        }
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
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
        isApproved: false,
        phoneNumber: '',
        bio: '',
        skills: [],
        availabilityStatus: AvailabilityStatus.DALAM_TALIAN,
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