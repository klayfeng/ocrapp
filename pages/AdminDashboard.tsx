
import React, { useState, useEffect } from 'react';
import AdminRecordsPage from './AdminRecordsPage';
import ROIPage from './ROIPage';
import { StorageService } from '../services/storage';
import { AIModelConfig } from '../types';

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_auth') === 'true';
  });
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'rois' | 'config'>('records');
  const [modelConfig, setModelConfig] = useState<AIModelConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      StorageService.getModelConfig().then(setModelConfig);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('密码错误');
    }
  };

  const handleSaveConfig = async () => {
    if (!modelConfig) return;
    setSaving(true);
    try {
      await StorageService.updateModelConfig(modelConfig);
      alert("模型配置已成功同步至云端！");
    } catch (e: any) {
      alert("保存失败: " + (e.message || "请检查数据库连接"));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-100">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gray-900 text-white rounded-2xl flex items-center justify-center mx-auto text-2xl font-black mb-4">A</div>
            <h2 className="text-2xl font-black text-gray-900">管理后台准入</h2>
            <p className="text-gray-400 text-sm font-medium">请输入管理员密码以访问核心功能</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="密码" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center tracking-widest"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              登录系统
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-1 flex gap-8 shrink-0 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('records')}
          className={`py-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'records' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          流水审计
        </button>
        <button 
          onClick={() => setActiveTab('rois')}
          className={`py-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'rois' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          ROI 标注
        </button>
        <button 
          onClick={() => setActiveTab('config')}
          className={`py-4 px-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          模型配置
        </button>
        <div className="flex-1"></div>
        <button 
          onClick={() => {
            setIsAuthenticated(false);
            sessionStorage.removeItem('admin_auth');
          }}
          className="py-4 px-2 text-xs font-bold text-red-500 hover:text-red-600 transition-all shrink-0"
        >
          退出登录
        </button>
      </div>
      
      <div className="flex-1 overflow-auto bg-gray-50 custom-scrollbar">
        {activeTab === 'records' && <AdminRecordsPage />}
        {activeTab === 'rois' && <ROIPage />}
        {activeTab === 'config' && (
          <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900">自定义大模型配置</h2>
              <p className="text-sm text-gray-400 font-medium">配置后系统将即时切换识别底层，不再调用 Google Gemini</p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-200 border border-gray-100 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">API Endpoint URL</label>
                <input 
                  value={modelConfig?.url || ''}
                  onChange={e => setModelConfig(prev => prev ? {...prev, url: e.target.value} : null)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">API Key</label>
                <input 
                  type="password"
                  value={modelConfig?.api_key || ''}
                  onChange={e => setModelConfig(prev => prev ? {...prev, api_key: e.target.value} : null)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="sk-..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Model Name</label>
                <input 
                  value={modelConfig?.model_name || ''}
                  onChange={e => setModelConfig(prev => prev ? {...prev, model_name: e.target.value} : null)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="code-default"
                />
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {saving ? '正在保存...' : '应用并同步至云端'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
