import React, { useState, useEffect } from 'react';
import { GraduationCap, Sun, Moon, Lock, UserPlus, ArrowLeft } from 'lucide-react';
import { ref, push, set, get, onValue } from 'firebase/database';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

import ExamRoom from './components/ExamRoom';
import ResultPage from './components/ResultPage';
import TeacherDashboard from './components/TeacherDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('currentView') || 'studentLogin');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [studentSession, setStudentSession] = useState(() => JSON.parse(localStorage.getItem('studentSession')) || null);
  const [examScore, setExamScore] = useState(0);
  const [logoClicks, setLogoClicks] = useState(0);
  const [activeSessions, setActiveSessions] = useState([]);

  useEffect(() => {
      const unsubscribe = onValue(ref(db, 'active_sessions'), (snapshot) => {
        if (snapshot.exists()) {
          const sessions = Object.values(snapshot.val());
          const active = sessions.filter(s => s.status === 'active');
          setActiveSessions(active);
          setAvailableClasses([...new Set(active.map(s => s.kelas))]);
        } else {
          setActiveSessions([]);
          setAvailableClasses([]);
        }
      });
      return () => unsubscribe();
    }, []);
    useEffect(() => {
  // Menarik data sesi yang statusnya 'open' saja dari Firebase
  const sessionRef = ref(db, 'exam_sessions');
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const list = Object.values(data).filter(s => s.status === 'open');
      setActiveSessions(list);
    } else {
      setActiveSessions([]);
    }
  });
  return () => unsubscribe();
}, []);

// Ambil daftar kelas unik untuk dropdown otomatis
const availableClasses = [...new Set(activeSessions.map(s => s.kelas))];

  useEffect(() => {
    localStorage.setItem('currentView', currentView);
    localStorage.setItem('darkMode', darkMode);
    if (studentSession) localStorage.setItem('studentSession', JSON.stringify(studentSession));
    else localStorage.removeItem('studentSession');

    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [currentView, darkMode, studentSession]);

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);
    if (newClicks >= 5) {
      setCurrentView('adminLogin');
      setLogoClicks(0);
    }
    setTimeout(() => setLogoClicks(0), 2000);
  };

  const handleStudentLogout = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(err => console.log(err));
    setStudentSession(null);
    setCurrentView('studentLogin');
  };

  const StudentLogin = () => {
    const [name, setName] = useState('');
    const [kelas, setKelas] = useState('');
    const [token, setToken] = useState('');
    const [availableClasses, setAvailableClasses] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);


    const handleStudentStart = async (e) => {
  e.preventDefault();
  const name = e.target.studentName.value;
  const sClass = e.target.studentClass.value;
  const tokenInput = e.target.token.value.toUpperCase();

  // Validasi: Cek apakah token dan kelas ini ada di database sesi
  const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);

  if (!validSession) {
    return alert("AKSES DITOLAK: Token atau Kelas tidak ditemukan pada sesi aktif!");
  }

  try {
    const newRef = push(ref(db, 'live_students'));
    await set(newRef, { 
      id: newRef.key, 
      name, 
      class: sClass, 
      token: tokenInput, 
      mapel: validSession.mapel, // Ambil mapel otomatis dari sesi
      status: 'Online', 
      progress: 0, 
      warnings: 0, 
      timestamp: Date.now() 
    });
    
    setStudentData({ id: newRef.key, name, class: sClass, token: tokenInput });
    localStorage.setItem('studentData', JSON.stringify({ id: newRef.key, name, class: sClass, token: tokenInput }));
    setCurrentView('exam');
  } catch (err) {
    alert("Gagal terhubung ke database!");
  }
};

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 p-4 transition-colors">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/50 dark:border-gray-700 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] w-full max-w-md">
          <div className="text-center mb-8 select-none">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-tr from-green-500 to-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 mb-4 cursor-pointer transition-transform active:scale-95" onClick={handleLogoClick}>
              <GraduationCap className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-emerald-800 dark:text-emerald-300">CBT Next-Gen</h1>
            <p className="text-emerald-600/80 dark:text-emerald-400 font-medium text-sm md:text-base">Portal Ujian Islami</p>
          </div>
          <form onSubmit={handleStudentStart} className="space-y-4 md:space-y-5">
            <div>
              <label className="block text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-1">Nama Lengkap Siswa</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-4 focus:ring-emerald-500/30 bg-white/80 dark:bg-gray-800/80 dark:text-white transition-all shadow-inner text-sm md:text-base" placeholder="Masukkan Nama..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-1">Pilih Kelas</label>
              <select name="studentClass" required className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-bold text-emerald-800">
  <option value="">-- Pilih Kelas Anda --</option>
  {availableClasses.length > 0 ? (
    availableClasses.map((c, index) => (
      <option key={index} value={c}>{c}</option>
    ))
  ) : (
    <option disabled>Tidak ada sesi kelas aktif</option>
  )}
</select>
            </div>
            <div>
              <label className="block text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-1">Token Ujian</label>
              <input required type="text" value={token} onChange={e => setToken(e.target.value.toUpperCase())} className="w-full px-4 py-3 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-4 focus:ring-emerald-500/30 bg-white/80 dark:bg-gray-800/80 dark:text-white uppercase font-black text-emerald-700 dark:text-emerald-400 tracking-widest text-center shadow-inner text-sm md:text-base" placeholder="KODE TOKEN" />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-base md:text-lg py-3 md:py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/40 transform hover:-translate-y-1">MULAI UJIAN</button>
          </form>
        </div>
      </div>
    );
  };

  const AdminLogin = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [namaGuru, setNamaGuru] = useState('');

    const handleAuth = async (e) => {
      e.preventDefault();
      try {
        if (isRegistering) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await set(ref(db, `users/${userCredential.user.uid}`), { email, nama: namaGuru, role: 'pending', timestamp: Date.now() });
          alert("Pendaftaran berhasil! Silakan tunggu Super Admin untuk menyetujui akun Anda sebelum bisa login.");
          setIsRegistering(false);
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          if (userCredential.user.email === 'admin@sekolah.com') {
            setCurrentView('superAdminDashboard');
            return;
          }
          const snapshot = await get(ref(db, `users/${userCredential.user.uid}`));
          if (snapshot.exists() && snapshot.val().role === 'teacher') {
            setCurrentView('teacherDashboard');
          } else {
            auth.signOut();
            alert("Akses Ditolak: Akun Anda masih PENDING atau tidak ditemukan.");
          }
        }
      } catch (error) { alert(`Gagal: ${error.message}`); }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950 p-4 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-600/20 rounded-full blur-[80px]"></div>
        <div className="bg-gray-900/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl border border-emerald-800/50 w-full max-w-md relative z-10">
          <div className="text-center mb-6 md:mb-8">
            {isRegistering ? <UserPlus className="w-14 h-14 md:w-16 md:h-16 mx-auto text-emerald-400 mb-3 md:mb-4 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" /> : <Lock className="w-14 h-14 md:w-16 md:h-16 mx-auto text-emerald-400 mb-3 md:mb-4 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />}
            <h1 className="text-xl md:text-2xl font-bold text-white">{isRegistering ? 'Daftar Pengawas' : 'Portal Pengawas'}</h1>
            <p className="text-emerald-500 text-xs md:text-sm font-medium">{isRegistering ? 'Ajukan Akses ke Super Admin' : 'Security Gateway CBT'}</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && <input required type="text" value={namaGuru} onChange={e => setNamaGuru(e.target.value)} className="w-full px-4 py-3 bg-gray-950/50 border border-emerald-900 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 text-sm md:text-base" placeholder="Nama Lengkap & Gelar" />}
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-950/50 border border-emerald-900 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 text-sm md:text-base" placeholder="Email Instansi" />
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-950/50 border border-emerald-900 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 text-sm md:text-base" placeholder="Password" minLength="6" />
            
            <div className="pt-2 md:pt-4 flex gap-4 flex-col">
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-emerald-900/50 text-sm md:text-base">
                {isRegistering ? 'Ajukan Pendaftaran' : 'Otorisasi Login'}
              </button>
              <div className="flex justify-between items-center text-xs md:text-sm">
                {!isRegistering ? (
                  <>
                    <button type="button" onClick={() => setCurrentView('studentLogin')} className="text-gray-400 hover:text-white flex items-center gap-1"><ArrowLeft size={14}/> Kembali ke Siswa</button>
                    <button type="button" onClick={() => setIsRegistering(true)} className="text-emerald-400 hover:text-emerald-300 font-bold">Daftar Akun Baru</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsRegistering(false)} className="text-gray-400 hover:text-white w-full text-center">Sudah punya akun? Login di sini</button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <>
      {currentView === 'studentLogin' && <StudentLogin />}
      {currentView === 'adminLogin' && <AdminLogin />}
      {currentView === 'exam' && studentSession && <ExamRoom studentData={studentSession} onFinish={(score) => { setExamScore(score); setCurrentView('result'); }} />}
      {currentView === 'result' && <ResultPage score={examScore} studentSession={studentSession} onLogout={handleStudentLogout} />}
      {currentView === 'teacherDashboard' && <TeacherDashboard onLogout={() => setCurrentView('studentLogin')} />}
      {currentView === 'superAdminDashboard' && <SuperAdminDashboard onLogout={() => setCurrentView('studentLogin')} />}
      
      <button onClick={() => setDarkMode(!darkMode)} className="fixed bottom-4 right-4 md:bottom-6 md:right-6 p-3 md:p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-emerald-700 dark:text-emerald-400 rounded-full shadow-lg border border-white/50 dark:border-gray-700 hover:scale-110 transition-transform z-50 print:hidden">
        {darkMode ? <Sun size={20} className="md:w-6 md:h-6" /> : <Moon size={20} className="md:w-6 md:h-6" />}
      </button>
    </>
  );
}
