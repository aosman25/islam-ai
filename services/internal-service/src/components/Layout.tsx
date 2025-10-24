import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Database,
  MessageSquare,
  Search,
  Braces,
  Sparkles,
  Activity,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: Database, label: 'Gateway Service', description: 'RAG Pipeline' },
  { path: '/ask', icon: MessageSquare, label: 'Ask Service', description: 'LLM Generation' },
  { path: '/search', icon: Search, label: 'Search Service', description: 'Vector Search' },
  { path: '/embed', icon: Braces, label: 'Embed Service', description: 'Embeddings' },
  { path: '/optimizer', icon: Sparkles, label: 'Query Optimizer', description: 'Query Enhancement' },
  { path: '/health', icon: Activity, label: 'Health Check', description: 'All Services' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Islamic AI Services Internal Tool
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Testing interface for all microservices
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } transition-all duration-300 overflow-hidden bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-73px)]`}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-start gap-3 px-3 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
