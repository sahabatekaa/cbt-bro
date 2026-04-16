import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { Timer, AlertTriangle, Book, ChevronLeft, ChevronRight, HelpCircle, Maximize, ShieldAlert } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function ExamRoom({ studentData, onFinish }) {
  const sid = studentData?.id || 'guest';
  const storageKey = `cbt_exam_${sid}`;

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [answers, setAnswers] = useState(() => JSON.parse(localStorage.getItem(`${storageKey}_ans`)) || {});
  const [ragu, setRagu] = useState(() => JSON.parse(localStorage.getItem(`${storageKey}_ragu`)) || {});
  const [timeLeft, setTimeLeft] = useState(() => { const t = localStorage.getItem(`${storageKey}_time`); return t ? parseInt(t) : 3600; });
  const [warnings, setWarnings] = useState(() => parseInt(localStorage.getItem(`${storageKey}_warn`)) || 0);
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem(`${storageKey}_lock`) === 'true');
  
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [forceAllowFullscreen, setForceAllowFullscreen] = useState(false); // BYPASS EXAMBRO
  
  const [shouldForceSubmit, setShouldForceSubmit] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const answersRef = useRef(answers);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // ==========================================
  // FITUR BARU: TARIK & ACAK SOAL (SHUFFLE)
  // ==========================================
  useEffect(() => {
    onValue(ref(db, 'bank_soal'), (snap) => {
      if (snap.val()) {
        const allQ = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        const filtered = allQ.filter(q => q.mapel === studentData?.mapel && q.kelas === studentData?.class && q.teacherEmail === studentData?.teacherEmail);
        
        const savedOrder = localStorage.getItem(`${storageKey}_order`);
        let finalQuestions = [];

        if (savedOrder) {
          // Jika sudah punya urutan sebelumnya, pakai urutan itu (biar gak rubah saat refresh)
          const orderIds = JSON.parse(savedOrder);
          finalQuestions = orderIds.map(id => filtered.find(q => q.id === id)).filter(Boolean);
          
          // Jaga-jaga kalau guru nambah soal baru di tengah jalan
          const newQuestions = filtered.filter(q => !orderIds.includes(q.id));
          finalQuestions = [...finalQuestions, ...newQuestions];
        } else {
          // Jika baru pertama kali masuk, ACAK SOALNYA
          finalQuestions = [...filtered].sort(() => Math.random() - 0.5);
          const orderIds = finalQuestions.map(q => q.id);
          localStorage.setItem(`${storageKey}_order`, JSON.stringify(orderIds));
        }
        
        setQuestions(finalQuestions);
      }
    });
  }, [studentData, storageKey]);
  // ==========================================

  useEffect(() => {
    if (!sid || sid === 'guest') return;
    const unsub = onValue(ref(db, `live_students/${sid}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.warnings === 0 && isLocked) {
          setWarnings(0); setIsLocked(false);
          localStorage.setItem(`${storageKey}_warn`, 0); localStorage.setItem(`${storageKey}_lock`, 'false');
          alert("PEMBERITAHUAN!\nPengawas telah memberikan dispensasi. Layar Anda telah dibuka.");
        }
        if (data.forceSubmit === true) setShouldForceSubmit(true);
      }
    });
    return () => unsub();
  }, [sid, isLocked, storageKey]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    
    const handleVisibilityChange = () => { 
      if(document.hidden && !isLocked) triggerWarning("Meninggalkan Halaman/Aplikasi");
    };

    const handleBlur = () => { if(!isLocked) setIsBlurred(true); };
    const handleFocus = () => { setIsBlurred(false); };

    let lastHeight = window.innerHeight;
    const handleResize = () => {
      if (Math.abs(window.innerHeight - lastHeight) > 150 && !isLocked) {
        if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
        triggerWarning("Layar Belah / Perubahan Jendela Terdeteksi");
      }
      lastHeight = window.innerHeight;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("resize", handleResize);

    setIsFullscreen(!!document.fullscreenElement); 

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("resize", handleResize);
    };
  }, [warnings, isLocked]);

  const triggerWarning = (reason) => {
    const newWarn = warnings + 1;
    setWarnings(newWarn);
    localStorage.setItem(`${storageKey}_warn`, newWarn);
    update(ref(db, `live_students/${sid}`), { warnings: newWarn, status: reason }); 
    if(newWarn >= 3) { setIsLocked(true); localStorage.setItem(`${storageKey}_lock`, 'true'); } 
    alert(`PERINGATAN KECURANGAN ${newWarn}/3!\nPelanggaran: ${reason}`);
  };

  // LOGIKA BYPASS EXAMBRO
  const enterFullscreen = () => { 
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(e => {
        console.log("Bypass Exambro/WebView", e);
        setForceAllowFullscreen(true); // Jika ditolak Exambro, langsung loloskan
      });
    } else {
      setForceAllowFullscreen(true); // Loloskan untuk browser iOS lawas
    }
  };

  useEffect(() => {
    if (timeLeft > 0 && !isLocked && questions.length > 0 && (isFullscreen || forceAllowFullscreen) && !shouldForceSubmit) { 
      const t = setTimeout(() => { setTimeLeft(timeLeft - 1); localStorage.setItem(`${storageKey}_time`, timeLeft - 1); }, 1000); 
      return () => clearTimeout(t); 
    } 
    else if ((timeLeft <= 0 || shouldForceSubmit) && questions.length > 0) submitExam();
  }, [timeLeft, isLocked, questions, isFullscreen, forceAllowFullscreen, shouldForceSubmit, storageKey]);

  const handleSelect = (qId, opt) => {
    const newAns = { ...answers, [qId]: opt }; 
    setAnswers(newAns); localStorage.setItem(`${storageKey}_ans`, JSON.stringify(newAns));
    update(ref(db, `live_students/${sid}`), { progress: Math.round((Object.keys(newAns).length / questions.length) * 100) });
  };

  const toggleRagu = (qId) => {
    const newRagu = { ...ragu, [qId]: !ragu[qId] };
    setRagu(newRagu); localStorage.setItem(`${storageKey}_ragu`, JSON.stringify(newRagu));
  };

  const submitExam = async () => {
    const finalAnswers = answersRef.current;
    let correct = 0; 
    questions.forEach(q => { if (finalAnswers[q.id] === q.kunci) correct++; });
    const score = Math.round((correct / questions.length) * 100);
    
    await push(ref(db, 'leaderboard'), { ...studentData, score, timestamp: Date.now() });
    await update(ref(db, `live_students/${sid}`), { status: 'Selesai' });
    
    // BERSIIHKAN MEMORI TERMASUK URUTAN ACAK
    localStorage.removeItem(`${storageKey}_ans`); 
    localStorage.removeItem(`${storageKey}_ragu`);
    localStorage.removeItem(`${storageKey}_time`); 
    localStorage.removeItem(`${storageKey}_warn`);
    localStorage.removeItem(`${storageKey}_lock`);
    localStorage.removeItem(`${storageKey}_order`); // Hapus urutan soal
    
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    onFinish(score);
  };

  if (isLocked) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center select-none">
        <ShieldAlert size={80} className="text-red-600 mb-4 animate-bounce" />
        <h1 className="text-3xl font-black text-red-700">UJIAN DIBLOKIR!</h1>
        <p className="mt-2 text-red-600 font-bold text-lg">Anda melanggar aturan keamanan (Keluar Aplikasi / Layar Belah) sebanyak 3 kali.</p>
        <p className="text-sm text-red-500 mt-2">Silakan menghadap ke Pengawas Ruangan untuk membuka kunci layar.</p>
      </div>
    );
  }

  // TAMPILKAN TOMBOL MASUK JIKA BUKAN FULLSCREEN DAN BELUM DI-BYPASS EXAMBRO
  if (!isFullscreen && !forceAllowFullscreen && questions.length > 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center select-none">
        <Maximize size={80} className="mb-6 text-emerald-400 animate-pulse" />
        <h1 className="text-2xl font-black mb-2">Mode Keamanan Aktif</h1>
        <p className="text-gray-400 mb-8 max-w-md">Harap gunakan layar penuh untuk memulai. Jika Anda menggunakan Exambro, klik tombol di bawah untuk melanjutkan.</p>
        <button onClick={enterFullscreen} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-4 rounded-2xl font-bold text-lg active:scale-95 transition-all">Masuk Ujian / Lanjutkan</button>
      </div>
    );
  }

  if (questions.length === 0) return <div className="h-screen flex items-center justify-center text-gray-400 font-bold">Mengambil data soal...</div>;

  const q = questions[currentIndex];

  return (
    <div 
      onCopy={(e) => { e.preventDefault(); alert("Copy dinonaktifkan!"); }} 
      onPaste={(e) => e.preventDefault()} 
      onContextMenu={(e) => e.preventDefault()} 
      className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans pb-28 select-none relative overflow-hidden"
    >
      <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-[0.03] rotate-[-30deg] text-black font-black text-4xl whitespace-nowrap overflow-hidden">
        {studentData?.name} - {studentData?.class} {studentData?.name} - {studentData?.class}
      </div>

      <div className={`relative z-10 transition-all duration-200 ${isBlurred ? 'blur-xl grayscale' : ''}`}>
        
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm mb-4 gap-3 border border-gray-100">
          <div className="text-center sm:text-left"><p className="font-bold text-slate-800 text-lg">{studentData?.name}</p><span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mt-1 inline-block">{studentData?.class}-{studentData?.subKelas} • {studentData?.mapel}</span></div>
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 px-5 py-2.5 rounded-xl text-orange-600 font-mono font-black text-xl w-full sm:w-auto justify-center"><Timer size={22} />{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</div>
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

        <div className="max-w-3xl mx-auto flex flex-wrap gap-2 md:gap-4 mb-6">
          <button disabled={currentIndex===0} onClick={() => setCurrentIndex(currentIndex-1)} className="flex-1 min-w-[100px] p-4 bg-white border border-gray-200 text-slate-600 rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><ChevronLeft size={20}/> <span className="hidden sm:inline">KEMBALI</span></button>
          <button onClick={() => toggleRagu(q.id)} className={`flex-1 min-w-[120px] p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all ${ragu[q.id] ? 'bg-yellow-400 text-white shadow-yellow-400/30' : 'bg-white border border-yellow-400 text-yellow-600 hover:bg-yellow-50'}`}><HelpCircle size={20}/> RAGU-RAGU</button>
          <button disabled={currentIndex===questions.length-1} onClick={() => setCurrentIndex(currentIndex+1)} className="flex-1 min-w-[100px] p-4 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"><span className="hidden sm:inline">LANJUT</span> <ChevronRight size={20}/></button>
        </div>

        <div className="max-w-3xl mx-auto bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">Navigasi Soal</h3>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mb-8">
            {questions.map((quest, idx) => {
              let btnClass = 'bg-gray-50 border-transparent text-gray-400';
              if (ragu[quest.id]) btnClass = 'bg-yellow-400 border-yellow-400 text-white shadow-md shadow-yellow-400/20';
              else if (answers[quest.id]) btnClass = 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20';
              if (currentIndex === idx) btnClass += ' ring-2 ring-slate-800 ring-offset-2';
              return (<button key={idx} onClick={() => setCurrentIndex(idx)} className={`h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 transition-all ${btnClass}`}>{idx + 1}</button>);
            })}
          </div>
          <button onClick={() => { if(window.confirm("Yakin ingin mengumpulkan ujian sekarang?")) submitExam() }} className="w-full p-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95 transition-all tracking-widest">KUMPULKAN UJIAN</button>
        </div>

      </div>

      {isBlurred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm pointer-events-none">
          <div className="bg-white p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-pulse border-2 border-red-500">
            <ShieldAlert className="text-red-600"/> <span className="font-black text-red-600">Layar Kehilangan Fokus!</span>
          </div>
        </div>
      )}
    </div>
  );
}
