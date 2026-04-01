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

  useEffect(() => {
    if (activeTab === 'convert') setFile(sourcePdf);
    else if (activeTab === 'match') setFile(convertedExcel);
    else if (activeTab === 'verify') { setFile(sourcePdf); setSecondFile(matchedExcel); }
    setResult(null);
    setProgress([]);
  }, [activeTab]);

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
    setIsDragging(false); setIsDragging2(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0], num);
    }
  };

  const startTask = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      if (mode === 'manual') {
        await runSingleStep(activeTab, file, secondFile);
      } else {
        setActiveTab('convert');
        const cFile = await runSingleStep('convert', sourcePdf!, null);
        setActiveTab('match');
        const mFile = await runSingleStep('match', cFile, null);
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
      convert: ['PDF 업로드...', '데이터 추출...', '엑셀 변환...'],
      match: ['엑셀 업로드...', '시트 매칭...', '데이터 정렬...'],
      verify: ['데이터 비교...', '수량 분석...', '리포트 생성...']
    };
    
    setProgress(steps[type].map(s => ({ label: s, status: 'pending' })));
    setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
    
    const formData = new FormData();
    if (type === 'convert') formData.append('pdf', f1);
    else if (type === 'match') formData.append('excel', f1);
    else { formData.append('pdf', f1); if (f2) formData.append('excel', f2); }

    const response = await fetch(`/api/${type}`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('작업 실패');
    
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
    
    // 파일명에서 기존 접두사(날짜_ 등) 제거하여 깔끔하게 정리
    let cleanName = f1.name.split('.').slice(0, -1).join('.');
    cleanName = cleanName.replace(/^[0-9]{8}_/, ''); // 앞에 붙은 8자리 날짜 제거
    cleanName = cleanName.replace(/_(변환|매칭)완료$/, ''); // 기존 완료 문구 제거
    cleanName = cleanName.split('_Packing')[0].split('_Matched')[0]; // 기존 영어 꼬리표 제거

    const label = type === 'convert' ? '변환완료' : '매칭완료';
    const finalFileName = `${today}_${cleanName}_${label}.xlsx`;
    
    const resFile = new File([blob], finalFileName, { type: blob.type });
    if (type === 'convert') { setConvertedExcel(resFile); setFile(resFile); }
    else { setMatchedExcel(resFile); setSecondFile(resFile); }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFileName;
    link.click();
    window.URL.revokeObjectURL(url);
    
    setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
    setResult({ success: true, message: '저장 완료!', filePath: finalFileName });
    return resFile;
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-200">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-20 lg:text-left text-center">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 fill-current" />
            <span>AI 로지스틱스 솔루션</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-8">India Logistic <span className="text-indigo-400 font-black">Pass</span></h1>
          
          <div className="inline-flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 shadow-2xl">
            <button onClick={() => { setMode('auto'); setActiveTab('convert'); }} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'auto' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><RotateCcw className="w-4 h-4" /> 자동 모드 (Auto)</button>
            <button onClick={() => setMode('manual')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'manual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><ArrowRight className="w-4 h-4" /> 수동 모드 (Manual)</button>
          </div>
        </header>

        {mode === 'manual' && (
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mb-10 max-w-md mx-auto">
            {[{ id: 'convert', label: '1. 변환', icon: FileText }, { id: 'match', label: '2. 매칭', icon: LinkIcon }, { id: 'verify', label: '3. 검증', icon: FileCheck }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}><tab.icon className="w-3.5 h-3.5" />{tab.label}</button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-10 backdrop-blur-xl shadow-2xl relative">
               <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                 {mode === 'auto' ? <><Play className="text-indigo-400 fill-current" /> 파일 하나로 전체 공정 처리</> : (activeTab === 'convert' ? 'Step 1: 원본 PDF 업로드' : activeTab === 'match' ? 'Step 2: 엑셀 매칭 처리' : 'Step 3: 수량 검증')}
               </h2>

               <div className="space-y-6">
                 <div 
                   onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                   onDragLeave={() => setIsDragging(false)}
                   onDrop={(e) => onDrop(e, 1)}
                   onClick={() => document.getElementById('file-input')?.click()}
                   className={`border-3 border-dashed rounded-3xl p-14 transition-all text-center cursor-pointer ${isDragging || file ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500'}`}
                 >
                   <input id="file-input" type="file" className="hidden" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0], 1)} />
                   {file ? (
                     <div className="space-y-4">
                       <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl"><FileText className="text-white w-12 h-12" /></div>
                       <p className="text-xl font-bold text-white max-w-lg mx-auto truncate">{file.name}</p>
                     </div>
                   ) : (
                     <div className="space-y-4 py-8"><Upload className="text-white/20 w-16 h-16 mx-auto" /><p className="text-slate-300 text-lg font-bold">파일을 드래그하여 업로드하세요</p></div>
                   )}
                 </div>

                 {mode === 'manual' && activeTab === 'verify' && (
                    <div onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }} onDragLeave={() => setIsDragging2(false)} onDrop={(e) => onDrop(e, 2)} onClick={() => document.getElementById('file-input-2')?.click()} className={`border-3 border-dashed rounded-3xl p-12 transition-all text-center cursor-pointer ${isDragging2 || secondFile ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                      <input id="file-input-2" type="file" className="hidden" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0], 2)} />
                      {secondFile ? (
                        <div className="space-y-4"><div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto"><FileSpreadsheet className="text-white w-10 h-10" /></div><p className="text-white font-bold max-w-lg mx-auto truncate">{secondFile.name}</p></div>
                      ) : (
                        <div className="space-y-4 py-8"><FileSpreadsheet className="text-white/20 w-16 h-16 mx-auto" /><p className="text-slate-300 text-lg font-bold">검증할 매칭 완료 파일을 여기에 놓으세요</p></div>
                      )}
                    </div>
                 )}

                 <button disabled={!file || (mode === 'manual' && activeTab === 'verify' && !secondFile) || loading} onClick={startTask} className={`w-full h-20 rounded-3xl font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 ${loading ? 'bg-slate-700 animate-pulse' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:scale-[1.01] active:scale-95'}`}>
                   {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <span>{mode === 'auto' ? '프로세스 시작' : '단계별 실행'}</span>}
                 </button>
               </div>
            </div>

            {result && result.stats && (
               <div className="bg-slate-800/60 border border-indigo-500/40 rounded-3xl p-10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-12 duration-1000 shadow-2xl">
                  <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                    <div className="flex items-center gap-4"><div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center"><ShieldCheck className="text-slate-900 w-8 h-8 font-bold" /></div><h3 className="text-3xl font-black text-white">상세 검증 리포트</h3></div>
                    <div className={`px-10 py-5 rounded-3xl font-black text-2xl border-2 ${result.stats.pdfTotal === result.stats.excelTotal ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-red-500/10 border-red-600 text-red-600'}`}>
                      {result.stats.pdfTotal === result.stats.excelTotal ? `수량 일치 ✔ (${result.stats.pdfTotal}개)` : `수량 불일치 ✘`}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
                    <div className="grid grid-cols-12 bg-slate-800/80 px-10 py-6 border-b border-white/5 text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">
                       <div className="col-span-8">상품 및 옵션 정보</div>
                       <div className="col-span-3 text-right">검수 수량</div>
                       <div className="col-span-1 text-center">결과</div>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                      {result.stats.comparisons.map((c: any, i: number) => (
                        <div key={i} className="grid grid-cols-12 px-10 py-7 border-b border-white/5 hover:bg-white/5 transition-colors items-center">
                          <div className="col-span-8 font-semibold text-[17px] text-slate-100 pr-4 leading-tight">{c.label}</div>
                          <div className="col-span-3 text-right"><span className="text-2xl font-black text-indigo-400 tabular-nums">{c.excel}</span><span className="text-xs text-slate-500 ml-2 font-black">PCS</span></div>
                          <div className="col-span-1 flex justify-center">{c.isMatch ? <div className="w-11 h-11 rounded-full bg-indigo-500 text-slate-950 flex items-center justify-center font-black shadow-lg">O</div> : <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center font-black shadow-lg">X</div>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 flex flex-col shadow-2xl">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 border-b border-white/5 pb-4">Live Progress</h3>
              <div className="space-y-10">
                {progress.length === 0 && <div className="py-20 text-center text-slate-600 text-[11px] font-black uppercase">Ready to start</div>}
                {progress.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-6 group">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all duration-700 ${step.status === 'done' ? 'bg-indigo-500 border-indigo-500 text-slate-950' : step.status === 'loading' ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-400 animate-pulse' : 'border-slate-800 text-slate-700'}`}>{step.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : step.status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : idx + 1}</div>
                    <span className={`text-[15px] font-black tracking-tight ${step.status === 'done' ? 'text-indigo-400' : step.status === 'loading' ? 'text-white' : 'text-slate-700'}`}>{step.label}</span>
                  </div>
                ))}
              </div>
              {result && !result.stats && (
                <div className="mt-12 p-8 rounded-3xl border bg-slate-800/80 border-indigo-500/20 animate-in zoom-in-95">
                  <div className="text-indigo-400 font-black text-sm mb-4">COMPLETED! 👋</div>
                  <div className="text-[10px] text-slate-500 mb-2 font-bold opacity-50 uppercase">Filename</div>
                  <div className="text-xs text-indigo-100 font-bold break-all">{result.filePath}</div>
                </div>
              )}
            </div>
            <div className="bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-3xl p-8 text-white shadow-2xl cursor-default group">
              <h4 className="font-black text-xl mb-3 flex items-center gap-2">Clean Pass <span className="text-xs font-normal opacity-50">v1.2</span></h4>
              <p className="text-indigo-100 text-xs leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">모든 파일은 결과 생성 즉시 서버에서 영구 삭제됩니다. 안전하게 패킹리스트를 관리하세요.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
