import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, push, onValue, get, update } from 'firebase/database';
// TAMBAHAN IKON: RefreshCw untuk indikator sinkronisasi, ShieldCheck untuk Pengawas
import { GraduationCap, Moon, Sun, User, Lock, Key, LayoutGrid, Users, CheckCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import ExamRoom from './components/ExamRoom';
import ResultPage from './components/ResultPage';
import TeacherDashboard from './components/TeacherDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import ProctorDashboard from './components/ProctorDashboard';

// ==========================================
// KONFIGURASI VERSI APLIKASI (V2)
// ==========================================
const APP_VERSION = "2.0.0"; 

export default function App() {
  const [currentView, setCurrentView] = useState(localStorage.getItem('currentView') || 'login');
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [examScore, setExamScore] = useState(0);
  const [logoClicks, setLogoClicks] = useState(0);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); 
  
  const [scannedToken, setScannedToken] = useState('');
  
  const getSafeData = () => { try { return JSON.parse(localStorage.getItem('studentData')) || null; } catch (e) { localStorage.removeItem('studentData'); return null; } };
  const [studentData, setStudentData] = useState(getSafeData());

  // ==========================================
  // BLOKIR TOMBOL BACK FISIK HP (ANTI KELUAR APK)
  // ==========================================
  useEffect(() => {
    // Suntikkan history palsu ke dalam sistem
    window.history.pushState(null, null, window.location.href);
    
    const handleBackButton = (event) => {
      // Saat tombol back ditekan, suntikkan lagi history palsu 
      // sehingga tidak pernah bisa kembali (keluar APK)
      window.history.pushState(null, null, window.location.href);
      
      // Opsional: Jika bos mau ada alert saat tombol back dipencet saat ujian, uncomment baris bawah ini:
      // if (currentView === 'exam') alert("Tindakan diblokir! Gunakan tombol navigasi di dalam layar.");
    };

    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [currentView]);

  // 1. MONITORING SINKRONISASI GLOBAL (ANTI-BLANK UPDATE)
  useEffect(() => {
    const versionRef = ref(db, 'settings/activeVersion');
    onValue(versionRef, (snapshot) => {
      const serverVersion = snapshot.val();
      if (serverVersion && serverVersion !== APP_VERSION) {
        setIsSyncing(true); 
        
        if (studentData) {
          localStorage.setItem('sync_backup', JSON.stringify(studentData));
        }

        setTimeout(() => {
          window.location.reload(true);
        }, 3000);
      }
    });
  }, [studentData]);

  useEffect(() => {
    localStorage.setItem('currentView', currentView);
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
  }, [currentView, darkMode]);

  useEffect(() => {
    onValue(ref(db, 'exam_sessions'), (snapshot) => {
      if (snapshot.val()) setActiveSessions(Object.values(snapshot.val()).filter(s => s.status === 'open'));
      else setActiveSessions([]);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      setScannedToken(tokenFromUrl.toUpperCase());
    }
  }, []);

  const availableClasses = [...new Set(activeSessions.map(s => s.kelas).filter(Boolean))];

  const handleStudentStart = async (e) => {
    e.preventDefault();
    const name = e.target.studentName.value.trim();
    const sClass = e.target.studentClass.value;
    const sSubKelas = e.target.studentSubClass.value.toUpperCase().trim();
    const tokenInput = e.target.token.value.toUpperCase();
    
    const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);
    if (!validSession) return alert("❌ AKSES DITOLAK: Token tidak ditemukan atau Kelas salah!");

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
               return alert("⚠️ Ujian untuk nama ini sudah diselesaikan dan dikumpulkan.");
            }
            if (s.deviceId && s.deviceId !== deviceId) {
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
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const newRef = push(ref(db, 'live_students'));
        finalData = { 
          id: newRef.key, 
          name, 
          class: sClass, 
          subKelas: sSubKelas, 
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

      setStudentData(finalData);
      localStorage.setItem('studentData', JSON.stringify(finalData));
      setCurrentView('exam');
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } catch (error) { 
      alert("Koneksi bermasalah: " + error.message); 
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const userCred = await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      if (userCred.user.email === 'admin@sekolah.com') setCurrentView('superadmin');
      else {
        const snap = await get(ref(db, `users/${userCred.user.uid}`));
        if (snap.exists() && snap.val().status === 'pending') { await signOut(auth); alert("AKUN BELUM AKTIF!"); } 
        else setCurrentView('teacher');
      }
    } catch (err) { alert("Login Gagal!"); }
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      await set(ref(db, `users/${userCred.user.uid}`), { name: e.target.name.value, email: e.target.email.value, role: 'teacher', status: 'pending', createdAt: Date.now() });
      await signOut(auth); alert("DAFTAR BERHASIL! Tunggu konfirmasi Admin."); setIsRegistering(false);
    } catch (err) { alert("Gagal mendaftar!"); }
  };

  const logout = () => { signOut(auth); localStorage.clear(); setStudentData(null); setCurrentView('login'); };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        
        {isSyncing && (
          <div className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
            <div className="bg-emerald-500 p-4 rounded-full animate-spin mb-6">
              <RefreshCw size={48} />
            </div>
            <h2 className="text-2xl font-black mb-2 tracking-tight">SINKRONISASI SISTEM</h2>
            <p className="text-slate-300 max-w-xs">Memperbarui ke versi {APP_VERSION}. Mohon tunggu, data ujian Anda aman sedang diamankan...</p>
          </div>
        )}

        {currentView === 'login' && (
          <div className="flex items-center justify-center min-h-screen p-4 md:p-6 relative">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700">
              <div className="flex flex-col items-center mb-8">
                {/* LOGO KLIK 5x UNTUK AKSES RAHASIA */}
                <div onClick={() => { setLogoClicks(c => c + 1); if (logoClicks + 1 >= 5) { setCurrentView('admin-login'); setLogoClicks(0); } }} className="bg-emerald-500 p-4 rounded-2xl text-white mb-4 cursor-pointer shadow-lg shadow-emerald-500/30"><GraduationCap size={40} /></div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Darma Pertiwi CBT</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">V {APP_VERSION}</span>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Portal Resmi Siswa</p>
                </div>
              </div>

              {scannedToken && window.location.search.includes('token') && (
                <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl text-center flex items-center justify-center gap-2 animate-pulse shadow-inner">
                  <CheckCircle size={18} /> Token QR Terdeteksi!
                </div>
              )}

              <form onSubmit={handleStudentStart} className="space-y-4">
                <div className="relative"><User className="absolute left-4 top-3.5 text-gray-400" size={20} /><input name="studentName" required placeholder="Nama Lengkap" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 font-bold" /></div>
                
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                  <div className="relative flex-1"><LayoutGrid className="absolute left-4 top-3.5 text-gray-400" size={20} /><select name="studentClass" required className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 appearance-none font-bold"><option value="">Tingkat...</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="relative w-full sm:w-1/3"><Users className="absolute left-3 top-3.5 text-gray-400" size={20} /><input name="studentSubClass" required placeholder="Sub (A)" className="w-full pl-10 pr-3 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-emerald-400 uppercase font-black text-center tracking-wider" /></div>
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
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl mt-4 active:scale-95 transition-transform shadow-lg shadow-emerald-500/30 tracking-widest text-lg">MULAI UJIAN</button>
              </form>
            </div>
          </div>
        )}

        {/* HALAMAN RAHASIA: LOGIN ADMIN & GURU */}
        {currentView === 'admin-login' && (
          <div className="flex items-center justify-center min-h-screen p-4 md:p-6 bg-slate-950">
            <div className="w-full max-w-md bg-white p-6 md:p-8 rounded-3xl shadow-xl">
              <h1 className="text-2xl font-black mb-6 text-slate-800 flex items-center gap-2"><Lock className="text-emerald-500"/> Akses Guru</h1>
              
              {!isRegistering ? (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <input name="email" type="email" placeholder="Email Guru" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <input name="password" type="password" placeholder="Password" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold mt-2 transition-all active:scale-95">LOGIN SISTEM</button>
                  
                  <div className="pt-5 mt-5 border-t border-slate-100 space-y-3">
                    <button type="button" onClick={() => setCurrentView('proctor-login')} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                      <ShieldCheck size={18}/> Masuk Sebagai Pengawas Ruang
                    </button>
                    <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-emerald-600 font-bold text-sm py-2">Belum punya akun? Daftar Guru Baru</button>
                    <button type="button" onClick={() => setCurrentView('login')} className="w-full text-gray-500 font-medium text-sm py-2">Batal, Kembali ke Portal Siswa</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAdminRegister} className="space-y-4">
                  <input name="name" type="text" placeholder="Nama Lengkap & Gelar" required className="w-full p-3.5 bg-gray-50 border border-emerald-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <input name="email" type="email" placeholder="Email Baru" required className="w-full p-3.5 bg-gray-50 border border-emerald-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <input name="password" type="password" placeholder="Buat Password" required className="w-full p-3.5 bg-gray-50 border border-emerald-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold mt-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/30">DAFTARKAN AKUN</button>
                  <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-gray-500 font-medium text-sm pt-2 block">Batal, kembali login</button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* HALAMAN AKSES PENGAWAS (PROCTOR LOGIN PIN) */}
        {currentView === 'proctor-login' && (
          <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
             <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-200">
                <ShieldCheck size={48} className="mx-auto text-blue-500 mb-4" />
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-6">Akses Pengawas</h2>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if(e.target.pin.value === "pengawas123") {
                        setCurrentView('proctor-dashboard');
                    } else {
                        alert("PIN Salah!");
                    }
                }}>
                   <input name="pin" type="password" placeholder="Masukkan PIN..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-center font-black tracking-widest outline-none focus:border-blue-500 mb-4" required />
                   <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-600/30 active:scale-95 transition-all">MASUK RUANGAN</button>
                   <button type="button" onClick={() => setCurrentView('admin-login')} className="w-full mt-4 text-sm font-bold text-slate-400 hover:text-slate-500">Kembali</button>
                </form>
             </div>
          </div>
        )}

        {/* ROUTING KOMPONEN */}
        {currentView === 'exam' && <ExamRoom studentData={studentData} onFinish={(score) => { setExamScore(score); setCurrentView('result'); }} />}
        {currentView === 'result' && <ResultPage score={examScore} studentData={studentData} onLogout={logout} />}
        {currentView === 'teacher' && <TeacherDashboard onLogout={logout} />}
        {currentView === 'superadmin' && <SuperAdminDashboard onLogout={logout} />}
        {currentView === 'proctor-dashboard' && <ProctorDashboard onLogout={() => setCurrentView('login')} />}
      </div>
    </div>
  );
}
