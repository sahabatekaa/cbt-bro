// src/pages/teacher/ProctorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase'; // Sesuaikan dengan path V3
import { ref as dbRef, onValue, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { Monitor, ShieldAlert, MessageSquare, Send, LogOut, Unlock, Users, Filter, CheckCircle, Search, AlertTriangle, Radio, Activity, ChevronRight, Zap } from 'lucide-react';

export default function ProctorDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('proctorToken') || '');
  const [sessions, setSessions] = useState([]);
  const [liveStudents, setLiveStudents] = useState([]);
  const [broadcastText, setBroadcastText] = useState('');
  
  // FITUR BARU: Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, online, selesai, curang

  // 1. Tarik Data Sesi Aktif & Siswa Live (Mode Hybrid Root V2)
  useEffect(() => {
    const fetchSessions = onValue(dbRef(db, 'exam_sessions'), snap => {
      if (snap.val()) {
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
    setSearchTerm('');
    setFilterStatus('all');
  };

  const handleExit = () => {
      if(onLogout) onLogout();
      else navigate('/login');
  };

  // Logika Filter & Search
  const monitoredStudents = liveStudents.filter(s => s.token === activeMonitorToken);
  const filteredStudents = monitoredStudents.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.class.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      
      if (filterStatus === 'selesai') return s.status === 'Selesai';
      if (filterStatus === 'curang') return (s.warnings || 0) >= 3;
      if (filterStatus === 'online') return s.status !== 'Selesai' && (s.warnings || 0) < 3;
      return true; // 'all'
  });

  // 2. Fungsi Eksekusi Pengawas
  const sendBroadcast = () => {
    if(!broadcastText) return;
    if(window.confirm(`Kirim pengumuman darurat ke semua layar siswa di Ruangan (Token: ${activeMonitorToken})?`)) {
      monitoredStudents.forEach(s => update(dbRef(db, `live_students/${s.id}`), { broadcast: broadcastText }));
      setBroadcastText('');
      alert("Pengumuman berhasil disiarkan ke seluruh perangkat siswa!");
    }
  };

  const forceSubmitAll = () => {
    if(window.confirm("🚨 PERINGATAN MASTER!\nAnda yakin ingin MENGAKHIRI UJIAN dan MENARIK PAKSA lembar jawaban semua siswa yang sedang ujian di ruangan ini?")) {
      monitoredStudents.forEach(s => { 
        if(s.status !== 'Selesai') update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true }); 
      });
      alert("Sinyal tarik paksa berhasil dikirimkan!");
    }
  };

  const unlockStudent = (studentId) => {
    if(window.confirm("Buka layar siswa yang terkunci ini agar bisa melanjutkan ujian?")) {
      update(dbRef(db, `live_students/${studentId}`), { warnings: 0, status: 'Online' });
    }
  };

  const forceSubmitSingle = (studentId) => {
    if(window.confirm("Tarik paksa lembar jawaban siswa ini sekarang?")) {
      update(dbRef(db, `live_students/${studentId}`), { forceSubmit: true });
    }
  };

  // Statistik Real-time
  const stats = {
      total: monitoredStudents.length,
      selesai: monitoredStudents.filter(s => s.status === 'Selesai').length,
      curang: monitoredStudents.filter(s => (s.warnings || 0) >= 3).length,
      online: monitoredStudents.filter(s => s.status !== 'Selesai' && (s.warnings || 0) < 3).length
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200 selection:bg-blue-500/30">
      
      {/* HEADER PENGAWAS (COMMAND CENTER STYLE) */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 md:p-5 flex justify-between items-center shadow-2xl relative overflow-hidden z-20">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600"></div>
        <div className="flex items-center gap-4">
          <div className="bg-blue-950/50 p-2.5 rounded-xl border border-blue-900/50 relative">
             <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
             <Radio className="text-blue-400" size={24}/>
          </div>
          <div>
            <h1 className="font-black tracking-widest uppercase text-lg text-white flex items-center gap-2">
                Proctoring Center <span className="bg-red-500/20 text-red-500 text-[9px] px-2 py-0.5 rounded border border-red-500/30 animate-pulse hidden sm:inline-block">LIVE</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Yaspendik PTPN IV - Darma Pertiwi</p>
          </div>
        </div>
        <button onClick={handleExit} className="flex items-center gap-2 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-500 px-4 py-2.5 rounded-xl text-xs font-black transition-all border border-slate-700 hover:border-red-900/50 active:scale-95 shadow-sm">
          <LogOut size={16}/> <span className="hidden sm:inline">Keluar Ruang</span>
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* PANEL KENDALI ATAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* KOTAK PILIH RUANGAN */}
            <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-slate-800 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-4">
                   <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500"><Monitor size={20}/></div>
                   <div>
                       <h2 className="text-lg font-black text-white leading-tight">Akses Ruangan</h2>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Sinkronisasi Database Pusat</p>
                   </div>
                </div>
                <select 
                  value={activeMonitorToken} 
                  onChange={(e) => handleSetToken(e.target.value)} 
                  className="w-full p-4 border border-blue-900/50 bg-blue-950/30 text-blue-400 text-sm font-black rounded-2xl outline-none cursor-pointer focus:border-blue-500 focus:bg-blue-950/50 transition-all appearance-none tracking-widest text-center"
                >
                  <option value="">[ PILIH TOKEN SESI UJIAN ]</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.token}>{s.token} (Kelas {s.kelas}-{s.subKelas} • {s.mapel})</option>
                  ))}
                </select>
            </div>

            {/* KOTAK STATISTIK JIKA TOKEN AKTIF */}
            {activeMonitorToken ? (
               <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                 <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Users size={80}/></div>
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Peserta Hadir</p>
                   <p className="text-3xl sm:text-4xl font-black text-white">{stats.total}</p>
                 </div>
                 <div className="bg-emerald-950/30 p-5 rounded-[2rem] border border-emerald-900/50 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute -right-4 -bottom-4 text-emerald-500 opacity-5 group-hover:scale-110 transition-transform"><CheckCircle size={80}/></div>
                   <p className="text-emerald-500/80 text-[10px] font-black uppercase tracking-widest mb-1">Telah Selesai</p>
                   <p className="text-3xl sm:text-4xl font-black text-emerald-400">{stats.selesai}</p>
                 </div>
                 <div className="bg-red-950/30 p-5 rounded-[2rem] border border-red-900/50 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute -right-4 -bottom-4 text-red-500 opacity-5 group-hover:scale-110 transition-transform"><ShieldAlert size={80}/></div>
                   <p className="text-red-500/80 text-[10px] font-black uppercase tracking-widest mb-1">Terkunci/Curang</p>
                   <p className="text-3xl sm:text-4xl font-black text-red-500 animate-pulse">{stats.curang}</p>
                 </div>
                 <div className="bg-slate-900 p-2 rounded-[2rem] shadow-xl border border-slate-800 flex items-center justify-center">
                    <button onClick={forceSubmitAll} className="w-full h-full bg-red-600/10 hover:bg-red-600 border border-red-600/20 text-red-500 hover:text-white rounded-[1.5rem] font-black flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all group">
                       <Zap size={24} className="group-hover:animate-bounce" /> 
                       <span className="text-[10px] uppercase tracking-widest">Tarik Paksa Massal</span>
                    </button>
                 </div>
               </div>
            ) : (
               <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-slate-600 p-6">
                  <Activity size={32} className="mb-2 opacity-50"/>
                  <p className="text-xs font-bold tracking-widest uppercase">Pilih Ruangan untuk melihat radar aktivitas</p>
               </div>
            )}
        </div>

        {activeMonitorToken && (
          <>
            {/* PANEL TOOLS: FILTER, SEARCH & BROADCAST */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               
               {/* Search & Filter */}
               <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                  <div className="relative">
                     <Search className="absolute left-4 top-3.5 text-slate-500" size={18}/>
                     <input 
                        type="text" 
                        placeholder="Cari nama atau kelas siswa..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors shadow-inner"
                     />
                  </div>
                  <div className="flex flex-wrap gap-2">
                     <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${filterStatus === 'all' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Semua ({stats.total})</button>
                     <button onClick={() => setFilterStatus('online')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${filterStatus === 'online' ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Online ({stats.online})</button>
                     <button onClick={() => setFilterStatus('selesai')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${filterStatus === 'selesai' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Selesai ({stats.selesai})</button>
                     <button onClick={() => setFilterStatus('curang')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${filterStatus === 'curang' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Curang ({stats.curang})</button>
                  </div>
               </div>

               {/* Broadcast Box */}
               <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={14}/> Pesan Peringatan Massal</label>
                  </div>
                  <div className="flex gap-2 h-full">
                     <textarea 
                        value={broadcastText} 
                        onChange={e => setBroadcastText(e.target.value)} 
                        placeholder="Ketik pengumuman layar penuh di sini..." 
                        className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-blue-500 font-medium text-sm text-white shadow-inner resize-none" 
                     />
                     <button onClick={sendBroadcast} className="w-16 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex flex-col items-center justify-center gap-1 font-black active:scale-95 transition-all shadow-lg shadow-blue-600/30">
                        <Send size={18}/>
                     </button>
                  </div>
               </div>
            </div>

            {/* DAFTAR SISWA (LIVE RADAR) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map(s => {
                  const isSelesai = s.status === 'Selesai';
                  const isCurang = (s.warnings || 0) >= 3;
                  const isOnline = !isSelesai && !isCurang;
                  
                  // Styling Berdasarkan Status
                  let cardClass = 'bg-slate-900 border-slate-800 hover:border-blue-500/50';
                  let progressColor = 'bg-blue-500';
                  
                  if (isSelesai) {
                      cardClass = 'bg-emerald-950/20 border-emerald-900/50';
                      progressColor = 'bg-emerald-500';
                  } else if (isCurang) {
                      cardClass = 'bg-red-950/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
                      progressColor = 'bg-red-500';
                  }

                  return (
                    <div key={s.id} className={`p-5 rounded-[2rem] border-2 transition-all relative overflow-hidden flex flex-col justify-between h-full ${cardClass}`}>
                      
                      {/* WATERMARK STATUS */}
                      {isSelesai && <div className="absolute -right-8 top-4 bg-emerald-500 text-white text-[9px] font-black px-10 py-1 transform rotate-45 shadow-sm">SELESAI</div>}
                      {isCurang && <div className="absolute inset-0 bg-red-500/5 pointer-events-none animate-pulse"></div>}
                      
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-3 items-center">
                               <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0 relative">
                                  {isOnline && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>}
                                  {isOnline && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border border-slate-900"></div>}
                                  {isSelesai && <CheckCircle size={18} className="text-emerald-500"/>}
                                  {isCurang && <ShieldAlert size={18} className="text-red-500"/>}
                                  {isOnline && <Activity size={18} className="text-blue-500"/>}
                               </div>
                               <div className="min-w-0 pr-2">
                                 <p className="font-black text-white text-base leading-tight truncate">{s?.name || 'Anonim'}</p>
                                 <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 uppercase">Kls {s?.class}-{s?.subKelas}</span>
                                 </div>
                               </div>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                              <span>Penyelesaian</span>
                              <span className={isSelesai ? 'text-emerald-400' : isCurang ? 'text-red-400' : 'text-blue-400'}>{s?.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                                <div className={`h-full transition-all duration-700 ease-out ${progressColor}`} style={{width:`${s?.progress || 0}%`}}></div>
                            </div>
                          </div>

                          {(s?.warnings || 0) > 0 && (
                              <div className="mb-4 bg-slate-950 border border-slate-800 p-2 rounded-xl flex justify-between items-center">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Pelanggaran</span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${isCurang ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>⚠️ {s.warnings}/3 x</span>
                              </div>
                          )}
                      </div>

                      <div className="flex gap-2 mt-2 relative z-10">
                        <button 
                           onClick={() => forceSubmitSingle(s.id)} 
                           disabled={isSelesai} 
                           className="flex-1 text-[10px] uppercase tracking-widest bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 py-3 rounded-xl font-bold disabled:opacity-30 active:scale-95 transition-all"
                        >
                           Tarik Data
                        </button>
                        {isCurang && !isSelesai && (
                          <button 
                             onClick={() => unlockStudent(s.id)} 
                             className="flex-1 text-[10px] uppercase tracking-widest bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 py-3 rounded-xl font-black active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5"
                          >
                             <Unlock size={12}/> Pulihkan
                          </button>
                        )}
                      </div>

                    </div>
                  );
              })}
              
              {filteredStudents.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-slate-900/50 rounded-[2rem] border border-slate-800 border-dashed">
                      <Search size={40} className="mx-auto text-slate-700 mb-3"/>
                      <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">Radar Kosong. Tidak ada data yang sesuai filter.</p>
                  </div>
              )}
            </div>

          </>
        )}
      </main>
    </div>
  );
}