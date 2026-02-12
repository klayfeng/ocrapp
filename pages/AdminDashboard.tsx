
import React, { useState } from 'react';
import AdminRecordsPage from './AdminRecordsPage';
import ROIPage from './ROIPage';

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_auth') === 'true';
  });
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'rois'>('records');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('密码错误');
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
      
      <div className="flex-1 overflow-auto bg-gray-50">
        {activeTab === 'records' ? <AdminRecordsPage /> : <ROIPage />}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
