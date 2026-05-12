// src/pages/auth/LoginPortal.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, push, onValue, get, update } from 'firebase/database';
import { GraduationCap, User, Lock, Key, LayoutGrid, CheckCircle, ShieldCheck } from 'lucide-react';

const APP_VERSION = "3.0.0 SaaS"; 

export default function LoginPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // State Navigasi Portal
  const [portalView, setPortalView] = useState('student'); // 'student', 'admin', 'proctor'
  const [logoClicks, setLogoClicks] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // State Ujian
  const [activeSessions, setActiveSessions] = useState([]);
  const [scannedToken, setScannedToken] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // Tarik data token dari URL (Jika pakai QR Code)
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setScannedToken(tokenFromUrl.toUpperCase());
    }
  }, [searchParams]);

  // Pantau Sesi Ujian Aktif (Mendukung data V2 Legacy)
  useEffect(() => {
    const sessionsRef = ref(db, 'exam_sessions');
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      if (snapshot.val()) {
        setActiveSessions(Object.values(snapshot.val()).filter(s => s.status === 'open'));
      } else {
        setActiveSessions([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const availableClasses = [...new Set(activeSessions.map(s => s.kelas).filter(Boolean))];

  // ==========================================
  // LOGIKA LOGIN SISWA (SaaS V3)
  // ==========================================
  const handleStudentStart = async (e) => {
    e.preventDefault();
    if (isStarting) return; 
    setIsStarting(true); 

    const name = e.target.studentName.value.trim();
    const sClass = e.target.studentClass.value;
    const tokenInput = e.target.token.value.toUpperCase();
    
    const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);
    if (!validSession) {
       setIsStarting(false);
       return alert("❌ AKSES DITOLAK: Token tidak ditemukan atau Kelas salah!");
    }

    const now = new Date();
    const timeNow = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    if (validSession.jamMulai && timeNow < validSession.jamMulai) {
       setIsStarting(false);
       return alert(`🚫 BELUM MULAI!\nUjian baru akan dibuka pada jam ${validSession.jamMulai} WIB.`);
    }

    if (validSession.jamSelesai && timeNow >= validSession.jamSelesai) {
       setIsStarting(false);
       return alert(`🚫 WAKTU HABIS!\nSesi ujian ini sudah ditutup sejak jam ${validSession.jamSelesai} WIB.`);
    }

    try {
      let deviceId = localStorage.getItem('cbt_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('cbt_device_id', deviceId);
      }

      const snapshot = await get(ref(db, 'live_students'));
      let existingStudentId = null;
      let existingData = null;

      if (snapshot.exists()) {
        const allStudents = snapshot.val();
        for (const key in allStudents) {
          const s = allStudents[key];
          if (s.token === tokenInput && s.name.toLowerCase() === name.toLowerCase()) {
            if (s.status === 'Selesai') {
               setIsStarting(false);
               return alert("⚠️ Ujian untuk nama ini sudah diselesaikan dan dikumpulkan.");
            }
            if (s.deviceId && s.deviceId !== deviceId) {
               setIsStarting(false);
               return alert("🚨 ANTI-JOKI AKTIF!\nNama ini sedang mengerjakan ujian di perangkat/HP lain.");
            }
            existingStudentId = key;
            existingData = s;
            break;
          }
        }
      }

      let finalData;
      if (existingStudentId) {
        const newRef = ref(db, `live_students/${existingStudentId}`);
        finalData = { ...existingData, status: 'Online', deviceId };
        await update(newRef, { status: 'Online', deviceId });
      } else {
        const newRef = push(ref(db, 'live_students'));
        // NOTE: subKelas dihilangkan sesuai SOP Tukang Jahit
        finalData = { 
          id: newRef.key, 
          name, 
          class: sClass, 
          token: tokenInput, 
          mapel: validSession.mapel, 
          teacherEmail: validSession.teacherEmail, 
          status: 'Online', 
          progress: 0, 
          warnings: 0, 
          deviceId, 
          timestamp: Date.now() 
        };
        await set(newRef, finalData);
      }

      localStorage.setItem('studentData', JSON.stringify(finalData));
      
      // Bypass Fullscreen API issue in modern browsers by requesting it gently later
      setIsStarting(false);
      navigate('/exam', { replace: true });

    } catch (error) { 
      alert("Koneksi bermasalah: " + error.message); 
      setIsStarting(false); 
    }
  };

  // ==========================================
  // LOGIKA LOGIN ADMIN / GURU
  // ==========================================
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const userCred = await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      if (userCred.user.email === 'admin@sekolah.com') {
          navigate('/master', { replace: true });
      } else {
        const snap = await get(ref(db, `users/${userCred.user.uid}`));
        if (snap.exists() && snap.val().status === 'pending') { 
            await signOut(auth); 
            alert("AKUN BELUM AKTIF! Tunggu konfirmasi Master Admin."); 
        } else {
            navigate('/teacher', { replace: true });
        }
      }
    } catch (err) { alert("Login Gagal! Periksa email dan password Anda."); }
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      await set(ref(db, `users/${userCred.user.uid}`), { 
          name: e.target.name.value, 
          email: e.target.email.value, 
          role: 'teacher', 
          status: 'pending', 
          createdAt: Date.now() 
      });
      await signOut(auth); 
      alert("DAFTAR BERHASIL! Tunggu konfirmasi Master Admin."); 
      setIsRegistering(false);
    } catch (err) { alert("Gagal mendaftar! " + err.message); }
  };

  // Rahasia Klik Logo 5x untuk pindah ke Admin
  const handleSecretClick = () => {
    setLogoClicks(c => c + 1);
    if (logoClicks + 1 >= 5) {
      setPortalView('admin');
      setLogoClicks(0);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 md:p-6 relative w-full">
      
      {/* VIEW: PORTAL SISWA */}
      {portalView === 'student' && (
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-col items-center mb-8">
            <div onClick={handleSecretClick} className="bg-emerald-500 p-4 rounded-2xl text-white mb-4 cursor-pointer shadow-lg shadow-emerald-500/30 transition-transform active:scale-95">
              <GraduationCap size={40} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Darma Pertiwi CBT</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">V {APP_VERSION}</span>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Portal Resmi Siswa</p>
            </div>
          </div>

          {scannedToken && searchParams.get('token') && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl text-center flex items-center justify-center gap-2 animate-pulse shadow-inner">
              <CheckCircle size={18} /> Token QR Terdeteksi!
            </div>
          )}

          <form onSubmit={handleStudentStart} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input name="studentName" required placeholder="Nama Lengkap" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 font-bold transition-all" />
            </div>
            
            {/* TAMPILAN BARU: Tanpa Sub Kelas, Full Width, Lebih Compact & Profesional */}
            <div className="relative">
              <LayoutGrid className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <select name="studentClass" required className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 appearance-none font-bold transition-all">
                <option value="">Pilih Kelas/Tingkat...</option>
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="relative">
              <Key className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input 
                name="token" 
                value={scannedToken}
                onChange={e => setScannedToken(e.target.value.toUpperCase())}
                required 
                placeholder="Kode Token Ujian" 
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 font-mono uppercase tracking-widest font-black text-center transition-all" 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isStarting}
              className={`w-full text-white font-black py-4 rounded-xl mt-4 transition-all tracking-widest text-lg ${isStarting ? 'bg-slate-400 cursor-not-allowed animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-500/30'}`}
            >
              {isStarting ? 'MEMPROSES DATA...' : 'MULAI UJIAN'}
            </button>
          </form>
        </div>
      )}

      {/* VIEW: PORTAL ADMIN & GURU */}
      {portalView === 'admin' && (
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h1 className="text-2xl font-black mb-6 text-slate-800 dark:text-white flex items-center gap-2">
            <Lock className="text-emerald-500"/> Akses Guru
          </h1>
          
          {!isRegistering ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input name="email" type="email" placeholder="Email Guru" required className="w-full p-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
              <input name="password" type="password" placeholder="Password" required className="w-full p-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
              <button type="submit" className="w-full bg-slate-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-700 text-white py-4 rounded-xl font-bold mt-2 transition-all active:scale-95">LOGIN SISTEM</button>
              
              <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-700 space-y-3">
                <button type="button" onClick={() => setPortalView('proctor')} className="w-full bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <ShieldCheck size={18}/> Masuk Sebagai Pengawas
                </button>
                <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-emerald-600 dark:text-emerald-400 font-bold text-sm py-2">Belum punya akun? Daftar Guru Baru</button>
                <button type="button" onClick={() => setPortalView('student')} className="w-full text-gray-500 dark:text-gray-400 font-medium text-sm py-2">Batal, Kembali ke Portal Siswa</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAdminRegister} className="space-y-4">
              <input name="name" type="text" placeholder="Nama Lengkap & Gelar" required className="w-full p-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-emerald-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
              <input name="email" type="email" placeholder="Email Baru" required className="w-full p-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-emerald-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
              <input name="password" type="password" placeholder="Buat Password" required className="w-full p-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-emerald-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold mt-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/30">DAFTARKAN AKUN</button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-gray-500 dark:text-gray-400 font-medium text-sm pt-2 block">Batal, kembali login</button>
            </form>
          )}
        </div>
      )}

      {/* VIEW: PORTAL PENGAWAS RUANG */}
      {portalView === 'proctor' && (
        <div className="w-full max-w-sm bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl text-center border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-300">
          <ShieldCheck size={48} className="mx-auto text-blue-500 mb-4" />
          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Akses Pengawas</h2>
          <form onSubmit={(e) => {
              e.preventDefault();
              if(e.target.pin.value === "pengawas123") {
                  navigate('/proctor', { replace: true });
              } else {
                  alert("PIN Salah!");
              }
          }}>
            <input name="pin" type="password" placeholder="Masukkan PIN..." className="w-full p-4 bg-slate-50 dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-center font-black tracking-widest outline-none focus:border-blue-500 mb-4 transition-all" required />
            <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-600/30 active:scale-95 transition-all">MASUK RUANGAN</button>
            <button type="button" onClick={() => setPortalView('admin')} className="w-full mt-4 text-sm font-bold text-slate-400 hover:text-slate-500">Kembali</button>
          </form>
        </div>
      )}

    </div>
  );
}