import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { Monitor, ShieldAlert, MessageSquare, Send, LogOut, Binds, Unlock, Users, Filter, CheckCircle } from 'lucide-react';

export default function ProctorDashboard({ onLogout }) {
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('proctorToken') || '');
  const [sessions, setSessions] = useState([]);
  const [liveStudents, setLiveStudents] = useState([]);
  const [broadcastText, setBroadcastText] = useState('');

  // 1. Tarik Data Sesi Aktif & Siswa Live
  useEffect(() => {
    const fetchSessions = onValue(dbRef(db, 'exam_sessions'), snap => {
      if (snap.val()) {
        // Hanya ambil sesi yang statusnya 'open'
        const openSessions = Object.values(snap.val()).filter(s => s.status === 'open');
        setSessions(openSessions);
      } else {
        setSessions([]);
      }
    });

    const fetchLive = onValue(dbRef(db, 'live_students'), snap => {
      if (snap.val()) {
        const students = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setLiveStudents(students);
      } else {
        setLiveStudents([]);
      }
    });

    return () => {
      fetchSessions();
      fetchLive();
    };
  }, []);

  const handleSetToken = (token) => {
    setActiveMonitorToken(token);
    localStorage.setItem('proctorToken', token);
  };

  const monitoredStudents = liveStudents.filter(s => s.token === activeMonitorToken);

  // 2. Fungsi Eksekusi Pengawas
  const sendBroadcast = () => {
    if(!broadcastText) return;
    if(window.confirm(`Kirim pengumuman ke semua layar siswa di Ruangan (Token: ${activeMonitorToken})?`)) {
      monitoredStudents.forEach(s => update(dbRef(db, `live_students/${s.id}`), { broadcast: broadcastText }));
      setBroadcastText('');
      alert("Pengumuman berhasil disiarkan!");
    }
  };

  const forceSubmitAll = () => {
    if(window.confirm("🚨 PERINGATAN! Tarik paksa semua lembar jawaban siswa yang sedang ujian di ruangan ini?")) {
      monitoredStudents.forEach(s => { 
        if(s.status !== 'Selesai') update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true }); 
      });
      alert("Perintah tarik paksa terkirim ke semua perangkat siswa!");
    }
  };

  const unlockStudent = (studentId) => {
    if(window.confirm("Buka layar siswa yang terkunci ini?")) {
      update(dbRef(db, `live_students/${studentId}`), { warnings: 0, status: 'Online' });
    }
  };

  const forceSubmitSingle = (studentId) => {
    if(window.confirm("Tarik paksa jawaban siswa ini sekarang?")) {
      update(dbRef(db, `live_students/${studentId}`), { forceSubmit: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* HEADER PENGAWAS */}
      <header className="bg-slate-900 text-white p-4 md:p-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-xl"><Monitor className="text-blue-400" size={24}/></div>
          <div>
            <h1 className="font-black tracking-widest uppercase text-lg leading-tight">Ruang Pengawas Ujian</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CBT Darma Pertiwi</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all border border-red-500/20 active:scale-95">
          <LogOut size={16}/> Keluar
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        
        {/* PILIH RUANGAN/TOKEN */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800">Pilih Ruangan Ujian</h2>
            <p className="text-sm font-bold text-slate-500">Pilih token sesi yang sedang aktif untuk dipantau.</p>
          </div>
          <select 
            value={activeMonitorToken} 
            onChange={(e) => handleSetToken(e.target.value)} 
            className="w-full md:w-auto p-4 border-2 border-blue-200 bg-blue-50 text-blue-800 font-black rounded-2xl outline-none cursor-pointer focus:border-blue-500"
          >
            <option value="">-- Pilih Token Sesi --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.token}>{s.token} (Kelas {s.kelas}-{s.subKelas} | {s.mapel})</option>
            ))}
          </select>
        </div>

        {!activeMonitorToken ? (
          <div className="bg-white p-16 rounded-3xl border-2 border-dashed border-slate-300 text-center flex flex-col items-center justify-center text-slate-400">
            <Filter size={64} className="mb-4 opacity-20"/>
            <h3 className="font-black text-2xl text-slate-500">Standby Mode</h3>
            <p className="font-medium mt-2">Silakan pilih token ruangan di atas untuk mulai mengawasi siswa.</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* STATISTIK PENGAWAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border-l-4 border-l-blue-500 shadow-sm">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Hadir & Ujian</p>
                <p className="text-4xl font-black text-slate-800">{monitoredStudents.length}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border-l-4 border-l-emerald-500 shadow-sm">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Telah Selesai</p>
                <p className="text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border-l-4 border-l-red-500 shadow-sm">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Terkunci/Curang</p>
                <p className="text-4xl font-black text-red-600">{monitoredStudents.filter(s => (s?.warnings || 0) >= 3).length}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-3xl shadow-lg border border-slate-800 flex items-center justify-center">
                 <button onClick={forceSubmitAll} className="w-full h-full bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg shadow-red-600/30">
                    <ShieldAlert size={20} /> Tarik Paksa Ruangan
                 </button>
              </div>
            </div>

            {/* PENGUMUMAN */}
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
              <div className="shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-inner"><MessageSquare size={20}/></div>
              <div className="flex-1 w-full">
                <input 
                  value={broadcastText} 
                  onChange={e => setBroadcastText(e.target.value)} 
                  placeholder="Ketik pesan peringatan atau pengumuman ke seluruh layar siswa di sini..." 
                  className="w-full p-4 border border-blue-200 bg-white rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-700 shadow-inner" 
                />
              </div>
              <button onClick={sendBroadcast} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-600/30 tracking-widest"><Send size={18}/> KIRIM</button>
            </div>

            {/* DAFTAR SISWA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitoredStudents.map(s => (
                <div key={s.id} className={`p-5 rounded-3xl border-2 transition-colors relative overflow-hidden ${s.status === 'Selesai' ? 'bg-emerald-50 border-emerald-200' : (s?.warnings || 0) >= 3 ? 'bg-red-50 border-red-500 shadow-md shadow-red-500/20' : 'bg-white border-slate-200 shadow-sm'}`}>
                  
                  {s.status === 'Selesai' && <div className="absolute -right-6 -top-6 bg-emerald-500 text-white text-[10px] font-black px-8 py-2 transform rotate-45 shadow-sm mt-8">SELESAI</div>}
                  
                  <div className="flex justify-between items-start border-b border-slate-100/80 pb-3 mb-3">
                    <div>
                      <p className="font-black text-slate-800 text-lg leading-tight truncate">{s?.name || 'Anonim'}</p>
                      <span className="inline-block mt-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">Kls {s?.class}-{s?.subKelas}</span>
                    </div>
                    {(s?.warnings || 0) > 0 && <span className={`text-xs font-black px-2 py-1 rounded border whitespace-nowrap ${(s?.warnings || 0) >= 3 ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>⚠️ {s.warnings}x</span>}
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>Progress</span>
                      <span className={s.status === 'Selesai' ? 'text-emerald-600' : 'text-blue-600'}>{s?.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${s.status === 'Selesai' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width:`${s?.progress || 0}%`}}></div></div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                       onClick={() => forceSubmitSingle(s.id)} 
                       disabled={s.status === 'Selesai'} 
                       className="flex-1 text-xs bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 py-3 rounded-xl font-bold disabled:opacity-50 active:scale-95 transition-all"
                    >
                       Tarik Paksa
                    </button>
                    {(s?.warnings || 0) >= 3 && s?.status !== 'Selesai' && (
                      <button 
                         onClick={() => unlockStudent(s.id)} 
                         className="flex-1 text-xs bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-500 py-3 rounded-xl font-black active:scale-95 transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1"
                      >
                         <Unlock size={14}/> Buka Layar
                      </button>
                    )}
                  </div>

                </div>
              ))}
              {monitoredStudents.length === 0 && <div className="col-span-full text-center p-8 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">Belum ada siswa yang masuk ke token ini.</div>}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
