
import React from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import UserPage from './pages/UserPage';
import AdminDashboard from './pages/AdminDashboard';

const Navbar: React.FC = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <nav className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-200">AI</div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-black text-gray-900">合同识别系统</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Enterprise OCR</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 md:gap-2">
        <Link 
          to="/" 
          className={`px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition ${location.pathname === '/' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          C端识别
        </Link>
        <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
        <Link 
          to="/admin" 
          className={`px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition ${isAdminPath ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          管理后台
        </Link>
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<UserPage />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
