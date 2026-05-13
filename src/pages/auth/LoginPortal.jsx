// src/pages/auth/LoginPortal.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, push, onValue, get, update } from 'firebase/database';
import { GraduationCap, User, Lock, Key, LayoutGrid, Users, CheckCircle, RefreshCw, ShieldCheck, UserPlus, Loader2, ArrowLeft } from 'lucide-react';

const APP_VERSION = "2.0.0";

export default function LoginPortal() {
  const navigate = useNavigate();
  const location = useLocation();

  // State UI
  const [currentView, setCurrentView] = useState('login'); // login | admin-login | proctor-login
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [logoClicks, setLogoClicks] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); 
  const [isStarting, setIsStarting] = useState(false);
  
  // State Form Admin/Guru Baru
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  // Data Ujian
  const [activeSessions, setActiveSessions] = useState([]);
  const [scannedToken, setScannedToken] = useState('');

  // ==========================================
  // BLOKIR TOMBOL BACK FISIK HP (ANTI KELUAR APK)
  // ==========================================
  useEffect(() => {
    window.history.pushState(null, null, window.location.href);
    const handleBackButton = () => {
      window.history.pushState(null, null, window.location.href);
    };
    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [currentView]);

  // ==========================================
  // MONITORING SINKRONISASI GLOBAL (ANTI-BLANK)
  // ==========================================
  useEffect(() => {
    const versionRef = ref(db, 'settings/activeVersion');
    const unsub = onValue(versionRef, (snapshot) => {
      const serverVersion = snapshot.val();
      if (serverVersion && serverVersion !== APP_VERSION) {
        setIsSyncing(true); 
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark'); 
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Tarik Sesi Aktif dari Root DB
  useEffect(() => {
    const unsub = onValue(ref(db, 'exam_sessions'), (snapshot) => {
      if (snapshot.val()) {
        setActiveSessions(Object.values(snapshot.val()).filter(s => s.status === 'open'));
      } else {
        setActiveSessions([]);
      }
    });
    return () => unsub();
  }, []);

  // Cek URL untuk Token QR Code
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      setScannedToken(tokenFromUrl.toUpperCase());
    }
  }, [location]);

  const availableClasses = [...new Set(activeSessions.map(s => s.kelas).filter(Boolean))];

  // ==========================================
  // LOGIKA LOGIN SISWA & ANTI-JOKI
  // ==========================================
  const handleStudentStart = async (e) => {
    e.preventDefault();
    if (isStarting) return; 
    setIsStarting(true); 

    const studentNameInput = e.target.studentName.value.trim();
    const sClass = e.target.studentClass.value;
    const tokenInput = e.target.token.value.toUpperCase();
    
    // Validasi Sesi & Auto-Deteksi SubKelas dari Token
    const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);
    if (!validSession) {
       setIsStarting(false);
       return alert("❌ AKSES DITOLAK: Token tidak ditemukan atau Kelas Anda salah!");
    }

    // Ekstrak otomatis subKelas dari data sesi yang dibuat Guru
    const autoSubKelas = validSession.subKelas || '-';

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
          if (s.token === tokenInput && s.name.toLowerCase() === studentNameInput.toLowerCase()) {
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
        finalData = { 
          id: newRef.key, 
          name: studentNameInput, 
          class: sClass, 
          subKelas: autoSubKelas, // Disisipkan otomatis ke pangkalan data
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
      
      setIsStarting(false);
      navigate('/exam');
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
    setErrorMsg('');
    setIsLoadingAdmin(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      
      // Deteksi Master Admin
      if (userCred.user.email === 'admin@sekolah.com') {
          navigate('/master');
      } else {
        // Cek role di database
        const snap = await get(ref(db, `users/${userCred.user.uid}`));
        if (snap.exists()) {
           const userData = snap.val();
           if (userData.status === 'pending') { 
               await signOut(auth); 
               alert("AKUN BELUM AKTIF!\nMenunggu persetujuan Admin Tata Usaha Sekolah."); 
           } else if (userData.role === 'admin_sekolah') {
               navigate('/school-admin');
           } else if (userData.role === 'proctor') {
               navigate('/proctor');
           } else {
               navigate('/teacher');
           }
        } else {
           await signOut(auth);
           setErrorMsg("Data user tidak ditemukan di sistem!");
        }
      }
    } catch (err) { 
      setErrorMsg("Login Gagal! Periksa email dan password."); 
    } finally {
      setIsLoadingAdmin(false);
    }
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoadingAdmin(true);

    if (!schoolCode) {
      setErrorMsg('Kode Instansi wajib diisi!');
      setIsLoadingAdmin(false);
      return;
    }

    try {
      const cleanSchoolCode = schoolCode.trim().toLowerCase();

      // 1. Validasi Kode Sekolah
      const schoolSnap = await get(ref(db, `clients/${cleanSchoolCode}`));
      if (!schoolSnap.exists()) {
        throw new Error(`Kode Sekolah "${schoolCode}" tidak terdaftar. Hubungi TU.`);
      }

      // 2. Buat Akun
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // 3. Simpan dengan status PENDING
      await set(ref(db, `users/${userCred.user.uid}`), { 
          name: name, 
          email: email, 
          role: 'teacher', 
          schoolId: cleanSchoolCode,
          status: 'pending', 
          createdAt: Date.now() 
      });
      
      await signOut(auth); 
      alert(`DAFTAR BERHASIL!\nAkun Anda terhubung dengan Instansi: ${cleanSchoolCode.toUpperCase()}.\nSilakan tunggu konfirmasi Admin Tata Usaha.`); 
      
      setIsRegistering(false);
      setEmail(''); setPassword(''); setName(''); setSchoolCode('');
    } catch (err) { 
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Email ini sudah terdaftar.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password minimal 6 karakter.');
      } else {
        setErrorMsg(err.message.replace("Firebase: ", ""));
      }
    } finally {
      setIsLoadingAdmin(false);
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        
        {isSyncing && (
          <div className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
            <div className="bg-emerald-500 p-4 rounded-full animate-spin mb-6">
              <RefreshCw size={48} />
            </div>
            <h2 className="text-2xl font-black mb-2 tracking-tight">SINKRONISASI SISTEM</h2>
            <p className="text-slate-300 max-w-xs">Memperbarui ke versi {APP_VERSION}. Mohon tunggu...</p>
          </div>
        )}

        {/* ==========================================
            TAMPILAN PORTAL SISWA
        ========================================== */}
        {currentView === 'login' && (
          <div className="flex items-center justify-center min-h-screen p-4 md:p-6 relative animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700">
              <div className="flex flex-col items-center mb-8">
                {/* SENSOR RAHASIA: KLIK LOGO 5X */}
                <div onClick={() => { setLogoClicks(c => c + 1); if (logoClicks + 1 >= 5) { setCurrentView('admin-login'); setLogoClicks(0); setEmail(''); setPassword(''); } }} className="bg-emerald-500 p-4 rounded-2xl text-white mb-4 cursor-pointer shadow-lg shadow-emerald-500/30 transition-transform active:scale-90">
                    <GraduationCap size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Darma Pertiwi CBT</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">V {APP_VERSION}</span>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Portal Resmi Siswa</p>
                </div>
              </div>

              {scannedToken && (
                <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl text-center flex items-center justify-center gap-2 animate-pulse shadow-inner">
                  <CheckCircle size={18} /> Token QR Terdeteksi!
                </div>
              )}

              <form onSubmit={handleStudentStart} className="space-y-4">
                <div className="relative">
                    <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                    <input name="studentName" required placeholder="Nama Lengkap" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 font-bold" />
                </div>
                
                <div className="relative w-full">
                    <LayoutGrid className="absolute left-4 top-3.5 text-gray-400" size={20} />
                    <select name="studentClass" required className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 appearance-none font-bold">
                        <option value="">Pilih Tingkat Kelas...</option>
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
                    placeholder="Kode Token" 
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 font-mono uppercase tracking-widest font-black text-center" 
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
          </div>
        )}

        {/* ==========================================
            HALAMAN RAHASIA: LOGIN ADMIN & GURU (UI BARU)
        ========================================== */}
        {currentView === 'admin-login' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center min-h-screen p-4 md:p-6 bg-[#0f172a] animate-in fade-in duration-300">
            <div className="w-full max-w-[400px] bg-white rounded-[24px] p-8 shadow-2xl">
              
              <div className="flex items-center gap-2 mb-8">
                {isRegistering ? <UserPlus className="text-emerald-500" size={24} /> : <Lock className="text-emerald-500" size={24} />}
                <h2 className="text-[22px] font-black text-slate-800 tracking-tight">
                  {isRegistering ? 'Daftar Guru Baru' : 'Akses Sistem'}
                </h2>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl animate-pulse">
                  {errorMsg}
                </div>
              )}

              {!isRegistering ? (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <input 
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Terdaftar" 
                      className="w-full px-4 py-3.5 border border-emerald-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all bg-emerald-50/30"
                    />
                  </div>
                  <div>
                    <input 
                      type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password" 
                      className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <button type="submit" disabled={isLoadingAdmin} className="w-full bg-[#0f172a] hover:bg-slate-800 text-white py-3.5 rounded-xl text-sm font-black tracking-widest transition-all shadow-md active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2">
                      {isLoadingAdmin ? <Loader2 size={18} className="animate-spin" /> : 'LOGIN SISTEM'}
                    </button>
                  </div>

                  <div className="pt-2 space-y-3 text-center">
                    <button type="button" onClick={() => setCurrentView('proctor-login')} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2">
                      <ShieldCheck size={18} /> Masuk Sebagai Pengawas Ruang
                    </button>
                    <button type="button" onClick={() => { setIsRegistering(true); setErrorMsg(''); setEmail(''); setPassword(''); }} className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors block w-full pt-2">
                      Belum punya akun? Daftar Guru Baru
                    </button>
                    <button type="button" onClick={() => setCurrentView('login')} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors block w-full pt-1">
                      Batal, Kembali ke Portal Siswa
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAdminRegister} className="space-y-4">
                  <div>
                    <input 
                      type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Lengkap & Gelar" 
                      className="w-full px-4 py-3.5 border border-emerald-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all bg-emerald-50/30"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" required value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)}
                      placeholder="Kode Instansi / Sekolah (Cth: SEKOLAH-01)" 
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
                      placeholder="Buat Password" 
                      className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <button type="submit" disabled={isLoadingAdmin} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl text-sm font-black tracking-widest transition-all shadow-md shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2">
                      {isLoadingAdmin ? <Loader2 size={18} className="animate-spin" /> : 'DAFTARKAN AKUN'}
                    </button>
                  </div>

                  <div className="pt-2 text-center">
                    <button type="button" onClick={() => { setIsRegistering(false); setErrorMsg(''); setEmail(''); setPassword(''); }} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 w-full">
                      <ArrowLeft size={12} /> Batal, kembali login
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            HALAMAN AKSES PENGAWAS (PROCTOR LOGIN PIN)
        ========================================== */}
        {currentView === 'proctor-login' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center min-h-screen p-4 bg-slate-950 animate-in zoom-in duration-300">
             <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-200">
                <ShieldCheck size={48} className="mx-auto text-blue-500 mb-4" />
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-6">Akses Pengawas</h2>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if(e.target.pin.value === "pengawas123") {
                        navigate('/proctor');
                    } else {
                        alert("PIN Salah!");
                    }
                }}>
                   <input name="pin" type="password" placeholder="Masukkan PIN..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-center font-black tracking-widest outline-none focus:border-blue-500 mb-4" required />
                   <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-600/30 active:scale-95 transition-all">MASUK RUANGAN</button>
                   <button type="button" onClick={() => setCurrentView('admin-login')} className="w-full mt-4 text-sm font-bold text-slate-400 hover:text-slate-500">Kembali ke Menu Utama</button>
                </form>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}