import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Layers, BarChart2, Sparkles, LogOut, Compass, Sun, Moon, ScrollText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#8b9a6e] text-white flex items-center justify-center font-japanese text-lg font-bold shadow-sm transition-transform group-hover:scale-105">
            言
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-[var(--text-primary)]">
              KOTOBA
            </span>
            <span className="text-[10px] text-[var(--color-sage)] font-semibold -mt-1 tracking-wider uppercase">
              {user?.isAdmin ? 'Central Deck Studio' : '言葉 · Japanese SRS'}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
          {user?.isAdmin ? (
            /* Admin Navigation (Central Deck Management, AI Deck Studio, Logs, Overview) */
            <>
              <Link
                to="/"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-[var(--color-sage)]" />
                <span>Deck Overview</span>
              </Link>

              <Link
                to="/subjects"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/subjects')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <Compass className="w-4 h-4 text-[#a100f1]" />
                <span>Deck Management</span>
              </Link>

              <Link
                to="/ai"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/ai')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#f100a1]" />
                <span>AI Deck Studio</span>
              </Link>

              <Link
                to="/logs"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/logs')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <ScrollText className="w-4 h-4 text-[#00a1f1]" />
                <span>System Logs</span>
              </Link>
            </>
          ) : (
            /* Student / Learner Navigation */
            <>
              <Link
                to="/"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-[var(--color-sage)]" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/lessons"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/lessons')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[#00a1f1]" />
                <span>Lessons</span>
              </Link>

              <Link
                to="/reviews"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/reviews')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <Layers className="w-4 h-4 text-[#f100a1]" />
                <span>Reviews</span>
              </Link>

              <Link
                to="/subjects"
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  isActive('/subjects')
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                <Compass className="w-4 h-4 text-[#a100f1]" />
                <span>Curriculum</span>
              </Link>
            </>
          )}
        </nav>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-all"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>

          <div className="hidden sm:flex flex-col text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-bold text-[var(--text-primary)]">{user?.username}</span>
              {user?.isAdmin && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--color-sage-light)] text-[var(--color-sage)] border border-[var(--color-sage)]/30 font-bold uppercase tracking-wider">
                  Curriculum Admin
                </span>
              )}
            </div>
            {!user?.isAdmin && (
              <span className="text-[11px] text-[var(--color-sage)] font-mono font-semibold">
                Level {user?.currentLevel}
              </span>
            )}
          </div>

          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
