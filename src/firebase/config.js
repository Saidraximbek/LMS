import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyD7ppn2aFuVs5tkNk1VUi9qgmNxg_iEiXw",
  authDomain: "lms-sm.firebaseapp.com",
  projectId: "lms-sm",
  storageBucket: "lms-sm.firebasestorage.app",
  messagingSenderId: "709199173912",
  appId: "1:709199173912:web:01b48d262e1815b8e2266d",
  measurementId: "G-LVXWVQNH42"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export { app }
