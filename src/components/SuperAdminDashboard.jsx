import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { sendPasswordResetEmail } from 'firebase/auth';
import * as XLSX from 'xlsx'; 
import { Activity, BookOpen, Users, LogOut, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, AlertTriangle, Menu, X, ShieldCheck, Lock, UserCog, Plus, Crown, Download, Settings, KeyRound, Landmark, Zap, ImageIcon, Eye } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function SuperAdminDashboard({ onLogout }) {
  // === KONFIGURASI V2 ===
  const APP_VERSION = "2.0.0";
  const currentUserEmail = auth.currentUser?.email || 'admin@sekolah.com';

  const [activeTab, setActiveTab] = useState(localStorage.getItem('superAdminTab') || 'radar');
  useEffect(() => { localStorage.setItem('superAdminTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ users: [], live: [], bank: [], sessions: [], lead: [] });
  
  const [filterGuru, setFilterGuru] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  
  // === FORM SOAL V2 DENGAN GAMBAR & PREVIEW ===
  const defaultSoalForm = { mapel: '', kelas: '', pertanyaan: ' ', gambar: '', opsiA: ' ', opsiB: ' ', opsiC: ' ', opsiD: ' ', kunci: 'A' };
  const [showEditSoalModal, setShowSoalModal] = useState(false);
  const [editSoalId, setEditSoalId] = useState(null);
  const [soalFormData, setSoalFormData] = useState(defaultSoalForm);
  const [previewMode, setPreviewMode] = useState(false);

  const [showEditGuruModal, setShowGuruModal] = useState(false);
  const [showAddGuruModal, setShowAddGuruModal] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  const [guruFormData, setGuruFormData] = useState({ name: '', email: '' });

  useEffect(() => {
    const fetchData = (path, key) => onValue(ref(db, path), snap => {
      const val = snap.val();
      if (val && typeof val === 'object') setData(prev => ({ ...prev, [key]: Object.keys(val).map(k => ({ id: k, ...val[k] })) }));
      else setData(prev => ({ ...prev, [key]: [] }));
    });
    fetchData('users', 'users');
    fetchData('live_students', 'live');
    fetchData('bank_soal', 'bank');
    fetchData('exam_sessions', 'sessions');
    fetchData('leaderboard', 'lead'); 
  }, []);

  const pendingTeachers = data.users.filter(u => u?.status === 'pending' && u?.email !== 'admin@sekolah.com');
  const activeTeachers = data.users.filter(u => u?.status !== 'pending' && u?.email !== 'admin@sekolah.com');
  
  const activeSessions = data.sessions.filter(s => s?.status === 'open');
  const stats = {
    online: data.live.filter(s => s?.status !== 'Selesai').length,
    selesai: data.live.filter(s => s?.status === 'Selesai').length,
    curang: data.live.filter(s => (s?.warnings || 0) >= 3).length
  };

  const availableGuruSoal = [...new Set(data.bank.map(q => q?.teacherEmail).filter(Boolean))];
  const availableMapelSoal = [...new Set(data.bank.map(q => q?.mapel).filter(Boolean))];
  const filteredSoal = data.bank.filter(q => (filterGuru === '' || q?.teacherEmail === filterGuru) && (filterMapel === '' || q?.mapel === filterMapel));

  // === FITUR MASTER KENDALI GLOBAL V2 ===
  const triggerGlobalUpdate = () => {
    if(window.confirm(`🚀 OTORITAS TERTINGGI: RILIS UPDATE V2\n\nApakah Anda yakin ingin menyalakan saklar Global Sync?\nIni akan memaksa SELURUH HP Siswa dan Guru yang sedang online untuk memuat ulang sistem ke Versi ${APP_VERSION} secara serentak.`)) {
      set(ref(db, 'settings/activeVersion'), APP_VERSION)
        .then(() => alert("⚡ BUM! Sinyal Update Global Terkirim!\nSemua perangkat di jaringan sedang melakukan sinkronisasi ulang."))
        .catch(err => alert("Gagal mengirim sinyal: " + err.message));
    }
  };

  const approveTeacher = (id) => update(ref(db, `users/${id}`), { status: 'active' });
  const rejectTeacher = (id) => { if(window.confirm("Tolak & Hapus pendaftar ini?")) remove(ref(db, `users/${id}`)); };
  const deleteTeacher = (id) => { if(window.confirm("PERINGATAN OTORITAS!\nHapus akun guru ini secara permanen dari server pusat?")) remove(ref(db, `users/${id}`)); };

  const openEditGuruModal = (teacher) => { 
    setEditGuruId(teacher.id); 
    setGuruFormData({ name: teacher?.name || '', email: teacher?.email || '' }); 
    setShowGuruModal(true); 
  };
  const handleUpdateGuru = (e) => { e.preventDefault(); update(ref(db, `users/${editGuruId}`), { name: guruFormData.name, email: guruFormData.email }); alert("Data Guru Diperbarui!"); setShowGuruModal(false); };

  const handleResetPassword = (email) => {
    if (window.confirm(`Kirim instruksi reset kata sandi ke email: ${email}?\n\nGuru tersebut akan menerima link resmi dari sistem untuk membuat sandi baru.`)) {
      sendPasswordResetEmail(auth, email)
        .then(() => alert("✅ Link Reset Sandi Berhasil Dikirim!\nSilakan minta Guru tersebut mengecek kotak masuk (atau folder spam) di email mereka."))
        .catch((error) => alert("❌ Gagal Mengirim: " + error.message));
    }
  };

  const handleManualAddGuru = (e) => {
    e.preventDefault();
    const cleanId = guruFormData.email.replace(/[^a-zA-Z0-9]/g, '');
    set(ref(db, `users/${cleanId}`), { name: guruFormData.name, email: guruFormData.email, role: 'teacher', status: 'active', createdAt: Date.now() });
    alert("Guru berhasil disuntikkan ke Database Pusat!"); setShowAddGuruModal(false); setGuruFormData({ name: '', email: '' });
  };

  const forceCloseSession = (id) => { if(window.confirm("KUNCI PAKSA sesi ini?")) update(ref(db, `exam_sessions/${id}`), { status: 'closed' }); };
  const deleteSoalGlobal = (id) => { if(window.confirm("Hapus soal ini dari PUSAT?")) remove(ref(db, `bank_soal/${id}`)); };

  // V2: Buka Edit Soal dengan data gambar
  const openEditSoalModal = (q) => { 
    setSoalFormData({ 
      mapel: q?.mapel||'', kelas: q?.kelas||'', pertanyaan: q?.pertanyaan||' ', 
      gambar: q?.gambar||'', 
      opsiA: q?.opsiA||' ', opsiB: q?.opsiB||' ', opsiC: q?.opsiC||' ', opsiD: q?.opsiD||' ', kunci: q?.kunci||'A' 
    }); 
    setEditSoalId(q.id); 
    setShowSoalModal(true); 
    setPreviewMode(false);
  };
  const handleUpdateSoal = (e) => { e.preventDefault(); update(ref(db, `bank_soal/${editSoalId}`), { ...soalFormData }); alert("Soal berhasil dimodifikasi oleh Admin!"); setShowSoalModal(false); setPreviewMode(false); };

  const resetLiveStudents = () => {
    if(window.confirm("🚨 PERINGATAN BAHAYA!\nSemua data siswa yang sedang Ujian/Live akan disapu bersih dari server. Pastikan tidak ada yang sedang ujian.\n\nLanjutkan?")) {
      remove(ref(db, 'live_students'));
      alert("Database Live Siswa berhasil dibersihkan.");
    }
  };

  const resetAllSessions = () => {
    if(window.confirm("🚨 PERINGATAN BAHAYA!\nSemua token sesi ujian (termasuk yang dibuat guru) akan dihapus permanen.\n\nLanjutkan?")) {
      remove(ref(db, 'exam_sessions'));
      alert("Database Sesi Ujian berhasil direset.");
    }
  };
  
  const resetRekapNilai = () => {
    if(window.confirm("🚨 KONFIRMASI PENGHAPUSAN!\nPastikan Anda sudah men-download Rekap Master (Excel) sebelum melakukan ini.\n\nSemua data nilai saat ini akan dihapus permanen untuk mempersiapkan database bagi jadwal ujian selanjutnya.\n\nLanjutkan bersihkan rekap nilai?")) {
      remove(ref(db, 'leaderboard'));
      alert("Database Rekap Nilai berhasil dikosongkan. Sistem siap untuk ujian berikutnya!");
    }
  };

  const downloadMasterRecap = () => {
    if (!data.lead || data.lead.length === 0) {
      return alert("Belum ada data nilai yang masuk ke pusat.");
    }
    try {
      const ws = XLSX.utils.json_to_sheet(data.lead);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Master");
      XLSX.writeFile(wb, `MASTER_REKAP_CBT_DARMAPERTIWI_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch(err) {
      alert("Gagal mengunduh rekap master: " + err.message);
    }
  };

  const NavItem = ({ tab, icon: Icon, label, badge }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex justify-between items-center p-4 rounded-xl transition-all ${activeTab === tab ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white font-bold'}`}>
      <div className="flex items-center gap-3"><Icon size={20}/> <span>{label}</span></div>
      {badge > 0 && <span className="bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-md">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-200">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-black border-r border-slate-800 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center"><h1 className="text-2xl font-black text-white flex gap-2 items-center tracking-widest"><Crown className="text-amber-500" size={28}/> PUSAT</h1><button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button></div>
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-black">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">VERSI SERVER {APP_VERSION}</p>
          <p className="text-sm font-bold truncate text-white uppercase">Administrator Utama</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="radar" icon={Activity} label="Radar Aktivitas" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal Global" />
          <NavItem tab="guru" icon={Users} label="Manajemen Personalia" badge={pendingTeachers.length} />
        </nav>
        
        {/* TOMBOL ZAP GLOBAL SYNC V2 */}
        <div className="p-4 border-t border-slate-800">
           <button onClick={triggerGlobalUpdate} className="w-full flex items-center justify-center gap-2 p-4 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-sm shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95 uppercase tracking-tighter">
              <Zap size={20}/> RILIS UPDATE GLOBAL
           </button>
        </div>

        <div className="p-4"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-950/50 hover:bg-red-900 border border-red-900 text-red-500 hover:text-white rounded-xl font-bold transition-colors shadow-lg"><LogOut size={20}/> Keluar Ruang Kendali</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0f1c]">
        <header className="bg-slate-900 border-b border-slate-800 p-4 lg:p-6 flex justify-between items-center shadow-lg z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-slate-800 rounded-lg text-amber-500" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <div className="flex items-center gap-3">
               <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 hidden sm:block">
                  <Landmark size={24} className="text-amber-500" />
               </div>
               <div className="hidden sm:block">
                  <h2 className="text-sm font-black text-white leading-tight tracking-widest uppercase flex items-center gap-2">
                    YASPENDIK PTP NUSANTARA IV
                    <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">V2 STAGING</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">SMP/MTS DARMA PERTIWI BAH BUTONG</p>
               </div>
               <h2 className="text-xl font-black text-white sm:hidden tracking-wider">COMMAND CENTER</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div><span className="text-xs font-black text-amber-500 uppercase tracking-widest">Server Stabil</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
              <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><Activity className="text-amber-500"/> Radar Aktivitas Global</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-5 lg:p-6 rounded-3xl border border-slate-800 border-b-4 border-b-amber-500 shadow-xl relative overflow-hidden hover:-translate-y-1 transition-transform">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><Users size={80}/></div>
                  <p className="text-slate-400 font-bold text-[10px] lg:text-xs mb-2 uppercase tracking-widest">Total Guru</p>
                  <p className="text-3xl lg:text-4xl font-black text-white">{activeTeachers.length}</p>
                </div>
                <div className="bg-slate-900 p-5 lg:p-6 rounded-3xl border border-slate-800 border-b-4 border-b-blue-500 shadow-xl relative overflow-hidden hover:-translate-y-1 transition-transform">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><BookOpen size={80}/></div>
                  <p className="text-slate-400 font-bold text-[10px] lg:text-xs mb-2 uppercase tracking-widest">Bank Soal</p>
                  <p className="text-3xl lg:text-4xl font-black text-blue-400">{data.bank.length}</p>
                </div>
                <div className="bg-slate-900 p-5 lg:p-6 rounded-3xl border border-slate-800 border-b-4 border-b-emerald-500 shadow-xl relative overflow-hidden hover:-translate-y-1 transition-transform">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><Activity size={80}/></div>
                  <p className="text-slate-400 font-bold text-[10px] lg:text-xs mb-2 uppercase tracking-widest">Siswa Ujian</p>
                  <p className="text-3xl lg:text-4xl font-black text-emerald-400">{stats.online}</p>
                </div>
                <div className="bg-slate-900 p-5 lg:p-6 rounded-3xl border border-slate-800 border-b-4 border-b-purple-500 shadow-xl relative overflow-hidden hover:-translate-y-1 transition-transform">
                  <div className="absolute -right-4 -bottom-4 opacity-5"><CheckCircle size={80}/></div>
                  <p className="text-slate-400 font-bold text-[10px] lg:text-xs mb-2 uppercase tracking-widest">Rekap Nilai Masuk</p>
                  <p className="text-3xl lg:text-4xl font-black text-purple-400">{data.lead?.length || 0}</p>
                </div>
              </div>

              <div className="mt-8 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl">
                <h4 className="text-amber-500 font-black text-sm uppercase mb-4 tracking-widest flex items-center gap-2"><Settings size={18}/> Pusat Kendali Data</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button onClick={downloadMasterRecap} className="p-4 bg-emerald-950/40 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-2xl border border-emerald-900/50 font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"><Download size={20}/> Download Rekap</button>
                  <button onClick={resetLiveStudents} className="p-4 bg-red-950/40 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl border border-red-900/50 font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"><Trash2 size={20}/> Hapus Live Siswa</button>
                  <button onClick={resetAllSessions} className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"><XCircle size={20}/> Reset Sesi Ujian</button>
                  <button onClick={resetRekapNilai} className="p-4 bg-orange-950/40 hover:bg-orange-600 text-orange-500 hover:text-white rounded-2xl border border-orange-900/50 font-bold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"><Trash2 size={20}/> Bersihkan Nilai</button>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="font-bold text-white text-lg border-b border-slate-800 pb-3 flex items-center gap-2"><Lock size={18} className="text-amber-500"/> Sesi Berjalan Aktif ({activeSessions.length})</h4>
                {activeSessions.length === 0 ? (
                  <div className="bg-slate-900 p-10 rounded-3xl text-center text-slate-500 border border-dashed border-slate-700 font-medium">Tidak ada sesi ujian yang berjalan.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeSessions.map(s => (
                      <div key={s.id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-amber-500/30 transition-colors">
                        <div>
                          <p className="font-black font-mono text-2xl text-amber-400 mb-1">{s?.token}</p>
                          <p className="font-bold text-slate-400 text-sm">{s?.teacherEmail}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="text-xs font-black text-slate-900 bg-amber-500 px-3 py-1 rounded-md">{s?.mapel}</span>
                            <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-md border border-slate-700">Tingkat {s?.kelas}-{s?.subKelas}</span>
                          </div>
                        </div>
                        <button onClick={() => forceCloseSession(s.id)} className="w-full sm:w-auto bg-red-950/50 text-red-500 hover:bg-red-600 hover:text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-red-900/50 shadow-md transition-all active:scale-95"><Lock size={18}/> Kunci Paksa</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB BANK SOAL PUSAT */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
              <h3 className="text-2xl font-black text-white flex items-center gap-3"><BookOpen className="text-amber-500"/> Gudang Data Soal V2</h3>
              <div className="bg-slate-900 p-5 rounded-3xl shadow-lg border border-slate-800 flex flex-col sm:flex-row gap-4">
                <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="flex-1 p-4 border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none focus:border-amber-500"><option value="">-- Semua Pencipta Soal --</option>{availableGuruSoal.map(g => <option key={g}>{g}</option>)}</select>
                <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)} className="flex-1 p-4 border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none focus:border-amber-500"><option value="">-- Semua Bidang Studi --</option>{availableMapelSoal.map(m => <option key={m}>{m}</option>)}</select>
              </div>

              <div className="space-y-4">
                {filteredSoal.map((q, i) => (
                  <div key={q.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg flex flex-col md:flex-row gap-6 justify-between hover:border-amber-500/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-800 pb-4">
                        <span className="text-xs font-black bg-amber-500 text-black px-3 py-1.5 rounded-md">{q?.teacherEmail}</span>
                        <span className="text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-md">{q?.mapel} (Tk. {q?.kelas})</span>
                      </div>
                      
                      {/* V2: Render Gambar jika ada */}
                      {q?.gambar && (
                        <div className="mb-4 max-w-xs overflow-hidden rounded-xl border border-slate-700">
                          <img src={q.gambar} alt="Gambar Soal" className="w-full h-auto object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </div>
                      )}

                      <div className="font-bold text-lg mb-6 text-white leading-relaxed break-words flex">
                         <span className="text-amber-500 mr-2">{i+1}.</span>
                         <div className="flex-1"><Latex>{String(q?.pertanyaan || ' ')}</Latex></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-400 font-medium">
                        {['A','B','C','D'].map(opt => (
                          <div key={opt} className={`p-4 rounded-xl border flex break-words ${q?.kunci===opt?'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold':'border-slate-800 bg-slate-950'}`}>
                             <span className="mr-2 font-black">{opt}.</span>
                             <div className="flex-1"><Latex>{String(q[`opsi${opt}`] || ' ')}</Latex></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 self-end md:self-start md:border-l border-slate-800 md:pl-6 pt-4 md:pt-0 border-t md:border-t-0 w-full md:w-auto">
                      <button onClick={() => openEditSoalModal(q)} className="flex-1 md:flex-none flex items-center justify-center text-blue-400 bg-blue-950/30 border border-blue-900/50 hover:bg-blue-900 p-4 rounded-xl active:scale-95 transition-all shadow-md"><Edit size={20}/></button>
                      <button onClick={() => deleteSoalGlobal(q.id)} className="flex-1 md:flex-none flex items-center justify-center text-red-500 bg-red-950/30 border border-red-900/50 hover:bg-red-900 p-4 rounded-xl active:scale-95 transition-all shadow-md"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
                {filteredSoal.length === 0 && <div className="text-center p-12 text-slate-500 bg-slate-900 rounded-3xl border border-dashed border-slate-700 font-medium">Tidak ada data soal yang sesuai.</div>}
              </div>
            </div>
          )}

          {/* TAB MANAJEMEN GURU */}
          {activeTab === 'guru' && (
            <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-2xl font-black text-white flex items-center gap-3"><Users className="text-amber-500"/> Personalia Guru</h3>
                <button onClick={() => { setGuruFormData({name:'', email:''}); setShowAddGuruModal(true); }} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black px-6 py-3.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 transition-all uppercase tracking-wide"><Plus size={20}/> Tambah Manual</button>
              </div>
              
              {pendingTeachers.length > 0 && (
                <div className="bg-orange-950/30 rounded-3xl border border-orange-900/50 overflow-hidden shadow-lg p-5 space-y-4">
                  <div className="font-black text-orange-500 flex items-center gap-2 border-b border-orange-900/50 pb-3"><ShieldAlert size={22}/> Pendaftar Baru ({pendingTeachers.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingTeachers.map(t => (
                      <div key={t.id} className="bg-slate-950 p-5 rounded-2xl border border-orange-900/30 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm">
                        <div><p className="font-black text-white text-lg">{t?.name || 'Tanpa Nama'}</p><p className="font-medium text-slate-400 text-sm mt-1">{t?.email || '-'}</p></div>
                        <div className="flex gap-2 w-full sm:w-auto border-t border-slate-800 sm:border-t-0 pt-4 sm:pt-0">
                          <button onClick={() => approveTeacher(t.id)} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all"><CheckCircle size={18} className="mx-auto"/></button>
                          <button onClick={() => rejectTeacher(t.id)} className="flex-1 sm:flex-none bg-slate-900 border border-red-900/50 text-red-500 hover:bg-red-950 px-5 py-3 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all"><XCircle size={18} className="mx-auto"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-bold text-white text-lg border-b border-slate-800 pb-3">Staff Pengajar Aktif ({activeTeachers.length})</h4>
                {activeTeachers.length === 0 ? (
                  <div className="text-center p-12 bg-slate-900 rounded-3xl border border-dashed border-slate-700 text-slate-500 font-medium">Buku Induk Guru Kosong.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeTeachers.map(t => (
                      <div key={t.id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between hover:border-amber-500/30 transition-colors">
                        <div className="flex items-center gap-4 mb-5 border-b border-slate-800/50 pb-4">
                          <div className="w-14 h-14 shrink-0 bg-slate-800 text-amber-500 rounded-full flex items-center justify-center font-black text-2xl uppercase border border-slate-700 shadow-inner">
                            {t?.name ? t.name.charAt(0) : 'G'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-white text-lg truncate">{t?.name || 'Guru Tanpa Nama'}</p>
                            <p className="font-medium text-slate-400 text-sm truncate">{t?.email || 'Email tidak tersedia'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => openEditGuruModal(t)} title="Edit Nama" className="flex items-center justify-center text-slate-300 bg-slate-800 hover:bg-slate-700 p-3 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-700"><UserCog size={18}/></button>
                          <button onClick={() => handleResetPassword(t.email)} title="Reset Password" className="flex items-center justify-center text-amber-500 bg-amber-950/20 hover:bg-amber-600 hover:text-white p-3 rounded-xl transition-all shadow-sm active:scale-95 border border-amber-900/30"><KeyRound size={18}/></button>
                          <button onClick={() => deleteTeacher(t.id)} title="Hapus Guru" className="flex items-center justify-center text-red-500 bg-red-950/20 hover:bg-red-900 hover:text-white p-3 rounded-xl transition-all shadow-sm active:scale-95 border border-red-900/30"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL EDIT GURU */}
      {showEditGuruModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-6 text-white flex items-center gap-3"><UserCog className="text-amber-500"/> Modifikasi Data Personalia</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-5">
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Nama Lengkap & Gelar</label><input required value={guruFormData.name} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Email Akun (Info Saja)</label><input disabled value={guruFormData.email} className="w-full p-4 bg-slate-900/50 border border-slate-800 rounded-2xl font-bold text-slate-500 cursor-not-allowed" /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowGuruModal(false)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold active:scale-95 transition-all">Batal</button><button type="submit" className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black shadow-[0_0_15px_rgba(245,158,11,0.2)] active:scale-95 transition-all">Simpan Revisi</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH GURU MANUAL */}
      {showAddGuruModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-2 text-white flex items-center gap-3"><Plus className="text-amber-500"/> Registrasi Paksa</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">Instruksi ini akan menyuntikkan data guru langsung ke database pusat.</p>
            <form onSubmit={handleManualAddGuru} className="space-y-5">
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Nama Lengkap Guru</label><input required value={guruFormData.name} placeholder="Bpk. Suryanto Siregar" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Email Terdaftar</label><input required value={guruFormData.email} type="email" placeholder="suryanto@guru.com" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddGuruModal(false)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-bold active:scale-95 transition-colors">Batalkan</button><button type="submit" className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-colors">Suntik Data</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SOAL PUSAT V2 DENGAN PREVIEW */}
      {showEditSoalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 md:p-8 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-800 pb-4 gap-4">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <Edit className="text-amber-500"/> Intervensi Soal Pusat V2
              </h2>
              <button type="button" onClick={() => setPreviewMode(!previewMode)} className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all w-full sm:w-auto justify-center ${previewMode ? 'bg-amber-500 text-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {previewMode ? <Edit size={16}/> : <Eye size={16}/>} {previewMode ? 'Kembali ke Editor' : 'Pratinjau Soal'}
              </button>
            </div>

            {previewMode ? (
              // --- MODE PRATINJAU SUPERADMIN ---
              <div className="p-4 sm:p-8 bg-slate-950 rounded-3xl border border-slate-800 space-y-6 animate-in fade-in duration-200">
                <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800">
                  {soalFormData.gambar && (
                    <img src={soalFormData.gambar} alt="Preview" className="mb-6 rounded-xl max-h-60 mx-auto object-cover border border-slate-700 shadow-sm" />
                  )}
                  <div className="text-lg font-bold text-white leading-relaxed break-words">
                    <Latex>{String(soalFormData.pertanyaan || 'Ketik pertanyaan untuk melihat pratinjau...')}</Latex>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['A','B','C','D'].map(opt => (
                    <div key={opt} className={`p-5 rounded-2xl border transition-all break-words flex ${soalFormData.kunci === opt ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-900'}`}>
                      <span className={`font-black mr-3 ${soalFormData.kunci === opt ? 'text-amber-500' : 'text-slate-500'}`}>{opt}.</span>
                      <div className="flex-1 font-medium text-slate-300">
                        <Latex>{String(soalFormData[`opsi${opt}`] || ' ')}</Latex>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // --- MODE EDITOR SUPERADMIN ---
              <form onSubmit={handleUpdateSoal} className="space-y-5 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Mata Pelajaran</label>
                    <input required value={soalFormData.mapel} className="w-full p-4 bg-slate-950 border border-slate-800 text-white rounded-2xl font-bold focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, mapel: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Tingkat</label>
                    <input required value={soalFormData.kelas} className="w-full p-4 bg-slate-950 border border-slate-800 text-white rounded-2xl font-bold text-center focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, kelas: e.target.value})} />
                  </div>
                </div>

                <div className="relative">
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Link URL Gambar (Opsional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-4 text-slate-500" size={20}/>
                    <input value={soalFormData.gambar} placeholder="Paste link URL gambar (PostImage/Imgur)..." className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 text-white rounded-2xl font-medium text-sm focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, gambar: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between tracking-widest">
                    <span>Teks Pertanyaan</span>
                    <span className="text-[10px] bg-slate-800 text-amber-500 px-2 py-0.5 rounded font-black">Math = $...$</span>
                  </label>
                  <textarea required value={soalFormData.pertanyaan} className="w-full p-5 bg-slate-950 border border-slate-800 text-white rounded-2xl min-h-[120px] leading-relaxed focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, pertanyaan: e.target.value})} />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Opsi Jawaban</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {['A','B','C','D'].map(o => (
                      <div key={o} className="relative">
                        <span className="absolute left-4 top-4 font-black text-amber-500">{o}.</span>
                        <input required value={soalFormData[`opsi${o}`]} className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 text-white rounded-2xl focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, [`opsi${o}`]: e.target.value})} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-4 border-t border-slate-800 mt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Kunci Jawaban</label>
                    <select value={soalFormData.kunci} className="w-full p-4 border border-amber-500/50 bg-amber-500/10 text-amber-500 font-black rounded-2xl outline-none cursor-pointer" onChange={e => setSoalFormData({...soalFormData, kunci: e.target.value})}>
                      <option value="A">Opsi A</option><option value="B">Opsi B</option><option value="C">Opsi C</option><option value="D">Opsi D</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-6">
                    <button type="button" onClick={() => { setShowSoalModal(false); setPreviewMode(false); }} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-bold active:scale-95 transition-colors">Tutup</button>
                    <button type="submit" className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-colors">Terapkan Revisi</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
