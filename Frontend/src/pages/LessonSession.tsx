import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, Compass } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { LessonItemDto } from '../types';

export const LessonSession: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['availableLessons'],
    queryFn: () => api.lessons.getAvailable(5),
    enabled: !user?.isAdmin,
  });

  const [sessionLessons, setSessionLessons] = useState<LessonItemDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'meaning' | 'reading' | 'components' | 'quiz'>('meaning');
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizStatus, setQuizStatus] = useState<'unanswered' | 'correct' | 'incorrect'>('unanswered');

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

  // Freeze the session batch so mutations don't truncate the array mid-lesson
  useEffect(() => {
    if (lessons && lessons.length > 0 && sessionLessons.length === 0) {
      setSessionLessons(lessons);
    }
  }, [lessons, sessionLessons.length]);

  const completeMutation = useMutation({
    mutationFn: (subjectId: number) => api.lessons.complete(subjectId),
    onSuccess: () => {
      // Invalidate dashboard stats so counters update in the background
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });

  if (isLoading && sessionLessons.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-zinc-500">Loading lesson queue...</span>
        </div>
      </div>
    );
  }

  if (sessionLessons.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-3xl max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">No Lessons Available</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            You've studied all currently unlocked subjects. As you complete reviews and advance items to the Guru stage, more subjects will automatically unlock!
          </p>
          <Link
            to="/"
            className="inline-block py-3 px-6 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white font-semibold text-sm transition-all"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentItem: LessonItemDto | undefined = sessionLessons[currentIndex];
  const isLastLesson = currentIndex >= sessionLessons.length - 1;

  if (!currentItem) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-3xl max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Lessons Completed!</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            All subjects in this lesson batch have been learned and entered into your SRS queue.
          </p>
          <Link
            to="/reviews"
            className="inline-block py-3 px-6 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-all"
          >
            Go to Reviews
          </Link>
        </div>
      </div>
    );
  }

  const getTypeTheme = () => {
    switch (currentItem.type) {
      case 'Radical':
        return {
          bg: 'bg-gradient-to-br from-teal-950 via-teal-800 to-cyan-600',
          accent: 'text-teal-600 dark:text-teal-400',
          border: 'border-teal-500/40',
        };
      case 'Kanji':
        return {
          bg: 'bg-gradient-to-br from-rose-950 via-red-800 to-rose-600',
          accent: 'text-red-600 dark:text-rose-400',
          border: 'border-red-500/40',
        };
      case 'Vocabulary':
        return {
          bg: 'bg-gradient-to-br from-purple-950 via-purple-800 to-violet-600',
          accent: 'text-purple-600 dark:text-purple-400',
          border: 'border-purple-500/40',
        };
    }
  };

  const theme = getTypeTheme();
  const primaryMeaning = currentItem.meanings.find((m) => m.isPrimary)?.meaningText || currentItem.meanings[0]?.meaningText || '';
  const primaryReading = currentItem.readings.find((r) => r.isPrimary)?.readingText || currentItem.readings[0]?.readingText;
  const meaningMnemonic = currentItem.mnemonics.find((m) => m.type === 'Meaning')?.text;
  const readingMnemonic = currentItem.mnemonics.find((m) => m.type === 'Reading')?.text;

  const handleQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizAnswer.trim()) return;

    const cleanInput = quizAnswer.trim().toLowerCase();
    const cleanPrimary = primaryMeaning.toLowerCase();

    if (cleanInput === cleanPrimary || cleanInput.includes(cleanPrimary)) {
      setQuizStatus('correct');
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    } else {
      setQuizStatus('incorrect');
    }
  };

  const handleNext = async () => {
    if (!currentItem) return;

    await completeMutation.mutateAsync(currentItem.subjectId);

    if (isLastLesson) {
      // Invalidate queries now that the whole batch is finished
      queryClient.invalidateQueries({ queryKey: ['availableLessons'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });

      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      navigate('/reviews');
    } else {
      setCurrentIndex((prev) => prev + 1);
      setActiveTab('meaning');
      setQuizAnswer('');
      setQuizStatus('unanswered');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-20 transition-colors">
      {/* Top Session Bar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#050507]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Lesson</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">
              Lesson {currentIndex + 1} of {sessionLessons.length}
            </span>
            <div className="w-24 h-2 bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-800">
              <div
                className="h-full bg-teal-600 dark:bg-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / sessionLessons.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Character Hero Banner */}
        <div className={`w-full py-12 px-6 rounded-3xl ${theme.bg} shadow-2xl flex flex-col items-center justify-center relative overflow-hidden text-white`}>
          <div className="absolute top-4 left-6 flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-black opacity-85">
              {currentItem.type} · Level {currentItem.level}
            </span>
          </div>

          <div className="font-japanese text-7xl sm:text-8xl font-normal tracking-wide drop-shadow-lg my-4 animate-in fade-in zoom-in-95 duration-200">
            {currentItem.character}
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold tracking-tight">{primaryMeaning}</div>
            {primaryReading && (
              <div className="font-japanese text-lg font-light opacity-90 mt-1">
                {primaryReading}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-2xl bg-zinc-100 dark:bg-[#0c0d12] p-1 border border-zinc-200 dark:border-zinc-800 gap-1 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('meaning')}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              activeTab === 'meaning'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Meaning
          </button>

          {currentItem.readings.length > 0 && (
            <button
              onClick={() => setActiveTab('reading')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === 'reading'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Reading
            </button>
          )}

          {currentItem.components.length > 0 && (
            <button
              onClick={() => setActiveTab('components')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === 'components'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Components
            </button>
          )}

          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'quiz'
                ? 'bg-gradient-to-r from-red-700 to-rose-600 text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mini Check</span>
          </button>
        </div>

        {/* Tab Content Cards */}
        {activeTab === 'meaning' && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">Primary Meaning</span>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{primaryMeaning}</h3>
              {currentItem.meanings.length > 1 && (
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-zinc-500">Alternatives:</span>
                  {currentItem.meanings
                    .filter((m) => !m.isPrimary)
                    .map((m) => (
                      <span key={m.id} className="text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        {m.meaningText}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {meaningMnemonic && (
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800/80">
                <span className="text-xs uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400">Meaning Mnemonic</span>
                <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 mt-2 leading-relaxed">
                  {meaningMnemonic}
                </p>
              </div>
            )}

            {currentItem.meaningHint && (
              <div className="text-xs text-zinc-500 bg-zinc-50 dark:bg-[#0c0d12] p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/60">
                <strong className="text-zinc-700 dark:text-zinc-300">Visual Hint:</strong> {currentItem.meaningHint}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reading' && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">Primary Reading</span>
              <div className="flex items-center gap-4 mt-2">
                <span className="font-japanese text-3xl font-bold text-zinc-900 dark:text-white">{primaryReading}</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-600 dark:text-rose-400">
                  {currentItem.readings[0]?.type}
                </span>
              </div>
            </div>

            {readingMnemonic && (
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800/80">
                <span className="text-xs uppercase tracking-wider font-bold text-red-600 dark:text-rose-400">Reading Mnemonic</span>
                <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 mt-2 leading-relaxed">
                  {readingMnemonic}
                </p>
              </div>
            )}

            {currentItem.exampleSentences.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">Example Sentence</span>
                {currentItem.exampleSentences.map((ex) => (
                  <div key={ex.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800">
                    <div className="font-japanese text-lg font-medium text-zinc-900 dark:text-white">{ex.japanese}</div>
                    <div className="text-xs text-zinc-500 mt-1">{ex.english}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'components' && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">Composing Radicals</span>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                This {currentItem.type.toLowerCase()} is formed from the following building blocks:
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              {currentItem.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="px-6 py-5 rounded-2xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 flex flex-col items-center"
                >
                  <span className="font-japanese text-4xl font-bold text-teal-700 dark:text-teal-300">{comp}</span>
                  <span className="text-xs text-zinc-500 mt-2">Radical</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400">Active Recall Mini-Check</span>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
                What does <span className="font-japanese text-2xl text-teal-600 dark:text-teal-300 mx-1">{currentItem.character}</span> mean?
              </h3>
            </div>

            {quizStatus === 'unanswered' ? (
              <form onSubmit={handleQuizSubmit} className="space-y-4">
                <input
                  type="text"
                  autoFocus
                  value={quizAnswer}
                  onChange={(e) => setQuizAnswer(e.target.value)}
                  placeholder="Type the English meaning..."
                  className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-[#0c0d12] border border-zinc-300 dark:border-zinc-700 text-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-teal-600 dark:focus:border-teal-400"
                />
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl font-bold bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                >
                  Check Answer
                </button>
              </form>
            ) : quizStatus === 'correct' ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/50 text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Spot on!</div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  You've learned <strong>{currentItem.character}</strong> ({primaryMeaning}). It is now ready for spaced repetition reviews!
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/50 text-center space-y-3">
                <div className="text-lg font-bold text-rose-800 dark:text-rose-300">Not quite!</div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  The primary meaning is <strong>{primaryMeaning}</strong>.
                </p>
                <button
                  onClick={() => {
                    setQuizStatus('unanswered');
                    setQuizAnswer('');
                  }}
                  className="px-4 py-2 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between pt-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => {
              setCurrentIndex((prev) => Math.max(prev - 1, 0));
              setActiveTab('meaning');
            }}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors text-sm font-semibold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={handleNext}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-600 hover:from-teal-600 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-teal-950/40 transition-all flex items-center gap-2 group"
          >
            <span>{isLastLesson ? 'Complete Lesson Batch' : 'Next Subject'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
