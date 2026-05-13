// src/pages/student/ResultPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase'; // Jalur database V3
import { ref, onValue } from 'firebase/database';
import { CheckCircle, Trophy, Home, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ResultPage({ score: propScore, studentData: propStudentData, onLogout }) {
  const navigate = useNavigate();
  
  // Cerdas: Jika props kosong (karena Router), tarik dari LocalStorage
  const [studentData, setStudentData] = useState(() => propStudentData || JSON.parse(localStorage.getItem('studentData')) || {});
  const [score, setScore] = useState(propScore !== undefined ? propScore : null);
  
  const [rank, setRank] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentData?.name) return;

    // Tembak ke Root Database V2
    const leadRef = ref(db, 'leaderboard');
    const unsub = onValue(leadRef, (snapshot) => {
      setIsLoading(false);
      if (snapshot.val()) {
        const allData = Object.values(snapshot.val());
        
        // 1. Cari skor siswa (Jika router gagal melempar props)
        let currentScore = score;
        if (currentScore === null) {
           // Cari berdasarkan Nama dan Token di Leaderboard
           const myData = allData.find(s => s.name === studentData.name && s.token === studentData.token && s.class === studentData.class);
           if (myData) {
               currentScore = myData.score;
               setScore(currentScore);
           }
        }

        // 2. Kalkulasi Peringkat Kelas Real-time
        const classmates = allData.filter(s => s.mapel === studentData?.mapel && s.class === studentData?.class && s.subKelas === studentData?.subKelas && s.token === studentData?.token);
        
        // Urutkan dari nilai tertinggi ke terendah
        classmates.sort((a, b) => b.score - a.score);
        setTotalStudents(classmates.length);
        
        // Cari indeks peringkat siswa ini
        const myIndex = classmates.findIndex(s => s.name === studentData?.name && s.score === currentScore);
        if (myIndex !== -1) setRank(myIndex + 1);
      }
    });

    return () => unsub();
  }, [studentData, score]);

  const handleExit = () => {
     if (onLogout) {
         onLogout();
     } else {
         // Bersihkan memori dan kembali ke halaman Login Utama
         localStorage.removeItem('studentData');
         navigate('/login');
     }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2rem] shadow-xl w-full max-w-md text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in duration-500">
        
        <div className="flex justify-center mb-6 relative">
           <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
           <CheckCircle size={80} className="text-emerald-500 relative z-10" />
        </div>
        
        <h1 className="text-3xl font-black mb-2 text-slate-800 dark:text-white tracking-tight">Ujian Selesai!</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 font-bold text-lg">{studentData?.name || 'Siswa'}</p>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 py-8 rounded-3xl mb-8 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">SKOR AKHIR ANDA</p>
          <div className="text-7xl font-black text-emerald-500 tracking-tighter">
             {score !== null ? score : '...'}
          </div>
        </div>
        
        {rank !== null && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-900/50 p-5 rounded-2xl mb-8 flex items-center justify-center gap-4 text-orange-700 dark:text-orange-500 shadow-sm">
            <Trophy size={32} className="animate-bounce" />
            <div className="text-left">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Peringkat Kelas</p>
               <p className="text-lg font-black tracking-wide">Juara {rank} dari {totalStudents}</p>
            </div>
          </div>
        )}
        
        <button onClick={handleExit} className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all tracking-widest text-sm">
           <LogOut size={20}/> KELUAR & KEMBALI
        </button>
      </div>
    </div>
  );
}