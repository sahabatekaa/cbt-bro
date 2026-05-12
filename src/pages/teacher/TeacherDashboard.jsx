// src/pages/teacher/TeacherDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db, getTenantPath } from '../../config/firebase';
import { ref as dbRef, onValue, push, remove, update, set } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap, Edit, Activity, User, MessageSquare, Send, FileText, ClipboardList, ShieldAlert, QrCode, ImageIcon, Zap, ShieldCheck, CheckSquare, Check, Percent, Clock } from 'lucide-react';

const APP_VERSION = "3.0.0 SaaS";

export default function TeacherDashboard({ onLogout }) {
  const { userData, tenantData } = useAuth();
  const schoolId = userData?.schoolId;
  const schoolName = tenantData?.schoolName || "CBT DARMA PERTIWI";
  const currentUserEmail = userData?.email || 'guru@unknown.com';

  const [activeTab, setActiveTab] = useState(localStorage.getItem('teacherTab') || 'settings');
  useEffect(() => { localStorage.setItem('teacherTab', activeTab); }, [activeTab]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeQRToken, setActiveQRToken] = useState('');
  
  const [showKoreksiModal, setShowKoreksiModal] = useState(false);
  const [koreksiSession, setKoreksiSession] = useState(null);
  const [essayStudents, setEssayStudents] = useState([]);
  const [essayQuestions, setEssayQuestions] = useState([]);
  const [essayScores, setEssayScores] = useState({});

  const [tempProfileName, setTempProfileName] = useState(userData?.name || ''); 
  const fileInputRef = useRef(null);

  // STATE SESI & BOBOT
  const [selectedMapelSesi, setSelectedMapelSesi] = useState('');
  const [kuotaPG, setKuotaPG] = useState(0);
  const [kuotaPGK, setKuotaPGK] = useState(0);
  const [kuotaEsai, setKuotaEsai] = useState(0);
  const [bobotPG, setBobotPG] = useState(70);
  const [bobotEsai, setBobotEsai] = useState(30);
  const [jamMulai, setJamMulai] = useState("07:30");
  const [jamSelesai, setJamSelesai] = useState("09:00");

  const [showEditSesiModal, setShowEditSesiModal] = useState(false);
  const [editSesiData, setEditSesiData] = useState({ id: '', bobotPG: 70, bobotEsai: 30, jamMulai: '07:30', jamSelesai: '09:00', mapel: '', token: '' });

  const [bankMapel, setBankMapel] = useState('');
  const [bankKelas, setBankKelas] = useState('');
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [recapToken, setRecapToken] = useState(''); 
  
  const [broadcastText, setBroadcastText] = useState(''); 
  const [printMode, setPrintMode] = useState('rekap'); 

  const defaultForm = { 
    jenisSoal: 'PG', kodeWacana: '', teksWacana: '', 
    mapel: '', kelas: '', pertanyaan: ' ', gambar: '', 
    opsiA: ' ', opsiB: ' ', opsiC: ' ', opsiD: ' ', kunci: 'A' 
  };
  const [formData, setFormData] = useState(defaultForm);
  const [editSoalId, setEditSoalId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // FETCH DATA SAAS (TERISOLASI PER SEKOLAH)
  useEffect(() => {
    if (!schoolId) return;

    const fetchData = (path, key) => {
      const tenantPath = getTenantPath(schoolId, path);
      return onValue(dbRef(db, tenantPath), snap => {
        const val = snap.val();
        if (val && typeof val === 'object') {
          setData(prev => ({ ...prev, [key]: Object.keys(val).map(k => ({ ...val[k], id: k })) }));
        } else {
          setData(prev => ({ ...prev, [key]: [] }));
        }
      });
    };
    
    const unsub1 = fetchData('live_students', 'live'); 
    const unsub2 = fetchData('bank_soal', 'bank'); 
    const unsub3 = fetchData('leaderboard', 'lead'); 
    const unsub4 = fetchData('exam_sessions', 'sessions');

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [schoolId]);

  const myQuestions = data.bank.filter(q => q.teacherEmail === currentUserEmail);
  const mySessions = data.sessions.filter(s => s.teacherEmail === currentUserEmail).sort((a,b) => b.timestamp - a.timestamp);
  const myLeaderboard = data.lead.filter(s => s.teacherEmail === currentUserEmail).sort((a,b) => b.score - a.score);
  const monitoredStudents = data.live.filter(s => s.token === activeMonitorToken);

  const availableMapel = [...new Set(myQuestions.map(q => q.mapel).filter(Boolean))];
  const availableKelasSesi = [...new Set(myQuestions.filter(q => q.mapel === selectedMapelSesi).map(q => q.kelas).filter(Boolean))];
  const availableBankMapel = [...new Set(myQuestions.map(q => q.mapel).filter(Boolean))];
  const availableBankKelas = [...new Set(myQuestions.map(q => q.kelas).filter(Boolean))];
  const filteredQuestions = myQuestions.filter(q => (bankMapel === '' || q.mapel === bankMapel) && (bankKelas === '' || q.kelas === bankKelas));
  const availableRecapMapel = [...new Set(myLeaderboard.map(s => s.mapel).filter(Boolean))];
  const availableRecapKelas = [...new Set(myLeaderboard.map(s => s.class).filter(Boolean))];
  const availableRecapTokens = [...new Set(myLeaderboard.map(s => s.token).filter(Boolean))];
  const filteredLeaderboard = myLeaderboard.filter(s => (recapMapel === '' || s.mapel === recapMapel) && (recapKelas === '' || s.class === recapKelas) && (recapToken === '' || s.token === recapToken));

  // LOGIKA HANDLERS
  const handleUpdateProfile = (e) => {
    e.preventDefault();
    update(dbRef(db, `users/${userData.uid}`), { name: tempProfileName });
    alert("Profil diperbarui!");
  };

  const handleCreateSession = (e) => { 
    e.preventDefault(); 
    const t = document.getElementById('token_input').value; 
    const k = document.getElementById('kelas_session').value; 
    if(!t || !selectedMapelSesi || !k) return alert("Lengkapi data sesi!"); 

    const bPG = parseInt(bobotPG) || 0;
    const bEsai = parseInt(bobotEsai) || 0;
    if (bPG + bEsai !== 100) return alert("Total Bobot PG dan Esai harus tepat 100%!");
    
    push(dbRef(db, getTenantPath(schoolId, 'exam_sessions')), { 
      token: t, mapel: selectedMapelSesi, kelas: k, status: 'open', 
      kuotaPG: parseInt(kuotaPG) || 0, kuotaPGK: parseInt(kuotaPGK) || 0, kuotaEsai: parseInt(kuotaEsai) || 0,
      bobotPG: bPG, bobotEsai: bEsai, jamMulai: jamMulai, jamSelesai: jamSelesai,
      teacherEmail: currentUserEmail, timestamp: Date.now() 
    }); 
    alert("Sesi Ujian Dibuka!"); 
  };

  const toggleSession = (id, s) => update(dbRef(db, getTenantPath(schoolId, `exam_sessions/${id}`)), { status: s === 'open' ? 'closed' : 'open' });
  const delSession = (id) => { if(window.confirm("Hapus sesi?")) remove(dbRef(db, getTenantPath(schoolId, `exam_sessions/${id}`))); };
  
  const handleAddOrEditSoal = (e) => { 
    e.preventDefault(); 
    const finalData = { ...formData };
    if(finalData.jenisSoal === 'ESAI') {
        finalData.opsiA = ''; finalData.opsiB = ''; finalData.opsiC = ''; finalData.opsiD = ''; finalData.kunci = '';
    }
    if (editSoalId) { 
        update(dbRef(db, getTenantPath(schoolId, `bank_soal/${editSoalId}`)), finalData); 
    } else { 
        push(dbRef(db, getTenantPath(schoolId, 'bank_soal')), { ...finalData, teacherEmail: currentUserEmail }); 
    }
    setShowModal(false); setEditSoalId(null); setFormData(defaultForm);
  };

  const NavItem = ({ tab, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-600 text-white font-black shadow-md' : 'text-slate-500 hover:bg-slate-100 font-bold'}`}>
        <Icon size={18}/> <span className="text-sm">{label}</span>
    </button>
  );

  const OfficialHeader = () => (
    <div className="hidden print:block text-center mb-8 border-b-4 border-double border-black pb-4">
      <h1 className="text-2xl font-black uppercase tracking-widest text-black">{schoolName}</h1>
      <p className="mt-2 text-sm font-bold text-gray-800 uppercase tracking-tighter">Administrasi Ujian Berbasis Komputer (CBT V3.0)</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      <style>{`
        @media print { 
          @page { margin: 1cm; size: portrait; } 
          html, body, #root { height: auto !important; overflow: visible !important; background: white !important; -webkit-print-color-adjust: exact; margin: 0; }
          .h-screen, .min-h-screen, .overflow-hidden, .overflow-y-auto, main, .flex-1 { height: auto !important; min-height: auto !important; overflow: visible !important; display: block !important; position: static !important; } 
          aside, header, button, select, input, .print\\:hidden { display: none !important; } 
          .print\\:block { display: block !important; } 
          table { width: 100% !important; border-collapse: collapse; margin-top: 10px; border: 1.5px solid black !important; page-break-inside: auto; } 
          thead { display: table-header-group; } 
          tr { page-break-inside: avoid; page-break-after: auto; } 
          th, td { border: 1px solid #000 !important; padding: 6px 8px !important; color: black !important; font-size: 11px !important; line-height: 1.3; } 
          th { background-color: #f0f0f0 !important; font-weight: bold; text-transform: uppercase; } 
        }
      `}</style>
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl md:shadow-none`}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center"><h1 className="text-lg font-black text-emerald-700 flex gap-2 items-center tracking-tight"><GraduationCap size={24} className="text-emerald-500"/> TEACHER V3</h1><button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button></div>
        <div className="p-4 mx-3 mt-3 mb-1 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xl shrink-0 uppercase">{userData?.name?.charAt(0)}</div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">INSTITUSI AKTIF</p>
            <p className="text-xs font-bold truncate text-slate-800">{schoolName}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Monitor} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Bank Soal" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai" />
          <div className="my-3 border-t border-slate-100"></div>
          <NavItem tab="profile" icon={User} label="Profil" />
        </nav>
        <div className="p-4 border-t border-slate-100"><button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-sm transition-colors"><LogOut size={16}/> Logout</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-3 lg:p-4 flex justify-between items-center z-10 print:hidden shadow-sm">
          <button className="md:hidden p-1.5 bg-slate-100 rounded-lg text-emerald-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{userData?.name} <span className="text-emerald-500 font-medium lowercase">({currentUserEmail})</span></h2>
          <div className="bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-emerald-700 uppercase">Tenant Sync OK</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* TAB SESI UJIAN */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 max-w-7xl mx-auto animate-in fade-in duration-300">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                  <h3 className="text-lg font-black mb-5 text-slate-800 border-b pb-3">Buka Sesi Ujian</h3>
                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"><option value="">Pilih Mapel...</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select>
                    <select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl font-bold text-sm outline-none"><option value="">Tingkat/Kelas...</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select>
                    <div className="flex gap-2">
                       <input id="token_input" required placeholder="TOKEN..." className="w-full p-3 border border-emerald-200 bg-emerald-50 rounded-xl font-black text-emerald-800 uppercase outline-none" />
                       <button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-3 bg-slate-800 text-white rounded-xl"><Dices size={20}/></button>
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition-all">RILIS SESI SEKARANG</button>
                  </form>
               </div>
               
               <div className="xl:col-span-2 space-y-4">
                  {mySessions.map(s => (
                    <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                       <div className="text-center md:text-left">
                          <p className="text-2xl font-black font-mono text-emerald-600 tracking-widest">{s.token}</p>
                          <p className="text-xs font-bold text-slate-500 uppercase">{s.mapel} (Kls {s.kelas})</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => toggleSession(s.id, s.status)} className={`px-4 py-2 rounded-lg text-xs font-black border ${s.status === 'open' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{s.status === 'open' ? 'KUNCI' : 'BUKA'}</button>
                          <button onClick={() => delSession(s.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* TAB REKAP & PRINT */}
          {activeTab === 'recap' && (
            <div className="max-w-7xl mx-auto print:max-w-full animate-in fade-in duration-300">
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden mb-6 space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                     <h3 className="text-lg font-black text-slate-800">Cetak Administrasi Nilai</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                     <select value={recapMapel} onChange={e => setRecapMapel(e.target.value)} className="p-3 border border-slate-200 rounded-xl font-bold bg-slate-50"><option value="">Semua Mapel</option>{availableRecapMapel.map(m => <option key={m}>{m}</option>)}</select>
                     <select value={recapKelas} onChange={e => setRecapKelas(e.target.value)} className="p-3 border border-slate-200 rounded-xl font-bold bg-slate-50"><option value="">Semua Kelas</option>{availableRecapKelas.map(k => <option key={k}>{k}</option>)}</select>
                     <button onClick={() => { setPrintMode('rekap'); setTimeout(() => window.print(), 300); }} className="bg-slate-800 text-white rounded-xl font-black text-sm tracking-wide">CETAK LAPORAN</button>
                  </div>
               </div>

               {/* VIEW KHUSUS CETAK */}
               <div className="hidden print:block">
                  <OfficialHeader />
                  <h3 className="text-center font-black text-lg underline mb-6">DAFTAR NILAI SISWA</h3>
                  <table className="w-full">
                     <thead><tr><th>No</th><th>Nama Siswa</th><th>Kelas</th><th>Skor</th></tr></thead>
                     <tbody>
                        {filteredLeaderboard.map((s, i) => (
                          <tr key={s.id}><td>{i+1}</td><td className="font-bold uppercase">{s.name}</td><td>{s.class}</td><td className="font-black">{s.score}</td></tr>
                        ))}
                     </tbody>
                  </table>
                  <div className="flex justify-end mt-12 text-center"><div className="w-64"><p>Tgl: {new Date().toLocaleDateString()}</p><br/><br/><br/><p className="font-bold underline uppercase">{userData?.name}</p></div></div>
               </div>

               {/* TABEL PREVIEW */}
               <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm print:hidden">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                        <tr><th className="p-4">Identitas Siswa</th><th className="p-4">Mapel</th><th className="p-4 text-center">Skor Akhir</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {filteredLeaderboard.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                             <td className="p-4"><p className="font-black text-slate-800">{s.name}</p><p className="text-[10px] text-slate-400">Token: {s.token}</p></td>
                             <td className="p-4 font-bold text-slate-600">{s.mapel} ({s.class})</td>
                             <td className="p-4 text-center"><span className="text-lg font-black text-emerald-600">{s.score}</span></td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          )}
          
          {/* TAB PROFILE */}
          {activeTab === 'profile' && (
            <div className="max-w-xl mx-auto animate-in zoom-in duration-300">
               <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-black mb-6 border-b pb-3">Profil Pengajar</h3>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                     <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Nama Lengkap & Gelar</label><input required value={tempProfileName} onChange={e => setTempProfileName(e.target.value)} className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold outline-none focus:border-emerald-500" /></div>
                     <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Email Akun</label><input disabled value={currentUserEmail} className="w-full p-4 border border-slate-100 bg-slate-100 rounded-2xl font-bold text-slate-400" /></div>
                     <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/30">UPDATE IDENTITAS</button>
                  </form>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}