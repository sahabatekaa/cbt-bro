import React, { useEffect, useState } from 'react';
import { Award, LogOut, RefreshCcw } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export default function ResultPage({ score, studentSession, onLogout }) {
  const [realtimeRank, setRealtimeRank] = useState({ rank: '...', total: '...' });

  useEffect(() => {
    if (!studentSession) return;
    const unsubscribe = onValue(ref(db, 'leaderboard'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const allScores = Object.keys(data).map(key => data[key]);
        
        // PERBAIKAN: Hanya hitung peringkat dengan anak di Mapel & Kelas yang sama
        const sessionScores = allScores
            .filter(s => s.mapel === studentSession.mapel && s.class === studentSession.studentClass)
            .sort((a, b) => b.score - a.score);

        const myIndex = sessionScores.findIndex(s => s.name === studentSession.studentName);
        if (myIndex !== -1) setRealtimeRank({ rank: myIndex + 1, total: sessionScores.length });
      }
    });
    return () => unsubscribe();
  }, [studentSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 p-4">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-[0_8px_40px_rgba(16,185,129,0.15)] max-w-md w-full text-center border border-white/60 dark:border-emerald-800/50">
        <div className="w-24 h-24 md:w-28 md:h-28 mx-auto bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.5)] mb-4 md:mb-6">
          <Award className="w-12 h-12 md:w-14 md:h-14 text-amber-900" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-emerald-900 dark:text-emerald-100 mb-2 tracking-wide">Alhamdulillah!</h1>
        <p className="text-sm md:text-base text-emerald-700/80 dark:text-emerald-400 font-medium mb-6 md:mb-8">Ujian <span className="font-bold text-emerald-800 dark:text-emerald-300">{studentSession?.mapel}</span> selesai, jawaban tersimpan.</p>
        
        <div className="bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-900/40 dark:to-green-900/20 rounded-2xl md:rounded-3xl p-6 md:p-8 mb-6 md:mb-8 border border-emerald-100 dark:border-emerald-800/50 shadow-inner">
          <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-500 mb-1 md:mb-2 drop-shadow-sm">{score}</div>
          <p className="text-xs md:text-sm text-emerald-600/70 dark:text-emerald-500 font-black uppercase tracking-[0.3em] mb-4 md:mb-6">Nilai Akhir</p>
          
          <div className="pt-4 md:pt-5 border-t border-emerald-200/50 dark:border-emerald-800/50 flex items-center justify-center gap-2 md:gap-3">
            <RefreshCcw size={16} className="text-emerald-500 animate-spin-slow md:w-5 md:h-5" />
            <p className="text-base md:text-lg text-emerald-900 dark:text-emerald-200 font-bold">Peringkat: <span className="font-black text-amber-500 text-xl md:text-2xl ml-1">{realtimeRank.rank}</span> / {realtimeRank.total}</p>
          </div>
        </div>

        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 md:gap-3 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white py-3 md:py-4 rounded-xl font-black transition shadow-lg shadow-emerald-600/30 transform hover:-translate-y-1 text-sm md:text-base">
          <LogOut size={18} className="md:w-5 md:h-5" /> KELUAR SISTEM
        </button>
      </div>
    </div>
  );
}
