import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { Activity, BookOpen, Users, LogOut, ShieldAlert, CheckCircle, XCircle, Trash2, Edit, AlertTriangle, Menu, X, ShieldCheck, Lock, UserCog } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

export default function SuperAdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('radar');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ users: [], live: [], bank: [], sessions: [] });
  
  // STATE FILTER & MODAL SOAL
  const [filterGuru, setFilterGuru] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  const [showEditSoalModal, setShowSoalModal] = useState(false);
  const [editSoalId, setEditSoalId] = useState(null);
  const [soalFormData, setSoalFormData] = useState({ mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });

  // STATE EDIT GURU
  const [showEditGuruModal, setShowGuruModal] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  const [guruFormData, setGuruFormData] = useState({ name: '', email: '' });

  // 1. DATA FETCHING
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

  // 2. FUNGSI MANAJEMEN GURU
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

  // 3. FUNGSI MANAJEMEN SOAL & SESI
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
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 border-b bg-slate-900 flex justify-between items-center"><h1 className="text-xl font-black text-white flex gap-2"><ShieldCheck className="text-emerald-400"/> SUPER ADMIN</h1><button className="md:hidden text-white/50" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button></div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="radar" icon={Activity} label="Radar Aktivitas" />
          <NavItem tab="bank" icon={BookOpen} label="Pusat Bank Soal" />
          <NavItem tab="guru" icon={Users} label="Manajemen Guru" badge={pendingTeachers.length} />
        </nav>
        <div className="p-4 border-t bg-slate-50"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-3 bg-red-100 text-red-700 rounded-xl font-bold"><LogOut size={20}/> Logout</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10 pr-16 md:pr-4">
          <button className="md:hidden p-2 bg-slate-100 rounded-lg" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-xs font-bold text-emerald-800 uppercase">Server Online</span></div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2"><Activity className="text-blue-600"/> Radar Aktivitas Global</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border-b-4 border-b-blue-500 shadow-sm"><p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-widest">Siswa Online</p><p className="text-5xl font-black text-slate-800">{stats.online}</p></div>
                <div className="bg-white p-6 rounded-2xl border-b-4 border-b-emerald-500 shadow-sm"><p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-widest">Siswa Selesai</p><p className="text-5xl font-black text-emerald-600">{stats.selesai}</p></div>
                <div className="bg-white p-6 rounded-2xl border-b-4 border-b-red-500 shadow-sm"><p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-widest">Siswa Curang</p><p className="text-5xl font-black text-red-600">{stats.curang}</p></div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mt-8">
                <div className="p-4 border-b bg-slate-50 font-bold text-slate-800">Sesi Aktif ({activeSessions.length})</div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[600px] text-left">
                    <thead className="bg-slate-100/50"><tr><th className="p-4 font-bold text-slate-600">Token</th><th className="p-4 font-bold text-slate-600">Guru / Mapel</th><th className="p-4 font-bold text-slate-600 text-right">Aksi</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeSessions.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50"><td className="p-4 font-black font-mono text-lg text-slate-800">{s.token}</td><td className="p-4"><p className="font-bold text-slate-800">{s.teacherEmail}</p><span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{s.mapel}</span></td><td className="p-4 text-right"><button onClick={() => forceCloseSession(s.id)} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">Tutup Paksa</button></td></tr>
                      ))}
                      {activeSessions.length === 0 && <tr><td colSpan="3" className="text-center p-10 text-slate-400">Tidak ada sesi berjalan.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB BANK SOAL PUSAT */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2"><BookOpen className="text-emerald-600"/> Manajemen Bank Soal Pusat</h3>
              <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row gap-3">
                <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)} className="flex-1 p-3 border rounded-xl bg-gray-50 font-bold outline-none"><option value="">-- Semua Guru --</option>{availableGuruSoal.map(g => <option key={g}>{g}</option>)}</select>
                <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)} className="flex-1 p-3 border rounded-xl bg-gray-50 font-bold outline-none"><option value="">-- Semua Mapel --</option>{availableMapelSoal.map(m => <option key={m}>{m}</option>)}</select>
              </div>

              <div className="space-y-4">
                {filteredSoal.map((q, i) => (
                  <div key={q.id} className="bg-white p-5 md:p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1"><div className="flex flex-wrap gap-2 mb-3"><span className="text-xs font-black bg-slate-800 text-white px-2 py-1 rounded">{q.teacherEmail}</span><span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded">{q.mapel}</span></div>
                    <p className="font-bold text-lg mb-4 text-slate-800"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">{['A','B','C','D'].map(opt => (<div key={opt} className={`p-3 border rounded-xl ${q.kunci===opt?'bg-emerald-50 border-emerald-300 font-bold text-emerald-900':''}`}><Latex>{`${opt}. ${q[`opsi${opt}`]}`}</Latex></div>))}</div></div>
                    <div className="flex gap-2 self-end md:self-start"><button onClick={() => openEditSoalModal(q)} className="text-blue-600 bg-blue-50 p-3 rounded-xl"><Edit size={20}/></button><button onClick={() => deleteSoalGlobal(q.id)} className="text-red-500 bg-red-50 p-3 rounded-xl"><Trash2 size={20}/></button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB MANAJEMEN GURU (DENGAN EDIT & HAPUS) */}
          {activeTab === 'guru' && (
            <div className="space-y-8 max-w-6xl mx-auto">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Users className="text-orange-500"/> Manajemen Akun Guru</h3>
              
              {pendingTeachers.length > 0 && (
                <div className="bg-orange-50 rounded-2xl border border-orange-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-orange-200 bg-orange-100/50 font-bold text-orange-800 flex items-center gap-2"><ShieldAlert size={20}/> Menunggu Persetujuan ({pendingTeachers.length})</div>
                  <div className="overflow-x-auto w-full"><table className="w-full min-w-[500px] text-left"><thead className="text-orange-800/70"><tr><th className="p-4">Nama</th><th className="p-4">Email</th><th className="p-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-orange-200">{pendingTeachers.map(t => (<tr key={t.id}><td className="p-4 font-black">{t.name}</td><td className="p-4">{t.email}</td><td className="p-4 text-right flex justify-end gap-2"><button onClick={() => approveTeacher(t.id)} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Terima</button><button onClick={() => rejectTeacher(t.id)} className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold">Tolak</button></td></tr>))}</tbody></table></div>
                </div>
              )}

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b font-bold text-slate-800">Daftar Guru Aktif ({activeTeachers.length})</div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[600px] text-left">
                    <thead className="bg-slate-50 border-b"><tr><th className="p-4 font-bold text-slate-600">Nama Lengkap</th><th className="p-4 font-bold text-slate-600">Email Login</th><th className="p-4 font-bold text-slate-600 text-right">Aksi Manajemen</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeTeachers.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-bold text-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-black uppercase">{t.name.charAt(0)}</div>{t.name}</td>
                          <td className="p-4 font-medium text-slate-500">{t.email}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => openEditGuruModal(t)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2.5 rounded-xl transition-all shadow-sm"><UserCog size={18}/></button>
                              <button onClick={() => deleteTeacher(t.id)} className="text-red-500 bg-red-50 hover:bg-red-100 p-2.5 rounded-xl transition-all shadow-sm"><Trash2 size={18}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL EDIT GURU */}
      {showEditGuruModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2"><UserCog className="text-blue-500"/> Edit Data Guru</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-widest">Nama Lengkap & Gelar</label><input required value={guruFormData.name} className="w-full p-3.5 border bg-slate-50 rounded-xl outline-none focus:ring-2 ring-blue-300 font-bold" onChange={e => setGuruFormData({...guruFormData, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block tracking-widest">Email Akun (Hanya Update Data)</label><input required value={guruFormData.email} type="email" className="w-full p-3.5 border bg-slate-50 rounded-xl outline-none focus:ring-2 ring-blue-300 font-bold" onChange={e => setGuruFormData({...guruFormData, email: e.target.value})} /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowGuruModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold text-slate-600 active:scale-95 transition-transform">Batal</button><button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Simpan Perubahan</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SOAL PUSAT */}
      {showEditSoalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <div className="bg-white p-8 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2"><Edit className="text-emerald-500"/> Edit Soal Pusat</h2>
            <form onSubmit={handleUpdateSoal} className="space-y-4">
              <div className="flex gap-4"><input required value={soalFormData.mapel} className="flex-1 p-3.5 border bg-slate-50 rounded-xl font-bold" onChange={e => setSoalFormData({...soalFormData, mapel: e.target.value})} /><input required value={soalFormData.kelas} className="w-32 p-3.5 border bg-slate-50 rounded-xl font-bold text-center" onChange={e => setSoalFormData({...soalFormData, kelas: e.target.value})} /></div>
              <textarea required value={soalFormData.pertanyaan} className="w-full p-4 border bg-slate-50 rounded-xl min-h-[100px]" onChange={e => setSoalFormData({...soalFormData, pertanyaan: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">{['A','B','C','D'].map(o => <input key={o} required value={soalFormData[`opsi${o}`]} className="p-3 border rounded-xl" onChange={e => setSoalFormData({...soalFormData, [`opsi${o}`]: e.target.value})} />)}</div>
              <select value={soalFormData.kunci} className="w-full p-3.5 border bg-emerald-50 text-emerald-900 font-black rounded-xl" onChange={e => setSoalFormData({...soalFormData, kunci: e.target.value})}><option value="A">Kunci A</option><option value="B">Kunci B</option><option value="C">Kunci C</option><option value="D">Kunci D</option></select>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowSoalModal(false)} className="flex-1 py-4 bg-slate-100 rounded-xl font-bold">Batal</button><button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold">Update Pusat</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
