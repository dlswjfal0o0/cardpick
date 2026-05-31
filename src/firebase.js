import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBu-upkO2b5JosVFg_Cle3QRMG1DfSY0fQ",
  authDomain: "cardpick-4d932.firebaseapp.com",
  projectId: "cardpick-4d932",
  storageBucket: "cardpick-4d932.firebasestorage.app",
  messagingSenderId: "577270059732",
  appId: "1:577270059732:web:1ec89b72834c114bfba141"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
