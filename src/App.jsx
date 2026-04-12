import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, push, onValue } from 'firebase/database';
import { GraduationCap, Moon, Sun, User, Lock, Key, LayoutGrid } from 'lucide-react';

import ExamRoom from './components/ExamRoom';
import ResultPage from './components/ResultPage';
import TeacherDashboard from './components/TeacherDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState(localStorage.getItem('currentView') || 'login');
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [studentData, setStudentData] = useState(JSON.parse(localStorage.getItem('studentData')) || null);
  const [examScore, setExamScore] = useState(0);
  const [logoClicks, setLogoClicks] = useState(0);
  
  // State Sesi Aktif
  const [activeSessions, setActiveSessions] = useState([]);

  // Sync dengan Local Storage
  useEffect(() => {
    localStorage.setItem('currentView', currentView);
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [currentView, darkMode]);

  // Tarik Sesi Ujian (Real-time) untuk Dropdown Siswa
  useEffect(() => {
    const sessionRef = ref(db, 'exam_sessions');
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Ambil data dan pastikan statusnya 'open'
        const list = Object.values(data).filter(s => s.status === 'open');
        setActiveSessions(list);
      } else {
        setActiveSessions([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Ekstrak nama kelas yang unik (hilangkan duplikat) dan abaikan jika kosong
  const availableClasses = [...new Set(activeSessions.map(s => s.kelas).filter(Boolean))];

  // Handle Login Siswa
  const handleStudentStart = async (e) => {
    e.preventDefault();
    const name = e.target.studentName.value;
    const sClass = e.target.studentClass.value;
    const tokenInput = e.target.token.value.toUpperCase();

    // Validasi ketat: Apakah token DAN kelas ini ada di sesi yang sedang OPEN?
    const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);

    if (!validSession) {
      return alert("AKSES DITOLAK: Token salah atau Kelas belum dibuka oleh Guru!");
    }

    try {
      const newRef = push(ref(db, 'live_students'));
      const data = { 
        id: newRef.key, 
        name, 
        class: sClass, 
        kelas: sClass
        token: tokenInput,
        mapel: validSession.mapel, // Tarik Mapel otomatis dari sesi guru
        status: 'Online', 
        progress: 0, 
        warnings: 0, 
        timestamp: Date.now() 
      };
      
      await set(newRef, data);
      setStudentData(data);
      localStorage.setItem('studentData', JSON.stringify(data));
      setCurrentView('exam');
      
      // Fullscreen otomatis (untuk anti-cheat dasar)
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (error) {
      alert("Koneksi bermasalah. Pastikan Rules Firebase sudah 'true'.");
    }
  };

  // Handle Login Guru
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pass = e.target.password.value;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      if (userCredential.user.email === 'admin@sekolah.com') setCurrentView('superadmin');
      else setCurrentView('teacher');
    } catch (err) {
      alert("Kredensial Login Guru Salah!");
    }
  };

  const logout = () => {
    signOut(auth);
    localStorage.clear();
    setStudentData(null);
    setCurrentView('login');
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-yellow-400 shadow-md border border-gray-100 dark:border-slate-700"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {currentView === 'login' && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-emerald-100 dark:border-slate-700">
              
              {/* Secret Admin Gateway (Klik Logo 5x) */}
              <div className="flex flex-col items-center mb-8">
                <div 
                  onClick={() => {
                    setLogoClicks(c => c + 1);
                    if (logoClicks + 1 >= 5) { setCurrentView('admin-login'); setLogoClicks(0); }
                  }}
                  className="bg-emerald-500 p-4 rounded-2xl text-white mb-4 cursor-pointer shadow-lg shadow-emerald-500/30"
                >
                  <GraduationCap size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">CBT BRO</h1>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm mt-1">Portal Ujian Siswa</p>
              </div>

              <form onSubmit={handleStudentStart} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <input name="studentName" required placeholder="Nama Lengkap Siswa" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 ring-emerald-400 outline-none transition-all" />
                </div>
                
                <div className="relative">
                  <LayoutGrid className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <select name="studentClass" required className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 ring-emerald-400 outline-none transition-all font-semibold appearance-none">
                    <option value="">Pilih Kelas Anda...</option>
                    {availableClasses.length > 0 ? (
                      availableClasses.map((c, index) => <option key={index} value={c}>{c}</option>)
                    ) : (
                      <option disabled>-- Belum Ada Sesi Dibuka --</option>
                    )}
                  </select>
                </div>

                <div className="relative">
                  <Key className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <input name="token" required placeholder="Token Ujian" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 ring-emerald-400 outline-none transition-all font-mono font-bold uppercase tracking-widest" />
                </div>

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95 mt-2">
                  MULAI UJIAN
                </button>
              </form>
            </div>
          </div>
        )}

        {currentView === 'admin-login' && (
          <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl">
              <h1 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800"><Lock className="text-emerald-500"/> Akses Guru</h1>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <input name="email" type="email" placeholder="Email Guru" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                <input name="password" type="password" placeholder="Password" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                <button className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold active:scale-95 transition-transform mt-2">LOGIN SISTEM</button>
                <button type="button" onClick={() => setCurrentView('login')} className="w-full text-gray-500 font-medium text-sm pt-2">Batal, Kembali ke Siswa</button>
              </form>
            </div>
          </div>
        )}

        {/* Pemanggilan Komponen Lainnya */}
        {currentView === 'exam' && <ExamRoom studentData={studentData} onFinish={(score) => { setExamScore(score); setCurrentView('result'); }} />}
        {currentView === 'result' && <ResultPage score={examScore} studentData={studentData} onLogout={logout} />}
        {currentView === 'teacher' && <TeacherDashboard onLogout={logout} />}
        {currentView === 'superadmin' && <SuperAdminDashboard onLogout={logout} />}
      </div>
    </div>
  );
}