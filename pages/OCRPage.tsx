
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { processContract } from '../services/gemini';
import { INITIAL_ROIS } from '../constants';
import { OCRResult, ROIConfig, TrainingSample, HistoryStats } from '../types';

const PRESET_GROUPS = [
  { title: "基本信息", fields: ["agreement_no", "phone", "member_name", "gender", "id_no"] },
  { title: "金额与权益", fields: ["price", "receivable", "received", "deposit", "valid_days"] },
  { title: "时间状态", fields: ["card_start_date", "processing_date", "note"] }
];

const OCRPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [verifiedFields, setVerifiedFields] = useState<Set<string>>(new Set());

  const [rois] = useState<ROIConfig>(() => {
    const saved = localStorage.getItem('contract_rois');
    return saved ? JSON.parse(saved) : INITIAL_ROIS;
  });

  const [samples, setSamples] = useState<TrainingSample[]>(() => {
    const saved = localStorage.getItem('training_samples');
    return saved ? JSON.parse(saved) : [];
  });

  const [history, setHistory] = useState<HistoryStats[]>(() => {
    const saved = localStorage.getItem('accuracy_history');
    return saved ? JSON.parse(saved) : [];
  });

  const consensusRate = useMemo(() => {
    if (!result) return 0;
    const keys = Object.keys(rois.fields);
    if (keys.length === 0) return 0;
    let match = 0;
    keys.forEach(k => {
      if (result.primaryFields[k]?.value === result.secondaryFields[k]?.value) match++;
    });
    return Math.round((match / keys.length) * 100);
  }, [result, rois]);

  const currentAccuracy = useMemo(() => {
    if (!result) return 0;
    const total = Object.keys(rois.fields).length;
    if (total === 0) return 0;
    let correct = 0;
    Object.keys(rois.fields).forEach(key => {
      if (verifiedFields.has(key)) correct++;
    });
    return Math.round((correct / total) * 100);
  }, [result, verifiedFields, rois]);

  const handleProcess = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setResult(null);
    setEditValues({});
    setVerifiedFields(new Set());
    try {
      const base64Data = preview.split(',')[1];
      const res = await processContract(base64Data, rois, samples);
      setResult(res);
      // 默认采用 Secondary (Pro/GLM-Style) 的结果作为初始值，因为它精度通常更高
      const initialEdits: Record<string, string> = {};
      Object.keys(rois.fields).forEach(k => {
        initialEdits[k] = res.secondaryFields[k]?.value || res.primaryFields[k]?.value || '';
      });
      setEditValues(initialEdits);
    } catch (err: any) {
      alert("识别失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleVerify = (key: string) => {
    const next = new Set(verifiedFields);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVerifiedFields(next);
  };

  const handleTrain = () => {
    if (!result) return;
    const corrections: Record<string, string> = {};
    Object.keys(rois.fields).forEach(k => {
      if (editValues[k] !== result.secondaryFields[k]?.value) {
        corrections[result.secondaryFields[k]?.value || 'NULL'] = editValues[k];
      }
    });
    const newSample: TrainingSample = { id: Date.now().toString(), timestamp: Date.now(), corrections, accuracy: currentAccuracy };
    const newSamples = [...samples, newSample].slice(-100);
    setSamples(newSamples);
    localStorage.setItem('training_samples', JSON.stringify(newSamples));
    const today = new Date().toLocaleDateString();
    const newHistory = [...history, { date: today, accuracy: currentAccuracy }].slice(-30);
    setHistory(newHistory);
    localStorage.setItem('accuracy_history', JSON.stringify(newHistory));
    alert(`核验已提交！当前核验准确率: ${currentAccuracy}%。双引擎对比帮助发现了潜在错误。`);
  };

  const uiGroups = useMemo(() => {
    const usedKeys = new Set<string>();
    const groups = PRESET_GROUPS.map(g => {
      const fields = g.fields.filter(f => rois.fields[f]);
      fields.forEach(f => usedKeys.add(f));
      return { ...g, fields };
    }).filter(g => g.fields.length > 0);
    const customFields = Object.keys(rois.fields).filter(k => !usedKeys.has(k));
    if (customFields.length > 0) groups.push({ title: "其他字段", fields: customFields });
    return groups;
  }, [rois]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">学习进化库</h2>
            <div className="text-2xl font-black text-gray-900">{samples.length} <span className="text-xs font-normal text-gray-400">样本</span></div>
          </div>
          <div className="h-10 w-32 flex items-end gap-1">
            {history.slice(-10).map((h, i) => (
              <div key={i} className="flex-1 bg-blue-100 rounded-t-sm" style={{ height: `${h.accuracy}%` }}></div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">引擎共识率</h2>
          <div className={`text-2xl font-black mt-1 ${consensusRate < 80 ? 'text-amber-500' : 'text-green-600'}`}>
            {result ? `${consensusRate}%` : '--'}
          </div>
        </div>
        <div className="bg-blue-600 rounded-2xl shadow-lg p-5 text-white">
          <h2 className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">当前核验率</h2>
          <div className="text-2xl font-black mt-1">{result ? `${currentAccuracy}%` : '--'}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row gap-4 items-center">
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              const r = new FileReader();
              r.onloadend = () => setPreview(r.result as string);
              r.readAsDataURL(f);
            }
          }}
          className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition cursor-pointer"
        />
        <button
          onClick={handleProcess}
          disabled={!file || loading}
          className="w-full md:w-auto px-8 py-3 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-black transition shadow-lg"
        >
          {loading ? '双引擎同步识别中...' : '开始双引擎识别'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">核验与对比面板 (Flash vs GLM-Style)</h3>
              {result && (
                <button onClick={handleTrain} className="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition">完成核验并提交训练</button>
              )}
            </div>
            
            <div className="p-6">
              {result ? (
                <div className="space-y-6">
                  {uiGroups.map((group, idx) => (
                    <div key={idx} className="space-y-3">
                      <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{group.title}</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-2">
                          <thead>
                            <tr className="text-[10px] text-gray-400 uppercase">
                              <th className="px-3 pb-1">字段名称</th>
                              <th className="px-3 pb-1">Flash 引擎</th>
                              <th className="px-3 pb-1">GLM-Style 引擎</th>
                              <th className="px-3 pb-1">最终核验值</th>
                              <th className="px-3 pb-1 w-10">状态</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.fields.map(k => {
                              const valA = result.primaryFields[k]?.value || '';
                              const valB = result.secondaryFields[k]?.value || '';
                              const label = rois.fields[k]?.label || k;
                              const isMismatch = valA !== valB;
                              const isVerified = verifiedFields.has(k);

                              return (
                                <tr key={k} className={`group ${isMismatch ? 'bg-amber-50/30' : 'bg-gray-50/50'} rounded-xl overflow-hidden`}>
                                  <td className="px-3 py-3 font-bold text-xs text-gray-600 rounded-l-xl">{label}</td>
                                  <td className="px-3 py-3">
                                    <button 
                                      onClick={() => setEditValues({...editValues, [k]: valA})}
                                      className="text-[11px] text-gray-400 hover:text-blue-600 transition truncate max-w-[100px] block"
                                      title="点击采纳此值"
                                    >
                                      {valA || '-'}
                                    </button>
                                  </td>
                                  <td className="px-3 py-3">
                                    <button 
                                      onClick={() => setEditValues({...editValues, [k]: valB})}
                                      className="text-[11px] font-medium text-gray-700 hover:text-blue-600 transition truncate max-w-[100px] block"
                                      title="点击采纳此值"
                                    >
                                      {valB || '-'}
                                    </button>
                                  </td>
                                  <td className="px-3 py-3">
                                    <input 
                                      type="text" 
                                      value={editValues[k] || ''} 
                                      onChange={(e) => {
                                        setEditValues({...editValues, [k]: e.target.value});
                                        if (isVerified) toggleVerify(k);
                                      }}
                                      className={`w-full bg-white border ${isMismatch && !isVerified ? 'border-amber-300' : 'border-gray-200'} rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500`}
                                    />
                                  </td>
                                  <td className="px-3 py-3 rounded-r-xl">
                                    <button 
                                      onClick={() => toggleVerify(k)}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isVerified ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-gray-300">
                  <p className="text-sm">识别完成后在此进行双引擎纠错</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">底图对照</h3>
              <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">参考坐标系</span>
            </div>
            <div className="p-4 bg-gray-100/30">
              {preview ? (
                <div className="relative">
                  <img src={preview} className="w-full h-auto rounded-xl shadow-inner border border-gray-200" alt="Reference" />
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-300 text-xs">上传图片后显示</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRPage;
