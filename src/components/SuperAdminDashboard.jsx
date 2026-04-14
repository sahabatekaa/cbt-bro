import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { Activity, BookOpen, Users, LogOut, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, AlertTriangle, Menu, X, ShieldCheck, Lock, UserCog, Plus } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function SuperAdminDashboard({ onLogout }) {
  // 1. FITUR ANTI-REFRESH (Simpan Tab Terakhir)
  const [activeTab, setActiveTab] = useState(localStorage.getItem('superAdminTab') || 'radar');
  useEffect(() => { localStorage.setItem('superAdminTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ users: [], live: [], bank: [], sessions: [] });
  
  // STATE FILTER SOAL
  const [filterGuru, setFilterGuru] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  
  // STATE MODAL EDIT SOAL
  const [showEditSoalModal, setShowSoalModal] = useState(false);
  const [editSoalId, setEditSoalId] = useState(null);
  const [soalFormData, setSoalFormData] = useState({ mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });

  // STATE MODAL EDIT & TAMBAH GURU
  const [showEditGuruModal, setShowGuruModal] = useState(false);
  const [showAddGuruModal, setShowAddGuruModal] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  const [guruFormData, setGuruFormData] = useState({ name: '', email: '' });

  const currentUserEmail = auth.currentUser?.email || 'admin@sekolah.com';

  // 2. DATA FETCHING
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
  }, []);

  const pendingTeachers = data.users.filter(u => u.role === 'teacher' && u.status === 'pending');
  const activeTeachers = data.users.filter(u => u.role === 'teacher' && u.status === 'active');
  const activeSessions = data.sessions.filter(s => s.status === 'open');
  
  const stats = {
    online: data.live.filter(s => s.status !== 'Selesai').length,
    selesai: data.live.filter(s => s.status === 'Selesai').length,
    curang: data.live.filter(s => s.warnings >= 3).length
  };

  const availableGuruSoal = [...new Set(data.bank.map(q => q.teacherEmail).filter(Boolean))];
  const availableMapelSoal = [...new Set(data.bank.map(q => q.mapel).filter(Boolean))];
  const filteredSoal = data.bank.filter(q => (filterGuru === '' || q.teacherEmail === filterGuru) && (filterMapel === '' || q.mapel === filterMapel));

  // 3. FUNGSI MANAJEMEN GURU
  const approveTeacher = (id) => update(ref(db, `users/${id}`), { status: 'active' });
  const rejectTeacher = (id) => { if(window.confirm("Tolak & Hapus pendaftar ini?")) remove(ref(db, `users/${id}`)); };
  const deleteTeacher = (id) => { if(window.confirm("Hapus akun guru ini secara permanen dari server?")) remove(ref(db, `users/${id}`)); };

  const openEditGuruModal = (teacher) => {
    setEditGuruId(teacher.id);
    setGuruFormData({ name: teacher.name, email: teacher.email });
    setShowGuruModal(true);
  };

  const handleUpdateGuru = (e) => {
    e.preventDefault();
    update(ref(db, `users/${editGuruId}`), { name: guruFormData.name, email: guruFormData.email });
    alert("Data Guru Berhasil Diperbarui!");
    setShowGuruModal(false);
  };

  // Fitur Tambah Guru Manual (Solusi Guru Ga Kelihatan)
  const handleManualAddGuru = (e) => {
    e.preventDefault();
    const cleanId = guruFormData.email.replace(/[^a-zA-Z0-9]/g, ''); // Buat ID unik dari email
    set(ref(db, `users/${cleanId}`), {
      name: guruFormData.name,
      email: guruFormData.email,
      role: 'teacher',
      status: 'active',
      createdAt: Date.now()
    });
    alert("Guru Lama berhasil dimasukkan ke Database Pusat!");
    setShowAddGuruModal(false);
    setGuruFormData({ name: '', email: '' });
  };

  // 4. FUNGSI MANAJEMEN SOAL & SESI
  const forceCloseSession = (id) => { if(window.confirm("Tutup paksa sesi ini?")) update(ref(db, `exam_sessions/${id}`), { status: 'closed' }); };
  const deleteSoalGlobal = (id) => { if(window.confirm("Hapus soal ini dari pusat?")) remove(ref(db, `bank_soal/${id}`)); };

  const openEditSoalModal = (q) => {
    setSoalFormData({ mapel: q.mapel||'', kelas: q.kelas||'', pertanyaan: q.pertanyaan||'', opsiA: q.opsiA||'', opsiB: q.opsiB||'', opsiC: q.opsiC||'', opsiD: q.opsiD||'', kunci: q.kunci||'A' });
    setEditSoalId(q.id); setShowSoalModal(true);
  };

  const handleUpdateSoal = (e) => {
    e.preventDefault();
    update(ref(db, `bank_soal/${editSoalId}`), { ...soalFormData });
    alert("Soal berhasil diperbarui!");
    setShowSoalModal(false);
  };

  const NavItem = ({ tab, icon: Icon, label, badge }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex justify-between items-center p-3.5 rounded-xl transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
      <div className="flex items-center gap-3"><Icon size={20}/> <span className="font-semibold">{label}</span></div>
      {badge > 0 && <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-xl md:shadow-none`}>
        <div className="p-6 border-b bg-slate-900 flex justify-between items-center"><h1 className="text-xl font-black text-white flex gap-2"><ShieldCheck className="text-emerald-400"/> SUPER ADMIN</h1><button className="md:hidden text-white/50" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button></div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="radar" icon={Activity} label="Radar Aktivitas" />
          <NavItem tab="bank" icon={BookOpen} label="Pusat Bank Soal" />
          <NavItem tab="guru" icon={Users} label="Manajemen Guru" badge={pendingTeachers.length} />
        </nav>
        <div className="p-4 border-t bg-slate-50"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold transition-colors"><LogOut size={20}/> Logout</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 bg-slate-100 rounded-lg text-slate-700" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-xl font-black text-slate-800 hidden sm:block">Pusat Kendali</h2>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Server Aktif</span></div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB RADAR (100% RESPONSIF KARTU) */}
          {activeTab === 'radar' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2"><Activity className="text-blue-600"/> Radar Aktivitas Global</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border-b-4 border-b-blue-500 shadow-sm"><p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-widest">Siswa Online</p><p className="text-5xl font-black text-slate-800">{stats.online}</p></div>
                <div className="bg-white p-6 rounded-3xl border-b-4 border-b-emerald-500 shadow-sm"><p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-widest">Siswa Selesai</p><p className="text-5xl font-black text-emerald-600">{stats.selesai}</p></div>
                <div className="bg-white p-6 rounded-3xl border-b-4 border-b-red-500 shadow-sm"><p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-widest">Siswa Curang</p><p className="text-5xl font-black text-red-600">{stats.curang}</p></div>
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="font-bold text-slate-800 text-lg border-b pb-2">Sesi Ujian Aktif Saat Ini ({activeSessions.length})</h4>
                {activeSessions.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl text-center text-slate-400 border border-dashed border-slate-300">Tidak ada sesi berjalan.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DESAIN KARTU (CARD) - BUKAN TABEL */}
                    {activeSessions.map(s => (
                      <div key={s.id} className="bg-white p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                          <p className="font-black font-mono text-2xl text-slate-800 mb-1">{s.token}</p>
                          <p className="font-bold text-slate-600 text-sm">{s.teacherEmail}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">{s.mapel}</span>
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">Tingkat: {s.kelas}-{s.subKelas}</span>
                          </div>
                        </div>
                        <button onClick={() => forceCloseSession(s.id)} className="w-full sm:w-auto bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-red-100 shadow-sm"><Lock size={18}/> Tutup Paksa</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB BANK SOAL PUSAT */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2"><BookOpen className="text-emerald-600"/> Manajemen Bank Soal Pusat</h3>
              <div className="bg-white p-4 rounded-3xl shadow-sm border flex flex-col sm:flex-row gap-3">
                <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="flex-1 p-3.5 border rounded-xl bg-slate-50 font-bold outline-none cursor-pointer"><option value="">-- Semua Guru Pembuat --</option>{availableGuruSoal.map(g => <option key={g}>{g}</option>)}</select>
                <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)} className="flex-1 p-3.5 border rounded-xl bg-slate-50 font-bold outline-none cursor-pointer"><option value="">-- Semua Mapel --</option>{availableMapelSoal.map(m => <option key={m}>{m}</option>)}</select>
              </div>

              <div className="space-y-4">
                {filteredSoal.map((q, i) => (
                  <div key={q.id} className="bg-white p-5 md:p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-6 justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-100 pb-3">
                        <span className="text-xs font-black bg-slate-800 text-white px-3 py-1.5 rounded-lg">{q.teacherEmail}</span>
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">{q.mapel} (Tingkat {q.kelas})</span>
                      </div>
                      <p className="font-bold text-lg mb-4 text-slate-800"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">{['A','B','C','D'].map(opt => (<div key={opt} className={`p-3 border rounded-xl ${q.kunci===opt?'bg-emerald-50 border-emerald-300 font-bold text-emerald-900':''}`}><Latex>{`${opt}. ${q[`opsi${opt}`]}`}</Latex></div>))}</div>
                    </div>
                    <div className="flex gap-2 self-end md:self-start md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0 border-t md:border-t-0 w-full md:w-auto">
                      <button onClick={() => openEditSoalModal(q)} className="flex-1 md:flex-none flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-100 p-3.5 rounded-xl active:scale-95"><Edit size={20}/></button>
                      <button onClick={() => deleteSoalGlobal(q.id)} className="flex-1 md:flex-none flex items-center justify-center text-red-600 bg-red-50 border border-red-100 p-3.5 rounded-xl active:scale-95"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
                {filteredSoal.length === 0 && <div className="text-center p-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">Data soal tidak ditemukan.</div>}
              </div>
            </div>
          )}

          {/* TAB MANAJEMEN GURU (100% KARTU RESPONSIF & TOMBOL TAMBAH GURU) */}
          {activeTab === 'guru' && (
            <div className="space-y-8 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Users className="text-orange-500"/> Manajemen Guru</h3>
                
                {/* TOMBOL PENYELAMAT: TAMBAH GURU MANUAL */}
                <button onClick={() => { setGuruFormData({name:'', email:''}); setShowAddGuruModal(true); }} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={20}/> Tambah Guru Baru</button>
              </div>
              
              {/* Approval Akun Baru */}
              {pendingTeachers.length > 0 && (
                <div className="bg-orange-50 rounded-3xl border border-orange-200 overflow-hidden shadow-sm p-5 space-y-4">
                  <div className="font-black text-orange-800 flex items-center gap-2 border-b border-orange-200 pb-3"><ShieldAlert size={22}/> Menunggu Persetujuan ({pendingTeachers.length})</div>
                  <div className="grid grid-cols-1 gap-3">
                    {/* DESAIN KARTU PENDING */}
                    {pendingTeachers.map(t => (
                      <div key={t.id} className="bg-white p-4 rounded-2xl border border-orange-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm">
                        <div>
                          <p className="font-black text-slate-800 text-lg leading-tight">{t.name}</p>
                          <p className="font-medium text-slate-500 text-sm mt-0.5">{t.email}</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0">
                          <button onClick={() => approveTeacher(t.id)} className="flex-1 sm:flex-none bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 flex justify-center items-center gap-1"><CheckCircle size={16}/> Terima</button>
                          <button onClick={() => rejectTeacher(t.id)} className="flex-1 sm:flex-none bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 flex justify-center items-center gap-1"><XCircle size={16}/> Tolak</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daftar Guru Aktif (Card Layout 100% Responsif) */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-lg border-b pb-2">Daftar Guru Aktif ({activeTeachers.length})</h4>
                {activeTeachers.length === 0 ? (
                  <div className="text-center p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada guru yang aktif di database.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DESAIN KARTU GURU AKTIF - TIDAK AKAN KEPOTONG! */}
                    {activeTeachers.map(t => (
                      <div key={t.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 shrink-0 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-black text-xl uppercase border border-blue-200 shadow-inner">{t.name.charAt(0)}</div>
                          <div>
                            <p className="font-black text-slate-800 text-lg">{t.name}</p>
                            <p className="font-medium text-slate-500 text-sm">{t.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
                          <button onClick={() => openEditGuruModal(t)} className="flex-1 sm:flex-none flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-4 py-3 rounded-xl transition-all shadow-sm active:scale-95"><UserCog size={20}/></button>
                          <button onClick={() => deleteTeacher(t.id)} className="flex-1 sm:flex-none flex items-center justify-center text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 px-4 py-3 rounded-xl transition-all shadow-sm active:scale-95"><Trash2 size={20}/></button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200">
            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2"><UserCog className="text-blue-500"/> Edit Data Guru</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-5">
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-widest">Nama Lengkap & Gelar</label><input required value={guruFormData.name} className="w-full p-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-blue-300 font-bold text-slate-800" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-widest">Email Akun</label><input required value={guruFormData.email} type="email" className="w-full p-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-blue-300 font-bold text-slate-800" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowGuruModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-600 active:scale-95 transition-transform">Batal</button><button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">Simpan Data</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH GURU MANUAL (PENYELAMAT DATA HILANG) */}
      {showAddGuruModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200">
            <h2 className="text-xl font-black mb-2 text-slate-800 flex items-center gap-2"><Plus className="text-emerald-500"/> Tambah Guru Baru</h2>
            <p className="text-sm text-slate-500 mb-6">Gunakan fitur ini untuk mendaftarkan akun guru lama ke database pusat secara manual.</p>
            <form onSubmit={handleManualAddGuru} className="space-y-5">
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-widest">Nama Lengkap & Gelar</label><input required value={guruFormData.name} placeholder="Contoh: Budi Santoso, S.Pd" className="w-full p-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-300 font-bold text-slate-800" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-widest">Email Terdaftar (Wajib Valid)</label><input required value={guruFormData.email} type="email" placeholder="budi@guru.com" className="w-full p-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-300 font-bold text-slate-800" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowAddGuruModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-600 active:scale-95 transition-transform">Batal</button><button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">Daftarkan</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SOAL PUSAT */}
      {showEditSoalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2"><Edit className="text-emerald-500"/> Edit Soal Pusat</h2>
            <form onSubmit={handleUpdateSoal} className="space-y-4">
              <div className="flex gap-4"><input required value={soalFormData.mapel} className="flex-1 p-4 border bg-slate-50 rounded-2xl font-bold" onChange={e => setSoalFormData({...soalFormData, mapel: e.target.value})} /><input required value={soalFormData.kelas} className="w-32 p-4 border bg-slate-50 rounded-2xl font-bold text-center" onChange={e => setSoalFormData({...soalFormData, kelas: e.target.value})} /></div>
              <textarea required value={soalFormData.pertanyaan} className="w-full p-5 border bg-slate-50 rounded-2xl min-h-[120px] leading-relaxed" onChange={e => setSoalFormData({...soalFormData, pertanyaan: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">{['A','B','C','D'].map(o => <input key={o} required value={soalFormData[`opsi${o}`]} className="p-4 border rounded-2xl" onChange={e => setSoalFormData({...soalFormData, [`opsi${o}`]: e.target.value})} />)}</div>
              <select value={soalFormData.kunci} className="w-full p-4 border border-emerald-200 bg-emerald-50 text-emerald-900 font-black rounded-2xl" onChange={e => setSoalFormData({...soalFormData, kunci: e.target.value})}><option value="A">Kunci A</option><option value="B">Kunci B</option><option value="C">Kunci C</option><option value="D">Kunci D</option></select>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowSoalModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Batal</button><button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">Update Pusat</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
