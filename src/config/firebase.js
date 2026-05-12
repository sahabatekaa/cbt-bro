// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAo__dEUYUQmF_SeJKy8wbo0QaOiBzusEw",
  authDomain: "cbt-nextgen.firebaseapp.com",
  databaseURL: "https://cbt-nextgen-default-rtdb.firebaseio.com",
  projectId: "cbt-nextgen",
  storageBucket: "cbt-nextgen.firebasestorage.app",
  messagingSenderId: "719826370448",
  appId: "1:719826370448:web:ee28abf7410851d2b87d15"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// ==========================================
// MULTI-TENANT HELPER FUNCTIONS (SaaS V3.0)
// ==========================================
// SOP KETAT: Seluruh akses baca/tulis data spesifik sekolah 
// WAJIB menggunakan fungsi ini agar terisolasi dengan aman.

/**
 * Mengambil path database khusus untuk satu sekolah (Tenant)
 * @param {string} schoolId - ID unik yayasan/sekolah (wajib)
 * @param {string} path - (Opsional) Path spesifik seperti 'bank_soal', 'users', 'live_sessions'
 */
export const getTenantPath = (schoolId, path = '') => {
  if (!schoolId) {
    console.error("🚨 FATAL ERROR: Akses database ditolak karena schoolId (Tenant ID) kosong!");
    throw new Error("Missing schoolId for tenant data access.");
  }
  return `tenants/${schoolId}${path ? `/${path}` : ''}`;
};

/**
 * Mengambil path database untuk kendali pusat (Super Admin)
 * @param {string} path - Path spesifik seperti 'registered_schools', 'global_settings'
 */
export const getMasterPath = (path) => {
  return `master_control/${path}`;
};