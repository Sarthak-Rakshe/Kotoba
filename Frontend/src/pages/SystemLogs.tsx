import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ScrollText,
  RotateCw,
  Trash2,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';
import type { SystemLogEntry } from '../types';

export const SystemLogs: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [level, setLevel] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<SystemLogEntry[]>({
    queryKey: ['systemLogs', level, category, search],
    queryFn: () => api.admin.getLogs({ limit: 100, level, category, search }),
    refetchInterval: autoRefresh ? 4000 : false,
  });

  const clearMutation = useMutation({
    mutationFn: api.admin.clearLogs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemLogs'] });
      setIsClearConfirmOpen(false);
      showToast('System logs cleared.', 'info');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to clear logs.', 'error');
    },
  });

  if (!user?.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="minimal-card p-8 border-amber-500/30">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Administrator Access Required
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            System logs and audit trails are restricted to deck administrators.
          </p>
          <a href="/" className="btn-primary text-sm">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const getLevelBadge = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case 'INFO':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--color-sage-light)] text-[var(--color-sage)] border border-[var(--color-sage)]/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            INFO
          </span>
        );
      case 'WARN':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            WARN
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {lvl}
          </span>
        );
    }
  };

  const getStatusBadge = (statusCode?: number) => {
    if (!statusCode) return null;
    let color = 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    if (statusCode >= 200 && statusCode < 300) {
      color = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
    } else if (statusCode >= 400 && statusCode < 500) {
      color = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
    } else if (statusCode >= 500) {
      color = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30';
    }

    return (
      <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${color}`}>
        {statusCode}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24 md:pb-12 min-h-[85vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--color-sage-light)] text-[var(--color-sage)]">
              <ScrollText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">System Logs & Audit Trail</h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Real-time diagnostics, HTTP telemetry, AI synthesis events, and deck configuration changes.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none bg-[var(--bg-surface)] px-3 py-2 rounded-xl border border-[var(--border-subtle)]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-[#8b9a6e] rounded cursor-pointer"
            />
            <span>Live Feed</span>
          </label>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-all"
            title="Refresh logs"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[var(--color-sage)]' : ''}`} />
          </button>

          <button
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={clearMutation.isPending}
            className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="minimal-card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Level:
          </span>
          {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                level === lvl
                  ? 'bg-[var(--color-sage)] text-white shadow-xs'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {lvl}
            </button>
          ))}

          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

          <span className="text-xs font-semibold text-[var(--text-muted)]">Category:</span>
          {(['ALL', 'DECK', 'AI', 'HTTP', 'AUTH'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                category === cat
                  ? 'bg-[#a100f1] text-white shadow-xs'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoint, message, user..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
          />
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="minimal-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-3 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-[var(--text-muted)] text-xs">
            No log entries match the current filter.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const timeStr = new Date(log.timestamp).toLocaleTimeString();
              const dateStr = new Date(log.timestamp).toLocaleDateString();

              return (
                <div
                  key={log.id}
                  className="p-3 sm:px-4 hover:bg-[var(--bg-muted)]/50 transition-colors text-xs flex flex-col gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-[10px] text-[var(--text-muted)] flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {dateStr} {timeStr}
                      </span>
                      {getLevelBadge(log.level)}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                        {log.category}
                      </span>
                      {getStatusBadge(log.statusCode)}
                      <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                        {log.method} {log.endpoint}
                      </span>
                      {log.durationMs > 0 && (
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {log.durationMs}ms
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {log.user && (
                        <span className="text-[10px] text-[var(--color-sage)] font-semibold">
                          {log.user}
                        </span>
                      )}
                      {log.details && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'Details'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="text-[var(--text-secondary)] font-medium pl-1">
                    {log.message}
                  </div>

                  {/* Details / Exception stack trace */}
                  {isExpanded && log.details && (
                    <pre className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono text-[10px] text-rose-700 dark:text-rose-300 overflow-x-auto whitespace-pre-wrap leading-relaxed mt-1">
                      {log.details}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={() => clearMutation.mutate()}
        title="Clear System Logs?"
        variant="danger"
        confirmText={clearMutation.isPending ? 'Clearing...' : 'Clear Logs'}
        isLoading={clearMutation.isPending}
        message="Are you sure you want to clear recent system logs from the audit database? This action cannot be undone."
      />
    </div>
  );
};
