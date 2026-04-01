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
  
  // 자동 연동을 위한 상태 관리
  const [sourcePdf, setSourcePdf] = useState<File | null>(null);
  const [convertedExcel, setConvertedExcel] = useState<File | null>(null);
  const [matchedExcel, setMatchedExcel] = useState<File | null>(null);

  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; filePath?: string; message?: string; stats?: any } | null>(null);

  // 탭 변경 시 자동 파일 세팅 로직
  useEffect(() => {
    if (activeTab === 'convert') {
      setFile(sourcePdf);
    } else if (activeTab === 'match') {
      if (convertedExcel) setFile(convertedExcel);
      else setFile(null);
    } else if (activeTab === 'verify') {
      setFile(sourcePdf);
      setSecondFile(matchedExcel);
    }
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, num: 1 | 2 = 1) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (num === 1) {
        setFile(selectedFile);
        if (activeTab === 'convert') setSourcePdf(selectedFile);
        if (activeTab === 'match') setConvertedExcel(selectedFile);
      } else {
        setSecondFile(selectedFile);
        if (activeTab === 'verify') setMatchedExcel(selectedFile);
      }
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
      if (activeTab === 'convert') {
        formData.append('pdf', file);
      } else if (activeTab === 'match') {
        formData.append('excel', file);
      } else {
        formData.append('pdf', file);
        if (secondFile) formData.append('excel', secondFile);
        else throw new Error('검증할 엑셀 파일이 필요합니다.');
      }

      const endpoint = `/api/${activeTab}`;
      const response = await fetch(endpoint, { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '요청 처리에 실패했습니다.');
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
      
      // Filename Rule
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const originalName = file.name.split('.').slice(0, -1).join('.');
      const prefix = activeTab === 'convert' ? 'Packing' : 'Matched';
      const finalFileName = `${today}_${originalName}_${prefix}.xlsx`;

      // 결과 파일을 상태에 저장 (자동 연동용)
      const resFile = new File([blob], finalFileName, { type: blob.type });
      if (activeTab === 'convert') setConvertedExcel(resFile);
      else if (activeTab === 'match') setMatchedExcel(resFile);

      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName;
      link.click();
      window.URL.revokeObjectURL(url);
      
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ success: true, message: `${activeTab === 'convert' ? 'PDF 변환' : '데이터 매칭'}이 완료되었습니다!`, filePath: finalFileName });

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '오류가 발생했습니다.' });
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

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 fill-current" />
            <span>AI 기반 패킹리스트 클라우드 파서</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            India Packing List <span className="text-indigo-400 font-black">Converter</span>
          </h1>
        </header>

        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mb-8 max-w-md mx-auto backdrop-blur-md">
          {[
            { id: 'convert', label: 'PDF 엑셀 변환', icon: FileText },
            { id: 'match', label: '엑셀 데이터 매칭', icon: LinkIcon },
            { id: 'verify', label: '전체 수량 검증', icon: FileCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                {activeTab === 'convert' && <><FileText className="w-5 h-5 text-indigo-400" /> PDF 파일 업로드</>}
                {activeTab === 'match' && <><FileSpreadsheet className="w-5 h-5 text-indigo-400" /> 엑셀 파일 선택</>}
                {activeTab === 'verify' && <><FileCheck className="w-5 h-5 text-indigo-400" /> 데이터 검증</>}
              </h2>

              <div className="space-y-4">
                {/* primary file upload */}
                <div 
                  className={`relative group border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center cursor-pointer ${
                    file ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-700/20'
                  }`}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" className="hidden" onChange={(e) => handleFileChange(e, 1)} />
                  {file ? (
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                        {file.name.endsWith('.pdf') ? <FileText className="text-white w-7 h-7" /> : <FileSpreadsheet className="text-white w-7 h-7" />}
                      </div>
                      <p className="text-white font-semibold truncate max-w-xs mx-auto text-sm">{file.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="text-slate-400 w-8 h-8 mx-auto opacity-50" />
                      <p className="text-slate-300 text-sm font-medium">파일을 선택하거나 드래그하세요</p>
                    </div>
                  )}
                </div>

                {/* secondary file upload (only for verify) */}
                {activeTab === 'verify' && (
                   <div 
                   className={`relative group border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center cursor-pointer ${
                     secondFile ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-700/20'
                   }`}
                   onClick={() => document.getElementById('file-input-2')?.click()}
                 >
                   <input id="file-input-2" type="file" className="hidden" onChange={(e) => handleFileChange(e, 2)} />
                   {secondFile ? (
                     <div className="space-y-3">
                       <div className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                         <FileSpreadsheet className="text-white w-7 h-7" />
                       </div>
                       <p className="text-white font-semibold truncate max-w-xs mx-auto text-sm">{secondFile.name}</p>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       <FileSpreadsheet className="text-slate-400 w-8 h-8 mx-auto opacity-50" />
                       <p className="text-slate-300 text-sm font-medium">검증할 엑셀 파일을 선택하세요</p>
                     </div>
                   )}
                 </div>
                )}

                <button
                  disabled={!file || (activeTab === 'verify' && !secondFile) || loading}
                  onClick={startConversion}
                  className="w-full h-14 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-30 text-white rounded-xl font-bold shadow-xl transition-all flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>작업 시작</span>}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6">작업 현황</h3>
              
              <div className="space-y-4 flex-1">
                {progress.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      step.status === 'done' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' :
                      step.status === 'loading' ? 'border-indigo-400 text-indigo-400 animate-pulse' :
                      'border-slate-700 text-slate-700'
                    }`}>
                      {step.status === 'done' ? '✓' : step.status === 'loading' ? '↻' : idx + 1}
                    </div>
                    <span className={`text-sm ${step.status === 'done' ? 'text-indigo-400' : 'text-slate-500'}`}>{step.label}</span>
                  </div>
                ))}
              </div>

              {result && (
                <div className={`mt-8 p-5 rounded-xl border ${result.success ? 'bg-slate-800/60 border-indigo-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <h4 className={`font-bold mb-2 ${result.success ? 'text-indigo-400' : 'text-red-400'}`}>{result.success ? '완료' : '실패'}</h4>
                  
                  {result.stats && (
                    <div className="space-y-4">
                      {/* 상세 분석 리스트 너비 최적화 */}
                      <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-700/50 max-h-[250px] overflow-y-auto">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-2">상세 내역</h5>
                        {result.stats.comparisons.map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-none gap-2">
                            <span className="text-[11px] text-slate-300 truncate flex-1" title={c.label}>{c.label}</span>
                            <span className="text-[11px] text-slate-500 font-mono flex-shrink-0">({c.excel}개)</span>
                            <span className={`text-xs font-bold flex-shrink-0 ${c.isMatch ? 'text-indigo-400' : 'text-red-500'}`}>{c.isMatch ? 'O' : 'X'}</span>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">총 수량</span>
                            <span className={`font-bold ${result.stats.pdfTotal === result.stats.excelTotal ? 'text-indigo-400' : 'text-red-500'}`}>
                              {result.stats.pdfTotal === result.stats.excelTotal ? `일치 (${result.stats.pdfTotal}개)` : `불일치`}
                            </span>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
