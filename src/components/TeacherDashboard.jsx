import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, remove, update } from 'firebase/database';
import { Users, BookOpen, BarChart, Settings, LogOut, Plus, Trash2, Download, Upload, Monitor, Dices } from 'lucide-react';

const TeacherDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('settings'); // Di-set default ke settings untuk testing fitur
  const [liveStudents, setLiveStudents] = useState([]);
  const [bankSoal, setBankSoal] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('activeToken') || '---');
  
  // State Form Soal (Ditambahkan mapel dan kelas)
  const [formData, setFormData] = useState({ 
    mapel: '', 
    kelas: '', 
    pertanyaan: '', 
    opsiA: '', 
    opsiB: '', 
    opsiC: '', 
    opsiD: '', 
    kunci: 'A' 
  });

  useEffect(() => {
    onValue(ref(db, 'live_students'), (snap) => {
      const data = snap.val();
      setLiveStudents(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
    });
    onValue(ref(db, 'bank_soal'), (snap) => {
      const data = snap.val();
      setBankSoal(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
    });
    onValue(ref(db, 'leaderboard'), (snap) => {
      const data = snap.val();
      const sorted = data ? Object.values(data).sort((a, b) => b.score - a.score) : [];
      setLeaderboard(sorted);
    });
  }, []);

  const handleAddSoal = (e) => {
    e.preventDefault();
    push(ref(db, 'bank_soal'), formData);
    setShowModal(false);
    // Reset form, tapi biarkan mapel dan kelas tetap sama untuk mempermudah input soal berikutnya
    setFormData({ ...formData, pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', kunci: 'A' });
  };

  const handleForceFinish = (id) => {
    update(ref(db, `live_students/${id}`), { status: 'Selesai' });
  };

  const generateRandomToken = () => {
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    document.getElementById('token_input').value = randomStr;
  };

  // EKSTRAKSI DATA DINAMIS DARI BANK SOAL
  const availableMapel = [...new Set(bankSoal.map(q => q.mapel).filter(Boolean))];
  const availableKelas = [...new Set(bankSoal.map(q => q.kelas).filter(Boolean))];

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 p-6 flex flex-col">
        <h1 className="text-xl font-bold text-blue-600 mb-8 flex items-center gap-2">
          <Monitor size={24} /> CBT Admin
        </h1>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('proctor')} className={`w-full flex items-center gap-3 p-3 rounded-lg ${activeTab === 'proctor' ? 'bg-blue-600 text-white' : 'dark:text-gray-400'}`}>
            <Users size={20}/> Proctoring
          </button>
          <button onClick={() => setActiveTab('bank')} className={`w-full flex items-center gap-3 p-3 rounded-lg ${activeTab === 'bank' ? 'bg-blue-600 text-white' : 'dark:text-gray-400'}`}>
            <BookOpen size={20}/> Bank Soal
          </button>
          <button onClick={() => setActiveTab('recap')} className={`w-full flex items-center gap-3 p-3 rounded-lg ${activeTab === 'recap' ? 'bg-blue-600 text-white' : 'dark:text-gray-400'}`}>
            <BarChart size={20}/> Rekap Nilai
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 p-3 rounded-lg ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'dark:text-gray-400'}`}>
            <Settings size={20}/> Pengaturan Sesi
          </button>
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 p-3 text-red-500 font-bold">
          <LogOut size={20}/> Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-slate-900 border-b p-4 flex justify-between items-center px-8">
          <h2 className="text-lg font-bold dark:text-white">Panel Pengawas</h2>
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            Token Aktif: <span className="font-mono bg-white px-2 py-1 rounded shadow-sm">{sessionToken}</span>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'proctor' && (
            <div className="space-y-6">
              {/* Metrik Proctoring */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border dark:border-slate-800">
                  <p className="text-gray-500">Total Siswa</p>
                  <p className="text-3xl font-bold dark:text-white">{liveStudents.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border dark:border-slate-800">
                  <p className="text-gray-500">Selesai</p>
                  <p className="text-3xl font-bold text-green-600">{liveStudents.filter(s => s.status === 'Selesai').length}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border dark:border-slate-800">
                  <p className="text-gray-500">Kecurangan</p>
                  <p className="text-3xl font-bold text-red-600">{liveStudents.filter(s => s.warnings > 0).length}</p>
                </div>
              </div>

              <table className="w-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm">
                <thead className="bg-gray-50 dark:bg-slate-800 text-left">
                  <tr>
                    <th className="p-4 dark:text-gray-300">Nama</th>
                    <th className="p-4 dark:text-gray-300">Kelas</th>
                    <th className="p-4 dark:text-gray-300 w-1/4">Progress</th>
                    <th className="p-4 dark:text-gray-300">Status</th>
                    <th className="p-4 dark:text-gray-300 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {liveStudents.map(s => (
                    <tr key={s.id} className="dark:text-white">
                      <td className="p-4 font-medium">{s.name}</td>
                      <td className="p-4">{s.class}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full">
                            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${s.progress}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-500">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          s.status === 'Selesai' ? 'bg-green-100 text-green-700' : 
                          s.status === 'Pindah Tab' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-blue-100 text-blue-700'
                        }`}>{s.status} {s.warnings > 0 && `(${s.warnings}x Warn)`}</span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleForceFinish(s.id)} disabled={s.status === 'Selesai'} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded disabled:opacity-50 transition-colors">Paksa Selesai</button>
                      </td>
                    </tr>
                  ))}
                  {liveStudents.length === 0 && (
                    <tr><td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada siswa yang login ke ujian.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-6">
                <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"><Plus size={18}/> Tambah Soal</button>
                <button onClick={() => alert("Fitur Template Ready")} className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"><Download size={18}/> Template Excel</button>
                <button onClick={() => alert("Upload Excel")} className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"><Upload size={18}/> Upload</button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {bankSoal.map((q, idx) => (
                  <div key={q.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold">{q.mapel}</span>
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-bold">{q.kelas}</span>
                      </div>
                      <p className="font-bold dark:text-white text-lg mb-2">{idx + 1}. {q.pertanyaan}</p>
                      <ul className="text-sm dark:text-gray-400 space-y-1 mb-2">
                        <li>A. {q.opsiA}</li>
                        <li>B. {q.opsiB}</li>
                        <li>C. {q.opsiC}</li>
                        <li>D. {q.opsiD}</li>
                      </ul>
                      <p className="text-sm text-green-600 font-bold bg-green-50 inline-block px-2 py-1 rounded">Kunci Jawaban: {q.kunci}</p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <button onClick={() => remove(ref(db, `bank_soal/${q.id}`))} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Hapus Soal"><Trash2 size={20}/></button>
                    </div>
                  </div>
                ))}
                {bankSoal.length === 0 && (
                  <div className="text-center p-10 bg-white dark:bg-slate-900 rounded-xl border border-dashed dark:border-slate-700 text-gray-500">Bank Soal Kosong. Silakan tambah soal baru.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'recap' && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6 print:hidden">
                <h3 className="text-xl font-bold dark:text-white">Peringkat & Nilai</h3>
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors">Cetak PDF</button>
              </div>
              
              {/* Header Khusus Print (Kop Surat) */}
              <div className="hidden print:block mb-8 border-b-4 border-black pb-4 text-center">
                <h1 className="text-2xl font-black uppercase tracking-widest">Laporan Hasil Ujian</h1>
                <p className="text-lg">Sistem CBT Next-Gen (Tahun Ajaran 2025/2026)</p>
                <p className="text-sm text-gray-600 mt-2">Mata Pelajaran: ____________ | Kelas: ____________</p>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                    <th className="p-3 dark:text-gray-300 w-16">Rank</th>
                    <th className="p-3 dark:text-gray-300">Nama Lengkap</th>
                    <th className="p-3 dark:text-gray-300">Kelas</th>
                    <th className="p-3 dark:text-gray-300 text-right">Nilai Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {leaderboard.map((s, idx) => (
                    <tr key={idx} className="dark:text-white print:text-black">
                      <td className="p-3 font-bold text-gray-500">#{idx + 1}</td>
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3">{s.class}</td>
                      <td className="p-3 text-right text-lg font-black">{s.score}</td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr><td colSpan="4" className="p-8 text-center text-gray-500">Belum ada data nilai ujian.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border dark:border-slate-800">
              <h3 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2">
                <Settings className="text-blue-600" /> Pengaturan Sesi Ujian Baru
              </h3>
              
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-700 mb-6">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Pilih Mata Pelajaran dan Kelas yang datanya sudah ada di Bank Soal. Jika kosong, pastikan Anda menambahkan minimal 1 soal terlebih dahulu.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Dropdown Mata Pelajaran Dinamis */}
                  <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-400">Mata Pelajaran</label>
                    <select id="mapel_session" className="w-full p-3 rounded-lg border bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 ring-blue-500 outline-none">
                      <option value="">-- Pilih Mapel --</option>
                      {availableMapel.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Dropdown Tingkatan Kelas Dinamis */}
                  <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-400">Tingkatan Kelas</label>
                    <select id="kelas_session" className="w-full p-3 rounded-lg border bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 ring-blue-500 outline-none">
                      <option value="">-- Pilih Kelas --</option>
                      {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                {/* Setup Token */}
                <div>
                  <label className="block text-sm font-bold mb-2 dark:text-gray-400">Token Ujian Akses Siswa</label>
                  <div className="flex gap-2">
                    <input 
                      id="token_input" 
                      type="text" 
                      placeholder="Ketik manual atau Generate" 
                      className="flex-1 p-3 rounded-lg border font-mono font-bold tracking-widest text-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white uppercase focus:ring-2 ring-blue-500 outline-none" 
                    />
                    <button 
                      onClick={generateRandomToken}
                      className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-4 rounded-lg flex items-center gap-2 font-medium transition-colors"
                    >
                      <Dices size={20} /> Generate
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t dark:border-slate-800">
                  <button 
                    onClick={() => {
                      const t = document.getElementById('token_input').value;
                      const m = document.getElementById('mapel_session').value;
                      const k = document.getElementById('kelas_session').value;
                      
                      if (!m || !k || !t) {
                        return alert("Harap lengkapi Mata Pelajaran, Kelas, dan Token!");
                      }

                      localStorage.setItem('activeToken', t);
                      setSessionToken(t);
                      alert(`Sesi aktif berhasil dibuat!\nMapel: ${m}\nKelas: ${k}\nToken: ${t}`);
                    }} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-transform active:scale-95"
                  >
                    Aktifkan Sesi Ujian Sekarang
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Tambah Soal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border dark:border-slate-800">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">Tambah Soal Baru</h2>
            <form onSubmit={handleAddSoal} className="space-y-5">
              
              <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                <div>
                  <label className="block text-sm font-bold mb-1 dark:text-gray-400">Mata Pelajaran</label>
                  <input 
                    placeholder="Contoh: Matematika" 
                    required 
                    value={formData.mapel}
                    className="w-full p-3 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white" 
                    onChange={e => setFormData({...formData, mapel: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 dark:text-gray-400">Tingkatan Kelas</label>
                  <input 
                    placeholder="Contoh: XII-IPA" 
                    required 
                    value={formData.kelas}
                    className="w-full p-3 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white" 
                    onChange={e => setFormData({...formData, kelas: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1 dark:text-gray-400">Pertanyaan</label>
                <textarea 
                  placeholder="Ketik pertanyaan di sini..." 
                  required 
                  value={formData.pertanyaan}
                  className="w-full p-3 rounded-lg border dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none" 
                  rows="3" 
                  onChange={e => setFormData({...formData, pertanyaan: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Opsi A</label>
                  <input required value={formData.opsiA} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" onChange={e => setFormData({...formData, opsiA: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Opsi B</label>
                  <input required value={formData.opsiB} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" onChange={e => setFormData({...formData, opsiB: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Opsi C</label>
                  <input required value={formData.opsiC} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" onChange={e => setFormData({...formData, opsiC: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Opsi D</label>
                  <input required value={formData.opsiD} className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" onChange={e => setFormData({...formData, opsiD: e.target.value})} />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-slate-700">
                <label className="block text-sm font-bold mb-2 dark:text-blue-300">Pilih Kunci Jawaban Benar</label>
                <select 
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold" 
                  value={formData.kunci}
                  onChange={e => setFormData({...formData, kunci: e.target.value})}
                >
                  <option value="A">Jawaban A</option>
                  <option value="B">Jawaban B</option>
                  <option value="C">Jawaban C</option>
                  <option value="D">Jawaban D</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white py-3 rounded-xl font-bold transition-colors">Batal</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/30">Simpan Soal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
