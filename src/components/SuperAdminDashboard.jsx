import React, { useState, useEffect } from 'react';
import { ref, remove, onValue, update } from 'firebase/database';
import { db, auth } from '../firebase';
import { ShieldAlert, Trash2, LogOut, CheckCircle, Database, Users, UserCheck, UserX } from 'lucide-react';
import { signOut } from 'firebase/auth';

export default function SuperAdminDashboard({ onLogout }) {
  const [pendingUsers, setPendingUsers] = useState([]);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'users'), (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        setPendingUsers(Object.keys(usersData).map(key => ({ uid: key, ...usersData[key] })).filter(u => u.role === 'pending'));
      } else setPendingUsers([]);
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

  return (
    <div className="min-h-screen bg-emerald-950 text-emerald-50 p-8 font-sans selection:bg-red-900 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600/20 blur-[120px] rounded-full"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-10 border-b border-emerald-800/50 pb-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-red-950/80 rounded-2xl border border-red-800/50 backdrop-blur-md">
              <ShieldAlert className="w-12 h-12 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">ROOT <span className="text-red-500">GATEWAY</span></h1>
              <p className="text-emerald-400/80 mt-1 font-bold tracking-wide text-sm">Pusat Kendali Server CBT</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-red-950/80 hover:bg-red-900 text-red-300 px-6 py-3 rounded-xl border border-red-800/50 transition-all shadow-lg font-bold backdrop-blur-md"><LogOut size={20} /> FORCE DISCONNECT</button>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 bg-gray-900/60 backdrop-blur-xl border border-emerald-800/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden h-fit">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white"><CheckCircle className="text-emerald-400" /> Antrean Akun Pengawas</h2>
            {pendingUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-emerald-700/50 bg-emerald-950/30 rounded-2xl border border-emerald-900/50 border-dashed">
                <Users className="w-12 h-12 mb-3 opacity-40" /><p className="text-sm font-bold">Tidak ada antrean pendaftaran</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map(user => (
                  <div key={user.uid} className="bg-emerald-950/50 p-5 rounded-2xl border border-emerald-800/50 shadow-inner">
                    <h3 className="font-bold text-white text-lg">{user.nama}</h3>
                    <p className="text-sm text-emerald-400/80 mb-4">{user.email}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproval(user.uid, 'approve')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-sm font-bold transition flex justify-center items-center gap-2"><UserCheck size={16}/> Setujui</button>
                      <button onClick={() => handleApproval(user.uid, 'reject')} className="flex-1 bg-red-950 hover:bg-red-900 text-red-300 py-2 rounded-xl text-sm font-bold transition flex justify-center items-center gap-2 border border-red-900/50"><UserX size={16}/> Tolak</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-gray-900/60 backdrop-blur-xl border border-emerald-800/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <h2 className="text-2xl font-black mb-2 text-red-400 flex items-center gap-3"><Database className="w-7 h-7" /> Server Database Management</h2>
            <p className="text-sm text-emerald-500/70 mb-8 font-bold">PERINGATAN: Tindakan di panel ini bersifat destruktif (tanpa backup).</p>
            
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-emerald-950/40 p-6 rounded-2xl border border-emerald-900 hover:border-red-900/50 transition-colors flex flex-col justify-between items-start gap-4">
                <div><h3 className="font-bold text-lg text-emerald-100 mb-1">Live Students</h3><p className="text-xs text-emerald-600">Siswa yg sedang/selesai ujian</p></div>
                <button onClick={() => handleSelectiveDelete('live_students', 'Data Live Students')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-red-900">Eksekusi</button>
              </div>
              <div className="bg-emerald-950/40 p-6 rounded-2xl border border-emerald-900 hover:border-red-900/50 transition-colors flex flex-col justify-between items-start gap-4">
                <div><h3 className="font-bold text-lg text-emerald-100 mb-1">Leaderboard</h3><p className="text-xs text-emerald-600">Rekap nilai akhir</p></div>
                <button onClick={() => handleSelectiveDelete('leaderboard', 'Data Leaderboard')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-red-900">Eksekusi</button>
              </div>
              <div className="bg-emerald-950/40 p-6 rounded-2xl border border-emerald-900 hover:border-red-900/50 transition-colors flex flex-col justify-between items-start gap-4">
                <div><h3 className="font-bold text-lg text-emerald-100 mb-1">Bank Soal Master</h3><p className="text-xs text-emerald-600">Kumpulan soal ujian</p></div>
                <button onClick={() => handleSelectiveDelete('bank_soal', 'Bank Soal Utama')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-red-900">Eksekusi</button>
              </div>
              <div className="bg-emerald-950/40 p-6 rounded-2xl border border-emerald-900 hover:border-red-900/50 transition-colors flex flex-col justify-between items-start gap-4">
                <div><h3 className="font-bold text-lg text-emerald-100 mb-1">Riwayat Sesi Ujian</h3><p className="text-xs text-emerald-600">Token yg dibuat pengawas</p></div>
                <button onClick={() => handleSelectiveDelete('active_sessions', 'Riwayat Sesi')} className="w-full bg-red-950 hover:bg-red-600 text-red-300 hover:text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-red-900">Eksekusi</button>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-emerald-900/50">
              <button onClick={() => handleSelectiveDelete('/', 'SELURUH ROOT DATABASE')} className="w-full bg-red-600/90 hover:bg-red-600 text-white py-4 rounded-2xl font-black text-lg tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all hover:scale-[1.01] border border-red-500"><Trash2 size={24}/> FORMAT KESELURUHAN SERVER <Trash2 size={24}/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}