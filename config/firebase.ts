import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2eEYXLudzFoPqrYBspC9SwK_qLbcn0vQ",
  authDomain: "pelcoelectricityapp.firebaseapp.com",
  projectId: "pelcoelectricityapp",
  storageBucket: "pelcoelectricityapp.firebasestorage.app",
  messagingSenderId: "844646572991",
  appId: "1:844646572991:web:187339dc9d57d2ae89f70a",
};

// Prevent Firebase from being initialized multiple times
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Authentication
export const auth = getAuth(app);

// Cloud Firestore
export const db = getFirestore(app);

export default app;