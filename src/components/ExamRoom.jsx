import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, push, get } from 'firebase/database';
import { Timer, AlertTriangle, Book, ChevronLeft, ChevronRight, HelpCircle, Maximize, ShieldAlert, Landmark, Bell, Wifi, WifiOff, Check } from 'lucide-react';
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
  const [forceAllowFullscreen, setForceAllowFullscreen] = useState(false); 
  
  const [shouldForceSubmit, setShouldForceSubmit] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  
  const [lastBroadcast, setLastBroadcast] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const answersRef = useRef(answers);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // === V3 LOGIC: SMART GROUPING, ACAK KUOTA, DAN PROPAGASI WACANA ===
  useEffect(() => {
    if (!studentData?.token) return;

    // 1. Tarik Info Sesi untuk Kuota
    onValue(ref(db, 'exam_sessions'), (sessionSnap) => {
      let sessionInfo = null;
      sessionSnap.forEach(s => { if (s.val().token === studentData.token) sessionInfo = s.val(); });
      
      const kPG = sessionInfo?.kuotaPG || 0;
      const kPGK = sessionInfo?.kuotaPGK || 0;
      const kEsai = sessionInfo?.kuotaEsai || 0;
      const hasQuota = kPG > 0 || kPGK > 0 || kEsai > 0; // Cek jika pakai sistem V3 atau V1 (Tarik Semua)

      // 2. Tarik Bank Soal
      onValue(ref(db, 'bank_soal'), (snap) => {
        if (snap.val()) {
          const allQ = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
          const filtered = allQ.filter(q => q.mapel === studentData?.mapel && q.kelas === studentData?.class && q.teacherEmail === studentData?.teacherEmail);
          
          const savedOrder = localStorage.getItem(`${storageKey}_order`);

          if (savedOrder) {
            // Siswa sudah punya susunan soal (Lanjut Ujian)
            const orderIds = JSON.parse(savedOrder);
            const finalQuestions = orderIds.map(id => filtered.find(q => q.id === id)).filter(Boolean);
            setQuestions(finalQuestions);
          } else {
            // Siswa Baru Mulai: Algoritma Smart Grouping & Acak
            const groups = {};
            filtered.forEach(q => {
              const kw = q.kodeWacana || `single_${q.id}`;
              if (!groups[kw]) groups[kw] = [];
              groups[kw].push(q);
            });

            // Propagasi teks wacana ke seluruh soal di grup yang sama (walau ditaruh di soal pertama saja oleh Guru)
            Object.keys(groups).forEach(kw => {
              if (kw.startsWith('single_')) return;
              let groupText = '';
              groups[kw].forEach(q => { if (q.teksWacana) groupText = q.teksWacana; });
              if (groupText) { groups[kw].forEach(q => { q.teksWacana = groupText; }); }
            });

            // Mulai Tarik Kuota & Acak
            const groupKeys = Object.keys(groups).sort(() => Math.random() - 0.5);
            let selectedGroups = [];

            if (!hasQuota) {
               // V1 Backward Compatibility (Tarik Semua Jika Sesi Lama)
               selectedGroups = groupKeys.map(k => groups[k]);
            } else {
               // V3 Kuota Logic
               let pulledPG = 0, pulledPGK = 0, pulledEsai = 0;
               for (let key of groupKeys) {
                  const grp = groups[key];
                  let countPG = 0, countPGK = 0, countEsai = 0;
                  
                  grp.forEach(q => {
                     const t = q.jenisSoal || 'PG';
                     if (t === 'PG') countPG++; else if (t === 'PGK') countPGK++; else if (t === 'ESAI') countEsai++;
                  });

                  if (pulledPG + countPG <= kPG && pulledPGK + countPGK <= kPGK && pulledEsai + countEsai <= kEsai) {
                     selectedGroups.push(grp);
                     pulledPG += countPG; pulledPGK += countPGK; pulledEsai += countEsai;
                  }
               }
            }

            // Acak urutan grup terpilih, lalu ratakan (flatten)
            selectedGroups.sort(() => Math.random() - 0.5);
            let finalQuestions = [];
            selectedGroups.forEach(grp => { finalQuestions = finalQuestions.concat(grp); });

            const orderIds = finalQuestions.map(q => q.id);
            localStorage.setItem(`${storageKey}_order`, JSON.stringify(orderIds));
            setQuestions(finalQuestions);
          }
        }
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  }, [studentData, storageKey]);

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

        if (data.broadcast && data.broadcast !== lastBroadcast) {
          setLastBroadcast(data.broadcast);
          setShowBroadcast(true);
        }
      }
    });
    return () => unsub();
  }, [sid, isLocked, storageKey, lastBroadcast]);

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

  // === V3: UNIFIED ANSWER HANDLER ===
  const updateAnswer = (qId, value) => {
    const newAns = { ...answers, [qId]: value }; 
    setAnswers(newAns); 
    localStorage.setItem(`${storageKey}_ans`, JSON.stringify(newAns));
    
    if (isOnline) {
      update(ref(db, `live_students/${sid}`), { progress: Math.round((Object.keys(newAns).length / questions.length) * 100) })
        .catch(() => { /* Abaikan error koneksi sementara */ });
    }
  };

  const handleSelectPG = (qId, opt) => updateAnswer(qId, opt);

  const handleSelectPGK = (qId, opt) => {
    const currentAns = answers[qId] ? answers[qId].split(',') : [];
    let newAnsArray;
    if (currentAns.includes(opt)) newAnsArray = currentAns.filter(item => item !== opt);
    else newAnsArray = [...currentAns, opt];
    
    updateAnswer(qId, newAnsArray.sort().join(','));
  };

  const handleEsaiChange = (qId, text) => updateAnswer(qId, text);

  const toggleRagu = (qId) => {
    const newRagu = { ...ragu, [qId]: !ragu[qId] };
    setRagu(newRagu); localStorage.setItem(`${storageKey}_ragu`, JSON.stringify(newRagu));
  };

  // === V3: LOGIKA SKORING PARSIAL ===
  const submitExam = async () => {
    if (!isOnline) {
      alert("🚨 KONEKSI TERPUTUS!\nSistem tidak dapat mengumpulkan jawaban karena Anda sedang offline. Mohon periksa kembali koneksi internet/WiFi Anda.\n\nSemua jawaban Anda aman tersimpan di perangkat.");
      return;
    }

    const finalAnswers = answersRef.current;
    let earnedPoints = 0;
    let totalObjective = 0;

    questions.forEach(q => {
        const type = q.jenisSoal || 'PG';
        if (type === 'ESAI') return; // Esai dinilai manual nanti

        totalObjective++;
        const studentAns = finalAnswers[q.id] || '';

        if (type === 'PG') {
            if (studentAns === q.kunci) earnedPoints++;
        } else if (type === 'PGK') {
            const keys = q.kunci ? q.kunci.split(',') : [];
            const ans = studentAns ? studentAns.split(',') : [];
            if (keys.length === 0) return;
            
            let correctCount = 0;
            let wrongCount = 0;
            ans.forEach(a => { if (keys.includes(a)) correctCount++; else wrongCount++; });
            
            // Skor Proporsional PGK (Min 0)
            let point = (correctCount / keys.length) - (wrongCount / keys.length);
            if (point < 0) point = 0;
            earnedPoints += point;
        }
    });

    const score = totalObjective > 0 ? Math.round((earnedPoints / totalObjective) * 100) : 0;
    
    try {
      // WAJIB SIMPAN ANSWERS KE LEADERBOARD AGAR GURU BISA KOREKSI ESAI!
      await push(ref(db, 'leaderboard'), { ...studentData, score, answers: finalAnswers, timestamp: Date.now() });
      await update(ref(db, `live_students/${sid}`), { status: 'Selesai' });
      
      localStorage.removeItem(`${storageKey}_ans`); 
      localStorage.removeItem(`${storageKey}_ragu`);
      localStorage.removeItem(`${storageKey}_time`); 
      localStorage.removeItem(`${storageKey}_warn`);
      localStorage.removeItem(`${storageKey}_lock`);
      localStorage.removeItem(`${storageKey}_order`); 
      
      if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
      onFinish(score);
    } catch (error) {
      alert("Gagal mengumpulkan ujian. Pastikan koneksi stabil dan coba lagi.");
    }
  };

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
      Menyiapkan Naskah Soal & Mengacak...
    </div>
  );

  const q = questions[currentIndex];
  const qType = q.jenisSoal || 'PG';

  return (
    <div 
      onCopy={(e) => { e.preventDefault(); alert("Tindakan disalin telah diblokir!"); }} 
      onPaste={(e) => e.preventDefault()} 
      onContextMenu={(e) => e.preventDefault()} 
      className="min-h-screen bg-[#f8fafc] font-sans pb-28 select-none relative overflow-x-hidden"
    >
      {/* Watermark Identitas Siswa */}
      <div className="pointer-events-none fixed inset-0 z-0 flex flex-col items-center justify-center opacity-[0.03] rotate-[-30deg] text-black font-black text-3xl whitespace-nowrap overflow-hidden">
        {Array(10).fill(`${studentData?.name} - ${studentData?.class} `).map((text, i) => (
          <div key={i} className="mb-10">{text.repeat(5)}</div>
        ))}
      </div>

      <div className={`relative z-10 transition-all duration-300 min-h-screen flex flex-col ${isBlurred ? 'blur-2xl grayscale brightness-50' : ''}`}>
        
        <header className="sticky top-0 z-40 bg-white w-full shadow-md border-b-4 border-emerald-500">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left flex-1">
              <h1 className="font-black text-[15px] sm:text-lg tracking-widest text-emerald-700 leading-tight">YASPENDIK PTP NUSANTARA IV</h1>
              <h2 className="font-bold text-[10px] sm:text-xs tracking-widest text-slate-500 mt-0.5">SMP/MTS DARMA PERTIWI BAH BUTONG</h2>
            </div>
            <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-6 bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200">
              <div className="text-left">
                <p className="font-black text-sm sm:text-base text-slate-800 leading-tight truncate max-w-[180px] sm:max-w-[250px]">{studentData?.name}</p>
                <p className="text-[10px] sm:text-xs text-emerald-600 font-bold mt-0.5 uppercase tracking-wider">
                  Kelas {studentData?.class}-{studentData?.subKelas} • {studentData?.mapel}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 sm:gap-2 bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-emerald-600 font-mono font-black text-lg sm:text-xl border border-emerald-100 shadow-sm">
                  <Timer size={20} className="text-emerald-500 hidden sm:block" />
                  {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
                </div>
                {isOnline ? (
                   <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Wifi size={10} /> TERHUBUNG</span>
                ) : (
                   <span className="text-[9px] sm:text-[10px] font-bold text-red-500 flex items-center gap-1 animate-pulse"><WifiOff size={10} /> OFFLINE</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="bg-red-50 border-b border-red-200 p-2 text-center text-red-600 text-xs sm:text-sm font-bold shadow-inner">
             ⚠️ KONEKSI TERPUTUS! Anda masih bisa menjawab. Jawaban otomatis tersimpan di perangkat.
          </div>
        )}

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6 mt-2">
          
          <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-2 h-full ${qType === 'PG' ? 'bg-blue-500' : qType === 'PGK' ? 'bg-orange-500' : 'bg-purple-500'}`}></div>
            
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2 border-b border-slate-100 pb-4">
               <span className="inline-block text-xs font-black bg-slate-100 text-slate-800 px-4 py-2 rounded-xl border border-slate-200 uppercase tracking-widest">
                  Soal No. {currentIndex+1} / {questions.length}
               </span>
               
               {/* V3: LABEL DINAMIS TIPE SOAL */}
               {qType === 'PG' && <span className="text-xs font-black bg-blue-50 text-blue-800 px-4 py-2 rounded-xl border border-blue-200 uppercase tracking-widest">PILIHAN GANDA</span>}
               {qType === 'PGK' && <span className="text-xs font-black bg-orange-50 text-orange-800 px-4 py-2 rounded-xl border border-orange-200 uppercase tracking-widest flex items-center gap-2"><Check size={14}/> PILIHAN GANDA KOMPLEKS</span>}
               {qType === 'ESAI' && <span className="text-xs font-black bg-purple-50 text-purple-800 px-4 py-2 rounded-xl border border-purple-200 uppercase tracking-widest">SOAL ESAI (URAIAN)</span>}
            </div>

            {/* V3: BLOK WACANA BACAAN (JIKA ADA) */}
            {q.teksWacana && (
              <div className="mb-6 p-5 sm:p-6 bg-slate-50 border-l-4 border-slate-400 rounded-r-2xl text-sm sm:text-base font-medium text-slate-700 shadow-inner">
                 <Latex>{String(q.teksWacana)}</Latex>
              </div>
            )}
            
            {q.gambar && (
              <div className="mb-6 flex justify-center">
                <img src={q.gambar} alt="Gambar Soal Ujian" className="max-w-full max-h-80 rounded-2xl border border-slate-200 shadow-sm object-contain" />
              </div>
            )}
            
            <div className="text-lg md:text-2xl font-semibold mb-8 text-slate-800 leading-relaxed break-words">
              <Latex>{String(q.pertanyaan || ' ')}</Latex>
            </div>
            
            {/* V3: RENDER INPUT BERDASARKAN TIPE SOAL */}
            {qType === 'PG' && (
                <div className="space-y-4">
                {['A','B','C','D'].map(opt => (
                    <button key={opt} onClick={() => handleSelectPG(q.id, opt)} className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 break-words ${answers[q.id]===opt ? 'bg-blue-50 border-blue-500 shadow-md shadow-blue-500/10 text-blue-900 font-bold':'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                    <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg shrink-0 transition-colors ${answers[q.id]===opt?'bg-blue-500 text-white shadow-inner':'bg-slate-100 text-slate-500 border border-slate-200'}`}>{opt}</span>
                    <div className="flex-1 text-base md:text-lg pt-1.5"><Latex>{String(q[`opsi${opt}`] || ' ')}</Latex></div>
                    </button>
                ))}
                </div>
            )}

            {qType === 'PGK' && (
                <div className="space-y-4">
                <p className="text-xs font-bold text-orange-600 mb-2">* Anda dapat mencentang lebih dari satu jawaban yang benar.</p>
                {['A','B','C','D'].map(opt => {
                    const isSelected = answers[q.id] && answers[q.id].split(',').includes(opt);
                    return (
                    <button key={opt} onClick={() => handleSelectPGK(q.id, opt)} className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 break-words ${isSelected ? 'bg-orange-50 border-orange-500 shadow-md shadow-orange-500/10 text-orange-900 font-bold':'bg-white border-slate-200 hover:border-orange-300 hover:bg-slate-50'}`}>
                    <div className={`w-8 h-8 flex flex-shrink-0 items-center justify-center rounded-xl border-2 mt-0.5 transition-colors ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-slate-100 border-slate-300'}`}>
                        {isSelected && <Check size={20} strokeWidth={4} />}
                    </div>
                    <div className="flex-1 text-base md:text-lg pt-0.5">
                        <span className="font-black mr-3 opacity-50">{opt}.</span>
                        <Latex>{String(q[`opsi${opt}`] || ' ')}</Latex>
                    </div>
                    </button>
                )})}
                </div>
            )}

            {qType === 'ESAI' && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-purple-600 mb-2">* Ketik jawaban uraian Anda di dalam kotak di bawah ini.</p>
                    <textarea 
                        value={answers[q.id] || ''} 
                        onChange={(e) => handleEsaiChange(q.id, e.target.value)}
                        placeholder="Ketik jawaban Anda di sini..."
                        className="w-full min-h-[200px] p-5 rounded-2xl border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none text-base md:text-lg text-slate-800 transition-all bg-white"
                    />
                </div>
            )}

          </div>

          <div className="flex flex-wrap gap-3 md:gap-4 mb-10">
            <button disabled={currentIndex===0} onClick={() => setCurrentIndex(currentIndex-1)} className="flex-1 min-w-[120px] p-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all hover:bg-slate-50 tracking-wider"><ChevronLeft size={24}/> <span className="hidden sm:inline">SEBELUMNYA</span></button>
            <button onClick={() => toggleRagu(q.id)} className={`flex-1 min-w-[120px] p-5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all tracking-wider ${ragu[q.id] ? 'bg-amber-400 text-white shadow-amber-400/40 border-2 border-amber-500' : 'bg-white border border-slate-200 text-amber-500 hover:bg-amber-50'}`}><HelpCircle size={24}/> RAGU-RAGU</button>
            <button disabled={currentIndex===questions.length-1} onClick={() => setCurrentIndex(currentIndex+1)} className="flex-1 min-w-[120px] p-5 bg-emerald-600 text-white rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all hover:bg-emerald-500 tracking-wider"><span className="hidden sm:inline">SELANJUTNYA</span> <ChevronRight size={24}/></button>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 tracking-wide uppercase"><Book size={20} className="text-emerald-500"/> Peta Navigasi Soal</h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3 mb-10">
              {questions.map((quest, idx) => {
                let btnClass = 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100';
                
                // V3: Logika warna tombol navigasi yang lebih clean (Biru tua untuk sudah dijawab)
                if (ragu[quest.id]) {
                    btnClass = 'bg-amber-400 border-amber-500 text-white shadow-md shadow-amber-400/30';
                } else if (answers[quest.id] && answers[quest.id].trim() !== '') {
                    btnClass = 'bg-slate-800 border-slate-900 text-white shadow-md shadow-slate-800/30';
                }
                
                if (currentIndex === idx) btnClass += ' ring-4 ring-emerald-500/50 ring-offset-2 scale-110 z-10';
                return (<button key={idx} onClick={() => setCurrentIndex(idx)} className={`h-12 md:h-14 rounded-xl flex items-center justify-center text-base font-black border transition-all ${btnClass}`}>{idx + 1}</button>);
              })}
            </div>
            <button onClick={() => { if(window.confirm("Peringatan!\nAnda yakin ingin mengakhiri ujian dan mengumpulkan jawaban secara permanen?")) submitExam() }} className="w-full p-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all tracking-widest text-lg"><ShieldAlert size={24}/> KUMPULKAN UJIAN SEKARANG</button>
          </div>

        </main>
      </div>

      {/* POPUP PENGUMUMAN DARURAT */}
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

      {/* OVERLAY SENSOR KECURANGAN (BLUR) */}
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
