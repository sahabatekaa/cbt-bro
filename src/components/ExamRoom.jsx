import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, push } from 'firebase/database';
import { db } from '../firebase';
import { AlertTriangle, Clock, ChevronLeft, ChevronRight, CheckCircle, XCircle, BookOpen } from 'lucide-react';

export default function ExamRoom({ studentData, onFinish }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => {
      const savedAnswers = localStorage.getItem(`answers_${studentData?.studentId}`);
      return savedAnswers ? JSON.parse(savedAnswers) : {};
  });
  const [doubtful, setDoubtful] = useState({});
  const [warnings, setWarnings] = useState(studentData?.warnings || 0);
  const [isLocked, setIsLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); 
  const [showFinishModal, setShowFinishModal] = useState(false);
  
  const isFinishingRef = useRef(false);
  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  useEffect(() => {
      if(studentData?.studentId) {
          localStorage.setItem(`answers_${studentData.studentId}`, JSON.stringify(answers));
      }
  }, [answers, studentData]);

  // PERBAIKAN: Filter Ganda (MAPEL dan TINGKAT)
  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'bank_soal'), (snapshot) => {
      if (snapshot.exists()) {
          const allQuestions = Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] }));
          
          // Filter: Mapel sama DAN Tingkat kelas sama (huruf besar/kecil diabaikan)
          const filteredQuestions = allQuestions.filter(q => 
              q.mapel && q.tingkat &&
              q.mapel.toLowerCase() === studentData.mapel?.toLowerCase() &&
              String(q.tingkat).toLowerCase() === String(studentData.tingkat).toLowerCase()
          );
          setQuestions(filteredQuestions);
      }
    });
    return () => unsubscribe();
  }, [studentData.mapel, studentData.tingkat]);

  useEffect(() => {
    if (timeLeft <= 0) { handleFinishExam(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (!studentData?.studentId) return;
    const studentRef = ref(db, `live_students/${studentData.studentId}`);
    
    const unsubscribe = onValue(studentRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.status === 'force_finish' && !isFinishingRef.current) {
          isFinishingRef.current = true;
          alert("PERHATIAN: Waktu habis atau ujian Anda dihentikan paksa oleh Pengawas.");
          
          let correct = 0;
          questionsRef.current.forEach(q => { if (answersRef.current[q.id] === q.kunci) correct++; });
          const score = questionsRef.current.length > 0 ? Math.round((correct / questionsRef.current.length) * 100) : 0;

          update(ref(db, `live_students/${studentData.studentId}`), { status: 'selesai', progress: 100 });
          push(ref(db, 'leaderboard'), {
            name: studentData.studentName,
            class: studentData.studentClass,
            mapel: studentData.mapel || 'Umum',
            score: score,
            timestamp: Date.now()
          });

          if (document.fullscreenElement) document.exitFullscreen().catch(e => console.log(e));
          onFinish(score);
          
        } else if (data.status === 'selesai' && !isFinishingRef.current) {
           isFinishingRef.current = true;
           if (document.fullscreenElement) document.exitFullscreen().catch(e => console.log(e));
           onFinish(0); 
        }
      }
    });
    return () => unsubscribe();
  }, [studentData, onFinish]);

  useEffect(() => {
    const triggerWarning = (type) => {
      if (!isLocked && !isFinishingRef.current && type === 'tab') {
        setWarnings(prev => {
          const newWarnings = prev + 1;
          alert(`PERINGATAN KECURANGAN!\nAnda terdeteksi berpindah aplikasi atau tab browser.\nPeringatan ke-${newWarnings}`);
          if (studentData?.studentId) {
            update(ref(db, `live_students/${studentData.studentId}`), { warnings: newWarnings, status: newWarnings >= 3 ? 'terkunci' : 'online' });
          }
          if (newWarnings >= 3) setIsLocked(true);
          return newWarnings;
        });
      }
    };
    const handleVisibilityChange = () => { if (document.hidden) triggerWarning('tab'); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", handleVisibilityChange); };
  }, [isLocked, studentData]);

  const handleAnswer = (qId, option) => {
    const newAnswers = { ...answers, [qId]: option };
    setAnswers(newAnswers);
    if (studentData?.studentId && questions.length > 0) {
      update(ref(db, `live_students/${studentData.studentId}`), { progress: Math.round((Object.keys(newAnswers).length / questions.length) * 100) });
    }
  };

  const handleFinishExam = async () => {
    isFinishingRef.current = true; 
    setShowFinishModal(false);

    let correct = 0;
    questions.forEach(q => { if (answers[q.id] === q.kunci) correct++; });
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

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

    setTimeout(async () => {
        if (document.fullscreenElement) await document.exitFullscreen().catch(err => console.log(err));
        localStorage.removeItem(`answers_${studentData.studentId}`);
        onFinish(score);
    }, 100);
  };

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-950 p-6 text-center">
        <AlertTriangle className="w-20 h-20 md:w-32 md:h-32 text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] mb-4 md:mb-6 animate-pulse" />
        <h1 className="text-2xl md:text-4xl font-black text-red-700 dark:text-red-400">UJIAN TERKUNCI</h1>
        <p className="mt-2 md:mt-4 text-sm md:text-lg font-medium text-red-800/70 dark:text-red-300">Anda telah melanggar sistem keamanan ujian (3x Peringatan).</p>
      </div>
    );
  }

  if (questions.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-50 dark:bg-emerald-950 p-4 text-center">
        <BookOpen className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
        <h2 className="font-bold text-xl md:text-2xl text-emerald-700 dark:text-emerald-400 mb-2">Soal Belum Tersedia</h2>
        <p className="text-emerald-600 dark:text-emerald-500 text-sm md:text-base">Guru belum mengunggah soal untuk <b>{studentData.mapel} (Tingkat {studentData.tingkat})</b></p>
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 text-gray-900 dark:text-gray-100 p-2 md:p-6 select-none relative pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-4 rounded-xl md:rounded-2xl shadow-sm border border-white/50 dark:border-gray-700 mb-4 border-l-4 md:border-l-8 border-l-emerald-500 gap-3">
        <div>
          <h2 className="text-base md:text-2xl font-black text-emerald-800 dark:text-emerald-300 truncate w-full">{studentData.studentName}</h2>
          <p className="text-xs md:text-sm font-bold text-emerald-600/80 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 md:px-3 py-1 rounded-full inline-block mt-1">Kelas: {studentData.studentClass} | {studentData.mapel} (Tk.{studentData.tingkat})</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-red-600 font-bold bg-red-100/80 dark:bg-red-900/50 backdrop-blur-sm px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-red-200 dark:border-red-800 shadow-sm text-xs md:text-base">
            <AlertTriangle size={14} className="md:w-5 md:h-5" /> Warn: {warnings}/3
          </div>
          <div className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-300 font-black text-sm md:text-2xl bg-emerald-100/80 dark:bg-emerald-900/50 backdrop-blur-sm px-2 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
            <Clock size={16} className="md:w-6 md:h-6" /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-4 md:p-8 rounded-xl md:rounded-3xl shadow-sm border border-white/50 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-emerald-400/10 rounded-full blur-[60px] md:blur-[80px]"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-3 md:mb-6 pb-2 md:pb-4 border-b border-emerald-100 dark:border-gray-700">
              <h3 className="text-sm md:text-xl font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 md:px-4 py-1 md:py-1.5 rounded-lg border border-emerald-200/50">Soal No. {currentIndex + 1}</h3>
            </div>
            <p className="text-base md:text-2xl mb-4 md:mb-8 leading-relaxed font-medium break-words">{currentQ.pertanyaan}</p>
            
            <div className="flex flex-col gap-2 md:gap-3">
              {['A', 'B', 'C', 'D'].map(opt => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(currentQ.id, opt)}
                  className={`p-3 md:p-5 text-left border rounded-xl transition-all duration-300 relative overflow-hidden ${
                    answers[currentQ.id] === opt 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-500 shadow-md transform scale-[1.01]' 
                    : 'bg-white/80 dark:bg-gray-700/80 hover:bg-emerald-50 dark:hover:bg-gray-600 border-emerald-100 dark:border-gray-600 hover:border-emerald-300'
                  }`}
                >
                  <span className="font-black text-sm md:text-lg mr-2 md:mr-3 bg-black/10 px-2 py-0.5 md:py-1 rounded-md md:rounded-lg">{opt}</span> 
                  <span className="text-sm md:text-lg font-medium break-words">{currentQ[`opsi${opt}`]}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-between mt-6 md:mt-12 pt-4 md:pt-6 border-t border-emerald-100 dark:border-gray-700 gap-2">
              <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="flex-1 flex items-center justify-center gap-1 md:gap-2 px-2 py-2 md:py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg md:rounded-xl disabled:opacity-40 font-bold hover:bg-gray-50 transition shadow-sm text-xs md:text-base">
                <ChevronLeft size={16}/> Prev
              </button>
              <button onClick={() => setDoubtful({ ...doubtful, [currentQ.id]: !doubtful[currentQ.id] })} className={`flex-1 px-2 py-2 md:py-3 rounded-lg md:rounded-xl font-black transition-all shadow-sm text-xs md:text-base ${doubtful[currentQ.id] ? 'bg-amber-400 text-amber-950 border border-amber-500' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                Ragu
              </button>
              <button onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))} disabled={currentIndex === questions.length - 1} className="flex-1 flex items-center justify-center gap-1 md:gap-2 px-2 py-2 md:py-3 bg-emerald-600 text-white rounded-lg md:rounded-xl disabled:opacity-40 font-bold hover:bg-emerald-700 transition shadow-sm text-xs md:text-base">
                Next <ChevronRight size={16}/>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-72 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-4 md:p-6 rounded-xl md:rounded-3xl shadow-sm border border-white/50 dark:border-gray-700 h-fit z-10">
          <h3 className="font-black text-xs md:text-lg mb-3 md:mb-4 text-center text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-emerald-100 dark:border-emerald-800/50">Navigasi</h3>
          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-4 gap-1.5 md:gap-2">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isDoubt = doubtful[q.id];
              const isActive = idx === currentIndex;
              
              let btnColor = 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-gray-300 border border-emerald-100 dark:border-gray-600 hover:bg-emerald-50';
              if (isDoubt) btnColor = 'bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 font-black shadow-sm border-0';
              else if (isAnswered) btnColor = 'bg-gradient-to-br from-emerald-500 to-green-600 text-white font-black shadow-sm border-0';

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`aspect-square w-full rounded-md md:rounded-lg text-xs md:text-sm font-bold flex items-center justify-center transition-all ${btnColor} ${isActive ? 'ring-2 ring-emerald-400 dark:ring-emerald-500 transform scale-110 z-10' : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => setShowFinishModal(true)}
            className="w-full mt-4 md:mt-6 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white py-2.5 md:py-4 rounded-lg md:rounded-xl flex items-center justify-center gap-2 font-black shadow-sm transition-transform transform hover:-translate-y-1 text-sm md:text-base"
          >
            <CheckCircle size={18} /> KUMPULKAN
          </button>
        </div>
      </div>

      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-5 md:p-8 rounded-2xl md:rounded-3xl max-w-sm w-full shadow-2xl border border-white/50 dark:border-emerald-800/50 text-center transform scale-100 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 md:w-16 md:h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mb-3 md:mb-5 shadow-inner">
              <CheckCircle size={24} className="md:w-8 md:h-8" />
            </div>
            <h2 className="text-lg md:text-2xl font-black text-emerald-900 dark:text-emerald-100 mb-1 md:mb-2">Selesaikan Ujian?</h2>
            <p className="text-xs md:text-sm text-emerald-700/80 dark:text-emerald-400 font-medium mb-5 md:mb-8">Demi Allah, saya yakin mengakhiri ujian ini.</p>
            
            <div className="flex gap-2 md:gap-4">
              <button onClick={() => setShowFinishModal(false)} className="flex-1 px-3 py-2 md:py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg md:rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs md:text-sm">
                <XCircle size={16}/> Batal
              </button>
              <button onClick={handleFinishExam} className="flex-1 px-3 py-2 md:py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg md:rounded-xl font-black shadow-sm transition flex items-center justify-center gap-1.5 text-xs md:text-sm">
                <CheckCircle size={16}/> Ya, Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
