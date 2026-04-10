import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { 
  Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, 
  Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, ChevronDown, GraduationCap
} from 'lucide-react';

const TeacherDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('settings');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [liveStudents, setLiveStudents] = useState([]);
  const [bankSoal, setBankSoal] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';

  const [formData, setFormData] = useState({ 
    mapel: '', kelas: '', pertanyaan: '', 
    opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' 
  });

  useEffect(() => {
    onValue(ref(db, 'live_students'), (snap) => {
      const data = snap.val();
      setLiveStudents(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
    });
    
    onValue(ref(db, 'bank_soal'), (snap) => {
      const data = snap.val();
      setBankSoal(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
    });

    onValue(ref(db, 'leaderboard'), (snap) => {
      const data = snap.val();
      const sorted = data ? Object.values(data).sort((a, b) => b.score - a.score) : [];
      setLeaderboard(sorted);
    });

    onValue(ref(db, 'exam_sessions'), (snap) => {
      const data = snap.val();
      setSessions(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
    });
  }, []);

  const myQuestions = bankSoal.filter(q => q.teacherEmail === currentUserEmail);
  const mySessions = sessions.filter(s => s.teacherEmail === currentUserEmail);
  const monitoredStudents = liveStudents.filter(s => s.token === activeMonitorToken);

  const availableMapel = [...new Set(myQuestions.map(q => q.mapel).filter(Boolean))];
  const availableKelas = [...new Set(myQuestions.map(q => q.kelas).filter(Boolean))];

  const handleAddSoal = (e) => {
    e.preventDefault();
    push(ref(db, 'bank_soal'), { ...formData, teacherEmail: currentUserEmail });
    setShowModal(false);
    setFormData({ ...formData, pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });
  };

  const handleCreateSession = (e) => {
    e.preventDefault();
    const token = document.getElementById('token_input').value;
    const mapel = document.getElementById('mapel_session').value;
    const kelas = document.getElementById('kelas_session').value;

    if (!token || !mapel || !kelas) return alert("Lengkapi semua form sesi!");
    if (sessions.find(s => s.token === token)) return alert("Token sudah digunakan!");

    push(ref(db, 'exam_sessions'), {
      token, mapel, kelas, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now()
    });
    document.getElementById('token_input').value = '';
    alert("Sesi Ujian Dirilis!");
  };

  const toggleSessionStatus = (id, currentStatus) => {
    update(ref(db, `exam_sessions/${id}`), { status: currentStatus === 'open' ? 'closed' : 'open' });
  };

  const deleteSession = (id, token) => {
    if(window.confirm(`Hapus sesi ${token}?`)) {
      remove(ref(db, `exam_sessions/${id}`));
      if(activeMonitorToken === token) {
        setActiveMonitorToken('');
        localStorage.removeItem('activeMonitorToken');
      }
    }
  };

  const setMonitor = (token) => {
    setActiveMonitorToken(token);
    localStorage.setItem('activeMonitorToken', token);
    setActiveTab('proctor');
  };

  // Komponen Navigasi - Warna diganti Emerald (Hijau)
  const NavItem = ({ tab, icon: Icon, label }) => (
    <button 
      onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} 
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
        activeTab === tab ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-600 hover:bg-emerald-50 dark:text-gray-400 dark:hover:bg-slate-800'
      }`}
    >
      <Icon size={20}/> <span className="font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar - Text & Warna diupdate */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 flex flex-col transition-transform duration-300 transform ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } md:relative md:translate-x-0`}>
        <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-slate-800">
          <h1 className="text-xl font-black text-emerald-600 flex items-center gap-2 tracking-tight">
            <GraduationCap size={26} className="text-emerald-500"/> CBT BRO
          </h1>
          <button className="md:hidden text-gray-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button>
        </div>
        
        <div className="p-4 border-b border-gray-100 dark:border-slate-800">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Guru</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{currentUserEmail}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Users} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Soal Milikku" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai" />
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold">
            <LogOut size={20}/> Logout System
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white capitalize">Dasbor Guru</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black">G</div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-slate-950">
          
          {/* ===================== TAB PROCTORING (Disesuaikan Gambar) ===================== */}
          {activeTab === 'proctor' && (
            <div className="space-y-6">
              {/* Green Session Selector Style */}
              <div className="bg-emerald-100 text-emerald-800 p-4 rounded-xl flex items-center justify-between gap-2 border border-emerald-200">
                <div className="flex items-center gap-3 font-bold">
                  <Eye size={22} className="text-emerald-600" /> 
                  <span>{activeMonitorToken ? `Memantau Sesi: ${activeMonitorToken}` : 'Pilih Sesi untuk Memantau'}</span>
                </div>
                {mySessions.length > 0 && (
                  <select 
                    value={activeMonitorToken} 
                    onChange={(e) => setMonitor(e.target.value)} 
                    className="bg-white/70 border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-900 outline-none"
                  >
                    <option value="">-- Semua Sesi --</option>
                    {mySessions.map(s => <option key={s.token} value={s.token}>{s.token} ({s.mapel})</option>)}
                  </select>
                )}
              </div>

              {!activeMonitorToken ? (
                <div className="bg-white p-10 rounded-2xl border border-dashed text-center flex flex-col items-center text-gray-500 shadow-sm">
                  <Filter size={48} className="mb-4 text-gray-300" />
                  <h3 className="font-bold text-gray-700 text-lg">Pilih Token Sesi</h3>
                  <p className="mt-1 text-sm">Gunakan dropdown hijau di atas atau tombol 'Pantau' di menu Sesi Ujian.</p>
                </div>
              ) : (
                <>
                  {/* Stats Cards - Border Left Style (Sesuai Gambar) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-400 border border-gray-100 flex flex-col justify-center shadow-sm">
                      <p className="text-gray-500 text-sm font-semibold mb-1">Terhubung</p>
                      <p className="text-4xl font-black text-slate-800">{monitoredStudents.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-400 border border-gray-100 flex flex-col justify-center shadow-sm">
                      <p className="text-gray-500 text-sm font-semibold mb-1">Selesai</p>
                      <p className="text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-red-400 border border-gray-100 flex flex-col justify-center shadow-sm">
                      <p className="text-gray-500 text-sm font-semibold mb-1">Indikasi Curang</p>
                      <p className="text-4xl font-black text-red-600">{monitoredStudents.filter(s => s.warnings > 0).length}</p>
                    </div>
                  </div>

                  {/* Table - Sesuai Gambar */}
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-gray-100">
                          <tr>
                            <th className="p-4 font-bold text-gray-800">Nama Siswa</th>
                            <th className="p-4 font-bold text-gray-800">Mapel / Kls</th>
                            <th className="p-4 font-bold text-gray-800 w-1/4">Progress</th>
                            <th className="p-4 font-bold text-gray-800 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {monitoredStudents.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-slate-800">{s.name}</p>
                                {s.status === 'Pindah Tab' && <span className="text-xs text-red-600 font-bold animate-pulse">!! Pindah Tab ({s.warnings})</span>}
                              </td>
                              <td className="p-4">
                                <p className="font-bold text-slate-800 mb-1">{s.mapel || '---'}</p>
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                  {s.class}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${s.progress}%` }}></div>
                                  </div>
                                  <span className="text-sm font-bold text-gray-600 w-10 text-right">{s.progress}%</span>
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <button onClick={() => update(ref(db, `live_students/${s.id}`), { status: 'Selesai' })} disabled={s.status === 'Selesai'} className="text-xs bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-700 px-3 py-2 rounded-lg disabled:opacity-30 transition-colors font-semibold">
                                  Paksa Selesai
                                </button>
                              </td>
                            </tr>
                          ))}
                          {monitoredStudents.length === 0 && (
                            <tr><td colSpan="4" className="p-10 text-center text-gray-500">Tidak ada siswa terhubung ke token ini.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================== TAB SESI UJIAN (Emerald Tema) ===================== */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Buat Sesi */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 h-fit">
                <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center gap-2">
                  <Plus className="text-emerald-500" /> Buat Sesi Baru
                </h3>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-400">Pilih Mapel (Bank Soal)</label>
                    <select id="mapel_session" required className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 ring-emerald-300 outline-none">
                      <option value="">Pilih...</option>
                      {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-400">Kelas</label>
                    <select id="kelas_session" required className="w-full p-3 rounded-xl border border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 ring-emerald-300 outline-none">
                      <option value="">Pilih...</option>
                      {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-400">Token Akses Ujian</label>
                    <div className="flex gap-2">
                      <input id="token_input" type="text" required placeholder="Generate..." className="flex-1 p-3 rounded-xl border border-gray-200 font-mono font-bold uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                      <button type="button" onClick={() => { document.getElementById('token_input').value = Math.random().toString(36).substring(2, 7).toUpperCase(); }} className="bg-emerald-100 text-emerald-700 p-3 rounded-xl hover:bg-emerald-200">
                        <Dices size={24} />
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Rilis Sesi Ujian</button>
                </form>
              </div>

              {/* Daftar Sesi */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold dark:text-white mb-4">Daftar Sesi Anda</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySessions.map((s) => (
                    <div key={s.id} className={`p-5 rounded-2xl border transition-colors ${s.status === 'open' ? 'bg-white dark:bg-slate-900 border-emerald-100 shadow-sm' : 'bg-gray-100 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-mono text-3xl font-black mt-2 text-slate-900 dark:text-white tracking-widest">{s.token}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-bold mr-1">{s.mapel}</span>
                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-bold">{s.kelas}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${s.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {s.status === 'open' ? <Unlock size={14}/> : <Lock size={14}/>} {s.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-slate-700">
                        <button onClick={() => setMonitor(s.token)} className="flex-1 bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                          <Eye size={18}/> Pantau Live
                        </button>
                        <button onClick={() => toggleSessionStatus(s.id, s.status)} className="p-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-white rounded-xl" title="Kunci/Buka Sesi">
                          {s.status === 'open' ? <Lock size={18}/> : <Unlock size={18}/>}
                        </button>
                        <button onClick={() => deleteSession(s.id, s.token)} className="p-3 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl" title="Hapus Sesi">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                  ))}
                  {mySessions.length === 0 && (
                    <div className="col-span-full text-center p-12 bg-white rounded-2xl border border-dashed text-gray-500">
                      Sesi kosong. Buat sesi baru di form kiri.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB BANK SOAL (Emerald Tema) ===================== */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowModal(true)} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium shadow active:scale-95 transition-all"><Plus size={18}/> Tambah Manual</button>
                <button onClick={() => alert("Fitur Template Ready")} className="flex-1 sm:flex-none bg-white border dark:bg-slate-900 dark:border-slate-800 dark:text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"><Download size={18}/> Template</button>
                <button onClick={() => alert("Upload Excel")} className="flex-1 sm:flex-none bg-white border dark:bg-slate-900 dark:border-slate-800 dark:text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"><Upload size={18}/> Import</button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {myQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col md:flex-row gap-6 shadow-sm">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-3">
                        <span className="bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 rounded font-bold">{q.mapel}</span>
                        <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded font-bold">{q.kelas}</span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white text-base md:text-lg mb-4 leading-relaxed"><span className="text-gray-400 mr-2">{idx + 1}.</span>{q.pertanyaan}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-gray-400">
                        <div className={`p-2 rounded-lg ${q.kunci==='A'?'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-100':''}`}>A. {q.opsiA}</div>
                        <div className={`p-2 rounded-lg ${q.kunci==='B'?'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-100':''}`}>B. {q.opsiB}</div>
                        <div className={`p-2 rounded-lg ${q.kunci==='C'?'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-100':''}`}>C. {q.opsiC}</div>
                        <div className={`p-2 rounded-lg ${q.kunci==='D'?'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-100':''}`}>D. {q.opsiD}</div>
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2 border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 items-center justify-center">
                      <button onClick={() => remove(ref(db, `bank_soal/${q.id}`))} className="text-red-500 hover:bg-red-50 p-3 rounded-xl transition-colors" title="Hapus Soal"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
                {myQuestions.length === 0 && (
                  <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-500">Bank Soal Milik Anda Kosong.</div>
                )}
              </div>
            </div>
          )}

          {/* ===================== TAB REKAP NILAI (Emerald Tema) ===================== */}
          {activeTab === 'recap' && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden max-w-5xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 print:hidden">
                <h3 className="text-xl font-bold dark:text-white">Rekapitulasi Global</h3>
                <button onClick={() => window.print()} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium active:scale-95 transition-all"><Download size={18}/> Cetak PDF / Laporan</button>
              </div>
              
              <div className="hidden print:block mb-10 border-b-4 border-black pb-6 text-center cop-cetak">
                <h1 className="text-3xl font-black uppercase mb-2">Laporan Hasil Ujian</h1>
                <p className="text-lg">Tahun Ajaran 2025/2026</p>
                <p className="text-sm text-gray-600 mt-3">Dicetak: {new Date().toLocaleDateString('id-ID')}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="border-b-2 border-gray-100 dark:border-slate-800">
                      <th className="p-4 font-bold text-gray-400 w-16">#</th>
                      <th className="p-4 font-bold text-gray-800 dark:text-gray-300">Nama Lengkap</th>
                      <th className="p-4 font-bold text-gray-800 dark:text-gray-300">Kelas</th>
                      <th className="p-4 font-bold text-gray-800 dark:text-gray-300 text-right">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                    {leaderboard.map((s, idx) => (
                      <tr key={idx} className="dark:text-white print:text-black">
                        <td className="p-4 font-bold text-gray-300">{idx + 1}</td>
                        <td className="p-4 font-semibold text-slate-800">{s.name}</td>
                        <td className="p-4"><span className="bg-gray-100 dark:bg-slate-800 print:bg-transparent px-2 py-1 rounded text-sm">{s.class}</span></td>
                        <td className="p-4 text-right"><span className="text-2xl font-black text-emerald-600 print:text-black">{s.score}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Modal Tambah Soal (Tema Hijau) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">Tambah Soal Baru</h2>
            <form onSubmit={handleAddSoal} className="space-y-5">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-bold mb-1.5 text-slate-700">Mata Pelajaran</label>
                  <input required value={formData.mapel} placeholder="Matematika..." className="w-full p-3 border border-gray-200 bg-white rounded-lg focus:ring-2 ring-emerald-300 outline-none" onChange={e => setFormData({...formData, mapel: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5 text-slate-700">Kelas</label>
                  <input required value={formData.kelas} placeholder="X-A..." className="w-full p-3 border border-gray-200 bg-white rounded-lg focus:ring-2 ring-emerald-300 outline-none" onChange={e => setFormData({...formData, kelas: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5 text-slate-700">Pertanyaan</label>
                <textarea required value={formData.pertanyaan} className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:ring-2 ring-emerald-300 outline-none resize-none" rows="3" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['A','B','C','D'].map(opt => (
                  <div key={opt}>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Opsi {opt}</label>
                    <input required value={formData[`opsi${opt}`]} className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 ring-emerald-300 outline-none" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} />
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <label className="block text-sm font-bold mb-2 text-emerald-900">Kunci Jawaban</label>
                <select className="w-full p-3 border border-emerald-200 rounded-lg bg-white font-bold text-emerald-900outline-none" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}>
                  <option value="A">A</option> <option value="B">B</option> <option value="C">C</option> <option value="D">D</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-3.5 rounded-xl font-bold">Batal</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold active:scale-95 transition-all shadow-md shadow-emerald-500/20">Simpan Soal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
