
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { UserRecord, ROIConfig } from '../types';

const AdminRecordsPage: React.FC = () => {
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [rois, setRois] = useState<ROIConfig | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<UserRecord | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [recData, roiData] = await Promise.all([
        StorageService.getRecords(),
        StorageService.getROIs()
      ]);
      setRecords(recData);
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

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">流水审计仪表盘</h2>
          <p className="text-xs md:text-sm text-gray-400 font-bold uppercase">Real-time Stream Audit</p>
        </div>
        <button onClick={refreshData} className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-black hover:bg-gray-50 transition shadow-sm">
          同步最新数据
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 font-bold">正在从 Supabase 云端加载记录...</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
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
        </div>
      )}

      {selectedRecord && rois && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-8 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-7xl max-h-full overflow-hidden flex flex-col shadow-2xl">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">深度审计: {selectedRecord.id}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Advanced Correction Tool</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 custom-scrollbar">
              <div className="bg-gray-100 rounded-[2rem] overflow-hidden border border-gray-200 shadow-inner group relative">
                <img src={(selectedRecord as any).image_url || selectedRecord.imageUrl} className="w-full h-auto" />
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 text-[10px] font-bold rounded-full backdrop-blur-md">原件对照</div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-300 uppercase tracking-widest px-1">纠错与校验</h4>
                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(rois.fields).map(([key, info]) => {
                    const fields = selectedRecord as any;
                    const primary = fields.primary_fields || fields.result?.primaryFields;
                    const secondary = fields.secondary_fields || fields.result?.secondaryFields;
                    const valA = primary?.[key]?.value || '';
                    const valB = secondary?.[key]?.value || '';
                    return (
                      <div key={key} className="p-5 bg-gray-50 rounded-[1.5rem] space-y-3 border border-gray-100 hover:border-blue-200 transition-colors">
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
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
              <button 
                onClick={handleSubmitReview} 
                className="px-10 py-4 bg-gray-900 text-white text-sm font-black rounded-2xl shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                存入学习库并完成核验
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdminRecordsPage;
