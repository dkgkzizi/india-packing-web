'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Link as LinkIcon, 
  CheckCircle2, 
  ArrowRight, 
  Upload, 
  FileSpreadsheet, 
  FileCheck, 
  Download, 
  Loader2, 
  AlertCircle,
  Clock,
  ShieldCheck,
  Zap,
  RotateCcw,
  Play
} from 'lucide-react';

interface ProgressStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

export default function PackingListApp() {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [activeTab, setActiveTab] = useState<'convert' | 'match' | 'verify'>('convert');
  const [file, setFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null); 
  
  const [sourcePdf, setSourcePdf] = useState<File | null>(null);
  const [convertedExcel, setConvertedExcel] = useState<File | null>(null);
  const [matchedExcel, setMatchedExcel] = useState<File | null>(null);

  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; filePath?: string; message?: string; stats?: any } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);

  // 탭 클릭 시 (수동 모드용)
  const handleTabChange = (tab: 'convert' | 'match' | 'verify') => {
    setActiveTab(tab);
    setResult(null);
    setProgress([]);
    
    if (tab === 'convert') {
      setFile(sourcePdf);
    } else if (tab === 'match') {
      setFile(convertedExcel);
    } else if (tab === 'verify') {
      setFile(sourcePdf);
      setSecondFile(matchedExcel);
    }
  };

  const handleFileProcess = (incomingFile: File, num: 1 | 2 = 1) => {
    if (num === 1) {
      setFile(incomingFile);
      if (activeTab === 'convert') setSourcePdf(incomingFile);
      if (activeTab === 'match') setConvertedExcel(incomingFile);
    } else {
      setSecondFile(incomingFile);
      if (activeTab === 'verify') setMatchedExcel(incomingFile);
    }
  };

  const onDrop = (e: React.DragEvent, num: 1 | 2 = 1) => {
    e.preventDefault();
    setIsDragging(false);
    setIsDragging2(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0], num);
    }
  };

  const executeApiCall = async (type: 'convert' | 'match' | 'verify', f1: File | null, f2: File | null) => {
    if (!f1) throw new Error('파일이 필요합니다.');
    const formData = new FormData();
    if (type === 'convert') formData.append('pdf', f1);
    else if (type === 'match') formData.append('excel', f1);
    else {
      formData.append('pdf', f1);
      if (f2) formData.append('excel', f2);
      else throw new Error('검증용 엑셀 파일이 필요합니다.');
    }

    const response = await fetch(`/api/${type}`, { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '요청 실패' }));
      throw new Error(err.message || '오류 발생');
    }
    return response;
  };

  const startTask = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      if (mode === 'manual') {
        // --- MANUAL MODE ---
        setActiveTab(activeTab); // Ensure UI sync
        await runSingleStep(activeTab, file, secondFile);
      } else {
        // --- AUTO MODE (Sequential Process) ---
        // 1. Convert
        setActiveTab('convert');
        const cFile = await runSingleStep('convert', sourcePdf!, null);
        
        // 2. Match
        setActiveTab('match');
        const mFile = await runSingleStep('match', cFile, null);
        
        // 3. Verify
        setActiveTab('verify');
        await runSingleStep('verify', sourcePdf!, mFile);
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runSingleStep = async (type: 'convert' | 'match' | 'verify', f1: File, f2: File | null) => {
    const steps: Record<string, string[]> = {
      convert: ['PDF 업로드 중...', '데이터 추출 중...', '엑셀 변환 중...'],
      match: ['엑셀 업로드 중...', '구글 시트 매칭 중...', '데이터 정렬 중...'],
      verify: ['데이터 비교 중...', '수량 정밀 분석 중...', '최종 리포트 생성 중...']
    };
    
    setProgress(steps[type].map(s => ({ label: s, status: 'pending' })));
    setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
    
    const response = await executeApiCall(type, f1, f2);
    
    setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'loading' } : s));
    await new Promise(r => setTimeout(r, 600));
    setProgress(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'loading' } : s));

    if (type === 'verify') {
      const data = await response.json();
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ success: true, message: '검증 완료!', stats: data });
      return null as any;
    }

    const blob = await response.blob();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const originalName = f1.name.split('.').slice(0, -1).join('.');
    const prefix = type === 'convert' ? 'Packing' : 'Matched';
    const finalFileName = `${today}_${originalName}_${prefix}.xlsx`;
    
    const resFile = new File([blob], finalFileName, { type: blob.type });
    if (type === 'convert') {
      setConvertedExcel(resFile);
      setFile(resFile); // Set for next UI
    } else {
      setMatchedExcel(resFile);
      setSecondFile(resFile); // Set for next UI
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFileName;
    link.click();
    window.URL.revokeObjectURL(url);
    
    setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
    setResult({ success: true, message: '완료!', filePath: finalFileName });
    return resFile;
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-200 font-sans">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 fill-current" />
            <span>Smart AI Packing List Solutions</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6">India Logistic <span className="text-indigo-400">Auto-Pass</span></h1>
          
          {/* AUTO / MANUAL TOGGLE */}
          <div className="inline-flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700 mx-auto shadow-2xl">
            <button 
              onClick={() => { setMode('auto'); setActiveTab('convert'); }}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'auto' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <RotateCcw className={`w-4 h-4 ${loading && mode === 'auto' ? 'animate-spin' : ''}`} /> 전공정 자동 (Auto)
            </button>
            <button 
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <ArrowRight className="w-4 h-4" /> 단계별 수동 (Manual)
            </button>
          </div>
        </header>

        {mode === 'manual' && (
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mb-8 max-w-md mx-auto animate-in fade-in slide-in-from-top-4">
            {[{ id: 'convert', label: '1. PDF 변환', icon: FileText }, { id: 'match', label: '2. 데이터 매칭', icon: LinkIcon }, { id: 'verify', label: '3. 수량 검증', icon: FileCheck }].map(tab => (
              <button key={tab.id} onClick={() => handleTabChange(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><tab.icon className="w-4 h-4" /><span>{tab.label}</span></button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
               {mode === 'auto' && <div className="absolute top-0 right-0 p-4"><span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span></div>}
               
               <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                 {mode === 'auto' ? <><Play className="text-indigo-400" /> 자동 공정 파일 업로드</> : (activeTab === 'convert' ? '1단계: PDF 파일 업로드' : activeTab === 'match' ? '2단계: 매칭할 엑셀 선택' : '3단계: 데이터 검증')}
               </h2>

               <div className="space-y-4">
                 <div 
                   onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                   onDragLeave={() => setIsDragging(false)}
                   onDrop={(e) => onDrop(e, 1)}
                   onClick={() => document.getElementById('file-input')?.click()}
                   className={`border-3 border-dashed rounded-3xl p-12 transition-all text-center cursor-pointer ${isDragging || file ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500'}`}
                 >
                   <input id="file-input" type="file" className="hidden" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0], 1)} />
                   {file ? (
                     <div className="space-y-4">
                       <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-in zoom-in-75">
                         {file.name.endsWith('.pdf') ? <FileText className="text-white w-10 h-10" /> : <FileSpreadsheet className="text-white w-10 h-10" />}
                       </div>
                       <p className="text-xl font-bold text-white truncate max-w-lg mx-auto">{file.name}</p>
                       <p className="text-slate-400 text-sm">준비 완료. {mode === 'auto' ? '전체 공정을 시작하세요.' : '작업을 실행하세요.'}</p>
                     </div>
                   ) : (
                     <div className="space-y-4 py-8">
                       <Upload className="text-slate-500 w-16 h-16 mx-auto opacity-30" />
                       <p className="text-slate-300 text-lg font-bold">여기에 파일을 끌어다 놓으세요</p>
                       <p className="text-slate-500 text-sm">{mode === 'auto' ? 'PDF 파일 하나로 모든 공정을 완료합니다.' : '파일을 선택하여 수동 작업을 시작합니다.'}</p>
                     </div>
                   )}
                 </div>

                 {mode === 'manual' && activeTab === 'verify' && (
                    <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
                    onDragLeave={() => setIsDragging2(false)}
                    onDrop={(e) => onDrop(e, 2)}
                    onClick={() => document.getElementById('file-input-2')?.click()}
                    className={`border-3 border-dashed rounded-3xl p-12 transition-all text-center cursor-pointer ${isDragging2 || secondFile ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 hover:border-slate-500'}`}
                  >
                    <input id="file-input-2" type="file" className="hidden" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0], 2)} />
                    {secondFile ? (
                      <div className="space-y-4"><div className="w-20 h-20 bg-cyan-600 rounded-3xl animate-in zoom-in-75 flex items-center justify-center mx-auto"><FileSpreadsheet className="text-white w-10 h-10" /></div><p className="text-white font-bold truncate max-w-lg mx-auto">{secondFile.name}</p></div>
                    ) : (
                      <div className="space-y-4 py-8"><FileSpreadsheet className="text-slate-500 w-16 h-16 mx-auto opacity-30" /><p className="text-slate-300 text-lg font-bold">검증할 매칭 엑셀 파일을 여기에 놓으세요</p></div>
                    )}
                  </div>
                 )}

                 <button 
                   disabled={!file || (mode === 'manual' && activeTab === 'verify' && !secondFile) || loading} 
                   onClick={startTask} 
                   className={`w-full h-20 rounded-3xl font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 ${loading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:scale-[1.02] active:scale-95'}`}
                 >
                   {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <><Play className="w-6 h-6 fill-current" /> <span>{mode === 'auto' ? '풀오토 프로세스 시작' : '현재 단계 실행'}</span></>}
                 </button>
               </div>
            </div>

            {/* Verification Result Area */}
            {result && result.stats && (
               <div className="bg-slate-800/60 border border-indigo-500/40 rounded-3xl p-10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-12 duration-1000">
                  <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                    <div className="flex items-center gap-4"><div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20"><ShieldCheck className="text-slate-900 w-8 h-8" /></div><h3 className="text-3xl font-black text-white tracking-tight">검증 리포트</h3></div>
                    <div className={`px-8 py-4 rounded-2xl font-black text-2xl border-2 ${result.stats.pdfTotal === result.stats.excelTotal ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                      {result.stats.pdfTotal === result.stats.excelTotal ? `수량 일치 ✔ (${result.stats.pdfTotal}개)` : `수량 불일치 ✘`}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 rounded-3xl border border-slate-700/50 overflow-hidden shadow-inner">
                    <div className="grid grid-cols-12 bg-slate-800/80 px-8 py-5 border-b border-white/5 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                       <div className="col-span-8">상품 정보 (Name / Color / Size)</div>
                       <div className="col-span-3 text-right">검수 수량</div>
                       <div className="col-span-1 text-center">결과</div>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500/40 scrollbar-track-transparent">
                      {result.stats.comparisons.map((c: any, i: number) => (
                        <div key={i} className="grid grid-cols-12 px-8 py-6 border-b border-white/5 hover:bg-white/5 transition-colors items-center">
                          <div className="col-span-8"><span className="text-lg text-slate-100 font-bold leading-relaxed truncate block" title={c.label}>{c.label}</span></div>
                          <div className="col-span-3 text-right tabular-nums"><span className="text-2xl font-black text-indigo-400">{c.excel}</span><span className="text-xs text-slate-500 ml-2 font-bold">PCS</span></div>
                          <div className="col-span-1 flex justify-center">{c.isMatch ? <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-slate-950 flex items-center justify-center font-black shadow-lg">O</div> : <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black shadow-lg">X</div>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 flex flex-col shadow-2xl h-fit">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 border-b border-white/5 pb-4">Live Status</h3>
              <div className="space-y-8">
                {progress.length === 0 && <div className="py-10 text-center"><div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5"><Clock className="text-slate-600 w-8 h-8" /></div><p className="text-slate-600 text-[11px] font-bold uppercase">Waiting for input</p></div>}
                {progress.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-5 group animate-in slide-in-from-left-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${step.status === 'done' ? 'bg-indigo-500 border-indigo-500 text-slate-900 shadow-lg shadow-indigo-500/20' : step.status === 'loading' ? 'bg-indigo-500/20 border-indigo-400 text-indigo-400 animate-pulse shadow-lg' : 'border-slate-700 text-slate-600'}`}>{step.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : step.status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : idx + 1}</div>
                    <span className={`text-sm font-black tracking-tight ${step.status === 'done' ? 'text-indigo-400' : step.status === 'loading' ? 'text-white' : 'text-slate-600'}`}>{step.label}</span>
                  </div>
                ))}
              </div>
              {result && !result.stats && (
                <div className="mt-12 p-8 rounded-3xl border bg-slate-800/80 border-indigo-500/30 animate-in zoom-in-95">
                  <div className="text-indigo-400 font-black text-lg mb-4 flex items-center gap-2"><CheckCircle2 className="w-6 h-6" /> TASK COMPLETED</div>
                  <div className="text-[10px] text-slate-500 mb-2 font-black uppercase tracking-widest">Saved Package</div>
                  <div className="text-xs text-white font-mono break-all p-4 bg-black/40 rounded-2xl border border-white/5">{result.filePath}</div>
                </div>
              )}
            </div>
            
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 shadow-2xl text-white">
              <h4 className="font-black text-xl mb-3">AI Pass Tips</h4>
              <p className="text-indigo-100 text-xs leading-relaxed opacity-80">파일을 드래그하여 올리면 더 빠르게 작업할 수 있습니다. 오류 발생 시 페이지를 새로고침하여 초기화해 주세요.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
