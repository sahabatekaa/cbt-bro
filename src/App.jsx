import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set, push, onValue, get } from 'firebase/database';
import { GraduationCap, Moon, Sun, User, Lock, Key, LayoutGrid, Users } from 'lucide-react';
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
  const [isRegistering, setIsRegistering] = useState(false);
  const getSafeData = () => { try { return JSON.parse(localStorage.getItem('studentData')) || null; } catch (e) { localStorage.removeItem('studentData'); return null; } };
  const [studentData, setStudentData] = useState(getSafeData());

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

  const availableClasses = [...new Set(activeSessions.map(s => s.kelas).filter(Boolean))];

  const handleStudentStart = async (e) => {
    e.preventDefault();
    const name = e.target.studentName.value;
    const sClass = e.target.studentClass.value;
    const sSubKelas = e.target.studentSubClass.value.toUpperCase();
    const tokenInput = e.target.token.value.toUpperCase();
    const validSession = activeSessions.find(s => s.token === tokenInput && s.kelas === sClass);
    if (!validSession) return alert("AKSES DITOLAK: Token atau Kelas salah!");

    try {
      const newRef = push(ref(db, 'live_students'));
      const data = { id: newRef.key, name, class: sClass, subKelas: sSubKelas, token: tokenInput, mapel: validSession.mapel, teacherEmail: validSession.teacherEmail, status: 'Online', progress: 0, warnings: 0, timestamp: Date.now() };
      await set(newRef, data);
      setStudentData(data);
      localStorage.setItem('studentData', JSON.stringify(data));
      setCurrentView('exam');
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } catch (error) { alert("Koneksi bermasalah."); }
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
      <div className="min-h-screen bg-slate-950 transition-colors">
        <button onClick={() => setDarkMode(!darkMode)} className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-white shadow-md"><Moon size={20} /></button>
        {currentView === 'login' && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl">
              <div className="flex flex-col items-center mb-8">
                <div onClick={() => { setLogoClicks(c => c + 1); if (logoClicks + 1 >= 5) { setCurrentView('admin-login'); setLogoClicks(0); } }} className="bg-emerald-500 p-4 rounded-2xl text-white mb-4"><GraduationCap size={40} /></div>
                <h1 className="text-2xl font-black text-slate-800">CBT BRO</h1>
              </div>
              <form onSubmit={handleStudentStart} className="space-y-4">
                <div className="relative"><User className="absolute left-4 top-3.5 text-gray-400" size={20} /><input name="studentName" required placeholder="Nama Lengkap" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-xl" /></div>
                <div className="flex gap-2">
                  <div className="relative flex-1"><LayoutGrid className="absolute left-4 top-3.5 text-gray-400" size={20} /><select name="studentClass" required className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-xl appearance-none"><option value="">Tingkat...</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="relative w-1/3"><Users className="absolute left-3 top-3.5 text-gray-400" size={20} /><input name="studentSubClass" required placeholder="Sub (A)" className="w-full pl-10 pr-3 py-3.5 bg-gray-50 border rounded-xl uppercase font-bold text-center" /></div>
                </div>
                <div className="relative"><Key className="absolute left-4 top-3.5 text-gray-400" size={20} /><input name="token" required placeholder="Token" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-xl font-mono uppercase" /></div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl">MULAI</button>
              </form>
            </div>
          </div>
        )}
        {currentView === 'admin-login' && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl">
              <h1 className="text-2xl font-black mb-6 text-slate-800">Akses Guru</h1>
              {!isRegistering ? (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <input name="email" type="email" placeholder="Email" required className="w-full p-3.5 bg-gray-50 border rounded-xl" />
                  <input name="password" type="password" placeholder="Password" required className="w-full p-3.5 bg-gray-50 border rounded-xl" />
                  <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">LOGIN</button>
                  <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-emerald-600 font-bold text-sm">Daftar Guru Baru</button>
                  <button type="button" onClick={() => setCurrentView('login')} className="w-full text-gray-500 font-medium text-sm">Batal</button>
                </form>
              ) : (
                <form onSubmit={handleAdminRegister} className="space-y-4">
                  <input name="name" type="text" placeholder="Nama & Gelar" required className="w-full p-3.5 bg-gray-50 border rounded-xl" />
                  <input name="email" type="email" placeholder="Email Baru" required className="w-full p-3.5 bg-gray-50 border rounded-xl" />
                  <input name="password" type="password" placeholder="Password" required className="w-full p-3.5 bg-gray-50 border rounded-xl" />
                  <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold">DAFTAR</button>
                  <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-gray-500 font-medium text-sm">Batal</button>
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
