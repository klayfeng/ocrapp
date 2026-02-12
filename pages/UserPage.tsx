
import React, { useState, useEffect, useRef } from 'react';
import { ROIConfig, OCRResult, ROIField, QueuedTask, UserRecord } from '../types';
import { processContract } from '../services/ai';
import { StorageService } from '../services/storage';

const UserPage: React.FC = () => {
  // --- 状态管理 ---
  const [rois, setRois] = useState<ROIConfig | null>(null);
  
  // 队列状态 (实时任务)
  const [queue, setQueue] = useState<QueuedTask[]>([]);
  
  // 历史记录状态 (数据库分页)
  const [historyList, setHistoryList] = useState<UserRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // UI 状态
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化加载配置和第一页历史
  useEffect(() => {
    StorageService.getROIs().then(setRois);
    loadHistory(1);
  }, []);

  // 加载历史记录
  const loadHistory = async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await StorageService.getRecords(page, 10);
      setHistoryList(res.data);
      setHistoryTotal(res.count);
      setHistoryPage(page);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- 图片压缩逻辑 (保持不变) ---
  const compressImage = (originalFile: File): Promise<{ blob: Blob, base64: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(originalFile);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIDE = 1280;
        if (width > height) {
          if (width > MAX_SIDE) { height = Math.round((height * MAX_SIDE) / width); width = MAX_SIDE; }
        } else {
          if (height > MAX_SIDE) { width = Math.round((width * MAX_SIDE) / height); height = MAX_SIDE; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
        }
        const QUALITY = 0.5;
        const base64Full = canvas.toDataURL('image/jpeg', QUALITY);
        const base64 = base64Full.split(',')[1];
        canvas.toBlob((blob) => {
          resolve({ blob: blob || originalFile, base64 });
        }, 'image/jpeg', QUALITY);
      };
    };
  };

  // --- 核心任务处理逻辑 ---
  const processTask = async (task: QueuedTask, roiConfig: ROIConfig) => {
    const updateTask = (updates: Partial<QueuedTask>) => {
      setQueue(prev => prev.map(t => t.internalId === task.internalId ? { ...t, ...updates } : t));
    };

    try {
      updateTask({ status: 'compressing', progressLabel: '正在进行智能压缩...' });
      const { blob: compressedBlob, base64: compressedBase64 } = await compressImage(task.file);

      updateTask({ status: 'uploading', progressLabel: '正在存证至混合云...' });
      const publicUrl = await StorageService.uploadImage(compressedBlob);

      updateTask({ status: 'extracting', progressLabel: '双引擎 AI 极速提取中...' });
      const samples = await StorageService.getSamples();
      const res = await processContract(compressedBase64, roiConfig, samples);

      const keys = Object.keys(roiConfig.fields);
      let match = 0;
      keys.forEach(k => {
        if (res.primaryFields[k]?.value === res.secondaryFields[k]?.value) match++;
      });
      const rate = keys.length > 0 ? Math.round((match / keys.length) * 100) : 0;

      const id = `OCR-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      await StorageService.saveRecord({
        id,
        timestamp: Date.now(),
        imageUrl: publicUrl,
        result: res,
        status: 'pending',
        consensusRate: rate
      });

      updateTask({ 
        status: 'completed', 
        progressLabel: '处理完成', 
        result: res, 
        recordId: id,
        consensusRate: rate 
      });

      loadHistory(1);

    } catch (err: any) {
      console.error("Task Failed", err);
      updateTask({ 
        status: 'failed', 
        progressLabel: '任务失败', 
        errorMsg: err.message || '未知错误' 
      });
    }
  };

  // --- 事件处理 ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !rois) return;
    const files = Array.from(e.target.files);
    
    const newTasks: QueuedTask[] = files.map(f => ({
      internalId: Date.now() + Math.random().toString(),
      file: f,
      preview: URL.createObjectURL(f),
      status: 'pending',
      progressLabel: '等待处理...'
    }));

    setQueue(prev => [...newTasks, ...prev]);
    setActiveTab('queue'); 

    newTasks.forEach(task => processTask(task, rois));
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- 辅助函数：获取重要字段摘要 ---
  const getBasicFields = (record: UserRecord) => {
    if (!rois || !record.result) return [];
    // 优先展示的字段 Key
    const preferred = ['agreement_no', 'member_name', 'phone', 'price', 'receivable', 'id_no'];
    const fields: { label: string, value: string }[] = [];
    
    // 优先匹配
    for (const key of preferred) {
      if (rois.fields[key]) {
        const val = record.result.secondaryFields?.[key]?.value || record.result.primaryFields?.[key]?.value;
        if (val && val !== '--' && val !== 'null') {
          fields.push({ label: rois.fields[key].label, value: val });
        }
      }
    }
    
    // 如果没有找到优先字段，则补充其他非空字段
    if (fields.length < 3) {
      for (const [key, info] of Object.entries(rois.fields)) {
        if (preferred.includes(key)) continue;
        const val = record.result.secondaryFields?.[key]?.value || record.result.primaryFields?.[key]?.value;
        if (val && val !== '--') {
          fields.push({ label: info.label, value: val });
        }
        if (fields.length >= 3) break;
      }
    }
    
    return fields.slice(0, 4); // 最多展示4个
  };

  // --- 渲染组件 ---

  const StatusBadge = ({ status, rate }: { status: QueuedTask['status'], rate?: number }) => {
    if (status === 'completed') {
      return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${rate && rate >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          完成 (共识{rate}%)
        </span>
      );
    }
    if (status === 'failed') return <span className="px-2 py-1 bg-red-100 text-red-600 rounded-md text-[10px] font-bold">失败</span>;
    return <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-md text-[10px] font-bold animate-pulse">进行中</span>;
  };

  const ResultCard = ({ result, rois, isHistory }: { result: OCRResult, rois: ROIConfig, isHistory?: boolean }) => {
    const [expanded, setExpanded] = useState(!isHistory); 
    if (!result) return null; 

    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 mb-2"
        >
          {expanded ? '收起详情' : '展开识别结果'}
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {(Object.entries(rois.fields) as [string, ROIField][]).map(([key, info]) => {
              const val = result.secondaryFields?.[key]?.value || result.primaryFields?.[key]?.value;
              return (
                <div key={key} className="flex justify-between items-center border-b border-gray-50 py-1.5">
                  <span className="text-xs text-gray-400">{info.label}</span>
                  <span className="text-xs font-black text-gray-800">{val || '--'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 px-4 md:px-0 flex flex-col items-center">
      <div className="w-full max-w-3xl py-6 md:py-8 space-y-6">
        
        {/* 顶部：上传控制区 */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-500/5 p-6 border border-gray-100">
          <header className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">智能合同识别中心</h1>
              <p className="text-gray-400 text-xs font-bold uppercase mt-1">AI Batch Processing Pipeline</p>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-black text-blue-600">{queue.filter(t => t.status === 'completed').length}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase">本次会话已完成</div>
            </div>
          </header>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-blue-500 mb-2 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <p className="text-sm font-bold text-blue-800">点击添加图片 / 拍照</p>
            <p className="text-[10px] text-blue-400 font-bold uppercase mt-1">支持多图连续上传 · 自动加入队列</p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleFileSelect} 
            />
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-6 border-b border-gray-200 px-2">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`pb-3 text-sm font-black uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'queue' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            实时任务队列 ({queue.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-black uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            历史档案库 ({historyTotal})
          </button>
        </div>

        {/* 内容展示区 */}
        <div className="space-y-4 min-h-[400px]">
          
          {/* A. 实时队列 Tab */}
          {activeTab === 'queue' && (
            <>
              {queue.length === 0 ? (
                <div className="py-20 text-center space-y-3 opacity-50">
                  <div className="text-4xl">📸</div>
                  <p className="text-sm font-bold text-gray-400">队列为空，请上传合同图片</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {queue.map(task => (
                    <div key={task.internalId} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-hidden">
                      <div className="flex gap-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                          <img src={task.preview} className="w-full h-full object-cover" />
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-400 truncate pr-2">Task ID: {task.internalId.slice(-6)}</span>
                            <StatusBadge status={task.status} rate={task.consensusRate} />
                          </div>
                          
                          {task.status !== 'completed' && task.status !== 'failed' && (
                            <div className="space-y-1">
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-blue-500 h-full transition-all duration-500 ease-out"
                                  style={{ 
                                    width: task.status === 'compressing' ? '30%' : task.status === 'uploading' ? '60%' : '90%' 
                                  }}
                                ></div>
                              </div>
                              <p className="text-[10px] text-blue-500 font-bold">{task.progressLabel}</p>
                            </div>
                          )}

                          {task.status === 'failed' && (
                            <p className="text-xs text-red-500 font-bold">{task.errorMsg}</p>
                          )}
                          
                          {task.status === 'completed' && (
                            <p className="text-[10px] text-gray-400 font-bold">流水号: {task.recordId}</p>
                          )}
                        </div>
                      </div>

                      {task.status === 'completed' && task.result && rois && (
                         <ResultCard result={task.result} rois={rois} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* B. 历史记录 Tab (已优化) */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              {historyLoading ? (
                 <div className="py-20 text-center text-gray-400 text-xs font-bold">加载云端数据中...</div>
              ) : (
                <>
                  {historyList.map(record => (
                    <div key={record.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex gap-4">
                        {/* 图片预览 (带点击放大) */}
                        <div 
                          className="w-20 h-24 shrink-0 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in group relative" 
                          onClick={() => window.open(record.imageUrl, '_blank')}
                          title="点击查看大图"
                        >
                          {record.imageUrl ? (
                             <img src={record.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Img</div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                          {/* 头部：ID、时间、共识率 */}
                          <div className="flex justify-between items-start">
                             <div>
                                <div className="flex items-center gap-2">
                                   <span className="text-xs font-black text-gray-900 font-mono tracking-tight">{record.id}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-bold">{new Date(record.timestamp).toLocaleString()}</span>
                             </div>
                             <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${record.consensusRate >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                共识 {record.consensusRate || 0}%
                             </div>
                          </div>

                          {/* 中部：基础信息摘要 */}
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                             {getBasicFields(record).map((field, idx) => (
                                <div key={idx} className="text-xs truncate flex items-center gap-1.5" title={`${field.label}: ${field.value}`}>
                                   <span className="w-1.5 h-1.5 rounded-full bg-blue-200 shrink-0"></span>
                                   <span className="text-gray-400 shrink-0">{field.label}</span>
                                   <span className="font-bold text-gray-700 truncate">{field.value}</span>
                                </div>
                             ))}
                             {getBasicFields(record).length === 0 && (
                                <span className="text-[10px] text-gray-300 italic col-span-2">未提取到关键信息</span>
                             )}
                          </div>
                        </div>
                      </div>
                      
                      {rois && record.result && <ResultCard result={record.result} rois={rois} isHistory={true} />}
                    </div>
                  ))}

                  {/* 简易分页 */}
                  <div className="flex justify-between items-center pt-4">
                    <button 
                      disabled={historyPage === 1}
                      onClick={() => loadHistory(historyPage - 1)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-50 transition"
                    >
                      上一页
                    </button>
                    <span className="text-[10px] text-gray-400 font-bold">第 {historyPage} 页 (共 {Math.ceil(historyTotal/10)} 页)</span>
                    <button 
                      disabled={historyPage * 10 >= historyTotal}
                      onClick={() => loadHistory(historyPage + 1)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-50 transition"
                    >
                      下一页
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default UserPage;
