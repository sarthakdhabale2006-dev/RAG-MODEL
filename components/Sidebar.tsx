
import React from 'react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode }) => {
  const modes = [
    { id: AppMode.CHAT, icon: 'fa-comments', label: 'AI Chat' },
    { id: AppMode.LIVE, icon: 'fa-microphone', label: 'Live Voice' },
    { id: AppMode.GENERATE, icon: 'fa-wand-magic-sparkles', label: 'Generator' },
    { id: AppMode.ANALYST, icon: 'fa-chart-pie', label: 'Data Analyst' },
    { id: AppMode.RAG, icon: 'fa-book', label: 'RAG Lab' },
  ];

  return (
    <aside className="w-20 md:w-64 glass-panel border-r border-slate-700 flex flex-col h-screen transition-all duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <i className="fa-solid fa-bolt text-white text-xl"></i>
        </div>
        <h1 className="hidden md:block font-bold text-xl gradient-text">OmniGenius</h1>
      </div>

      <nav className="flex-1 px-3 space-y-2 mt-4">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
              currentMode === mode.id
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <i className={`fa-solid ${mode.icon} text-lg w-6 text-center`}></i>
            <span className="hidden md:block font-medium">{mode.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-slate-800/50 rounded-2xl p-4 hidden md:block">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Power Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm text-slate-300">Models Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
