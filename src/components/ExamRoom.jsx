import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { Timer, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Book } from 'lucide-react';

const ExamRoom = ({ studentData, onFinish }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(3600); 
  const [warnings, setWarnings] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Ambil data kelas & mapel dengan aman (antisipasi beda nama variabel)
  const studentName = studentData?.name || studentData?.studentName || "Siswa";
  const studentClass = studentData?.class || studentData?.kelas || studentData?.studentClass || "";
  const studentMapel = studentData?.mapel || "";

  useEffect(() => {
    // 1. Tarik Semua Soal dari Bank Soal
    const qRef = ref(db, 'bank_soal');
    onValue(qRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allQuestions = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        
        // 2. Filter soal agar HANYA muncul yang sesuai Mapel dan Kelas siswa
        const filtered = allQuestions.filter(q => 
          String(q.mapel).toLowerCase() === String(studentMapel).toLowerCase() &&
          String(q.kelas).toLowerCase() === String(studentClass).toLowerCase()
        );
        
        setQuestions(filtered);
      }
    });

    // Anti-Cheat: Deteksi Pindah Tab
    const handleVisibilityChange = () => {
      if (document.hidden && !isLocked) {
        const newWarn = warnings + 1;
        setWarnings(newWarn);
        
        // Update ke Firebase proctoring
        if (studentData?.id) {
          update(ref(db, `live_students/${studentData.id}`), { 
            warnings: newWarn,
            status: 'Pindah Tab' 
          });
        }

        if (newWarn >= 3) setIsLocked(true);
        alert("PERINGATAN: Jangan pindah halaman! Pelanggaran: " + newWarn + "/3");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [studentClass, studentMapel, warnings]);

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isLocked && questions.length > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      submitExam();
    }
  }, [timeLeft, isLocked, questions]);

  const handleSelectOption = (qId, option) => {
    const newAnswers = { ...answers, [qId]: option };
    setAnswers(newAnswers);
    
    // Update Progress ke Guru
    const progress = Math.round((Object.keys(newAnswers).length / questions.length) * 100);
    if (studentData?.id) {
      update(ref(db, `live_students/${studentData.id}`), { progress, status: 'Online' });
    }
  };

  const submitExam = async () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.kunci) correct++;
    });
    
    const score = Math.round((correct / questions.length) * 100);
    
    const resultData = {
      name: studentName,
      class: studentClass,
      mapel: studentMapel,
      score: score,
      timestamp: Date.now()
    };

    await push(ref(db, 'leaderboard'), resultData);
    if (studentData?.id) {
      await update(ref(db, `live_students/${studentData.id}`), { status: 'Selesai' });
    }
    onFinish(score);
  };

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-6 text-center">
        <AlertTriangle size={80} className="text-red-600 mb-4" />
        <h1 className="text-3xl font-bold text-red-700">UJIAN TERKUNCI</h1>
        <p className="mt-2 text-red-600">Anda melanggar aturan pindah tab lebih dari 3 kali.</p>
      </div>
    );
  }

  // Tampilan jika soal belum ada atau filter tidak cocok
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white p-6 text-center">
        <Book size={80} className="text-emerald-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-700">Soal Belum Tersedia</h1>
        <p className="mt-2 text-slate-500">
          Guru belum mengunggah soal untuk <span className="font-bold text-emerald-600">{studentMapel}</span> <br/>
          (Tingkat <span className="font-bold text-emerald-600">{studentClass}</span>)
        </p>
        <button onClick={() => window.location.reload()} className="mt-6 bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold">Refresh Halaman</button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 font-sans">
      <div className="max-w-4xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-6 border border-gray-100">
        <div>
          <h2 className="font-bold text-slate-800">{studentName}</h2>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{studentClass} - {studentMapel}</span>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-xl text-orange-600 font-mono font-bold border border-orange-100">
          <Timer size={18} />
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold mb-4 inline-block shadow-lg shadow-emerald-500/20">Soal No. {currentIndex + 1}</span>
            <p className="text-lg font-semibold text-slate-800 leading-relaxed mb-8">{currentQ.pertanyaan}</p>
            
            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelectOption(currentQ.id, opt)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                    answers[currentQ.id] === opt 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md shadow-emerald-500/10' 
                    : 'border-gray-50 bg-gray-50 hover:bg-white hover:border-emerald-200'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    answers[currentQ.id] === opt ? 'bg-emerald-500 text-white' : 'bg-white text-gray-400 border border-gray-100'
                  }`}>{opt}</span>
                  <span className="font-medium">{currentQ[`opsi${opt}`]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center gap-4">
            <button 
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(currentIndex - 1)}
              className="flex-1 flex items-center justify-center gap-2 p-4 bg-white text-slate-600 rounded-2xl font-bold shadow-sm disabled:opacity-30"
            >
              <ChevronLeft size={20}/> Kembali
            </button>
            <button 
              disabled={currentIndex === questions.length - 1}
              onClick={() => setCurrentIndex(currentIndex + 1)}
              className="flex-1 flex items-center justify-center gap-2 p-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-30"
            >
              Lanjut <ChevronRight size={20}/>
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500"/> Navigasi Soal</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  currentIndex === idx ? 'border-emerald-500 ring-2 ring-emerald-200 ring-offset-1' : 
                  answers[questions[idx].id] ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-gray-50 border-transparent text-gray-400'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <button 
            onClick={() => { if(window.confirm("Yakin ingin mengumpulkan ujian sekarang?")) submitExam() }}
            className="w-full mt-8 bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
          >
            Selesai Ujian
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamRoom;