// src/pages/student/ResultPage.jsx
import React, { useState, useEffect } from 'react';
import { db, getTenantPath } from '../../config/firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Trophy, Home, PartyPopper } from 'lucide-react';

export default function ResultPage({ score, onLogout }) {
  const { userData, tenantData } = useAuth();
  const schoolId = userData?.schoolId;
  const [rank, setRank] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if (!schoolId || !userData) return;

    // Tarik leaderboard hanya milik sekolah ini
    const leaderboardRef = ref(db, getTenantPath(schoolId, 'leaderboard'));
    
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
      if (snapshot.exists()) {
        const allResults = Object.values(snapshot.val());
        
        // Filter teman satu kelas di sekolah yang sama
        const classmates = allResults.filter(s => 
          s.mapel === userData.mapel && 
          s.class === userData.class
        );

        // Urutkan dari skor tertinggi
        classmates.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        setTotalStudents(classmates.length);

        // Cari posisi peringkat siswa ini
        const myIndex = classmates.findIndex(s => 
          s.name === userData.name && 
          s.score === score
        );

        if (myIndex !== -1) {
          setRank(myIndex + 1);
        }
      }
    });

    return () => unsubscribe();
  }, [schoolId, userData, score]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50 dark:bg-slate-950 p-4 transition-colors duration-500">
      <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center border border-emerald-100 dark:border-slate-800 animate-in fade-in zoom-in duration-500">
        
        {score >= 70 ? (
          <div className="relative">
            <PartyPopper size={80} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
            <div className="absolute -top-2 -right-2 bg-yellow-400 text-[10px] font-black px-2 py-1 rounded-full shadow-sm">LULUS</div>
          </div>
        ) : (
          <CheckCircle size={80} className="text-blue-500 mx-auto mb-4" />
        )}

        <h1 className="text-2xl font-black mb-1 text-slate-800 dark:text-white uppercase tracking-tighter">Hasil Ujian</h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold mb-8 uppercase text-xs tracking-widest italic border-b pb-4 border-slate-100 dark:border-slate-800">
          {userData?.name}
        </p>

        <div className="bg-slate-50 dark:bg-slate-950/50 py-8 rounded-[2rem] mb-8 border border-slate-100 dark:border-slate-800 shadow-inner">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-[0.2em]">Skor Akhir</p>
          <div className="text-7xl font-black text-emerald-500 dark:text-emerald-400 drop-shadow-sm">{score}</div>
        </div>

        {rank !== null && totalStudents > 1 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 p-5 rounded-2xl mb-8 flex items-center justify-center gap-4 text-orange-700 dark:text-orange-400 animate-pulse">
            <Trophy size={32} className="shrink-0" />
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Peringkat Kelas</p>
              <p className="font-black text-lg leading-none mt-1">Ke-{rank} <span className="text-xs font-medium opacity-60">dari {totalStudents} Siswa</span></p>
            </div>
          </div>
        )}

        <div className="space-y-3">
            <p className="text-[10px] text-slate-400 font-medium mb-4 italic">
                Data ini telah tercatat secara resmi di server <br/> {tenantData?.schoolName || 'Institusi'}.
            </p>
            <button 
                onClick={onLogout} 
                className="w-full bg-slate-900 dark:bg-emerald-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-slate-900/20 dark:shadow-emerald-900/20 tracking-widest uppercase text-sm"
            >
                <Home size={20}/> Kembali ke Beranda
            </button>
        </div>
      </div>
    </div>
  );
}