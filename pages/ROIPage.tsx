import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StorageService } from '../services/storage';
import { ROIConfig, Rect, ROIField } from '../types';
import { DEFAULT_TEMPLATE_URL } from '../constants';

const ROIPage: React.FC = () => {
  const [rois, setRois] = useState<ROIConfig | null>(null);
  const [selectedField, setSelectedField] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'original'>('fit');
  
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  
  const [templateUrl, setTemplateUrl] = useState(DEFAULT_TEMPLATE_URL);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const refreshROIs = useCallback(async () => {
    const data = await StorageService.getROIs();
    setRois(data);
    if (Object.keys(data.fields).length > 0 && !selectedField) {
      setSelectedField(Object.keys(data.fields)[0]);
    }
  }, [selectedField]);

  useEffect(() => {
    refreshROIs();
  }, [refreshROIs]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current || !rois) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0);

    // Fix: cast Object.entries to ROIField to fix 'unknown' property access for coords and label (lines 43, 59)
    (Object.entries(rois.fields) as [string, ROIField][]).forEach(([key, info]) => {
      const [nx1, ny1, nx2, ny2] = info.coords;
      const x1 = nx1 * canvas.width;
      const y1 = ny1 * canvas.height;
      const x2 = nx2 * canvas.width;
      const y2 = ny2 * canvas.height;

      const isSelected = key === selectedField;
      
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.05)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

      ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = isSelected ? Math.max(4, canvas.width / 400) : 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // 标签绘制
      const labelText = `${info.label}`;
      ctx.font = `bold ${Math.max(12, canvas.width / 80)}px system-ui`;
      const metrics = ctx.measureText(labelText);
      const bgW = metrics.width + 12;
      const bgH = Math.max(20, canvas.width / 50);
      
      ctx.fillStyle = isSelected ? '#3b82f6' : 'rgba(239, 68, 68, 0.8)';
      ctx.fillRect(x1, y1 - bgH, bgW, bgH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x1 + 6, y1 - (bgH/4));
    });

    if (currentRect) {
      ctx.strokeStyle = '#3b82f6';
      ctx.setLineDash([10, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(
        Math.min(currentRect.x1, currentRect.x2),
        Math.min(currentRect.y1, currentRect.y2),
        Math.abs(currentRect.x2 - currentRect.x1),
        Math.abs(currentRect.y2 - currentRect.y1)
      );
      ctx.setLineDash([]);
    }
  }, [rois, selectedField, currentRect]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        imgRef.current = img;
        draw();
      }
    };
    img.src = templateUrl;
  }, [templateUrl, draw]);

  const getPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const syncToCloud = async (newConfig: ROIConfig) => {
    setRois(newConfig);
    try {
      await StorageService.updateROIs(newConfig);
    } catch (e) {
      alert("云端同步失败");
    }
  };

  const handleSaveCoords = () => {
    if (!currentRect || !canvasRef.current || !selectedField || !rois || !rois.fields[selectedField]) return;
    const canvas = canvasRef.current;
    const nx1 = Math.min(currentRect.x1, currentRect.x2) / canvas.width;
    const ny1 = Math.min(currentRect.y1, currentRect.y2) / canvas.height;
    const nx2 = Math.max(currentRect.x1, currentRect.x2) / canvas.width;
    const ny2 = Math.max(currentRect.y1, currentRect.y2) / canvas.height;

    const newFields = { ...rois.fields };
    newFields[selectedField] = { ...newFields[selectedField], coords: [nx1, ny1, nx2, ny2] as [number, number, number, number] };
    syncToCloud({ ...rois, fields: newFields });
    setCurrentRect(null);
  };

  if (!rois) return <div className="p-20 text-center font-black text-gray-400">正在从云端加载配置...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-100">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-6">
          <h2 className="font-black text-gray-800 tracking-tight">标注工作台</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setZoomMode('fit')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${zoomMode === 'fit' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
            >
              适应宽度
            </button>
            <button 
              onClick={() => setZoomMode('original')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${zoomMode === 'original' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
            >
              原始大小 (1:1)
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <input type="file" id="bg-file" className="hidden" accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if(f) {
              const r = new FileReader();
              r.onload = () => setTemplateUrl(r.result as string);
              r.readAsDataURL(f);
            }
          }} />
          <label htmlFor="bg-file" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-50 transition">更换底图</label>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：画布主区域 - 移除限制容器大小的 class，改用更灵活的布局 */}
        <div className="flex-1 overflow-auto bg-gray-300 relative custom-scrollbar flex flex-col items-center">
          <div className={`p-8 w-fit min-h-full flex items-start justify-center`}>
            <div className={`relative bg-white shadow-2xl ${zoomMode === 'fit' ? 'max-w-[100%] lg:max-w-[1200px]' : ''}`}>
              <canvas 
                ref={canvasRef}
                onMouseDown={(e) => {
                  const pos = getPos(e);
                  setDragging(true);
                  setCurrentRect({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
                }}
                onMouseMove={(e) => {
                  if(!dragging || !currentRect) return;
                  const pos = getPos(e);
                  setCurrentRect({...currentRect, x2: pos.x, y2: pos.y});
                  draw();
                }}
                onMouseUp={() => {
                  setDragging(false);
                  draw();
                }}
                className={`block cursor-crosshair ${zoomMode === 'fit' ? 'w-full h-auto' : ''}`}
                style={zoomMode === 'original' ? { width: imgRef.current?.width, height: imgRef.current?.height } : {}}
              />
            </div>
          </div>
        </div>

        {/* 右侧：属性面板 */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-auto p-6 space-y-8 shrink-0">
          <section className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">字段属性编辑</h3>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">活跃字段选择</label>
              <select 
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.entries(rois.fields).map(([k, v]) => <option key={k} value={k}>{(v as ROIField).label} ({k})</option>)}
              </select>
            </div>

            {selectedField && rois.fields[selectedField] && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">字段显示名称 (中文)</label>
                  <input 
                    type="text" 
                    // Fix: cast to ROIField to resolve unknown property access on line 210
                    value={(rois.fields[selectedField] as ROIField).label}
                    onChange={(e) => {
                      // Fix: cast to ROIField to avoid unknown spread/property access
                      const newFields = { ...rois.fields, [selectedField]: { ...(rois.fields[selectedField] as ROIField), label: e.target.value } };
                      syncToCloud({ ...rois, fields: newFields });
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={handleSaveCoords}
                    disabled={!currentRect}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-40"
                  >
                    确认框选区域
                  </button>
                  <button 
                    onClick={() => {
                      if(!confirm("确定删除吗？")) return;
                      const f = {...rois.fields}; delete f[selectedField];
                      const keys = Object.keys(f);
                      const nextField = keys[0] || '';
                      setSelectedField(nextField);
                      syncToCloud({...rois, fields: f});
                    }}
                    className="w-full py-2.5 text-red-500 text-[10px] font-black uppercase hover:bg-red-50 rounded-xl transition"
                  >
                    删除该字段
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="bg-gray-900 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-white font-black text-xs">新增识别维度</h3>
            <div className="space-y-3">
              <input 
                placeholder="字段 Key (如 id_card)" 
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-bold text-white placeholder:text-white/40 focus:bg-white/20 outline-none"
              />
              <input 
                placeholder="字段名称 (如 身份证号)" 
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-bold text-white placeholder:text-white/40 focus:bg-white/20 outline-none"
              />
              <button 
                disabled={!newFieldKey || !newFieldName}
                onClick={() => {
                  if(rois.fields[newFieldKey]) return alert("Key 已存在");
                  const f: Record<string, ROIField> = {
                    ...rois.fields, 
                    [newFieldKey]: {
                      label: newFieldName, 
                      coords: [0.4, 0.4, 0.5, 0.5] as [number, number, number, number]
                    }
                  };
                  syncToCloud({...rois, fields: f});
                  setSelectedField(newFieldKey);
                  setNewFieldKey(''); setNewFieldName('');
                }}
                className="w-full py-3 bg-white text-gray-900 rounded-xl font-black text-xs hover:bg-gray-100 disabled:opacity-30 transition"
              >
                确认添加
              </button>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #bbb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #999; }
      `}</style>
    </div>
  );
};

export default ROIPage;