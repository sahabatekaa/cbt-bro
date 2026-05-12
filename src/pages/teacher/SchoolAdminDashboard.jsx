// src/pages/teacher/SchoolAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db, getTenantPath } from '../../config/firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx'; 
import { Users, LogOut, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, AlertTriangle, Menu, X, ClipboardList, BarChart, FileText, Download, UserCog, KeyRound, Building } from 'lucide-react';

export default function SchoolAdminDashboard({ onLogout }) {
  const { userData, tenantData } = useAuth();
  // Karena ini SaaS, kita ambil schoolId dari data user yang sedang login
  const schoolId = userData?.schoolId || 'default-school';
  const schoolName = tenantData?.schoolName || 'YAYASAN PENDIDIKAN';

  const [activeTab, setActiveTab] = useState('guru');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data Sekolah (Tenant-Specific)
  const [teachers, setTeachers] = useState([]);
  const [recapData, setRecapData] = useState([]);
  
  // Filter Rekap Nilai
  const [adminRecapGuru, setAdminRecapGuru] = useState('');
  const [adminRecapMapel, setAdminRecapMapel] = useState('');
  const [adminRecapKelas, setAdminRecapKelas] = useState('');
  const [selectedRecaps, setSelectedRecaps] = useState([]);
  const [adminPrintMode, setAdminPrintMode] = useState('rekap');

  // Tarik Data Terisolasi Khusus Sekolah Ini Saja
  useEffect(() => {
    if (!schoolId) return;

    // Ambil Data Guru Khusus Sekolah Ini
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snap) => {
      if (snap.exists()) {
        const allUsers = snap.val();
        const schoolTeachers = Object.keys(allUsers)
          .map(k => ({ id: k, ...allUsers[k] }))
          .filter(u => u.schoolId === schoolId && u.role === 'teacher');
        setTeachers(schoolTeachers);
      } else setTeachers([]);
    });

    // Ambil Data Rekap Nilai Khusus Sekolah Ini
    const recapRef = ref(db, getTenantPath(schoolId, 'leaderboard'));
    const unsubRecap = onValue(recapRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setRecapData(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else setRecapData([]);
    });

    return () => { unsubUsers(); unsubRecap(); };
  }, [schoolId]);

  const pendingTeachers = teachers.filter(u => u.status === 'pending');
  const activeTeachers = teachers.filter(u => u.status === 'active');

  // ==========================================
  // LOGIKA MANAJEMEN GURU SEKOLAH
  // ==========================================
  const approveTeacher = (id) => update(ref(db, `users/${id}`), { status: 'active' });
  const rejectTeacher = (id) => { if(window.confirm("Tolak & Hapus pendaftar ini?")) remove(ref(db, `users/${id}`)); };
  const deleteTeacher = (id) => { 
    if(window.confirm("PERINGATAN!\nHapus akun guru ini secara permanen dari sistem sekolah?")) {
        remove(ref(db, `users/${id}`)); 
    }
  };

  // ==========================================
  // LOGIKA REKAP NILAI & FILTER
  // ==========================================
  const availableRecapGurus = [...new Set(recapData.map(s => s?.teacherEmail).filter(Boolean))];
  const availableRecapMapels = [...new Set(recapData.filter(s => adminRecapGuru === '' || s?.teacherEmail === adminRecapGuru).map(s => s?.mapel).filter(Boolean))];
  const availableRecapKelasList = [...new Set(recapData.filter(s => (adminRecapGuru === '' || s?.teacherEmail === adminRecapGuru) && (adminRecapMapel === '' || s?.mapel === adminRecapMapel)).map(s => s?.class).filter(Boolean))];

  const filteredRecap = recapData.filter(s => 
    (adminRecapGuru === '' || (s?.teacherEmail || '') === adminRecapGuru) && 
    (adminRecapMapel === '' || (s?.mapel || '') === adminRecapMapel) && 
    (adminRecapKelas === '' || (s?.class || '') === adminRecapKelas)
  ).sort((a,b) => b.score - a.score);

  // === FITUR HAPUS BANYAK (SOP KEAMANAN KETAT) ===
  const toggleSelectRecap = (id) => setSelectedRecaps(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const handleSelectAllRecaps = (e) => e.target.checked ? setSelectedRecaps(filteredRecap.map(s => s.id)) : setSelectedRecaps([]);

  const handleBatchDeleteRecaps = async () => {
    if (selectedRecaps.length === 0) return;
    const konfirmasi = window.prompt(`🚨 HAPUS BANYAK DATA:\nAnda akan menghapus ${selectedRecaps.length} data nilai terpilih secara permanen!\n\nKetik kata 'HAPUS' (huruf besar) untuk melanjutkan:`);
    if (konfirmasi === 'HAPUS') {
      try {
        await Promise.all(selectedRecaps.map(id => remove(ref(db, getTenantPath(schoolId, `leaderboard/${id}`)))));
        setSelectedRecaps([]);
        alert("Data terpilih berhasil dihancurkan!");
      } catch (err) { alert("Gagal menghapus: " + err.message); }
    } else if (konfirmasi !== null) {
      alert("❌ Dibatalkan: Kata konfirmasi salah.");
    }
  };

  const resetRekapNilai = () => { 
    const konfirmasi = window.prompt("🚨 KENDALI ADMIN SEKOLAH!\nTindakan ini akan MENGHAPUS PERMANEN SELURUH NILAI di yayasan ini.\n\nKetik kata 'KOSONGKAN' di bawah ini untuk melanjutkan:");
    if (konfirmasi === "KOSONGKAN") { 
      remove(ref(db, getTenantPath(schoolId, 'leaderboard'))); 
      alert("Database Nilai berhasil dikosongkan."); 
      setSelectedRecaps([]);
    } else if (konfirmasi !== null) {
      alert("❌ Dibatalkan: Kata sandi konfirmasi salah.");
    }
  };

  const downloadMasterRecap = () => {
    if (recapData.length === 0) return alert("Belum ada data nilai.");
    try {
      const ws = XLSX.utils.json_to_sheet(recapData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Sekolah");
      XLSX.writeFile(wb, `REKAP_${schoolName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch(err) { alert("Gagal mengunduh rekap: " + err.message); }
  };

  const NavItem = ({ tab, icon: Icon, label, badge }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex justify-between items-center p-3 rounded-xl transition-all ${activeTab === tab ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white font-bold'}`}>
      <div className="flex items-center gap-3"><Icon size={18}/> <span className="text-sm">{label}</span></div>
      {badge > 0 && <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">{badge}</span>}
    </button>
  );

  const OfficialHeader = () => (
    <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
      <h1 className="text-xl font-black uppercase tracking-widest text-black">{schoolName}</h1>
      <h2 className="text-lg font-black uppercase tracking-widest text-black mt-1">SDIT & PAUD/TK IT DARMA PERTIWI</h2>
      <p className="mt-2 text-xs font-bold text-gray-800">Dokumen Resmi Administrasi Ujian Berbasis Komputer (CBT)</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-200">
      {/* CSS KHUSUS PRINT - MENGHANCURKAN BATAS LAYAR */}
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
          .shadow-sm, .shadow-md, .shadow-xl { box-shadow: none !important; }
        }
      `}</style>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-black border-r border-slate-800 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h1 className="text-xl font-black text-white flex gap-2 items-center tracking-widest"><Building className="text-amber-500" size={24}/> SEKOLAH</h1>
          <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
        </div>
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-black">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">PANEL ADMIN IT</p>
          <p className="text-xs font-bold truncate text-white uppercase">{schoolName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem tab="guru" icon={Users} label="Manajemen Guru" badge={pendingTeachers.length} />
          <NavItem tab="recap" icon={ClipboardList} label="Rekap Nilai Global" />
        </nav>
        <div className="p-3"><button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-950/50 hover:bg-red-900 border border-red-900 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-colors shadow-lg"><LogOut size={16}/> Keluar Akun</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0f1c]">
        <header className="bg-slate-900 border-b border-slate-800 p-3 lg:p-4 flex justify-between items-center shadow-lg z-10 print:hidden">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 bg-slate-800 rounded-lg text-amber-500" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
            <div className="hidden md:block">
              <h2 className="text-xs font-black text-white leading-tight tracking-widest uppercase">{schoolName}</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">SISTEM TERISOLASI</p>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* TAB MANAJEMEN GURU */}
          {activeTab === 'guru' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
              <h3 className="text-xl font-black text-white flex items-center gap-2"><Users className="text-amber-500" size={20}/> Personalia Instansi</h3>
              
              {pendingTeachers.length > 0 && (
                <div className="bg-orange-950/30 rounded-2xl border border-orange-900/50 overflow-hidden shadow-sm p-4 space-y-3">
                  <div className="font-black text-orange-500 text-sm flex items-center gap-2 border-b border-orange-900/50 pb-2"><ShieldAlert size={18}/> Menunggu Persetujuan ({pendingTeachers.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {pendingTeachers.map(t => (
                      <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-orange-900/30 flex flex-col justify-between gap-3 shadow-sm">
                        <div><p className="font-black text-white text-sm">{t?.name || 'Tanpa Nama'}</p><p className="font-medium text-slate-400 text-xs mt-0.5">{t?.email}</p></div>
                        <div className="flex gap-2 w-full border-t border-slate-800 pt-3">
                          <button onClick={() => approveTeacher(t.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold active:scale-95"><CheckCircle size={16} className="mx-auto"/></button>
                          <button onClick={() => rejectTeacher(t.id)} className="flex-1 bg-slate-900 border border-red-900/50 text-red-500 hover:bg-red-950 py-2 rounded-lg text-xs font-bold active:scale-95"><XCircle size={16} className="mx-auto"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto shadow-lg">
                <table className="w-full text-left text-sm min-w-[700px] whitespace-nowrap">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-4 px-6 w-16 text-center font-bold uppercase text-xs">No</th>
                      <th className="py-4 px-6 font-bold uppercase text-xs">Nama Guru</th>
                      <th className="py-4 px-6 font-bold uppercase text-xs">Email Akun</th>
                      <th className="py-4 px-6 text-center font-bold uppercase text-xs w-32">Kontrol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {activeTeachers.map((t, i) => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="py-4 px-6 text-center font-bold text-slate-500">{i + 1}</td>
                        <td className="py-4 px-6 font-black text-white">{t?.name}</td>
                        <td className="py-4 px-6 text-slate-400 text-sm">{t?.email}</td>
                        <td className="py-4 px-6 text-center">
                          <button onClick={() => deleteTeacher(t.id)} title="Hapus Guru" className="text-slate-400 hover:text-red-500 bg-slate-800/50 hover:bg-red-950/30 p-2 rounded-lg transition-all active:scale-95 border border-slate-700/50"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {activeTeachers.length === 0 && <tr><td colSpan="4" className="text-center p-8 text-slate-500">Belum ada Guru yang disetujui.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB REKAP NILAI SEKOLAH */}
          {activeTab === 'recap' && (
            <div className="space-y-4 max-w-7xl mx-auto print:max-w-full animate-in fade-in duration-300">
              <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3 mb-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2"><ClipboardList className="text-amber-500" size={18}/> Rekapitulasi Nilai Instansi</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                    {selectedRecaps.length > 0 && (
                      <button onClick={handleBatchDeleteRecaps} className="flex-1 md:flex-none bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 active:scale-95 shadow-sm text-xs"><Trash2 size={14}/> Hapus {selectedRecaps.length} Terpilih</button>
                    )}
                    <button onClick={downloadMasterRecap} className="bg-emerald-900/40 hover:bg-emerald-600 border border-emerald-800 text-emerald-400 hover:text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 active:scale-95 text-xs"><Download size={14}/> Download Excel</button>
                    <button onClick={resetRekapNilai} className="bg-slate-950 border border-slate-800 text-red-500 hover:bg-red-950 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 active:scale-95 text-xs"><AlertTriangle size={14}/> Kosongkan</button>
                  </div>
                </div>
                
                {/* 3 FILTER SEKOLAH */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <select value={adminRecapGuru} onChange={e => {setAdminRecapGuru(e.target.value); setAdminRecapMapel(''); setAdminRecapKelas('');}} className="w-full p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none"><option value="">-- Semua Guru --</option>{availableRecapGurus.map(g => <option key={g}>{g}</option>)}</select>
                  <select value={adminRecapMapel} onChange={e => {setAdminRecapMapel(e.target.value); setAdminRecapKelas('');}} className="w-full p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none"><option value="">-- Semua Mapel --</option>{availableRecapMapels.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={adminRecapKelas} onChange={e => setAdminRecapKelas(e.target.value)} className="w-full p-2.5 text-xs border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none"><option value="">-- Semua Kelas --</option>{availableRecapKelasList.map(k => <option key={k}>{k}</option>)}</select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => { setAdminPrintMode('rekap'); setTimeout(() => window.print(), 300); }} className="w-full bg-blue-900/40 hover:bg-blue-600 border border-blue-800 text-blue-400 hover:text-white py-2.5 rounded-xl font-black flex items-center justify-center gap-2 text-xs"><BarChart size={14}/> Cetak Daftar Nilai</button>
                  <button onClick={() => { setAdminPrintMode('berita_acara'); setTimeout(() => window.print(), 300); }} className="w-full bg-purple-900/40 hover:bg-purple-600 border border-purple-800 text-purple-400 hover:text-white py-2.5 rounded-xl font-black flex items-center justify-center gap-2 text-xs"><FileText size={14}/> Berita Acara</button>
                </div>
              </div>
              
              {/* === TAMPILAN KERTAS PRINT (REKAP NILAI) === */}
              <div className={`${adminPrintMode === 'rekap' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR NILAI UJIAN SISWA</h3>
                <p className="mb-4 text-sm font-bold">Guru Mapel: {adminRecapGuru || 'Semua'} <br/> Mata Pelajaran: {adminRecapMapel || 'Semua'} <br/> Kelas: {adminRecapKelas || 'Semua'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-2 px-3 w-12 text-center">No</th><th className="py-2 px-3">Nama Lengkap Siswa</th><th className="py-2 px-3 text-center">Kelas</th><th className="py-2 px-3 text-center">Skor Akhir</th></tr></thead>
                  <tbody>
                    {filteredRecap.map((s, i) => (
                      <tr key={s?.id || i}><td className="py-2 px-3 text-center">{i+1}</td><td className="py-2 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-2 px-3 text-center">{s?.class}</td><td className="py-2 px-3 text-center font-black">{s?.score || 0}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px', textAlign: 'center' }}>
                  <div style={{ width: '250px' }}><p>Kepala Sekolah,</p><br/><br/><br/><p style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>_________________________</p></div>
                </div>
              </div>

              {/* === TAMPILAN KERTAS PRINT (BERITA ACARA) === */}
              <div className={`${adminPrintMode === 'berita_acara' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-8 underline tracking-wide">BERITA ACARA PELAKSANAAN UJIAN CBT</h3>
                <div className="text-justify leading-loose font-medium text-sm">
                  <p>Pada hari ini _________ tanggal ____ bulan ________________ tahun 20___, telah diselenggarakan Ujian Berbasis Komputer (CBT) untuk:</p>
                  <table className="w-full my-4 border-none !border-0">
                    <tbody className="border-none">
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Guru Mapel</td><td className="border-none !p-0">: {adminRecapGuru || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Mata Pelajaran</td><td className="border-none !p-0">: {adminRecapMapel || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Kelas</td><td className="border-none !p-0">: {adminRecapKelas || '____'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Jumlah Peserta</td><td className="border-none !p-0">: {filteredRecap.length} Orang</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-4">Catatan selama pelaksanaan ujian:</p>
                  <div className="w-full h-24 border border-black mt-2 mb-8"></div>
                </div>
              </div>

              {/* === TAMPILAN UI TABEL NILAI (SEBELUM DI PRINT) === */}
              <div className="print:hidden">
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto shadow-sm">
                  <table className="w-full text-left text-xs min-w-[700px] whitespace-nowrap">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input type="checkbox" className="accent-amber-500 w-4 h-4 cursor-pointer rounded" onChange={handleSelectAllRecaps} checked={selectedRecaps.length === filteredRecap.length && filteredRecap.length > 0} />
                        </th>
                        <th className="py-2.5 px-3 font-bold uppercase">Identitas Siswa</th>
                        <th className="py-2.5 px-3 font-bold uppercase text-center">Kelas</th>
                        <th className="py-2.5 px-3 font-bold uppercase">Mapel & Guru</th>
                        <th className="py-2.5 px-3 font-bold uppercase text-center">Skor Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredRecap.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-center"><input type="checkbox" className="accent-amber-500 w-4 h-4 cursor-pointer rounded" checked={selectedRecaps.includes(s.id)} onChange={() => toggleSelectRecap(s.id)} /></td>
                          <td className="py-2.5 px-3 font-black text-white text-sm truncate max-w-[250px]">{s.name}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-300">{s.class}</td>
                          <td className="py-2.5 px-3"><p className="font-bold text-amber-500">{s.mapel}</p><p className="text-[9px] text-slate-500 truncate max-w-[200px]">{s.teacherEmail}</p></td>
                          <td className="py-2.5 px-3 text-center"><span className="text-lg font-black text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-700 shadow-inner">{s.score}</span></td>
                        </tr>
                      ))}
                      {filteredRecap.length === 0 && <tr><td colSpan="5" className="text-center p-8 text-slate-500">Data nilai tidak ditemukan.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}