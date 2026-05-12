// src/pages/teacher/ProctorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db, getTenantPath } from '../../config/firebase';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { Monitor, ShieldAlert, MessageSquare, Send, LogOut, Unlock, Users, Filter, CheckCircle, Wifi } from 'lucide-react';

export default function ProctorDashboard({ onLogout }) {
  const { userData, tenantData } = useAuth();
  const schoolId = userData?.schoolId; // Otomatis deteksi sekolah dari akun pengawas/guru yang login
  const schoolName = tenantData?.schoolName || 'CBT Darma Pertiwi';

  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('proctorToken') || '');
  const [sessions, setSessions] = useState([]);
  const [liveStudents, setLiveStudents] = useState([]);
  const [broadcastText, setBroadcastText] = useState('');

  // 1. Tarik Data Terisolasi (Hanya milik sekolah ini)
  useEffect(() => {
    if (!schoolId) return;

    // Ambil Sesi Ujian Sekolah
    const sessionsRef = dbRef(db, getTenantPath(schoolId, 'exam_sessions'));
    const unsubSessions = onValue(sessionsRef, snap => {
      if (snap.exists()) {
        const openSessions = Object.values(snap.val()).filter(s => s.status === 'open');
        setSessions(openSessions);
      } else {
        setSessions([]);
      }
    });

    // Ambil Siswa Online Sekolah
    const liveRef = dbRef(db, getTenantPath(schoolId, 'live_students'));
    const unsubLive = onValue(liveRef, snap => {
      if (snap.exists()) {
        const students = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setLiveStudents(students);
      } else {
        setLiveStudents([]);
      }
    });

    return () => {
      unsubSessions();
      unsubLive();
    };
  }, [schoolId]);

  const handleSetToken = (token) => {
    setActiveMonitorToken(token);
    localStorage.setItem('proctorToken', token);
  };

  const monitoredStudents = liveStudents.filter(s => s.token === activeMonitorToken);

  // 2. Fungsi Eksekusi Pengawas (Scoped to Tenant)
  const sendBroadcast = () => {
    if(!broadcastText) return;
    if(window.confirm(`Kirim pengumuman ke semua siswa di Ruangan (Token: ${activeMonitorToken})?`)) {
      monitoredStudents.forEach(s => {
        update(dbRef(db, getTenantPath(schoolId, `live_students/${s.id}`)), { broadcast: broadcastText });
      });
      setBroadcastText('');
      alert("Pengumuman berhasil disiarkan!");
    }
  };

  const forceSubmitAll = () => {
    if(window.confirm("🚨 PERINGATAN! Tarik paksa semua lembar jawaban di ruangan ini?")) {
      monitoredStudents.forEach(s => { 
        if(s.status !== 'Selesai') {
          update(dbRef(db, getTenantPath(schoolId, `live_students/${s.id}`)), { forceSubmit: true }); 
        }
      });
      alert("Perintah tarik paksa terkirim!");
    }
  };

  const unlockStudent = (studentId) => {
    if(window.confirm("Buka layar siswa yang terkunci ini?")) {
      update(dbRef(db, getTenantPath(schoolId, `live_students/${studentId}`)), { warnings: 0, status: 'Online' });
    }
  };

  const forceSubmitSingle = (studentId) => {
    if(window.confirm("Tarik paksa jawaban siswa ini sekarang?")) {
      update(dbRef(db, getTenantPath(schoolId, `live_students/${studentId}`)), { forceSubmit: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* HEADER PENGAWAS V3 */}
      <header className="bg-slate-900 text-white p-4 md:px-8 md:py-5 flex justify-between items-center shadow-xl border-b-4 border-blue-600">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-600/20"><Monitor size={28}/></div>
          <div>
            <h1 className="font-black tracking-tighter uppercase text-xl leading-none">Proctor Panel</h1>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
               <Wifi size={10} className="animate-pulse" /> {schoolName}
            </p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-red-600/20 uppercase tracking-widest">
          Logout
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        
        {/* SELECTOR RUANGAN */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ruang Monitor</h2>
            <p className="text-sm font-bold text-slate-400">Pilih token ujian yang ingin Anda awasi secara live.</p>
          </div>
          <select 
            value={activeMonitorToken} 
            onChange={(e) => handleSetToken(e.target.value)} 
            className="w-full md:w-80 p-4 border-2 border-slate-100 bg-slate-50 text-blue-800 font-black rounded-2xl outline-none cursor-pointer focus:border-blue-500 focus:bg-white transition-all shadow-inner"
          >
            <option value="">-- Pilih Sesi Aktif --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.token}>{s.token} ({s.mapel})</option>
            ))}
          </select>
        </div>

        {!activeMonitorToken ? (
          <div className="bg-white p-20 rounded-[3rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center justify-center text-slate-300">
            <Filter size={80} className="mb-6 opacity-20"/>
            <h3 className="font-black text-3xl text-slate-400">Siap Mengawas</h3>
            <p className="font-bold mt-2 text-slate-400/60 max-w-sm">Gunakan menu di atas untuk memantau pergerakan siswa di dalam kelas.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* ACTION CENTER */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border-b-4 border-blue-500 shadow-sm">
                <p className="text-slate-400 text-[10px] font-black mb-1 uppercase tracking-widest">Hadir</p>
                <p className="text-4xl font-black text-slate-800">{monitoredStudents.length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border-b-4 border-emerald-500 shadow-sm">
                <p className="text-slate-400 text-[10px] font-black mb-1 uppercase tracking-widest">Selesai</p>
                <p className="text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border-b-4 border-red-500 shadow-sm">
                <p className="text-slate-400 text-[10px] font-black mb-1 uppercase tracking-widest">Curang</p>
                <p className="text-4xl font-black text-red-600">{monitoredStudents.filter(s => (s?.warnings || 0) >= 3).length}</p>
              </div>
              <button onClick={forceSubmitAll} className="bg-slate-900 hover:bg-black text-white rounded-3xl font-black flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-xl p-4">
                 <ShieldAlert size={24} className="text-red-500" />
                 <span className="text-[10px] tracking-widest uppercase">Force Submit All</span>
              </button>
            </div>

            {/* BROADCAST BOX */}
            <div className="bg-blue-600 p-2 rounded-[2.5rem] shadow-xl shadow-blue-600/20">
                <div className="bg-white p-6 rounded-[2.2rem] flex flex-col md:flex-row gap-4 items-center">
                    <div className="shrink-0 w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner"><MessageSquare size={28}/></div>
                    <input 
                        value={broadcastText} 
                        onChange={e => setBroadcastText(e.target.value)} 
                        placeholder="Kirim peringatan ke semua HP siswa..." 
                        className="flex-1 w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-blue-100 font-bold text-slate-700" 
                    />
                    <button onClick={sendBroadcast} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black active:scale-95 transition-all uppercase tracking-widest text-sm">Kirim</button>
                </div>
            </div>

            {/* STUDENT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {monitoredStudents.map(s => {
                const isLocked = (s?.warnings || 0) >= 3;
                const isDone = s.status === 'Selesai';

                return (
                    <div key={s.id} className={`p-6 rounded-[2rem] border-2 transition-all relative overflow-hidden group ${isDone ? 'bg-emerald-50 border-emerald-100' : isLocked ? 'bg-red-50 border-red-200 shadow-lg' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}`}>
                        {isDone && <div className="absolute -right-10 top-2 bg-emerald-500 text-white text-[8px] font-black px-10 py-1 rotate-45">FINISH</div>}
                        
                        <div className="flex justify-between items-start mb-4">
                            <div className="min-w-0">
                                <h4 className="font-black text-slate-800 text-lg leading-tight truncate">{s?.name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Kelas {s?.class}</p>
                            </div>
                            {s.warnings > 0 && (
                                <span className={`shrink-0 px-2 py-1 rounded-lg font-black text-[10px] border ${isLocked ? 'bg-red-600 text-white animate-pulse' : 'bg-orange-100 text-orange-600 border-orange-200'}`}>
                                    {s.warnings}X
                                </span>
                            )}
                        </div>

                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Progress</span>
                                <span className={isDone ? 'text-emerald-600' : 'text-blue-600'}>{s.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${s.progress || 0}%`}}></div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => forceSubmitSingle(s.id)} disabled={isDone} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30">Tarik</button>
                            {isLocked && !isDone && (
                                <button onClick={() => unlockStudent(s.id)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20">Buka</button>
                            )}
                        </div>
                    </div>
                )
              })}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}