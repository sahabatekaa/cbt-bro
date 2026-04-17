import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref as dbRef, onValue, push, remove, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap, Edit, Activity, User, MessageSquare, Send, FileText, ClipboardList, ShieldAlert, QrCode } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState(localStorage.getItem('teacherTab') || 'settings');
  useEffect(() => { localStorage.setItem('teacherTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  
  // STATE BARU UNTUK FITUR QR CODE
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeQRToken, setActiveQRToken] = useState('');
  
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';
  const [teacherProfile, setTeacherProfile] = useState({ name: 'Memuat...', email: currentUserEmail });
  const [tempProfileName, setTempProfileName] = useState(''); 
  
  const fileInputRef = useRef(null);

  const [selectedMapelSesi, setSelectedMapelSesi] = useState('');
  const [bankMapel, setBankMapel] = useState('');
  const [bankKelas, setBankKelas] = useState('');
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [recapSubKelas, setRecapSubKelas] = useState('');
  
  const [broadcastText, setBroadcastText] = useState(''); 
  const [printMode, setPrintMode] = useState('rekap'); 

  const defaultForm = { mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' };
  const [formData, setFormData] = useState(defaultForm);
  const [editSoalId, setEditSoalId] = useState(null);

  useEffect(() => {
    if(auth.currentUser) {
      onValue(dbRef(db, `users/${auth.currentUser.uid}`), snap => { 
        if (snap.exists() && snap.val()?.name) {
          setTeacherProfile(snap.val());
          setTempProfileName(snap.val().name);
        } else {
          setTeacherProfile({ name: currentUserEmail.split('@')[0], email: currentUserEmail });
          setTempProfileName(currentUserEmail.split('@')[0]);
        }
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

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if(auth.currentUser) {
      update(dbRef(db, `users/${auth.currentUser.uid}`), { name: tempProfileName });
      alert("Profil Anda berhasil diperbarui!");
    }
  };

  const sendBroadcast = () => {
    if(!broadcastText) return;
    if(window.confirm(`Kirim pengumuman darurat ke semua siswa di Ruang Ujian (Token: ${activeMonitorToken})?`)) {
      monitoredStudents.forEach(s => {
        update(dbRef(db, `live_students/${s.id}`), { broadcast: broadcastText });
      });
      setBroadcastText('');
      alert("Pengumuman berhasil disiarkan ke layar siswa!");
    }
  };

  const forceSubmitAll = () => {
    if(window.confirm("🚨 PERINGATAN!\nTarik paksa semua lembar jawaban siswa yang sedang online di sesi ini? Waktu ujian mereka akan langsung berakhir.")) {
      monitoredStudents.forEach(s => {
        if(s.status !== 'Selesai') {
          update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true });
        }
      });
      alert("Perintah tarik paksa terkirim!");
    }
  };

  const handleDeleteMyRecap = async () => {
    if (myLeaderboard.length === 0) return alert("Belum ada data nilai untuk dihapus.");
    if(window.confirm("🚨 PERHATIAN!\nHapus SEMUA rekap nilai siswa khusus untuk mata pelajaran Anda?\n(Data guru lain di server pusat tidak akan terpengaruh).")) {
      try {
        const promises = myLeaderboard.map(s => remove(dbRef(db, `leaderboard/${s.id}`)));
        await Promise.all(promises);
        alert("Data nilai Anda berhasil dibersihkan dari server.");
      } catch (error) {
        alert("Gagal menghapus data: " + error.message);
      }
    }
  };

  const handleAddOrEditSoal = (e) => { 
    e.preventDefault(); 
    if (editSoalId) { update(dbRef(db, `bank_soal/${editSoalId}`), { ...formData }); alert("Soal diperbarui!"); } 
    else { push(dbRef(db, 'bank_soal'), { ...formData, teacherEmail: currentUserEmail }); alert("Soal ditambahkan!"); }
    setShowModal(false); setEditSoalId(null); setFormData(defaultForm); 
  };

  const openEditModal = (q) => { setFormData({ mapel: q.mapel||'', kelas: q.kelas||'', pertanyaan: q.pertanyaan||'', opsiA: q.opsiA||'', opsiB: q.opsiB||'', opsiC: q.opsiC||'', opsiD: q.opsiD||'', kunci: q.kunci||'A' }); setEditSoalId(q.id); setShowModal(true); };
  
  const downloadTemplate = () => { 
    try {
      const wsData = [{ mapel: "Matematika", kelas: "9", pertanyaan: "Jika $x^2 = 4$, maka $x$ adalah?", opsiA: "2", opsiB: "3", opsiC: "4", opsiD: "5", kunci: "A" }];
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Soal");
      XLSX.writeFile(wb, "Template_CBT_Soal.xlsx"); 
    } catch(err) { alert("Gagal mendownload: " + err.message); } 
  };
  
  const triggerImport = () => { if(fileInputRef.current) fileInputRef.current.click(); };
  const handleFileUpload = (e) => { try { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); let count = 0; d.forEach(i => { if (i.pertanyaan && i.kunci) { push(dbRef(db, 'bank_soal'), { ...i, teacherEmail: currentUserEmail }); count++; } }); alert(`${count} Soal di-import!`); if(fileInputRef.current) fileInputRef.current.value = ''; }; reader.readAsBinaryString(file); } catch(err) { alert("Gagal: " + err.message); } };
  
  const handleCreateSession = (e) => { e.preventDefault(); const t = document.getElementById('token_input').value; const k = document.getElementById('kelas_session').value; const sk = document.getElementById('subkelas_session').value.toUpperCase(); if(!t || !selectedMapelSesi || !k || !sk) return alert("Lengkapi data!"); push(dbRef(db, 'exam_sessions'), { token: t, mapel: selectedMapelSesi, kelas: k, subKelas: sk, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now() }); document.getElementById('token_input').value = ''; alert("Sesi dibuka!"); };
  const toggleSession = (id, s) => update(dbRef(db, `exam_sessions/${id}`), { status: s === 'open' ? 'closed' : 'open' });
  const delSession = (id) => { if(window.confirm("Hapus?")) remove(dbRef(db, `exam_sessions/${id}`)); };
  const setMonitor = (t) => { setActiveMonitorToken(t); localStorage.setItem('activeMonitorToken', t); setActiveTab('proctor'); };
  
  // FUNGSI PEMBUKA MODAL QR
  const openQR = (token) => { setActiveQRToken(token); setShowQRModal(true); };

  const NavItem = ({ tab, icon: Icon, label }) => (<button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/30' : 'text-slate-500 hover:bg-slate-100 font-bold'}`}><Icon size={20}/> <span>{label}</span></button>);

  const OfficialHeader = () => (
    <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
      <h1 className="text-2xl font-black uppercase tracking-widest text-black">YASPENDIK PTP NUSANTARA IV</h1>
      <h2 className="text-xl font-black uppercase tracking-widest text-black mt-1">SMP/MTS DARMA PERTIWI BAH BUTONG</h2>
      <p className="mt-2 text-sm font-bold text-gray-800">
        Dokumen Resmi Administrasi Ujian Berbasis Komputer (CBT)
      </p>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      <style>{`
        @media print { 
          @page { margin: 1cm; } 
          body { background: white !important; -webkit-print-color-adjust: exact; } 
          aside, header, button, select, input, .print\\:hidden { display: none !important; } 
          main { padding: 0 !important; width: 100% !important; overflow: visible !important; } 
          .print\\:block { display: block !important; } 
          table { width: 100% !important; border-collapse: collapse; margin-top: 20px; border: 1px solid black; } 
          th, td { border: 1px solid #000 !important; padding: 12px !important; color: black !important; font-size: 14px; } 
          th { background-color: #f3f4f6 !important; font-weight: 900; } 
        }
      `}</style>
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h1 className="text-xl font-black text-emerald-700 flex gap-3 items-center tracking-tight"><GraduationCap size={28} className="text-emerald-500"/> CBT DARMA PERTIWI</h1><button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button></div>
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xl uppercase shadow-inner shrink-0">{teacherProfile?.name?.charAt(0) || 'G'}</div>
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Akses Guru</p>
            <p className="text-sm font-bold truncate text-slate-800">{teacherProfile?.name}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Monitor} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai & Cetak" />
          <div className="my-4 border-t border-slate-100"></div>
          <NavItem tab="profile" icon={User} label="Profil Saya" />
        </nav>
        <div className="p-6 border-t border-slate-100"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl font-bold transition-colors shadow-sm"><LogOut size={20}/> Keluar Akun</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 lg:p-6 flex justify-between items-center z-10 print:hidden pr-16 md:pr-6">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-slate-100 rounded-lg text-emerald-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-xl lg:text-2xl font-black text-slate-800 hidden sm:block tracking-wide">Teacher Center</h2>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Server Aktif</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB SESI UJIAN */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 h-fit">
                <h3 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><Plus className="text-emerald-500"/> Buka Sesi Baru</h3>
                <form onSubmit={handleCreateSession} className="space-y-5">
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Pilih Mata Pelajaran</label><select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:border-emerald-500 focus:bg-white transition-colors cursor-pointer"><option value="">-- Daftar Mapel --</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-3">
                     <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Tingkat</label><select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:border-emerald-500 focus:bg-white cursor-pointer"><option value="">Pilih</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select></div>
                     <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Ruang / Sub</label><input id="subkelas_session" placeholder="Cth: A" required className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl uppercase font-bold text-center focus:border-emerald-500 focus:bg-white transition-colors" /></div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Token Akses Ujian</label><div className="flex gap-2"><input id="token_input" required placeholder="Generate..." className="w-full p-4 border border-emerald-200 bg-emerald-50 rounded-2xl uppercase font-mono font-black tracking-widest text-emerald-800 outline-none" /><button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-4 bg-slate-800 text-white hover:bg-slate-700 rounded-2xl active:scale-95 transition-transform shadow-md"><Dices size={24}/></button></div></div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 mt-4 rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all tracking-widest">RILIS UJIAN</button>
                </form>
              </div>
              
              <div className="xl:col-span-2 space-y-4">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 border-b border-slate-200 pb-4"><Activity className="text-emerald-500"/> Sesi Aktif Saat Ini</h3>
                {mySessions.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada sesi yang dirilis.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mySessions.map((s) => (
                      <div key={s.id} className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between transition-colors ${s.status==='open'?'bg-white border-emerald-200 hover:border-emerald-400':'bg-slate-50 border-slate-200 opacity-75'}`}>
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-3xl font-black font-mono tracking-widest text-slate-800">{s.token}</h4>
                            <span className={`p-2 rounded-xl shadow-sm ${s.status==='open'?'bg-emerald-100 text-emerald-600 border border-emerald-200':'bg-red-100 text-red-600 border border-red-200'}`}>{s.status==='open'?<Unlock size={20}/>:<Lock size={20}/>}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-6">
                            <span className="text-xs font-black bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm">{s.mapel}</span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">Kls: {s.kelas}-{s.subKelas}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-4">
                          {/* TOMBOL BARU: TAMPILKAN QR CODE */}
                          <button onClick={() => openQR(s.token)} className="col-span-4 sm:col-span-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-sm active:scale-95 border border-blue-100"><QrCode size={18}/> <span className="sm:hidden">Tampilkan QR</span></button>
                          
                          <button onClick={() => setMonitor(s.token)} className="col-span-4 sm:col-span-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 shadow-sm active:scale-95"><Eye size={18}/> <span className="sm:hidden">Monitor</span></button>
                          <button onClick={() => toggleSession(s.id, s.status)} className="col-span-4 sm:col-span-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 active:scale-95 border border-slate-200">{s.status==='open'?<Lock size={18}/>:<Unlock size={18}/>} <span className="sm:hidden">Kunci</span></button>
                          <button onClick={() => delSession(s.id)} className="col-span-4 sm:col-span-1 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 active:scale-95 border border-red-100"><Trash2 size={18}/> <span className="sm:hidden">Hapus</span></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB MONITOR */}
          {activeTab === 'proctor' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="bg-white border border-slate-200 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 font-black text-slate-800 text-lg"><Monitor className="text-emerald-500" size={26}/> Live Proctoring</div>
                <select value={activeMonitorToken} onChange={(e) => setMonitor(e.target.value)} className="w-full sm:w-auto p-4 rounded-xl border border-slate-200 outline-none font-bold text-slate-700 bg-slate-50 cursor-pointer shadow-sm focus:border-emerald-500"><option value="">-- Pilih Sesi Token --</option>{mySessions.map(s => <option key={s.token} value={s.token}>{s.token} ({s.kelas}-{s.subKelas})</option>)}</select>
              </div>

              {!activeMonitorToken ? (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center flex flex-col items-center text-slate-400"><Filter size={56} className="mb-4 opacity-30"/><h3 className="font-bold text-xl text-slate-500">Silakan Pilih Token Sesi untuk Memantau</h3></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-3xl border-l-4 border-l-blue-500 shadow-sm"><p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Terhubung</p><p className="text-4xl font-black text-slate-800">{monitoredStudents.length}</p></div>
                    <div className="bg-white p-5 rounded-3xl border-l-4 border-l-emerald-500 shadow-sm"><p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Selesai</p><p className="text-4xl font-black text-emerald-600">{monitoredStudents.filter(s => s.status === 'Selesai').length}</p></div>
                    <div className="bg-white p-5 rounded-3xl border-l-4 border-l-red-500 shadow-sm"><p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Curang</p><p className="text-4xl font-black text-red-600">{monitoredStudents.filter(s => (s?.warnings || 0) > 0).length}</p></div>
                    <div className="bg-slate-900 p-5 rounded-3xl flex flex-col justify-center items-center shadow-lg border border-slate-800">
                       <button onClick={forceSubmitAll} className="w-full h-full bg-red-600 hover:bg-red-500 text-white rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all flex-col p-2 text-center shadow-lg shadow-red-600/30">
                          <ShieldAlert size={24} className="mb-1" /> Tarik Paksa Semua
                       </button>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600"><MessageSquare size={24}/></div>
                    <div className="flex-1 w-full"><input value={broadcastText} onChange={e => setBroadcastText(e.target.value)} placeholder="Tulis pengumuman darurat ke layar siswa di ruangan ini..." className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-bold text-slate-700" /></div>
                    <button onClick={sendBroadcast} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-600/30 tracking-widest"><Send size={18}/> SIARKAN</button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monitoredStudents.map(s => (
                      <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:border-emerald-300 transition-colors">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                          <div>
                            <p className="font-black text-slate-800 text-lg leading-tight truncate">{s?.name || '-'}</p>
                            <span className="inline-block mt-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">{s?.class}-{s?.subKelas}</span>
                          </div>
                          {(s?.warnings || 0) > 0 && <span className="bg-red-50 text-red-600 text-xs font-black px-2 py-1 rounded border border-red-200 animate-pulse whitespace-nowrap">(!Tab {s.warnings}x)</span>}
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2"><span>Progress Ujian</span><span className="text-emerald-600">{s?.progress || 0}%</span></div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner"><div className="bg-emerald-500 h-full transition-all duration-500" style={{width:`${s?.progress || 0}%`}}></div></div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-slate-100 mt-1">
                          <button onClick={() => update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true })} disabled={s.status === 'Selesai'} className="flex-1 text-xs bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 py-3 rounded-xl font-bold disabled:opacity-50 active:scale-95 transition-all shadow-sm">Tarik Mandiri</button>
                          {(s?.warnings || 0) >= 3 && s?.status !== 'Selesai' && (
                            <button onClick={() => update(dbRef(db, `live_students/${s.id}`), { warnings: 0, status: 'Online' })} className="flex-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-sm">Buka Kunci</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {monitoredStudents.length === 0 && <div className="col-span-full text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada peserta yang login dengan token ini.</div>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB BANK SOAL */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto print:max-w-full">
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 print:hidden space-y-5">
                <h3 className="text-xl font-black mb-2 text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><BookOpen className="text-emerald-500"/> Manajemen Bank Soal</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <select value={bankMapel} onChange={e => setBankMapel(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:border-emerald-500"><option value="">-- Semua Mata Pelajaran --</option>{availableBankMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={bankKelas} onChange={e => setBankKelas(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:border-emerald-500"><option value="">-- Semua Tingkatan Kelas --</option>{availableBankKelas.map(k => <option key={k}>{k}</option>)}</select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                  <button onClick={downloadTemplate} className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 shadow-sm transition-colors"><Download size={18}/> Template Excel</button>
                  <button onClick={triggerImport} className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 shadow-sm transition-colors"><Upload size={18}/> Import Excel</button>
                  <button onClick={() => { setEditSoalId(null); setFormData(defaultForm); setShowModal(true); }} className="w-full bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-colors"><Plus size={18}/> Ketik Manual</button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-widest text-black">YASPENDIK PTP NUSANTARA IV</h1>
                <h2 className="text-xl font-black uppercase tracking-widest text-black mt-1">SMP/MTS DARMA PERTIWI BAH BUTONG</h2>
                <p className="mt-2 text-sm font-bold text-gray-800">Naskah Bank Soal Ujian (Sistem CBT)</p>
                <p className="mt-1 text-sm font-bold text-gray-800">Mapel: {bankMapel || 'Semua'} | Tingkat: {bankKelas || 'Semua'} | Guru: {teacherProfile?.name}</p>
              </div>

              <div className="space-y-4">
                {filteredQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between print:border-b print:border-slate-300 print:shadow-none print:mb-4 print:pb-4 print:rounded-none break-inside-avoid">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-4 print:hidden border-b border-slate-100 pb-4"><span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">{q?.mapel}</span><span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">Tk. {q?.kelas}</span></div>
                      <p className="font-bold text-lg mb-6 text-slate-800 leading-relaxed"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 font-medium">
                        {['A','B','C','D'].map(opt => (
                          <div key={opt} className={`p-4 rounded-2xl border print:border-none print:p-1 ${q?.kunci===opt?'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 print:font-black print:text-black shadow-sm':'bg-slate-50 border-slate-200'}`}><Latex>{`${opt}. ${q[`opsi${opt}`]}`}</Latex></div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 self-end md:self-start print:hidden mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
                      <button onClick={() => openEditModal(q)} className="flex-1 md:flex-none flex justify-center items-center active:scale-95 text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 p-4 rounded-xl shadow-sm transition-colors"><Edit size={22}/></button>
                      <button onClick={() => {if(window.confirm("Hapus soal ini?")) remove(dbRef(db, `bank_soal/${q.id}`))}} className="flex-1 md:flex-none flex justify-center items-center active:scale-95 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 p-4 rounded-xl shadow-sm transition-colors"><Trash2 size={22}/></button>
                    </div>
                  </div>
                ))}
                {filteredQuestions.length === 0 && <div className="text-center p-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300 font-bold print:hidden">Belum ada bank soal yang Anda unggah ke server.</div>}
              </div>
            </div>
          )}

          {/* TAB REKAP NILAI & CETAK ADMINISTRASI */}
          {activeTab === 'recap' && (
            <div className="space-y-6 max-w-6xl mx-auto print:max-w-full">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 print:hidden space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><ClipboardList className="text-emerald-500"/> Pusat Administrasi Ujian</h3>
                  <button onClick={handleDeleteMyRecap} className="w-full md:w-auto bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-colors shadow-sm"><Trash2 size={18}/> Bersihkan Nilai Saya</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select value={recapMapel} onChange={e => setRecapMapel(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:border-emerald-500"><option value="">-- Semua Mapel --</option>{availableRecapMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={recapKelas} onChange={e => setRecapKelas(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:border-emerald-500"><option value="">-- Semua Tingkatan --</option>{availableRecapKelas.map(k => <option key={k}>{k}</option>)}</select>
                  <select value={recapSubKelas} onChange={e => setRecapSubKelas(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none font-bold text-slate-700 cursor-pointer focus:border-emerald-500"><option value="">-- Semua Ruangan --</option>{availableRecapSubKelas.map(sk => <option key={sk}>{sk}</option>)}</select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => { setPrintMode('rekap'); setTimeout(() => window.print(), 300); }} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all tracking-wide"><BarChart size={18}/> Cetak Daftar Nilai</button>
                  <button onClick={() => { setPrintMode('berita_acara'); setTimeout(() => window.print(), 300); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"><FileText size={18}/> Berita Acara Ujian</button>
                  <button onClick={() => { setPrintMode('daftar_hadir'); setTimeout(() => window.print(), 300); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"><Users size={18}/> Daftar Hadir Siswa</button>
                </div>
              </div>
              
              {/* === TAMPILAN CETAK: REKAP NILAI === */}
              <div className={`${printMode === 'rekap' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR NILAI UJIAN SISWA</h3>
                <p className="mb-4 text-sm font-bold">Mata Pelajaran: {recapMapel || 'Semua'} <br/> Kelas/Ruang: {recapKelas || 'Semua'}-{recapSubKelas || 'Semua'} <br/> Nama Guru: {teacherProfile?.name}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-2 px-3 w-12 text-center">No</th><th className="py-2 px-3">Nama Lengkap Siswa</th><th className="py-2 px-3">Mapel</th><th className="py-2 px-3 text-center">Kelas</th><th className="py-2 px-3 text-center">Skor Akhir</th></tr></thead>
                  <tbody>
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s?.id || i}>
                        <td className="py-2 px-3 text-center">{i+1}</td><td className="py-2 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-2 px-3">{s?.mapel || '-'}</td><td className="py-2 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-2 px-3 text-center font-black">{s?.score || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-12 text-center"><div className="w-64"><p>Simalungun, {new Date().toLocaleDateString('id-ID')}<br/>Guru Bidang Studi,</p><br/><br/><br/><p className="font-bold underline uppercase">{teacherProfile?.name}</p></div></div>
              </div>

              {/* === TAMPILAN CETAK: BERITA ACARA === */}
              <div className={`${printMode === 'berita_acara' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-8 underline tracking-wide">BERITA ACARA PELAKSANAAN UJIAN CBT</h3>
                <div className="text-justify leading-loose font-medium text-sm">
                  <p>Pada hari ini _________ tanggal ____ bulan ________________ tahun 20___, di SMP/MTS Darma Pertiwi Bah Butong telah diselenggarakan Ujian Berbasis Komputer (CBT) untuk:</p>
                  <table className="w-full my-4 border-none !border-0">
                    <tbody className="border-none">
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Mata Pelajaran</td><td className="border-none !p-0">: {recapMapel || '_________________________'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Kelas / Ruang</td><td className="border-none !p-0">: {recapKelas || '____'} - {recapSubKelas || '____'}</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Jumlah Peserta Terdaftar</td><td className="border-none !p-0">: {filteredLeaderboard.length} Orang</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Hadir / Mengikuti Ujian</td><td className="border-none !p-0">: ______ Orang</td></tr>
                      <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Tidak Hadir (Absen)</td><td className="border-none !p-0">: ______ Orang</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-4">Catatan selama pelaksanaan ujian:</p>
                  <div className="w-full h-24 border border-black mt-2 mb-8"></div>
                  <p>Demikian berita acara ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.</p>
                </div>
                <div className="flex justify-between mt-12 text-center">
                  <div className="w-64"><p>Pengawas Ruangan,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">_________________________</p><p className="text-xs">NIP. </p></div>
                  <div className="w-64"><p>Guru Mata Pelajaran,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">{teacherProfile?.name}</p><p className="text-xs">NIP. </p></div>
                </div>
              </div>

              {/* === TAMPILAN CETAK: DAFTAR HADIR === */}
              <div className={`${printMode === 'daftar_hadir' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR HADIR PESERTA UJIAN</h3>
                <p className="mb-4 text-sm font-bold">Mata Pelajaran: {recapMapel || '_________________'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Kelas/Ruang: {recapKelas || '____'} - {recapSubKelas || '____'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-3 px-3 w-12 text-center">No</th><th className="py-3 px-3">Nama Lengkap Siswa</th><th className="py-3 px-3 text-center w-24">Kelas</th><th className="py-3 px-3 w-48 text-center">Tanda Tangan</th></tr></thead>
                  <tbody>
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s?.id || i}><td className="py-3 px-3 text-center">{i+1}</td><td className="py-3 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-3 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-3 px-3"><span className="text-xs text-gray-400">{i+1}. </span></td></tr>
                    ))}
                    {[...Array(Math.max(0, 15 - filteredLeaderboard.length))].map((_, i) => (
                      <tr key={`empty-${i}`}><td className="py-4"></td><td></td><td></td><td></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
                {filteredLeaderboard.map((s, i) => (
                  <div key={s?.id || i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-slate-800 text-white text-xs font-black px-2 py-0.5 rounded-md">#{i+1}</span>
                        <p className="font-black text-slate-800 text-lg leading-tight truncate max-w-[150px] sm:max-w-[200px]">{s?.name || 'Anonim'}</p>
                      </div>
                      <p className="text-xs font-bold text-slate-500">{s?.mapel || '-'} • Kls: {s?.class || '-'}-{s?.subKelas || '-'}</p>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 shadow-inner">{s?.score || 0}</div>
                  </div>
                ))}
                {filteredLeaderboard.length === 0 && <div className="col-span-full text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-400 font-bold">Data nilai dari ujian Anda belum tersedia.</div>}
              </div>
            </div>
          )}

          {/* TAB BARU: PROFIL GURU */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto print:hidden">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-700 font-black text-4xl uppercase shadow-inner shrink-0">{teacherProfile?.name?.charAt(0) || 'G'}</div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Pengaturan Profil</h3>
                    <p className="text-sm font-bold text-slate-500 mt-1">Kelola identitas resmi Anda di sistem CBT.</p>
                  </div>
                </div>
                
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Nama Lengkap beserta Gelar Akademik</label>
                    <input required value={tempProfileName} onChange={(e) => setTempProfileName(e.target.value)} placeholder="Contoh: Susi Susanti, S.Pd., M.Si." className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white font-bold text-slate-800 text-lg transition-colors shadow-inner" />
                    <p className="text-xs text-slate-400 mt-2 font-medium">Nama ini akan digunakan secara otomatis sebagai tanda tangan di dokumen cetak PDF.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Email Akun (Login)</label>
                    <input disabled value={teacherProfile?.email || currentUserEmail} className="w-full p-4 border border-slate-200 bg-slate-100 rounded-2xl font-bold text-slate-500 cursor-not-allowed" />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all tracking-widest flex justify-center items-center gap-2"><User size={20}/> SIMPAN PERUBAHAN</button>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* PERBAIKAN: MODAL POP-UP QR CODE DENGAN API (JALUR PINTAS) */}
      {showQRModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-8 md:p-12 rounded-[3rem] w-full max-w-xl shadow-2xl flex flex-col items-center text-center transform transition-all animate-in zoom-in duration-300">
            <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full transition-colors"><X size={24}/></button>
            
            <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">SCAN UNTUK MASUK</h2>
            <p className="text-slate-500 font-bold mb-8">Buka kamera HP Anda dan arahkan ke kode QR ini.</p>
            
            <div className="bg-white p-4 rounded-3xl border-8 border-emerald-500 shadow-xl mb-8 flex justify-center items-center">
              {/* MENGGUNAKAN API QR SERVER GRATIS */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(window.location.origin + '/?token=' + activeQRToken)}`} 
                alt="QR Code Sesi Ujian" 
                className="w-[280px] h-[280px] object-contain"
              />
            </div>
            
            <div className="bg-slate-50 border border-slate-200 px-8 py-4 rounded-2xl w-full">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ATAU GUNAKAN TOKEN</p>
              <p className="text-4xl font-black font-mono text-emerald-600 tracking-[0.3em]">{activeQRToken}</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT SOAL MANUAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110] print:hidden">
          <div className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <h2 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><Edit className="text-emerald-500"/> {editSoalId ? 'Revisi Soal Ujian' : 'Ketik Soal Baru'}</h2>
            <form onSubmit={handleAddOrEditSoal} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Mata Pelajaran</label><input required value={formData.mapel} placeholder="Contoh: Matematika" className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none focus:border-emerald-500 font-bold text-slate-800 focus:bg-white" onChange={e => setFormData({...formData, mapel: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tingkat</label><input required value={formData.kelas} placeholder="Cth: 9" className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none focus:border-emerald-500 font-bold text-slate-800 text-center focus:bg-white" onChange={e => setFormData({...formData, kelas: e.target.value})} /></div>
              </div>
              
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Teks Pertanyaan (Gunakan $...$ untuk Rumus Math)</label><textarea required value={formData.pertanyaan} placeholder="Ketik soal di sini..." className="w-full p-5 border border-slate-200 bg-slate-50 rounded-2xl outline-none focus:border-emerald-500 min-h-[120px] leading-relaxed text-slate-800 focus:bg-white" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} /></div>
              
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Opsi Jawaban</label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{['A','B','C','D'].map(opt => <div key={opt} className="relative"><span className="absolute left-4 top-4 font-black text-slate-400">{opt}.</span><input required value={formData[`opsi${opt}`]} className="w-full pl-10 pr-4 py-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none focus:border-emerald-500 text-slate-800 focus:bg-white" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} /></div>)}</div></div>
              
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Kunci Jawaban Benar</label><select className="w-full p-4 border border-emerald-300 bg-emerald-50 text-emerald-800 font-black rounded-2xl outline-none cursor-pointer focus:border-emerald-500" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}><option value="A">Opsi A</option><option value="B">Opsi B</option><option value="C">Opsi C</option><option value="D">Opsi D</option></select></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditSoalId(null); setFormData(defaultForm); }} className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-slate-600 active:scale-95 transition-colors cursor-pointer">Batalkan</button>
                <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-transform cursor-pointer">{editSoalId ? 'Simpan Revisi' : 'Tambahkan Soal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
