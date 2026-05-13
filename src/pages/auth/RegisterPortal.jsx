// src/pages/auth/RegisterPortal.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../config/firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { UserPlus, Loader2, ArrowLeft } from 'lucide-react';

export default function RegisterPortal() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark'); 
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    if (!schoolCode) {
      setErrorMsg('Kode Instansi wajib diisi!');
      setIsLoading(false);
      return;
    }

    try {
      const cleanSchoolCode = schoolCode.trim().toLowerCase();

      // 1. Validasi Kode Sekolah di Firebase
      const schoolSnap = await get(ref(db, `clients/${cleanSchoolCode}`));
      if (!schoolSnap.exists()) {
        throw new Error(`Kode Sekolah "${schoolCode}" tidak terdaftar. Hubungi Admin TU Anda.`);
      }

      // 2. Buat Akun Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // 3. Simpan Profil dengan status PENDING
      await set(ref(db, `users/${userCred.user.uid}`), { 
          name: name, 
          email: email, 
          role: 'teacher', 
          schoolId: cleanSchoolCode,
          status: 'pending', 
          createdAt: Date.now() 
      });
      
      // Auto-logout supaya guru dipaksa masuk ke layar login
      await signOut(auth); 
      
      alert(`DAFTAR BERHASIL!\n\nAkun Anda telah terhubung dengan Instansi:\n[ ${cleanSchoolCode.toUpperCase()} ]\n\nSilakan tunggu konfirmasi (Approval) dari Admin Tata Usaha sekolah Anda sebelum bisa login.`); 
      navigate('/login');
      
    } catch (err) { 
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Email ini sudah pernah didaftarkan. Gunakan email lain atau silakan Login.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password terlalu lemah. Minimal harus 6 karakter.');
      } else {
        setErrorMsg(err.message.replace("Firebase: ", ""));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-500">
        <div className="w-full max-w-[400px] bg-white rounded-[24px] p-8 shadow-2xl">
          
          <div className="flex items-center gap-2 mb-8">
            <UserPlus className="text-emerald-500" size={24} />
            <h2 className="text-[22px] font-black text-slate-800 tracking-tight">
              Daftar Guru Baru
            </h2>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl animate-pulse">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <input 
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Nama Lengkap & Gelar (Cth: Budi, S.Pd)" 
                className="w-full px-4 py-3.5 border border-emerald-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all bg-emerald-50/30"
              />
            </div>
            <div>
              <input 
                type="text" required value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="Kode Instansi (Cth: SEKOLAH-01)" 
                className="w-full px-4 py-3.5 border border-emerald-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-bold text-slate-800 placeholder-slate-400 transition-all bg-emerald-50/30 uppercase"
              />
            </div>
            <div>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Baru" 
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all"
              />
            </div>
            <div>
              <input 
                type="password" required minLength="6" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Buat Password (Min 6 Karakter)" 
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all"
              />
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl text-sm font-black tracking-widest transition-all shadow-md shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'DAFTARKAN AKUN'}
              </button>
            </div>

            <div className="pt-2 text-center">
              <button type="button" onClick={() => navigate('/login')} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 w-full p-2">
                <ArrowLeft size={12} /> Batal, Kembali ke Login
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}