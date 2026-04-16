import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, push } from 'firebase/database';
// PENTING: Tambahan ikon Landmark (Sekolah) dan Bell (Pengumuman)
import { Timer, AlertTriangle, Book, ChevronLeft, ChevronRight, HelpCircle, Maximize, ShieldAlert, Landmark, Bell } from 'lucide-react';
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
  
  // STATE BARU UNTUK FITUR BROADCAST PENGUMUMAN
  const [lastBroadcast, setLastBroadcast] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const answersRef = useRef(answers);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // ==========================================
  // FITUR: TARIK & ACAK SOAL (SHUFFLE)
  // ==========================================
  useEffect(() => {
    onValue(ref(db, 'bank_soal'), (snap) => {
      if (snap.val()) {
        const allQ = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        const filtered = allQ.filter(q => q.mapel === studentData?.mapel && q.kelas === studentData?.class && q.teacherEmail === studentData?.teacherEmail);
        
        const savedOrder = localStorage.getItem(`${storageKey}_order`);
        let finalQuestions = [];

        if (savedOrder) {
          const orderIds = JSON.parse(savedOrder);
          finalQuestions = orderIds.map(id => filtered.find(q => q.id === id)).filter(Boolean);
          const newQuestions = filtered.filter(q => !orderIds.includes(q.id));
          finalQuestions = [...finalQuestions, ...newQuestions];
        } else {
          finalQuestions = [...filtered].sort(() => Math.random() - 0.5);
          const orderIds = finalQuestions.map(q => q.id);
          localStorage.setItem(`${storageKey}_order`, JSON.stringify(orderIds));
        }
        
        setQuestions(finalQuestions);
      }
    });
  }, [studentData, storageKey]);

  // ==========================================
  // LISNETER FIREBASE (KUNCI, TARIK PAKSA, BROADCAST)
  // ==========================================
  useEffect(() => {
    if (!sid || sid === 'guest') return;
    const unsub = onValue(ref(db, `live_students/${sid}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        
        // Logika Buka Kunci
        if (data.warnings === 0 && isLocked) {
          setWarnings(0); setIsLocked(false);
          localStorage.setItem(`${storageKey}_warn`, 0); localStorage.setItem(`${storageKey}_lock`, 'false');
          alert("PEMBERITAHUAN!\nPengawas telah memberikan dispensasi. Layar Anda telah dibuka.");
        }
        
        // Logika Tarik Paksa
        if (data.forceSubmit === true) setShouldForceSubmit(true);

        // Logika Broadcast Pengumuman
        if (data.broadcast && data.broadcast !== lastBroadcast) {
          setLastBroadcast(data.broadcast);
          setShowBroadcast(true);
        }
      }
    });
    return () => unsub();
  }, [sid, isLocked, storageKey, lastBroadcast]);

  // ==========================================
  // SISTEM KEAMANAN (BLUR, FULLSCREEN, SPLIT SCREEN)
  // ==========================================
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    const handleVisibilityChange = () => { if(document.hidden && !isLocked) triggerWarning("Meninggalkan Halaman/Aplikasi"); };
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

  const enterFullscreen = () => { 
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(e => {
        console.log("Bypass Exambro/WebView", e);
        setForceAllowFullscreen(true);
      });
    } else {
      setForceAllowFullscreen(true);
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
    
    localStorage.removeItem(`${storageKey}_ans`); 
    localStorage.removeItem(`${storageKey}_ragu`);
    localStorage.removeItem(`${storageKey}_time`); 
    localStorage.removeItem(`${storageKey}_warn`);
    localStorage.removeItem(`${storageKey}_lock`);
    localStorage.removeItem(`${storageKey}_order`); 
    
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    onFinish(score);
  };

  // ==========================================
  // RENDER LAYAR TERKUNCI
  // ==========================================
  if (isLocked) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 p-6 text-center select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-red-900/20 animate-pulse"></div>
        <ShieldAlert size={100} className="text-red-500 mb-6 animate-bounce relative z-10" />
        <h1 className="text-4xl font-black text-white tracking-widest relative z-10 mb-2">UJIAN DIBLOKIR!</h1>
        <p className="mt-2 text-red-400 font-bold text-xl relative z-10 max-w-lg">Anda telah melanggar aturan keamanan (Keluar Aplikasi / Layar Belah) sebanyak 3 kali.</p>
        <div className="mt-8 bg-white/10 p-6 rounded-2xl border border-white/20 backdrop-blur-sm relative z-10 max-w-md">
           <p className="text-white font-medium">Silakan membawa perangkat Anda dan menghadap ke Pengawas Ruangan untuk membuka kunci layar.</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER LAYAR BYPASS/FULLSCREEN
  // ==========================================
  if (!isFullscreen && !forceAllowFullscreen && questions.length > 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center select-none relative">
        <Landmark size={80} className="mb-6 text-emerald-500 opacity-20 absolute top-10" />
        <Maximize size={80} className="mb-6 text-emerald-400 animate-pulse relative z-10" />
        <h1 className="text-3xl font-black mb-4 tracking-wider relative z-10">Sistem Keamanan Aktif</h1>
        <p className="text-slate-400 mb-10 max-w-md text-lg relative z-10">Harap gunakan layar penuh untuk memulai. Jika Anda menggunakan Exambro, klik tombol di bawah untuk melanjutkan.</p>
        <button onClick={enterFullscreen} className="bg-emerald-600 hover:bg-emerald-500 px-10 py-5 rounded-2xl font-black text-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)] relative z-10 tracking-widest">MASUK UJIAN SEKARANG</button>
      </div>
    );
  }

  if (questions.length === 0) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400 font-bold">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      Menyiapkan Naskah Soal...
    </div>
  );

  const q = questions[currentIndex];

  return (
    <div 
      onCopy={(e) => { e.preventDefault(); alert("Tindakan disalin telah diblokir!"); }} 
      onPaste={(e) => e.preventDefault()} 
      onContextMenu={(e) => e.preventDefault()} 
      className="min-h-screen bg-[#f8fafc] font-sans pb-28 select-none relative overflow-x-hidden"
    >
      {/* WATERMARK ANTI-SCREENSHOT (Tembus Pandang) */}
      <div className="pointer-events-none fixed inset-0 z-0 flex flex-col items-center justify-center opacity-[0.03] rotate-[-30deg] text-black font-black text-3xl whitespace-nowrap overflow-hidden">
        {Array(10).fill(`${studentData?.name} - ${studentData?.class} `).map((text, i) => (
          <div key={i} className="mb-10">{text.repeat(5)}</div>
        ))}
      </div>

      {/* FILTER BLUR KETIKA KEHILANGAN FOKUS */}
      <div className={`relative z-10 transition-all duration-300 min-h-screen flex flex-col ${isBlurred ? 'blur-2xl grayscale brightness-50' : ''}`}>
        
        {/* ========================================== */}
        {/* HEADER PROFESIONAL: IDENTITAS SEKOLAH */}
        {/* ========================================== */}
        <header className="bg-slate-900 text-white w-full shadow-lg border-b-4 border-emerald-500">
          <div className="max-w-5xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Logo & Nama Institusi */}
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="bg-white/10 p-3 rounded-2xl border border-white/10 hidden sm:block">
                <Landmark size={36} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="font-black text-lg md:text-xl tracking-widest text-emerald-400 leading-tight">YASPENDIK PTP NUSANTARA IV</h1>
                <h2 className="font-bold text-xs md:text-sm tracking-widest text-slate-300 mt-1">SMP/MTS DARMA PERTIWI BAH BUTONG</h2>
              </div>
            </div>

            {/* Info Siswa & Timer */}
            <div className="flex items-center gap-4 bg-slate-800/80 p-2 md:p-3 rounded-2xl border border-slate-700 backdrop-blur-sm w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-black text-xl border-2 border-slate-900 shadow-inner shrink-0">
                  {studentData?.name?.charAt(0) || 'S'}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="font-bold text-sm md:text-base leading-tight truncate max-w-[150px]">{studentData?.name}</p>
                  <p className="text-xs text-emerald-400 font-bold mt-0.5">{studentData?.class}-{studentData?.subKelas} • {studentData?.mapel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 md:py-3 rounded-xl text-emerald-400 font-mono font-black text-xl md:text-2xl border border-slate-700 shadow-inner">
                <Timer size={24} className="text-emerald-500" />
                {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
              </div>
            </div>

          </div>
        </header>

        {/* ========================================== */}
        {/* KONTEN SOAL UJIAN */}
        {/* ========================================== */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 mt-4">
          
          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
            {/* Pita Dekorasi Soal */}
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            
            <span className="inline-block text-xs font-black bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl border border-emerald-200 mb-6 uppercase tracking-widest">
              Soal No. {currentIndex+1} / {questions.length}
            </span>
            
            <p className="text-lg md:text-2xl font-semibold mb-8 text-slate-800 leading-relaxed"><Latex>{q.pertanyaan}</Latex></p>
            
            <div className="space-y-4">
              {['A','B','C','D'].map(opt => (
                <button key={opt} onClick={() => handleSelect(q.id, opt)} className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-5 ${answers[q.id]===opt ? 'bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-500/10 text-emerald-900 font-bold':'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}>
                  <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg shrink-0 transition-colors ${answers[q.id]===opt?'bg-emerald-500 text-white shadow-inner':'bg-slate-100 text-slate-500 border border-slate-200'}`}>{opt}</span>
                  <span className="flex-1 text-base md:text-lg"><Latex>{q[`opsi${opt}`]}</Latex></span>
                </button>
              ))}
            </div>
          </div>

          {/* Tombol Navigasi Bawah */}
          <div className="flex flex-wrap gap-3 md:gap-4 mb-10">
            <button disabled={currentIndex===0} onClick={() => setCurrentIndex(currentIndex-1)} className="flex-1 min-w-[120px] p-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all hover:bg-slate-50 tracking-wider"><ChevronLeft size={24}/> <span className="hidden sm:inline">SEBELUMNYA</span></button>
            <button onClick={() => toggleRagu(q.id)} className={`flex-1 min-w-[120px] p-5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all tracking-wider ${ragu[q.id] ? 'bg-amber-400 text-white shadow-amber-400/40 border-2 border-amber-500' : 'bg-white border border-slate-200 text-amber-500 hover:bg-amber-50'}`}><HelpCircle size={24}/> RAGU-RAGU</button>
            <button disabled={currentIndex===questions.length-1} onClick={() => setCurrentIndex(currentIndex+1)} className="flex-1 min-w-[120px] p-5 bg-emerald-600 text-white rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all hover:bg-emerald-500 tracking-wider"><span className="hidden sm:inline">SELANJUTNYA</span> <ChevronRight size={24}/></button>
          </div>

          {/* Panel Nomor Soal */}
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 tracking-wide uppercase"><Book size={20} className="text-emerald-500"/> Peta Navigasi Soal</h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3 mb-10">
              {questions.map((quest, idx) => {
                let btnClass = 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100';
                if (ragu[quest.id]) btnClass = 'bg-amber-400 border-amber-500 text-white shadow-md shadow-amber-400/30';
                else if (answers[quest.id]) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/30';
                if (currentIndex === idx) btnClass += ' ring-4 ring-slate-800 ring-offset-2 scale-110 z-10';
                return (<button key={idx} onClick={() => setCurrentIndex(idx)} className={`h-12 md:h-14 rounded-xl flex items-center justify-center text-base font-black border transition-all ${btnClass}`}>{idx + 1}</button>);
              })}
            </div>
            <button onClick={() => { if(window.confirm("Peringatan!\nAnda yakin ingin mengakhiri ujian dan mengumpulkan jawaban secara permanen?")) submitExam() }} className="w-full p-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 active:scale-95 transition-all tracking-widest text-lg"><ShieldAlert size={24} className="text-emerald-400"/> KUMPULKAN UJIAN SEKARANG</button>
          </div>

        </main>
      </div>

      {/* ========================================== */}
      {/* MODAL POP-UP BROADCAST DARI GURU */}
      {/* ========================================== */}
      {showBroadcast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border-4 border-blue-500 transform transition-all animate-in zoom-in duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 border border-blue-200">
                <Bell size={32} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">PENGUMUMAN!</h3>
                <p className="text-sm font-bold text-blue-600 tracking-widest uppercase mt-1">Pesan dari Pengawas</p>
              </div>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-8 shadow-inner">
              <p className="text-slate-800 font-bold text-lg leading-relaxed text-center">"{lastBroadcast}"</p>
            </div>
            <button onClick={() => setShowBroadcast(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-blue-600/30 tracking-widest text-lg">SAYA MENGERTI</button>
          </div>
        </div>
      )}

      {/* OVERLAY KEHILANGAN FOKUS (MAU CURANG) */}
      {isBlurred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md pointer-events-none transition-all">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-pulse border-4 border-red-500 text-center max-w-sm mx-4">
            <ShieldAlert size={60} className="text-red-600"/> 
            <div>
              <h2 className="font-black text-2xl text-red-600 mb-1">FOKUS HILANG!</h2>
              <p className="font-bold text-slate-700">Layar diblur untuk mencegah kecurangan. Segera kembali ke layar penuh.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
