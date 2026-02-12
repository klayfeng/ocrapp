
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { UserRecord, ROIConfig, ROIField } from '../types';

// 图片缩放查看组件
const ImageViewer: React.FC<{ src: string }> = ({ src }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.2, scale + delta), 5); // 限制缩放范围
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-gray-100 relative cursor-grab active:cursor-grabbing flex items-center justify-center select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img 
        src={src} 
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
        className="max-w-none max-h-none object-contain" // 允许图片超出容器以便缩放
        draggable={false}
        alt="Contract Detail"
      />
      
      {/* 缩放控制提示 */}
      <div className="absolute bottom-4 left-4 flex gap-2">
        <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-mono backdrop-blur-md">
          {(scale * 100).toFixed(0)}%
        </div>
        <div className="bg-black/40 text-white px-3 py-1 rounded-full text-[10px] backdrop-blur-md">
          滚轮缩放 · 拖拽移动
        </div>
      </div>
      
      <div className="absolute top-4 right-4 flex gap-2">
         <button 
           onClick={() => { setScale(1); setPosition({x:0, y:0}); }}
           className="bg-white/80 hover:bg-white text-gray-700 p-2 rounded-lg shadow-sm text-xs font-bold"
         >
           复位
         </button>
      </div>
    </div>
  );
};

const AdminRecordsPage: React.FC = () => {
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [rois, setRois] = useState<ROIConfig | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<UserRecord | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    refreshData();
  }, [page]); // 页码变化时刷新

  const refreshData = async () => {
    setLoading(true);
    try {
      const [recData, roiData] = await Promise.all([
        StorageService.getRecords(page, pageSize),
        StorageService.getROIs()
      ]);
      setRecords(recData.data);
      setTotalCount(recData.count);
      setRois(roiData);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (record: UserRecord) => {
    if (!rois) return;
    setSelectedRecord(record);
    const initial: Record<string, string> = {};
    Object.keys(rois.fields).forEach(k => {
      const fields = record as any; 
      const primary = fields.primary_fields || fields.result?.primaryFields;
      const secondary = fields.secondary_fields || fields.result?.secondaryFields;
      initial[k] = secondary?.[k]?.value || primary?.[k]?.value || '';
    });
    setCorrections(initial);
  };

  const handleSubmitReview = async () => {
    if (!selectedRecord || !rois) return;
    
    try {
      const total = Object.keys(rois.fields).length;
      let correct = 0;
      Object.keys(rois.fields).forEach(k => {
        const fields = selectedRecord as any;
        const secondary = fields.secondary_fields || fields.result?.secondaryFields;
        if (corrections[k] === secondary?.[k]?.value) correct++;
      });
      const accuracy = Math.round((correct / total) * 100);

      await StorageService.addSample({
        id: '', 
        timestamp: Date.now(),
        corrections,
        accuracy
      }, selectedRecord.id);

      await StorageService.updateRecordStatus(selectedRecord.id, 'reviewed', corrections);
      await refreshData();
      setSelectedRecord(null);
      alert("核验结果已同步至云端数据库！");
    } catch (e) {
      alert("提交失败，请重试");
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">流水审计仪表盘</h2>
          <p className="text-xs md:text-sm text-gray-400 font-bold uppercase">Real-time Stream Audit</p>
        </div>
        <button onClick={() => refreshData()} className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black hover:bg-gray-50 transition shadow-sm">
          刷新列表
        </button>
      </div>

      {loading && records.length === 0 ? (
        <div className="py-20 text-center text-gray-400 font-bold">正在从 Supabase 云端加载记录...</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-5">流水号</th>
                  <th className="px-6 py-5">时间</th>
                  <th className="px-6 py-5">共识</th>
                  <th className="px-6 py-5">状态</th>
                  <th className="px-6 py-5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(record => (
                  <tr key={record.id} className="hover:bg-blue-50/30 transition group">
                    <td className="px-6 py-4">
                      <div className="text-xs font-black text-gray-900 font-mono tracking-tight">{record.id}</div>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-bold text-gray-400">
                      {new Date((record as any).created_at || record.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black bg-gray-100 px-2.5 py-1 rounded-lg">
                        {(record as any).consensus_rate || record.consensusRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${record.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {record.status === 'pending' ? 'Pending' : 'Done'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleReview(record)} 
                        className="px-4 py-2 bg-gray-900 text-white text-[10px] font-black uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-105 active:scale-95"
                      >
                        Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 分页控制器 */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-gray-400">
              共 {totalCount} 条记录 · 第 {page} / {totalPages || 1} 页
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-100 transition"
              >
                上一页
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-100 transition"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && rois && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-6 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-[90vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 弹窗顶部 */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0 z-20">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-gray-900 tracking-tight">深度审计: {selectedRecord.id}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Advanced Correction Tool</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* 左右分栏内容区 */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* 左侧：固定不动的图片查看器 */}
              <div className="w-full lg:w-1/2 h-1/2 lg:h-full bg-gray-100 border-b lg:border-b-0 lg:border-r border-gray-200 relative">
                 <ImageViewer src={(selectedRecord as any).image_url || selectedRecord.imageUrl} />
              </div>

              {/* 右侧：可滚动的字段编辑区 */}
              <div className="w-full lg:w-1/2 h-1/2 lg:h-full bg-white flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <h4 className="text-xs font-black text-gray-300 uppercase tracking-widest sticky top-0 bg-white py-2 z-10">纠错与校验</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {(Object.entries(rois.fields) as [string, ROIField][]).map(([key, info]) => {
                      const fields = selectedRecord as any;
                      const primary = fields.primary_fields || fields.result?.primaryFields;
                      const secondary = fields.secondary_fields || fields.result?.secondaryFields;
                      const valA = primary?.[key]?.value || '';
                      const valB = secondary?.[key]?.value || '';
                      return (
                        <div key={key} className="p-4 bg-gray-50 rounded-2xl space-y-3 border border-gray-100 hover:border-blue-200 transition-colors">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-gray-900">{info.label}</label>
                            <span className="text-[9px] font-bold text-gray-300 font-mono">{key}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setCorrections({...corrections, [key]: valA})} className="bg-white p-2 rounded-xl border border-gray-200 text-[10px] font-bold text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition truncate text-left">Flash: {valA}</button>
                            <button onClick={() => setCorrections({...corrections, [key]: valB})} className="bg-white p-2 rounded-xl border border-gray-200 text-[10px] font-black text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition truncate text-left">Pro: {valB}</button>
                          </div>
                          <input 
                            type="text" 
                            value={corrections[key] || ''} 
                            onChange={(e) => setCorrections({...corrections, [key]: e.target.value})}
                            className="w-full text-sm font-black p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 底部提交按钮栏 */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                  <button 
                    onClick={handleSubmitReview} 
                    className="w-full py-4 bg-gray-900 text-white text-sm font-black rounded-2xl shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    存入学习库并完成核验
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ccc; }
      `}</style>
    </div>
  );
};

export default AdminRecordsPage;
