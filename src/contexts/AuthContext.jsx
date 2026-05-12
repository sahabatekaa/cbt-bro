// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { RefreshCw } from 'lucide-react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [tenantData, setTenantData] = useState(null); // Menyimpan profil spesifik sekolah klien
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Cek identitas global user di root direktori
          const userRef = ref(db, `users/${user.uid}`);
          const userSnap = await get(userRef);

          if (userSnap.exists()) {
            const data = userSnap.val();
            setUserData(data);
            setCurrentUser(user);

            // 2. Jika user terkait dengan sebuah yayasan/sekolah (punya schoolId)
            if (data.schoolId && data.role !== 'superadmin') {
              const tenantRef = ref(db, `tenants/${data.schoolId}/profile`);
              const tenantSnap = await get(tenantRef);
              if (tenantSnap.exists()) {
                setTenantData({ id: data.schoolId, ...tenantSnap.val() });
              }
            }
          } else {
            // User ada di Firebase Auth tapi tidak ada di Realtime DB (Kasus anomali)
            setUserData(null);
            setCurrentUser(user);
          }
        } catch (error) {
          console.error("🚨 FATAL: Gagal menarik data otentikasi SaaS:", error);
        }
      } else {
        // User logout atau belum login
        setCurrentUser(null);
        setUserData(null);
        setTenantData(null);
      }
      setLoading(false); // Matikan layar loading setelah data siap
    });

    return unsubscribe;
  }, []);

  // Paket data yang akan disebar ke seluruh komponen aplikasi
  const value = {
    currentUser,
    userData,
    tenantData,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? (
        children
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
          <RefreshCw className="animate-spin text-emerald-500 mb-4" size={48} />
          <h2 className="text-xl font-black tracking-widest animate-pulse">MENYIAPKAN SISTEM...</h2>
          <p className="text-slate-400 text-sm mt-2 font-medium">Melakukan verifikasi data institusi</p>
        </div>
      )}
    </AuthContext.Provider>
  );
}

// Custom Hook untuk memudahkan pemanggilan di komponen lain
export function useAuth() {
  return useContext(AuthContext);
}