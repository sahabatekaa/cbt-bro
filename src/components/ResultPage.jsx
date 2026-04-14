import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { CheckCircle, Trophy, Home } from 'lucide-react';

export default function ResultPage({ score, studentData, onLogout }) {
  const [rank, setRank] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    // Tarik data seluruh siswa untuk mencari peringkat
    const leadRef = ref(db, 'leaderboard');
    onValue(leadRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // 1. Ambil semua nilai
        const allResults = Object.values(data);
        
        // 2. Saring hanya teman yang satu Mapel, satu Kelas, dan satu Sub-Kelas
        const myClassmates = allResults.filter(s => 
          s.mapel === studentData?.mapel && 
          s.class === studentData?.class &&
          s.subKelas === studentData?.subKelas
        );

        // 3. Urutkan dari nilai tertinggi ke terendah
        myClassmates.sort((a, b) => b.score - a.score);
        
        // 4. Cari posisi nama siswa ini ada di urutan ke berapa
        // (Menggunakan timestamp agar spesifik jika ada nama yang sama)
        const myIndex = myClassmates.findIndex(s => s.name === studentData?.name && s.score === score);
        
        setTotalStudents(myClassmates.length);
        if (myIndex !== -1) setRank(myIndex + 1);
      }
    });
  }, [studentData, score]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-50 p-4 font-sans">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-emerald-100">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={50} className="text-emerald-500" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-800 mb-2">Ujian Selesai!</h1>
        <p className="text-slate-500 font-medium mb-8">Kerja bagus, <span className="font-bold text-emerald-700">{studentData?.name}</span>!</p>

        <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Skor Akhir Anda</p>
          <div className="text-7xl font-black text-emerald-500">{score}</div>
        </div>

        {/* FITUR PERINGKAT (RANKING) */}
        {rank !== null && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl mb-8 flex items-center justify-center gap-3 text-orange-700">
            <Trophy size={24} className="text-orange-500" />
            <div className="text-left">
              <p className="text-xs font-bold uppercase opacity-80">Peringkat Kelas {studentData?.class}-{studentData?.subKelas}</p>
              <p className="text-lg font-black">Juara {rank} <span className="text-sm font-medium text-orange-600/80">dari {totalStudents} Siswa</span></p>
            </div>
          </div>
        )}

        <button 
          onClick={onLogout}
          className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Home size={20} /> Kembali ke Beranda
        </button>
      </div>
    </div>
  );
}
