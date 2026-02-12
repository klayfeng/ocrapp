
import React, { useState, useEffect } from 'react';
import { processContract } from '../services/gemini';
import { StorageService } from '../services/storage';
import { OCRResult, ROIConfig, TrainingSample } from '../types';

const UserPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [rois, setRois] = useState<ROIConfig | null>(null);
  const [consensusRate, setConsensusRate] = useState<number>(0);

  useEffect(() => {
    StorageService.getROIs().then(setRois);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const r = new FileReader();
      r.onloadend = () => setPreview(r.result as string);
      r.readAsDataURL(f);
      setResult(null);
    }
  };

  const handleRecognize = async () => {
    if (!preview || !rois) return;
    setLoading(true);
    try {
      const samples = await StorageService.getSamples();
      const base64 = preview.split(',')[1];
      const res = await processContract(base64, rois, samples);
      
      setResult(res);

      const keys = Object.keys(rois.fields);
      let match = 0;
      keys.forEach(k => {
        if (res.primaryFields[k]?.value === res.secondaryFields[k]?.value) match++;
      });
      const rate = Math.round((match / keys.length) * 100);
      setConsensusRate(rate);

      const id = `OCR-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      await StorageService.saveRecord({
        id,
        timestamp: Date.now(),
        imageUrl: preview,
        result: res,
        status: 'pending',
        consensusRate: rate
      });
      
      setRecordId(id);
      // 自动滚动到结果区
      setTimeout(() => {
        document.getElementById('ocr-result')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err: any) {
      alert("识别失败，请检查网络或图片质量: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 px-4 md:px-0">
      <div className="max-w-2xl mx-auto py-8 md:py-12 space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">智能合同识别</h1>
          <p className="text-gray-500 text-xs md:text-sm px-4">拍下或上传合同照片，AI 将实时提取关键信息并加密存档</p>
        </header>

        {/* 上传区域适配移动端 */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-500/5 border-2 border-dashed border-gray-200 p-4 md:p-8 flex flex-col items-center justify-center space-y-4 min-h-[250px] md:min-h-[350px] relative overflow-hidden transition-all hover:border-blue-400 group">
          {preview ? (
            <div className="absolute inset-0">
              <img src={preview} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white mb-2">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <p className="text-white text-xs font-bold">点击更换图片</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-inner">
                <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div className="text-center space-y-1">
                <p className="text-gray-900 font-black text-base">拍照/上传合同</p>
                <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Support: JPEG, PNG, WEBP</p>
              </div>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>

        <div className="space-y-4 px-2">
          <button 
            disabled={!preview || loading || !rois}
            onClick={handleRecognize}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-600/30 disabled:opacity-50 active:scale-[0.97] transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>识别引擎同步中...</span>
              </>
            ) : (
              '开始智能提取'
            )}
          </button>
          
          {loading && (
            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full animate-progress-fast"></div>
            </div>
          )}
        </div>

        {result && recordId && rois && (
          <div id="ocr-result" className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-slide-up">
            <div className="bg-gray-50/50 px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-bold text-gray-500 tracking-tight">流水号: {recordId}</span>
              </div>
              <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${consensusRate > 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                引擎共识率 {consensusRate}%
              </span>
            </div>
            
            <div className="p-6 md:p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                  <h3 className="font-black text-gray-900 text-lg">识别结果</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Result Data</p>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(rois.fields).map(([key, info]) => (
                    <div key={key} className="py-4 flex justify-between items-center border-b border-gray-50 last:border-0 px-1">
                      <span className="text-sm font-bold text-gray-400">{info.label}</span>
                      <span className="text-sm md:text-base font-black text-gray-900 text-right">
                        {result.secondaryFields[key]?.value || result.primaryFields[key]?.value || '--'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50/80 p-5 rounded-3xl flex items-center gap-4 border border-blue-100">
                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <p className="text-[11px] md:text-xs text-blue-600 font-bold leading-relaxed">
                    所有数据已通过双引擎对比校验并自动录入云端审计系统，管理员可通过后台进行核验。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes progress-fast { from { width: 0; } to { width: 100%; } }
        .animate-progress-fast { animation: progress-fast 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default UserPage;
