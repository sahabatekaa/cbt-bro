// src/pages/student/ExamRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db, getTenantPath } from '../../config/firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { Timer, AlertTriangle, Book, ChevronLeft, ChevronRight, HelpCircle, Maximize, ShieldAlert, Landmark, Bell, Wifi, WifiOff, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function ExamRoom({ onFinish }) {
  const { userData, tenantData } = useAuth();
  const schoolId = userData?.schoolId;
  const sid = userData?.id || 'guest';
  const studentName = userData?.name || 'Siswa';
  const storageKey = `cbt_v3_exam_${sid}`;

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

  // MONITOR KONEKSI
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

  // LOAD DATA SAAS (TERISOLASI)
  useEffect(() => {
    if (!schoolId || !userData?.token) return;

    // 1. Ambil Info Sesi (Untuk Waktu & Kuota)
    const sessionRef = ref(db, getTenantPath(schoolId, 'exam_sessions'));
    onValue(sessionRef, (sessionSnap) => {
      let sessionInfo = null;
      sessionSnap.forEach(s => { if (s.val().token === userData.token) sessionInfo = s.val(); });
      
      if (sessionInfo && sessionInfo.jamSelesai) {
        const calculateRemaining = () => {
          const now = new Date();
          const [h, m] = sessionInfo.jamSelesai.split(':');
          const target = new Date();
          target.setHours(parseInt(h, 10), parseInt(m, 10), 0);
          const diffSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);
          return diffSeconds > 0 ? diffSeconds : 0;
        };
        const remaining = calculateRemaining();
        setTimeLeft(remaining);
        if (remaining <= 0) submitExam();
      }

      // 2. Ambil Bank Soal Khusus Sekolah
      const bankRef = ref(db, getTenantPath(schoolId, 'bank_soal'));
      onValue(bankRef, (snap) => {
        if (snap.exists()) {
          const allQ = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
          const filtered = allQ.filter(q => q.mapel === userData?.mapel && q.kelas === userData?.class);
          
          const savedOrder = localStorage.getItem(`${storageKey}_order`);
          if (savedOrder) {
            const orderIds = JSON.parse(savedOrder);
            setQuestions(orderIds.map(id => filtered.find(q => q.id === id)).filter(Boolean));
          } else {
            // Logika Acak & Pengelompokan Wacana tetap kita pertahankan (V2 Logic)
            const groups = {};
            filtered.forEach(q => {
              const kw = q.kodeWacana || `single_${q.id}`;
              if (!groups[kw]) groups[kw] = [];
              groups[kw].push(q);
            });
            const groupKeys = Object.keys(groups).sort(() => Math.random() - 0.5);
            let finalQuestions = [];
            groupKeys.forEach(k => { finalQuestions = finalQuestions.concat(groups[k]); });
            
            localStorage.setItem(`${storageKey}_order`, JSON.stringify(finalQuestions.map(q => q.id)));
            setQuestions(finalQuestions);
          }
        }
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  }, [schoolId, userData, storageKey]);

  // LIVE MONITORING (PROCTORING)
  useEffect(() => {
    if (!schoolId || !sid) return;
    const unsub = onValue(ref(db, getTenantPath(schoolId, `live_students/${sid}`)), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.warnings === 0 && isLocked) {
          setWarnings(0); setIsLocked(false);
          localStorage.setItem(`${storageKey}_warn`, 0); localStorage.setItem(`${storageKey}_lock`, 'false');
        }
        if (data.forceSubmit === true) setShouldForceSubmit(true);
        if (data.broadcast && data.broadcast !== lastBroadcast) {
          setLastBroadcast(data.broadcast);
          setShowBroadcast(true);
        }
      }
    });
    return () => unsub();
  }, [schoolId, sid, isLocked, storageKey, lastBroadcast]);

  // SENSOR ANTI-CHEAT (V3.1 STRICT)
  const triggerWarning = (reason) => {
    if (!isFullscreen && !forceAllowFullscreen) return;
    const newWarn = warnings + 1;
    setWarnings(newWarn);
    localStorage.setItem(`${storageKey}_warn`, newWarn);
    update(ref(db, getTenantPath(schoolId, `live_students/${sid}`)), { warnings: newWarn, status: reason }); 
    if(newWarn >= 3) { setIsLocked(true); localStorage.setItem(`${storageKey}_lock`, 'true'); } 
    alert(`PERINGATAN KECURANGAN ${newWarn}/3!\nPelanggaran: ${reason}`);
  };

  useEffect(() => {
    const handleVisibilityChange = () => { 
        if(document.hidden && !isLocked && (isFullscreen || forceAllowFullscreen)) {
            triggerWarning("Meninggalkan Halaman"); 
        }
    };
    const handleBlur = () => { if(!isLocked && !document.hidden) setIsBlurred(true); };
    const handleFocus = () => { setIsBlurred(false); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [warnings, isLocked, isFullscreen, forceAllowFullscreen]);

  const enterFullscreen = () => { 
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => setForceAllowFullscreen(true));
    } else { setForceAllowFullscreen(true); }
  };

  // TIMER & AUTO SUBMIT
  useEffect(() => {
    if (timeLeft > 0 && !isLocked && questions.length > 0 && (isFullscreen || forceAllowFullscreen) && !shouldForceSubmit) { 
      const t = setTimeout(() => { setTimeLeft(timeLeft - 1); localStorage.setItem(`${storageKey}_time`, timeLeft - 1); }, 1000); 
      return () => clearTimeout(t); 
    } 
    else if ((timeLeft <= 0 || shouldForceSubmit) && questions.length > 0) submitExam();
  }, [timeLeft, isLocked, questions, isFullscreen, forceAllowFullscreen, shouldForceSubmit]);

  const updateAnswer = (qId, value) => {
    const newAns = { ...answers, [qId]: value }; 
    setAnswers(newAns); 
    localStorage.setItem(`${storageKey}_ans`, JSON.stringify(newAns));
    if (isOnline) {
      update(ref(db, getTenantPath(schoolId, `live_students/${sid}`)), { 
        progress: Math.round((Object.keys(newAns).length / questions.length) * 100) 
      });
    }
  };

  const submitExam = async () => {
    if (!isOnline) return alert("🚨 KONEKSI TERPUTUS! Hubungkan internet untuk mengirim jawaban.");
    
    let earnedPoints = 0;
    let totalObjective = 0;
    questions.forEach(q => {
        if (q.jenisSoal === 'ESAI') return; 
        totalObjective++;
        const studentAns = answersRef.current[q.id] || '';
        if (q.jenisSoal === 'PG' && studentAns === q.kunci) earnedPoints++;
        else if (q.jenisSoal === 'PGK') {
            const keys = q.kunci?.split(',') || [];
            const ans = studentAns?.split(',') || [];
            let correct = ans.filter(a => keys.includes(a)).length;
            let wrong = ans.filter(a => !keys.includes(a)).length;
            let point = (correct / keys.length) - (wrong / keys.length);
            earnedPoints += Math.max(0, point);
        }
    });

    const score = totalObjective > 0 ? Math.round((earnedPoints / totalObjective) * 100) : 0;
    
    try {
      await push(ref(db, getTenantPath(schoolId, 'leaderboard')), { 
        ...userData, score, answers: answersRef.current, timestamp: Date.now() 
      });
      await update(ref(db, getTenantPath(schoolId, `live_students/${sid}`)), { status: 'Selesai' });
      
      localStorage.clear(); // Bersihkan storage lokal setelah submit
      if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
      onFinish(score);
    } catch (error) { alert("Gagal mengirim jawaban!"); }
  };

  if (isLocked) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 p-6 text-center select-none overflow-hidden">
      <ShieldAlert size={100} className="text-red-500 mb-6 animate-pulse" />
      <h1 className="text-4xl font-black text-white tracking-widest mb-2">UJIAN DIBLOKIR!</h1>
      <p className="text-red-400 font-bold text-xl">Pelanggaran Keamanan Terdeteksi.</p>
      <p className="text-white mt-4 opacity-70">Bawa perangkat Anda ke meja Pengawas untuk membuka kunci.</p>
    </div>
  );

  if (!isFullscreen && !forceAllowFullscreen && questions.length > 0) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
      <Maximize size={80} className="mb-6 text-emerald-400 animate-bounce" />
      <h1 className="text-3xl font-black mb-4 uppercase">Mode Keamanan</h1>
      <button onClick={enterFullscreen} className="bg-emerald-600 px-10 py-5 rounded-2xl font-black text-xl active:scale-95 shadow-xl">MASUK UJIAN</button>
    </div>
  );

  if (questions.length === 0) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50 font-bold animate-pulse">Menyiapkan Naskah Soal...</div>;

  const q = questions[currentIndex];

  return (
    <div translate="no" className="notranslate min-h-screen bg-[#f8fafc] font-sans pb-28 select-none relative overflow-x-hidden">
      {/* WATERMARK BACKGROUND (V3 PROPER) */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] rotate-[-30deg] text-black font-black text-3xl flex flex-wrap justify-center content-center">
        {Array(20).fill(`${studentName} `).map((t, i) => <span key={i} className="m-10">{t}</span>)}
      </div>

      <div className={`relative z-10 transition-all duration-500 ${isBlurred ? 'blur-3xl grayscale brightness-50' : ''}`}>
        <header className="sticky top-0 z-40 bg-white w-full shadow-md border-b-4 border-emerald-500">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <h1 className="font-black text-emerald-700 leading-tight uppercase">{tenantData?.schoolName || 'CBT SYSTEM'}</h1>
              <p className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">{studentName} • {userData?.mapel}</p>
            </div>
            <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200">
                <div className="font-mono font-black text-xl text-emerald-600">
                    {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
                </div>
                {isOnline ? <Wifi size={18} className="text-emerald-500" /> : <WifiOff size={18} className="text-red-500 animate-pulse" />}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto w-full p-4 md:p-6 mt-4">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-2 h-full ${q.jenisSoal === 'PG' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
            <div className="flex justify-between mb-6">
                <span className="bg-slate-100 text-slate-800 px-4 py-1.5 rounded-full text-xs font-black">SOAL {currentIndex+1} / {questions.length}</span>
                <span className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-black uppercase">{q.jenisSoal || 'PG'}</span>
            </div>

            {q.teksWacana && <div className="mb-6 p-5 bg-slate-50 border-l-4 border-slate-300 rounded-r-2xl text-sm italic"><Latex>{String(q.teksWacana)}</Latex></div>}
            {q.gambar && <img src={q.gambar} className="mb-6 max-h-64 mx-auto rounded-2xl border shadow-sm" alt="Soal" />}
            
            <div className="text-xl md:text-2xl font-bold mb-8 text-slate-800 leading-relaxed"><Latex>{String(q.pertanyaan || '')}</Latex></div>

            {q.jenisSoal !== 'ESAI' ? (
                <div className="space-y-4">
                    {['A','B','C','D'].map(opt => {
                        const isSelected = q.jenisSoal === 'PGK' ? answers[q.id]?.split(',').includes(opt) : answers[q.id] === opt;
                        return (
                            <button key={opt} onClick={() => q.jenisSoal === 'PGK' ? 
                                updateAnswer(q.id, answers[q.id]?.split(',').includes(opt) ? answers[q.id].split(',').filter(x => x!==opt).join(',') : [...(answers[q.id]?.split(',').filter(Boolean) || []), opt].sort().join(',')) 
                                : updateAnswer(q.id, opt)} 
                                className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-100 bg-white hover:border-emerald-200'}`}>
                                <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{opt}</span>
                                <Latex>{String(q[`opsi${opt}`] || '')}</Latex>
                            </button>
                        )
                    })}
                </div>
            ) : (
                <textarea value={answers[q.id] || ''} onChange={e => updateAnswer(q.id, e.target.value)} placeholder="Ketik jawaban uraian..." className="w-full min-h-[200px] p-5 rounded-3xl border-2 border-slate-200 outline-none focus:border-emerald-500" />
            )}
          </div>

          <div className="flex gap-4 mb-8">
            <button disabled={currentIndex===0} onClick={() => setCurrentIndex(currentIndex-1)} className="flex-1 p-5 bg-white border rounded-2xl font-black active:scale-95 transition-all shadow-sm">KEMBALI</button>
            <button onClick={() => toggleRagu(q.id)} className={`flex-1 p-5 rounded-2xl font-black shadow-sm ${ragu[q.id] ? 'bg-amber-400 text-white' : 'bg-white border text-amber-500'}`}>RAGU-RAGU</button>
            <button disabled={currentIndex===questions.length-1} onClick={() => setCurrentIndex(currentIndex+1)} className="flex-1 p-5 bg-emerald-600 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg">LANJUT</button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <h3 className="font-black text-slate-800 mb-6 uppercase text-sm tracking-widest flex gap-2"><Book size={18} className="text-emerald-500" /> Navigasi Naskah</h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
              {questions.map((quest, idx) => (
                <button key={idx} onClick={() => setCurrentIndex(idx)} className={`h-12 rounded-xl text-sm font-black border transition-all ${currentIndex === idx ? 'ring-4 ring-emerald-500/30 border-emerald-500 bg-emerald-500 text-white' : (answers[quest.id] ? 'bg-slate-800 text-white border-slate-900' : 'bg-slate-50 text-slate-400')}`}>
                    {idx + 1}
                </button>
              ))}
            </div>
            {timeLeft <= 600 && (
                <button onClick={() => window.confirm("Kumpulkan sekarang?") && submitExam()} className="w-full mt-8 p-5 bg-red-600 text-white rounded-2xl font-black shadow-xl animate-pulse">KUMPULKAN UJIAN</button>
            )}
          </div>
        </main>
      </div>

      {showBroadcast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border-4 border-blue-500 text-center">
            <Bell size={48} className="mx-auto text-blue-500 mb-4 animate-bounce" />
            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">INSTRUKSI PENGAWAS</h3>
            <div className="bg-slate-50 p-4 rounded-2xl border italic font-bold text-slate-700 mb-6">"{lastBroadcast}"</div>
            <button onClick={() => setShowBroadcast(false)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black active:scale-95">SAYA MENGERTI</button>
          </div>
        </div>
      )}
    </div>
  );
}