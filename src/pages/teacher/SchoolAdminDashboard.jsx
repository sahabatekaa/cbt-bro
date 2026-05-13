// src/pages/teacher/SchoolAdminDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import { ref, onValue, update, remove, set, push } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from 'firebase/auth'; 
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  Users, ClipboardList, LogOut, Plus, Trash2, Edit, CheckCircle, 
  XCircle, KeyRound, Menu, X, ShieldCheck, UserCog, BarChart, 
  FileText, Download, Loader2, AlertTriangle, LayoutDashboard, 
  Building2, MapPin, Briefcase, Phone, Crown, GraduationCap, 
  Database, BookOpen, Radio, Upload, Image as ImageIcon, MessageCircle 
} from 'lucide-react';

export default function SchoolAdminDashboard() {
  const navigate = useNavigate();
  const auth = getAuth();
  const fileInputRef = useRef(null);
  
  const [adminProfile, setAdminProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); 

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data Global 
  const [data, setData] = useState({ users: [], lead: [], students: [], classes: [], subjects: [], sessions: [] });
  const [schoolInfo, setSchoolInfo] = useState(null); 
  
  // Forms
  const [schoolForm, setSchoolForm] = useState({ alamat: '', kepalaSekolah: '', nipKepalaSekolah: '', telepon: '', logoUrl: '' });
  const [guruForm, setGuruForm] = useState({ name: '', email: '', password: '' });
  const [studentForm, setStudentForm] = useState({ name: '', nisn: '', kelas: '', subKelas: '' });
  const [classForm, setClassForm] = useState('');
  const [subjectForm, setSubjectForm] = useState('');

  // Modals
  const [showAddGuruModal, setShowAddGuruModal] = useState(false);
  const [showEditGuruModal, setShowEditGuruModal] = useState(false);
  const [editGuruId, setEditGuruId] = useState(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);

  const [recapGuru, setRecapGuru] = useState('');
  const [recapMapel, setRecapMapel] = useState('');
  const [recapKelas, setRecapKelas] = useState('');
  const [printMode, setPrintMode] = useState('rekap');

  // 1. Tarik Data Profil dengan Aman
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        onValue(userRef, (snap) => {
          if (snap.exists()) setAdminProfile(snap.val());
          setIsLoadingProfile(false);
        });
      } else {
        setAdminProfile(null);
        setIsLoadingProfile(false);
      }
    });
    return () => unsubscribeAuth();
  }, [auth]);

  const schoolId = adminProfile?.schoolId || 'UNREGISTERED';
  const adminName = adminProfile?.name || 'Admin Sekolah';

  // 2. Tarik Data Global Terpadu 
  useEffect(() => {
    if (schoolId === 'UNREGISTERED') return; 

    const fetchData = (path, key) => onValue(ref(db, path), snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        const parsedData = Object.keys(val).map(k => {
           if(val[k]) return { ...val[k], id: k };
           return null;
        }).filter(Boolean);
        setData(prev => ({ ...prev, [key]: parsedData }));
      } else {
        setData(prev => ({ ...prev, [key]: [] }));
      }
    });

    fetchData('users', 'users');
    fetchData('leaderboard', 'lead');
    fetchData('students', 'students');
    fetchData('master_classes', 'classes');
    fetchData('master_subjects', 'subjects');
    fetchData('exam_sessions', 'sessions');

    const schoolRef = ref(db, `clients/${schoolId.toLowerCase()}`);
    const unsubSchool = onValue(schoolRef, snap => {
       if(snap.exists()) {
          const sData = snap.val();
          setSchoolInfo(sData);
          setSchoolForm({
             alamat: sData?.alamat || '', kepalaSekolah: sData?.kepalaSekolah || '',
             nipKepalaSekolah: sData?.nipKepalaSekolah || '', telepon: sData?.telepon || sData?.waNumber || '', logoUrl: sData?.logoUrl || ''
          });
       } else {
          setSchoolInfo(null);
       }
    });

    return () => unsubSchool();
  }, [schoolId]);

  // --- FUNGSI LOGOUT INTERNAL ---
  const handleLogout = () => {
    signOut(auth).then(() => {
      localStorage.clear();
      navigate('/login');
    }).catch((error) => alert("Gagal keluar: " + error.message));
  };

  // --- MANAJEMEN PROFIL SEKOLAH ---
  const handleUpdateSchool = (e) => {
    e.preventDefault();
    update(ref(db, `clients/${schoolId.toLowerCase()}`), schoolForm).then(() => alert("Profil Diperbarui!")).catch(err => alert("Gagal: " + err.message));
  };

  const safeUsers = Array.isArray(data.users) ? data.users : [];
  const safeLead = Array.isArray(data.lead) ? data.lead : [];
  const safeSessions = Array.isArray(data.sessions) ? data.sessions : [];
  const safeStudents = Array.isArray(data.students) ? data.students : [];
  const safeClasses = Array.isArray(data.classes) ? data.classes : [];
  const safeSubjects = Array.isArray(data.subjects) ? data.subjects : [];

  // PERBAIKAN: Pencocokan schoolId secara Case-Insensitive agar Guru Pending tidak Hilang/Blank
  const schoolTeachers = safeUsers.filter(u => u?.schoolId?.toLowerCase() === schoolId.toLowerCase() && u?.role === 'teacher');
  const pendingTeachers = schoolTeachers.filter(u => u?.status === 'pending');
  const activeTeachers = schoolTeachers.filter(u => u?.status !== 'pending');
  const schoolTeacherEmails = schoolTeachers.map(t => t?.email).filter(Boolean);
  
  const schoolSessionsTokens = safeSessions.filter(s => schoolTeacherEmails.includes(s?.teacherEmail)).map(s => s?.token).filter(Boolean);
  const schoolLeaderboard = safeLead.filter(l => schoolTeacherEmails.includes(l?.teacherEmail) || schoolSessionsTokens.includes(l?.token));
  
  const schoolStudents = safeStudents.filter(s => s?.schoolId?.toLowerCase() === schoolId.toLowerCase());
  const schoolClasses = safeClasses.filter(c => c?.schoolId?.toLowerCase() === schoolId.toLowerCase());
  const schoolSubjects = safeSubjects.filter(s => s?.schoolId?.toLowerCase() === schoolId.toLowerCase());
  const schoolSessions = safeSessions.filter(s => schoolTeacherEmails.includes(s?.teacherEmail)).sort((a,b) => (b?.timestamp || 0) - (a?.timestamp || 0));

  const handleAddClass = (e) => { e.preventDefault(); if(!classForm) return; push(ref(db, 'master_classes'), { name: classForm, schoolId: schoolId.toLowerCase() }).then(() => setClassForm('')); };
  const handleDeleteClass = (id) => { if(window.confirm("Hapus kelas ini?")) remove(ref(db, `master_classes/${id}`)); };
  const handleAddSubject = (e) => { e.preventDefault(); if(!subjectForm) return; push(ref(db, 'master_subjects'), { name: subjectForm, schoolId: schoolId.toLowerCase() }).then(() => setSubjectForm('')); };
  const handleDeleteSubject = (id) => { if(window.confirm("Hapus Mapel ini?")) remove(ref(db, `master_subjects/${id}`)); };

  const handleAddStudent = (e) => {
    e.preventDefault();
    push(ref(db, 'students'), { ...studentForm, schoolId: schoolId.toLowerCase(), createdAt: Date.now() }).then(() => { alert("Siswa ditambahkan!"); setShowAddStudentModal(false); setStudentForm({ name: '', nisn: '', kelas: '', subKelas: '' }); });
  };
  const handleDeleteStudent = (id) => { if(window.confirm("Hapus siswa ini?")) remove(ref(db, `students/${id}`)); };
  const handleImportStudents = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]);
        let count = 0;
        d.forEach(row => { if (row.Nama && row.Kelas) { push(ref(db, 'students'), { name: String(row.Nama), nisn: String(row.NISN || ''), kelas: String(row.Kelas), subKelas: String(row.SubKelas || ''), schoolId: schoolId.toLowerCase(), createdAt: Date.now() }); count++; } });
        alert(`${count} Siswa berhasil di-import!`); if(fileInputRef.current) fileInputRef.current.value = '';
      } catch(err) { alert("Gagal Import: Format Excel salah."); }
    }; reader.readAsBinaryString(file);
  };
  const downloadStudentTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([ { Nama: "Budi Santoso", NISN: "0012345678", Kelas: "10", SubKelas: "A" } ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Format_Siswa"); XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
  };

  const handleAddGuru = async (e) => {
    e.preventDefault(); if (schoolId === 'UNREGISTERED') return alert("Akses dibatasi.");
    try { const newAuth = getAuth(); const userCred = await createUserWithEmailAndPassword(newAuth, guruForm.email, guruForm.password); await set(ref(db, `users/${userCred.user.uid}`), { name: guruForm.name, email: guruForm.email, role: 'teacher', schoolId: schoolId.toLowerCase(), status: 'active', createdAt: Date.now() }); alert("Guru dibuat!"); setShowAddGuruModal(false); setGuruForm({ name: '', email: '', password: '' }); } catch (err) { alert("Gagal: " + err.message); }
  };
  const handleUpdateGuru = (e) => { e.preventDefault(); update(ref(db, `users/${editGuruId}`), { name: guruForm.name }); alert("Diperbarui!"); setShowEditGuruModal(false); };
  
  // FUNGSI APPROVE & REJECT GURU PENDING
  const approveTeacher = (id) => update(ref(db, `users/${id}`), { status: 'active' });
  const rejectTeacher = (id) => { if(window.confirm("Tolak dan hapus data guru ini?")) remove(ref(db, `users/${id}`)); };
  const deleteTeacher = (id) => { if(window.confirm("Hapus akun guru ini dari instansi Anda?")) remove(ref(db, `users/${id}`)); };
  const handleResetPassword = (email) => { if (window.confirm(`Kirim instruksi reset ke ${email}?`)) sendPasswordResetEmail(auth, email).then(() => alert("Terkirim!")).catch(err => alert("Gagal: " + err.message)); };

  const availableGurus = [...new Set(schoolLeaderboard.map(s => s?.teacherEmail).filter(Boolean))];
  const availableMapels = [...new Set(schoolLeaderboard.filter(s => recapGuru === '' || s?.teacherEmail === recapGuru).map(s => s?.mapel).filter(Boolean))];
  const availableKelasRekap = [...new Set(schoolLeaderboard.filter(s => (recapGuru === '' || s?.teacherEmail === recapGuru) && (recapMapel === '' || s?.mapel === recapMapel)).map(s => s?.class).filter(Boolean))];
  
  const filteredLeaderboard = schoolLeaderboard.filter(s => 
    (recapGuru === '' || s?.teacherEmail === recapGuru) && 
    (recapMapel === '' || s?.mapel === recapMapel) && 
    (recapKelas === '' || s?.class === recapKelas)
  ).sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0)); 

  const downloadRecap = () => {
    if (!filteredLeaderboard || filteredLeaderboard.length === 0) return alert("Belum ada data nilai.");
    try {
       const ws = XLSX.utils.json_to_sheet(filteredLeaderboard); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Rekap Sekolah"); XLSX.writeFile(wb, `REKAP_${schoolId.toUpperCase()}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch(err) { alert("Gagal mengunduh: " + err.message); }
  };

  const NavItem = ({ tab, icon: Icon, label, badge }) => (
    <button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex justify-between items-center py-3 px-4 rounded-xl transition-all ${activeTab === tab ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600 font-medium'}`}>
      <div className="flex items-center gap-3"><Icon size={18}/> <span className="text-sm">{label}</span></div>
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

  const OfficialHeader = () => (
    <div className="hidden print:flex flex-col items-center justify-center mb-8 border-b-4 border-double border-black pb-4 text-center">
      {schoolInfo?.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="h-20 mb-2 object-contain" />}
      <h1 className="text-2xl font-black uppercase tracking-widest text-black">{schoolInfo?.name || 'ADMINISTRASI SEKOLAH'}</h1>
      <h2 className="text-sm font-bold text-gray-800 mt-1">{schoolInfo?.alamat || 'Alamat Sekolah Belum Diatur'}</h2>
      <p className="mt-1 text-xs font-bold text-gray-800">Telepon: {schoolInfo?.telepon || '-'} | ID: {schoolId.toUpperCase()}</p>
    </div>
  );

  // --- LAYAR PERLINDUNGAN AKSES ---
  if (isLoadingProfile) return (<div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4"><Loader2 size={40} className="text-blue-500 animate-spin" /><p className="text-sm font-bold text-slate-500 tracking-widest uppercase animate-pulse">Memverifikasi Akses...</p></div>);
  if (!adminProfile) return (<div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center"><AlertTriangle size={60} className="text-red-500 mb-4" /><p className="text-xl font-black text-slate-700 mb-2">Sesi Terputus</p><p className="text-sm font-bold text-slate-500 max-w-md mb-6">Autentikasi gagal. Silakan login kembali.</p><button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm">Kembali ke Login</button></div>);

  // PENANGKAL 1: CEK STATUS SUSPEND DARI MASTER
  if (schoolInfo && schoolInfo.status === 'suspended') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center animate-in fade-in duration-500">
         <div className="bg-red-50 p-8 rounded-[32px] border-2 border-red-200 shadow-xl max-w-lg w-full flex flex-col items-center">
            <ShieldAlert size={80} className="text-red-600 mb-6 animate-pulse" />
            <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Akses Ditangguhkan</h2>
            <p className="text-sm font-bold text-slate-600 mb-8 leading-relaxed">
              Layanan CBT untuk instansi <b>{schoolInfo?.name || schoolId}</b> saat ini sedang ditangguhkan oleh Master Administrator.
              Silakan hubungi Admin Pusat untuk informasi lebih lanjut mengenai administrasi atau perpanjangan paket layanan.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all">
                 <MessageCircle size={18} /> Hubungi via WhatsApp
              </a>
              <button onClick={handleLogout} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all">
                 <LogOut size={18} /> Keluar Akun
              </button>
            </div>
         </div>
      </div>
    );
  }

  // --- TAMPILAN DASHBOARD NORMAL ---
  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800 animate-in fade-in duration-500">
      <style>{`
        @media print { 
          @page { margin: 1.5cm; size: portrait; } html, body, #root { height: auto !important; overflow: visible !important; background: white !important; margin: 0; }
          .h-screen, .min-h-screen, .overflow-hidden, .overflow-y-auto, main, .flex-1 { height: auto !important; overflow: visible !important; position: static !important; } 
          aside, header, button, select, input, .print\\:hidden { display: none !important; } .print\\:flex { display: flex !important; } .print\\:block { display: block !important; } 
          table { width: 100% !important; border-collapse: collapse; margin-top: 10px; border: 1.5px solid black !important; } th, td { border: 1px solid #000 !important; padding: 8px !important; font-size: 11px !important; } th { background-color: #f0f0f0 !important; font-weight: bold; text-transform: uppercase; } 
        }
      `}</style>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 flex items-center gap-3">
           <ShieldCheck size={28} className="text-blue-600"/>
           <h1 className="text-lg font-black text-blue-700 tracking-wide uppercase">TATA USAHA</h1>
           <button className="md:hidden ml-auto text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
        </div>
        
        <div className="px-4 mb-6">
           <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-black text-lg flex items-center justify-center shrink-0 uppercase">{adminName.charAt(0)}</div>
             <div className="min-w-0">
               <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">ID: {schoolId}</p>
               <p className="text-xs font-bold truncate text-slate-700">{adminName}</p>
             </div>
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <NavItem tab="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem tab="sekolah" icon={Building2} label="Profil Instansi" />
          <div className="my-4 border-t border-slate-100"></div>
          <NavItem tab="master-data" icon={Database} label="Master Kelas & Mapel" />
          <NavItem tab="siswa" icon={GraduationCap} label="Database Siswa" />
          <NavItem tab="guru" icon={Users} label="Manajemen Guru" badge={pendingTeachers.length} />
          <div className="my-4 border-t border-slate-100"></div>
          <NavItem tab="monitor" icon={Radio} label="Monitor Ujian Global" />
          <NavItem tab="recap" icon={ClipboardList} label="Rekapitulasi Nilai" />
        </nav>
        
        <div className="p-4">
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl font-bold text-sm transition-colors">
               <LogOut size={16}/> Logout
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER UTAMA */}
        <header className="bg-white border-b border-slate-200 p-4 md:px-8 flex justify-between items-center z-10 print:hidden">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 bg-slate-100 rounded-lg text-blue-600" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">PUSAT KOMANDO ADMINISTRASI</h2>
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
             <span className="text-[10px] font-black uppercase tracking-widest">{schoolInfo?.plan || 'PREMIUM'}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          {schoolId === 'UNREGISTERED' && (
            <div className="mb-6 bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
               <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={20} />
               <div><h4 className="font-bold text-orange-800">Akun Belum Terverifikasi</h4><p className="text-sm text-orange-700 mt-1">Akun Anda belum dikaitkan dengan ID Sekolah. Hubungi Master Admin.</p></div>
            </div>
          )}

          {/* TAB DASHBOARD UTAMA */}
          {activeTab === 'dashboard' && (
             <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-[#2563EB] rounded-[24px] p-8 md:p-10 text-white shadow-lg relative overflow-hidden mb-6">
                   <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-5">
                      <Building2 size={300} />
                   </div>
                   <div className="relative z-10">
                       <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tight">Selamat Datang, {adminName}!</h2>
                       <p className="text-blue-100 font-medium text-base md:text-lg max-w-2xl leading-relaxed">Anda berada di pusat kendali administrasi CBT untuk instansi <br/><strong className="text-white uppercase tracking-wide">{schoolInfo?.name || schoolId}</strong>.</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                   <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Users size={16}/></div></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Guru Aktif</p><p className="text-3xl font-black text-slate-800">{activeTeachers.length}</p></div>
                   </div>
                   <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><GraduationCap size={16}/></div></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Siswa</p><p className="text-3xl font-black text-slate-800">{schoolStudents.length}</p></div>
                   </div>
                   <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Database size={16}/></div></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Data Kelas</p><p className="text-3xl font-black text-slate-800">{schoolClasses.length}</p></div>
                   </div>
                   <div className="bg-white p-6 rounded-[20px] border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><ClipboardList size={16}/></div></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Nilai</p><p className="text-3xl font-black text-slate-800">{schoolLeaderboard.length}</p></div>
                   </div>
                </div>
             </div>
          )}

          {/* TAB PROFIL SEKOLAH */}
          {activeTab === 'sekolah' && (
             <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-[24px] shadow-sm border border-slate-200">
                   <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0"><Building2 size={28}/></div>
                      <div><h3 className="text-2xl font-black text-slate-800 tracking-tight">Profil Instansi</h3><p className="text-sm font-medium text-slate-500 mt-1">Data ini akan digunakan sebagai Kop Surat Resmi di laporan.</p></div>
                   </div>
                   <form onSubmit={handleUpdateSchool} className="space-y-6">
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Sistem (Read Only)</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">ID Tenant</label><input disabled value={schoolId} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed uppercase" /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nama Instansi</label><input disabled value={schoolInfo?.name || ''} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-slate-700 cursor-not-allowed" /></div></div></div>
                      <div className="space-y-4"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">Data Operasional</h4><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Alamat Lengkap</label><textarea required value={schoolForm.alamat} onChange={e => setSchoolForm({...schoolForm, alamat: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm min-h-[80px]" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Nama Kepala Sekolah</label><input required value={schoolForm.kepalaSekolah} onChange={e => setSchoolForm({...schoolForm, kepalaSekolah: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm" /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">NIP Kepala Sekolah</label><input value={schoolForm.nipKepalaSekolah} onChange={e => setSchoolForm({...schoolForm, nipKepalaSekolah: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm" /></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Kontak / Telepon</label><input value={schoolForm.telepon} onChange={e => setSchoolForm({...schoolForm, telepon: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm" /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">URL Logo Sekolah</label><input value={schoolForm.logoUrl} onChange={e => setSchoolForm({...schoolForm, logoUrl: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm" /></div></div></div>
                      <button type="submit" disabled={schoolId === 'UNREGISTERED'} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl text-sm font-black transition-all">SIMPAN PROFIL INSTANSI</button>
                   </form>
                </div>
             </div>
          )}

          {/* TAB MASTER DATA */}
          {activeTab === 'master-data' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
               <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 mb-6">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1"><Database className="text-blue-600"/> Master Data Sekolah</h3>
                  <p className="text-sm text-slate-500">Daftarkan Kelas dan Mata Pelajaran resmi.</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col"><div className="p-5 border-b border-slate-100 bg-slate-50"><h4 className="font-black text-slate-800 text-base">Daftar Kelas</h4></div><div className="p-5 flex-1 overflow-y-auto max-h-[400px]"><ul className="space-y-2">{schoolClasses.map(c => (<li key={c.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200"><span className="font-bold text-sm text-slate-700">Tingkat {c?.name}</span><button onClick={() => handleDeleteClass(c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></li>))}{schoolClasses.length === 0 && <li className="text-center p-4 text-slate-400 text-sm">Kosong.</li>}</ul></div><div className="p-4 border-t border-slate-100 bg-white"><form onSubmit={handleAddClass} className="flex gap-2"><input value={classForm} onChange={e=>setClassForm(e.target.value)} required placeholder="Cth: 10" className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700" /><button disabled={schoolId === 'UNREGISTERED'} type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-black transition-colors"><Plus size={18}/></button></form></div></div>
                  <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col"><div className="p-5 border-b border-slate-100 bg-slate-50"><h4 className="font-black text-slate-800 text-base">Daftar Mapel</h4></div><div className="p-5 flex-1 overflow-y-auto max-h-[400px]"><ul className="space-y-2">{schoolSubjects.map(s => (<li key={s.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200"><span className="font-bold text-sm text-slate-700">{s?.name}</span><button onClick={() => handleDeleteSubject(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></li>))}{schoolSubjects.length === 0 && <li className="text-center p-4 text-slate-400 text-sm">Kosong.</li>}</ul></div><div className="p-4 border-t border-slate-100 bg-white"><form onSubmit={handleAddSubject} className="flex gap-2"><input value={subjectForm} onChange={e=>setSubjectForm(e.target.value)} required placeholder="Cth: Matematika" className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700" /><button disabled={schoolId === 'UNREGISTERED'} type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-black transition-colors"><Plus size={18}/></button></form></div></div>
               </div>
            </div>
          )}

          {/* TAB MANAJEMEN SISWA */}
          {activeTab === 'siswa' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleImportStudents} className="hidden" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 mb-6">
                 <div><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><GraduationCap className="text-blue-600"/> Database Siswa</h3><p className="text-sm text-slate-500 mt-1">Total Siswa: <span className="font-black text-slate-700">{schoolStudents.length}</span></p></div>
                 <div className="flex flex-wrap gap-2 w-full md:w-auto"><button onClick={downloadStudentTemplate} className="flex-1 md:flex-none bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Download size={16}/> Template</button><button onClick={() => {if(fileInputRef.current) fileInputRef.current.click()}} disabled={schoolId === 'UNREGISTERED'} className="flex-1 md:flex-none bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Upload size={16}/> Import Excel</button><button onClick={() => setShowAddStudentModal(true)} disabled={schoolId === 'UNREGISTERED'} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2"><Plus size={16}/> Input Manual</button></div>
              </div>
              <div className="bg-white rounded-[20px] border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="py-4 px-6 w-16 text-center">No</th><th className="py-4 px-6 font-bold uppercase text-xs">Nama Lengkap</th><th className="py-4 px-6 font-bold uppercase text-xs">NISN</th><th className="py-4 px-6 text-center font-bold uppercase text-xs">Kelas / Ruang</th><th className="py-4 px-6 text-center font-bold uppercase text-xs w-24">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{schoolStudents.map((s, i) => (<tr key={s?.id || i} className="hover:bg-slate-50"><td className="py-3 px-6 text-center font-bold text-slate-500">{i + 1}</td><td className="py-3 px-6 font-black text-slate-800">{s?.name || 'Anonim'}</td><td className="py-3 px-6 text-slate-500 font-medium">{s?.nisn || '-'}</td><td className="py-3 px-6 text-center font-bold text-slate-600">{s?.kelas}-{s?.subKelas}</td><td className="py-3 px-6 text-center"><button onClick={() => handleDeleteStudent(s.id)} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button></td></tr>))}{schoolStudents.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-medium">Belum ada data siswa.</td></tr>}</tbody></table>
              </div>
            </div>
          )}
          
          {/* TAB MANAJEMEN GURU */}
          {activeTab === 'guru' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 mb-6">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Manajemen Guru</h3>
                    <p className="text-sm text-slate-500 mt-1">Kelola staf pengajar instansi Anda.</p>
                 </div>
                 <button onClick={() => { setGuruForm({name:'', email:'', password:''}); setShowAddGuruModal(true); }} disabled={schoolId === 'UNREGISTERED'} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2"><Plus size={18}/> Tambah Guru Baru</button>
              </div>

              {/* RESTORASI: KOTAK GURU PENDING YANG HILANG KARENA MINIFY */}
              {pendingTeachers.length > 0 && (
                <div className="bg-orange-50 rounded-2xl border border-orange-200 overflow-hidden shadow-sm p-5 space-y-4 mb-6">
                  <div className="font-black text-orange-700 flex items-center gap-2"><Users size={20}/> Menunggu Persetujuan ({pendingTeachers.length})</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {pendingTeachers.map(t => (
                      <div key={t.id} className="bg-white p-4 rounded-xl border border-orange-200 flex flex-col justify-between gap-3 shadow-sm">
                        <div>
                          <p className="font-black text-slate-800 text-sm">{t?.name || 'Tanpa Nama'}</p>
                          <p className="font-medium text-slate-500 text-xs mt-0.5">{t?.email || '-'}</p>
                        </div>
                        <div className="flex gap-2 w-full border-t border-slate-100 pt-3">
                          <button onClick={() => approveTeacher(t.id)} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1"><CheckCircle size={16}/> Terima</button>
                          <button onClick={() => rejectTeacher(t.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-xs font-bold transition-all flex justify-center items-center gap-1"><XCircle size={16}/> Tolak</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TABEL GURU AKTIF (Dimekarkan agar aman dari Error) */}
              <div className="bg-white rounded-[20px] border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-4 px-6 w-16 text-center">No</th>
                      <th className="py-4 px-6 font-bold uppercase text-xs">Nama Guru</th>
                      <th className="py-4 px-6 font-bold uppercase text-xs">Email Login</th>
                      <th className="py-4 px-6 text-center font-bold uppercase text-xs w-48">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTeachers.map((t, i) => (
                      <tr key={t?.id || i} className="hover:bg-slate-50">
                        <td className="py-4 px-6 text-center font-bold text-slate-500">{i + 1}</td>
                        <td className="py-4 px-6 font-black text-slate-800">{t?.name || 'Guru'}</td>
                        <td className="py-4 px-6 text-slate-500 font-medium">{t?.email || '-'}</td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => { setEditGuruId(t.id); setGuruForm({name: t?.name, email: t?.email}); setShowEditGuruModal(true); }} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 p-2 rounded-lg" title="Edit Nama">
                              <UserCog size={16}/>
                            </button>
                            <button onClick={() => handleResetPassword(t?.email)} className="text-slate-400 hover:text-amber-500 bg-slate-50 hover:bg-amber-50 border border-slate-200 p-2 rounded-lg" title="Reset Password">
                              <KeyRound size={16}/>
                            </button>
                            <button onClick={() => deleteTeacher(t.id)} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 p-2 rounded-lg" title="Hapus Guru">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeTeachers.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Belum ada guru yang aktif.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB MONITOR UJIAN GLOBAL */}
          {activeTab === 'monitor' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
               <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 mb-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1"><Radio className="text-blue-600"/> Monitor Ujian Global</h3><p className="text-sm text-slate-500">Pantau semua jadwal dan sesi ujian.</p></div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schoolSessions.map(session => (
                     <div key={session?.id} className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-sm flex flex-col justify-between">
                        <div>
                           <div className="flex justify-between items-start mb-3"><h4 className="text-xl font-black font-mono tracking-widest text-slate-800">{session?.token}</h4><span className={`text-[9px] font-black px-2 py-1 rounded border uppercase ${session?.status === 'open' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{session?.status}</span></div>
                           <p className="font-bold text-blue-600 text-sm">{session?.mapel} <span className="text-slate-400 text-xs font-medium ml-1">(Kls: {session?.kelas}-{session?.subKelas})</span></p><p className="text-xs text-slate-500 mt-1">Guru: {session?.teacherEmail}</p>
                           <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-400 flex justify-between"><span>Waktu: {session?.jamMulai || '--'} - {session?.jamSelesai || '--'}</span></div>
                        </div>
                     </div>
                  ))}
                  {schoolSessions.length === 0 && <div className="col-span-full p-10 text-center bg-white border border-dashed border-slate-300 rounded-[20px] text-slate-400 font-bold">Belum ada sesi ujian yang dibuat oleh guru.</div>}
               </div>
            </div>
          )}

          {/* TAB REKAP NILAI SEKOLAH (LAYOUT HORIZONTAL KOMPAK) */}
          {activeTab === 'recap' && (
            <div className="max-w-7xl mx-auto print:max-w-full animate-in fade-in duration-300">
              
              {/* TOOLBAR HORIZONTAL BARU */}
              <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 print:hidden mb-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                   <div>
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600"/> Laporan Nilai Sekolah</h3>
                      <p className="text-xs font-bold text-slate-500 mt-1">Filter dan cetak dokumen administrasi ujian.</p>
                   </div>
                   <button onClick={downloadRecap} disabled={schoolId === 'UNREGISTERED'} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200 transition-colors disabled:opacity-50"><Download size={14}/> Export Excel</button>
                </div>
                
                <div className="flex flex-col xl:flex-row justify-between gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                   <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                      <select value={recapGuru} onChange={e => {setRecapGuru(e.target.value); setRecapMapel(''); setRecapKelas('');}} className="w-full sm:w-48 p-2.5 border border-slate-200 rounded-xl bg-white outline-none text-xs font-bold text-slate-700"><option value="">Semua Guru</option>{availableGurus.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <select value={recapMapel} onChange={e => {setRecapMapel(e.target.value); setRecapKelas('');}} className="w-full sm:w-48 p-2.5 border border-slate-200 rounded-xl bg-white outline-none text-xs font-bold text-slate-700"><option value="">Semua Mapel</option>{availableMapels.map(m => <option key={m} value={m}>{m}</option>)}</select>
                      <select value={recapKelas} onChange={e => setRecapKelas(e.target.value)} className="w-full sm:w-40 p-2.5 border border-slate-200 rounded-xl bg-white outline-none text-xs font-bold text-slate-700"><option value="">Semua Kelas</option>{availableKelasRekap.map(k => <option key={k} value={k}>{k}</option>)}</select>
                   </div>
                   
                   <div className="flex gap-2 w-full xl:w-auto">
                      <button onClick={() => { setPrintMode('rekap'); setTimeout(() => window.print(), 300); }} disabled={schoolId === 'UNREGISTERED'} className="flex-1 xl:flex-none bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"><BarChart size={14}/> Cetak Nilai</button>
                      <button onClick={() => { setPrintMode('berita_acara'); setTimeout(() => window.print(), 300); }} disabled={schoolId === 'UNREGISTERED'} className="flex-1 xl:flex-none bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"><FileText size={14}/> Berita Acara</button>
                      <button onClick={() => { setPrintMode('daftar_hadir'); setTimeout(() => window.print(), 300); }} disabled={schoolId === 'UNREGISTERED'} className="flex-1 xl:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"><Users size={14}/> Daftar Hadir</button>
                   </div>
                </div>
              </div>

              {/* TAMPILAN PRINT BERDASARKAN MODE */}
              <div className={`${printMode === 'rekap' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR NILAI UJIAN</h3>
                <p className="mb-4 text-sm font-bold">Instansi: {schoolId.toUpperCase()} <br/> Guru Mapel: {recapGuru || 'Semua'} | Mapel: {recapMapel || 'Semua'} | Kelas: {recapKelas || 'Semua'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-2 px-3 text-center">No</th><th className="py-2 px-3">Nama Siswa</th><th className="py-2 px-3 text-center">Kelas</th><th className="py-2 px-3">Mapel</th><th className="py-2 px-3 text-center">Nilai Akhir</th></tr></thead>
                  <tbody>{filteredLeaderboard.map((s, i) => (<tr key={s?.id || i}><td className="py-2 px-3 text-center">{i+1}</td><td className="py-2 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-2 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-2 px-3">{s?.mapel}</td><td className="py-2 px-3 text-center font-black">{s?.score || 0}</td></tr>))}</tbody>
                </table>
                <div className="flex justify-end mt-12 text-center"><div className="w-64"><p>Kepala Sekolah,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">{schoolInfo?.kepalaSekolah || '_________________________'}</p><p className="text-xs">NIP. {schoolInfo?.nipKepalaSekolah || '_________________'}</p></div></div>
              </div>

              <div className={`${printMode === 'berita_acara' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-8 underline tracking-wide">BERITA ACARA UJIAN (CBT)</h3>
                <div className="text-justify leading-loose font-medium text-sm"><table className="w-full my-4 border-none !border-0"><tbody className="border-none"><tr className="border-none"><td className="w-48 py-1 border-none !p-0">Guru Mapel</td><td className="border-none !p-0">: {recapGuru || '_________________________'}</td></tr><tr className="border-none"><td className="w-48 py-1 border-none !p-0">Mata Pelajaran</td><td className="border-none !p-0">: {recapMapel || '_________________________'}</td></tr><tr className="border-none"><td className="w-48 py-1 border-none !p-0">Kelas Terjadwal</td><td className="border-none !p-0">: {recapKelas || '____'}</td></tr><tr className="border-none"><td className="w-48 py-1 border-none !p-0">Siswa Ujian / Hadir</td><td className="border-none !p-0">: {filteredLeaderboard.length} Orang / ______ Orang</td></tr></tbody></table><div className="w-full h-24 border border-black mt-6 mb-8"></div></div>
                <div className="flex justify-between mt-12 text-center"><div className="w-64"><p>Guru Mata Pelajaran,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">{recapGuru || '_________________________'}</p></div><div className="w-64"><p>Kepala Sekolah,</p><br/><br/><br/><p className="font-bold uppercase border-b border-black pb-1">{schoolInfo?.kepalaSekolah || '_________________________'}</p><p className="text-xs">NIP. {schoolInfo?.nipKepalaSekolah || '_________________'}</p></div></div>
              </div>

              <div className={`${printMode === 'daftar_hadir' ? 'hidden print:block' : 'hidden'}`}>
                <OfficialHeader />
                <h3 className="text-center font-black text-lg mb-6 underline">DAFTAR HADIR UJIAN</h3>
                <p className="mb-4 text-sm font-bold">Mapel: {recapMapel || '___________'} | Kelas: {recapKelas || '____'}</p>
                <table className="w-full text-left text-sm">
                  <thead><tr><th className="py-3 px-3 text-center w-12">No</th><th className="py-3 px-3">Nama Lengkap</th><th className="py-3 px-3 text-center w-24">Kelas</th><th className="py-3 px-3 w-48 text-center">TTD</th></tr></thead>
                  <tbody>{filteredLeaderboard.map((s, i) => (<tr key={s?.id || i}><td className="py-3 px-3 text-center">{i+1}</td><td className="py-3 px-3 font-bold uppercase">{s?.name || 'Anonim'}</td><td className="py-3 px-3 text-center">{s?.class}-{s?.subKelas}</td><td className="py-3 px-3 text-slate-400 text-xs">{i+1}.</td></tr>))}{[...Array(Math.max(0, 15 - filteredLeaderboard.length))].map((_, i) => (<tr key={`e-${i}`}><td className="py-4"></td><td></td><td></td><td></td></tr>))}</tbody>
                </table>
              </div>

              {/* UI TABEL REKAP BROWSER (DILEBARKAN AGAR AMAN DARI ERROR) */}
              <div className="bg-white rounded-[20px] border border-slate-200 overflow-x-auto shadow-sm print:hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-4 px-4 text-center">No</th>
                      <th className="py-4 px-4 font-bold uppercase tracking-wider text-xs">Siswa</th>
                      <th className="py-4 px-4 text-center font-bold uppercase tracking-wider text-xs">Kelas</th>
                      <th className="py-4 px-4 font-bold uppercase tracking-wider text-xs">Mapel & Guru</th>
                      <th className="py-4 px-4 text-center font-bold uppercase tracking-wider text-xs">Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeaderboard.map((s, i) => (
                      <tr key={s?.id || i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{i+1}</td>
                        <td className="py-3 px-4"><p className="font-black text-slate-800">{s?.name || 'Tanpa Nama'}</p></td>
                        <td className="py-3 px-4 text-center font-bold text-slate-600">{s?.class || '-'}-{s?.subKelas || ''}</td>
                        <td className="py-3 px-4"><p className="font-bold text-blue-600">{s?.mapel || '-'}</p><p className="text-[10px] text-slate-500">{s?.teacherEmail || '-'}</p></td>
                        <td className="py-3 px-4 text-center"><span className="text-base font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{s?.score || 0}</span></td>
                      </tr>
                    ))}
                    {filteredLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-10 text-center text-slate-400 font-medium">Belum ada rekap nilai untuk filter ini.<br/><span className="text-xs text-slate-400">Pastikan Guru sudah menyelesaikan sesi ujiannya.</span></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODALS HIDDEN FROM PRINT */}
      {showAddGuruModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2"><Plus className="text-blue-600"/> Daftarkan Guru Baru</h2>
            <form onSubmit={handleAddGuru} className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Lengkap & Gelar</label><input required value={guruForm.name} onChange={e => setGuruForm({...guruForm, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="Bpk. Budi S.Pd" /></div>
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">Email Akun (Login)</label><input type="email" required value={guruForm.email} onChange={e => setGuruForm({...guruForm, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="budi@guru.com" /></div>
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">Password Sementara</label><input type="password" required value={guruForm.password} onChange={e => setGuruForm({...guruForm, password: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="Minimal 6 Karakter" /></div>
               <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowAddGuruModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Batal</button><button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors">Buat Akun Guru</button></div>
            </form>
          </div>
        </div>
      )}
      {showEditGuruModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2"><UserCog className="text-blue-600"/> Edit Nama Guru</h2>
            <form onSubmit={handleUpdateGuru} className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Lengkap & Gelar</label><input required value={guruForm.name} onChange={e => setGuruForm({...guruForm, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" /></div>
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">Email Akun (Info Saja)</label><input disabled value={guruForm.email} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500" /></div>
               <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowEditGuruModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Batal</button><button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors">Simpan Revisi</button></div>
            </form>
          </div>
        </div>
      )}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-4 text-slate-800 flex items-center gap-2"><GraduationCap className="text-blue-600"/> Input Data Siswa</h2>
            <form onSubmit={handleAddStudent} className="space-y-4">
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Lengkap</label><input required value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 uppercase" placeholder="Budi Santoso" /></div>
               <div><label className="text-xs font-bold text-slate-500 mb-1 block">NISN (Opsional)</label><input value={studentForm.nisn} onChange={e => setStudentForm({...studentForm, nisn: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500" placeholder="0012345678" /></div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                     <label className="text-xs font-bold text-slate-500 mb-1 block">Kelas</label>
                     <select required value={studentForm.kelas} onChange={e => setStudentForm({...studentForm, kelas: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500">
                        <option value="">Pilih</option>
                        {schoolClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">Sub/Ruang</label><input required value={studentForm.subKelas} onChange={e => setStudentForm({...studentForm, subKelas: e.target.value.toUpperCase()})} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 uppercase" placeholder="A" /></div>
               </div>
               <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowAddStudentModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Batal</button><button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors">Simpan Data</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}