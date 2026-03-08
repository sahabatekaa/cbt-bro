import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, push } from 'firebase/database';
import { db } from '../firebase';
import { AlertTriangle, Clock, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

export default function ExamRoom({ studentData, onFinish }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [doubtful, setDoubtful] = useState({});
  const [warnings, setWarnings] = useState(studentData?.warnings || 0);
  const [isLocked, setIsLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); 
  
  // State untuk menampilkan Pop-Up Kumpul Ujian
  const [showFinishModal, setShowFinishModal] = useState(false);
  
  // Referensi penanda agar sensor anti-cheat dimatikan saat transisi selesai ujian
  const isFinishingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'bank_soal'), (snapshot) => {
      if (snapshot.exists()) setQuestions(Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) { handleFinishExam(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // ANTI CHEAT GANDA (PINDAH TAB & KELUAR FULLSCREEN)
  useEffect(() => {
    const triggerWarning = (type) => {
      // Peringatan hanya memicu jika status ujian belum dikumpulkan (isFinishingRef = false)
      if (!isLocked && !isFinishingRef.current) {
        setWarnings(prev => {
          const newWarnings = prev + 1;
          
          // Alert native HANYA untuk peringatan curang pindah layar/aplikasi
          alert(`PERINGATAN KECURANGAN! ${type === 'tab' ? 'Pindah aplikasi/tab' : 'Layar tidak Full-Screen'} terdeteksi. Peringatan ke-${newWarnings}`);
          
          if (studentData?.studentId) {
            update(ref(db, `live_students/${studentData.studentId}`), {
              warnings: newWarnings,
              status: newWarnings >= 3 ? 'terkunci' : 'online'
            });
          }
          if (newWarnings >= 3) setIsLocked(true);
          return newWarnings;
        });
      }
    };

    const handleVisibilityChange = () => { if (document.hidden) triggerWarning('tab'); };
    const handleFullscreenChange = () => { if (!document.fullscreenElement) triggerWarning('fullscreen'); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isLocked, studentData]);

  const handleAnswer = (qId, option) => {
    const newAnswers = { ...answers, [qId]: option };
    setAnswers(newAnswers);
    if (studentData?.studentId && questions.length > 0) {
      const progress = Math.round((Object.keys(newAnswers).length / questions.length) * 100);
      update(ref(db, `live_students/${studentData.studentId}`), { progress });
    }
  };

  const handleFinishExam = async () => {
    // 1. Matikan sensor anti-cheat terlebih dahulu
    isFinishingRef.current = true; 
    setShowFinishModal(false);

    // 2. Kalkulasi Nilai
    let correct = 0;
    questions.forEach(q => { if (answers[q.id] === q.kunci) correct++; });
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

    // 3. Update Database
    if (studentData?.studentId) {
      await update(ref(db, `live_students/${studentData.studentId}`), { status: 'selesai', progress: 100 });
    }
    await push(ref(db, 'leaderboard'), {
      name: studentData.studentName,
      class: studentData.studentClass,
      mapel: studentData.mapel || 'Umum',
      score: score,
      timestamp: Date.now()
    });

    // 4. Keluar dari mode Full-Screen secara otomatis & mulus ke halaman Result
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(err => console.log(err));
    }

    onFinish(score);
  };

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-950">
        <AlertTriangle className="w-32 h-32 text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] mb-6 animate-pulse" />
        <h1 className="text-4xl font-black text-red-700 dark:text-red-400">UJIAN TERKUNCI (BLOKIR)</h1>
        <p className="mt-4 text-lg font-medium text-red-800/70 dark:text-red-300">Anda telah melanggar sistem keamanan ujian sekolah.</p>
      </div>
    );
  }

  if (questions.length === 0) return <div className="flex items-center justify-center min-h-screen bg-emerald-50 dark:bg-emerald-950 font-bold text-2xl text-emerald-600 animate-pulse">Menyiapkan Lembar Ujian...</div>;

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 text-gray-900 dark:text-gray-100 p-4 md:p-6 select-none relative">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-5 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] border border-white/50 dark:border-gray-700 mb-6 border-l-8 border-l-emerald-500">
        <div>
          <h2 className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{studentData.studentName}</h2>
          <p className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 rounded-full inline-block mt-2">Kelas: {studentData.studentClass} | {studentData.mapel}</p>
        </div>
        <div className="flex gap-4 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-red-600 font-bold bg-red-100/80 dark:bg-red-900/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 shadow-sm">
            <AlertTriangle size={20} /> Kecurangan: {warnings}/3
          </div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-2xl bg-emerald-100/80 dark:bg-emerald-900/50 backdrop-blur-sm px-5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
            <Clock size={28} /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/50 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-emerald-100 dark:border-gray-700">
              <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-1.5 rounded-lg border border-emerald-200/50">Soal No. {currentIndex + 1}</h3>
            </div>
            <p className="text-2xl mb-8 leading-relaxed font-medium">{currentQ.pertanyaan}</p>
            
            <div className="flex flex-col gap-4">
              {['A', 'B', 'C', 'D'].map(opt => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(currentQ.id, opt)}
                  className={`p-5 text-left border-2 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                    answers[currentQ.id] === opt 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/30 transform scale-[1.01]' 
                    : 'bg-white/80 dark:bg-gray-700/80 hover:bg-emerald-50 dark:hover:bg-gray-600 border-emerald-100 dark:border-gray-600 hover:border-emerald-300'
                  }`}
                >
                  <span className="font-black text-lg mr-4 bg-black/10 px-3 py-1 rounded-lg">{opt}</span> 
                  <span className="text-lg font-medium">{currentQ[`opsi${opt}`]}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-between mt-12 pt-6 border-t border-emerald-100 dark:border-gray-700">
              <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl disabled:opacity-40 font-bold hover:bg-gray-50 transition shadow-sm">
                <ChevronLeft size={20} /> Sebelumnya
              </button>
              <button onClick={() => setDoubtful({ ...doubtful, [currentQ.id]: !doubtful[currentQ.id] })} className={`px-8 py-3 rounded-xl font-black transition-all shadow-md ${doubtful[currentQ.id] ? 'bg-amber-400 text-amber-950 border border-amber-500' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                Ragu-ragu
              </button>
              <button onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))} disabled={currentIndex === questions.length - 1} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl disabled:opacity-40 font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/30">
                Lanjut <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/50 dark:border-gray-700 h-fit z-10">
          <h3 className="font-black text-lg mb-6 text-center text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50">Peta Soal</h3>
          <div className="grid grid-cols-5 gap-2.5">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isDoubt = doubtful[q.id];
              const isActive = idx === currentIndex;
              
              let btnColor = 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-gray-300 border border-emerald-100 dark:border-gray-600 hover:bg-emerald-50';
              if (isDoubt) btnColor = 'bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 font-black shadow-md border-0';
              else if (isAnswered) btnColor = 'bg-gradient-to-br from-emerald-500 to-green-600 text-white font-black shadow-md border-0';

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-12 h-12 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${btnColor} ${isActive ? 'ring-4 ring-emerald-300 dark:ring-emerald-600 transform scale-110 z-10' : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => setShowFinishModal(true)}
            className="w-full mt-8 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white py-4 rounded-xl flex items-center justify-center gap-3 font-black shadow-lg shadow-emerald-600/40 transition-transform transform hover:-translate-y-1"
          >
            <CheckCircle size={24} /> KUMPULKAN UJIAN
          </button>
        </div>
      </div>

      {/* MODAL POP-UP KONFIRMASI SELESAI UJIAN (Desain Glossy Islami) */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-sm">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 rounded-3xl max-w-md w-full shadow-2xl border border-white/50 dark:border-emerald-800/50 text-center transform scale-100 animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mb-2">Selesaikan Ujian?</h2>
            <p className="text-emerald-700/80 dark:text-emerald-400 font-medium mb-8">Demi Allah, saya yakin ingin mengakhiri ujian ini. Jawaban yang sudah dikumpulkan tidak dapat diubah kembali.</p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowFinishModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                <XCircle size={18}/> Batal
              </button>
              <button 
                onClick={handleFinishExam}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-black shadow-lg shadow-emerald-500/40 transition flex items-center justify-center gap-2"
              >
                <CheckCircle size={18}/> Ya, Kumpulkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}