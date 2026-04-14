import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { Timer, AlertTriangle, Book, ChevronLeft, ChevronRight } from 'lucide-react';
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
        
        // Soal dipukul rata untuk 1 tingkat/kelas (Sub Kelas/Ruang diabaikan)
        const filtered = allQ.filter(q => 
          q.mapel === studentData.mapel && 
          q.kelas === studentData.class && 
          q.teacherEmail === studentData.teacherEmail
        );
        setQuestions(filtered);
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

  if (isLocked) return <div className="h-screen flex items-center justify-center bg-red-50 text-red-700 font-bold text-2xl p-4 text-center">UJIAN TERKUNCI!<br/><span className="text-sm mt-2 font-normal">Anda terlalu sering pindah tab.</span></div>;
  if (questions.length === 0) return <div className="h-screen flex flex-col items-center justify-center p-6 text-center text-gray-500"><Book size={60} className="mb-4 opacity-50"/><h1 className="text-xl font-bold text-slate-700">Soal Belum Tersedia</h1><p className="text-sm mt-2">Menunggu guru mengunggah soal untuk Tingkat {studentData.class}</p></div>;

  const q = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans pb-24">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-4 gap-3 border border-gray-100">
        <div className="text-center sm:text-left">
          <p className="font-bold text-slate-800 text-lg">{studentData.name}</p>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mt-1 inline-block">{studentData.class}-{studentData.subKelas} • {studentData.mapel}</span>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 px-4 py-2.5 rounded-xl text-orange-600 font-mono font-black text-lg w-full sm:w-auto justify-center"><Timer size={20} />{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</div>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-5 md:p-8 rounded-3xl shadow-sm mb-6 border border-gray-100">
        <span className="text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-md">Soal No. {currentIndex+1} / {questions.length}</span>
        <p className="text-lg md:text-xl font-semibold my-6 text-slate-800 leading-relaxed"><Latex>{q.pertanyaan}</Latex></p>
        
        <div className="space-y-3">{['A','B','C','D'].map(opt => (
          <button key={opt} onClick={() => handleSelect(q.id, opt)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${answers[q.id]===opt ? 'bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-500/10 text-emerald-900 font-bold':'bg-gray-50 border-gray-100 hover:border-emerald-200'}`}>
            <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black ${answers[q.id]===opt?'bg-emerald-500 text-white':'bg-white text-gray-400 border border-gray-200'}`}>{opt}</span>
            <span className="flex-1"><Latex>{q[`opsi${opt}`]}</Latex></span>
          </button>
        ))}</div>
      </div>

      <div className="max-w-3xl mx-auto flex flex-wrap gap-2 md:gap-4">
        <button disabled={currentIndex===0} onClick={() => setCurrentIndex(currentIndex-1)} className="flex-1 min-w-[120px] p-4 bg-white border border-gray-200 text-slate-600 rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"><ChevronLeft size={20}/> KEMBALI</button>
        <button disabled={currentIndex===questions.length-1} onClick={() => setCurrentIndex(currentIndex+1)} className="flex-1 min-w-[120px] p-4 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">LANJUT <ChevronRight size={20}/></button>
        <button onClick={() => window.confirm("Yakin kumpul?") && submitExam()} className="w-full sm:w-auto p-4 bg-slate-900 text-white rounded-2xl font-black flex-1 sm:flex-none sm:px-8 mt-2 sm:mt-0 shadow-xl active:scale-95">KUMPUL</button>
      </div>
    </div>
  );
}
