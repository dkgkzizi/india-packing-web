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
  Zap
} from 'lucide-react';

interface ProgressStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

export default function PackingListApp() {
  const [activeTab, setActiveTab] = useState<'convert' | 'match' | 'verify'>('convert');
  const [file, setFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null); 
  
  // 자동 연동용 상태
  const [sourcePdf, setSourcePdf] = useState<File | null>(null);
  const [convertedExcel, setConvertedExcel] = useState<File | null>(null);
  const [matchedExcel, setMatchedExcel] = useState<File | null>(null);

  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; filePath?: string; message?: string; stats?: any } | null>(null);

  // 드래그 상태 관리
  const [isDragging, setIsDragging] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);

  useEffect(() => {
    if (activeTab === 'convert') {
      setFile(sourcePdf);
    } else if (activeTab === 'match') {
      setFile(convertedExcel);
    } else if (activeTab === 'verify') {
      setFile(sourcePdf);
      setSecondFile(matchedExcel);
    }
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
    setIsDragging(false);
    setIsDragging2(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0], num);
    }
  };

  const startConversion = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    
    const steps: Record<string, string[]> = {
      convert: ['PDF 파일 업로드 중...', '데이터 분석 및 추출 중...', '엑셀 파일 생성 중...'],
      match: ['엑셀 데이터 업로드 중...', '구글 시트 연동 중...', '데이터 매칭 작업 중...'],
      verify: ['PDF 및 엑셀 업로드 중...', '수량 정밀 분석 중...', '검증 보고서 생성 중...']
    };

    setProgress(steps[activeTab].map(s => ({ label: s, status: 'pending' })));

    try {
      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      
      const formData = new FormData();
      if (activeTab === 'convert') formData.append('pdf', file);
      else if (activeTab === 'match') formData.append('excel', file);
      else {
        formData.append('pdf', file);
        if (secondFile) formData.append('excel', secondFile);
        else throw new Error('검증할 엑셀 파일이 필요합니다.');
      }

      const response = await fetch(`/api/${activeTab}`, { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '실패했습니다.');
      }

      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'loading' } : s));
      await new Promise(r => setTimeout(r, 800));
      setProgress(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'loading' } : s));
      
      if (activeTab === 'verify') {
        const data = await response.json();
        setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
        setResult({ success: true, message: '수량 검증이 완료되었습니다.', stats: data });
        setLoading(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const originalName = file.name.split('.').slice(0, -1).join('.');
      const prefix = activeTab === 'convert' ? 'Packing' : 'Matched';
      const finalFileName = `${today}_${originalName}_${prefix}.xlsx`;

      const resFile = new File([blob], finalFileName, { type: blob.type });
      if (activeTab === 'convert') setConvertedExcel(resFile);
      else if (activeTab === 'match') setMatchedExcel(resFile);

      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName;
      link.click();
      window.URL.revokeObjectURL(url);
      
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ success: true, message: '완료되었습니다!', filePath: finalFileName });

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '오류 발생' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 fill-current" />
            <span>AI 기반 패킹리스트 클라우드 파서</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">India Packing List <span className="text-indigo-400 font-black">Converter</span></h1>
        </header>

        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mb-8 max-w-md mx-auto">
          {[{ id: 'convert', label: 'PDF 엑셀 변환', icon: FileText }, { id: 'match', label: '엑셀 데이터 매칭', icon: LinkIcon }, { id: 'verify', label: '전체 수량 검증', icon: FileCheck }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><tab.icon className="w-4 h-4" /><span className="hidden md:inline">{tab.label}</span></button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                {activeTab === 'convert' && <><FileText className="w-5 h-5 text-indigo-400" /> 원본 PDF 업로드</>}
                {activeTab === 'match' && <><FileSpreadsheet className="w-5 h-5 text-indigo-400" /> 매칭할 엑셀 선택</>}
                {activeTab === 'verify' && <><FileCheck className="w-5 h-5 text-indigo-400" /> 데이터 검증</>}
              </h2>

              <div className="space-y-4">
                <div 
                  className={`relative group border-2 border-dashed rounded-xl p-10 transition-all text-center cursor-pointer ${
                    isDragging || file ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => onDrop(e, 1)}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" className="hidden" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0], 1)} />
                  {file ? (
                    <div className="space-y-3"><div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">{file.name.endsWith('.pdf') ? <FileText className="text-white w-7 h-7" /> : <FileSpreadsheet className="text-white w-7 h-7" />}</div><p className="text-white font-semibold truncate max-w-md mx-auto text-sm">{file.name}</p></div>
                  ) : (
                    <div className="space-y-3 py-4"><Upload className="text-slate-400 w-10 h-10 mx-auto opacity-50" /><p className="text-slate-300 text-sm font-medium">여기로 파일을 드래그하여 놓으세요</p></div>
                  )}
                </div>

                {activeTab === 'verify' && (
                   <div 
                   className={`relative group border-2 border-dashed rounded-xl p-10 transition-all text-center cursor-pointer ${
                     isDragging2 || secondFile ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 hover:border-slate-500'
                   }`}
                   onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
                   onDragLeave={() => setIsDragging2(false)}
                   onDrop={(e) => onDrop(e, 2)}
                   onClick={() => document.getElementById('file-input-2')?.click()}
                 >
                   <input id="file-input-2" type="file" className="hidden" onChange={(e) => e.target.files && handleFileProcess(e.target.files[0], 2)} />
                   {secondFile ? (
                     <div className="space-y-3"><div className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl"><FileSpreadsheet className="text-white w-7 h-7" /></div><p className="text-white font-semibold truncate max-w-md mx-auto text-sm">{secondFile.name}</p></div>
                   ) : (
                     <div className="space-y-3 py-4"><FileSpreadsheet className="text-slate-400 w-10 h-10 mx-auto opacity-50" /><p className="text-slate-300 text-sm font-medium">매칭 결과 엑셀 파일을 여기에 놓으세요</p></div>
                   )}
                 </div>
                )}

                <button disabled={!file || (activeTab === 'verify' && !secondFile) || loading} onClick={startConversion} className="w-full h-14 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 text-lg hover:shadow-indigo-500/20 disabled:opacity-30">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>작업 완료 후 다음 단계 이동</span>}
                </button>
              </div>
            </div>

            {/* 🔥 WIDER VERIFICATION RESULT AREA */}
            {result && result.stats && activeTab === 'verify' && (
               <div className="bg-slate-800/60 border border-indigo-500/30 rounded-2xl p-8 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-3"><CheckCircle2 className="w-10 h-10 text-indigo-400" /><h3 className="text-3xl font-bold text-white">상세 검증 리포트</h3></div>
                    <div className={`px-6 py-3 rounded-xl font-bold text-xl border ${result.stats.pdfTotal === result.stats.excelTotal ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-red-500/20 border-red-500 text-red-500'}`}>총 수량: {result.stats.pdfTotal === result.stats.excelTotal ? `일치 (${result.stats.pdfTotal}개)` : `불일치`}</div>
                  </div>

                  <div className="bg-slate-900/80 rounded-2xl border border-slate-700/50 overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-800 px-6 py-4 border-b border-slate-700 text-xs font-bold text-slate-500 uppercase tracking-widest">
                       <div className="col-span-8">한글 상품명 / 옵션 상세</div>
                       <div className="col-span-3 text-right">검수 수량</div>
                       <div className="col-span-1 text-center">결과</div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {result.stats.comparisons.map((c: any, i: number) => (
                        <div key={i} className="grid grid-cols-12 px-6 py-5 border-b border-slate-800/50 hover:bg-white/5 transition-colors items-center">
                          <div className="col-span-8"><span className="text-base text-slate-100 font-semibold truncate block" title={c.label}>{c.label}</span></div>
                          <div className="col-span-3 text-right"><span className="text-xl font-black text-indigo-400">{c.excel}</span><span className="text-xs text-slate-500 ml-1 font-bold">PCS</span></div>
                          <div className="col-span-1 flex justify-center">{c.isMatch ? <div className="w-9 h-9 rounded-full bg-indigo-500 text-slate-900 flex items-center justify-center font-black">O</div> : <div className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center font-black">X</div>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-7 flex flex-col shadow-2xl h-fit">
              <h3 className="text-lg font-bold text-white mb-8 border-b border-slate-700 pb-4">작업 현황</h3>
              <div className="space-y-6">
                {progress.length === 0 && <p className="text-slate-500 text-sm">대기 중입니다.</p>}
                {progress.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-4"><div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${step.status === 'done' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : step.status === 'loading' ? 'border-indigo-400 animate-pulse' : 'border-slate-700 text-slate-700'}`}>{step.status === 'done' ? '✓' : step.status === 'loading' ? '↻' : idx + 1}</div><span className={`text-sm font-semibold ${step.status === 'done' ? 'text-indigo-400' : 'text-slate-500'}`}>{step.label}</span></div>
                ))}
              </div>
              {result && activeTab !== 'verify' && (
                <div className="mt-8 p-6 rounded-xl border bg-slate-800/60 border-indigo-500/30">
                  <div className="text-indigo-400 font-bold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 저장 완료</div>
                  <div className="text-[10px] text-slate-500 mb-1 font-bold">파일명</div>
                  <div className="text-xs text-white font-mono break-all">{result.filePath}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
