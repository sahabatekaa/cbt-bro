import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, update, remove, get } from 'firebase/database';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { Users, BookOpen, Award, Settings, LogOut, Plus, Trash2, Printer, CheckCircle, Download, Upload, Menu, X, User, Filter, Eye, Camera, Send, ImagePlus } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import * as XLSX from 'xlsx';

export default function TeacherDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('proctor');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveStudents, setLiveStudents] = useState([]);
  const [bankSoal, setBankSoal] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  // FITUR: Form Soal dengan Tipe (Ganda / Essay) & URL Gambar
  const [formData, setFormData] = useState({ mapel: '', tingkat: '', tipe: 'ganda', pertanyaan: '', gambarUrl: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });
  const [editId, setEditId] = useState(null);
  const [sessionForm, setSessionForm] = useState({ mapel: '', tingkat: '', kelas: '' });
  
  // FITUR: Filter & Pantauan Sesi
  const [filterBankMapel, setFilterBankMapel] = useState('');
  const [filterRekapMapel, setFilterRekapMapel] = useState('');
  const [filterRekapKelas, setFilterRekapKelas] = useState('');
  const [selectedMonitorToken, setSelectedMonitorToken] = useState('');

  // FITUR: State Upload Gambar, Broadcast, & Snapshot Kamera
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState(null); // Untuk melihat foto siswa

  const fileInputRef = useRef(null);
  const [teacherProfile, setTeacherProfile] = useState({ nama: 'Memuat...', email: '' });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) setTeacherProfile({ nama: snapshot.val().nama || 'Pengawas', email: user.email });
        else setTeacherProfile({ nama: 'Pengawas', email: user.email });
      }
    });

    onValue(ref(db, 'live_students'), (snap) => setLiveStudents(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })) : []));
    onValue(ref(db, 'bank_soal'), (snap) => setBankSoal(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })) : []));
    onValue(ref(db, 'leaderboard'), (snap) => setLeaderboard(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).sort((a, b) => b.score - a.score) : []));
    onValue(ref(db, 'active_sessions'), (snap) => setSessions(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).reverse() : []));

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => { await signOut(auth); onLogout(); };
  const forceFinish = (studentId) => update(ref(db, `live_students/${studentId}`), { status: 'force_finish' });
  
  // Upload Gambar Drag & Drop
  const handleImageUpload = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Tolong masukkan file gambar (JPG/PNG)!');
    setIsUploading(true);
    const fileName = `soal_images/${Date.now()}_${file.name}`;
    const uploadTask = uploadBytesResumable(storageRef(storage, fileName), file);
    uploadTask.on('state_changed', 
      (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100), 
      (err) => { alert("Gagal upload: " + err.message); setIsUploading(false); }, 
      () => { getDownloadURL(uploadTask.snapshot.ref).then((url) => { setFormData(prev => ({...prev, gambarUrl: url})); setIsUploading(false); setUploadProgress(0); }); }
    );
  };

  const handleSaveSoal = (e) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (dataToSave.tipe === 'essay') {
        // Hapus kunci dan opsi jika essay
        dataToSave.opsiA = ''; dataToSave.opsiB = ''; dataToSave.opsiC = ''; dataToSave.opsiD = ''; dataToSave.kunci = '';
    }
    if (editId) update(ref(db, `bank_soal/${editId}`), dataToSave);
    else push(ref(db, 'bank_soal'), dataToSave);
    setShowModal(false); setFormData({ mapel: '', tingkat: '', tipe: 'ganda', pertanyaan: '', gambarUrl: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' }); setEditId(null);
  };

  const handleDeleteSoal = (id) => { if(window.confirm('Hapus soal ini?')) remove(ref(db, `bank_soal/${id}`)); };

  // Kirim Broadcast Realtime
  const handleSendBroadcast = () => {
    if (!broadcastMsg) return alert("Ketik pesannya dulu!");
    if (window.confirm(`Kirim pengumuman ini ke seluruh layar siswa sekarang?\n\n"${broadcastMsg}"`)) {
      update(ref(db, 'system_controls/broadcast'), { message: broadcastMsg, timestamp: Date.now() });
      setBroadcastMsg('');
    }
  };

  const handleDownloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet([{ Mapel: "Matematika", Tingkat: "7", Tipe: "ganda", Pertanyaan: "Contoh Soal", OpsiA: "A", OpsiB: "B", OpsiC: "C", OpsiD: "D", Kunci: "A" }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Soal"); XLSX.writeFile(wb, "Template_Pilihan_Ganda.xlsx");
  };

  const handleUploadExcel = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]);
        let count = 0;
        data.forEach(row => { 
            if (row.Mapel && row.Tingkat && row.Pertanyaan) { 
                push(ref(db, 'bank_soal'), { mapel: row.Mapel, tingkat: String(row.Tingkat), tipe: row.Tipe?.toLowerCase() === 'essay' ? 'essay' : 'ganda', pertanyaan: row.Pertanyaan, opsiA: row.OpsiA || '', opsiB: row.OpsiB || '', opsiC: row.OpsiC || '', opsiD: row.OpsiD || '', kunci: row.Kunci || '' }); 
                count++; 
            } 
        });
        alert(`Berhasil unggah ${count} soal.`);
      } catch (error) { alert("Format Error."); }
    };
    reader.readAsBinaryString(file); e.target.value = null; 
  };

  const handleCreateSession = (e) => {
    e.preventDefault();
    const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    push(ref(db, 'active_sessions'), { mapel: sessionForm.mapel, tingkat: sessionForm.tingkat, kelas: sessionForm.kelas.toUpperCase(), token: newToken, status: 'active', timestamp: Date.now() });
    setSelectedMonitorToken(newToken); setSessionForm({ mapel: '', tingkat: '', kelas: '' });
  };
  
  const toggleSessionStatus = (id, currentStatus) => update(ref(db, `active_sessions/${id}`), { status: currentStatus === 'active' ? 'expired' : 'active' });
  const deleteSession = (id) => { if(window.confirm('Hapus sesi?')) remove(ref(db, `active_sessions/${id}`)); };

  const handleExportRekapExcel = () => {
    const dataToExport = leaderboard.filter(lb => filterRekapMapel ? lb.mapel === filterRekapMapel : true).filter(lb => filterRekapKelas ? lb.class === filterRekapKelas : true).map((lb, idx) => ({ "Peringkat": idx + 1, "Nama Siswa": lb.name, "Kelas": lb.class, "Mata Pelajaran": lb.mapel, "Nilai Pilihan Ganda": lb.score }));
    if (dataToExport.length === 0) return alert("Tidak ada data untuk diekspor!");
    const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Rekap_Nilai"); XLSX.writeFile(wb, `Rekap_Nilai_${filterRekapKelas || 'Semua_Kelas'}_${filterRekapMapel || 'Semua_Mapel'}.xlsx`);
  };

  const activeSessionsList = sessions.filter(s => s.status === 'active');
  const uniqueBankMapels = [...new Set(bankSoal.map(s => s.mapel))].filter(Boolean);
  const uniqueRekapMapels = [...new Set(leaderboard.map(s => s.mapel))].filter(Boolean);
  const uniqueRekapKelas = [...new Set(leaderboard.map(s => s.class))].filter(Boolean);
  const monitoredStudents = selectedMonitorToken ? liveStudents.filter(s => s.token === selectedMonitorToken) : liveStudents;

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 text-gray-900 dark:text-gray-100 font-sans relative">
      <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden fixed bottom-4 left-4 p-3 bg-emerald-600 text-white rounded-full shadow-lg z-40 print:hidden"><Menu size={20} /></button>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-300 ease-in-out z-50 w-64 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-xl print:hidden border-r border-white/50 dark:border-gray-700/50 flex flex-col`}>
        <div className="p-6 border-b border-emerald-100 dark:border-gray-800 flex justify-between items-center">
          <div className="text-center w-full">
            <div className="w-12 h-12 mx-auto bg-gradient-to-tr from-emerald-500 to-green-400 rounded-xl flex items-center justify-center shadow-md mb-2 text-white font-black text-lg">CBT</div>
            <h2 className="text-base font-black text-emerald-800 dark:text-emerald-400">Portal Guru</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 text-gray-500 absolute top-3 right-3 bg-gray-100 dark:bg-gray-800 rounded-full"><X size={18} /></button>
        </div>
        <div className="p-4 border-b border-emerald-100 dark:border-gray-800 bg-emerald-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full text-emerald-600 dark:text-emerald-400"><User size={20} /></div>
            <div className="overflow-hidden"><p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 truncate">{teacherProfile.nama}</p><p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 truncate">{teacherProfile.email}</p></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          <button onClick={() => {setActiveTab('proctor'); setIsSidebarOpen(false)}} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'proctor' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}><Users size={18} /> Pantau Ujian</button>
          <button onClick={() => {setActiveTab('bank'); setIsSidebarOpen(false)}} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'bank' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}><BookOpen size={18} /> Bank Soal</button>
          <button onClick={() => {setActiveTab('rekap'); setIsSidebarOpen(false)}} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'rekap' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}><Award size={18} /> Rekap Nilai</button>
          <button onClick={() => {setActiveTab('settings'); setIsSidebarOpen(false)}} className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'settings' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}><Settings size={18} /> Kelola Sesi</button>
        </nav>
        <div className="p-4"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl font-black transition text-sm hover:bg-red-100"><LogOut size={16} /> Keluar</button></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full pb-20">
        <header className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-sm rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center print:hidden border border-white/50 dark:border-gray-700 mb-6 gap-3">
          <h1 className="text-lg md:text-xl font-black text-emerald-900 dark:text-emerald-100 ml-10 lg:ml-0">Dasbor Guru</h1>
          <div className="w-full sm:w-auto bg-emerald-100/80 dark:bg-emerald-900/60 rounded-lg md:rounded-full border border-emerald-200 dark:border-emerald-700 shadow-sm flex items-center px-3 py-1.5 md:py-2 overflow-hidden">
            <Eye size={16} className="text-emerald-700 dark:text-emerald-400 mr-2 shrink-0" />
            <span className="text-xs md:text-sm font-bold text-emerald-800 dark:text-emerald-300 whitespace-nowrap mr-2 hidden md:inline">Pantau:</span>
            <select value={selectedMonitorToken} onChange={(e) => setSelectedMonitorToken(e.target.value)} className="bg-transparent border-none outline-none text-xs md:text-sm font-black text-emerald-700 dark:text-emerald-400 w-full focus:ring-0 cursor-pointer p-0">
                <option value="">Semua Sesi Aktif</option>
                {activeSessionsList.map(s => <option key={s.token} value={s.token}>Kelas {s.kelas} - {s.token}</option>)}
            </select>
          </div>
        </header>

        <main>
          {activeTab === 'proctor' && (
             <div className="print:hidden">
               {/* Broadcast Box */}
               <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-4 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 mb-6 flex flex-col sm:flex-row gap-3 items-center backdrop-blur-md">
                 <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full text-blue-600 dark:text-blue-300"><Send size={20} /></div>
                 <input type="text" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Ketik pengumuman mendadak di sini (Misal: Waktu sisa 10 menit!)" className="flex-1 w-full bg-white/80 dark:bg-gray-800 border border-blue-200 dark:border-blue-700 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                 <button onClick={handleSendBroadcast} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md text-sm transition-transform active:scale-95 whitespace-nowrap">Kirim Broadcast</button>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                 <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-xl shadow-sm border-l-4 border-emerald-500 backdrop-blur-md"><p className="text-xs text-gray-500 font-semibold mb-1">Terhubung</p><h3 className="text-2xl font-black">{monitoredStudents.length}</h3></div>
                 <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-xl shadow-sm border-l-4 border-green-500 backdrop-blur-md"><p className="text-xs text-gray-500 font-semibold mb-1">Selesai</p><h3 className="text-2xl font-black text-green-600">{monitoredStudents.filter(s => s.status === 'selesai').length}</h3></div>
                 <div className="col-span-2 md:col-span-1 bg-white/70 dark:bg-gray-800/70 p-4 rounded-xl shadow-sm border-l-4 border-red-500 backdrop-blur-md"><p className="text-xs text-gray-500 font-semibold mb-1">Indikasi Curang</p><h3 className="text-2xl font-black text-red-600">{monitoredStudents.filter(s => s.warnings > 0).length}</h3></div>
               </div>
               
               <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl shadow-sm overflow-x-auto border border-white/50 dark:border-gray-700 w-full">
                 <table className="w-full text-left min-w-[700px]">
                   <thead className="bg-emerald-50/50 dark:bg-gray-700/50 text-sm">
                     <tr><th className="p-3 font-bold">Nama Siswa</th><th className="p-3 font-bold">Mapel / Kls</th><th className="p-3 font-bold text-center">Kamera</th><th className="p-3 font-bold">Status</th><th className="p-3 font-bold text-center">Aksi</th></tr>
                   </thead>
                   <tbody className="divide-y dark:divide-gray-700 text-sm">
                     {monitoredStudents.length === 0 ? (
                         <tr><td colSpan="5" className="p-6 text-center text-gray-500 font-medium">Belum ada siswa yang bergabung di sesi ini.</td></tr>
                     ) : (
                         monitoredStudents.map(student => (
                           <tr key={student.id}>
                             <td className="p-3 font-medium">{student.name}</td>
                             <td className="p-3"><span className="font-bold">{student.mapel}</span> <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded ml-1">Tk.{student.tingkat}</span><br/><span className="text-xs text-gray-500">{student.class}</span></td>
                             {/* Kamera Snapshot Button */}
                             <td className="p-3 text-center">
                               {student.snapshot ? (
                                 <button onClick={() => setSelectedSnapshot(student)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 mx-auto"><Camera size={12}/> Lihat</button>
                               ) : <span className="text-[10px] text-gray-400">Loading...</span>}
                             </td>
                             <td className="p-3"><span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${student.status === 'force_finish' ? 'bg-amber-100 text-amber-700' : student.status === 'selesai' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'}`}>{student.status}</span></td>
                             <td className="p-3 text-center"><button onClick={() => forceFinish(student.id)} disabled={student.status === 'selesai' || student.status === 'force_finish'} className="text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded-md text-xs font-bold disabled:opacity-30 whitespace-nowrap">Paksa Selesai</button></td>
                           </tr>
                         ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          )}
          
          {activeTab === 'bank' && (
            <div className="print:hidden">
              <div className="flex flex-col sm:flex-row justify-between gap-3 mb-6">
                <div className="flex items-center bg-white/70 dark:bg-gray-800/70 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 shadow-sm w-full sm:w-auto">
                   <Filter size={16} className="text-emerald-600" />
                   <select value={filterBankMapel} onChange={e => setFilterBankMapel(e.target.value)} className="bg-transparent border-none focus:ring-0 text-sm font-bold text-emerald-800 dark:text-emerald-300 py-2 w-full outline-none">
                       <option value="">Semua Mapel</option>
                       {uniqueBankMapels.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <button onClick={handleDownloadExcel} className="flex items-center justify-center gap-1 bg-white/70 dark:bg-gray-800/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 px-3 py-2 rounded-lg font-bold shadow-sm text-xs"><Download size={14}/> Template</button>
                  <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleUploadExcel} />
                  <button onClick={() => fileInputRef.current.click()} className="flex items-center justify-center gap-1 bg-amber-100 border border-amber-300 text-amber-700 px-3 py-2 rounded-lg font-bold shadow-sm text-xs"><Upload size={14}/> Upload</button>
                  <button onClick={() => { setEditId(null); setFormData({ mapel: '', tingkat: '', tipe: 'ganda', pertanyaan: '', gambarUrl: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' }); setShowModal(true); }} className="flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-3 py-2 rounded-lg shadow-md font-black text-xs"><Plus size={14}/> Manual</button>
                </div>
              </div>
              <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl shadow-sm border border-white/50 dark:border-gray-700 divide-y dark:divide-gray-700">
                 {bankSoal.filter(s => filterBankMapel ? s.mapel === filterBankMapel : true).length === 0 && <p className="p-6 text-center text-gray-500 text-sm font-bold">Bank Soal Kosong / Tidak ada soal untuk mapel ini.</p>}
                 {bankSoal.filter(s => filterBankMapel ? s.mapel === filterBankMapel : true).map((soal, idx) => (
                    <div key={soal.id} className="p-4 flex flex-col md:flex-row justify-between gap-3 text-sm">
                      <div className="w-full">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black uppercase">Tk.{soal.tingkat} {soal.mapel}</span>
                           <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${soal.tipe === 'essay' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{soal.tipe === 'essay' ? 'ESSAY' : 'PG'}</span>
                        </div>
                        {soal.gambarUrl && <img src={soal.gambarUrl} alt="Preview" className="max-h-24 object-contain mb-2 rounded border border-gray-200" />}
                        <p className="font-bold mb-2"><span className="text-emerald-500 mr-1">{idx + 1}.</span> {soal.pertanyaan}</p>
                        
                        {soal.tipe !== 'essay' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-gray-300 text-xs">
                            <p>A. {soal.opsiA}</p><p>B. {soal.opsiB}</p><p>C. {soal.opsiC}</p><p>D. {soal.opsiD}</p>
                          </div>
                        )}
                        {soal.tipe !== 'essay' && <p className="mt-2 inline-block bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Kunci: {soal.kunci}</p>}
                      </div>
                      <div className="flex md:flex-col gap-2 justify-end mt-2 md:mt-0">
                        <button onClick={() => { setEditId(soal.id); setFormData(soal); setShowModal(true); }} className="flex-1 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200">Edit</button>
                        <button onClick={() => handleDeleteSoal(soal.id)} className="flex items-center justify-center text-red-500 bg-red-50 p-2 rounded-lg border border-red-200"><Trash2 size={14}/></button>
                      </div>
                    </div>
                 ))}
              </div>
            </div>
          )}
          
          {activeTab === 'rekap' && (
             <div className="print:block">
               <div className="mb-4 flex flex-col sm:flex-row justify-between gap-3 print:hidden">
                 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="flex items-center bg-white/70 dark:bg-gray-800/70 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 shadow-sm">
                        <Filter size={16} className="text-emerald-600" />
                        <select value={filterRekapMapel} onChange={e => setFilterRekapMapel(e.target.value)} className="bg-transparent border-none focus:ring-0 text-sm font-bold text-emerald-800 dark:text-emerald-300 py-2 outline-none w-full">
                            <option value="">Semua Mapel</option>
                            {uniqueRekapMapels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center bg-white/70 dark:bg-gray-800/70 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 shadow-sm">
                        <Filter size={16} className="text-emerald-600" />
                        <select value={filterRekapKelas} onChange={e => setFilterRekapKelas(e.target.value)} className="bg-transparent border-none focus:ring-0 text-sm font-bold text-emerald-800 dark:text-emerald-300 py-2 outline-none w-full">
                            <option value="">Semua Kelas</option>
                            {uniqueRekapKelas.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto">
                   <button onClick={handleExportRekapExcel} className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg font-bold shadow-md text-sm"><Download size={14}/> Excel</button>
                   <button onClick={() => window.print()} className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-600 to-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-md text-sm"><Printer size={14}/> PDF</button>
                 </div>
               </div>
               <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl shadow-sm border border-white/50 dark:border-gray-700 overflow-x-auto w-full">
                 <table className="w-full text-left print:text-black print:border min-w-[400px]">
                   <thead className="bg-emerald-50/50 dark:bg-gray-700/50 text-sm">
                     <tr><th className="p-3 font-bold">Rank</th><th className="p-3 font-bold">Nama Siswa</th><th className="p-3 font-bold">Mapel / Kelas</th><th className="p-3 font-bold text-center">Nilai PG</th></tr>
                   </thead>
                   <tbody className="divide-y dark:divide-gray-700 text-sm">
                     {leaderboard.filter(lb => filterRekapMapel ? lb.mapel === filterRekapMapel : true).filter(lb => filterRekapKelas ? lb.class === filterRekapKelas : true).map((lb, idx) => (
                       <tr key={lb.id} className="print:border-b"><td className="p-3 font-bold text-gray-500">#{idx + 1}</td><td className="p-3 font-medium">{lb.name}</td><td className="p-3"><span className="font-bold">{lb.mapel}</span><br/><span className="text-xs text-gray-500">{lb.class}</span></td><td className="p-3 text-center font-black text-emerald-600">{lb.score}</td></tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          )}

           {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
              <div className="lg:col-span-1 bg-white/70 dark:bg-gray-800/70 p-5 rounded-xl shadow-sm border border-white/50 dark:border-gray-700 h-fit">
                <h2 className="text-base font-black mb-4 text-emerald-700">Buat Sesi Baru</h2>
                <form onSubmit={handleCreateSession} className="space-y-3">
                  <div><label className="block text-xs font-bold mb-1">Mata Pelajaran</label><input type="text" required value={sessionForm.mapel} onChange={e => setSessionForm({...sessionForm, mapel: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg focus:ring-2 text-sm" placeholder="Contoh: Matematika" /></div>
                  <div><label className="block text-xs font-bold mb-1 text-emerald-700">Tingkat Kelas (Angka/Romawi)</label><input type="text" required value={sessionForm.tingkat} onChange={e => setSessionForm({...sessionForm, tingkat: e.target.value})} className="w-full border-2 border-emerald-300 bg-emerald-50/30 p-2 rounded-lg text-sm" placeholder="Contoh: 7 atau IX" /></div>
                  <div><label className="block text-xs font-bold mb-1">Nama Ruang / Kelas</label><input type="text" required value={sessionForm.kelas} onChange={e => setSessionForm({...sessionForm, kelas: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg uppercase focus:ring-2 text-sm" placeholder="Contoh: 7A" /></div>
                  <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black py-2.5 rounded-lg shadow-md text-sm mt-2">Generate Token</button>
                </form>
              </div>
              <div className="lg:col-span-2 bg-white/70 dark:bg-gray-800/70 rounded-xl shadow-sm overflow-hidden w-full border border-white/50">
                <div className="p-4 border-b border-emerald-100 bg-emerald-50/50"><h2 className="text-base font-black text-emerald-800">Riwayat Sesi</h2></div>
                <div className="overflow-x-auto"><table className="w-full text-left min-w-[450px]"><tbody className="divide-y divide-emerald-50 dark:divide-gray-700 text-sm">
                      {sessions.map(s => (
                      <tr key={s.id}>
                        <td className="p-3 font-black text-emerald-600 tracking-widest">{s.token}</td><td className="p-3 font-bold">{s.mapel} <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded ml-1">Tk.{s.tingkat}</span><br/><span className="text-xs font-medium text-gray-500">Kelas: {s.kelas}</span></td>
                        <td className="p-3"><button onClick={() => toggleSessionStatus(s.id, s.status)} className={`px-2 py-1 rounded-md font-bold text-xs ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{s.status === 'active' ? 'Tutup Akses' : 'Buka Lagi'}</button></td>
                        <td className="p-3 text-right"><button onClick={() => deleteSession(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button></td>
                      </tr>
                      ))}
                </tbody></table></div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Lihat Foto Anti-Joki */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
           <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl w-full max-w-sm text-center relative animate-in zoom-in">
              <button onClick={() => setSelectedSnapshot(null)} className="absolute top-2 right-2 bg-red-100 text-red-600 p-1 rounded-full"><X size={20}/></button>
              <h3 className="font-black text-emerald-800 dark:text-emerald-400 mb-2">Kamera: {selectedSnapshot.name}</h3>
              <p className="text-xs text-gray-500 mb-4">Update Terakhir: {new Date(selectedSnapshot.lastSnapshotTime).toLocaleTimeString()}</p>
              <img src={selectedSnapshot.snapshot} alt="Siswa" className="w-full rounded-xl border-4 border-emerald-100 shadow-md" />
           </div>
        </div>
      )}

      {/* Modal Buat Soal Manual (Ganda & Essay) */}
      {showModal && (
        <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-5 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/50">
            <h2 className="text-lg font-black mb-4 border-b border-gray-200 pb-2">{editId ? 'Edit Data Soal' : 'Tulis Soal Baru'}</h2>
            <form onSubmit={handleSaveSoal} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                  <div><label className="block font-bold text-xs mb-1 text-emerald-600">Mapel (Wajib)</label><input required type="text" value={formData.mapel} onChange={e => setFormData({...formData, mapel: e.target.value})} className="w-full border-2 border-emerald-300 p-2 rounded-lg text-sm bg-emerald-50/30" placeholder="Matematika" /></div>
                  <div><label className="block font-bold text-xs mb-1 text-emerald-600">Tingkat Kelas</label><input required type="text" value={formData.tingkat} onChange={e => setFormData({...formData, tingkat: e.target.value})} className="w-full border-2 border-emerald-300 p-2 rounded-lg text-sm bg-emerald-50/30" placeholder="7 atau IX" /></div>
                  <div><label className="block font-bold text-xs mb-1 text-emerald-600">Tipe Soal</label><select value={formData.tipe} onChange={e => setFormData({...formData, tipe: e.target.value})} className="w-full border-2 border-emerald-300 p-2 rounded-lg text-sm bg-emerald-50/30 font-bold"><option value="ganda">Pilihan Ganda</option><option value="essay">Uraian / Essay</option></select></div>
              </div>
              
              <div>
                 <label className="block font-bold text-xs mb-1 text-emerald-600">Gambar Soal (Opsional)</label>
                 <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors relative ${isUploading ? 'border-amber-400 bg-amber-50' : formData.gambarUrl ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:bg-gray-50'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files[0]); }}>
                   {isUploading ? ( <div className="flex flex-col items-center justify-center py-2"><div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div><p className="text-xs font-bold text-amber-700">Mengunggah... {Math.round(uploadProgress)}%</p></div> ) : formData.gambarUrl ? ( <div className="relative inline-block"><img src={formData.gambarUrl} alt="Preview" className="max-h-24 mx-auto rounded shadow-sm border border-emerald-200" /><button type="button" onClick={() => setFormData({...formData, gambarUrl: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:scale-110"><X size={12}/></button></div> ) : ( <div className="flex flex-col items-center justify-center py-2"><ImagePlus size={24} className="text-gray-400 mb-1" /><p className="text-xs text-gray-500 mb-2">Seret & lepas gambar ke sini, atau</p><input type="file" accept="image/*" onChange={(e) => handleImageUpload(e.target.files[0])} className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" /></div> )}
                 </div>
              </div>

              <div><label className="block font-bold text-sm mb-1">Pertanyaan</label><textarea required value={formData.pertanyaan} onChange={e => setFormData({...formData, pertanyaan: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg text-sm" rows="3"></textarea></div>
              
              {formData.tipe !== 'essay' && (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block font-bold text-xs mb-1">A</label><input required type="text" value={formData.opsiA} onChange={e => setFormData({...formData, opsiA: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg text-sm" /></div>
                    <div><label className="block font-bold text-xs mb-1">B</label><input required type="text" value={formData.opsiB} onChange={e => setFormData({...formData, opsiB: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg text-sm" /></div>
                    <div><label className="block font-bold text-xs mb-1">C</label><input required type="text" value={formData.opsiC} onChange={e => setFormData({...formData, opsiC: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg text-sm" /></div>
                    <div><label className="block font-bold text-xs mb-1">D</label><input required type="text" value={formData.opsiD} onChange={e => setFormData({...formData, opsiD: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg text-sm" /></div>
                  </div>
                  <div><label className="block font-black text-sm mb-1 text-emerald-700">Kunci Jawaban</label><select value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})} className="w-full border-2 border-emerald-400 p-2 rounded-lg font-black bg-emerald-50 text-sm"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
                  </>
              )}
              
              <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-gray-200">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm">Batal</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-black text-sm">Simpan Soal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
