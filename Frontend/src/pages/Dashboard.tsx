import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Layers,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Plus,
  ScrollText,
  Compass,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SubjectBadge } from '../components/SubjectBadge';
import { ReviewForecastChart } from '../components/ReviewForecastChart';
import type { AdminDeckStats, DashboardStatsDto } from '../types';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // If Admin: fetch admin deck metrics
  const { data: adminStats, isLoading: isLoadingAdmin } = useQuery<AdminDeckStats>({
    queryKey: ['adminDeckStats'],
    queryFn: api.dashboard.getAdminStats,
    enabled: !!user?.isAdmin,
    refetchInterval: 15000,
  });

  // If Learner: fetch learner SRS stats
  const { data: stats, isLoading: isLoadingLearner, isError } = useQuery<DashboardStatsDto>({
    queryKey: ['dashboardStats'],
    queryFn: api.dashboard.getStats,
    enabled: !user?.isAdmin,
    refetchInterval: 15000,
  });

  // Loading state
  if ((user?.isAdmin && isLoadingAdmin) || (!user?.isAdmin && isLoadingLearner)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-muted)] font-medium">Loading Kotoba dashboard...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ADMIN DASHBOARD VIEW (Central Deck Control, Curation, Diagnostics)
  // -------------------------------------------------------------
  if (user?.isAdmin && adminStats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 md:pb-12">
        {/* Admin Top Banner */}
        <section className="minimal-card p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[var(--color-sage-light)] text-[var(--color-sage)] text-xs font-bold uppercase tracking-wider border border-[var(--color-sage)]/30">
                  Admin Deck Curator
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">Centralized Curriculum</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-1.5">
                Deck Architecture & Curriculum Control
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
                As curriculum administrator, you configure and balance the centralized Japanese learning deck.
                Personal learning queues (SRS reviews/lessons) are disabled on admin accounts so configuration remains centralized.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link to="/subjects" className="btn-primary text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>Add Subject</span>
              </Link>
              <Link to="/ai" className="btn-secondary text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#f100a1]" />
                <span>AI Deck Studio</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Deck KPI Overview Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="minimal-card p-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Total Subjects
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-1 block">
              {adminStats.totalSubjects}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">In shared deck</span>
          </div>

          <div className="minimal-card p-4 text-center border-[#00a1f1]/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00a1f1] block">
              Radicals
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#00a1f1] mt-1 block">
              {adminStats.totalRadicals}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Visual components</span>
          </div>

          <div className="minimal-card p-4 text-center border-[#f100a1]/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#f100a1] block">
              Kanji
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#f100a1] mt-1 block">
              {adminStats.totalKanji}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Characters</span>
          </div>

          <div className="minimal-card p-4 text-center border-[#a100f1]/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#a100f1] block">
              Vocabulary
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#a100f1] mt-1 block">
              {adminStats.totalVocabulary}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Words & Sentences</span>
          </div>

          <div className="minimal-card p-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
              AI Pending
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
              {adminStats.pendingAiCount}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Needs review</span>
          </div>

          <div className="minimal-card p-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Active Learners
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[var(--color-sage)] mt-1 block">
              {adminStats.totalLearners}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Student accounts</span>
          </div>
        </section>

        {/* Quick Admin Actions Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/ai"
            className="minimal-card p-5 hover:border-[var(--color-sage)] transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#f100a1]/10 text-[#f100a1] flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Deck Studio</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Batch-generate hierarchical levels with Gemini 3.5 Flash and approve into the live deck.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-[var(--color-sage)] mt-4">
              <span>Open Studio</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/subjects"
            className="minimal-card p-5 hover:border-[var(--color-sage)] transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#a100f1]/10 text-[#a100f1] flex items-center justify-center mb-3">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Deck Management</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Directly add, edit, or delete subjects, inspect readings, mnemonics, and prerequisites.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-[var(--color-sage)] mt-4">
              <span>Manage Subjects</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/logs"
            className="minimal-card p-5 hover:border-[var(--color-sage)] transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#00a1f1]/10 text-[#00a1f1] flex items-center justify-center mb-3">
                <ScrollText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">System Logs & Telemetry</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Inspect live HTTP requests, status codes, AI generation logs, and errors in real-time.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-[var(--color-sage)] mt-4">
              <span>View Logs</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </section>

        {/* Level Distribution Matrix */}
        <section className="minimal-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Deck Distribution by Level</h2>
              <p className="text-xs text-[var(--text-muted)]">Subject counts across curriculum tiers</p>
            </div>
            <Link to="/subjects" className="text-xs font-semibold text-[var(--color-sage)] hover:underline">
              View All in Deck →
            </Link>
          </div>

          <div className="space-y-2">
            {adminStats.levelDistribution.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No subjects currently in deck.</p>
            ) : (
              adminStats.levelDistribution.map((lvl) => (
                <div key={lvl.level} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-muted)] text-xs">
                  <span className="w-16 font-bold text-[var(--text-primary)] font-mono">
                    Level {lvl.level}
                  </span>
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-[#00a1f1]/15 text-[#00a1f1] font-semibold text-[11px]">
                      {lvl.radicalsCount} Radicals
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#f100a1]/15 text-[#f100a1] font-semibold text-[11px]">
                      {lvl.kanjiCount} Kanji
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#a100f1]/15 text-[#a100f1] font-semibold text-[11px]">
                      {lvl.vocabCount} Vocabulary
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {lvl.totalCount} items
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Subjects Added */}
        {adminStats.recentSubjects.length > 0 && (
          <section className="minimal-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Recently Added to Curriculum</h2>
              <Link to="/subjects" className="text-xs font-semibold text-[var(--color-sage)] hover:underline">
                Explore All →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {adminStats.recentSubjects.map((s) => (
                <SubjectBadge
                  key={s.id}
                  character={s.character}
                  type={s.type}
                  primaryMeaning={s.primaryMeaning}
                  primaryReading={s.primaryReading}
                  size="sm"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LEARNER / STUDENT DASHBOARD VIEW
  // -------------------------------------------------------------
  if (isError || !stats) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <div className="minimal-card p-6 border-rose-500/30">
          <p className="text-rose-600 dark:text-rose-400 font-semibold mb-2">Unable to reach learning database</p>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Please ensure PostgreSQL is running and the database connection is initialized.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary text-xs">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const srsStages = [
    { label: 'Apprentice', count: stats.srsDistribution.apprentice, color: 'bg-sky-600', text: 'text-sky-600 dark:text-sky-400' },
    { label: 'Guru', count: stats.srsDistribution.guru, color: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Master', count: stats.srsDistribution.master, color: 'bg-teal-600', text: 'text-teal-600 dark:text-teal-400' },
    { label: 'Enlightened', count: stats.srsDistribution.enlightened, color: 'bg-amber-600', text: 'text-amber-600 dark:text-amber-400' },
    { label: 'Burned', count: stats.srsDistribution.burned, color: 'bg-zinc-700', text: 'text-zinc-600 dark:text-zinc-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 md:pb-12">
      {/* Top Banner: Level Progress */}
      <section className="minimal-card p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[var(--color-sage-light)] text-[var(--color-sage)] text-xs font-bold uppercase tracking-wider border border-[var(--color-sage)]/30">
                Level {stats.currentLevel}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">Kanji Progression</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mt-1.5">
              Level {stats.currentLevel} Trajectory
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">
              Pass 90% of Level {stats.currentLevel} Kanji to the Guru stage to unlock Level {stats.currentLevel + 1}.
            </p>
          </div>

          <div className="w-full md:w-80">
            <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
              <span className="text-[var(--text-secondary)]">Kanji to Guru</span>
              <span className="text-[var(--color-sage)] font-mono font-bold">{stats.levelProgressPercentage}% Complete</span>
            </div>
            <div className="w-full h-2.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
              <div
                className="h-full rounded-full bg-[var(--color-sage)] transition-all duration-500"
                style={{ width: `${Math.max(stats.levelProgressPercentage, 4)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Primary Action Hero Cards: Lessons & Reviews */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Start Lessons CTA */}
        <div className="minimal-card p-6 sm:p-7 flex flex-col justify-between group hover:border-[var(--color-sage)] transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#00a1f1]/10 text-[#00a1f1] flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-3xl font-black text-[var(--text-primary)] font-mono">
                {stats.lessonsAvailable}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Lessons Queue</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Learn new Radicals, Kanji, and Vocabulary through mnemonic stories and visual breakdowns.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
            {stats.lessonsAvailable > 0 ? (
              <Link
                to="/lessons"
                className="btn-primary text-xs w-full sm:w-auto"
              >
                <span>Start {stats.lessonsAvailable} Lessons</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            ) : (
              <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-sage)]" />
                No lessons pending.
              </span>
            )}
          </div>
        </div>

        {/* Start Reviews CTA */}
        <div className="minimal-card p-6 sm:p-7 flex flex-col justify-between group hover:border-[#f100a1] transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#f100a1]/10 text-[#f100a1] flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-3xl font-black text-[var(--text-primary)] font-mono">
                {stats.reviewsAvailable}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Reviews Queue</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Test your recall at optimal spaced repetition intervals to lock items permanently into memory.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
            {stats.reviewsAvailable > 0 ? (
              <Link
                to="/reviews"
                className="btn-primary text-xs w-full sm:w-auto bg-[#f100a1] hover:bg-[#dc0093]"
              >
                <span>Start {stats.reviewsAvailable} Reviews</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            ) : (
              <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-sage)]" />
                All reviews cleared!
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Review Forecast Chart */}
      <ReviewForecastChart />

      {/* SRS Distribution */}
      <section className="minimal-card p-6 sm:p-7 space-y-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Spaced Repetition Stages</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {srsStages.map((stage) => (
            <div key={stage.label} className="p-3.5 rounded-xl bg-[var(--bg-muted)] text-center">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${stage.text} block`}>
                {stage.label}
              </span>
              <span className="text-xl font-bold text-[var(--text-primary)] mt-1 block">
                {stage.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Subjects */}
      {stats.recentSubjects.length > 0 && (
        <section className="minimal-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Recent Items Studied</h2>
            <Link to="/subjects" className="text-xs font-semibold text-[var(--color-sage)] hover:underline">
              View All Curriculum →
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {stats.recentSubjects.map((s) => (
              <SubjectBadge
                key={s.id}
                character={s.character}
                type={s.type}
                primaryMeaning={s.primaryMeaning}
                primaryReading={s.primaryReading}
                stage={s.stage}
                size="sm"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
