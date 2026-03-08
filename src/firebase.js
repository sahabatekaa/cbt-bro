// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// GANTI DENGAN KONFIGURASI FIREBASE ANDA
const firebaseConfig = {
  apiKey: "AIzaSyAo__dEUYUQmF_SeJKy8wbo0QaOiBzusEw",
  authDomain: "cbt-nextgen.firebaseapp.com",
  databaseURL: "https://cbt-nextgen-default-rtdb.firebaseio.com",
  projectId: "cbt-nextgen",
  storageBucket: "cbt-nextgen.firebasestorage.app",
  messagingSenderId: "719826370448",
  appId: "1:719826370448:web:ee28abf7410851d2b87d15"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);