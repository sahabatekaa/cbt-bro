import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, push, onValue, get } from 'firebase/database';
import { GraduationCap, Moon, Sun, User, Lock, Key, LayoutGrid } from 'lucide-react';

import ExamRoom from './components/ExamRoom';
import ResultPage from './components/ResultPage';
import TeacherDashboard from './components/TeacherDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState(localStorage.getItem('currentView') || 'login');
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [examScore, setExamScore] = useState(0);
  const [logoClicks, setLogoClicks] = useState(0);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false); // State untuk form daftar

  const getSafeData = () => {
    try { return JSON.parse(localStorage.getItem('studentData')) || null; } 
    catch (e) { localStorage.removeItem('studentData'); return null; }
  };
  const [studentData, setStudentData] = useState(getSafeData());

  useEffect(() => {
    localStorage.setItem('currentView', currentView);
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [currentView, darkMode]);

  useEffect(() => {
    const sessionRef = ref(db, 'exam_sessions');
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setActiveSessions(Object.values(data).filter(s => s.status === 'open'));
      else setActiveSessions([]);
    });
    return () => unsubscribe();
  }, []);

  const availableClasses = [...new Set(activeSessions.map(s => s.kelas).filter(Boolean))];

  const handleStudentStart = async (e) => {
    e.preventDefault();
    const name = e.target.studentName.value;
    const sClass = e.target.studentClass.value;
    const tokenInput = e.target.token.value.toUpperCase();

    const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);
    if (!validSession) return alert("AKSES DITOLAK: Token salah atau Kelas belum dibuka oleh Guru!");

    try {
      const newRef = push(ref(db, 'live_students'));
      const data = { id: newRef.key, name, class: sClass, kelas: sClass, token: tokenInput, mapel: validSession.mapel, status: 'Online', progress: 0, warnings: 0, timestamp: Date.now() };
      await set(newRef, data);
      setStudentData(data);
      localStorage.setItem('studentData', JSON.stringify(data));
      setCurrentView('exam');
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } catch (error) { alert("Koneksi bermasalah."); }
  };

  // LOGIKA LOGIN GURU
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pass = e.target.password.value;
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCred.user;
      
      if (user.email === 'admin@sekolah.com') {
        setCurrentView('superadmin');
      } else {
        // Cek status Approval di Database
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        if (snap.exists() && snap.val().status === 'pending') {
          await signOut(auth);
          alert("AKUN BELUM AKTIF!\nSilakan tunggu Super Admin untuk menyetujui pendaftaran Anda.");
        } else {
          setCurrentView('teacher');
        }
      }
    } catch (err) { alert("Email atau Password Salah!"); }
  };

  // LOGIKA DAFTAR GURU BARU
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const pass = e.target.password.value;
    try {
      // Buat akun di Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCred.user;
      // Simpan profil & nama di Database dengan status PENDING
      await set(ref(db, `users/${user.uid}`), {
        name: name,
        email: email,
        role: 'teacher',
        status: 'pending',
        createdAt: Date.now()
      });
      await signOut(auth); // Langsung logout agar tidak masuk dashboard
      alert("PENDAFTARAN BERHASIL!\nAkun Anda sedang ditinjau. Hubungi Admin Sekolah untuk aktivasi.");
      setIsRegistering(false); // Kembali ke form login
    } catch (err) { alert("Pendaftaran gagal! Pastikan password min. 6 karakter atau email belum terdaftar."); }
  };

  const logout = () => {
    signOut(auth);
    localStorage.clear();
    setStudentData(null);
    setCurrentView('login');
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-950 transition-colors duration-300">
        <button onClick={() => setDarkMode(!darkMode)} className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-white text-slate-800 shadow-md"><Moon size={20} /></button>

        {currentView === 'login' && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl">
              <div className="flex flex-col items-center mb-8">
                <div onClick={() => { setLogoClicks(c => c + 1); if (logoClicks + 1 >= 5) { setCurrentView('admin-login'); setLogoClicks(0); } }} className="bg-emerald-500 p-4 rounded-2xl text-white mb-4 cursor-pointer"><GraduationCap size={40} /></div>
                <h1 className="text-2xl font-black text-slate-800">CBT BRO</h1>
                <p className="text-emerald-600 font-medium text-sm mt-1">Portal Ujian Siswa</p>
              </div>
              <form onSubmit={handleStudentStart} className="space-y-4">
                <div className="relative"><User className="absolute left-4 top-3.5 text-gray-400" size={20} /><input name="studentName" required placeholder="Nama Lengkap Siswa" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 ring-emerald-400 outline-none" /></div>
                <div className="relative"><LayoutGrid className="absolute left-4 top-3.5 text-gray-400" size={20} /><select name="studentClass" required className="w-full pl-12 pr-4 py-3.5 bg-gray-50 text-slate-800 border border-gray-200 rounded-xl focus:ring-2 ring-emerald-400 outline-none font-semibold appearance-none"><option value="">Pilih Kelas Anda...</option>{availableClasses.length > 0 ? (availableClasses.map((c, index) => <option key={index} value={c}>{c}</option>)) : (<option disabled>-- Belum Ada Sesi Dibuka --</option>)}</select></div>
                <div className="relative"><Key className="absolute left-4 top-3.5 text-gray-400" size={20} /><input name="token" required placeholder="Token Ujian" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 ring-emerald-400 outline-none font-mono font-bold uppercase" /></div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl mt-2">MULAI UJIAN</button>
              </form>
            </div>
          </div>
        )}

        {currentView === 'admin-login' && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl">
              <h1 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800"><Lock className="text-emerald-500"/> Akses Guru</h1>
              
              {!isRegistering ? (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <input name="email" type="email" placeholder="Email Guru" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <input name="password" type="password" placeholder="Password" required className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold mt-2">LOGIN SISTEM</button>
                  <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-emerald-600 font-bold text-sm pt-2">Belum punya akun? Daftar Guru Baru</button>
                  <button type="button" onClick={() => setCurrentView('login')} className="w-full text-gray-500 font-medium text-sm">Batal, Kembali ke Siswa</button>
                </form>
              ) : (
                <form onSubmit={handleAdminRegister} className="space-y-4">
                  <input name="name" type="text" placeholder="Nama Lengkap Beserta Gelar" required className="w-full p-3.5 bg-gray-50 border border-emerald-100 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <input name="email" type="email" placeholder="Email Baru" required className="w-full p-3.5 bg-gray-50 border border-emerald-100 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <input name="password" type="password" placeholder="Buat Password (Min. 6 Karakter)" required className="w-full p-3.5 bg-gray-50 border border-emerald-100 rounded-xl outline-none focus:ring-2 ring-emerald-400" />
                  <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold mt-2">DAFTARKAN AKUN</button>
                  <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-gray-500 font-medium text-sm pt-2">Sudah punya akun? Login di sini</button>
                </form>
              )}
            </div>
          </div>
        )}

        {currentView === 'exam' && <ExamRoom studentData={studentData} onFinish={(score) => { setExamScore(score); setCurrentView('result'); }} />}
        {currentView === 'result' && <ResultPage score={examScore} studentData={studentData} onLogout={logout} />}
        {currentView === 'teacher' && <TeacherDashboard onLogout={logout} />}
        {currentView === 'superadmin' && <SuperAdminDashboard onLogout={logout} />}
      </div>
    </div>
  );
}