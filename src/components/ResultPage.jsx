import React, { useEffect, useState } from 'react';
import { Award, LogOut, RefreshCcw } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export default function ResultPage({ score, studentSession, onLogout }) {
  const [realtimeRank, setRealtimeRank] = useState({ rank: '...', total: '...' });

  // Listener Real-Time ke Leaderboard
  useEffect(() => {
    if (!studentSession) return;
    
    const lbRef = ref(db, 'leaderboard');
    const unsubscribe = onValue(lbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Urutkan nilai tertinggi ke terendah
        const allScores = Object.values(data).sort((a, b) => b.score - a.score);
        const totalStudents = allScores.length;
        
        // Cari posisi anak ini berdasarkan Nama dan Kelas
        const myIndex = allScores.findIndex(s => s.name === studentSession.studentName && s.class === studentSession.studentClass);
        
        if (myIndex !== -1) {
          setRealtimeRank({
            rank: myIndex + 1,
            total: totalStudents
          });
        }
      }
    });

    return () => unsubscribe();
  }, [studentSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-blue-600">
        <Award className="w-24 h-24 mx-auto text-yellow-500 mb-4 drop-shadow-lg" />
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Ujian Selesai!</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">Kerja bagus, jawaban Anda telah diamankan.</p>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 mb-8 border border-gray-200 dark:border-gray-600">
          <div className="text-6xl font-black text-blue-600 dark:text-blue-400 mb-2">
            {score}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-6">
            Nilai Akhir
          </p>
          
          <div className="pt-4 border-t border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2">
            <RefreshCcw size={16} className="text-green-500 animate-spin-slow" />
            <p className="text-lg text-gray-800 dark:text-gray-200 font-medium">
              Peringkat Live: <span className="font-bold text-yellow-600 dark:text-yellow-400 text-xl">{realtimeRank.rank}</span> / {realtimeRank.total}
            </p>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 py-3.5 rounded-lg font-bold transition shadow-lg"
        >
          <LogOut size={20} /> Keluar & Kembali ke Dasbor
        </button>
      </div>
    </div>
  );
}