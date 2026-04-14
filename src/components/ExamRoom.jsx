import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { Timer, AlertTriangle, Book } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function ExamRoom({ studentData, onFinish }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(3600); 
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    onValue(ref(db, 'bank_soal'), (snap) => {
      if (snap.val()) {
        const allQ = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setQuestions(allQ.filter(q => q.mapel === studentData.mapel && q.kelas === studentData.class && q.teacherEmail === studentData.teacherEmail));
      }
    });
    
    let w = 0;
    const hide = () => { if(document.hidden && !isLocked) { w++; update(ref(db, `live_students/${studentData.id}`), { warnings: w, status: 'Pindah Tab' }); if(w>=3) setIsLocked(true); alert(`Peringatan ${w}/3!`); } };
    document.addEventListener("visibilitychange", hide); return () => document.removeEventListener("visibilitychange", hide);
  }, [studentData, isLocked]);

  useEffect(() => {
    if (timeLeft > 0 && !isLocked && questions.length > 0) { const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); return () => clearTimeout(t); } 
    else if (timeLeft === 0 && questions.length > 0) submitExam();
  }, [timeLeft, isLocked, questions]);

  const handleSelect = (qId, opt) => {
    const newAns = { ...answers, [qId]: opt }; setAnswers(newAns);
    update(ref(db, `live_students/${studentData.id}`), { progress: Math.round((Object.keys(newAns).length / questions.length) * 100) });
  };

  const submitExam = async () => {
    let correct = 0; questions.forEach(q => { if (answers[q.id] === q.kunci) correct++; });
    const score = Math.round((correct / questions.length) * 100);
    await push(ref(db, 'leaderboard'), { ...studentData, score, timestamp: Date.now() });
    await update(ref(db, `live_students/${studentData.id}`), { status: 'Selesai' });
    onFinish(score);
  };

  if (isLocked) return <div className="h-screen flex items-center justify-center bg-red-50 text-red-700 font-bold text-2xl">UJIAN TERKUNCI!</div>;
  if (questions.length === 0) return <div className="h-screen flex flex-col items-center justify-center p-4 text-center"><Book size={48}/><h1 className="text-xl font-bold mt-4">Soal Belum Tersedia</h1></div>;

  const q = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <div className="max-w-3xl mx-auto flex justify-between bg-white p-4 rounded-xl shadow-sm mb-4"><span className="font-bold">{studentData.name} ({studentData.class}-{studentData.subKelas})</span><span className="font-bold text-red-500">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</span></div>
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm mb-4">
        <span className="text-xs font-bold bg-emerald-100 px-2 py-1 rounded">No. {currentIndex+1}</span>
        <p className="text-lg font-bold my-4"><Latex>{q.pertanyaan}</Latex></p>
        <div className="space-y-2">{['A','B','C','D'].map(opt => (
          <button key={opt} onClick={() => handleSelect(q.id, opt)} className={`w-full text-left p-3 rounded-lg border ${answers[q.id]===opt ? 'bg-emerald-50 border-emerald-500 font-bold':'bg-gray-50'}`}><Latex>{`${opt}. ${q[`opsi${opt}`]}`}</Latex></button>
        ))}</div>
      </div>
      <div className="max-w-3xl mx-auto flex gap-2">
        <button disabled={currentIndex===0} onClick={() => setCurrentIndex(currentIndex-1)} className="flex-1 p-3 bg-gray-200 rounded-lg font-bold disabled:opacity-50">KEMBALI</button>
        <button disabled={currentIndex===questions.length-1} onClick={() => setCurrentIndex(currentIndex+1)} className="flex-1 p-3 bg-blue-100 text-blue-700 rounded-lg font-bold disabled:opacity-50">LANJUT</button>
        <button onClick={() => window.confirm("Yakin kumpul?") && submitExam()} className="flex-1 p-3 bg-emerald-600 text-white rounded-lg font-bold">KUMPUL</button>
      </div>
    </div>
  );
}
