import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref as dbRef, onValue, push, remove, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap, Edit } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  const [teacherProfile, setTeacherProfile] = useState({ name: 'Memuat...', email: auth.currentUser?.email });
  const fileInputRef = useRef(null);
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';

  // STATE FILTER SESI
  const [selectedMapelSesi, setSelectedMapelSesi] = useState('');

  // STATE FILTER BANK SOAL (Tanpa Sub-Kelas)
  const [bankMapel, setBankMapel] = useState('');
  const [bankKelas, setBankKelas] = useState('');

  // STATE FILTER REKAP NILAI (Lengkap 3 Lapis)
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [recapSubKelas, setRecapSubKelas] = useState('');

  // STATE FORM SOAL & EDIT
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

  // FUNGSI AKSI SOAL
  const handleAddOrEditSoal = (e) => { 
    e.preventDefault(); 
    if (editSoalId) {
      update(dbRef(db, `bank_soal/${editSoalId}`), { ...formData });
      alert("Soal berhasil diperbarui!");
    } else {
      push(dbRef(db, 'bank_soal'), { ...formData, teacherEmail: currentUserEmail }); 
      alert("Soal baru berhasil ditambahkan!");
    }
    setShowModal(false); setEditSoalId(null); setFormData(defaultForm); 
  };

  const openEditModal = (q) => {
    setFormData({ mapel: q.mapel||'', kelas: q.kelas||'', pertanyaan: q.pertanyaan||'', opsiA: q.opsiA||'', opsiB: q.opsiB||'', opsiC: q.opsiC||'', opsiD: q.opsiD||'', kunci: q.kunci||'A' });
    setEditSoalId(q.id); setShowModal(true);
  };

  // AMAN DARI SILENT CRASH
  const downloadTemplate = () => { 
    try {
      const ws = XLSX.utils.json_to_sheet([{ mapel: "Matematika", kelas: "9", pertanyaan: "Jika $x^2 = 4$, maka $x$ adalah?", opsiA: "2", opsiB: "3", opsiC: "4", opsiD: "5", kunci: "A" }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Soal");
      XLSX.writeFile(wb, "Template_CBT_Soal.xlsx"); 
    } catch(err) { alert("Gagal mendownload template: " + err.message); }
  };

  const triggerImport = () => {
    if(fileInputRef.current) fileInputRef.current.click();
    else alert("Tombol belum siap, silakan muat ulang halaman.");
  };

  const handleFileUpload = (e) => { 
    try {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader(); 
      reader.onload = (evt) => { 
        const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); 
        let count = 0;
        d.forEach(i => { if (i.pertanyaan && i.kunci) { push(dbRef(db, 'bank_soal'), { ...i, teacherEmail: currentUserEmail }); count++; } }); 
        alert(`${count} Soal berhasil di-import dari Excel!`); 
        if(fileInputRef.current) fileInputRef.current.value = ''; 
      }; 
      reader.readAsBinaryString(file); 
    } catch(err) { alert("Gagal import file: " + err.message); }
  };
  
  // FUNGSI SESI
  const handleCreateSession = (e) => { e.preventDefault(); const t = document.getElementById('token_input').value; const k = document.getElementById('kelas_session').value; const sk = document.getElementById('subkelas_session').value.toUpperCase(); if(!t || !selectedMapelSesi || !k || !sk) return alert("Lengkapi data!"); push(dbRef(db, 'exam_sessions'), { token: t, mapel: selectedMapelSesi, kelas: k, subKelas: sk, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now() }); document.getElementById('token_input').value = ''; alert("Sesi dibuka!"); };
  const toggleSession = (id, s) => update(dbRef(db, `exam_sessions/${id}`), { status: s === 'open' ? 'closed' : 'open' });
  const delSession = (id) => { if(window.confirm("Hapus?")) remove(dbRef(db, `exam_sessions/${id}`)); };
  const setMonitor = (t) => { setActiveMonitorToken(t); localStorage.setItem('activeMonitorToken', t); setActiveTab('proctor'); };

  const NavItem = ({ tab, icon: Icon, label }) => (<button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 hover:bg-emerald-50'}`}><Icon size={20}/> <span className="font-semibold">{label}</span></button>);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <style>{`@media print { @page { margin: 1cm; } body { background: white !important; } aside, header, button, select, input, .print\\:hidden { display: none !important; } main { padding: 0 !important; width: 100% !important; overflow: visible !important; } table { width: 100% !important; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #000 !important; padding: 10px !important; color: black !important; font-size: 14px; } th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; } .shadow-sm, .rounded-xl { box-shadow: none !important; border: none !important; } }`}</style>
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden print:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 print:hidden`}>
        <div className="p-6 border-b flex justify-between items-center"><h1 className="text-xl font-black text-emerald-600 flex gap-2"><GraduationCap size={26}/> CBT BRO</h1><button className="md:hidden text-gray-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button></div>
        <div className="p-4 border-b"><p className="text-xs font-bold text-emerald-500 uppercase mb-1">Guru</p><p className="text-sm font-bold truncate uppercase">{teacherProfile?.name}</p></div>
        <nav className="flex-1 p-4 space-y-2"><NavItem tab="settings" icon={Settings} label="Sesi Ujian" /><NavItem tab="proctor" icon={Users} label="Monitor Live" /><NavItem tab="bank" icon={BookOpen} label="Bank Soal" /><NavItem tab="recap" icon={BarChart} label="Rekap Nilai" /></nav>
        <div className="p-4 border-t"><button onClick={onLogout} className="w-full flex gap-3 p-3 text-red-600 font-bold"><LogOut size={20}/> Logout</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b p-4 flex justify-between items-center print:hidden pr-16 md:pr-4">
          <div className="flex items-center gap-3"><button className="md:hidden p-2 bg-gray-100 rounded-lg text-gray-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button><h2 className="text-xl font-bold text-slate-800">Dasbor Guru</h2></div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black uppercase">{teacherProfile?.name?.charAt(0) || 'G'}</div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
          
          {/* TAB SESI */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border h-fit"><h3 className="font-bold mb-4 flex items-center gap-2"><Plus className="text-emerald-500"/> Buka Sesi</h3>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-3.5 border rounded-xl outline-none font-semibold text-slate-700"><option value="">Mapel...</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <div className="flex gap-2"><select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-3.5 border rounded-xl outline-none font-semibold text-slate-700"><option value="">Tingkat...</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select><input id="subkelas_session" placeholder="Sub/Ruang (Cth: A)" required className="w-full p-3.5 border rounded-xl uppercase font-bold text-center" /></div>
                  <div className="flex gap-2"><input id="token_input" required placeholder="Token Akses" className="w-full p-3.5 border rounded-xl uppercase font-mono font-bold tracking-widest" /><button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-3.5 bg-emerald-100 text-emerald-700 rounded-xl"><Dices/></button></div>
                  <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-md active:scale-95 transition-transform">Rilis Sesi</button>
                </form>
              </div>
              <div className="lg:col-span-2 space-y-4"><h3 className="font-bold">Sesi Ujian Aktif</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{mySessions.map((s) => (
                    <div key={s.id} className={`p-5 rounded-2xl border ${s.status==='open'?'bg-white shadow-sm border-emerald-200':'bg-gray-50 border-gray-200'}`}><div className="flex justify-between items-start mb-4"><div><h4 className="text-2xl font-black font-mono tracking-widest text-slate-800">{s.token}</h4><div className="flex flex-wrap gap-2 mt-2"><span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">{s.mapel}</span><span className="bg-gray-200 text-xs px-2 py-1 rounded font-bold text-gray-700">Kls: {s.kelas}-{s.subKelas}</span></div></div><span className={`p-1.5 rounded-full ${s.status==='open'?'bg-emerald-100 text-emerald-600':'bg-red-100 text-red-600'}`}>{s.status==='open'?<Unlock size={16}/>:<Lock size={16}/>}</span></div>
                    <div className="flex gap-2 pt-4 border-t"><button onClick={() => setMonitor(s.token)} className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm font-bold flex justify-center gap-2"><Eye size={16}/> Monitor</button><button onClick={() => toggleSession(s.id, s.status)} className="p-2.5 bg-gray-100 rounded-xl text-gray-600">{s.status==='open'?<Lock size={18}/>:<Unlock size={18}/>}</button><button onClick={() => delSession(s.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl"><Trash2 size={18}/></button></div></div>
                  ))}</div>
              </div>
            </div>
          )}

          {/* TAB MONITOR */}
          {activeTab === 'proctor' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 font-bold text-emerald-800"><Eye size={22}/><span>Monitor Live:</span></div>
                <select value={activeMonitorToken} onChange={(e) => setMonitor(e.target.value)} className="w-full sm:w-auto p-3 rounded-xl border outline-none font-bold text-slate-700 bg-white"><option value="">-- Pilih Sesi --</option>{mySessions.map(s => <option key={s.token} value={s.token}>{s.token} ({s.kelas}-{s.subKelas})</option>)}</select>
              </div>
              {!activeMonitorToken ? (
                <div className="bg-white p-10 rounded-2xl border border-dashed text-center flex flex-col items-center text-gray-400"><Filter size={48} className="mb-4 opacity-50"/><h3 className="font-bold">Menunggu Token</h3></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 md:p-6 rounded-2xl border-l-4 border-l-emerald-400 shadow-sm"><p className="text-gray-500 text-xs md:text-sm font-bold mb-1">Terhubung</p><p className="text-3xl md:text-4xl font-black text-slate-800">{monitoredStudents.length}</p></div>
                    <div className="bg-white p-4 md:p-6 rounded-2xl border-l-4 border-l-emerald-400 shadow-sm"><p className="text-gray-500 text-xs md:text-sm font-bold mb-1">Selesai</p><p className="text-3xl md:text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p></div>
                    <div className="col-span-2 md:col-span-1 bg-white p-4 md:p-6 rounded-2xl border-l-4 border-l-red-400 shadow-sm"><p className="text-gray-500 text-xs md:text-sm font-bold mb-1">Curang</p><p className="text-3xl md:text-4xl font-black text-red-600">{monitoredStudents.filter(s => s.warnings > 0).length}</p></div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto w-full"><table className="w-full min-w-[500px] text-left"><thead className="bg-gray-50 border-b"><tr><th className="p-4">Nama Siswa</th><th className="p-4">Kls / Sub</th><th className="p-4">Progress</th><th className="p-4 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-gray-100">{monitoredStudents.map(s => (<tr key={s.id}><td className="p-4 font-bold text-slate-800">{s?.name || '-'} {s?.warnings > 0 && <span className="text-red-500 text-xs ml-2 animate-pulse">(!Tab)</span>}</td><td className="p-4"><span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">{s?.class}-{s?.subKelas}</span></td><td className="p-4"><div className="flex items-center gap-2"><div className="w-24 bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{width:`${s?.progress}%`}}></div></div><span className="text-xs font-bold">{s?.progress}%</span></div></td><td className="p-4 text-right"><button onClick={() => update(dbRef(db, `live_students/${s.id}`), { status: 'Selesai' })} disabled={s.status === 'Selesai'} className="text-xs bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 px-3 py-2 rounded-lg font-bold disabled:opacity-30">Kumpul</button></td></tr>))}{monitoredStudents.length === 0 && <tr><td colSpan="4" className="text-center p-8 text-gray-400">Belum ada siswa.</td></tr>}</tbody></table></div>
                </>
              )}
            </div>
          )}

          {/* TAB BANK SOAL (UI HP DIPERBAIKI) */}
          {activeTab === 'bank' && (
            <div className="space-y-6">
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border print:hidden space-y-4">
                {/* Baris 1: Filter Dropdown */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <select value={bankMapel} onChange={e => setBankMapel(e.target.value)} className="flex-1 p-3 border rounded-xl bg-gray-50 outline-none text-sm font-bold text-slate-700 cursor-pointer"><option value="">Semua Mapel</option>{availableBankMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={bankKelas} onChange={e => setBankKelas(e.target.value)} className="flex-1 p-3 border rounded-xl bg-gray-50 outline-none text-sm font-bold text-slate-700 cursor-pointer"><option value="">Semua Tingkat</option>{availableBankKelas.map(k => <option key={k}>{k}</option>)}</select>
                </div>
                
                {/* Baris 2: Tombol Aksi */}
                <div className="flex flex-wrap gap-2 sm:gap-3 pt-3 border-t border-gray-100">
                  <button onClick={downloadTemplate} className="flex-1 sm:flex-none bg-white border border-gray-200 text-slate-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"><Download size={18}/> Template</button>
                  <button onClick={triggerImport} className="flex-1 sm:flex-none bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"><Upload size={18}/> Import</button>
                  <button onClick={() => { setEditSoalId(null); setFormData(defaultForm); setShowModal(true); }} className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform"><Plus size={18}/> Buat Soal</button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest">MTS DARMA PERTIWI</h1>
                <h2 className="text-lg font-bold mt-1">BANK SOAL UJIAN (CBT)</h2>
                <p className="mt-2 text-sm font-bold">Mapel: {bankMapel || 'Semua'} | Tingkat: {bankKelas || 'Semua'}</p>
              </div>

              <div className="space-y-4">{filteredQuestions.map((q, i) => (
                <div key={q.id} className="bg-white p-5 md:p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 justify-between print:border-b print:shadow-none print:mb-4 print:pb-4 relative z-0">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-3 print:hidden"><span className="text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">{q?.mapel}</span><span className="text-xs font-bold bg-gray-100 px-2.5 py-1 rounded-lg text-gray-600">Tk. {q?.kelas}</span></div>
                    <p className="font-bold text-lg mb-4 text-slate-800 leading-relaxed"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className={`p-3 border rounded-xl print:border-none print:p-1 ${q?.kunci==='A'?'bg-emerald-50 border-emerald-200 font-bold text-emerald-900 print:bg-gray-200':''}`}><Latex>{`A. ${q?.opsiA || ''}`}</Latex></div>
                      <div className={`p-3 border rounded-xl print:border-none print:p-1 ${q?.kunci==='B'?'bg-emerald-50 border-emerald-200 font-bold text-emerald-900 print:bg-gray-200':''}`}><Latex>{`B. ${q?.opsiB || ''}`}</Latex></div>
                      <div className={`p-3 border rounded-xl print:border-none print:p-1 ${q?.kunci==='C'?'bg-emerald-50 border-emerald-200 font-bold text-emerald-900 print:bg-gray-200':''}`}><Latex>{`C. ${q?.opsiC || ''}`}</Latex></div>
                      <div className={`p-3 border rounded-xl print:border-none print:p-1 ${q?.kunci==='D'?'bg-emerald-50 border-emerald-200 font-bold text-emerald-900 print:bg-gray-200':''}`}><Latex>{`D. ${q?.opsiD || ''}`}</Latex></div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end md:self-start print:hidden mt-2 md:mt-0 relative z-10">
                    <button onClick={() => openEditModal(q)} className="cursor-pointer active:scale-90 text-blue-600 bg-blue-50 border border-blue-100 p-3 rounded-xl shadow-sm"><Edit size={20}/></button>
                    <button onClick={() => remove(dbRef(db, `bank_soal/${q.id}`))} className="cursor-pointer active:scale-90 text-red-500 bg-red-50 border border-red-100 p-3 rounded-xl shadow-sm"><Trash2 size={20}/></button>
                  </div>
                </div>
              ))}
              {filteredQuestions.length === 0 && <div className="text-center p-10 text-gray-400 bg-white rounded-2xl border border-dashed print:hidden">Belum ada soal.</div>}
              </div>
            </div>
          )}

          {/* TAB REKAP NILAI */}
          {activeTab === 'recap' && (
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border print:border-none print:shadow-none print:p-0">
              <div className="bg-gray-50 p-5 rounded-2xl border mb-6 print:hidden space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Filter Rekap Nilai</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select value={recapMapel} onChange={e => setRecapMapel(e.target.value)} className="flex-1 p-3 border rounded-xl outline-none font-bold text-slate-700 bg-white cursor-pointer"><option value="">Semua Mapel</option>{availableRecapMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={recapKelas} onChange={e => setRecapKelas(e.target.value)} className="flex-1 p-3 border rounded-xl outline-none font-bold text-slate-700 bg-white cursor-pointer"><option value="">Semua Tingkat</option>{availableRecapKelas.map(k => <option key={k}>{k}</option>)}</select>
                  <select value={recapSubKelas} onChange={e => setRecapSubKelas(e.target.value)} className="flex-1 p-3 border rounded-xl outline-none font-bold text-slate-700 bg-white cursor-pointer"><option value="">Semua Ruang</option>{availableRecapSubKelas.map(sk => <option key={sk}>{sk}</option>)}</select>
                </div>
                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <button onClick={() => window.print()} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95"><Download size={18}/> Cetak PDF</button>
                </div>
              </div>
              
              <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest">MTS DARMA PERTIWI</h1>
                <h2 className="text-lg font-bold mt-1">HASIL UJIAN BERBASIS KOMPUTER (CBT)</h2>
                <p className="mt-2 text-sm font-bold">Mapel: {recapMapel || 'Semua'} | Tingkat: {recapKelas || 'Semua'} | Ruang: {recapSubKelas || 'Semua'}</p>
              </div>
              
              <div className="overflow-x-auto w-full border border-gray-100 rounded-xl print:border-none print:overflow-visible">
                <table className="w-full min-w-[500px] text-left border-collapse">
                  <thead className="bg-gray-50 print:bg-gray-100"><tr className="border-b"><th className="p-4 print:border font-bold text-gray-700 w-16">Rank</th><th className="p-4 print:border font-bold text-gray-700 min-w-[150px]">Nama Siswa</th><th className="p-4 print:border font-bold text-gray-700">Mapel</th><th className="p-4 print:border font-bold text-gray-700">Kelas / Ruang</th><th className="p-4 print:border font-bold text-gray-700 text-right">Skor</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeaderboard.length > 0 ? filteredLeaderboard.map((s, i) => (
                      <tr key={s?.id || i} className="hover:bg-gray-50/50"><td className="p-4 print:border text-slate-500 font-bold">#{i+1}</td><td className="p-4 print:border font-bold text-slate-800">{s?.name || 'Siswa Tanpa Nama'}</td><td className="p-4 print:border text-emerald-700 font-bold text-sm">{s?.mapel || '-'}</td><td className="p-4 print:border"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{s?.class || '-'}-{s?.subKelas || '-'}</span></td><td className="p-4 print:border text-right"><span className="text-xl font-black text-emerald-600 print:text-black">{s?.score || 0}</span></td></tr>
                    )) : (<tr><td colSpan="5" className="p-10 text-center text-gray-400">Belum ada data nilai masuk.</td></tr>)}
                  </tbody>
                </table>
              </div>
              
              <div className="hidden print:flex justify-end mt-16 text-center"><div><p className="mb-16">Mengetahui,<br/>Guru Mata Pelajaran</p><p className="font-bold uppercase border-b border-black pb-1 min-w-[200px]">{teacherProfile?.name || '_________________'}</p></div></div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL TAMBAH/EDIT SOAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[110] print:hidden">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-4 text-slate-800">{editSoalId ? 'Edit Soal' : 'Tulis Soal Baru'}</h2>
            <form onSubmit={handleAddOrEditSoal} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input required value={formData.mapel} placeholder="Mata Pelajaran" className="w-full p-3.5 border bg-gray-50 rounded-xl outline-none focus:ring-2 ring-emerald-300 font-bold" onChange={e => setFormData({...formData, mapel: e.target.value})} />
                <input required value={formData.kelas} placeholder="Tingkat (Cth: 9)" className="w-full p-3.5 border bg-gray-50 rounded-xl outline-none focus:ring-2 ring-emerald-300 font-bold" onChange={e => setFormData({...formData, kelas: e.target.value})} />
              </div>
              
              <textarea required value={formData.pertanyaan} placeholder="Pertanyaan (Gunakan $...$ untuk matematika)" className="w-full p-4 border bg-gray-50 rounded-xl outline-none focus:ring-2 ring-emerald-300 min-h-[100px]" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{['A','B','C','D'].map(opt => <input key={opt} required value={formData[`opsi${opt}`]} placeholder={`Opsi ${opt}`} className="w-full p-3.5 border bg-gray-50 rounded-xl outline-none focus:ring-2 ring-emerald-300" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} />)}</div>
              <select className="w-full p-3.5 border border-emerald-200 bg-emerald-50 text-emerald-900 font-black rounded-xl outline-none cursor-pointer" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}><option value="A">Kunci A</option><option value="B">Kunci B</option><option value="C">Kunci C</option><option value="D">Kunci D</option></select>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditSoalId(null); setFormData(defaultForm); }} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-600 active:scale-95 transition-transform cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform cursor-pointer">{editSoalId ? 'Update Soal' : 'Simpan Soal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
