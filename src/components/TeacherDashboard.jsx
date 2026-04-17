import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref as dbRef, onValue, push, remove, update, set } from 'firebase/database';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
// BUGFIX: Mengganti 'Image' menjadi 'ImageIcon' agar tidak bentrok dengan HTML Image bawaan
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap, Edit, Activity, User, MessageSquare, Send, FileText, ClipboardList, ShieldAlert, QrCode, ImageIcon, Zap, ShieldCheck } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  const APP_VERSION = "2.0.0";
  const [activeTab, setActiveTab] = useState(localStorage.getItem('teacherTab') || 'settings');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeQRToken, setActiveQRToken] = useState('');
  
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';
  const isSuperAdmin = currentUserEmail === 'admin@sekolah.com';

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

  // BUGFIX: Menambahkan default spasi pada pertanyaan agar Latex tidak crash
  const defaultForm = { mapel: '', kelas: '', pertanyaan: ' ', gambar: '', opsiA: ' ', opsiB: ' ', opsiC: ' ', opsiD: ' ', kunci: 'A' };
  const [formData, setFormData] = useState(defaultForm);
  const [editSoalId, setEditSoalId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => { localStorage.setItem('teacherTab', activeTab); }, [activeTab]);

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
      if (val && typeof val === 'object') {
        setData(prev => ({ ...prev, [key]: Object.keys(val).map(k => ({ ...val[k], id: k })) }));
      } else {
        setData(prev => ({ ...prev, [key]: [] }));
      }
    });
    
    fetchData('live_students', 'live'); 
    fetchData('bank_soal', 'bank'); 
    fetchData('leaderboard', 'lead'); 
    fetchData('exam_sessions', 'sessions');
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
  const filteredLeaderboard = myLeaderboard.filter(s => (recapMapel === '' || s?.mapel === recapMapel) && (recapKelas === '' || s?.class === recapKelas) && (recapSubKelas === '' || s?.subKelas === recapSubKelas));

  const triggerGlobalUpdate = () => {
    if(!isSuperAdmin) return;
    if(window.confirm(`🚀 KONFIRMASI RILIS V2\nApakah Anda yakin ingin memaksa SEMUA HP SISWA beralih ke versi ${APP_VERSION} sekarang?`)) {
      set(dbRef(db, 'settings/activeVersion'), APP_VERSION)
        .then(() => alert("Sinyal Update Terkirim! Semua siswa akan reload otomatis."))
        .catch(err => alert("Gagal: " + err.message));
    }
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if(auth.currentUser) {
      update(dbRef(db, `users/${auth.currentUser.uid}`), { name: tempProfileName });
      alert("Profil Anda berhasil diperbarui!");
    }
  };

  const sendBroadcast = () => {
    if(!broadcastText) return;
    if(window.confirm(`Kirim pengumuman darurat ke semua siswa (Token: ${activeMonitorToken})?`)) {
      monitoredStudents.forEach(s => {
        update(dbRef(db, `live_students/${s.id}`), { broadcast: broadcastText });
      });
      setBroadcastText('');
      alert("Pengumuman berhasil disiarkan!");
    }
  };

  const forceSubmitAll = () => {
    if(window.confirm("🚨 TARIK PAKSA SEMUA?\nWaktu ujian siswa akan langsung berakhir.")) {
      monitoredStudents.forEach(s => {
        if(s.status !== 'Selesai') update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true });
      });
      alert("Perintah tarik paksa terkirim!");
    }
  };

  const handleDeleteMyRecap = async () => {
    if (myLeaderboard.length === 0) return alert("Belum ada data.");
    if(window.confirm("🚨 HAPUS SEMUA REKAP NILAI ANDA?")) {
      const promises = myLeaderboard.map(s => remove(dbRef(db, `leaderboard/${s.id}`)));
      await Promise.all(promises);
      alert("Data dibersihkan.");
    }
  };

  const handleAddOrEditSoal = (e) => { 
    e.preventDefault(); 
    if (editSoalId) { update(dbRef(db, `bank_soal/${editSoalId}`), { ...formData }); alert("Soal diperbarui!"); } 
    else { push(dbRef(db, 'bank_soal'), { ...formData, teacherEmail: currentUserEmail }); alert("Soal ditambahkan!"); }
    setShowModal(false); setEditSoalId(null); setFormData(defaultForm); 
  };

  const openEditModal = (q) => { 
    setFormData({ 
      mapel: q.mapel||'', kelas: q.kelas||'', pertanyaan: q.pertanyaan||' ', 
      gambar: q.gambar || '',
      opsiA: q.opsiA||' ', opsiB: q.opsiB||' ', opsiC: q.opsiC||' ', opsiD: q.opsiD||' ', kunci: q.kunci||'A' 
    }); 
    setEditSoalId(q.id); 
    setShowModal(true); 
  };
  
  const handleFileUpload = (e) => { 
    const file = e.target.files[0]; 
    if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = (evt) => { 
      const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); 
      let count = 0; 
      d.forEach(i => { if (i.pertanyaan && i.kunci) { push(dbRef(db, 'bank_soal'), { ...i, teacherEmail: currentUserEmail }); count++; } }); 
      alert(`${count} Soal di-import!`); 
    }; 
    reader.readAsBinaryString(file); 
  };
  
  const handleCreateSession = (e) => { 
    e.preventDefault(); 
    const t = document.getElementById('token_input').value; 
    const k = document.getElementById('kelas_session').value; 
    const sk = document.getElementById('subkelas_session').value.toUpperCase(); 
    if(!t || !selectedMapelSesi || !k || !sk) return alert("Lengkapi data!"); 
    push(dbRef(db, 'exam_sessions'), { token: t, mapel: selectedMapelSesi, kelas: k, subKelas: sk, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now() }); 
    alert("Sesi dibuka!"); 
  };

  const setMonitor = (t) => { setActiveMonitorToken(t); localStorage.setItem('activeMonitorToken', t); setActiveTab('proctor'); };
  const openQR = (token) => { setActiveQRToken(token); setShowQRModal(true); };

  const NavItem = ({ tab, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/30' : 'text-slate-500 hover:bg-slate-100 font-bold'}`}>
      <Icon size={20}/> <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      <style>{`
        @media print { 
          @page { margin: 1cm; } 
          body { background: white !important; -webkit-print-color-adjust: exact; } 
          aside, header, button, select, input, .print\\:hidden, .no-print { display: none !important; } 
          main { padding: 0 !important; width: 100% !important; overflow: visible !important; } 
          .print\\:block { display: block !important; } 
          table { width: 100% !important; border-collapse: collapse; margin-top: 20px; border: 1px solid black; } 
          th, td { border: 1px solid #000 !important; padding: 12px !important; color: black !important; font-size: 14px; } 
          th { background-color: #f3f4f6 !important; font-weight: 900; } 
        }
      `}</style>
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h1 className="text-xl font-black text-emerald-700 flex gap-3 items-center tracking-tight">
            <GraduationCap size={28} className="text-emerald-500"/> DARMA PERTIWI
          </h1>
          <button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button>
        </div>
        
        <div className="p-4 mx-4 mt-4 mb-2 bg-emerald-50 rounded-2xl border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black">{teacherProfile?.name?.charAt(0)}</div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">VERSI {APP_VERSION}</p>
              <p className="text-sm font-bold truncate text-slate-800">{teacherProfile?.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Monitor} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal V2" />
          <NavItem tab="recap" icon={BarChart} label="Rekap & Cetak" />
          <div className="my-4 border-t border-slate-100"></div>
          <NavItem tab="profile" icon={User} label="Profil Saya" />
        </nav>
        
        {isSuperAdmin && (
          <div className="px-4 mb-2">
            <button onClick={triggerGlobalUpdate} className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-95 uppercase tracking-tighter">
              <Zap size={16}/> Rilis Update Global
            </button>
          </div>
        )}

        <div className="p-6 border-t border-slate-100">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition-colors"><LogOut size={20}/> Keluar Akun</button>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 lg:p-6 flex justify-between items-center z-10 print:hidden pr-16 md:pr-6">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-slate-100 rounded-lg text-emerald-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-xl lg:text-2xl font-black text-slate-800 flex items-center gap-2">
              Teacher Center <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-md uppercase font-black">V2 Staging</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Sistem Stabil</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {activeTab === 'settings' && (
             <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 h-fit">
                  <h3 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><Plus className="text-emerald-500"/> Buka Sesi Baru</h3>
                  <form onSubmit={handleCreateSession} className="space-y-5">
                    <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Mata Pelajaran</label><select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:border-emerald-500"><option value="">-- Pilih Mapel --</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3">
                       <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Tingkat</label><select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700"><option value="">Pilih</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select></div>
                       <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Sub / Ruang</label><input id="subkelas_session" placeholder="Cth: A" required className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl uppercase font-bold text-center" /></div>
                    </div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Token</label><div className="flex gap-2"><input id="token_input" required placeholder="Generate..." className="w-full p-4 border border-emerald-200 bg-emerald-50 rounded-2xl uppercase font-mono font-black tracking-widest text-emerald-800" /><button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-4 bg-slate-800 text-white rounded-2xl active:scale-95 transition-transform"><Dices size={24}/></button></div></div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 mt-4 rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all">RILIS UJIAN</button>
                  </form>
                </div>
                
                <div className="xl:col-span-2 space-y-4">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 border-b border-slate-200 pb-4"><Activity className="text-emerald-500"/> Sesi Berjalan</h3>
                  {mySessions.map((s) => (
                    <div key={s.id} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="text-center md:text-left">
                        <h4 className="text-3xl md:text-2xl font-black font-mono tracking-widest text-slate-800">{s.token}</h4>
                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase">{s.mapel} | KLS {s.kelas}-{s.subKelas}</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => openQR(s.token)} className="flex-1 p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex justify-center"><QrCode size={20}/></button>
                        <button onClick={() => setMonitor(s.token)} className="flex-1 p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors flex justify-center"><Monitor size={20}/></button>
                        <button onClick={() => update(dbRef(db, `exam_sessions/${s.id}`), { status: s.status === 'open' ? 'closed' : 'open' })} className={`flex-1 p-3 rounded-xl transition-colors flex justify-center ${s.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{s.status === 'open' ? <Unlock size={20}/> : <Lock size={20}/>}</button>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'proctor' && (
            <div className="space-y-6 max-w-6xl mx-auto">
               <div className="bg-white border border-slate-200 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between shadow-sm gap-4">
                  <div className="font-black text-slate-800 text-lg flex items-center gap-2"><Activity className="text-emerald-500"/> Live Monitor</div>
                  <select value={activeMonitorToken} onChange={(e) => setMonitor(e.target.value)} className="w-full md:w-auto p-3 rounded-xl border border-slate-200 outline-none font-bold bg-slate-50"><option value="">-- Pilih Token --</option>{mySessions.map(s => <option key={s.token} value={s.token}>{s.token}</option>)}</select>
               </div>
               
               {activeMonitorToken && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monitoredStudents.map(s => (
                      <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                           <p className="font-black text-slate-800 truncate">{s.name}</p>
                           {(s.warnings || 0) > 0 && <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded border border-red-200 animate-pulse">!Tab Keluar</span>}
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                           <div className="bg-emerald-500 h-full transition-all" style={{width:`${s.progress || 0}%`}}></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-black mt-2 text-slate-400">
                           <span>PROGRESS: {s.progress || 0}%</span>
                           <button onClick={() => update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true })} className="text-red-500 hover:underline">TARIK PAKSA</button>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><BookOpen className="text-emerald-500"/> Bank Soal Proper V2</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={triggerImport} className="flex-1 md:flex-none p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 border border-emerald-100 flex justify-center"><Upload size={20}/></button>
                    <button onClick={() => { setEditSoalId(null); setFormData(defaultForm); setShowModal(true); }} className="flex-[3] md:flex-none px-6 py-3 bg-slate-800 text-white rounded-xl font-black shadow-lg shadow-slate-800/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                      <Plus size={20}/> Ketik Soal Pro
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select value={bankMapel} onChange={e => setBankMapel(e.target.value)} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 font-bold outline-none"><option value="">Semua Mapel</option>{availableBankMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={bankKelas} onChange={e => setBankKelas(e.target.value)} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 font-bold outline-none"><option value="">Semua Tingkat</option>{availableBankKelas.map(k => <option key={k}>{k}</option>)}</select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-3">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase tracking-widest">{q.mapel} | KLS {q.kelas}</span>
                      </div>
                      
                      {q.gambar && (
                        <div className="mb-4 max-w-sm overflow-hidden rounded-2xl border border-slate-100 shadow-inner">
                          <img src={q.gambar} alt="Soal" className="w-full h-auto object-cover" />
                        </div>
                      )}

                      <p className="font-bold text-lg mb-6 text-slate-800 leading-relaxed break-words">
                        <span className="text-emerald-600 mr-2">{i+1}.</span>
                        <Latex>{q.pertanyaan || ' '}</Latex>
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A','B','C','D'].map(opt => (
                          <div key={opt} className={`p-4 rounded-2xl border ${q.kunci === opt ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                            <Latex>{`${opt}. ${q[`opsi${opt}`] || ' '}`}</Latex>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2 print:hidden pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 w-full md:w-auto">
                      <button onClick={() => openEditModal(q)} className="flex-1 p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex justify-center items-center"><Edit size={20}/></button>
                      <button onClick={() => {if(window.confirm("Hapus soal?")) remove(dbRef(db, `bank_soal/${q.id}`))}} className="flex-1 p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex justify-center items-center"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'recap' && (
            <div className="max-w-6xl mx-auto space-y-6">
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 w-full md:w-auto"><BarChart className="text-emerald-500"/> Rekap Administrasi</h3>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={() => { setPrintMode('rekap'); setTimeout(() => window.print(), 300); }} className="flex-1 md:flex-none px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md active:scale-95">Cetak Nilai</button>
                    <button onClick={() => { setPrintMode('berita_acara'); setTimeout(() => window.print(), 300); }} className="flex-1 md:flex-none px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md active:scale-95">Berita Acara</button>
                    <button onClick={() => { setPrintMode('daftar_hadir'); setTimeout(() => window.print(), 300); }} className="flex-1 md:flex-none px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md active:scale-95">Daftar Hadir</button>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
                  {filteredLeaderboard.map((s, i) => (
                    <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-slate-400">#{i+1}</span>
                        <span className="text-2xl font-black text-emerald-600">{s.score}</span>
                      </div>
                      <p className="font-black text-slate-800 uppercase text-sm truncate">{s.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{s.mapel} | KLS {s.class}-{s.subKelas}</p>
                    </div>
                  ))}
               </div>
               
               {/* TAMPILAN CETAK LENGKAP V1 RESTORED */}
               <div className="hidden print:block">
                  <div className="text-center mb-8 border-b-4 border-double border-black pb-4">
                    <h1 className="text-2xl font-black uppercase">SMP/MTS DARMA PERTIWI BAH BUTONG</h1>
                    <p className="text-sm font-bold">Laporan Administrasi Ujian Berbasis Komputer (CBT)</p>
                  </div>
                  
                  {printMode === 'rekap' && (
                    <>
                      <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR NILAI UJIAN SISWA</h3>
                      <p className="mb-4 text-sm font-bold">Mata Pelajaran: {recapMapel || 'Semua'} <br/> Nama Guru: {teacherProfile?.name}</p>
                      <table className="w-full">
                        <thead><tr><th>No</th><th>Nama Siswa</th><th>Mapel</th><th>Kelas</th><th>Skor</th></tr></thead>
                        <tbody>
                          {filteredLeaderboard.map((s, i) => (
                            <tr key={i}><td>{i+1}</td><td>{s.name}</td><td>{s.mapel}</td><td>{s.class}-{s.subKelas}</td><td className="text-center font-bold">{s.score}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {printMode === 'berita_acara' && (
                    <>
                      <h3 className="text-center font-black text-lg mb-8 underline tracking-wide">BERITA ACARA PELAKSANAAN UJIAN CBT</h3>
                      <div className="text-justify leading-loose font-medium text-sm">
                        <p>Pada hari ini _________ tanggal ____ bulan ________________ tahun 20___, di SMP/MTS Darma Pertiwi Bah Butong telah diselenggarakan Ujian Berbasis Komputer (CBT).</p>
                        <table className="w-full my-4 border-none !border-0">
                          <tbody className="border-none">
                            <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Mata Pelajaran</td><td className="border-none !p-0">: {recapMapel || '_________________________'}</td></tr>
                            <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Jumlah Peserta Terdaftar</td><td className="border-none !p-0">: {filteredLeaderboard.length} Orang</td></tr>
                            <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Hadir / Mengikuti Ujian</td><td className="border-none !p-0">: ______ Orang</td></tr>
                            <tr className="border-none"><td className="w-48 py-1 border-none !p-0">Tidak Hadir (Absen)</td><td className="border-none !p-0">: ______ Orang</td></tr>
                          </tbody>
                        </table>
                        <div className="flex justify-between mt-12 text-center">
                          <div className="w-64"><p>Pengawas Ruangan,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">_________________________</p></div>
                          <div className="w-64"><p>Guru Mata Pelajaran,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">{teacherProfile?.name}</p></div>
                        </div>
                      </div>
                    </>
                  )}

                  {printMode === 'daftar_hadir' && (
                    <>
                      <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR HADIR PESERTA UJIAN</h3>
                      <p className="mb-4 text-sm font-bold">Mata Pelajaran: {recapMapel || '_________________'}</p>
                      <table className="w-full text-left text-sm">
                        <thead><tr><th className="py-3 px-3 w-12 text-center">No</th><th className="py-3 px-3">Nama Lengkap Siswa</th><th className="py-3 px-3 text-center w-24">Kelas</th><th className="py-3 px-3 w-48 text-center">Tanda Tangan</th></tr></thead>
                        <tbody>
                          {filteredLeaderboard.map((s, i) => (
                            <tr key={i}><td className="py-3 px-3 text-center">{i+1}</td><td className="py-3 px-3 font-bold uppercase">{s?.name}</td><td className="py-3 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-3 px-3"><span className="text-xs text-gray-400">{i+1}. </span></td></tr>
                          ))}
                          {[...Array(Math.max(0, 15 - filteredLeaderboard.length))].map((_, i) => (
                            <tr key={`empty-${i}`}><td className="py-4"></td><td></td><td></td><td></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-2xl font-black text-slate-800 mb-6">Profil Guru V2</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                   <input required value={tempProfileName} onChange={(e) => setTempProfileName(e.target.value)} placeholder="Nama Lengkap & Gelar" className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold outline-none" />
                   <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95">SIMPAN PROFIL</button>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL EDITOR SOAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative border border-white/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-4 gap-4">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <Edit className="text-emerald-500" size={28}/> {editSoalId ? 'Edit Soal Proper' : 'Buat Soal Pro'}
              </h2>
              <button onClick={() => { setPreviewMode(!previewMode); }} className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all w-full md:w-auto justify-center ${previewMode ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {previewMode ? <Eye size={18}/> : <Edit size={18}/>} {previewMode ? 'Mode Editor' : 'Lihat Pratinjau'}
              </button>
            </div>

            {previewMode ? (
              <div className="p-4 md:p-8 bg-slate-50 rounded-3xl border border-slate-200 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm">
                  {formData.gambar && <img src={formData.gambar} className="mb-4 rounded-xl max-h-60 mx-auto" />}
                  <p className="text-xl font-bold text-slate-800 leading-relaxed break-words"><Latex>{formData.pertanyaan || 'Ketik pertanyaan...'}</Latex></p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['A','B','C','D'].map(opt => (
                    <div key={opt} className={`p-5 rounded-2xl border-2 bg-white transition-all break-words ${formData.kunci === opt ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100'}`}>
                      <span className="font-black text-emerald-600 mr-2">{opt}.</span>
                      <Latex>{formData[`opsi${opt}`] || ' '}</Latex>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPreviewMode(false)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg">KEMBALI KE EDITOR</button>
              </div>
            ) : (
              <form onSubmit={handleAddOrEditSoal} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Mata Pelajaran</label><input required value={formData.mapel} placeholder="Contoh: Matematika" className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold outline-none" onChange={e => setFormData({...formData, mapel: e.target.value})} /></div>
                  <div><label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Kelas</label><input required value={formData.kelas} placeholder="9" className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-center outline-none" onChange={e => setFormData({...formData, kelas: e.target.value})} /></div>
                </div>
                
                <div className="relative">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Link Gambar Soal (Opsional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-4 text-slate-400" size={20}/>
                    <input value={formData.gambar} placeholder="Paste link URL gambar dari Google/Imgur..." className="w-full pl-12 pr-4 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-medium text-sm outline-none" onChange={e => setFormData({...formData, gambar: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Pertanyaan (Gunakan $ untuk LaTeX)</label>
                  <textarea required value={formData.pertanyaan} placeholder="Ketik soal... Contoh: Berapa akar dari $x^2 = 16$?" className="w-full p-5 border border-slate-200 bg-slate-50 rounded-2xl font-bold min-h-[120px] focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} />
                </div>
                
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Pilihan Jawaban</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['A','B','C','D'].map(opt => (
                      <div key={opt} className="relative">
                        <span className="absolute left-4 top-4 font-black text-emerald-500">{opt}.</span>
                        <input required value={formData[`opsi${opt}`]} className="w-full pl-12 pr-4 py-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold focus:bg-white outline-none" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center border-t border-slate-100 pt-6">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Kunci Jawaban</label>
                    <select className="w-full p-4 border border-emerald-500 bg-emerald-50 text-emerald-800 font-black rounded-2xl outline-none" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}><option value="A">Opsi A</option><option value="B">Opsi B</option><option value="C">Opsi C</option><option value="D">Opsi D</option></select>
                  </div>
                  <div className="flex gap-2 pt-6">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold active:scale-95 transition-all">Batal</button>
                    <button type="submit" className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/30 active:scale-95 transition-all">SIMPAN SOAL</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-xl shadow-2xl flex flex-col items-center text-center">
            <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><X size={24}/></button>
            <h2 className="text-2xl font-black text-slate-800 mb-6">SCAN QR LOGIN SISWA</h2>
            <div className="bg-white p-4 rounded-3xl border-8 border-emerald-500 shadow-xl mb-6">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + '/?token=' + activeQRToken)}`} alt="QR" className="w-[250px] h-[250px]" />
            </div>
            <p className="text-4xl font-black font-mono text-emerald-600 tracking-[0.2em]">{activeQRToken}</p>
          </div>
        </div>
      )}
    </div>
  );
}
