// src/pages/teacher/SchoolAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth'; // Tambah signOut
import { useNavigate } from 'react-router-dom'; // Tambah useNavigate
import * as XLSX from 'xlsx';
import { Users, ClipboardList, LogOut, Plus, Trash2, Edit, CheckCircle, XCircle, KeyRound, Menu, X, ShieldCheck, UserCog, BarChart, FileText, Download, Loader2 } from 'lucide-react';

export default function SchoolAdminDashboard() {
  const navigate = useNavigate();
  const auth = getAuth();
  
  const [adminProfile, setAdminProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); // State loading untuk mencegah Akses Ditolak prematur

  const [activeTab, setActiveTab] = useState('guru');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [data, setData] = useState({ users: [], lead: [] });
  
  // States Modal Guru
  const [showAddGuruModal, setShowAddGuruModal] = useState(false);
  const [showEditGuruModal, setShowEditGuruModal] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  const [guruForm, setGuruForm] = useState({ name: '', email: '', password: '' });

  // States Filter Rekap
  const [recapGuru, setRecapGuru] = useState('');
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [printMode, setPrintMode] = useState('rekap');

  // 1. Tarik Data Profil Admin TU Terlebih Dahulu
  useEffect(() => {
    if (auth.currentUser) {
      const userRef = ref(db, `users/${auth.currentUser.uid}`);
      onValue(userRef, (snap) => {
        if (snap.exists()) {
          setAdminProfile(snap.val());
        }
        setIsLoadingProfile(false);
      });
    } else {
      setIsLoadingProfile(false);
    }
  }, [auth.currentUser]);

  const schoolId = adminProfile?.schoolId || '';
  const schoolName = adminProfile?.name || 'Admin Sekolah';

  // 2. Tarik Data Global Setelah schoolId Didapatkan
  useEffect(() => {
    if (!schoolId) return;

    const fetchData = (path, key) => onValue(ref(db, path), snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        setData(prev => ({ ...prev, [key]: Object.keys(val).map(k => ({ ...val[k], id: k })) }));
      } else {
        setData(prev => ({ ...prev, [key]: [] }));
      }
    });

    fetchData('users', 'users');
    fetchData('leaderboard', 'lead');
  }, [schoolId]);

  // --- FUNGSI LOGOUT INTERNAL ---
  const handleLogout = () => {
    signOut(auth).then(() => {
      localStorage.clear();
      navigate('/login');
    }).catch((error) => {
      alert("Gagal keluar: " + error.message);
    });
  };

  // --- FILTER LOGIC KHUSUS SEKOLAH INI ---
  const schoolTeachers = data.users.filter(u => u.schoolId === schoolId && u.role === 'teacher');
  const pendingTeachers = schoolTeachers.filter(u => u.status === 'pending');
  const activeTeachers = schoolTeachers.filter(u => u.status !== 'pending');
  
  const schoolTeacherEmails = schoolTeachers.map(t => t.email);
  const schoolLeaderboard = data.lead.filter(l => schoolTeacherEmails.includes(l.teacherEmail));

  // --- FILTER DROPDOWN REKAP ---
  const availableGurus = [...new Set(schoolLeaderboard.map(s => s?.teacherEmail).filter(Boolean))];
  const availableMapels = [...new Set(schoolLeaderboard.filter(s => recapGuru === '' || s.teacherEmail === recapGuru).map(s => s?.mapel).filter(Boolean))];
  const availableKelas = [...new Set(schoolLeaderboard.filter(s => (recapGuru === '' || s.teacherEmail === recapGuru) && (recapMapel === '' || s.mapel === recapMapel)).map(s => s?.class).filter(Boolean))];

  const filteredLeaderboard = schoolLeaderboard.filter(s => 
    (recapGuru === '' || s?.teacherEmail === recapGuru) && 
    (recapMapel === '' || s?.mapel === recapMapel) && 
    (recapKelas === '' || s?.class === recapKelas)
  ).sort((a, b) => b.score - a.score);

  // --- MANAJEMEN GURU ---
  const handleAddGuru = async (e) => {
    e.preventDefault();
    try {
      const newAuth = getAuth();
      const userCred = await createUserWithEmailAndPassword(newAuth, guruForm.email, guruForm.password);
      
      await set(ref(db, `users/${userCred.user.uid}`), {
        name: guruForm.name,
        email: guruForm.email,
        role: 'teacher',
        schoolId: schoolId,
        status: 'active',
        createdAt: Date.now()
      });

      alert("Akun Guru berhasil dibuat!");
      setShowAddGuruModal(false);
      setGuruForm({ name: '', email: '', password: '' });
    } catch (err) {
      alert("Gagal membuat guru: " + err.message);
    }
  };

  const handleUpdateGuru = (e) => {
    e.preventDefault();
    update(ref(db, `users/${editGuruId}`), { name: guruForm.name });
    alert("Data Guru Diperbarui!");
    setShowEditGuruModal(false);
  };

  const approveTeacher = (id) => update(ref(db, `users/${id}`), { status: 'active' });
  const rejectTeacher = (id) => { if(window.confirm("Tolak & Hapus pendaftar ini?")) remove(ref(db, `users/${id}`)); };
  const deleteTeacher = (id) => { if(window.confirm("Hapus akun guru ini dari sekolah?")) remove(ref(db, `users/${id}`)); };
  const handleResetPassword = (email) => {
    if (window.confirm(`Kirim instruksi reset kata sandi ke email: ${email}?`)) {
      sendPasswordResetEmail(auth, email).then(() => alert("Link Reset Sandi Berhasil Dikirim!")).catch((err) => alert("Gagal: " + err.message));
    }
  };

  const downloadRecap = () => {
    if (filteredLeaderboard.length === 0) return alert("Belum ada data nilai.");
    try {
      const ws = XLSX.utils.json_to_sheet(filteredLeaderboard);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Sekolah");
      XLSX.writeFile(wb, `REKAP_${schoolId.toUpperCase()}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch(err) { alert("Gagal mengunduh: " + err.message); }
  };

  const NavItem = ({ tab, icon: Icon, label, badge }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex justify-between items-center p-3.5 rounded-xl transition-all ${activeTab === tab ? 'bg-blue-600 text-white font-black shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold'}`}>
      <div className="flex items-center gap-3"><Icon size={18}/> <span className="text-sm">{label}</span></div>
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  const OfficialHeader = () => (
    <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
      <h1 className="text-xl font-black uppercase tracking-widest text-black">ADMINISTRASI SEKOLAH</h1>
      <h2 className="text-lg font-black uppercase tracking-widest text-black mt-1">KODE INSTANSI: {schoolId.toUpperCase()}</h2>
      <p className="mt-2 text-xs font-bold text-gray-800">Dokumen Resmi Laporan Nilai CBT Bersama</p>
    </div>
  );

  // Mencegah halaman "Akses Ditolak" muncul sebelum Firebase selesai memuat profil
  if (isLoadingProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
         <Loader2 size={40} className="text-blue-500 animate-spin" />
         <p className="text-sm font-bold text-slate-500 tracking-widest uppercase animate-pulse">Memverifikasi Instansi...</p>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
         <ShieldCheck size={60} className="text-slate-300 mb-4" />
         <p className="text-xl font-black text-slate-700 mb-2">Akses Ditolak</p>
         <p className="text-sm font-bold text-slate-500 max-w-md">Akun Anda tidak terikat dengan instansi sekolah mana pun. Silakan hubungi Master Administrator.</p>
         <button onClick={handleLogout} className="mt-6 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-slate-700 transition-colors">Kembali ke Login</button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <style>{`
        @media print { 
          @page { margin: 1cm; size: portrait; } 
          html, body, #root { height: auto !important; overflow: visible !important; background: white !important; -webkit-print-color-adjust: exact; margin: 0; }
          .h-screen, .min-h-screen, .overflow-hidden, .overflow-y-auto, main, .flex-1 { height: auto !important; min-height: auto !important; overflow: visible !important; display: block !important; position: static !important; } 
          aside, header, button, select, input, .print\\:hidden { display: none !important; } 
          .print\\:block { display: block !important; } 
          table { width: 100% !important; border-collapse: collapse; margin-top: 10px; border: 1.5px solid black !important; page-break-inside: auto; } 
          thead { display: table-header-group; } 
          tr { page-break-inside: avoid; page-break-after: auto; } 
          th, td { border: 1px solid #000 !important; padding: 6px 8px !important; color: black !important; font-size: 11px !important; line-height: 1.3; } 
          th { background-color: #f0f0f0 !important; font-weight: bold; text-transform: uppercase; } 
        }
      `}</style>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center"><h1 className="text-lg font-black text-blue-700 flex gap-2 items-center tracking-tight"><ShieldCheck size={24} className="text-blue-500"/> TATA USAHA</h1><button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button></div>
        <div className="p-4 mx-3 mt-3 mb-1 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xl shrink-0 uppercase">{schoolName.charAt(0)}</div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">INSTANSI: {schoolId}</p>
            <p className="text-xs font-bold truncate text-slate-800">{schoolName}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <NavItem tab="guru" icon={Users} label="Data Guru Sekolah" badge={pendingTeachers.length} />
          <NavItem tab="recap" icon={ClipboardList} label="Rekapitulasi Nilai" />
        </nav>
        <div className="p-4 border-t border-slate-100">
           {/* TOMBOL KELUAR YANG SUDAH DIJAHIT */}
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-colors">
               <LogOut size={16}/> Logout
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 print:hidden shadow-sm">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 bg-slate-100 rounded-lg text-blue-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Dashboard Operator</h2>
          </div>
          <div className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-blue-700 uppercase">{schoolId} Aktif</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* TAB MANAJEMEN GURU KHUSUS SEKOLAH INI */}
          {activeTab === 'guru' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Personalia Guru Sekolah</h3>
                    <p className="text-sm text-slate-500 mt-1">Kelola staf pengajar yang terdaftar di instansi Anda.</p>
                 </div>
                 <button onClick={() => { setGuruForm({name:'', email:'', password:''}); setShowAddGuruModal(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 shadow-md active:scale-95 transition-all"><Plus size={18}/> Tambah Guru Baru</button>
              </div>

              {pendingTeachers.length > 0 && (
                <div className="bg-orange-50 rounded-2xl border border-orange-200 overflow-hidden shadow-sm p-5 space-y-4">
                  <div className="font-black text-orange-700 flex items-center gap-2"><Users size={20}/> Menunggu Persetujuan ({pendingTeachers.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {pendingTeachers.map(t => (
                      <div key={t.id} className="bg-white p-4 rounded-xl border border-orange-200 flex flex-col justify-between gap-3 shadow-sm">
                        <div><p className="font-black text-slate-800 text-sm">{t?.name || 'Tanpa Nama'}</p><p className="font-medium text-slate-500 text-xs mt-0.5">{t?.email || '-'}</p></div>
                        <div className="flex gap-2 w-full border-t border-slate-100 pt-3">
                          <button onClick={() => approveTeacher(t.id)} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded-lg text-xs font-bold transition-all flex justify-center"><CheckCircle size={16}/></button>
                          <button onClick={() => rejectTeacher(t.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-xs font-bold transition-all flex justify-center"><XCircle size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr><th className="py-4 px-6 w-16 text-center">No</th><th className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Nama Guru</th><th className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Email Login</th><th className="py-4 px-6 text-center font-bold uppercase tracking-wider text-xs w-48">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTeachers.map((t, i) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6 text-center font-bold text-slate-500">{i + 1}</td>
                        <td className="py-4 px-6 font-black text-slate-800">{t?.name}</td>
                        <td className="py-4 px-6 text-slate-500 font-medium">{t?.email}</td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => { setEditGuruId(t.id); setGuruForm({name: t.name, email: t.email}); setShowEditGuruModal(true); }} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 p-2 rounded-lg transition-colors"><UserCog size={16}/></button>
                            <button onClick={() => handleResetPassword(t.email)} className="text-slate-400 hover:text-amber-500 bg-slate-50 hover:bg-amber-50 border border-slate-200 p-2 rounded-lg transition-colors"><KeyRound size={16}/></button>
                            <button onClick={() => deleteTeacher(t.id)} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeTeachers.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Belum ada guru yang terdaftar di sekolah ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB REKAP NILAI SEKOLAH INI */}
          {activeTab === 'recap' && (
            <div className="space-y-5 max-w-7xl mx-auto print:max-w-full animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600"/> Laporan Nilai Sekolah</h3>
                  <button onClick={downloadRecap} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-200 transition-colors"><Download size={16}/> Export Excel</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select value={recapGuru} onChange={e => {setRecapGuru(e.target.value); setRecapMapel(''); setRecapKelas('');}} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none text-sm font-bold text-slate-700"><option value="">-- Semua Guru --</option>{availableGurus.map(g => <option key={g}>{g}</option>)}</select>
                  <select value={recapMapel} onChange={e => {setRecapMapel(e.target.value); setRecapKelas('');}} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none text-sm font-bold text-slate-700"><option value="">-- Semua Mapel --</option>{availableMapels.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={recapKelas} onChange={e => setRecapKelas(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none text-sm font-bold text-slate-700"><option value="">-- Semua Kelas --</option>{availableKelas.map(k => <option key={k}>{k}</option>)}</select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                  <button onClick={() => { setPrintMode('rekap'); setTimeout(() => window.print(), 300); }} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-sm"><BarChart size={16}/> Cetak Nilai</button>
                  <button onClick={() => { setPrintMode('berita_acara'); setTimeout(() => window.print(), 300); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-sm"><FileText size={16}/> Berita Acara</button>
                  <button onClick={() => { setPrintMode('daftar_hadir'); setTimeout(() => window.print(), 300); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-sm"><Users size={16}/> Daftar Hadir</button>
                </div>
              </div>

              {/* TAMPILAN PRINT BERDASARKAN MODE */}
              <div className={`${printMode === 'rekap' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR NILAI UJIAN</h3>
                <p className="mb-4 text-sm font-bold">Instansi: {schoolId.toUpperCase()} <br/> Guru Mapel: {recapGuru || 'Semua'} | Mapel: {recapMapel || 'Semua'} | Kelas: {recapKelas || 'Semua'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-2 px-3 text-center">No</th><th className="py-2 px-3">Nama Siswa</th><th className="py-2 px-3 text-center">Kelas</th><th className="py-2 px-3">Mapel</th><th className="py-2 px-3 text-center">Nilai Akhir</th></tr></thead>
                  <tbody>
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s.id}><td className="py-2 px-3 text-center">{i+1}</td><td className="py-2 px-3 font-bold uppercase">{s.name}</td><td className="py-2 px-3 text-center">{s.class}-{s.subKelas}</td><td className="py-2 px-3">{s.mapel}</td><td className="py-2 px-3 text-center font-black">{s.score}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={`${printMode === 'berita_acara' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-8 underline tracking-wide">BERITA ACARA UJIAN (CBT)</h3>
                <div className="text-justify leading-loose font-medium text-sm">
                  <table className="w-full my-4 border-none !border-0">
                    <tbody className="border-none">
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Guru Mapel</td><td className="border-none !p-0">: {recapGuru || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Mata Pelajaran</td><td className="border-none !p-0">: {recapMapel || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Kelas Terjadwal</td><td className="border-none !p-0">: {recapKelas || '____'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Siswa Ujian / Hadir</td><td className="border-none !p-0">: {filteredLeaderboard.length} Orang / ______ Orang</td></tr>
                    </tbody>
                  </table>
                  <div className="w-full h-24 border border-black mt-6 mb-8"></div>
                </div>
                <div className="flex justify-between mt-12 text-center">
                  <div className="w-64"><p>Guru Mata Pelajaran,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">_________________________</p></div>
                  <div className="w-64"><p>Kepala / Admin Tata Usaha,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">{schoolName}</p></div>
                </div>
              </div>

              <div className={`${printMode === 'daftar_hadir' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR HADIR UJIAN</h3>
                <p className="mb-4 text-sm font-bold">Mapel: {recapMapel || '___________'} | Kelas: {recapKelas || '____'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-3 px-3 text-center w-12">No</th><th className="py-3 px-3">Nama Lengkap</th><th className="py-3 px-3 text-center w-24">Kelas</th><th className="py-3 px-3 w-48 text-center">TTD</th></tr></thead>
                  <tbody>
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s.id}><td className="py-3 px-3 text-center">{i+1}</td><td className="py-3 px-3 font-bold uppercase">{s.name}</td><td className="py-3 px-3 text-center">{s.class}-{s.subKelas}</td><td className="py-3 px-3 text-slate-400 text-xs">{i+1}.</td></tr>
                    ))}
                    {[...Array(Math.max(0, 15 - filteredLeaderboard.length))].map((_, i) => (<tr key={`e-${i}`}><td className="py-4"></td><td></td><td></td><td></td></tr>))}
                  </tbody>
                </table>
              </div>

              {/* UI TABEL REKAP BROWSER */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm print:hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr><th className="py-4 px-4 text-center">No</th><th className="py-4 px-4 font-bold uppercase tracking-wider text-xs">Siswa</th><th className="py-4 px-4 text-center font-bold uppercase tracking-wider text-xs">Kelas</th><th className="py-4 px-4 font-bold uppercase tracking-wider text-xs">Mapel & Guru</th><th className="py-4 px-4 text-center font-bold uppercase tracking-wider text-xs">Skor</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{i+1}</td>
                        <td className="py-3 px-4"><p className="font-black text-slate-800">{s.name}</p></td>
                        <td className="py-3 px-4 text-center font-bold text-slate-600">{s.class}-{s.subKelas}</td>
                        <td className="py-3 px-4"><p className="font-bold text-blue-600">{s.mapel}</p><p className="text-[10px] text-slate-500">{s.teacherEmail}</p></td>
                        <td className="py-3 px-4 text-center"><span className="text-base font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{s.score}</span></td>
                      </tr>
                    ))}
                    {filteredLeaderboard.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">Tidak ada rekap nilai untuk filter ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL TAMBAH GURU */}
      {showAddGuruModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2"><Plus className="text-blue-600"/> Daftarkan Guru Baru</h2>
            <form onSubmit={handleAddGuru} className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Lengkap & Gelar</label><input required value={guruForm.name} onChange={e => setGuruForm({...guruForm, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="Bpk. Budi S.Pd" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">Email Akun (Login)</label><input type="email" required value={guruForm.email} onChange={e => setGuruForm({...guruForm, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="budi@guru.com" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">Password Sementara</label><input type="password" required value={guruForm.password} onChange={e => setGuruForm({...guruForm, password: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="Minimal 6 Karakter" /></div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowAddGuruModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Batal</button><button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors">Buat Akun Guru</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT GURU */}
      {showEditGuruModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2"><UserCog className="text-blue-600"/> Edit Nama Guru</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Lengkap & Gelar</label><input required value={guruForm.name} onChange={e => setGuruForm({...guruForm, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">Email Akun (Info Saja)</label><input disabled value={guruForm.email} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500" /></div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowEditGuruModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Batal</button><button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors">Simpan Revisi</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}