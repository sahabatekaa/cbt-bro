import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { sendPasswordResetEmail } from 'firebase/auth';
import * as XLSX from 'xlsx'; 
import { Activity, BookOpen, Users, LogOut, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, AlertTriangle, Menu, X, ShieldCheck, Lock, Unlock, UserCog, Plus, Crown, Download, Settings, KeyRound, Landmark, Zap, ImageIcon, Eye, FileText, ClipboardList, BarChart, CheckSquare } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function SuperAdminDashboard({ onLogout }) {
  // === KONFIGURASI V2/V3 ===
  const APP_VERSION = "2.0.0";
  const currentUserEmail = auth.currentUser?.email || 'admin@sekolah.com';

  const [activeTab, setActiveTab] = useState(localStorage.getItem('superAdminTab') || 'radar');
  useEffect(() => { localStorage.setItem('superAdminTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ users: [], live: [], bank: [], sessions: [], lead: [] });
  
  const [filterGuru, setFilterGuru] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  
  // === STATE REKAP NILAI ADMIN PUSAT ===
  const [adminRecapGuru, setAdminRecapGuru] = useState('');
  const [adminRecapMapel, setAdminRecapMapel] = useState('');
  const [adminRecapKelas, setAdminRecapKelas] = useState(''); 
  const [adminRecapToken, setAdminRecapToken] = useState('');
  const [adminPrintMode, setAdminPrintMode] = useState('rekap');
  
  // === FITUR HAPUS BANYAK (BATCH DELETE) ===
  const [selectedRecaps, setSelectedRecaps] = useState([]);

  const defaultSoalForm = { 
    jenisSoal: 'PG', kodeWacana: '', teksWacana: '',
    mapel: '', kelas: '', pertanyaan: ' ', gambar: '', 
    opsiA: ' ', opsiB: ' ', opsiC: ' ', opsiD: ' ', kunci: 'A' 
  };
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
  const allAdminSessions = data.sessions.sort((a,b) => b.timestamp - a.timestamp);
  
  const stats = {
    online: data.live.filter(s => s?.status !== 'Selesai').length,
    selesai: data.live.filter(s => s?.status === 'Selesai').length,
    curang: data.live.filter(s => (s?.warnings || 0) >= 3).length
  };

  const availableGuruSoal = [...new Set(data.bank.map(q => q?.teacherEmail).filter(Boolean))];
  const availableMapelSoal = [...new Set(data.bank.map(q => q?.mapel).filter(Boolean))];
  const filteredSoal = data.bank.filter(q => (filterGuru === '' || q?.teacherEmail === filterGuru) && (filterMapel === '' || q?.mapel === filterMapel));

  // ==================================================
  // FILTER LOGIC UNTUK REKAP ADMIN PUSAT (DIPERKETAT)
  // ==================================================
  const availableRecapGurus = [...new Set(data.lead.map(s => s?.teacherEmail).filter(Boolean))];
  
  const availableRecapMapels = [...new Set(data.lead
    .filter(s => adminRecapGuru === '' || (s?.teacherEmail || '') === adminRecapGuru)
    .map(s => s?.mapel).filter(Boolean))];
    
  const availableRecapKelasList = [...new Set(data.lead
    .filter(s => 
      (adminRecapGuru === '' || (s?.teacherEmail || '') === adminRecapGuru) && 
      (adminRecapMapel === '' || (s?.mapel || '') === adminRecapMapel)
    )
    .map(s => s?.class).filter(Boolean))];

  const availableRecapTokens = [...new Set(data.lead
    .filter(s => 
      (adminRecapGuru === '' || (s?.teacherEmail || '') === adminRecapGuru) && 
      (adminRecapMapel === '' || (s?.mapel || '') === adminRecapMapel) && 
      (adminRecapKelas === '' || (s?.class || '') === adminRecapKelas)
    )
    .map(s => s?.token).filter(Boolean))];

  const filteredAdminLeaderboard = data.lead.filter(s => 
    (adminRecapGuru === '' || (s?.teacherEmail || '') === adminRecapGuru) && 
    (adminRecapMapel === '' || (s?.mapel || '') === adminRecapMapel) && 
    (adminRecapKelas === '' || (s?.class || '') === adminRecapKelas) && 
    (adminRecapToken === '' || (s?.token || '') === adminRecapToken)
  ).sort((a,b) => b.score - a.score);

  // === FUNGSI CENTANG & HAPUS BANYAK (BATCH DELETE) ===
  const toggleSelectRecap = (id) => {
    setSelectedRecaps(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSelectAllRecaps = (e) => {
    if (e.target.checked) setSelectedRecaps(filteredAdminLeaderboard.map(s => s.id));
    else setSelectedRecaps([]);
  };

  const handleBatchDeleteRecaps = async () => {
    if (selectedRecaps.length === 0) return;
    const konfirmasi = window.prompt(`🚨 HAPUS BANYAK DATA:\nAnda akan menghapus ${selectedRecaps.length} data siswa terpilih secara permanen!\n\nKetik kata 'HAPUS' (huruf besar) untuk melanjutkan:`);
    if (konfirmasi === 'HAPUS') {
      try {
        await Promise.all(selectedRecaps.map(id => remove(ref(db, `leaderboard/${id}`))));
        setSelectedRecaps([]);
        alert("Data terpilih berhasil dihancurkan!");
      } catch (err) { alert("Gagal menghapus: " + err.message); }
    } else if (konfirmasi !== null) {
      alert("❌ Dibatalkan: Kata konfirmasi salah.");
    }
  };

  // === FITUR MASTER KENDALI GLOBAL ===
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
    if (window.confirm(`Kirim instruksi reset kata sandi ke email: ${email}?`)) {
      sendPasswordResetEmail(auth, email).then(() => alert("✅ Link Reset Sandi Berhasil Dikirim!")).catch((error) => alert("❌ Gagal Mengirim: " + error.message));
    }
  };

  const handleManualAddGuru = (e) => {
    e.preventDefault();
    const cleanId = guruFormData.email.replace(/[^a-zA-Z0-9]/g, '');
    set(ref(db, `users/${cleanId}`), { name: guruFormData.name, email: guruFormData.email, role: 'teacher', status: 'active', createdAt: Date.now() });
    alert("Guru berhasil disuntikkan ke Database Pusat!"); setShowAddGuruModal(false); setGuruFormData({ name: '', email: '' });
  };

  const toggleSessionStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    const msg = newStatus === 'open' ? "BUKA KUNCI sesi ini agar siswa bisa masuk lagi?" : "KUNCI PAKSA sesi ini sekarang?";
    if(window.confirm(msg)) { update(ref(db, `exam_sessions/${id}`), { status: newStatus }); }
  };
  
  const deleteSoalGlobal = (id) => { if(window.confirm("Hapus soal ini dari PUSAT?")) remove(ref(db, `bank_soal/${id}`)); };

  const handleDeleteAdminSingleRecap = (id, studentName) => {
    if (window.confirm(`OTORITAS ADMIN:\nYakin hapus data ujian "${studentName}" secara permanen?`)) {
      remove(ref(db, `leaderboard/${id}`)).then(() => {
         setSelectedRecaps(prev => prev.filter(item => item !== id));
      }).catch(err => alert("Gagal: " + err.message));
    }
  };

  const openEditSoalModal = (q) => { 
    setSoalFormData({ 
      jenisSoal: q?.jenisSoal || 'PG', kodeWacana: q?.kodeWacana || '', teksWacana: q?.teksWacana || '',
      mapel: q?.mapel||'', kelas: q?.kelas||'', pertanyaan: q?.pertanyaan||' ', gambar: q?.gambar||'', 
      opsiA: q?.opsiA||' ', opsiB: q?.opsiB||' ', opsiC: q?.opsiC||' ', opsiD: q?.opsiD||' ', kunci: q?.kunci||'A' 
    }); 
    setEditSoalId(q.id); 
    setShowSoalModal(true); 
    setPreviewMode(false);
  };

  const handlePGKKeyToggle = (opt) => {
    let currentKeys = soalFormData.kunci ? soalFormData.kunci.split(',') : [];
    if (currentKeys.includes(opt)) currentKeys = currentKeys.filter(k => k !== opt);
    else currentKeys.push(opt);
    setSoalFormData({ ...soalFormData, kunci: currentKeys.sort().join(',') });
  };

  const handleUpdateSoal = (e) => { 
    e.preventDefault(); 
    const finalData = { ...soalFormData };
    if (finalData.jenisSoal === 'ESAI') {
        finalData.opsiA = ''; finalData.opsiB = ''; finalData.opsiC = ''; finalData.opsiD = ''; finalData.kunci = '';
    }
    update(ref(db, `bank_soal/${editSoalId}`), finalData); 
    alert("Soal berhasil dimodifikasi oleh Admin!"); 
    setShowSoalModal(false); 
    setPreviewMode(false); 
  };

  const resetLiveStudents = () => { if(window.confirm("🚨 Hapus semua data Live Siswa?")) { remove(ref(db, 'live_students')); alert("Data dibersihkan."); } };
  const resetAllSessions = () => { if(window.confirm("🚨 Hapus semua sesi ujian?")) { remove(ref(db, 'exam_sessions')); alert("Data direset."); } };
  
  const resetRekapNilai = () => { 
    const konfirmasi = window.prompt("🚨 KENDALI PUSAT!\nTindakan ini akan MENGHAPUS PERMANEN SELURUH NILAI di sekolah.\n\nKetik kata 'KOSONGKAN' di bawah ini untuk melanjutkan:");
    if (konfirmasi === "KOSONGKAN") { 
      remove(ref(db, 'leaderboard')); alert("Database Nilai berhasil dikosongkan."); 
      setSelectedRecaps([]);
    } else if (konfirmasi !== null) {
      alert("❌ Dibatalkan: Kata sandi konfirmasi salah.");
    }
  };

  const downloadMasterRecap = () => {
    if (!data.lead || data.lead.length === 0) return alert("Belum ada data nilai.");
    try {
      const ws = XLSX.utils.json_to_sheet(data.lead);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Master");
      XLSX.writeFile(wb, `MASTER_REKAP_CBT_DARMAPERTIWI_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch(err) { alert("Gagal mengunduh rekap master: " + err.message); }
  };

  const NavItem = ({ tab, icon: Icon, label, badge }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex justify-between items-center p-3 rounded-xl transition-all ${activeTab === tab ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white font-bold'}`}>
      <div className="flex items-center gap-3"><Icon size={18}/> <span className="text-sm">{label}</span></div>
      {badge > 0 && <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">{badge}</span>}
    </button>
  );

  const OfficialHeader = () => (
    <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
      <h1 className="text-xl font-black uppercase tracking-widest text-black">YASPENDIK PTP NUSANTARA IV</h1>
      <h2 className="text-lg font-black uppercase tracking-widest text-black mt-1">SMP/MTS DARMA PERTIWI BAH BUTONG</h2>
      <p className="mt-2 text-xs font-bold text-gray-800">Dokumen Resmi Administrasi Ujian Berbasis Komputer (CBT)</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-200">
      {/* CSS KHUSUS PRINT - PECAH BATAS LAYAR & REPEAT HEADER */}
      <style>{`
        @media print { 
          @page { margin: 1cm; size: portrait; } 
          html, body, #root { height: auto !important; overflow: visible !important; background: white !important; -webkit-print-color-adjust: exact; margin: 0; font-family: Arial, sans-serif; }
          .h-screen, .min-h-screen, .overflow-hidden, .overflow-y-auto, main, .flex-1 { 
            height: auto !important; min-height: auto !important; overflow: visible !important; display: block !important; position: static !important; 
          } 
          aside, header, button, select, input, .print\\:hidden { display: none !important; } 
          .print\\:block { display: block !important; } 
          table { width: 100% !important; border-collapse: collapse; margin-top: 10px; border: 1px solid black !important; page-break-inside: auto; } 
          thead { display: table-header-group; } 
          tr { page-break-inside: avoid; page-break-after: auto; } 
          th, td { border: 1px solid #000 !important; padding: 6px 8px !important; color: black !important; font-size: 11px !important; line-height: 1.3; } 
          th { background-color: #f0f0f0 !important; font-weight: bold; text-transform: uppercase; } 
          .flex.justify-end.mt-12, .flex.justify-between.mt-12 { page-break-inside: avoid; margin-top: 30px !important; display: flex !important; justify-content: flex-end !important; }
          .shadow-sm, .shadow-md, .shadow-xl { box-shadow: none !important; }
        }
      `}</style>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      {/* UKURAN SIDEBAR DIKECILKAN (w-72 -> w-64) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-black border-r border-slate-800 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center"><h1 className="text-xl font-black text-white flex gap-2 items-center tracking-widest"><Crown className="text-amber-500" size={24}/> PUSAT</h1><button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button></div>
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-black">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">VERSI SERVER {APP_VERSION}</p>
          <p className="text-xs font-bold truncate text-white uppercase">Administrator Utama</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem tab="radar" icon={Activity} label="Radar Aktivitas" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal Global" />
          <NavItem tab="guru" icon={Users} label="Manajemen Personalia" badge={pendingTeachers.length} />
          <div className="my-2 border-t border-slate-800"></div>
          <NavItem tab="recap" icon={ClipboardList} label="Rekap Nilai Pusat" />
        </nav>
        
        <div className="p-3 border-t border-slate-800">
           <button onClick={triggerGlobalUpdate} className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95 uppercase tracking-tighter">
              <Zap size={16}/> RILIS UPDATE
           </button>
        </div>

        <div className="p-3"><button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-950/50 hover:bg-red-900 border border-red-900 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-colors shadow-lg"><LogOut size={16}/> Keluar Akun</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0f1c]">
        {/* PADDING HEADER DIKECILKAN */}
        <header className="bg-slate-900 border-b border-slate-800 p-3 lg:p-4 flex justify-between items-center shadow-lg z-10 print:hidden">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 bg-slate-800 rounded-lg text-amber-500" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
            <div className="flex items-center gap-3">
               <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 hidden sm:block">
                  <Landmark size={20} className="text-amber-500" />
               </div>
               <div className="hidden sm:block">
                  <h2 className="text-xs font-black text-white leading-tight tracking-widest uppercase flex items-center gap-2">
                    YASPENDIK PTP NUSANTARA IV
                    <span className="bg-amber-500 text-black text-[8px] px-1 py-0.5 rounded uppercase font-black tracking-widest">V2 STAGING</span>
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">SMP/MTS DARMA PERTIWI BAH BUTONG</p>
               </div>
               <h2 className="text-lg font-black text-white sm:hidden tracking-wider">PUSAT</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div><span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Server Stabil</span>
          </div>
        </header>
        
        {/* LEBAR KONTEN DIMAKSIMALKAN (max-w-7xl) AGAR TIDAK SESAK */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* TAB RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-300">
              <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><Activity className="text-amber-500" size={20}/> Radar Aktivitas Global</h3>
              
              {/* KARTU RADAR DIKECILKAN */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 border-b-4 border-b-amber-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-2 -bottom-2 opacity-5"><Users size={60}/></div>
                  <p className="text-slate-400 font-bold text-[10px] mb-1 uppercase tracking-widest">Total Guru</p>
                  <p className="text-2xl lg:text-3xl font-black text-white">{activeTeachers.length}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 border-b-4 border-b-blue-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-2 -bottom-2 opacity-5"><BookOpen size={60}/></div>
                  <p className="text-slate-400 font-bold text-[10px] mb-1 uppercase tracking-widest">Bank Soal</p>
                  <p className="text-2xl lg:text-3xl font-black text-blue-400">{data.bank.length}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 border-b-4 border-b-emerald-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-2 -bottom-2 opacity-5"><Activity size={60}/></div>
                  <p className="text-slate-400 font-bold text-[10px] mb-1 uppercase tracking-widest">Siswa Ujian</p>
                  <p className="text-2xl lg:text-3xl font-black text-emerald-400">{stats.online}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 border-b-4 border-b-purple-500 shadow-lg relative overflow-hidden">
                  <div className="absolute -right-2 -bottom-2 opacity-5"><CheckCircle size={60}/></div>
                  <p className="text-slate-400 font-bold text-[10px] mb-1 uppercase tracking-widest">Rekap Nilai</p>
                  <p className="text-2xl lg:text-3xl font-black text-purple-400">{data.lead?.length || 0}</p>
                </div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-lg mt-4">
                <h4 className="text-amber-500 font-black text-xs uppercase mb-3 tracking-widest flex items-center gap-2"><Settings size={16}/> Pusat Kendali Data</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <button onClick={downloadMasterRecap} className="p-3 bg-emerald-950/40 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl border border-emerald-900/50 font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-xs active:scale-95"><Download size={16}/> Download Rekap</button>
                  <button onClick={resetLiveStudents} className="p-3 bg-red-950/40 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-900/50 font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-xs active:scale-95"><Trash2 size={16}/> Hapus Live Siswa</button>
                  <button onClick={resetAllSessions} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-xs active:scale-95"><XCircle size={16}/> Reset Sesi Ujian</button>
                  <button onClick={resetRekapNilai} className="p-3 bg-orange-950/40 hover:bg-orange-600 text-orange-500 hover:text-white rounded-xl border border-orange-900/50 font-bold transition-all flex items-center justify-center gap-2 shadow-sm text-xs active:scale-95"><Trash2 size={16}/> Bersihkan Nilai</button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <h4 className="font-bold text-white text-base border-b border-slate-800 pb-2 flex items-center gap-2"><Lock size={16} className="text-amber-500"/> Semua Sesi Ujian ({allAdminSessions.length})</h4>
                {allAdminSessions.length === 0 ? (
                  <div className="bg-slate-900 p-8 rounded-2xl text-center text-slate-500 border border-dashed border-slate-700 text-sm font-medium">Tidak ada sesi ujian yang tercatat di database.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allAdminSessions.map(s => (
                      <div key={s.id} className={`p-4 rounded-2xl border shadow-md flex flex-col justify-between gap-3 transition-colors ${s.status === 'open' ? 'bg-slate-900 border-slate-800 hover:border-amber-500/30' : 'bg-slate-950 border-red-900/30 opacity-80 hover:border-red-500/30'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-black font-mono text-xl mb-0.5 ${s.status === 'open' ? 'text-amber-400' : 'text-red-500'}`}>{s?.token}</p>
                            <p className="font-medium text-slate-400 text-xs">{s?.teacherEmail}</p>
                          </div>
                          <button onClick={() => toggleSessionStatus(s.id, s.status)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border shadow-sm transition-all active:scale-95 ${s.status === 'open' ? 'bg-red-950/50 text-red-500 hover:bg-red-600 hover:text-white border-red-900/50' : 'bg-emerald-950/50 text-emerald-500 hover:bg-emerald-600 hover:text-white border-emerald-900/50'}`}>
                            {s.status === 'open' ? <><Lock size={12}/> Kunci Paksa</> : <><Unlock size={12}/> Buka Kunci</>}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded ${s.status === 'open' ? 'text-slate-900 bg-amber-500' : 'text-slate-300 bg-slate-800'}`}>{s?.mapel}</span>
                            <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">Tk. {s?.kelas}-{s?.subKelas}</span>
                        </div>
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 flex gap-3 text-[9px] font-bold text-slate-400">
                           <span className="text-blue-400">PG: {s.kuotaPG || 0}</span>
                           <span className="text-orange-400">PGK: {s.kuotaPGK || 0}</span>
                           <span className="text-purple-400">Esai: {s.kuotaEsai || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB BANK SOAL PUSAT */}
          {activeTab === 'bank' && (
            <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-300">
              <h3 className="text-xl font-black text-white flex items-center gap-2"><BookOpen className="text-amber-500" size={20}/> Gudang Data Soal V3</h3>
              <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 flex flex-col sm:flex-row gap-3">
                <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="flex-1 p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none focus:border-amber-500"><option value="">-- Semua Pencipta Soal --</option>{availableGuruSoal.map(g => <option key={g}>{g}</option>)}</select>
                <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)} className="flex-1 p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none focus:border-amber-500"><option value="">-- Semua Bidang Studi --</option>{availableMapelSoal.map(m => <option key={m}>{m}</option>)}</select>
              </div>

              <div className="space-y-3">
                {filteredSoal.map((q, i) => (
                  <div key={q.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 justify-between hover:border-amber-500/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-3 border-b border-slate-800 pb-3">
                        <span className="text-[10px] font-black bg-amber-500 text-black px-2.5 py-1 rounded">{q?.teacherEmail}</span>
                        <span className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded">{q?.mapel} (Tk. {q?.kelas})</span>
                        
                        {/* V3: Label Tipe Soal di Admin */}
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded border ${(!q.jenisSoal || q.jenisSoal === 'PG') ? 'bg-blue-900/40 text-blue-400 border-blue-800/50' : q.jenisSoal === 'PGK' ? 'bg-orange-900/40 text-orange-400 border-orange-800/50' : 'bg-purple-900/40 text-purple-400 border-purple-800/50'}`}>
                           Tipe: {q.jenisSoal || 'PG'}
                        </span>
                        {q.kodeWacana && <span className="text-[10px] font-black bg-slate-950 text-white px-2.5 py-1 rounded border border-slate-700">Wacana: {q.kodeWacana}</span>}
                      </div>
                      
                      {q?.gambar && (
                        <div className="mb-3 max-w-xs overflow-hidden rounded-lg border border-slate-700">
                          <img src={q.gambar} alt="Gambar Soal" className="w-full h-auto object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </div>
                      )}

                      {/* V3: Tampilkan Teks Wacana di Admin */}
                      {q?.teksWacana && (
                         <div className="mb-3 p-3 bg-slate-950 border-l-2 border-slate-600 rounded-r-lg text-xs font-medium text-slate-400">
                             <Latex>{String(q.teksWacana)}</Latex>
                         </div>
                      )}

                      <div className="font-bold text-sm mb-4 text-white leading-relaxed break-words flex">
                         <span className="text-amber-500 mr-2">{i+1}.</span>
                         <div className="flex-1"><Latex>{String(q?.pertanyaan || ' ')}</Latex></div>
                      </div>
                      
                      {/* V3: Jangan Render Opsi Jika Esai */}
                      {(!q.jenisSoal || q.jenisSoal !== 'ESAI') && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 font-medium">
                            {['A','B','C','D'].map(opt => {
                              const isKey = q.jenisSoal === 'PGK' ? (q.kunci && q.kunci.includes(opt)) : q.kunci === opt;
                              return (
                              <div key={opt} className={`p-3 rounded-xl border flex break-words ${isKey ?'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold':'border-slate-800 bg-slate-950'}`}>
                                 <span className="mr-2 font-black">{opt}.</span>
                                 <div className="flex-1"><Latex>{String(q[`opsi${opt}`] || ' ')}</Latex></div>
                              </div>
                            )})}
                          </div>
                      )}
                    </div>
                    <div className="flex gap-2 self-end md:self-start md:border-l border-slate-800 md:pl-4 pt-3 md:pt-0 border-t md:border-t-0 w-full md:w-auto">
                      <button onClick={() => openEditSoalModal(q)} className="flex-1 md:flex-none flex items-center justify-center text-blue-400 bg-blue-950/30 border border-blue-900/50 hover:bg-blue-900 p-3 rounded-xl active:scale-95 transition-all shadow-sm"><Edit size={16}/></button>
                      <button onClick={() => deleteSoalGlobal(q.id)} className="flex-1 md:flex-none flex items-center justify-center text-red-500 bg-red-950/30 border border-red-900/50 hover:bg-red-900 p-3 rounded-xl active:scale-95 transition-all shadow-sm"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
                {filteredSoal.length === 0 && <div className="text-center p-8 text-slate-500 bg-slate-900 rounded-2xl border border-dashed border-slate-700 text-sm font-medium">Tidak ada data soal yang sesuai.</div>}
              </div>
            </div>
          )}

          {/* TAB MANAJEMEN GURU */}
          {activeTab === 'guru' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><Users className="text-amber-500" size={20}/> Personalia Guru</h3>
                <button onClick={() => { setGuruFormData({name:'', email:''}); setShowAddGuruModal(true); }} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(245,158,11,0.3)] active:scale-95 transition-all uppercase tracking-wide"><Plus size={16}/> Tambah Manual</button>
              </div>
              
              {pendingTeachers.length > 0 && (
                <div className="bg-orange-950/30 rounded-2xl border border-orange-900/50 overflow-hidden shadow-sm p-4 space-y-3">
                  <div className="font-black text-orange-500 text-sm flex items-center gap-2 border-b border-orange-900/50 pb-2"><ShieldAlert size={18}/> Pendaftar Baru ({pendingTeachers.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {pendingTeachers.map(t => (
                      <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-orange-900/30 flex flex-col justify-between gap-3 shadow-sm">
                        <div><p className="font-black text-white text-sm">{t?.name || 'Tanpa Nama'}</p><p className="font-medium text-slate-400 text-xs mt-0.5">{t?.email || '-'}</p></div>
                        <div className="flex gap-2 w-full border-t border-slate-800 pt-3">
                          <button onClick={() => approveTeacher(t.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all"><CheckCircle size={16} className="mx-auto"/></button>
                          <button onClick={() => rejectTeacher(t.id)} className="flex-1 bg-slate-900 border border-red-900/50 text-red-500 hover:bg-red-950 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all"><XCircle size={16} className="mx-auto"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm border-b border-slate-800 pb-2">Staff Pengajar Aktif ({activeTeachers.length})</h4>
                {activeTeachers.length === 0 ? (
                  <div className="text-center p-8 bg-slate-900 rounded-2xl border border-dashed border-slate-700 text-slate-500 text-sm font-medium">Buku Induk Guru Kosong.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {activeTeachers.map(t => (
                      <div key={t.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-amber-500/30 transition-colors">
                        <div className="flex items-center gap-3 mb-4 border-b border-slate-800/50 pb-3">
                          <div className="w-10 h-10 shrink-0 bg-slate-800 text-amber-500 rounded-full flex items-center justify-center font-black text-lg uppercase border border-slate-700">
                            {t?.name ? t.name.charAt(0) : 'G'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-white text-sm truncate">{t?.name || 'Guru Tanpa Nama'}</p>
                            <p className="font-medium text-slate-400 text-[10px] truncate">{t?.email || 'Email tidak tersedia'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => openEditGuruModal(t)} title="Edit Nama" className="flex items-center justify-center text-slate-300 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg transition-all shadow-sm active:scale-95 border border-slate-700"><UserCog size={14}/></button>
                          <button onClick={() => handleResetPassword(t.email)} title="Reset Password" className="flex items-center justify-center text-amber-500 bg-amber-950/20 hover:bg-amber-600 hover:text-white py-2 rounded-lg transition-all shadow-sm active:scale-95 border border-amber-900/30"><KeyRound size={14}/></button>
                          <button onClick={() => deleteTeacher(t.id)} title="Hapus Guru" className="flex items-center justify-center text-red-500 bg-red-950/20 hover:bg-red-900 hover:text-white py-2 rounded-lg transition-all shadow-sm active:scale-95 border border-red-900/30"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB BARU: REKAP NILAI PUSAT UNTUK SUPER ADMIN (COMPACT & RESPONSIVE) */}
          {activeTab === 'recap' && (
            <div className="space-y-4 max-w-7xl mx-auto print:max-w-full animate-in fade-in duration-300">
              <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3 mb-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2"><ClipboardList className="text-amber-500" size={18}/> Pusat Rekapitulasi Nilai</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                    {/* Tombol Hapus Banyak (Batch Delete) */}
                    {selectedRecaps.length > 0 && (
                      <button onClick={handleBatchDeleteRecaps} className="flex-1 md:flex-none bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-colors shadow-sm text-xs"><Trash2 size={14}/> Hapus {selectedRecaps.length} Terpilih</button>
                    )}
                    <button onClick={resetRekapNilai} className="flex-1 md:flex-none bg-slate-950 hover:bg-red-950 border border-slate-800 hover:border-red-900 text-red-500 hover:text-white px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-colors shadow-sm text-xs"><AlertTriangle size={14}/> Kosongkan Database</button>
                  </div>
                </div>
                
                {/* 4 FILTER SAKTI ADMIN (UKURAN LEBIH COMPACT) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <select value={adminRecapGuru} onChange={e => {setAdminRecapGuru(e.target.value); setAdminRecapMapel(''); setAdminRecapKelas(''); setAdminRecapToken('');}} className="w-full p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 outline-none font-bold text-white cursor-pointer focus:border-amber-500"><option value="">-- Semua Guru --</option>{availableRecapGurus.map(g => <option key={g}>{g}</option>)}</select>
                  <select value={adminRecapMapel} onChange={e => {setAdminRecapMapel(e.target.value); setAdminRecapKelas(''); setAdminRecapToken('');}} className="w-full p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 outline-none font-bold text-white cursor-pointer focus:border-amber-500"><option value="">-- Semua Mapel --</option>{availableRecapMapels.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={adminRecapKelas} onChange={e => {setAdminRecapKelas(e.target.value); setAdminRecapToken('');}} className="w-full p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 outline-none font-bold text-white cursor-pointer focus:border-amber-500"><option value="">-- Semua Kelas --</option>{availableRecapKelasList.map(k => <option key={k}>{k}</option>)}</select>
                  <select value={adminRecapToken} onChange={e => setAdminRecapToken(e.target.value)} className="w-full p-2.5 text-xs border border-amber-500/30 rounded-xl bg-amber-500/10 outline-none font-bold text-amber-500 cursor-pointer focus:border-amber-500"><option value="">-- Semua Token --</option>{availableRecapTokens.map(t => <option key={t}>{t}</option>)}</select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={() => { setAdminPrintMode('rekap'); setTimeout(() => window.print(), 300); }} className="w-full bg-blue-900/40 hover:bg-blue-600 border border-blue-800 text-blue-400 hover:text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all text-xs"><BarChart size={14}/> Cetak Daftar Nilai</button>
                  <button onClick={() => { setAdminPrintMode('berita_acara'); setTimeout(() => window.print(), 300); }} className="w-full bg-purple-900/40 hover:bg-purple-600 border border-purple-800 text-purple-400 hover:text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all text-xs"><FileText size={14}/> Berita Acara Ujian</button>
                  <button onClick={() => { setAdminPrintMode('daftar_hadir'); setTimeout(() => window.print(), 300); }} className="w-full bg-emerald-900/40 hover:bg-emerald-600 border border-emerald-800 text-emerald-400 hover:text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all text-xs"><Users size={14}/> Daftar Hadir Siswa</button>
                </div>
              </div>
              
              {/* === TAMPILAN KERTAS PRINT (REKAP NILAI) === */}
              <div className={`${adminPrintMode === 'rekap' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR NILAI UJIAN SISWA (MASTER)</h3>
                <p className="mb-4 text-sm font-bold">Guru Mapel: {adminRecapGuru || 'Semua'} <br/> Mata Pelajaran: {adminRecapMapel || 'Semua'} <br/> Kelas: {adminRecapKelas || 'Semua'} | Token Sesi: {adminRecapToken || 'Semua'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-2 px-3 w-12 text-center">No</th><th className="py-2 px-3">Nama Lengkap Siswa</th><th className="py-2 px-3 text-center">Kelas / Ruang</th><th className="py-2 px-3 text-center">Skor Akhir</th></tr></thead>
                  <tbody>
                    {filteredAdminLeaderboard.map((s, i) => (
                      <tr key={s?.id || i}>
                        <td className="py-2 px-3 text-center">{i+1}</td><td className="py-2 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-2 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-2 px-3 text-center font-black">{s?.score || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-12 text-center"><div className="w-64"><p>Simalungun, {new Date().toLocaleDateString('id-ID')}<br/>Administrator Pusat,</p><br/><br/><br/><p className="font-bold underline uppercase">Kepala Sekolah / Panitia Ujian</p></div></div>
              </div>

              {/* === TAMPILAN KERTAS PRINT (BERITA ACARA) === */}
              <div className={`${adminPrintMode === 'berita_acara' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-8 underline tracking-wide">BERITA ACARA PELAKSANAAN UJIAN CBT</h3>
                <div className="text-justify leading-loose font-medium text-sm">
                  <p>Pada hari ini _________ tanggal ____ bulan ________________ tahun 20___, di SMP/MTS Darma Pertiwi Bah Butong telah diselenggarakan Ujian Berbasis Komputer (CBT) untuk:</p>
                  <table className="w-full my-4 border-none !border-0">
                    <tbody className="border-none">
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Guru Mapel</td><td className="border-none !p-0">: {adminRecapGuru || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Mata Pelajaran</td><td className="border-none !p-0">: {adminRecapMapel || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Kelas / Token</td><td className="border-none !p-0">: {adminRecapKelas || '____'} / {adminRecapToken || '____'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Jumlah Peserta Terdaftar</td><td className="border-none !p-0">: {filteredAdminLeaderboard.length} Orang</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Hadir / Mengikuti Ujian</td><td className="border-none !p-0">: ______ Orang</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-4">Catatan selama pelaksanaan ujian:</p>
                  <div className="w-full h-24 border border-black mt-2 mb-8"></div>
                  <p>Demikian berita acara ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.</p>
                </div>
                <div className="flex justify-between mt-12 text-center">
                  <div className="w-64"><p>Pengawas Ruangan,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">_________________________</p><p className="text-xs">NIP. </p></div>
                  <div className="w-64"><p>Panitia Pelaksana,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">_________________________</p><p className="text-xs">NIP. </p></div>
                </div>
              </div>

              {/* === TAMPILAN KERTAS PRINT (DAFTAR HADIR) === */}
              <div className={`${adminPrintMode === 'daftar_hadir' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR HADIR PESERTA UJIAN (MASTER)</h3>
                <p className="mb-4 text-sm font-bold">Mata Pelajaran: {adminRecapMapel || '_________________'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Kelas: {adminRecapKelas || '____'} | Token: {adminRecapToken || '____'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-3 px-3 w-12 text-center">No</th><th className="py-3 px-3">Nama Lengkap Siswa</th><th className="py-3 px-3 text-center w-24">Kelas</th><th className="py-3 px-3 w-48 text-center">Tanda Tangan</th></tr></thead>
                  <tbody>
                    {filteredAdminLeaderboard.map((s, i) => (
                      <tr key={s?.id || i}><td className="py-3 px-3 text-center">{i+1}</td><td className="py-3 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-3 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-3 px-3"><span className="text-xs text-gray-400">{i+1}. </span></td></tr>
                    ))}
                    {[...Array(Math.max(0, 15 - filteredAdminLeaderboard.length))].map((_, i) => (
                      <tr key={`empty-${i}`}><td className="py-4"></td><td></td><td></td><td></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* === TAMPILAN UI TABEL NILAI ADMIN (SEBELUM DI PRINT) COMPACT === */}
              <div className="print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 p-3 rounded-t-xl border border-b-0 border-slate-800 gap-3">
                  <div className="text-xs font-bold text-slate-400">
                    Total Data: <span className="text-white bg-slate-800 px-2 py-0.5 rounded">{filteredAdminLeaderboard.length}</span> Siswa
                  </div>
                </div>

                {/* TABEL RESPONSIVE */}
                <div className="bg-slate-900 rounded-b-xl border border-slate-800 overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input type="checkbox" className="accent-amber-500 w-4 h-4 cursor-pointer rounded" 
                            onChange={handleSelectAllRecaps} 
                            checked={selectedRecaps.length === filteredAdminLeaderboard.length && filteredAdminLeaderboard.length > 0} 
                          />
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Identitas Siswa</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-center">Kelas</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Mapel & Guru</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-center">Token</th>
                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-center">Skor Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredAdminLeaderboard.map((s, i) => (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center">
                            <input type="checkbox" className="accent-amber-500 w-4 h-4 cursor-pointer rounded" 
                              checked={selectedRecaps.includes(s.id)} 
                              onChange={() => toggleSelectRecap(s.id)} 
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-black text-white text-sm truncate max-w-[180px]">{s.name}</p>
                            {s.isEssayGraded && <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 mt-0.5 inline-block">ESAI DINILAI</span>}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-300">{s.class}-{s.subKelas}</td>
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-amber-500">{s.mapel}</p>
                            <p className="text-[9px] text-slate-500 truncate max-w-[140px]">{s.teacherEmail}</p>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 text-[10px] bg-slate-950/50">{s.token}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-lg font-black text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-700 shadow-inner">{s.score}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAdminLeaderboard.length === 0 && (
                    <div className="text-center p-8 bg-slate-900 border-t border-slate-800 text-slate-500 text-xs font-medium">
                      Data rekap nilai pusat belum tersedia untuk filter ini.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL EDIT GURU */}
      {showEditGuruModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-black mb-5 text-white flex items-center gap-2"><UserCog className="text-amber-500" size={20}/> Modifikasi Data Personalia</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Nama Lengkap & Gelar</label><input required value={guruFormData.name} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-amber-500 text-sm font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Email Akun (Info Saja)</label><input disabled value={guruFormData.email} className="w-full p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed" /></div>
              <div className="flex gap-2 pt-3"><button type="button" onClick={() => setShowGuruModal(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold active:scale-95 transition-all">Batal</button><button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-sm font-black shadow-[0_0_10px_rgba(245,158,11,0.2)] active:scale-95 transition-all">Simpan Revisi</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH GURU MANUAL */}
      {showAddGuruModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-black mb-1 text-white flex items-center gap-2"><Plus className="text-amber-500" size={20}/> Registrasi Paksa</h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">Instruksi ini menyuntikkan data guru ke database pusat.</p>
            <form onSubmit={handleManualAddGuru} className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Nama Lengkap Guru</label><input required value={guruFormData.name} placeholder="Bpk. Suryanto Siregar" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-amber-500 text-sm font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Email Terdaftar</label><input required value={guruFormData.email} type="email" placeholder="suryanto@guru.com" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-amber-500 text-sm font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-2 pt-3"><button type="button" onClick={() => setShowAddGuruModal(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold active:scale-95 transition-colors">Batalkan</button><button type="submit" className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-sm font-black active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-colors">Suntik Data</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SOAL PUSAT V3 DENGAN PREVIEW */}
      {showEditSoalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-5 md:p-6 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 border-b border-slate-800 pb-3 gap-3">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Edit className="text-amber-500" size={20}/> Intervensi Soal Pusat
              </h2>
              <button type="button" onClick={() => setPreviewMode(!previewMode)} className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center ${previewMode ? 'bg-amber-500 text-black shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {previewMode ? <Edit size={14}/> : <Eye size={14}/>} {previewMode ? 'Kembali ke Editor' : 'Pratinjau Soal'}
              </button>
            </div>

            {previewMode ? (
              // --- MODE PRATINJAU SUPERADMIN ---
              <div className="p-4 sm:p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-800">
                  <div className="mb-3">
                     <span className="text-[10px] font-black bg-amber-500 text-black px-2 py-0.5 rounded">Format: {soalFormData.jenisSoal}</span>
                  </div>
                  {soalFormData.gambar && (
                    <img src={soalFormData.gambar} alt="Preview" className="mb-4 rounded-lg max-h-48 mx-auto object-cover border border-slate-700 shadow-sm" />
                  )}
                  {soalFormData.teksWacana && (
                      <div className="mb-3 p-3 bg-slate-950 border-l-2 border-slate-600 rounded-r-lg text-xs font-medium text-slate-400">
                         <Latex>{String(soalFormData.teksWacana)}</Latex>
                      </div>
                  )}
                  <div className="text-base font-bold text-white leading-relaxed break-words">
                    <Latex>{String(soalFormData.pertanyaan || 'Ketik pertanyaan untuk melihat pratinjau...')}</Latex>
                  </div>
                </div>
                
                {soalFormData.jenisSoal !== 'ESAI' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['A','B','C','D'].map(opt => {
                        const isKey = soalFormData.jenisSoal === 'PGK' ? (soalFormData.kunci && soalFormData.kunci.includes(opt)) : soalFormData.kunci === opt;
                        return (
                        <div key={opt} className={`p-4 rounded-xl border transition-all break-words flex items-start ${isKey ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-900'}`}>
                        <span className={`font-black mr-2 text-sm ${isKey ? 'text-amber-500' : 'text-slate-500'}`}>{opt}.</span>
                        <div className="flex-1 font-medium text-slate-300 text-sm"><Latex>{String(soalFormData[`opsi${opt}`] || ' ')}</Latex></div>
                        </div>
                    )})}
                    </div>
                )}
              </div>
            ) : (
              // --- MODE EDITOR SUPERADMIN ---
              <form onSubmit={handleUpdateSoal} className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="md:col-span-2">
                     <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">Jenis Soal</label>
                     <select value={soalFormData.jenisSoal} onChange={e => setSoalFormData({...soalFormData, jenisSoal: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-bold focus:border-amber-500 outline-none cursor-pointer">
                        <option value="PG">Pilihan Ganda (PG) Biasa</option>
                        <option value="PGK">Pilihan Ganda Kompleks (PGK)</option>
                        <option value="ESAI">Soal Esai</option>
                     </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">Mata Pelajaran</label>
                    <input required value={soalFormData.mapel} className="w-full p-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-bold focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, mapel: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">Tingkat</label>
                    <input required value={soalFormData.kelas} className="w-full p-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-bold text-center focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, kelas: e.target.value})} />
                  </div>
                </div>

                <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-blue-400 uppercase flex items-center gap-1.5"><FileText size={14}/> Wacana / Teks Panjang (Opsional)</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <input value={soalFormData.kodeWacana} onChange={e => setSoalFormData({...soalFormData, kodeWacana: e.target.value})} placeholder="Kode Wacana" className="w-full p-2.5 border border-slate-700 rounded-lg text-xs font-bold bg-slate-900 text-white outline-none focus:border-blue-500" />
                        </div>
                        <div className="md:col-span-3">
                            <textarea value={soalFormData.teksWacana} onChange={e => setSoalFormData({...soalFormData, teksWacana: e.target.value})} placeholder="Ketik teks wacana di sini..." className="w-full p-2.5 border border-slate-700 rounded-lg text-xs font-medium bg-slate-900 text-white h-10 min-h-[40px] outline-none focus:border-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-widest">Link URL Gambar (Opsional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-3 text-slate-500" size={16}/>
                    <input value={soalFormData.gambar} placeholder="Paste link gambar..." className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl font-medium text-xs focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, gambar: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between tracking-widest">
                    <span>Teks Pertanyaan Utama</span>
                    <span className="text-[9px] bg-slate-800 text-amber-500 px-1.5 py-0.5 rounded font-black">Math = $...$</span>
                  </label>
                  <textarea required value={soalFormData.pertanyaan} className="w-full p-4 bg-slate-950 border border-slate-800 text-white rounded-xl min-h-[100px] text-sm leading-relaxed focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, pertanyaan: e.target.value})} />
                </div>

                {soalFormData.jenisSoal !== 'ESAI' && (
                    <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-widest">Opsi Jawaban & Kunci</label>
                    {soalFormData.jenisSoal === 'PGK' ? (
                        <div className="bg-orange-950/40 border border-orange-900/50 p-2.5 rounded-lg mb-2 text-[10px] font-bold text-orange-400">
                            Mode PGK: Centang kotak di samping kiri opsi untuk menjadikannya Kunci Jawaban.
                        </div>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A','B','C','D'].map(o => {
                           const isChecked = soalFormData.jenisSoal === 'PGK' ? (soalFormData.kunci && soalFormData.kunci.includes(o)) : false;
                           return (
                        <div key={o} className="flex gap-2 items-center">
                            {soalFormData.jenisSoal === 'PGK' && (
                                <input type="checkbox" checked={isChecked} onChange={() => handlePGKKeyToggle(o)} className="w-5 h-5 rounded cursor-pointer accent-amber-500" />
                            )}
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-3 font-black text-amber-500 text-xs">{o}.</span>
                                <input required value={soalFormData[`opsi${o}`]} className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, [`opsi${o}`]: e.target.value})} />
                            </div>
                        </div>
                        )})}
                    </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-3 border-t border-slate-800 mt-2">
                  {soalFormData.jenisSoal === 'PG' ? (
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-widest">Kunci Jawaban</label>
                        <select value={soalFormData.kunci} className="w-full p-3 border border-amber-500/50 bg-amber-500/10 text-amber-500 text-xs font-black rounded-xl outline-none cursor-pointer" onChange={e => setSoalFormData({...soalFormData, kunci: e.target.value})}>
                        <option value="A">Opsi A</option><option value="B">Opsi B</option><option value="C">Opsi C</option><option value="D">Opsi D</option>
                        </select>
                    </div>
                  ) : <div></div>}
                  <div className="flex gap-2 pt-4">
                    <button type="button" onClick={() => { setShowSoalModal(false); setPreviewMode(false); }} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-colors">Tutup</button>
                    <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-colors">Terapkan Revisi</button>
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
