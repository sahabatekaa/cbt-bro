import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref as dbRef, onValue, push, remove, update } from 'firebase/database';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices, Menu, X, Lock, Unlock, Eye, Filter, GraduationCap } from 'lucide-react';

export default function TeacherDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [data, setData] = useState({ live: [], bank: [], lead: [], sessions: [] });
  const [showModal, setShowModal] = useState(false);
  const [activeMonitorToken, setActiveMonitorToken] = useState(localStorage.getItem('activeMonitorToken') || '');
  const [selectedMapelSesi, setSelectedMapelSesi] = useState('');
  const [recapFilterKelas, setRecapFilterKelas] = useState('');
  const [teacherProfile, setTeacherProfile] = useState({ name: 'Memuat...', email: auth.currentUser?.email });
  const fileInputRef = useRef(null);
  
  const currentUserEmail = auth.currentUser?.email || 'guru@unknown.com';
  const [formData, setFormData] = useState({ mapel: '', kelas: '', pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });

  useEffect(() => {
    if(auth.currentUser) {
      onValue(dbRef(db, `users/${auth.currentUser.uid}`), snap => { 
        setTeacherProfile(snap.exists() && snap.val()?.name ? snap.val() : { name: currentUserEmail.split('@')[0], email: currentUserEmail }); 
      });
    }
    
    // Penarikan Data Kebal Error
    const fetchData = (path, key) => onValue(dbRef(db, path), snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        setData(prev => ({ ...prev, [key]: Object.keys(val).map(k => ({ id: k, ...val[k] })) }));
      } else {
        setData(prev => ({ ...prev, [key]: [] }));
      }
    });

    fetchData('live_students', 'live'); 
    fetchData('bank_soal', 'bank'); 
    fetchData('leaderboard', 'lead'); 
    fetchData('exam_sessions', 'sessions');
  }, [currentUserEmail]);

  // Filter dengan Safety Check (s?) agar tidak crash jika data bolong
  const myQuestions = (data.bank || []).filter(q => q?.teacherEmail === currentUserEmail);
  const mySessions = (data.sessions || []).filter(s => s?.teacherEmail === currentUserEmail);
  
  // Pastikan score yang di-sort adalah angka
  const myLeaderboard = (data.lead || []).filter(s => s?.teacherEmail === currentUserEmail).sort((a,b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));
  const monitoredStudents = (data.live || []).filter(s => s?.token === activeMonitorToken);

  const availableMapel = [...new Set(myQuestions.map(q => q?.mapel).filter(Boolean))];
  const availableKelasSesi = [...new Set(myQuestions.filter(q => q?.mapel === selectedMapelSesi).map(q => q?.kelas).filter(Boolean))];
  const availableRecapKelas = [...new Set(myLeaderboard.map(s => s?.class).filter(Boolean))];
  const filteredLeaderboard = myLeaderboard.filter(s => recapFilterKelas === '' || s?.class === recapFilterKelas);

  const handleAddSoal = (e) => { e.preventDefault(); push(dbRef(db, 'bank_soal'), { ...formData, teacherEmail: currentUserEmail }); setShowModal(false); setFormData({ mapel: formData.mapel, kelas: formData.kelas, pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' }); };
  const downloadTemplate = () => { XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.json_to_sheet([{ mapel: "Matematika", kelas: "9", pertanyaan: "Jika $x^2 = 4$, maka $x$ adalah?", opsiA: "2", opsiB: "3", opsiC: "4", opsiD: "5", kunci: "A" }]), "Soal"), "Template.xlsx"); };
  const handleFileUpload = (e) => { const reader = new FileReader(); reader.onload = (evt) => { const d = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]); d.forEach(i => { if (i.pertanyaan && i.kunci) push(dbRef(db, 'bank_soal'), { ...i, teacherEmail: currentUserEmail }); }); alert("Import Sukses!"); if(fileInputRef.current) fileInputRef.current.value = ''; }; reader.readAsBinaryString(e.target.files[0]); };
  
  const handleCreateSession = (e) => { e.preventDefault(); const t = document.getElementById('token_input').value; const k = document.getElementById('kelas_session').value; const sk = document.getElementById('subkelas_session').value.toUpperCase(); if(!t || !selectedMapelSesi || !k || !sk) return alert("Lengkapi data!"); push(dbRef(db, 'exam_sessions'), { token: t, mapel: selectedMapelSesi, kelas: k, subKelas: sk, status: 'open', teacherEmail: currentUserEmail, timestamp: Date.now() }); document.getElementById('token_input').value = ''; alert("Sesi dibuka!"); };
  const toggleSession = (id, s) => update(dbRef(db, `exam_sessions/${id}`), { status: s === 'open' ? 'closed' : 'open' });
  const delSession = (id) => { if(window.confirm("Hapus?")) remove(dbRef(db, `exam_sessions/${id}`)); };
  const setMonitor = (t) => { setActiveMonitorToken(t); localStorage.setItem('activeMonitorToken', t); setActiveTab('proctor'); };

  const NavItem = ({ tab, icon: Icon, label }) => (<button onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-xl ${activeTab === tab ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-emerald-50'}`}><Icon size={20}/> <span className="font-semibold">{label}</span></button>);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <style>{`@media print { body { background: white !important; } aside, header, button, .print\\:hidden, select, input { display: none !important; } main { padding: 0 !important; width: 100% !important; } table { width: 100% !important; border-collapse: collapse; } th, td { border: 1px solid #000 !important; padding: 10px !important; } }`}</style>
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden print:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 print:hidden`}>
        <div className="p-6 border-b"><h1 className="text-xl font-black text-emerald-600 flex gap-2"><GraduationCap size={26}/> CBT BRO</h1></div>
        <div className="p-4 border-b"><p className="text-xs font-bold text-emerald-500 uppercase mb-1">Guru</p><p className="text-sm font-bold truncate uppercase">{teacherProfile?.name}</p></div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem tab="settings" icon={Settings} label="Sesi Ujian" />
          <NavItem tab="proctor" icon={Users} label="Monitor Live" />
          <NavItem tab="bank" icon={BookOpen} label="Soal Milikku" />
          <NavItem tab="recap" icon={BarChart} label="Rekap Nilai" />
        </nav>
        <div className="p-4 border-t"><button onClick={onLogout} className="w-full flex gap-3 p-3 text-red-600 font-bold"><LogOut size={20}/> Logout</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b p-4 flex justify-between print:hidden">
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}><Menu/></button>
          <h2 className="text-xl font-bold">Dasbor</h2>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
          
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit"><h3 className="font-bold mb-4">Buka Sesi</h3>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <select value={selectedMapelSesi} onChange={(e) => setSelectedMapelSesi(e.target.value)} required className="w-full p-3 border rounded-xl"><option value="">Mapel...</option>{availableMapel.map(m => <option key={m}>{m}</option>)}</select>
                  <div className="flex gap-2"><select id="kelas_session" required disabled={!selectedMapelSesi} className="w-full p-3 border rounded-xl"><option value="">Tingkat...</option>{availableKelasSesi.map(k => <option key={k}>{k}</option>)}</select><input id="subkelas_session" placeholder="Sub (A)" required className="w-full p-3 border rounded-xl uppercase" /></div>
                  <div className="flex gap-2"><input id="token_input" required placeholder="Token" className="w-full p-3 border rounded-xl uppercase" /><button type="button" onClick={() => document.getElementById('token_input').value = Math.random().toString(36).substring(2,7).toUpperCase()} className="p-3 bg-emerald-100 rounded-xl"><Dices/></button></div>
                  <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">Rilis</button>
                </form>
              </div>
              <div className="lg:col-span-2 space-y-4"><h3 className="font-bold">Sesi Aktif</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{mySessions.map((s) => (
                    <div key={s.id} className={`p-4 rounded-2xl border ${s.status==='open'?'bg-white':'bg-gray-100'}`}><h4 className="text-2xl font-black">{s.token}</h4><p className="text-xs font-bold mt-1">{s.mapel} | Kls: {s.kelas} | Sub: {s.subKelas}</p>
                    <div className="flex gap-2 mt-4"><button onClick={() => setMonitor(s.token)} className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-sm">Monitor</button><button onClick={() => toggleSession(s.id, s.status)} className="p-2 bg-gray-200 rounded-lg">{s.status==='open'?<Lock size={16}/>:<Unlock size={16}/>}</button><button onClick={() => delSession(s.id)} className="p-2 bg-red-100 text-red-600 rounded-lg"><Trash2 size={16}/></button></div></div>
                  ))}</div>
              </div>
            </div>
          )}

          {activeTab === 'proctor' && (
            <div className="space-y-6">
              <select value={activeMonitorToken} onChange={(e) => setMonitor(e.target.value)} className="p-3 rounded-xl w-full max-w-sm border"><option value="">Pilih Sesi...</option>{mySessions.map(s => <option key={s.token} value={s.token}>{s.token} ({s.kelas}-{s.subKelas})</option>)}</select>
              {activeMonitorToken && (
                <table className="w-full bg-white rounded-xl shadow-sm"><thead className="bg-gray-100"><tr><th className="p-4 text-left">Nama</th><th className="p-4 text-left">Kls</th><th className="p-4 text-left">Prog</th></tr></thead><tbody>
                  {monitoredStudents.map(s => (<tr key={s.id} className="border-t"><td className="p-4 font-bold">{s?.name || '-'} {s?.warnings > 0 && <span className="text-red-500 text-xs">(!Tab)</span>}</td><td className="p-4">{s?.class}-{s?.subKelas}</td><td className="p-4">{s?.progress}%</td></tr>))}
                </tbody></table>
              )}
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-6">
              <input type="file" accept=".xlsx" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <div className="flex gap-2"><button onClick={() => setShowModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">Buat Soal</button><button onClick={downloadTemplate} className="bg-white border px-4 py-2 rounded-lg">Template</button><button onClick={() => fileInputRef.current.click()} className="bg-white border text-emerald-700 px-4 py-2 rounded-lg">Import Excel</button></div>
              <div className="space-y-4">{myQuestions.map((q, i) => (
                <div key={q.id} className="bg-white p-4 rounded-xl border flex justify-between"><div className="flex-1"><span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">{q?.mapel} | Tk.{q?.kelas}</span><p className="font-bold mt-2"><Latex>{`${i+1}. ${q?.pertanyaan || ''}`}</Latex></p><div className="grid grid-cols-2 gap-2 mt-2 text-sm"><div className={`p-2 border rounded ${q?.kunci==='A'?'bg-emerald-50 font-bold':''}`}><Latex>{`A. ${q?.opsiA || ''}`}</Latex></div><div className={`p-2 border rounded ${q?.kunci==='B'?'bg-emerald-50 font-bold':''}`}><Latex>{`B. ${q?.opsiB || ''}`}</Latex></div><div className={`p-2 border rounded ${q?.kunci==='C'?'bg-emerald-50 font-bold':''}`}><Latex>{`C. ${q?.opsiC || ''}`}</Latex></div><div className={`p-2 border rounded ${q?.kunci==='D'?'bg-emerald-50 font-bold':''}`}><Latex>{`D. ${q?.opsiD || ''}`}</Latex></div></div></div><button onClick={() => remove(dbRef(db, `bank_soal/${q.id}`))} className="text-red-500 p-2"><Trash2/></button></div>
              ))}</div>
            </div>
          )}

          {/* TAB REKAP NILAI (ANTI-CRASH) */}
          {activeTab === 'recap' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border print:border-none print:shadow-none">
              <div className="flex justify-between mb-6 print:hidden">
                <select value={recapFilterKelas} onChange={e => setRecapFilterKelas(e.target.value)} className="p-2 border rounded-lg">
                  <option value="">Semua Tingkat</option>
                  {availableRecapKelas.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <button onClick={() => window.print()} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">Cetak PDF</button>
              </div>
              
              <div className="hidden print:block text-center mb-6"><h1 className="text-2xl font-black">CBT REKAPITULASI NILAI</h1></div>
              
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 border">Rank</th>
                    <th className="p-3 border">Nama</th>
                    <th className="p-3 border">Mapel</th>
                    <th className="p-3 border">Kelas</th>
                    <th className="p-3 border text-right">Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.length > 0 ? filteredLeaderboard.map((s, i) => (
                    <tr key={s?.id || i}>
                      <td className="p-3 border">#{i+1}</td>
                      <td className="p-3 border font-bold">{s?.name || 'Siswa Tanpa Nama'}</td>
                      <td className="p-3 border">{s?.mapel || '-'}</td>
                      <td className="p-3 border">{s?.class || '-'}-{s?.subKelas || '-'}</td>
                      <td className="p-3 border text-right font-black text-emerald-600 print:text-black">{s?.score || 0}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">Belum ada data nilai masuk untuk Anda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              <div className="hidden print:block mt-16 text-right">
                <p>Guru Mata Pelajaran</p><br/><br/>
                <p className="font-bold uppercase">{teacherProfile?.name || '_________________'}</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] print:hidden">
          <div className="bg-white p-6 rounded-2xl w-full max-w-xl"><h2 className="font-bold mb-4">Tulis Soal</h2>
            <form onSubmit={handleAddSoal} className="space-y-4">
              <div className="flex gap-2"><input required value={formData.mapel} placeholder="Mapel" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, mapel: e.target.value})} /><input required value={formData.kelas} placeholder="Tingkat" className="w-full p-3 border rounded" onChange={e => setFormData({...formData, kelas: e.target.value})} /></div>
              <textarea required value={formData.pertanyaan} placeholder="Pertanyaan (Gunakan $...$ untuk matematika)" className="w-full p-3 border rounded" rows="3" onChange={e => setFormData({...formData, pertanyaan: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">{['A','B','C','D'].map(opt => <input key={opt} required value={formData[`opsi${opt}`]} placeholder={`Opsi ${opt}`} className="p-3 border rounded" onChange={e => setFormData({...formData, [`opsi${opt}`]: e.target.value})} />)}</div>
              <select className="w-full p-3 border rounded bg-gray-50" value={formData.kunci} onChange={e => setFormData({...formData, kunci: e.target.value})}><option value="A">Kunci A</option><option value="B">Kunci B</option><option value="C">Kunci C</option><option value="D">Kunci D</option></select>
              <div className="flex gap-2"><button type="button" onClick={() => setShowModal(false)} className="flex-1 p-3 bg-gray-200 rounded font-bold">Batal</button><button type="submit" className="flex-1 p-3 bg-emerald-600 text-white rounded font-bold">Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
