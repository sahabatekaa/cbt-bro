import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { CheckCircle, Trophy, Home } from 'lucide-react';

export default function ResultPage({ score, studentData, onLogout }) {
  const [rank, setRank] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    onValue(ref(db, 'leaderboard'), (snapshot) => {
      if (snapshot.val()) {
        const classmates = Object.values(snapshot.val()).filter(s => s.mapel === studentData?.mapel && s.class === studentData?.class && s.subKelas === studentData?.subKelas);
        classmates.sort((a, b) => b.score - a.score);
        setTotalStudents(classmates.length);
        const myIndex = classmates.findIndex(s => s.name === studentData?.name && s.score === score);
        if (myIndex !== -1) setRank(myIndex + 1);
      }
    });
  }, [studentData, score]);

  return (
    <div className="h-screen flex items-center justify-center bg-emerald-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center">
        <CheckCircle size={60} className="text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black mb-1">Ujian Selesai!</h1>
        <p className="text-gray-500 mb-6">{studentData?.name}</p>
        <div className="bg-gray-50 py-6 rounded-2xl mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Skor Anda</p>
          <div className="text-6xl font-black text-emerald-500">{score}</div>
        </div>
        {rank !== null && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl mb-6 flex items-center justify-center gap-3 text-orange-700">
            <Trophy size={24}/>
            <div className="text-left"><p className="text-xs font-bold">Peringkat Kelas</p><p className="font-bold">Juara {rank} dari {totalStudents}</p></div>
          </div>
        )}
        <button onClick={onLogout} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"><Home size={20}/> Beranda</button>
      </div>
    </div>
  );
}
