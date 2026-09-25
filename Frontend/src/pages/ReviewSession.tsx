import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import * as wanakana from 'wanakana';
import { ArrowLeft, Check, X, AlertTriangle, ArrowRight, Award, Sparkles, Compass } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ReviewQueueItemDto, SubmitReviewResponse } from '../types';

export const ReviewSession: React.FC = () => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const { data: queue, isLoading } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: () => api.reviews.getQueue(50),
    enabled: !user?.isAdmin,
  });

  const [items, setItems] = useState<ReviewQueueItemDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerInput, setAnswerInput] = useState('');
  const [state, setState] = useState<'answering' | 'evaluated' | 'completed'>('answering');
  const [lastResult, setLastResult] = useState<SubmitReviewResponse | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, total: 0 });

  if (user?.isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="minimal-card p-8 rounded-3xl max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-sage-light)] text-[var(--color-sage)] flex items-center justify-center mx-auto mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Central Deck Curator</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
            Admin accounts are configured exclusively for central deck management and AI synthesis. Learning queues (lessons & reviews) are reserved for student accounts.
          </p>
          <Link to="/subjects" className="btn-primary text-xs">
            Manage Central Deck
          </Link>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (queue && queue.length > 0 && items.length === 0) {
      setItems(queue);
      setCurrentIndex(0);
      setStartTime(Date.now());
      setStats({ correct: 0, incorrect: 0, total: queue.length });
    }
  }, [queue]);

  const currentItem = items[currentIndex];

  useEffect(() => {
    if (state === 'answering') {
      inputRef.current?.focus();
    }
  }, [state, currentIndex]);

  const submitMutation = useMutation({
    mutationFn: (data: { srsItemId: number; reviewType: any; submittedAnswer: string; responseTimeMs: number }) =>
      api.reviews.submit(data),
    onSuccess: (res) => {
      setLastResult(res);
      setState('evaluated');

      if (res.isCorrect) {
        setStats((prev) => ({ ...prev, correct: prev.correct + 1 }));
      } else {
        setStats((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
      }

      if (res.unlockedSubjects && res.unlockedSubjects.length > 0) {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      }

      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (currentItem?.reviewType === 'Reading') {
      val = wanakana.toHiragana(val, { IMEMode: true });
    }
    setAnswerInput(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || !currentItem) return;

    if (state === 'answering') {
      const responseTime = Date.now() - startTime;
      submitMutation.mutate({
        srsItemId: currentItem.srsItemId,
        reviewType: currentItem.reviewType,
        submittedAnswer: answerInput.trim(),
        responseTimeMs: responseTime,
      });
    } else if (state === 'evaluated') {
      handleNextItem();
    }
  };

  const handleNextItem = () => {
    if (currentIndex + 1 >= items.length) {
      setState('completed');
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
    } else {
      setCurrentIndex((prev) => prev + 1);
      setAnswerInput('');
      setState('answering');
      setLastResult(null);
      setStartTime(Date.now());
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && state === 'evaluated') {
        e.preventDefault();
        handleNextItem();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, currentIndex, items.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-zinc-500">Loading review queue...</span>
        </div>
      </div>
    );
  }

  if (items.length === 0 || state === 'completed') {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)]">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center mx-auto shadow-2xl shadow-red-950/40">
            <Award className="w-10 h-10 text-white" />
          </div>

          <div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white">Session Completed!</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Outstanding work reinforcing your active recall memory.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-xs text-zinc-500">Reviewed</span>
              <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white">{stats.total}</div>
            </div>
            <div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Correct</span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{stats.correct}</div>
            </div>
            <div>
              <span className="text-xs text-teal-600 dark:text-teal-400">Accuracy</span>
              <div className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400">{accuracy}%</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/"
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-red-800 via-rose-700 to-red-600 text-white shadow-lg shadow-red-950/40 hover:from-red-700 hover:to-rose-500 transition-all text-center"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getTypeStyles = () => {
    switch (currentItem.type) {
      case 'Radical':
        return {
          bg: 'bg-gradient-to-br from-teal-950 via-teal-800 to-cyan-600',
          bannerBg: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
        };
      case 'Kanji':
        return {
          bg: 'bg-gradient-to-br from-rose-950 via-red-800 to-rose-600',
          bannerBg: 'bg-red-500/15 text-red-700 dark:text-rose-300 border-red-500/30',
        };
      case 'Vocabulary':
        return {
          bg: 'bg-gradient-to-br from-purple-950 via-purple-800 to-violet-600',
          bannerBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
        };
    }
  };

  const typeStyle = getTypeStyles();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col justify-between pb-8 transition-colors">
      {/* Top Bar: Progress and Exit */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#050507]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">
              {currentIndex + 1} / {items.length}
            </span>
            <div className="w-32 h-2.5 bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Review Question Area */}
      <main className="max-w-2xl w-full mx-auto px-4 py-6 flex-1 flex flex-col justify-center space-y-6">
        {/* Character Hero Card */}
        <div
          className={`w-full py-16 px-6 rounded-3xl ${typeStyle.bg} shadow-2xl flex flex-col items-center justify-center relative overflow-hidden select-none`}
        >
          <div className="absolute top-4 left-6 flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-black text-white/80">
              {currentItem.type}
            </span>
          </div>

          <div className="font-japanese text-8xl sm:text-9xl font-normal text-white drop-shadow-md my-2 tracking-wide">
            {currentItem.character}
          </div>
        </div>

        {/* Question Type Header */}
        <div className="flex items-center justify-center">
          <div className={`px-5 py-2 rounded-full border text-sm font-bold tracking-wide flex items-center gap-2 ${typeStyle.bannerBg}`}>
            <span>
              {currentItem.type} {currentItem.reviewType}
            </span>
            {currentItem.reviewType === 'Reading' && (
              <span className="text-[11px] font-mono opacity-80">(Auto-Hiragana)</span>
            )}
          </div>
        </div>

        {/* Review Input / Submit */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              disabled={state === 'evaluated'}
              value={answerInput}
              onChange={handleInputChange}
              placeholder={
                currentItem.reviewType === 'Meaning'
                  ? 'Type the English meaning...'
                  : 'Type reading in Hiragana or Romaji...'
              }
              className={`w-full text-center px-6 py-4 rounded-2xl text-2xl font-medium tracking-wide transition-all focus:outline-none ${
                state === 'evaluated'
                  ? lastResult?.isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500 text-rose-800 dark:text-rose-200'
                  : 'bg-white dark:bg-[#0c0d12] border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:border-red-600 dark:focus:border-rose-500 focus:shadow-lg focus:shadow-red-950/30'
              }`}
            />
          </div>

          {state === 'answering' ? (
            <button
              type="submit"
              disabled={!answerInput.trim()}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-red-800 via-rose-700 to-red-600 hover:from-red-700 hover:to-rose-500 text-white shadow-lg shadow-red-950/40 transition-all disabled:opacity-40"
            >
              Submit Answer (Enter)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextItem}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white shadow-lg transition-all flex items-center justify-center gap-2 group"
            >
              <span>Continue (Enter)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </form>

        {/* Result Evaluation Banner */}
        {state === 'evaluated' && lastResult && (
          <div
            className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-3 duration-200 ${
              lastResult.isCorrect
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/50 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    lastResult.isCorrect ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {lastResult.isCorrect ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-lg font-bold">
                    {lastResult.isCorrect ? 'Correct!' : 'Incorrect'}
                  </h4>
                  {lastResult.hasTypoWarning && (
                    <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 mt-0.5 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Slight typo accepted!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stage Transition Tag */}
              <div className="text-right">
                <span className="text-[11px] font-mono uppercase text-zinc-500 block">SRS Stage</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-teal-700 dark:text-cyan-300">
                  {lastResult.previousStage} → {lastResult.newStage}
                </span>
              </div>
            </div>

            {/* If Incorrect, show correct answers */}
            {!lastResult.isCorrect && (
              <div className="mt-4 pt-4 border-t border-rose-200 dark:border-rose-900/40">
                <span className="text-xs uppercase font-bold text-rose-800 dark:text-rose-300 block mb-1">
                  Accepted {currentItem.reviewType}:
                </span>
                <div className="flex flex-wrap gap-2">
                  {(currentItem.reviewType === 'Meaning'
                    ? currentItem.acceptedMeanings
                    : currentItem.acceptedReadings
                  ).map((acc, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium text-sm border border-rose-300 dark:border-rose-800/40"
                    >
                      {acc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* If newly unlocked items */}
            {lastResult.unlockedSubjects && lastResult.unlockedSubjects.length > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-900/40 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  New Subjects Unlocked:{' '}
                  <strong className="font-japanese text-zinc-900 dark:text-white text-sm">
                    {lastResult.unlockedSubjects.join(', ')}
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer shortcut tips */}
      <footer className="text-center text-xs text-zinc-400 dark:text-zinc-600 font-mono">
        Desktop: Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">Enter</kbd> to submit / advance
      </footer>
    </div>
  );
};
