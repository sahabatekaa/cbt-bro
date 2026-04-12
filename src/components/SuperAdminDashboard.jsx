import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from 'firebase/database';
import { ShieldAlert, Database, UserPlus, Trash, CheckCircle } from 'lucide-react';

export default function SuperAdminDashboard({ onLogout }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Tarik daftar semua guru dari database
    onValue(ref(db, 'users'), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setUsers(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setUsers([]);
      }
    });
  }, []);

  // Fungsi untuk Menyetujui Akun Guru Baru
  const handleApproveTeacher = (userId) => {
    update(ref(db, `users/${userId}`), { status: 'approved' });
    alert("Akun guru berhasil disetujui dan diaktifkan!");
  };

  const secureAction = (path, msg) => {
    const confirm = window.prompt(`Ketik "HAPUS" untuk mengonfirmasi pembersihan ${msg}`);
    if (confirm === "HAPUS") {
      remove(ref(db, path));
      alert(`${msg} berhasil dibersihkan!`);
    } else { alert("Aksi dibatalkan. Kata kunci salah."); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-emerald-900/50 pb-6 gap-4">
        <div className="flex items-center gap-4">
          <ShieldAlert size={40} className="text-emerald-500" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-emerald-400">SuperAdmin <span className="text-white">Terminal</span></h1>
            <p className="text-sm text-gray-400">Otoritas Tertinggi Sistem CBT</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl font-bold transition-colors">LOGOUT SYSTEM</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL 1: Persetujuan Akun Guru */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-400"><UserPlus /> Persetujuan Akun Guru</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-slate-500 uppercase text-xs font-bold border-b border-slate-800">
                <tr><th className="p-3">Nama / Email</th><th className="p-3">Status</th><th className="p-3 text-right">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-white">{u.name || 'Tanpa Nama'}</p>
                      <p className="text-sm text-slate-400">{u.email}</p>
                    </td>
                    <td className="p-3">
                      {u.status === 'pending' ? (
                        <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Menunggu</span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">Aktif</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {u.status === 'pending' && (
                        <button onClick={() => handleApproveTeacher(u.id)} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 ml-auto hover:bg-emerald-500">
                          <CheckCircle size={16}/> Setujui
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="3" className="p-6 text-center text-slate-500">Belum ada akun guru terdaftar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL 2: Database Management (Master Reset) */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-red-900/30 shadow-xl h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-500"><Database /> Manajemen Server Database</h2>
          <div className="space-y-3">
            <button onClick={() => secureAction('live_students', 'Data Live Siswa')} className="w-full flex justify-between items-center p-4 bg-slate-950 hover:bg-red-900/40 rounded-xl transition-all border border-slate-800 font-semibold text-gray-300">
              <span>Bersihkan Data Ujian Siswa (Live)</span><Trash size={18} className="text-red-500" />
            </button>
            <button onClick={() => secureAction('leaderboard', 'Rekap Nilai')} className="w-full flex justify-between items-center p-4 bg-slate-950 hover:bg-red-900/40 rounded-xl transition-all border border-slate-800 font-semibold text-gray-300">
              <span>Bersihkan Tabel Rekap Nilai</span><Trash size={18} className="text-red-500" />
            </button>
            <button onClick={() => secureAction('bank_soal', 'Bank Soal')} className="w-full flex justify-between items-center p-4 bg-slate-950 hover:bg-red-900/40 rounded-xl transition-all border border-slate-800 font-semibold text-gray-300">
              <span>Hapus Semua Bank Soal</span><Trash size={18} className="text-red-500" />
            </button>
            <div className="pt-8">
              <button onClick={() => secureAction('/', 'SELURUH DATABASE')} className="w-full p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-center shadow-lg shadow-red-900/20 tracking-widest">
                DANGER: MASTER RESET DATABASE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}