import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Database,
  MessageSquare,
  Search,
  Braces,
  Sparkles,
  Activity,
  PanelLeft,
  Zap
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: Database, label: 'Gateway', description: 'RAG Pipeline', color: 'emerald' },
  { path: '/ask', icon: MessageSquare, label: 'Ask', description: 'LLM Generation', color: 'cyan' },
  { path: '/search', icon: Search, label: 'Search', description: 'Vector Search', color: 'violet' },
  { path: '/embed', icon: Braces, label: 'Embed', description: 'Embeddings', color: 'amber' },
  { path: '/optimizer', icon: Sparkles, label: 'Optimizer', description: 'Query Enhancement', color: 'rose' },
  { path: '/health', icon: Activity, label: 'Health', description: 'All Services', color: 'blue' },
];

const colorMap: Record<string, { active: string; icon: string; dot: string }> = {
  emerald: {
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/50',
    icon: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  cyan: {
    active: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/50',
    icon: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  violet: {
    active: 'text-violet-400 bg-violet-500/10 border-violet-500/50',
    icon: 'text-violet-400',
    dot: 'bg-violet-400',
  },
  amber: {
    active: 'text-amber-400 bg-amber-500/10 border-amber-500/50',
    icon: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  rose: {
    active: 'text-rose-400 bg-rose-500/10 border-rose-500/50',
    icon: 'text-rose-400',
    dot: 'bg-rose-400',
  },
  blue: {
    active: 'text-blue-400 bg-blue-500/10 border-blue-500/50',
    icon: 'text-blue-400',
    dot: 'bg-blue-400',
  },
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass sticky top-0 z-20">
        <div className="accent-line" />
        <div className="px-3 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors text-slate-400 hover:text-slate-200 flex-shrink-0"
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <PanelLeft className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 truncate tracking-tight">
                  Athars <span className="gradient-text">AI</span>
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Internal Testing Dashboard
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Dev Mode
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-[53px] sm:top-[65px] left-0 w-60 h-[calc(100vh-53px)] sm:h-[calc(100vh-65px)] z-40 overflow-y-auto border-r border-slate-800/60 bg-slate-950/95 backdrop-blur-xl transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Services
              </p>
            </div>

            {navItems.map((item) => {
              const colors = colorMap[item.color];
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group border border-transparent ${
                      isActive
                        ? colors.active
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? colors.icon : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 group-hover:text-slate-400 transition-colors">
                          {item.description}
                        </div>
                      </div>
                      {isActive && (
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/40">
            <div className="text-[10px] text-slate-600 text-center">
              Pipeline: Optimizer &rarr; Embed &rarr; Search &rarr; Ask
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-3 sm:p-6 overflow-auto w-full min-h-[calc(100vh-65px)]">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
