import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBGqOsOhjB6KskPI9me3mdbgqlrtMjkSXA",
  authDomain: "kdstudio-d9676.firebaseapp.com",
  projectId: "kdstudio-d9676",
  storageBucket: "kdstudio-d9676.firebasestorage.app",
  messagingSenderId: "1079743577825",
  appId: "1:1079743577825:web:356861d675c8edfd8a81a0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Google Auth Provider with mobile-friendly settings
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // Add additional parameters for better mobile compatibility
  access_type: 'online',
  include_granted_scopes: 'true'
});

// Initialize messaging (only on client side)
export const getMessagingInstance = () => {
  if (typeof window !== 'undefined') {
    return getMessaging(app);
  }
  return null;
};

export default app;