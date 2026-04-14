import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref as dbRef, onValue, push, remove, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
// BUG FIX: Ikon 'Activity' sudah ditambahkan di bawah ini 👇
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap, Edit, Activity } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  // ANTI REFRESH TAB
  const [activeTab, setActiveTab] = useState(localStorage.getItem('teacherTab') || 'settings');
  useEffect(() => { localStorage.setItem('teacherTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  const [teacherProfile, setTeacherProfile] = useState({ name: 'Memuat...', email: auth.currentUser?.email });
  const fileInputRef = useRef(null);
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';

  const [selectedMapelSesi, setSelectedMapelSesi] = useState('');
  const [bankMapel, setBankMapel] = useState('');
  const [bankKelas, setBankKelas] = useState('');
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [recapSubKelas, setRecapSubKelas] = useState('');

  const defaultForm = { mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' };
  const [formData, setFormData] = useState(defaultForm);
  const [editSoalId, setEditSoalId] = useState(null);

  useEffect(() => {
    if(auth.currentUser) {
      onValue(dbRef(db, `users/${auth.currentUser.uid}`), snap => { 
        setTeacherProfile(snap.exists() && snap.val()?.name ? snap.val() : { name: currentUserEmail.split('@')[0], email: currentUserEmail }); 
      });
    }
    const fetchData = (path, key) => onValue(dbRef(db, path), snap => {
      const val = snap.val();
      if (val && typeof val === 'object') setData(prev => ({ ...prev, [key]: Object.keys(val).map(k => ({ id: k, ...val[k] })) }));
      else setData(prev => ({ ...prev, [key]: [] }));
    });
    fetchData('live_students', 'live'); fetchData('bank_soal', 'bank'); fetchData('leaderboard', 'lead'); fetchData('exam_sessions', 'sessions');
  }, [currentUserEmail]);

  const myQuestions = (data.bank || []).filter(q => q?.teacherEmail === currentUserEmail);
  const mySessions = (data.sessions || []).filter(s => s?.teacherEmail === currentUserEmail);
  const myLeaderboard = (data.lead || []).filter(s => s?.teacherEmail === currentUserEmail).sort((a,b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));
  const monitoredStudents = (data.live || []).filter(s => s?.token === activeMonitorToken);

  const availableMapel = [...new Set(myQuestions.map(q => q?.mapel).filter(Boolean))];
  const availableKelasSesi = [...new Set(myQuestions.filter(q => q?.mapel === selectedMapelSesi).map(q => q?.kelas).filter(Boolean))];

  const availableBankMapel = [...new Set(myQuestions.map(q => q?.mapel).filter(Boolean))];
  const availableBankKelas = [...new Set(myQuestions.map(q => q?.kelas).filter(Boolean))];
  const filteredQuestions = myQuestions.filter(q => (bankMapel === '' || q?.mapel === bankMapel) && (bankKelas === '' || q?.kelas === bankKelas));

  const availableRecapMapel = [...new Set(myLeaderboard.map(s => s?.mapel).filter(Boolean))];
  const availableRecapKelas = [...new Set(myLeaderboard.map(s => s?.class).filter(Boolean))];
  const availableRecapSubKelas = [...new Set(myLeaderboard.map(s => s?.subKelas).filter(Boolean))];
  const filteredLeaderboard = myLeaderboard.filter(s => (recapMapel === '' || s?.mapel === recapMapel) && (recapKelas === '' || s?.class === recapKelas) && (recapSubKelas === '' || s?.subKelas === recapSubKelas));

  const handleAddOrEditSoal = (e) => { 
    e.preventDefault(); 
    if (editSoalId) { update(dbRef(db, `bank_soal/${editSoalId}`), { ...formData }); alert("Soal diperbarui!"); } 
    else { push(dbRef(db, 'bank_soal'), { ...formData, teacherEmail: currentUserEmail }); alert("Soal ditambahkan!"); }
    setShowModal(false); setEditSoalId(null); setFormData(defaultForm); 
  };

  const openEditModal = (q) => { setFormData({ mapel: q.mapel||'', kelas: q.kelas||'', pertanyaan: q.pertanyaan||'', opsiA: q.opsiA||'', opsiB: q.opsiB||'', opsiC: q.opsiC||'', opsiD: q.opsiD||'', kunci: q.kunci||'A' }); setEditSoalId(q.id); setShowModal(true); };
  
  // === BUG INVALID WORKBOOK FIX ===
  const downloadTemplate = () => { 
    try {
      const wsData = [{ mapel: "Matematika", kelas: "9", pertanyaan: "Jika $x^2 = 4$, maka $x$ adalah?", opsiA: "2", opsiB: "3", opsiC: "4", opsiD: "5", kunci: "A" }];
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Soal");
      XLSX.writeFile(wb, "Template_CBT_Soal.xlsx"); 
    } catch(err) { 
      alert("Gagal mendownload: " + err.message); 
    } 
  };
  
  const triggerImport = () => { if(fileInputRef.current) fileInputRef.current.click(); };
  const handleFileUpload = (e) => { try { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); let count = 0; d.forEach(i => { if (i.pertanyaan && i.kunci) { push(dbRef(db, 'bank_soal'), { ...i, teacherEmail: currentUserEmail }); count++; } }); alert(`${count} Soal di-import!`); if(fileInputRef.current) fileInputRef.current.value = ''; }; reader.readAsBinaryString(file); } catch(err) { alert("Gagal: " + err.message); } };
  
  const handleCreateSession = (e) => { e.preventDefault(); const t = document.getElementById('token_input').value; const k = document.getElementById('kelas_session').value; const sk = document.getElementById('subkelas_session').value.toUpperCase(); if(!t || !selectedMapelSesi || !k || !sk) return alert("Lengkapi data!"); push(dbRef(db, 'exam_sessions'), { token: t, mapel: selectedMapelSesi, kelas: k, subKelas: sk, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now() }); document.getElementById('token_input').value = ''; alert("Sesi dibuka!"); };
  const toggleSession = (id, s) => update(dbRef(db, `exam_sessions/${id}`), { status: s === 'open' ? 'closed' : 'open' });
  const delSession = (id) => { if(window.confirm("Hapus?")) remove(dbRef(db, `exam_sessions/${id}`)); };
  const setMonitor = (t) => { setActiveMonitorToken(t); localStorage.setItem('activeMonitorToken', t); setActiveTab('proctor'); };

  const NavItem = ({ tab, icon: Icon, label }) => (<button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-500 text-white font-black shadow-md' : 'text-slate-600 hover:bg-emerald-50 font-bold'}`}><Icon size={20}/> <span>{label}</span></button>);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* STYLE CETAK KHUSUS TABEL */}
      <style>{`@media print { @page { margin: 1cm; } body { background: white !important; } aside, header, button, select, input, .print\\:hidden { display: none !important; } main { padding: 0 !important; width: 100% !important; overflow: visible !important; } .print\\:block { display: block !important; } table { width: 100% !important; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #000 !important; padding: 10px !important; color: black !important; font-size: 14px; } th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; } }`}</style>
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
        <div className="p-6 border-b flex justify-between items-center"><h1 className="text-xl font-black text-emerald-600 flex gap-3 items-center"><GraduationCap size={28}/> CBT BRO</h1><button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button></div>
        <div className="p-6 border-b bg-emerald-50">
          <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Akses Guru</p>
          <p className="text-sm font-bold truncate text-slate-800 uppercase">{teacherProfile?.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Users} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai" />
        </nav>
        <div className="p-6 border-t"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl font-bold transition-colors shadow-sm"><LogOut size={20}/> Keluar Akun</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b p-4 lg:p-6 flex justify-between items-center shadow-sm z-10 print:hidden pr-16 md:pr-4">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-slate-100 rounded-lg text-emerald-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-xl lg:text-2xl font-black text-slate-800 hidden sm:block tracking-wide">Dasbor Pengajar</h2>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xl uppercase shadow-inner">{teacherProfile?.name?.charAt(0) || 'G'}</div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          
          {/* TAB SESI UJIAN (Desain Kartu) */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit">
                <h3 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2 border-b pb-4"><Plus className="text-emerald-500"/> Buka Sesi Baru</h3>
                <form onSubmit={handleCreateSession} className="space-y-5">
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Pilih Mata Pelajaran</label><select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-4 border bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:ring-2 ring-emerald-300 cursor-pointer"><option value="">-- Daftar Mapel --</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select></div>
                  <div className="flex gap-3"><div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tingkat</label><select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-4 border bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:ring-2 ring-emerald-300 cursor-pointer"><option value="">Pilih</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select></div><div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ruang / Sub</label><input id="subkelas_session" placeholder="Cth: A" required className="w-full p-4 border bg-slate-50 rounded-2xl uppercase font-bold text-center focus:ring-2 ring-emerald-300" /></div></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Token Akses Ujian</label><div className="flex gap-2"><input id="token_input" required placeholder="Generate..." className="w-full p-4 border bg-emerald-50 rounded-2xl uppercase font-mono font-black tracking-widest text-emerald-800 outline-none" /><button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-4 bg-slate-800 text-white hover:bg-slate-700 rounded-2xl active:scale-95 transition-transform"><Dices size={24}/></button></div></div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 mt-2 rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-transform tracking-wide">RILIS UJIAN</button>
                </form>
              </div>
              
              <div className="xl:col-span-2 space-y-4">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 border-b pb-4"><Activity className="text-emerald-500"/> Sesi Aktif Saat Ini</h3>
                {mySessions.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada sesi yang dirilis.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mySessions.map((s) => (
                      <div key={s.id} className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between transition-colors ${s.status==='open'?'bg-white border-emerald-200 hover:border-emerald-400':'bg-slate-50 border-slate-200 opacity-75'}`}>
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-3xl font-black font-mono tracking-widest text-slate-800">{s.token}</h4>
                            <span className={`p-2 rounded-xl shadow-sm ${s.status==='open'?'bg-emerald-100 text-emerald-600':'bg-red-100 text-red-600'}`}>{s.status==='open'?<Unlock size={20}/>:<Lock size={20}/>}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-6">
                            <span className="text-xs font-black bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm">{s.mapel}</span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">Kls: {s.kelas}-{s.subKelas}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-t pt-4">
                          <button onClick={() => setMonitor(s.token)} className="col-span-3 sm:col-span-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-sm font-bold flex justify-center gap-2 shadow-sm active:scale-95"><Eye size={18}/> <span className="sm:hidden">Monitor</span></button>
                          <button onClick={() => toggleSession(s.id, s.status)} className="col-span-3 sm:col-span-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-sm font-bold flex justify-center gap-2 active:scale-95 border border-slate-200">{s.status==='open'?<Lock size={18}/>:<Unlock size={18}/>} <span className="sm:hidden">Kunci</span></button>
                          <button onClick={() => delSession(s.id)} className="col-span-3 sm:col-span-1 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-sm font-bold flex justify-center gap-2 active:scale-95 border border-red-100"><Trash2 size={18}/> <span className="sm:hidden">Hapus</span></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB MONITOR (UI KARTU 100% RESPONSIF) */}
          {activeTab === 'proctor' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 font-black text-emerald-800 text-lg"><Eye size={26}/> Monitor Ujian Live</div>
                <select value={activeMonitorToken} onChange={(e) => setMonitor(e.target.value)} className="w-full sm:w-auto p-4 rounded-xl border border-emerald-200 outline-none font-bold text-slate-700 bg-white cursor-pointer shadow-sm"><option value="">-- Pilih Sesi Token --</option>{mySessions.map(s => <option key={s.token} value={s.token}>{s.token} ({s.kelas}-{s.subKelas})</option>)}</select>
              </div>

              {!activeMonitorToken ? (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center flex flex-col items-center text-slate-400"><Filter size={56} className="mb-4 opacity-50"/><h3 className="font-bold text-xl">Silakan Pilih Token Sesi</h3></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-3xl border-l-4 border-l-blue-500 shadow-sm"><p className="text-slate-500 text-xs font-bold mb-1 uppercase">Terhubung</p><p className="text-4xl font-black text-slate-800">{monitoredStudents.length}</p></div>
                    <div className="bg-white p-5 rounded-3xl border-l-4 border-l-emerald-500 shadow-sm"><p className="text-slate-500 text-xs font-bold mb-1 uppercase">Selesai</p><p className="text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p></div>
                    <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-3xl border-l-4 border-l-red-500 shadow-sm"><p className="text-slate-500 text-xs font-bold mb-1 uppercase">Curang</p><p className="text-4xl font-black text-red-600">{monitoredStudents.filter(s => s.warnings > 0).length}</p></div>
                  </div>
                  
                  {/* DAFTAR SISWA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {monitoredStudents.map(s => (
                      <div key={s.id} className="bg-white p-5 rounded-3xl border shadow-sm flex flex-col gap-4 hover:border-emerald-300 transition-colors">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                          <div>
                            <p className="font-black text-slate-800 text-lg leading-tight">{s?.name || '-'}</p>
                            <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold border border-emerald-200">{s?.class}-{s?.subKelas}</span>
                          </div>
                          {s?.warnings > 0 && <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-1 rounded border border-red-200 animate-pulse whitespace-nowrap">(!Tab {s.warnings}x)</span>}
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2"><span>Progress Ujian</span><span className="text-emerald-600">{s?.progress}%</span></div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner"><div className="bg-emerald-500 h-full transition-all duration-500" style={{width:`${s?.progress}%`}}></div></div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button onClick={() => update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true })} disabled={s.status === 'Selesai'} className="flex-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 rounded-xl font-bold disabled:opacity-50 active:scale-95 transition-all">Tarik Paksa</button>
                          {s?.warnings >= 3 && s?.status !== 'Selesai' && (
                            <button onClick={() => update(dbRef(db, `live_students/${s.id}`), { warnings: 0, status: 'Online' })} className="flex-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 py-3 rounded-xl font-bold active:scale-95 transition-all">Buka Kunci</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {monitoredStudents.length === 0 && <div className="col-span-full text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada siswa yang masuk ke ruangan ini.</div>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB BANK SOAL */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto print:max-w-full">
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              
              <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border print:hidden space-y-5">
                <div className="flex flex-col sm:flex-row gap-4">
                  <select value={bankMapel} onChange={e => setBankMapel(e.target.value)} className="flex-1 p-4 border rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:ring-2 ring-emerald-300"><option value="">-- Filter Mapel --</option>{availableBankMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={bankKelas} onChange={e => setBankKelas(e.target.value)} className="flex-1 p-4 border rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:ring-2 ring-emerald-300"><option value="">-- Filter Tingkat --</option>{availableBankKelas.map(k => <option key={k}>{k}</option>)}</select>
                </div>
                
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                  <button onClick={downloadTemplate} className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 px-5 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 shadow-sm"><Download size={18}/> Template</button>
                  <button onClick={triggerImport} className="flex-1 sm:flex-none bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 shadow-sm"><Upload size={18}/> Import</button>
                  <button onClick={() => { setEditSoalId(null); setFormData(defaultForm); setShowModal(true); }} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 ml-auto"><Plus size={18}/> Buat Soal Manual</button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest">MTS DARMA PERTIWI</h1>
                <h2 className="text-lg font-bold mt-1">BANK SOAL UJIAN (CBT)</h2>
                <p className="mt-2 text-sm font-bold">Mapel: {bankMapel || 'Semua'} | Tingkat: {bankKelas || 'Semua'}</p>
              </div>

              <div className="space-y-4">
                {filteredQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-6 justify-between print:border-b print:shadow-none print:mb-4 print:pb-4 print:rounded-none">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-4 print:hidden border-b border-slate-100 pb-4"><span className="text-xs font-black bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm">{q?.mapel}</span><span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">Tk. {q?.kelas}</span></div>
                      <p className="font-bold text-lg mb-6 text-slate-800 leading-relaxed"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 font-medium">
                        {['A','B','C','D'].map(opt => (
                          <div key={opt} className={`p-4 rounded-2xl border print:border-none print:p-1 ${q?.kunci===opt?'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 print:bg-gray-200 shadow-sm':'bg-slate-50 border-slate-200'}`}><Latex>{`${opt}. ${q[`opsi${opt}`]}`}</Latex></div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 self-end md:self-start print:hidden mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
                      <button onClick={() => openEditModal(q)} className="flex-1 md:flex-none flex justify-center items-center active:scale-95 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 p-4 rounded-xl shadow-sm transition-colors"><Edit size={22}/></button>
                      <button onClick={() => remove(dbRef(db, `bank_soal/${q.id}`))} className="flex-1 md:flex-none flex justify-center items-center active:scale-95 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 p-4 rounded-xl shadow-sm transition-colors"><Trash2 size={22}/></button>
                    </div>
                  </div>
                ))}
                {filteredQuestions.length === 0 && <div className="text-center p-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300 font-bold print:hidden">Belum ada soal yang tersedia.</div>}
              </div>
            </div>
          )}

          {/* TAB REKAP NILAI (UI KARTU DI HP, TABEL DI PRINT) */}
          {activeTab === 'recap' && (
            <div className="space-y-6 max-w-6xl mx-auto print:max-w-full">
              <div className="bg-white p-6 rounded-3xl shadow-sm border print:hidden space-y-5">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 border-b pb-4"><BarChart className="text-emerald-500"/> Filter Rekapitulasi</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select value={recapMapel} onChange={e => setRecapMapel(e.target.value)} className="flex-1 p-4 border rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:ring-2 ring-emerald-300"><option value="">Semua Mapel</option>{availableRecapMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={recapKelas} onChange={e => setRecapKelas(e.target.value)} className="flex-1 p-4 border rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:ring-2 ring-emerald-300"><option value="">Semua Tingkat</option>{availableRecapKelas.map(k => <option key={k}>{k}</option>)}</select>
                  <select value={recapSubKelas} onChange={e => setRecapSubKelas(e.target.value)} className="flex-1 p-4 border rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:ring-2 ring-emerald-300"><option value="">Semua Ruang</option>{availableRecapSubKelas.map(sk => <option key={sk}>{sk}</option>)}</select>
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button onClick={() => window.print()} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all tracking-wide"><Download size={20}/> CETAK DOKUMEN PDF</button>
                </div>
              </div>
              
              <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest">MTS DARMA PERTIWI</h1>
                <h2 className="text-lg font-bold mt-1">HASIL UJIAN BERBASIS KOMPUTER (CBT)</h2>
                <p className="mt-2 text-sm font-bold">Mapel: {recapMapel || 'Semua'} | Tingkat: {recapKelas || 'Semua'} | Ruang: {recapSubKelas || 'Semua'}</p>
              </div>
              
              {/* TAMPILAN DI LAYAR HP/WEB (DESAIN KARTU 100% RESPONSIF) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
                {filteredLeaderboard.map((s, i) => (
                  <div key={s?.id || i} className="bg-white p-5 rounded-3xl border shadow-sm flex items-center justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-slate-800 text-white text-xs font-black px-2 py-0.5 rounded-md">#{i+1}</span>
                        <p className="font-black text-slate-800 text-lg leading-tight truncate max-w-[150px] sm:max-w-[200px]">{s?.name || 'Anonim'}</p>
                      </div>
                      <p className="text-xs font-bold text-slate-500">{s?.mapel || '-'} • Kls: {s?.class || '-'}-{s?.subKelas || '-'}</p>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">{s?.score || 0}</div>
                  </div>
                ))}
                {filteredLeaderboard.length === 0 && <div className="col-span-full text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada data nilai masuk.</div>}
              </div>

              {/* TAMPILAN KHUSUS KERTAS CETAK (TABEL RAPI) */}
              <div className="hidden print:block">
                <table className="w-full text-left">
                  <thead><tr className="border-b-2 border-black"><th className="py-3 font-bold w-16">Rank</th><th className="py-3 font-bold">Nama Siswa</th><th className="py-3 font-bold">Mapel</th><th className="py-3 font-bold">Kelas/Ruang</th><th className="py-3 font-bold text-right">Skor</th></tr></thead>
                  <tbody className="divide-y divide-gray-300">
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s?.id || i}>
                        <td className="py-3 font-bold text-gray-600">#{i+1}</td>
                        <td className="py-3 font-bold text-black">{s?.name || 'Anonim'}</td>
                        <td className="py-3 text-sm">{s?.mapel || '-'}</td>
                        <td className="py-3 text-sm">{s?.class || '-'}-{s?.subKelas || '-'}</td>
                        <td className="py-3 font-black text-right">{s?.score || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-16 text-center"><div><p className="mb-16">Mengetahui,<br/>Guru Mata Pelajaran</p><p className="font-bold uppercase border-b border-black pb-1 min-w-[200px]">{teacherProfile?.name || '_________________'}</p></div></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL TAMBAH/EDIT SOAL MANUAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110] print:hidden">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2 border-b pb-4"><Edit className="text-emerald-500"/> {editSoalId ? 'Revisi Soal' : 'Formulir Soal Baru'}</h2>
            <form onSubmit={handleAddOrEditSoal} className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Mapel</label><input required value={formData.mapel} placeholder="Contoh: Matematika" className="w-full p-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-300 font-bold text-slate-800" onChange={e => setFormData({...formData, mapel: e.target.value})} /></div>
                <div className="sm:w-1/3"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tingkat</label><input required value={formData.kelas} placeholder="Cth: 9" className="w-full p-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-300 font-bold text-slate-800 text-center" onChange={e => setFormData({...formData, kelas: e.target.value})} /></div>
              </div>
              
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Teks Pertanyaan (Gunakan $...$ untuk Rumus)</label><textarea required value={formData.pertanyaan} placeholder="Ketikan soal di sini..." className="w-full p-5 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-300 min-h-[120px] leading-relaxed text-slate-800" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} /></div>
              
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Opsi Jawaban</label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{['A','B','C','D'].map(opt => <div key={opt} className="relative"><span className="absolute left-4 top-4 font-black text-slate-400">{opt}.</span><input required value={formData[`opsi${opt}`]} className="w-full pl-10 pr-4 py-4 border bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-emerald-300 text-slate-800" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} /></div>)}</div></div>
              
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Kunci Jawaban Benar</label><select className="w-full p-4 border border-emerald-200 bg-emerald-50 text-emerald-800 font-black rounded-2xl outline-none cursor-pointer focus:ring-2 ring-emerald-400" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}><option value="A">Jawaban A</option><option value="B">Jawaban B</option><option value="C">Jawaban C</option><option value="D">Jawaban D</option></select></div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setShowModal(false); setEditSoalId(null); setFormData(defaultForm); }} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-slate-600 active:scale-95 transition-transform cursor-pointer">Batalkan</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-transform cursor-pointer">{editSoalId ? 'Simpan Revisi' : 'Tambahkan Soal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
