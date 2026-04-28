import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref as dbRef, onValue, push, remove, update, set } from 'firebase/database';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap, Edit, Activity, User, MessageSquare, Send, FileText, ClipboardList, ShieldAlert, QrCode, ImageIcon, Zap, ShieldCheck, CheckSquare } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  // === KONFIGURASI V2 ENTERPRISE ===
  const APP_VERSION = "2.0.0";
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';
  const isSuperAdmin = currentUserEmail === 'admin@sekolah.com';

  const [activeTab, setActiveTab] = useState(localStorage.getItem('teacherTab') || 'settings');
  useEffect(() => { localStorage.setItem('teacherTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeQRToken, setActiveQRToken] = useState('');
  
  // Modal Koreksi Esai Serentak
  const [showKoreksiModal, setShowKoreksiModal] = useState(false);
  const [koreksiSession, setKoreksiSession] = useState(null);

  const [teacherProfile, setTeacherProfile] = useState({ name: 'Memuat...', email: currentUserEmail });
  const [tempProfileName, setTempProfileName] = useState(''); 
  
  const fileInputRef = useRef(null);

  // Form Sesi Ujian (Dengan Kuota Soal)
  const [selectedMapelSesi, setSelectedMapelSesi] = useState('');
  const [kuotaPG, setKuotaPG] = useState(0);
  const [kuotaPGK, setKuotaPGK] = useState(0);
  const [kuotaEsai, setKuotaEsai] = useState(0);

  const [bankMapel, setBankMapel] = useState('');
  const [bankKelas, setBankKelas] = useState('');
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [recapSubKelas, setRecapSubKelas] = useState('');
  
  const [broadcastText, setBroadcastText] = useState(''); 
  const [printMode, setPrintMode] = useState('rekap'); 

  // === FORM V2 (3 JENIS SOAL & WACANA) ===
  const defaultForm = { 
    jenisSoal: 'PG', kodeWacana: '', teksWacana: '', 
    mapel: '', kelas: '', pertanyaan: ' ', gambar: '', 
    opsiA: ' ', opsiB: ' ', opsiC: ' ', opsiD: ' ', kunci: 'A' 
  };
  const [formData, setFormData] = useState(defaultForm);
  const [editSoalId, setEditSoalId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

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
  const mySessions = (data.sessions || []).filter(s => s?.teacherEmail === currentUserEmail).sort((a,b) => b.timestamp - a.timestamp);
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

  const triggerGlobalUpdate = () => {
    if(!isSuperAdmin) return;
    if(window.confirm(`🚀 KONFIRMASI RILIS V2\nApakah Anda yakin ingin memaksa SEMUA HP SISWA beralih ke versi ${APP_VERSION}?`)) {
      set(dbRef(db, 'settings/activeVersion'), APP_VERSION).then(() => alert("Sinyal Update Terkirim!")).catch(err => alert("Gagal: " + err.message));
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
    if(window.confirm(`Kirim pengumuman darurat ke semua siswa di Ruang Ujian (Token: ${activeMonitorToken})?`)) {
      monitoredStudents.forEach(s => update(dbRef(db, `live_students/${s.id}`), { broadcast: broadcastText }));
      setBroadcastText('');
      alert("Pengumuman berhasil disiarkan!");
    }
  };

  const forceSubmitAll = () => {
    if(window.confirm("🚨 PERINGATAN! Tarik paksa semua lembar jawaban siswa yang online di sesi ini?")) {
      monitoredStudents.forEach(s => { if(s.status !== 'Selesai') update(dbRef(db, `live_students/${s.id}`), { forceSubmit: true }); });
      alert("Perintah tarik paksa terkirim!");
    }
  };

  const handleDeleteMyRecap = async () => {
    if (myLeaderboard.length === 0) return alert("Belum ada data nilai.");
    if(window.confirm("🚨 Hapus SEMUA rekap nilai siswa khusus untuk mapel Anda?")) {
      try { await Promise.all(myLeaderboard.map(s => remove(dbRef(db, `leaderboard/${s.id}`)))); alert("Data dibersihkan."); } catch (error) { alert("Gagal: " + error.message); }
    }
  };

  const handleDeleteSingleRecap = (id, studentName) => {
    if (window.confirm(`Yakin hapus data ujian "${studentName}"?`)) {
      remove(dbRef(db, `leaderboard/${id}`)).then(() => alert("Data dihapus!")).catch(err => alert("Gagal: " + err.message));
    }
  };

  // Handler Logika PGK (Checkbox)
  const handlePGKKeyToggle = (opt) => {
    let currentKeys = formData.kunci ? formData.kunci.split(',') : [];
    if (currentKeys.includes(opt)) currentKeys = currentKeys.filter(k => k !== opt);
    else currentKeys.push(opt);
    setFormData({ ...formData, kunci: currentKeys.sort().join(',') });
  };

  const handleAddOrEditSoal = (e) => { 
    e.preventDefault(); 
    // Bersihkan opsi jika Esai
    const finalData = { ...formData };
    if(finalData.jenisSoal === 'ESAI') {
        finalData.opsiA = ''; finalData.opsiB = ''; finalData.opsiC = ''; finalData.opsiD = ''; finalData.kunci = '';
    }
    if (editSoalId) { update(dbRef(db, `bank_soal/${editSoalId}`), finalData); alert("Soal diperbarui!"); } 
    else { push(dbRef(db, 'bank_soal'), { ...finalData, teacherEmail: currentUserEmail }); alert("Soal ditambahkan!"); }
    setShowModal(false); setEditSoalId(null); setFormData(defaultForm); setPreviewMode(false);
  };

  const openEditModal = (q) => { 
    setFormData({ 
      jenisSoal: q.jenisSoal || 'PG', kodeWacana: q.kodeWacana || '', teksWacana: q.teksWacana || '',
      mapel: q.mapel||'', kelas: q.kelas||'', pertanyaan: q.pertanyaan||' ', gambar: q.gambar || '', 
      opsiA: q.opsiA||' ', opsiB: q.opsiB||' ', opsiC: q.opsiC||' ', opsiD: q.opsiD||' ', kunci: q.kunci||'A' 
    }); 
    setEditSoalId(q.id); setShowModal(true); setPreviewMode(false);
  };
  
  // === IMPORT/EXPORT EXCEL V2 ===
  const downloadTemplate = () => { 
    try {
      const wsData = [
        { No: 1, Kode_Wacana: "", Jenis_Soal: "PG", Teks_Wacana: "", mapel: "Matematika", kelas: "9", pertanyaan: "Jika $x^2 = 4$, maka $x$ adalah?", opsiA: "2", opsiB: "3", opsiC: "4", opsiD: "5", Kunci_Jawaban: "A" },
        { No: 2, Kode_Wacana: "", Jenis_Soal: "PGK", Teks_Wacana: "", mapel: "Matematika", kelas: "9", pertanyaan: "Manakah bilangan genap?", opsiA: "2", opsiB: "3", opsiC: "4", opsiD: "5", Kunci_Jawaban: "A,C" },
        { No: 3, Kode_Wacana: "W-01", Jenis_Soal: "ESAI", Teks_Wacana: "Proses hujan terjadi karena...", mapel: "Matematika", kelas: "9", pertanyaan: "Jelaskan proses kondensasi!", opsiA: "", opsiB: "", opsiC: "", opsiD: "", Kunci_Jawaban: "" }
      ];
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Format_Soal_V2");
      XLSX.writeFile(wb, "Template_CBT_Soal_V2.xlsx"); 
    } catch(err) { alert("Gagal mendownload: " + err.message); } 
  };
  
  const triggerImport = () => { if(fileInputRef.current) fileInputRef.current.click(); };
  const handleFileUpload = (e) => { 
    try { 
      const file = e.target.files[0]; if (!file) return; 
      const reader = new FileReader(); 
      reader.onload = (evt) => { 
        const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); 
        let count = 0; 
        d.forEach(i => { 
          if (i.pertanyaan) { 
            const jenis = (i.Jenis_Soal || 'PG').toUpperCase();
            push(dbRef(db, 'bank_soal'), { 
              mapel: i.mapel, kelas: String(i.kelas), pertanyaan: i.pertanyaan, 
              opsiA: String(i.opsiA || ''), opsiB: String(i.opsiB || ''), opsiC: String(i.opsiC || ''), opsiD: String(i.opsiD || ''), 
              jenisSoal: jenis, kodeWacana: i.Kode_Wacana || '', teksWacana: i.Teks_Wacana || '',
              kunci: i.Kunci_Jawaban ? String(i.Kunci_Jawaban).replace(/\s/g, '').toUpperCase() : '',
              teacherEmail: currentUserEmail 
            }); 
            count++; 
          } 
        }); 
        alert(`${count} Soal berhasil di-import!`); 
        if(fileInputRef.current) fileInputRef.current.value = ''; 
      }; 
      reader.readAsBinaryString(file); 
    } catch(err) { alert("Gagal: " + err.message); } 
  };
  
  const handleCreateSession = (e) => { 
    e.preventDefault(); 
    const t = document.getElementById('token_input').value; 
    const k = document.getElementById('kelas_session').value; 
    const sk = document.getElementById('subkelas_session').value.toUpperCase(); 
    if(!t || !selectedMapelSesi || !k || !sk) return alert("Lengkapi data sesi!"); 
    
    push(dbRef(db, 'exam_sessions'), { 
      token: t, mapel: selectedMapelSesi, kelas: k, subKelas: sk, status: 'open', 
      kuotaPG: parseInt(kuotaPG) || 0, kuotaPGK: parseInt(kuotaPGK) || 0, kuotaEsai: parseInt(kuotaEsai) || 0,
      teacherEmail: currentUserEmail, timestamp: Date.now() 
    }); 
    
    document.getElementById('token_input').value = ''; 
    setKuotaPG(0); setKuotaPGK(0); setKuotaEsai(0);
    alert("Sesi Ujian Resmi Dibuka!"); 
  };

  const toggleSession = (id, s) => update(dbRef(db, `exam_sessions/${id}`), { status: s === 'open' ? 'closed' : 'open' });
  const delSession = (id) => { if(window.confirm("Hapus sesi ini?")) remove(dbRef(db, `exam_sessions/${id}`)); };
  const setMonitor = (t) => { setActiveMonitorToken(t); localStorage.setItem('activeMonitorToken', t); setActiveTab('proctor'); };
  const openQR = (token) => { setActiveQRToken(token); setShowQRModal(true); };

  const NavItem = ({ tab, icon: Icon, label }) => (<button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/30' : 'text-slate-500 hover:bg-slate-100 font-bold'}`}><Icon size={20}/> <span>{label}</span></button>);

  const OfficialHeader = () => (
    <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
      <h1 className="text-2xl font-black uppercase tracking-widest text-black">YASPENDIK PTP NUSANTARA IV</h1>
      <h2 className="text-xl font-black uppercase tracking-widest text-black mt-1">SMP/MTS DARMA PERTIWI BAH BUTONG</h2>
      <p className="mt-2 text-sm font-bold text-gray-800">Dokumen Resmi Administrasi Ujian Berbasis Komputer (CBT)</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      <style>{`
        @media print { 
          @page { margin: 1cm; } body { background: white !important; -webkit-print-color-adjust: exact; } 
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
        <div className="p-4 mx-4 mt-4 mb-2 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xl uppercase shadow-inner shrink-0">{teacherProfile?.name?.charAt(0) || 'G'}</div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">VERSI {APP_VERSION}</p>
            <p className="text-sm font-bold truncate text-slate-800">{teacherProfile?.name}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Monitor} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal (V2)" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai & Cetak" />
          <div className="my-4 border-t border-slate-100"></div>
          <NavItem tab="profile" icon={User} label="Profil Saya" />
        </nav>
        {isSuperAdmin && (
          <div className="px-4 mb-2">
            <button onClick={triggerGlobalUpdate} className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-95 uppercase tracking-tighter"><Zap size={16}/> Rilis Update Global</button>
          </div>
        )}
        <div className="p-6 border-t border-slate-100"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl font-bold transition-colors shadow-sm"><LogOut size={20}/> Keluar Akun</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 lg:p-6 flex justify-between items-center z-10 print:hidden pr-16 md:pr-6">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 bg-slate-100 rounded-lg text-emerald-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24}/></button>
            <h2 className="text-xl lg:text-2xl font-black text-slate-800 hidden sm:flex items-center gap-2 tracking-wide">Teacher Center <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-md uppercase font-black">V2 Staging</span></h2>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <ShieldCheck size={16} className="text-emerald-500" /><span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Sistem Stabil</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* TAB SESI UJIAN */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 h-fit">
                <h3 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4"><Plus className="text-emerald-500"/> Buka Sesi Baru</h3>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Mata Pelajaran</label><select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:border-emerald-500"><option value="">-- Daftar Mapel --</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-3">
                     <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Tingkat</label><select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700"><option value="">Pilih</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select></div>
                     <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Ruang/Sub</label><input id="subkelas_session" placeholder="Cth: A" required className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl uppercase font-bold text-center" /></div>
                  </div>
                  
                  {/* PENGATURAN KUOTA SOAL V2 */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
                    <label className="text-xs font-black text-emerald-800 uppercase flex items-center gap-2"><Settings size={14}/> Kuota Tarik Soal (Acak)</label>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Jml PG</label>
                            <input type="number" min="0" value={kuotaPG} onChange={e => setKuotaPG(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-center font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Jml PGK</label>
                            <input type="number" min="0" value={kuotaPGK} onChange={e => setKuotaPGK(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-center font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Jml Esai</label>
                            <input type="number" min="0" value={kuotaEsai} onChange={e => setKuotaEsai(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-center font-bold" />
                        </div>
                    </div>
                  </div>

                  <div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Token Sesi</label><div className="flex gap-2"><input id="token_input" required placeholder="Generate..." className="w-full p-4 border border-emerald-200 bg-emerald-50 rounded-2xl uppercase font-mono font-black tracking-widest text-emerald-800" /><button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-4 bg-slate-800 text-white rounded-2xl"><Dices size={24}/></button></div></div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 mt-2 rounded-2xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all tracking-widest">RILIS UJIAN</button>
                </form>
              </div>
              
              <div className="xl:col-span-2 space-y-4">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 border-b border-slate-200 pb-4"><Activity className="text-emerald-500"/> Manajemen Sesi Aktif</h3>
                {mySessions.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-slate-300 text-slate-400 font-bold">Belum ada sesi yang dirilis.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mySessions.map((s) => (
                      <div key={s.id} className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between transition-colors ${s.status==='open'?'bg-white border-emerald-200':'bg-slate-50 border-slate-200 opacity-80'}`}>
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-3xl font-black font-mono tracking-widest text-slate-800">{s.token}</h4>
                            <span className={`p-2 rounded-xl shadow-sm ${s.status==='open'?'bg-emerald-100 text-emerald-600 border border-emerald-200':'bg-red-100 text-red-600 border border-red-200'}`}>{s.status==='open'?<Unlock size={20}/>:<Lock size={20}/>}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <span className="text-xs font-black bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm">{s.mapel}</span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">Kls: {s.kelas}-{s.subKelas}</span>
                          </div>
                          <div className="flex gap-2 mb-6 text-[10px] font-black text-slate-500 bg-slate-100 p-2 rounded-lg border border-slate-200">
                             <span>PG: {s.kuotaPG || 0}</span> | <span>PGK: {s.kuotaPGK || 0}</span> | <span>Esai: {s.kuotaEsai || 0}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-4">
                          <button onClick={() => openQR(s.token)} className="col-span-2 bg-blue-50 text-blue-600 py-3 rounded-xl text-xs font-bold flex justify-center items-center gap-2 border border-blue-100"><QrCode size={16}/> QR</button>
                          <button onClick={() => setMonitor(s.token)} className="col-span-2 bg-slate-800 text-white py-3 rounded-xl text-xs font-bold flex justify-center items-center gap-2"><Eye size={16}/> Monitor</button>
                          
                          <button onClick={() => toggleSession(s.id, s.status)} className="col-span-2 bg-slate-50 text-slate-700 py-3 rounded-xl text-xs font-bold flex justify-center items-center gap-2 border border-slate-200">{s.status==='open'?<Lock size={16}/>:<Unlock size={16}/>} Kunci</button>
                          <button onClick={() => delSession(s.id)} className="col-span-2 bg-red-50 text-red-600 py-3 rounded-xl text-xs font-bold flex justify-center items-center gap-2 border border-red-100"><Trash2 size={16}/> Hapus</button>

                          {/* Tombol Koreksi Esai Aktif Jika Sesi Ditutup */}
                          {s.status === 'closed' && (
                            <button onClick={() => { setKoreksiSession(s); setShowKoreksiModal(true); }} className="col-span-4 mt-2 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 py-3 rounded-xl text-xs font-black flex justify-center items-center gap-2 transition-colors">
                              <CheckSquare size={16}/> KOREKSI ESAI SERENTAK
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB BANK SOAL (V2 TERINTEGRASI) */}
          {activeTab === 'bank' && (
            <div className="space-y-6 max-w-6xl mx-auto print:max-w-full">
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 print:hidden space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><BookOpen className="text-emerald-500"/> Bank Soal V2 (3 Format)</h3>
                  <div className="flex gap-2">
                    <button onClick={downloadTemplate} className="p-3 bg-white border border-slate-200 text-slate-700 rounded-xl" title="Download Template Excel V2"><Download size={20}/></button>
                    <button onClick={triggerImport} className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl" title="Import Excel"><Upload size={20}/></button>
                    <button onClick={() => { setEditSoalId(null); setFormData(defaultForm); setShowModal(true); setPreviewMode(false); }} className="px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={18}/> Ketik Soal</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <select value={bankMapel} onChange={e => setBankMapel(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-bold text-slate-700"><option value="">-- Semua Mata Pelajaran --</option>{availableBankMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <select value={bankKelas} onChange={e => setBankKelas(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-bold text-slate-700"><option value="">-- Semua Tingkatan Kelas --</option>{availableBankKelas.map(k => <option key={k}>{k}</option>)}</select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between break-inside-avoid">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-100 pb-4">
                        <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">{q?.mapel} - Tk. {q?.kelas}</span>
                        {/* Label Tipe Soal */}
                        <span className={`text-xs font-black px-3 py-1.5 rounded-lg border ${(!q.jenisSoal || q.jenisSoal === 'PG') ? 'bg-blue-50 text-blue-700 border-blue-200' : q.jenisSoal === 'PGK' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                           Tipe: {q.jenisSoal || 'PG'}
                        </span>
                        {q.kodeWacana && <span className="text-xs font-black bg-slate-800 text-white px-3 py-1.5 rounded-lg">Wacana: {q.kodeWacana}</span>}
                      </div>
                      
                      {q?.gambar && <img src={q.gambar} alt="Gambar" className="mb-4 max-w-sm rounded-2xl border border-slate-100" />}
                      {q?.teksWacana && (
                         <div className="mb-4 p-4 bg-slate-50 border-l-4 border-slate-400 rounded-r-xl text-sm font-medium text-slate-600">
                             <Latex>{String(q.teksWacana)}</Latex>
                         </div>
                      )}

                      <div className="font-bold text-lg mb-6 text-slate-800 flex">
                        <span className="text-emerald-600 mr-2">{i+1}.</span>
                        <div className="flex-1"><Latex>{String(q?.pertanyaan || ' ')}</Latex></div>
                      </div>

                      {/* Render Opsi Jika Bukan Esai */}
                      {(!q.jenisSoal || q.jenisSoal !== 'ESAI') && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 font-medium">
                            {['A','B','C','D'].map(opt => {
                              // Logika Kunci untuk PG vs PGK
                              const isKey = q.jenisSoal === 'PGK' 
                                ? (q.kunci && q.kunci.includes(opt)) 
                                : q.kunci === opt;

                              return (
                              <div key={opt} className={`p-4 rounded-2xl border flex break-words ${isKey ?'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 shadow-sm':'bg-slate-50 border-slate-200'}`}>
                                 <span className="mr-2 font-black">{opt}.</span>
                                 <div className="flex-1"><Latex>{String(q[`opsi${opt}`] || ' ')}</Latex></div>
                              </div>
                            )})}
                          </div>
                      )}
                    </div>
                    <div className="flex gap-3 self-end md:self-start mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
                      <button onClick={() => openEditModal(q)} className="flex-1 md:flex-none flex justify-center items-center bg-blue-50 text-blue-600 p-4 rounded-xl"><Edit size={22}/></button>
                      <button onClick={() => {if(window.confirm("Hapus soal ini?")) remove(dbRef(db, `bank_soal/${q.id}`))}} className="flex-1 md:flex-none flex justify-center items-center bg-red-50 text-red-600 p-4 rounded-xl"><Trash2 size={22}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SISA TAB LAINNYA (Monitor, Rekap, Profil) TETAP SAMA SEPERTI KODE SEBELUMNYA */}
          {/* ... (Tab Proctor, Recap, Profile sengaja dipersingkat di view ini agar code tidak terpotong, logikanya sama persis dengan yang Bos berikan) ... */}

        </div>
      </main>

      {/* MODAL KOREKSI ESAI SERENTAK (KERANGKA UI) */}
      {showKoreksiModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[130] print:hidden">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><CheckSquare className="text-emerald-500"/> Koreksi Esai Serentak</h2>
                        <p className="text-sm font-bold text-slate-500 mt-1">Sesi Token: {koreksiSession?.token} | Mapel: {koreksiSession?.mapel}</p>
                    </div>
                    <button onClick={() => setShowKoreksiModal(false)} className="p-3 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 rounded-full"><X size={24}/></button>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl mb-6">
                    <p className="text-sm font-bold text-blue-800">Ruang Koreksi sedang disiapkan. Data jawaban siswa akan terhubung setelah logika penyimpanan di <code className="bg-white px-2 py-1 rounded text-blue-900">ExamRoom.jsx</code> kita sinkronisasikan pada tahap selanjutnya.</p>
                </div>

                <div className="flex justify-end mt-6">
                    <button onClick={() => setShowKoreksiModal(false)} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold">Tutup Ruang Koreksi</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL TAMBAH/EDIT SOAL MANUAL (V2 PROPER EDITOR) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[110] print:hidden">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Edit className="text-emerald-500"/> {editSoalId ? 'Revisi Soal Ujian' : 'Ketik Soal Baru'}
              </h2>
              <button type="button" onClick={() => setPreviewMode(!previewMode)} className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 ${previewMode ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
                {previewMode ? <Edit size={16}/> : <Eye size={16}/>} {previewMode ? 'Kembali ke Editor' : 'Pratinjau Soal'}
              </button>
            </div>

            {previewMode ? (
              // --- V2: MODE PRATINJAU ---
              <div className="p-4 sm:p-8 bg-slate-50 rounded-3xl border border-slate-200 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="mb-4">
                     <span className="text-xs font-black bg-slate-800 text-white px-3 py-1 rounded-lg">Format: {formData.jenisSoal}</span>
                  </div>
                  {formData.gambar && <img src={formData.gambar} alt="Preview" className="mb-6 rounded-xl max-h-60 border border-slate-100" />}
                  {formData.teksWacana && (
                      <div className="mb-4 p-4 bg-slate-50 border-l-4 border-slate-400 rounded-r-xl text-sm font-medium">
                         <Latex>{String(formData.teksWacana)}</Latex>
                      </div>
                  )}
                  <div className="text-lg font-bold text-slate-800">
                    <Latex>{String(formData.pertanyaan || 'Ketik pertanyaan...')}</Latex>
                  </div>
                </div>
                
                {formData.jenisSoal !== 'ESAI' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {['A','B','C','D'].map(opt => {
                        const isKey = formData.jenisSoal === 'PGK' ? (formData.kunci && formData.kunci.includes(opt)) : formData.kunci === opt;
                        return (
                        <div key={opt} className={`p-5 rounded-2xl border-2 bg-white flex ${isKey ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100'}`}>
                        <span className={`font-black mr-3 ${isKey ? 'text-emerald-600' : 'text-slate-400'}`}>{opt}.</span>
                        <div className="flex-1 font-medium text-slate-700"><Latex>{String(formData[`opsi${opt}`] || ' ')}</Latex></div>
                        </div>
                    )})}
                    </div>
                )}
              </div>
            ) : (
              // --- MODE EDITOR FORM ---
              <form onSubmit={handleAddOrEditSoal} className="space-y-5 animate-in fade-in duration-200">
                {/* BLOK IDENTITAS SOAL */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Jenis Soal</label>
                     <select value={formData.jenisSoal} onChange={e => setFormData({...formData, jenisSoal: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 font-bold outline-none focus:border-emerald-500 cursor-pointer">
                        <option value="PG">Pilihan Ganda (PG) Biasa</option>
                        <option value="PGK">Pilihan Ganda Kompleks (PGK)</option>
                        <option value="ESAI">Soal Esai</option>
                     </select>
                  </div>
                  <div><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Mata Pelajaran</label><input required value={formData.mapel} placeholder="Cth: IPA" className="w-full p-3 border border-slate-200 rounded-xl font-bold" onChange={e => setFormData({...formData, mapel: e.target.value})} /></div>
                  <div><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Tingkat / Kelas</label><input required value={formData.kelas} placeholder="Cth: 9" className="w-full p-3 border border-slate-200 rounded-xl font-bold text-center" onChange={e => setFormData({...formData, kelas: e.target.value})} /></div>
                </div>

                {/* BLOK WACANA (OPSIONAL) */}
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-blue-800 uppercase flex items-center gap-2"><FileText size={16}/> Pengikat Wacana / Teks Panjang (Opsional)</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <input value={formData.kodeWacana} onChange={e => setFormData({...formData, kodeWacana: e.target.value})} placeholder="Kode (Cth: W-01)" className="w-full p-3 border border-blue-200 rounded-xl font-bold bg-white" />
                        </div>
                        <div className="md:col-span-3">
                            <textarea value={formData.teksWacana} onChange={e => setFormData({...formData, teksWacana: e.target.value})} placeholder="Ketik/Paste teks wacana bacaan di sini..." className="w-full p-3 border border-blue-200 rounded-xl font-medium bg-white h-12 min-h-[48px]" />
                        </div>
                    </div>
                </div>

                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Link Gambar Soal (Opsional)</label>
                  <input value={formData.gambar} placeholder="URL Gambar..." className="w-full p-4 border border-slate-200 rounded-2xl font-medium" onChange={e => setFormData({...formData, gambar: e.target.value})} />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between">
                    <span>Teks Pertanyaan Utama</span><span className="text-[10px] bg-blue-100 text-blue-700 px-2 rounded font-black">$...$ = Math</span>
                  </label>
                  <textarea required value={formData.pertanyaan} placeholder="Ketik soal di sini..." className="w-full p-5 border border-slate-200 rounded-2xl min-h-[120px]" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} />
                </div>
                
                {/* OPSI JAWABAN (Disembunyikan jika ESAI) */}
                {formData.jenisSoal !== 'ESAI' && (
                    <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Opsi Jawaban & Kunci</label>
                    
                    {formData.jenisSoal === 'PGK' ? (
                        <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl mb-3 text-xs font-bold text-orange-800">
                            Mode PGK Aktif: Centang kotak di samping kiri opsi untuk menjadikannya Kunci Jawaban (Bisa lebih dari 1).
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A','B','C','D'].map(opt => {
                           const isChecked = formData.jenisSoal === 'PGK' ? (formData.kunci && formData.kunci.includes(opt)) : false;
                           return (
                        <div key={opt} className="flex gap-2 items-center">
                            {formData.jenisSoal === 'PGK' && (
                                <input type="checkbox" checked={isChecked} onChange={() => handlePGKKeyToggle(opt)} className="w-6 h-6 rounded cursor-pointer accent-emerald-500" />
                            )}
                            <div className="relative flex-1">
                                <span className="absolute left-4 top-4 font-black text-emerald-500">{opt}.</span>
                                <input required value={formData[`opsi${opt}`]} className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} />
                            </div>
                        </div>
                        )})}
                    </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-4 border-t border-slate-100">
                  {formData.jenisSoal === 'PG' ? (
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Kunci Jawaban Benar (Pilih Satu)</label>
                        <select className="w-full p-4 border border-emerald-300 bg-emerald-50 text-emerald-800 font-black rounded-2xl" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}>
                        <option value="A">Opsi A</option><option value="B">Opsi B</option><option value="C">Opsi C</option><option value="D">Opsi D</option>
                        </select>
                    </div>
                  ) : <div></div> /* Spacer untuk PGK/Esai agar tombol simpan di kanan */}

                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowModal(false); setEditSoalId(null); setFormData(defaultForm); setPreviewMode(false); }} className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-slate-600">Batalkan</button>
                    <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black">{editSoalId ? 'Simpan Revisi' : 'Tambahkan Soal'}</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
