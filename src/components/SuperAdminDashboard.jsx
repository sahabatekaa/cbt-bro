import React, { useState, useEffect } from 'react';
import { ref, remove, onValue, update, push, set } from 'firebase/database';
import { db, auth } from '../firebase';
import { ShieldAlert, Trash2, LogOut, CheckCircle, Database, Users, UserCheck, UserX, UserPlus } from 'lucide-react';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';

export default function SuperAdminDashboard({ onLogout }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]); // State untuk akun aktif
  
  // State untuk form Tambah Akun Manual
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'users'), (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const allUsers = Object.keys(usersData).map(key => ({ uid: key, ...usersData[key] }));
        
        setPendingUsers(allUsers.filter(u => u.role === 'pending'));
        setActiveUsers(allUsers.filter(u => u.role === 'teacher')); // Filter akun yang sudah aktif
      } else {
        setPendingUsers([]);
        setActiveUsers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => { await signOut(auth); onLogout(); };

  const handleSelectiveDelete = async (path, label) => {
    const confirmation = window.prompt(`[ ZONA BERBAHAYA ]\nHapus permanen: ${label}\nKetik "HAPUS" (huruf kapital) untuk melanjutkan:`);
    if (confirmation === "HAPUS") {
      try { await remove(ref(db, path)); alert(`BERHASIL: Data ${label} telah dibersihkan.`); }
      catch (error) { alert(`GAGAL: ${error.message}`); }
    }
  };

  const handleApproval = (uid, action) => {
    if (action === 'approve') update(ref(db, `users/${uid}`), { role: 'teacher' });
    else if (action === 'reject' && window.confirm('Tolak dan hapus data permintaan ini?')) remove(ref(db, `users/${uid}`));
  };

  const handleDeleteActiveUser = (uid) => {
      if(window.confirm('PERINGATAN: Yakin ingin mencabut akses guru ini selamanya?')) {
          remove(ref(db, `users/${uid}`));
      }
  };

  const handleAddManualTeacher = async (e) => {
      e.preventDefault();
      try {
          // Buat akun langsung via Auth Firebase
          const userCredential = await createUserWithEmailAndPassword(auth, newEmail, newPassword);
          // Simpan ke database dengan role langsung 'teacher'
          await set(ref(db, `users/${userCredential.user.uid}`), { 
              email: newEmail, 
              nama: newName, 
              role: 'teacher', 
              timestamp: Date.now() 
          });
          alert("Akun pengawas berhasil dibuat dan langsung diaktifkan!");
          setShowAddForm(false);
          setNewEmail(''); setNewPassword(''); setNewName('');
      } catch (error) {
          alert(`Gagal menambahkan akun: ${error.message}`);
      }
  };

  return (
    <div className="min-h-screen bg-emerald-950 text-emerald-50 p-4 md:p-8 font-sans selection:bg-red-900 relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 md:w-96 md:h-96 bg-red-600/20 blur-[80px] md:blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 md:w-96 md:h-96 bg-emerald-600/20 blur-[80px] md:blur-[120px] rounded-full"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-emerald-800/50 pb-6 gap-4">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="p-3 md:p-4 bg-red-950/80 rounded-xl md:rounded-2xl border border-red-800/50 backdrop-blur-md">
              <ShieldAlert className="w-8 h-8 md:w-12 md:h-12 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">ROOT <span className="text-red-500">GATEWAY</span></h1>
              <p className="text-emerald-400/80 mt-0.5 md:mt-1 font-bold tracking-wide text-xs md:text-sm">Pusat Kendali Server CBT</p>
            </div>
          </div>
          {/* Teks tombol disconnect diperkecil di HP */}
          <button onClick={handleLogout} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-950/80 hover:bg-red-900 text-red-300 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl border border-red-800/50 transition-all shadow-lg font-bold backdrop-blur-md text-xs md:text-base">
            <LogOut size={18} /> DISCONNECT
          </button>
        </header>

        <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* PANEL KIRI: Manajemen Akun (Persetujuan & List Aktif) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Box 1: Tambah Akun Manual & List Aktif */}
              <div className="bg-gray-900/60 backdrop-blur-xl border border-emerald-800/50 rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden h-fit">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base md:text-lg font-bold flex items-center gap-2 text-white"><Users className="text-emerald-400" size={20}/> Akun Aktif</h2>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="bg-emerald-800/50 text-emerald-300 hover:bg-emerald-700/50 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-700/50 flex items-center gap-1 transition"><UserPlus size={14}/> Tambah</button>
                 </div>

                 {/* Form Tambah Manual */}
                 {showAddForm && (
                     <form onSubmit={handleAddManualTeacher} className="mb-5 bg-emerald-950/40 p-4 rounded-xl border border-emerald-800/50 space-y-3">
                         <input required type="text" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nama Guru" className="w-full bg-gray-900/80 border border-emerald-900/50 p-2 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"/>
                         <input required type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email Login" className="w-full bg-gray-900/80 border border-emerald-900/50 p-2 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"/>
                         <input required type="password" minLength="6" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Password (Min 6 kar)" className="w-full bg-gray-900/80 border border-emerald-900/50 p-2 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"/>
                         <div className="flex gap-2 pt-2">
                            <button type="button" onClick={()=>setShowAddForm(false)} className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg text-xs font-bold">Batal</button>
                            <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">Simpan Guru</button>
                         </div>
                     </form>
                 )}

                 {/* List Akun Aktif */}
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                     {activeUsers.length === 0 ? (
                         <p className="text-xs text-center text-emerald-700/50 py-4">Belum ada guru yang aktif.</p>
                     ) : (
                        activeUsers.map(user => (
                            <div key={user.uid} className="flex justify-between items-center bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/30">
                                <div>
                                    <p className="text-sm font-bold text-emerald-100">{user.nama}</p>
                                    <p className="text-xs text-emerald-500/70">{user.email}</p>
                                </div>
                                <button onClick={() => handleDeleteActiveUser(user.uid)} className="p-2 text-red-500 hover:bg-red-950/50 rounded-lg transition"><Trash2 size={16}/></button>
                            </div>
                        ))
                     )}
                 </div>
              </div>

              {/* Box 2: Antrean Pendaftaran (Pending) */}
              <div className="bg-gray-900/60 backdrop-blur-xl border border-emerald-800/50 rounded-2xl p-5 md:p-6 shadow-2xl relative overflow-hidden h-fit">
                <h2 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 text-white">
                  <CheckCircle className="text-amber-400" size={20}/> Antrean Pendaftaran
                </h2>
                {pendingUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-emerald-700/50 bg-emerald-950/30 rounded-xl border border-emerald-900/50 border-dashed">
                    <Users className="w-8 h-8 mb-2 opacity-40" /><p className="text-xs font-bold">Tidak ada antrean pendaftaran</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {pendingUsers.map(user => (
                      <div key={user.uid} className="bg-emerald-950/50 p-4 rounded-xl border border-amber-800/30 shadow-inner">
                        <h3 className="font-bold text-white text-sm">{user.nama}</h3>
                        <p className="text-xs text-emerald-400/80 mb-3">{user.email}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproval(user.uid, 'approve')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold transition flex justify-center items-center gap-1.5"><UserCheck size={14}/> Setujui</button>
                          <button onClick={() => handleApproval(user.uid, 'reject')} className="flex-1 bg-red-950 hover:bg-red-900 text-red-300 py-1.5 rounded-lg text-xs font-bold transition flex justify-center items-center gap-1.5 border border-red-900/50"><UserX size={14}/> Tolak</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          {/* PANEL KANAN: Manajemen Database Reset */}
          <div className="lg:col-span-7 bg-gray-900/60 backdrop-blur-xl border border-emerald-800/50 rounded-2xl p-5 md:p-8 shadow-2xl relative overflow-hidden h-fit">
            <h2 className="text-xl md:text-2xl font-black mb-1 md:mb-2 text-red-400 flex items-center gap-2 md:gap-3"><Database className="w-5 h-5 md:w-7 md:h-7" /> Wipe Server</h2>
            <p className="text-xs md:text-sm text-emerald-500/70 mb-6 font-bold">PERINGATAN: Tindakan destruktif (tanpa backup).</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">
              <div className="bg-emerald-950/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-emerald-900 flex flex-col justify-between gap-3">
                <div><h3 className="font-bold text-sm md:text-base text-emerald-100 mb-0.5">Live Students</h3><p className="text-[10px] md:text-xs text-emerald-600">Siswa yg sedang/selesai ujian</p></div>
                <button onClick={() => handleSelectiveDelete('live_students', 'Data Live Students')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2 rounded-lg text-xs md:text-sm font-bold border border-red-900 transition">Eksekusi</button>
              </div>
              <div className="bg-emerald-950/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-emerald-900 flex flex-col justify-between gap-3">
                <div><h3 className="font-bold text-sm md:text-base text-emerald-100 mb-0.5">Leaderboard</h3><p className="text-[10px] md:text-xs text-emerald-600">Rekap nilai akhir</p></div>
                <button onClick={() => handleSelectiveDelete('leaderboard', 'Data Leaderboard')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2 rounded-lg text-xs md:text-sm font-bold border border-red-900 transition">Eksekusi</button>
              </div>
              <div className="bg-emerald-950/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-emerald-900 flex flex-col justify-between gap-3">
                <div><h3 className="font-bold text-sm md:text-base text-emerald-100 mb-0.5">Bank Soal</h3><p className="text-[10px] md:text-xs text-emerald-600">Kumpulan soal ujian</p></div>
                <button onClick={() => handleSelectiveDelete('bank_soal', 'Bank Soal Utama')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2 rounded-lg text-xs md:text-sm font-bold border border-red-900 transition">Eksekusi</button>
              </div>
              <div className="bg-emerald-950/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-emerald-900 flex flex-col justify-between gap-3">
                <div><h3 className="font-bold text-sm md:text-base text-emerald-100 mb-0.5">Sesi Token</h3><p className="text-[10px] md:text-xs text-emerald-600">Token yg dibuat pengawas</p></div>
                <button onClick={() => handleSelectiveDelete('active_sessions', 'Riwayat Sesi')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2 rounded-lg text-xs md:text-sm font-bold border border-red-900 transition">Eksekusi</button>
              </div>
            </div>

            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-emerald-900/50">
              <button onClick={() => handleSelectiveDelete('/', 'SELURUH ROOT DATABASE')} className="w-full bg-red-600/90 hover:bg-red-600 text-white py-3 md:py-4 rounded-xl font-black text-sm md:text-lg tracking-[0.1em] md:tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)] transition border border-red-500">
                  <Trash2 size={20} className="md:w-6 md:h-6"/> FORMAT SERVER <Trash2 size={20} className="md:w-6 md:h-6"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
