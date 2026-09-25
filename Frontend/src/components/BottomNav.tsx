import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart2, BookOpen, Layers, Compass, Sparkles, ScrollText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  // Don't show bottom nav inside active review session to eliminate distractions
  if (location.pathname.startsWith('/reviews/session') || location.pathname.startsWith('/lessons/session')) {
    return null;
  }

  const items = user?.isAdmin
    ? [
        { path: '/', label: 'Overview', icon: BarChart2, color: 'text-[var(--color-sage)]' },
        { path: '/subjects', label: 'Deck', icon: Compass, color: 'text-[#a100f1]' },
        { path: '/ai', label: 'AI Studio', icon: Sparkles, color: 'text-[#f100a1]' },
        { path: '/logs', label: 'Logs', icon: ScrollText, color: 'text-[#00a1f1]' },
      ]
    : [
        { path: '/', label: 'Home', icon: BarChart2, color: 'text-[var(--color-sage)]' },
        { path: '/lessons', label: 'Lessons', icon: BookOpen, color: 'text-[#00a1f1]' },
        { path: '/reviews', label: 'Reviews', icon: Layers, color: 'text-[#f100a1]' },
        { path: '/subjects', label: 'Deck', icon: Compass, color: 'text-[#a100f1]' },
      ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-2 py-1.5 flex justify-around items-center transition-colors">
      {items.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              active
                ? 'text-[var(--text-primary)] scale-105 font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? item.color : 'text-[var(--text-muted)]'}`} />
            <span className={`text-[10px] mt-0.5 font-medium ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
