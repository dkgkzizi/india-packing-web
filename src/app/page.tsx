'use client';

import React, { useState } from 'react';
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
  const [secondFile, setSecondFile] = useState<File | null>(null); // For verification
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; filePath?: string; message?: string; stats?: any } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, num: 1 | 2 = 1) => {
    if (e.target.files && e.target.files[0]) {
      if (num === 1) setFile(e.target.files[0]);
      else setSecondFile(e.target.files[0]);
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
      // Step 1: Uploading
      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      
      const formData = new FormData();
      if (activeTab === 'convert') formData.append('pdf', file);
      else if (activeTab === 'match') formData.append('excel', file);
      else {
        formData.append('pdf', file);
        if (secondFile) formData.append('excel', secondFile);
      }

      const endpoint = `/api/${activeTab}`;
      const response = await fetch(endpoint, { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '요청 처리에 실패했습니다.');
      }

      // Step 2 & 3: Processing UI Feedbacks
      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'loading' } : s));
      await new Promise(r => setTimeout(r, 800));
      
      setProgress(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'loading' } : s));
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeTab === 'convert' ? `Packing_List_${Date.now()}.xlsx` : `Matched_Result_${Date.now()}.xlsx`;
      
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      
      setResult({ 
        success: true, 
        message: `${activeTab === 'convert' ? 'PDF 변환' : '데이터 매칭'}이 성공적으로 완료되었습니다! 아래 버튼을 눌러 결과 파일을 확인하세요.`,
        filePath: link.download 
      });

      // Automatically trigger download
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '작업 도중 예상치 못한 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Zap className="w-4 h-4 fill-current" />
            <span>AI 기반 패킹리스트 클라우드 파서</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            India Packing List <span className="text-indigo-400 font-black">Converter</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            인도 패킹리스트 PDF 파일을 업로드하고 원클릭으로 엑셀 변환 및 구글 시트 매칭을 통합 관리하세요.
          </p>
        </header>

        {/* Tab Switcher */}
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

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Input Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                {activeTab === 'convert' && <><FileText className="w-5 h-5 text-indigo-400" /> 파일 업로드</>}
                {activeTab === 'match' && <><FileSpreadsheet className="w-5 h-5 text-indigo-400" /> 엑셀 파일 선택</>}
                {activeTab === 'verify' && <><FileCheck className="w-5 h-5 text-indigo-400" /> 데이터 검증</>}
              </h2>

              <div className="space-y-4">
                <div 
                  className={`relative group border-2 border-dashed rounded-xl p-12 transition-all duration-300 text-center cursor-pointer ${
                    file ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-700/20'
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" className="hidden" onChange={handleFileChange} accept={activeTab === 'convert' ? '.pdf' : '.xlsx'} />
                  
                  {file ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                        {activeTab === 'convert' ? <FileText className="text-white w-8 h-8" /> : <FileSpreadsheet className="text-white w-8 h-8" />}
                      </div>
                      <div>
                        <p className="text-white font-semibold truncate max-w-xs mx-auto">{file.name}</p>
                        <p className="text-slate-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="text-slate-400 w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-slate-300 font-medium">파일을 드래그하거나 클릭하여 업로드</p>
                        <p className="text-slate-500 text-xs mt-1">PDF 또는 EXCEL 파일 (최대 50MB)</p>
                      </div>
                    </div>
                  )}
                </div>

                {activeTab === 'verify' && (
                   <div 
                   className={`relative group border-2 border-dashed rounded-xl p-12 transition-all duration-300 text-center cursor-pointer ${
                     secondFile ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-700/20'
                   }`}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => {
                     e.preventDefault();
                     if (e.dataTransfer.files[0]) setSecondFile(e.dataTransfer.files[0]);
                   }}
                   onClick={() => document.getElementById('file-input-2')?.click()}
                 >
                   <input id="file-input-2" type="file" className="hidden" onChange={(e) => handleFileChange(e, 2)} accept=".xlsx" />
                   
                   {secondFile ? (
                     <div className="space-y-3">
                       <div className="w-16 h-16 bg-cyan-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                         <FileSpreadsheet className="text-white w-8 h-8" />
                       </div>
                       <div>
                         <p className="text-white font-semibold truncate max-w-xs mx-auto">{secondFile.name}</p>
                         <p className="text-slate-400 text-xs mt-1">{(secondFile.size / 1024).toFixed(1)} KB</p>
                       </div>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                         <FileSpreadsheet className="text-slate-400 w-8 h-8" />
                       </div>
                       <div>
                         <p className="text-slate-300 font-medium">검증할 엑셀 파일을 추가로 업로드하세요</p>
                       </div>
                     </div>
                   )}
                 </div>
                )}

                <button
                  disabled={!file || loading}
                  onClick={startConversion}
                  className="w-full h-14 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 overflow-hidden group"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <span>{activeTab === 'convert' ? 'PDF 변환 시작' : activeTab === 'match' ? '엑셀 매칭 시작' : '수량 검증 시작'}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Features Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/30 flex gap-4">
                <div className="mt-1"><ShieldCheck className="w-5 h-5 text-cyan-400" /></div>
                <div>
                  <h4 className="text-white font-semibold mb-1">안격 보안 보안</h4>
                  <p className="text-slate-400 text-sm">업로드된 파일은 변환 즉시 서버에서 삭제되어 유출 걱정이 없습니다.</p>
                </div>
              </div>
              <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/30 flex gap-4">
                <div className="mt-1"><Clock className="w-5 h-5 text-indigo-400" /></div>
                <div>
                  <h4 className="text-white font-semibold mb-1">압도적인 속도</h4>
                  <p className="text-slate-400 text-sm">수백 장의 패킹리스트도 10초 내외로 빠른 처리가 가능합니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Status/Results Section */}
          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6">작업 현황</h3>
              
              {progress.length === 0 && !result && (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-12">
                   <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-3">
                     <Clock className="w-6 h-6 text-slate-500" />
                   </div>
                   <p className="text-sm text-slate-500 font-medium">대기 중인 작업이 없습니다</p>
                </div>
              )}

              <div className="space-y-4 flex-1">
                {progress.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-4 group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      step.status === 'done' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' :
                      step.status === 'loading' ? 'border-indigo-400 text-indigo-400 animate-pulse' :
                      'border-slate-700 text-slate-700'
                    }`}>
                      {step.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : 
                       step.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : idx + 1}
                    </div>
                    <span className={`text-sm font-medium ${
                      step.status === 'done' ? 'text-indigo-400' :
                      step.status === 'loading' ? 'text-white' : 'text-slate-500'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {result && (
                <div className={`mt-8 p-6 rounded-xl border animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                  result.success ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    {result.success ? <CheckCircle2 className="w-6 h-6 text-indigo-400" /> : <AlertCircle className="w-6 h-6 text-red-400" />}
                    <h4 className={`font-bold ${result.success ? 'text-indigo-400' : 'text-red-400'}`}>
                      {result.success ? '작업 완료' : '작업 실패'}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-300 mb-4 leading-relaxed">{result.message}</p>
                  
                  {result.success && (
                    <button 
                      onClick={() => {
                        // The download link is already handled in startConversion or we can re-trigger
                        const link = document.createElement('a');
                        link.href = '#'; 
                        link.innerText = '다시 다운로드 하려면 변환을 다시 실행해주세요.';
                        alert('결과 파일이 이미 다운로드되었습니다.');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-semibold"
                    >
                      <Download className="w-4 h-4" />
                      <span>파일 보관됨</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-800 text-center">
          <p className="text-slate-500 text-sm flex items-center justify-center gap-1">
            © 2026 <span className="text-indigo-400 font-bold">ANTIGRAVITY</span> • Crafted for Smart Logistics
          </p>
        </footer>
      </div>
    </main>
  );
}
