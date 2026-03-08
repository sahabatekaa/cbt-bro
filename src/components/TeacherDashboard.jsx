import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { db, auth } from '../firebase';
import { Users, BookOpen, Award, Settings, LogOut, Plus, Trash2, Printer, CheckCircle, XCircle, Download, Upload } from 'lucide-react';
import { signOut } from 'firebase/auth';
import * as XLSX from 'xlsx';

export default function TeacherDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('proctor');
  const [liveStudents, setLiveStudents] = useState([]);
  const [bankSoal, setBankSoal] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });
  const [editId, setEditId] = useState(null);
  const [sessionForm, setSessionForm] = useState({ mapel: '', kelas: '' });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    onValue(ref(db, 'live_students'), (snap) => setLiveStudents(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })) : []));
    onValue(ref(db, 'bank_soal'), (snap) => setBankSoal(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })) : []));
    onValue(ref(db, 'leaderboard'), (snap) => setLeaderboard(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).sort((a, b) => b.score - a.score) : []));
    onValue(ref(db, 'active_sessions'), (snap) => setSessions(snap.val() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).reverse() : []));
  }, []);

  const handleLogout = async () => { await signOut(auth); onLogout(); };
  const forceFinish = (studentId) => update(ref(db, `live_students/${studentId}`), { status: 'selesai', progress: 100 });
  
  const handleSaveSoal = (e) => {
    e.preventDefault();
    if (editId) update(ref(db, `bank_soal/${editId}`), formData);
    else push(ref(db, 'bank_soal'), formData);
    setShowModal(false); setFormData({ pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' }); setEditId(null);
  };
  const handleDeleteSoal = (id) => { if(window.confirm('Hapus soal ini?')) remove(ref(db, `bank_soal/${id}`)); };

  // Fitur EXCEL DENGAN LIBRARY XLSX
  const handleDownloadExcel = () => {
    const templateData = [{ Pertanyaan: "Siapa Presiden Pertama RI?", OpsiA: "Soekarno", OpsiB: "Soeharto", OpsiC: "Habibie", OpsiD: "Gus Dur", Kunci: "A" }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Soal");
    XLSX.writeFile(wb, "Template_Bank_Soal_CBT.xlsx");
  };

  const handleUploadExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let successCount = 0;
        data.forEach(row => {
          if (row.Pertanyaan && row.OpsiA && row.OpsiB && row.OpsiC && row.OpsiD && row.Kunci) {
            push(ref(db, 'bank_soal'), { pertanyaan: row.Pertanyaan, opsiA: row.OpsiA, opsiB: row.OpsiB, opsiC: row.OpsiC, opsiD: row.OpsiD, kunci: row.Kunci });
            successCount++;
          }
        });
        alert(`Berhasil mengunggah ${successCount} soal!`);
      } catch (error) { alert("Format Excel tidak didukung atau corrupt."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; 
  };

  const handleCreateSession = (e) => {
    e.preventDefault();
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    push(ref(db, 'active_sessions'), { mapel: sessionForm.mapel, kelas: sessionForm.kelas.toUpperCase(), token, status: 'active', timestamp: Date.now() });
    setSessionForm({ mapel: '', kelas: '' });
  };
  const toggleSessionStatus = (id, currentStatus) => update(ref(db, `active_sessions/${id}`), { status: currentStatus === 'active' ? 'expired' : 'active' });
  const deleteSession = (id) => { if(window.confirm('Hapus sesi?')) remove(ref(db, `active_sessions/${id}`)); };

  const activeTokensList = sessions.filter(s => s.status === 'active').map(s => s.token).join(', ') || 'TIDAK ADA';

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 text-gray-900 dark:text-gray-100 font-sans">
      <div className="w-72 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.05)] print:hidden border-r border-white/50 dark:border-gray-700/50 flex flex-col">
        <div className="p-8 border-b border-emerald-100 dark:border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-emerald-500 to-green-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4 text-white font-black text-2xl">CBT</div>
          <h2 className="text-xl font-black text-emerald-800 dark:text-emerald-400 tracking-wide">Portal Guru</h2>
        </div>
        <nav className="flex-1 p-5 space-y-3">
          <button onClick={() => setActiveTab('proctor')} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${activeTab === 'proctor' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'}`}><Users size={22} /> Pantau Ujian</button>
          <button onClick={() => setActiveTab('bank')} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${activeTab === 'bank' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'}`}><BookOpen size={22} /> Bank Soal</button>
          <button onClick={() => setActiveTab('rekap')} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${activeTab === 'rekap' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'}`}><Award size={22} /> Rekap Nilai</button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'}`}><Settings size={22} /> Kelola Sesi</button>
        </nav>
        <div className="p-5">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/20 dark:hover:bg-red-600 rounded-2xl font-black transition shadow-sm"><LogOut size={20} /> Keluar</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <header className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl shadow-sm rounded-3xl p-6 flex justify-between items-center print:hidden border border-white/50 dark:border-gray-800 mb-8">
          <h1 className="text-2xl font-black text-emerald-900 dark:text-emerald-100">Dasbor Cerdas</h1>
          <div className="px-6 py-2 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/60 dark:to-green-900/60 text-emerald-800 dark:text-emerald-300 rounded-full font-black border border-emerald-200 dark:border-emerald-700 shadow-sm">
            Token Aktif: <span className="text-emerald-600 dark:text-emerald-400 tracking-widest">{activeTokensList}</span>
          </div>
        </header>

        <main>
          {activeTab === 'proctor' && (
             <div className="print:hidden">
               <div className="grid grid-cols-3 gap-6 mb-8">
                 <div className="bg-white/70 dark:bg-gray-800/70 p-6 rounded-3xl shadow-sm border-l-4 border-emerald-500 backdrop-blur-md">
                   <p className="text-gray-500 font-semibold mb-1">Siswa Terhubung</p>
                   <h3 className="text-4xl font-black">{liveStudents.length}</h3>
                 </div>
                 <div className="bg-white/70 dark:bg-gray-800/70 p-6 rounded-3xl shadow-sm border-l-4 border-green-500 backdrop-blur-md">
                   <p className="text-gray-500 font-semibold mb-1">Ujian Selesai</p>
                   <h3 className="text-4xl font-black text-green-600">{liveStudents.filter(s => s.status === 'selesai').length}</h3>
                 </div>
                 <div className="bg-white/70 dark:bg-gray-800/70 p-6 rounded-3xl shadow-sm border-l-4 border-red-500 backdrop-blur-md">
                   <p className="text-gray-500 font-semibold mb-1">Indikasi Curang</p>
                   <h3 className="text-4xl font-black text-red-600">{liveStudents.filter(s => s.warnings > 0).length}</h3>
                 </div>
               </div>
               <div className="bg-white/70 dark:bg-gray-800/70 rounded-3xl shadow-sm overflow-hidden border border-white/50 dark:border-gray-700 backdrop-blur-md">
                 <table className="w-full text-left">
                   <thead className="bg-emerald-50/50 dark:bg-gray-700/50">
                     <tr>
                       <th className="p-5 font-bold">Nama Siswa</th>
                       <th className="p-5 font-bold">Kelas</th>
                       <th className="p-5 font-bold">Progress</th>
                       <th className="p-5 font-bold">Status</th>
                       <th className="p-5 font-bold text-center">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y dark:divide-gray-700">
                     {liveStudents.map(student => (
                       <tr key={student.id}>
                         <td className="p-5 font-medium">{student.name}</td>
                         <td className="p-5">{student.class}</td>
                         <td className="p-5">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                              <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: `${student.progress || 0}%` }}></div>
                            </div>
                         </td>
                         <td className="p-5"><span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">{student.status}</span></td>
                         <td className="p-5 text-center"><button onClick={() => forceFinish(student.id)} disabled={student.status === 'selesai'} className="text-red-500 hover:text-white hover:bg-red-500 px-3 py-1 rounded-lg text-sm font-bold transition">Paksa Selesai</button></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          )}

          {activeTab === 'bank' && (
            <div className="print:hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-3">
                  <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition shadow-sm"><Download size={18}/> Template Excel</button>
                  <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleUploadExcel} />
                  <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-5 py-2.5 rounded-xl font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition shadow-sm"><Upload size={18}/> Upload Soal</button>
                </div>
                <button onClick={() => { setEditId(null); setFormData({ pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' }); setShowModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/30 font-black transition transform hover:-translate-y-1"><Plus size={20}/> Tulis Soal Manual</button>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 dark:border-gray-700 divide-y dark:divide-gray-700">
                {bankSoal.length === 0 && <p className="p-10 text-center text-emerald-600/50 font-bold text-lg">Belum ada soal. Bank Soal masih bersih.</p>}
                {bankSoal.map((soal, idx) => (
                  <div key={soal.id} className="p-8 flex justify-between items-start hover:bg-white/90 dark:hover:bg-gray-700/50 transition">
                    <div className="max-w-4xl">
                      <p className="font-bold text-xl mb-4 text-emerald-900 dark:text-emerald-100"><span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/50 px-3 py-1 rounded-lg mr-2">{idx + 1}.</span> {soal.pertanyaan}</p>
                      <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-emerald-800/80 dark:text-emerald-200/80 font-medium">
                        <p><span className="font-black text-emerald-600 dark:text-emerald-400">A.</span> {soal.opsiA}</p>
                        <p><span className="font-black text-emerald-600 dark:text-emerald-400">B.</span> {soal.opsiB}</p>
                        <p><span className="font-black text-emerald-600 dark:text-emerald-400">C.</span> {soal.opsiC}</p>
                        <p><span className="font-black text-emerald-600 dark:text-emerald-400">D.</span> {soal.opsiD}</p>
                      </div>
                      <p className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/50 dark:to-green-900/50 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 rounded-lg font-black text-sm border border-emerald-200 dark:border-emerald-800"><CheckCircle size={16}/> Kunci: {soal.kunci}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setEditId(soal.id); setFormData(soal); setShowModal(true); }} className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 px-4 py-2 rounded-xl font-bold transition">Edit</button>
                      <button onClick={() => handleDeleteSoal(soal.id)} className="text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 p-2.5 rounded-xl transition"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rekap' && (
             <div className="print:block">
               <div className="mb-6 flex justify-end print:hidden">
                 <button onClick={() => window.print()} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg"><Printer size={18}/> Cetak PDF</button>
               </div>
               <div className="bg-white/70 dark:bg-gray-800/70 rounded-3xl shadow-sm border border-white/50 dark:border-gray-700 overflow-hidden backdrop-blur-md">
                 <table className="w-full text-left print:text-black print:border">
                   <thead className="bg-emerald-50/50 dark:bg-gray-700/50 print:bg-gray-200">
                     <tr className="print:border-b">
                       <th className="p-5 font-bold">Rank</th>
                       <th className="p-5 font-bold">Nama Siswa</th>
                       <th className="p-5 font-bold">Kelas</th>
                       <th className="p-5 font-bold text-center">Nilai Akhir</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y dark:divide-gray-700">
                     {leaderboard.map((lb, idx) => (
                       <tr key={lb.id} className="print:border-b">
                         <td className="p-5 font-bold text-gray-500">#{idx + 1}</td>
                         <td className="p-5 font-medium">{lb.name}</td>
                         <td className="p-5">{lb.class}</td>
                         <td className="p-5 text-center font-black text-emerald-600 text-lg">{lb.score}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid md:grid-cols-3 gap-8 print:hidden">
              <div className="md:col-span-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 dark:border-gray-700 h-fit">
                <h2 className="text-xl font-black mb-6 text-emerald-700 dark:text-emerald-400">Buat Sesi Baru</h2>
                <form onSubmit={handleCreateSession} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-2">Mata Pelajaran</label>
                    <input type="text" required value={sessionForm.mapel} onChange={e => setSessionForm({...sessionForm, mapel: e.target.value})} className="w-full border border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-gray-900/50 p-3 rounded-xl focus:ring-4 focus:ring-emerald-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-2">Kelas Terdaftar</label>
                    <input type="text" required value={sessionForm.kelas} onChange={e => setSessionForm({...sessionForm, kelas: e.target.value})} className="w-full border border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-gray-900/50 p-3 rounded-xl uppercase focus:ring-4 focus:ring-emerald-500/30" />
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-1">Generate Token</button>
                </form>
              </div>
              <div className="md:col-span-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-emerald-100 dark:border-gray-700 bg-emerald-50/50 dark:bg-gray-800/50"><h2 className="text-xl font-black text-emerald-800 dark:text-emerald-300">Riwayat Sesi</h2></div>
                <table className="w-full text-left"><tbody className="divide-y divide-emerald-50 dark:divide-gray-700">{sessions.map(s => (
                  <tr key={s.id} className="hover:bg-white/50 dark:hover:bg-gray-700/30">
                    <td className="p-5 font-black text-emerald-600 dark:text-emerald-400 tracking-widest text-xl">{s.token}</td>
                    <td className="p-5 font-bold">{s.mapel} <br/><span className="text-sm font-medium text-emerald-600/70">{s.kelas}</span></td>
                    <td className="p-5">
                      <button onClick={() => toggleSessionStatus(s.id, s.status)} className={`px-4 py-2 rounded-xl font-bold shadow-sm transition ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>{s.status === 'active' ? 'Tutup Akses' : 'Buka Lagi'}</button>
                    </td>
                    <td className="p-5 text-right"><button onClick={() => deleteSession(s.id)} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl"><Trash2 size={20}/></button></td>
                  </tr>
                ))}</tbody></table>
              </div>
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/50 dark:border-emerald-800/50">
            <h2 className="text-2xl font-black mb-6 text-emerald-800 dark:text-emerald-300 border-b border-emerald-100 dark:border-gray-800 pb-4">{editId ? 'Edit Data Soal' : 'Tulis Soal Baru'}</h2>
            <form onSubmit={handleSaveSoal} className="space-y-6">
              <div>
                <label className="block font-bold text-emerald-800 dark:text-emerald-200 mb-2">Pertanyaan Ujian</label>
                <textarea required value={formData.pertanyaan} onChange={e => setFormData({...formData, pertanyaan: e.target.value})} className="w-full border border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-gray-800/50 p-4 rounded-2xl focus:ring-4 focus:ring-emerald-500/30 font-medium" rows="3"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block font-bold mb-2">Pilihan A</label><input required type="text" value={formData.opsiA} onChange={e => setFormData({...formData, opsiA: e.target.value})} className="w-full border border-emerald-200 p-3 rounded-xl dark:bg-gray-800/50" /></div>
                <div><label className="block font-bold mb-2">Pilihan B</label><input required type="text" value={formData.opsiB} onChange={e => setFormData({...formData, opsiB: e.target.value})} className="w-full border border-emerald-200 p-3 rounded-xl dark:bg-gray-800/50" /></div>
                <div><label className="block font-bold mb-2">Pilihan C</label><input required type="text" value={formData.opsiC} onChange={e => setFormData({...formData, opsiC: e.target.value})} className="w-full border border-emerald-200 p-3 rounded-xl dark:bg-gray-800/50" /></div>
                <div><label className="block font-bold mb-2">Pilihan D</label><input required type="text" value={formData.opsiD} onChange={e => setFormData({...formData, opsiD: e.target.value})} className="w-full border border-emerald-200 p-3 rounded-xl dark:bg-gray-800/50" /></div>
              </div>
              <div>
                <label className="block font-black mb-2 text-emerald-700 dark:text-emerald-400">Tentukan Kunci Jawaban</label>
                <select value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})} className="w-full border-2 border-emerald-400 p-4 rounded-xl font-black bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 focus:ring-4 focus:ring-emerald-500/40">
                  <option value="A">Jawaban A Benar</option><option value="B">Jawaban B Benar</option><option value="C">Jawaban C Benar</option><option value="D">Jawaban D Benar</option>
                </select>
              </div>
              <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-emerald-100 dark:border-gray-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition hover:bg-gray-200">Batalkan</button>
                <button type="submit" className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-black shadow-lg shadow-emerald-500/40 transform hover:-translate-y-1 transition">Simpan ke Bank Soal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}