import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [liveStudents, setLiveStudents] = useState([]);
  const [bankSoal, setBankSoal] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  
  const [recapFilterMapel, setRecapFilterMapel] = useState(''); // State filter mapel rekap
  const [teacherProfile, setTeacherProfile] = useState({ name: 'Memuat...', email: auth.currentUser?.email });

  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';

  const [formData, setFormData] = useState({ mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });

  // Ambil Data dari Firebase
  useEffect(() => {
    // Tarik profil guru
    if(auth.currentUser) {
      onValue(ref(db, `users/${auth.currentUser.uid}`), snap => {
        if(snap.exists()) setTeacherProfile(snap.val());
        else setTeacherProfile({ name: 'Guru Pengawas', email: currentUserEmail });
      });
    }
    onValue(ref(db, 'live_students'), snap => setLiveStudents(snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : []));
    onValue(ref(db, 'bank_soal'), snap => setBankSoal(snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : []));
    onValue(ref(db, 'leaderboard'), snap => setLeaderboard(snap.val() ? Object.values(snap.val()).sort((a, b) => b.score - a.score) : []));
    onValue(ref(db, 'exam_sessions'), snap => setSessions(snap.val() ? Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })) : []));
  }, []);

  const myQuestions = bankSoal.filter(q => q.teacherEmail === currentUserEmail);
  const mySessions = sessions.filter(s => s.teacherEmail === currentUserEmail);
  const monitoredStudents = liveStudents.filter(s => s.token === activeMonitorToken);

  const availableMapel = [...new Set(myQuestions.map(q => q.mapel).filter(Boolean))];
  const availableKelas = [...new Set(myQuestions.map(q => q.kelas).filter(Boolean))];
  
  // Ambil daftar mapel khusus dari data nilai (untuk dropdown filter cetak)
  const availableRecapMapel = [...new Set(leaderboard.map(s => s.mapel).filter(Boolean))];
  const filteredLeaderboard = leaderboard.filter(s => recapFilterMapel === '' || s.mapel === recapFilterMapel);

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
    if (!token || !mapel || !kelas) return alert("Pilih Mapel dan Kelas!");
    push(ref(db, 'exam_sessions'), { token, mapel, kelas, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now() });
    document.getElementById('token_input').value = '';
    alert("Berhasil! Sesi Ujian dibuka.");
  };

  const toggleSessionStatus = (id, currentStatus) => update(ref(db, `exam_sessions/${id}`), { status: currentStatus === 'open' ? 'closed' : 'open' });
  const deleteSession = (id, token) => {
    if(window.confirm(`Hapus sesi ${token}?`)) {
      remove(ref(db, `exam_sessions/${id}`));
      if(activeMonitorToken === token) { setActiveMonitorToken(''); localStorage.removeItem('activeMonitorToken'); }
    }
  };
  const setMonitor = (token) => { setActiveMonitorToken(token); localStorage.setItem('activeMonitorToken', token); setActiveTab('proctor'); };

  const NavItem = ({ tab, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 hover:bg-emerald-50'}`}>
      <Icon size={20}/> <span className="font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      <style>
        {`
          @media print {
            @page { margin: 1cm; }
            body { background: white !important; }
            aside, header, button, .print\\:hidden, select, input { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; width: 100% !important; overflow: visible !important; }
            .bg-gray-50 { background: white !important; }
            table { width: 100% !important; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000 !important; padding: 10px !important; color: black !important; font-size: 14px; }
            th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
            .shadow-sm, .rounded-2xl { box-shadow: none !important; border-radius: 0 !important; border: none !important; }
          }
        `}
      </style>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden print:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 print:hidden`}>
        <div className="p-6 flex justify-between items-center border-b border-gray-100">
          <h1 className="text-xl font-black text-emerald-600 flex items-center gap-2"><GraduationCap size={26}/> CBT BRO</h1>
          <button className="md:hidden text-gray-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-bold text-emerald-500 uppercase mb-1">Guru Mapel</p>
          <p className="text-sm font-bold text-slate-800 truncate" title={teacherProfile.name}>{teacherProfile.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Users} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Soal Milikku" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai" />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl font-bold"><LogOut size={20}/> Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10 print:hidden">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24} /></button>
            <h2 className="text-xl font-bold text-slate-800 capitalize">Dasbor Guru</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black">{teacherProfile.name.charAt(0).toUpperCase()}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
          
          {/* TAB MONITOR LIVE & SESI UJIAN SAMA SEPERTI SEBELUMNYA */}
          {activeTab === 'proctor' && (
            <div className="space-y-6">
              <div className="bg-emerald-100 text-emerald-800 p-4 rounded-xl flex items-center justify-between gap-2 border border-emerald-200">
                <div className="flex items-center gap-3 font-bold"><Eye size={22} className="text-emerald-600" /><span>{activeMonitorToken ? `Memantau: ${activeMonitorToken}` : 'Pilih Sesi'}</span></div>
                {mySessions.length > 0 && (
                  <select value={activeMonitorToken} onChange={(e) => setMonitor(e.target.value)} className="bg-white/80 border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-bold text-emerald-900 outline-none">
                    <option value="">-- Lihat Semua --</option>
                    {mySessions.map(s => <option key={s.token} value={s.token}>{s.token} ({s.mapel})</option>)}
                  </select>
                )}
              </div>
              {!activeMonitorToken ? (
                <div className="bg-white p-10 rounded-2xl border border-dashed text-center flex flex-col items-center"><Filter size={48} className="mb-4 text-gray-300" /><h3 className="font-bold text-gray-700 text-lg">Menunggu Token</h3></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-400 border border-gray-100 shadow-sm"><p className="text-gray-500 text-sm font-bold mb-1">Siswa Terhubung</p><p className="text-4xl font-black text-slate-800">{monitoredStudents.length}</p></div>
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-400 border border-gray-100 shadow-sm"><p className="text-gray-500 text-sm font-bold mb-1">Selesai</p><p className="text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p></div>
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-red-400 border border-gray-100 shadow-sm"><p className="text-gray-500 text-sm font-bold mb-1">Curang</p><p className="text-4xl font-black text-red-600">{monitoredStudents.filter(s => s.warnings > 0).length}</p></div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left"><thead className="border-b border-gray-100 bg-gray-50/50"><tr><th className="p-4 font-bold text-gray-800">Nama Siswa</th><th className="p-4 font-bold text-gray-800">Mapel / Kls</th><th className="p-4 font-bold text-gray-800 w-1/4">Progress</th><th className="p-4 font-bold text-gray-800 text-right">Aksi</th></tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {monitoredStudents.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50"><td className="p-4"><p className="font-bold text-slate-800">{s.name}</p>{s.status === 'Pindah Tab' && <span className="text-xs text-red-600 font-bold animate-pulse">Melanggar {s.warnings}x</span>}</td><td className="p-4"><p className="font-bold text-slate-800 mb-1">{s.mapel || '-'}</p><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">{s.class}</span></td><td className="p-4"><div className="flex items-center gap-2"><div className="flex-1 bg-gray-100 h-2.5 rounded-full"><div className="bg-emerald-500 h-full" style={{ width: `${s.progress}%` }}></div></div><span className="text-sm font-bold text-gray-600 w-10 text-right">{s.progress}%</span></div></td><td className="p-4 text-right"><button onClick={() => update(ref(db, `live_students/${s.id}`), { status: 'Selesai' })} disabled={s.status === 'Selesai'} className="text-xs bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 px-3 py-2 rounded-lg font-bold disabled:opacity-30">Kumpul</button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Plus className="text-emerald-500" /> Buka Sesi Ujian</h3>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <select id="mapel_session" required className="w-full p-3 rounded-xl border bg-gray-50 outline-none"><option value="">Pilih Mapel...</option>{availableMapel.map(m => <option key={m} value={m}>{m}</option>)}</select>
                  <select id="kelas_session" required className="w-full p-3 rounded-xl border bg-gray-50 outline-none"><option value="">Pilih Kelas...</option>{availableKelas.map(k => <option key={k} value={k}>{k}</option>)}</select>
                  <div className="flex gap-2"><input id="token_input" type="text" required placeholder="Generate..." className="flex-1 p-3 rounded-xl border font-mono font-bold uppercase" /><button type="button" onClick={() => { document.getElementById('token_input').value = Math.random().toString(36).substring(2, 7).toUpperCase(); }} className="bg-emerald-100 text-emerald-700 p-3 rounded-xl"><Dices size={24} /></button></div>
                  <button type="submit" className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold">Rilis ke Siswa</button>
                </form>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold mb-4">Sesi Ujian Aktif</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySessions.map((s) => (
                    <div key={s.id} className={`p-5 rounded-2xl border ${s.status === 'open' ? 'bg-white border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-4"><div><p className="font-mono text-3xl font-black mt-2 text-slate-800">{s.token}</p><div className="flex gap-2 mt-2"><span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded font-bold mr-1">{s.mapel}</span><span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded font-bold">{s.kelas}</span></div></div></div>
                      <div className="flex gap-2 pt-4 border-t border-gray-100"><button onClick={() => setMonitor(s.token)} className="flex-1 bg-slate-800 text-white py-2 rounded-xl text-sm font-bold flex justify-center gap-2"><Eye size={16}/> Monitor</button><button onClick={() => toggleSessionStatus(s.id, s.status)} className="p-2.5 bg-gray-100 rounded-xl">{s.status === 'open' ? <Lock size={18}/> : <Unlock size={18}/>}</button><button onClick={() => deleteSession(s.id, s.token)} className="p-2.5 bg-red-100 text-red-600 rounded-xl"><Trash2 size={18}/></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <button onClick={() => setShowModal(true)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium"><Plus size={18}/> Buat Soal Manual</button>
              <div className="grid grid-cols-1 gap-4">
                {myQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-6 rounded-2xl border border-gray-100 flex gap-6 shadow-sm"><div className="flex-1"><div className="flex gap-2 mb-3"><span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs px-2.5 py-1 rounded font-bold">{q.mapel}</span><span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded font-bold">{q.kelas}</span></div><p className="font-bold text-slate-800 mb-4">{idx + 1}. {q.pertanyaan}</p><div className="grid grid-cols-2 gap-2 text-sm text-slate-700"><div className={`p-2 rounded-lg border ${q.kunci==='A'?'bg-emerald-50 text-emerald-900 font-bold border-emerald-200':'border-gray-100'}`}>A. {q.opsiA}</div><div className={`p-2 rounded-lg border ${q.kunci==='B'?'bg-emerald-50 text-emerald-900 font-bold border-emerald-200':'border-gray-100'}`}>B. {q.opsiB}</div><div className={`p-2 rounded-lg border ${q.kunci==='C'?'bg-emerald-50 text-emerald-900 font-bold border-emerald-200':'border-gray-100'}`}>C. {q.opsiC}</div><div className={`p-2 rounded-lg border ${q.kunci==='D'?'bg-emerald-50 text-emerald-900 font-bold border-emerald-200':'border-gray-100'}`}>D. {q.opsiD}</div></div></div><div className="flex items-center justify-center border-l pl-6"><button onClick={() => remove(ref(db, `bank_soal/${q.id}`))} className="text-red-500 bg-red-50 p-3 rounded-xl"><Trash2 size={20}/></button></div></div>
                ))}
              </div>
            </div>
          )}

          {/* TAB REKAP NILAI & CETAK DENGAN FILTER MAPEL */}
          {activeTab === 'recap' && (
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 max-w-5xl mx-auto print:shadow-none print:border-none print:p-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 print:hidden">
                <h3 className="text-xl font-bold">Rekapitulasi Nilai</h3>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  {/* Dropdown Filter Mapel */}
                  <select 
                    value={recapFilterMapel} 
                    onChange={(e) => setRecapFilterMapel(e.target.value)} 
                    className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none font-semibold text-slate-700 flex-1 sm:flex-none"
                  >
                    <option value="">Semua Mapel</option>
                    {availableRecapMapel.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>

                  <button onClick={() => window.print()} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold"><Download size={18}/> Cetak</button>
                </div>
              </div>
              
              {/* KOP SURAT PRINT */}
              <div className="hidden print:block mb-8 border-b-4 border-double border-black pb-4 text-center">
                <h1 className="text-2xl font-black uppercase tracking-widest text-black">MTS DARMA PERTIWI</h1>
                <h2 className="text-lg font-bold text-black mt-1">SISTEM UJIAN BERBASIS KOMPUTER (CBT)</h2>
                <p className="text-sm text-gray-800 mt-2">Daftar Rekapitulasi Nilai Siswa {recapFilterMapel && `- Mata Pelajaran: ${recapFilterMapel}`}</p>
              </div>

              <table className="w-full text-left print:mt-4">
                <thead>
                  <tr className="border-b-2 border-gray-100 print:border-black bg-gray-50/50 print:bg-gray-100">
                    <th className="p-4 font-bold text-gray-800 w-16">No</th>
                    <th className="p-4 font-bold text-gray-800">Nama Siswa</th>
                    <th className="p-4 font-bold text-gray-800">Mapel</th>
                    <th className="p-4 font-bold text-gray-800">Kelas</th>
                    <th className="p-4 font-bold text-gray-800 text-right">Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 print:divide-black">
                  {filteredLeaderboard.map((s, idx) => (
                    <tr key={idx}>
                      <td className="p-4 font-bold text-gray-600">{idx + 1}</td>
                      <td className="p-4 font-bold text-slate-800">{s.name}</td>
                      <td className="p-4 text-emerald-700 font-bold text-sm">{s.mapel || '-'}</td>
                      <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-sm font-bold">{s.class}</span></td>
                      <td className="p-4 text-right"><span className="text-xl font-black text-emerald-600 print:text-black">{s.score}</span></td>
                    </tr>
                  ))}
                  {filteredLeaderboard.length === 0 && <tr><td colSpan="5" className="text-center p-10 text-gray-500">Data nilai belum ada / tidak ditemukan.</td></tr>}
                </tbody>
              </table>
              
              {/* TANDA TANGAN PRINT DENGAN NAMA GURU */}
              <div className="hidden print:flex justify-end mt-16 pt-8">
                <div className="text-center">
                  <p className="text-black mb-16">Mengetahui,<br/>Guru Mata Pelajaran</p>
                  <p className="text-black font-bold border-b border-black inline-block min-w-[200px] pb-1 uppercase">{teacherProfile.name}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] print:hidden">
          <div className="bg-white p-8 rounded-3xl w-full max-w-2xl shadow-2xl">
            <h2 className="text-2xl font-black mb-6 text-slate-800">Tulis Soal Manual</h2>
            <form onSubmit={handleAddSoal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4"><input required value={formData.mapel} placeholder="Cth: Matematika" className="p-3.5 border bg-gray-50 rounded-xl font-bold focus:ring-2 ring-emerald-300 outline-none" onChange={e => setFormData({...formData, mapel: e.target.value})} /><input required value={formData.kelas} placeholder="Cth: IX-A" className="p-3.5 border bg-gray-50 rounded-xl font-bold focus:ring-2 ring-emerald-300 outline-none" onChange={e => setFormData({...formData, kelas: e.target.value})} /></div>
              <textarea required value={formData.pertanyaan} placeholder="Tulis pertanyaan di sini..." className="w-full p-4 rounded-xl border bg-gray-50 focus:ring-2 ring-emerald-300 outline-none resize-none font-medium" rows="3" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">{['A','B','C','D'].map(opt => (<input key={opt} required value={formData[`opsi${opt}`]} placeholder={`Pilihan ${opt}`} className="p-3.5 border bg-gray-50 rounded-xl focus:ring-2 ring-emerald-300 outline-none" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} />))}</div>
              <div className="pt-2"><label className="text-sm font-bold text-emerald-800 mb-2 block">Kunci Jawaban Benar:</label><select className="w-full p-3.5 border border-emerald-200 rounded-xl bg-emerald-50 font-black text-emerald-900 outline-none" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}><option value="A">Jawaban A</option><option value="B">Jawaban B</option><option value="C">Jawaban C</option><option value="D">Jawaban D</option></select></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 py-4 rounded-xl font-bold text-gray-700">Batalkan</button><button type="submit" className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-600/30">Simpan Soal</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}