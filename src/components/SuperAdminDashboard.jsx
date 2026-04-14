import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { Activity, BookOpen, Users, LogOut, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, AlertTriangle, Menu, X, ShieldCheck, Lock, UserCog, Plus, Crown } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function SuperAdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState(localStorage.getItem('superAdminTab') || 'radar');
  useEffect(() => { localStorage.setItem('superAdminTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ users: [], live: [], bank: [], sessions: [] });
  
  const [filterGuru, setFilterGuru] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  
  const [showEditSoalModal, setShowSoalModal] = useState(false);
  const [editSoalId, setEditSoalId] = useState(null);
  const [soalFormData, setSoalFormData] = useState({ mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });

  const [showEditGuruModal, setShowGuruModal] = useState(false);
  const [showAddGuruModal, setShowAddGuruModal] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  const [guruFormData, setGuruFormData] = useState({ name: '', email: '' });

  const currentUserEmail = auth.currentUser?.email || 'admin@sekolah.com';

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

  // AMAN DARI BOLONG: Ambil user dengan filter yang aman
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

  const approveTeacher = (id) => update(ref(db, `users/${id}`), { status: 'active' });
  const rejectTeacher = (id) => { if(window.confirm("Tolak & Hapus pendaftar ini?")) remove(ref(db, `users/${id}`)); };
  const deleteTeacher = (id) => { if(window.confirm("PERINGATAN OTORITAS!\nHapus akun guru ini secara permanen dari server pusat?")) remove(ref(db, `users/${id}`)); };

  // AMAN DARI BOLONG: Beri nilai default jika kosong
  const openEditGuruModal = (teacher) => { 
    setEditGuruId(teacher.id); 
    setGuruFormData({ name: teacher?.name || '', email: teacher?.email || '' }); 
    setShowGuruModal(true); 
  };
  const handleUpdateGuru = (e) => { e.preventDefault(); update(ref(db, `users/${editGuruId}`), { name: guruFormData.name, email: guruFormData.email }); alert("Data Guru Diperbarui!"); setShowGuruModal(false); };

  const handleManualAddGuru = (e) => {
    e.preventDefault();
    const cleanId = guruFormData.email.replace(/[^a-zA-Z0-9]/g, '');
    set(ref(db, `users/${cleanId}`), { name: guruFormData.name, email: guruFormData.email, role: 'teacher', status: 'active', createdAt: Date.now() });
    alert("Guru berhasil disuntikkan ke Database Pusat!"); setShowAddGuruModal(false); setGuruFormData({ name: '', email: '' });
  };

  const forceCloseSession = (id) => { if(window.confirm("KUNCI PAKSA sesi ini?")) update(ref(db, `exam_sessions/${id}`), { status: 'closed' }); };
  const deleteSoalGlobal = (id) => { if(window.confirm("Hapus soal ini dari PUSAT?")) remove(ref(db, `bank_soal/${id}`)); };

  const openEditSoalModal = (q) => { setSoalFormData({ mapel: q?.mapel||'', kelas: q?.kelas||'', pertanyaan: q?.pertanyaan||'', opsiA: q?.opsiA||'', opsiB: q?.opsiB||'', opsiC: q?.opsiC||'', opsiD: q?.opsiD||'', kunci: q?.kunci||'A' }); setEditSoalId(q.id); setShowSoalModal(true); };
  const handleUpdateSoal = (e) => { e.preventDefault(); update(ref(db, `bank_soal/${editSoalId}`), { ...soalFormData }); alert("Soal berhasil dimodifikasi oleh Admin!"); setShowSoalModal(false); };

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
          <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">Otoritas Tertinggi</p>
          <p className="text-sm font-bold truncate text-white">Administrator Sekolah</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="radar" icon={Activity} label="Radar Aktivitas" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal Global" />
          <NavItem tab="guru" icon={Users} label="Manajemen Personalia" badge={pendingTeachers.length} />
        </nav>
        <div className="p-6 border-t border-slate-800"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-950/50 hover:bg-red-900 border border-red-900 text-red-500 hover:text-white rounded-xl font-bold transition-colors shadow-lg"><LogOut size={20}/> Keluar Ruang Kendali</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0f1c]">
        <header className="bg-slate-900 border-b border-slate-800 p-4 lg:p-6 flex justify-between items-center shadow-lg z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-slate-800 rounded-lg text-amber-500" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-xl lg:text-2xl font-black text-white hidden sm:block tracking-wide">COMMAND CENTER</h2>
          </div>
          <div className="flex items-center gap-3 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div><span className="text-xs font-black text-amber-500 uppercase tracking-widest">Sistem Aktif</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><Activity className="text-amber-500"/> Radar Aktivitas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 border-b-4 border-b-blue-500 shadow-xl relative overflow-hidden"><div className="absolute -right-4 -bottom-4 opacity-5"><Users size={100}/></div><p className="text-slate-400 font-bold text-xs mb-2 uppercase tracking-widest">Siswa Berjalan</p><p className="text-5xl font-black text-white">{stats.online}</p></div>
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 border-b-4 border-b-emerald-500 shadow-xl relative overflow-hidden"><div className="absolute -right-4 -bottom-4 opacity-5"><CheckCircle size={100}/></div><p className="text-slate-400 font-bold text-xs mb-2 uppercase tracking-widest">Siswa Selesai</p><p className="text-5xl font-black text-emerald-400">{stats.selesai}</p></div>
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 border-b-4 border-b-red-600 shadow-xl relative overflow-hidden"><div className="absolute -right-4 -bottom-4 opacity-5"><AlertTriangle size={100}/></div><p className="text-slate-400 font-bold text-xs mb-2 uppercase tracking-widest">Kecurangan</p><p className="text-5xl font-black text-red-500">{stats.curang}</p></div>
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="font-bold text-white text-lg border-b border-slate-800 pb-3 flex items-center gap-2"><Lock size={18} className="text-amber-500"/> Sesi Berjalan ({activeSessions.length})</h4>
                {activeSessions.length === 0 ? (
                  <div className="bg-slate-900 p-10 rounded-3xl text-center text-slate-500 border border-dashed border-slate-700 font-medium">Tidak ada aktivitas terdeteksi.</div>
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
            <div className="space-y-6 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-white flex items-center gap-3"><BookOpen className="text-amber-500"/> Gudang Data Soal</h3>
              <div className="bg-slate-900 p-5 rounded-3xl shadow-lg border border-slate-800 flex flex-col sm:flex-row gap-4">
                <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="flex-1 p-4 border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none focus:border-amber-500"><option value="">-- Semua Pencipta Soal --</option>{availableGuruSoal.map(g => <option key={g}>{g}</option>)}</select>
                <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)} className="flex-1 p-4 border border-slate-700 rounded-xl bg-slate-950 font-bold text-white outline-none focus:border-amber-500"><option value="">-- Semua Bidang Studi --</option>{availableMapelSoal.map(m => <option key={m}>{m}</option>)}</select>
              </div>

              <div className="space-y-4">
                {filteredSoal.map((q, i) => (
                  <div key={q.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg flex flex-col md:flex-row gap-6 justify-between hover:border-amber-500/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-800 pb-4">
                        <span className="text-xs font-black bg-amber-500 text-black px-3 py-1.5 rounded-md">{q?.teacherEmail}</span>
                        <span className="text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-md">{q?.mapel} (Tk. {q?.kelas})</span>
                      </div>
                      <p className="font-bold text-lg mb-6 text-white leading-relaxed"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-400 font-medium">
                        {['A','B','C','D'].map(opt => (
                          <div key={opt} className={`p-4 rounded-xl border ${q?.kunci===opt?'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold':'border-slate-800 bg-slate-950'}`}><Latex>{`${opt}. ${q[`opsi${opt}`]}`}</Latex></div>
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

          {/* TAB MANAJEMEN GURU (ANTI CRASH) */}
          {activeTab === 'guru' && (
            <div className="space-y-8 max-w-6xl mx-auto">
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
                          {/* ANTI-CRASH ICON GENERATOR */}
                          <div className="w-14 h-14 shrink-0 bg-slate-800 text-amber-500 rounded-full flex items-center justify-center font-black text-2xl uppercase border border-slate-700 shadow-inner">
                            {t?.name ? t.name.charAt(0) : 'G'}
                          </div>
                          <div className="min-w-0">
                            {/* ANTI-CRASH TEXT */}
                            <p className="font-black text-white text-lg truncate">{t?.name || 'Guru Tanpa Nama'}</p>
                            <p className="font-medium text-slate-400 text-sm truncate">{t?.email || 'Email tidak tersedia'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditGuruModal(t)} className="flex-1 flex items-center justify-center text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white px-4 py-3 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-700"><UserCog size={18}/></button>
                          <button onClick={() => deleteTeacher(t.id)} className="flex-1 flex items-center justify-center text-red-500 bg-red-950/20 hover:bg-red-900 hover:text-white px-4 py-3 rounded-xl transition-all shadow-sm active:scale-95 border border-red-900/30"><Trash2 size={18}/></button>
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
          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800">
            <h2 className="text-xl font-black mb-6 text-white flex items-center gap-3"><UserCog className="text-amber-500"/> Modifikasi Data Personalia</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-5">
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Nama Lengkap & Gelar</label><input required value={guruFormData.name} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Email Akun (Info Saja)</label><input required value={guruFormData.email} type="email" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white shadow-inner" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowGuruModal(false)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold active:scale-95 transition-all">Batal</button><button type="submit" className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black shadow-[0_0_15px_rgba(245,158,11,0.2)] active:scale-95 transition-all">Simpan Revisi</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH GURU MANUAL */}
      {showAddGuruModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800">
            <h2 className="text-xl font-black mb-2 text-white flex items-center gap-3"><Plus className="text-amber-500"/> Registrasi Paksa</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">Gunakan perintah ini untuk menyuntikkan data guru lama langsung ke inti database.</p>
            <form onSubmit={handleManualAddGuru} className="space-y-5">
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Nama Lengkap Guru</label><input required value={guruFormData.name} placeholder="Bpk. Suryanto Siregar" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase mb-2 block tracking-widest">Email Terdaftar</label><input required value={guruFormData.email} type="email" placeholder="suryanto@guru.com" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-bold text-white" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddGuruModal(false)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-bold active:scale-95">Batalkan</button><button type="submit" className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.2)]">Suntik Data</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SOAL PUSAT */}
      {showEditSoalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-white flex items-center gap-3"><Edit className="text-amber-500"/> Intervensi Soal Pusat</h2>
            <form onSubmit={handleUpdateSoal} className="space-y-4">
              <div className="flex gap-4"><input required value={soalFormData.mapel} className="flex-1 p-4 bg-slate-950 border border-slate-800 text-white rounded-2xl font-bold focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, mapel: e.target.value})} /><input required value={soalFormData.kelas} className="w-32 p-4 bg-slate-950 border border-slate-800 text-white rounded-2xl font-bold text-center focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, kelas: e.target.value})} /></div>
              <textarea required value={soalFormData.pertanyaan} className="w-full p-5 bg-slate-950 border border-slate-800 text-white rounded-2xl min-h-[120px] leading-relaxed focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, pertanyaan: e.target.value})} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{['A','B','C','D'].map(o => <input key={o} required value={soalFormData[`opsi${o}`]} className="p-4 bg-slate-950 border border-slate-800 text-white rounded-2xl focus:border-amber-500 outline-none" onChange={e => setSoalFormData({...soalFormData, [`opsi${o}`]: e.target.value})} />)}</div>
              <select value={soalFormData.kunci} className="w-full p-4 border border-amber-500/50 bg-amber-500/10 text-amber-500 font-black rounded-2xl outline-none" onChange={e => setSoalFormData({...soalFormData, kunci: e.target.value})}><option value="A">Kunci A</option><option value="B">Kunci B</option><option value="C">Kunci C</option><option value="D">Kunci D</option></select>
              <div className="flex gap-3 pt-6"><button type="button" onClick={() => setShowSoalModal(false)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-bold active:scale-95">Tutup</button><button type="submit" className="flex-1 py-4 bg-amber-500 text-black rounded-2xl font-black active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.2)]">Terapkan Perubahan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
