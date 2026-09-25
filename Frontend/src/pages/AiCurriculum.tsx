import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Edit3,
  Wand2,
  Check,
  X,
  AlertTriangle,
  Layers,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Clock,
  Minimize2,
  Maximize2,
  Brain,
  Sliders,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import type { SubjectType, AiPendingItem, LevelGenerationResultDto } from '../types';

const LOADING_TIPS = [
  {
    title: 'The Radical Foundation',
    tip: 'In WaniKani methodology, radicals are visual building blocks. Instead of memorizing 15+ random strokes, you recognize 2–3 meaningful Lego pieces.',
    icon: '🧱',
  },
  {
    title: 'Sensory & Vivid Mnemonics',
    tip: 'The human brain remembers bizarre, emotional, or humorous mental stories 400% better than dry repetitions. Don’t be afraid of silly visualizations!',
    icon: '🧠',
  },
  {
    title: 'Onyomi vs. Kunyomi',
    tip: 'Onyomi was borrowed from historical Chinese pronunciation and dominates compound words (Jukugo). Kunyomi represents native Japanese words.',
    icon: '🏮',
  },
  {
    title: 'Spaced Repetition Science',
    tip: 'Kotoba tests you at the exact moment neural memory begins to decay, locking items into permanent storage with minimal study fatigue.',
    icon: '📈',
  },
  {
    title: 'The Magic of Rendaku',
    tip: 'Ever wonder why "hito" becomes "bito" in "hitobito"? Consonants soften when joined together so spoken Japanese flows rhythmically.',
    icon: '🌊',
  },
  {
    title: 'Strict Pedagogical Progression',
    tip: 'Every Kanji in this batch directly uses the Radicals being generated, and every Vocabulary word uses these Kanji. Nothing is disconnected!',
    icon: '🔗',
  },
  {
    title: 'Furigana Context Sentences',
    tip: 'Synthesized vocabulary includes authentic Japanese example sentences with full ruby furigana markup for real-world contextual immersion.',
    icon: '📜',
  },
];

const PIPELINE_STAGES = [
  { title: 'Context & Grounding', desc: 'Loading learned history & public reference rules', atSec: 0 },
  { title: 'Stage 1: Curriculum Planner', desc: 'Gemini plans progressive radicals, kanji & vocab', atSec: 5 },
  { title: 'Backend Verification', desc: 'Validating no duplicates, counts & dependencies', atSec: 14 },
  { title: 'Stage 2: Content Enrichment', desc: 'Synthesizing original mnemonics & furigana sentences', atSec: 22 },
  { title: 'Dependency Linking', desc: 'Establishing Component & VocabularyKanji relationships', atSec: 30 },
  { title: 'Curriculum Publication', desc: 'Saving and auto-unlocking for active learners', atSec: 38 },
];

const QUICK_THEMES = [
  'Numbers & Counting',
  'Nature & Elements',
  'Body Parts & Family',
  'Daily Life & Food',
  'Time, Dates & Seasons',
  'Directions & Travel',
];

const getMeaningMnemonic = (parsed: any): string => {
  if (parsed?.meaningMnemonic && typeof parsed.meaningMnemonic === 'string') {
    return parsed.meaningMnemonic;
  }
  if (Array.isArray(parsed?.mnemonics)) {
    const item = parsed.mnemonics.find(
      (m: any) => m && String(m.type || '').toLowerCase() === 'meaning'
    );
    if (item?.text) return item.text;
    if (parsed.mnemonics.length > 0 && parsed.mnemonics[0]?.text) {
      return parsed.mnemonics[0].text;
    }
  }
  return '';
};

const getReadingMnemonic = (parsed: any): string => {
  if (parsed?.readingMnemonic && typeof parsed.readingMnemonic === 'string') {
    return parsed.readingMnemonic;
  }
  if (Array.isArray(parsed?.mnemonics)) {
    const item = parsed.mnemonics.find(
      (m: any) => m && String(m.type || '').toLowerCase() === 'reading'
    );
    if (item?.text) return item.text;
    if (parsed.mnemonics.length > 1 && parsed.mnemonics[1]?.text) {
      return parsed.mnemonics[1].text;
    }
  }
  return '';
};

const getMnemonicHint = (parsed: any, type: 'Meaning' | 'Reading'): string | undefined => {
  if (type === 'Meaning' && parsed?.meaningHint && typeof parsed.meaningHint === 'string') {
    return parsed.meaningHint;
  }
  if (Array.isArray(parsed?.mnemonics)) {
    const item = parsed.mnemonics.find(
      (m: any) => m && String(m.type || '').toLowerCase() === type.toLowerCase()
    );
    if (item?.hint) return item.hint;
  }
  return undefined;
};

export const AiCurriculum: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Mode: 'batch' (Synthesize Level) or 'single' (Single Subject)
  const [mode, setMode] = useState<'batch' | 'single'>('batch');

  // Single Subject State
  const [type, setType] = useState<SubjectType>('Kanji');
  const [character, setCharacter] = useState('');
  const [singleLevel, setSingleLevel] = useState(1);

  // Batch Level State & Presets
  const [batchLevel, setBatchLevel] = useState(1);
  const [batchTheme, setBatchTheme] = useState('');
  const [batchPreset, setBatchPreset] = useState<'standard' | 'express'>('standard');
  const [batchRadicals, setBatchRadicals] = useState(10);
  const [batchKanji, setBatchKanji] = useState(14);
  const [batchVocab, setBatchVocab] = useState(16);

  // Loading Screen States
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // UI Feedback
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [filterType, setFilterType] = useState<'All' | SubjectType>('All');
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  // Inline Action States
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [refiningId, setRefiningId] = useState<number | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    id: number;
    character: string;
    type: SubjectType;
    meaning: string;
    reading: string;
    meaningMnemonic: string;
    readingMnemonic: string;
  } | null>(null);

  // Bulk confirmation dialog states
  const [isApproveAllOpen, setIsApproveAllOpen] = useState(false);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // Query Pending AI Items
  const { data: pendingItems, isLoading: isLoadingPending } = useQuery<AiPendingItem[]>({
    queryKey: ['aiPending'],
    queryFn: api.ai.getPending,
    refetchInterval: 10000,
  });

  // Single Subject Mutation
  const generateMutation = useMutation({
    mutationFn: (data: { type: SubjectType; character: string; level: number }) =>
      api.ai.generate(data),
    onSuccess: (res) => {
      confetti({ particleCount: 35, spread: 45, origin: { y: 0.6 } });
      setStatusMsg({ text: `Generated content for "${res.character}". Added to Pending queue.` });
      setCharacter('');
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
    },
    onError: (err: any) => {
      setStatusMsg({ text: err.message || 'Generation failed', isError: true });
    },
  });

  // Level Batch Synthesizer Mutation
  const generateLevelMutation = useMutation({
    mutationFn: (data: {
      level: number;
      theme?: string;
      radicalCount?: number;
      kanjiCount?: number;
      vocabCount?: number;
    }) => api.ai.generateLevel(data),
    onSuccess: (res: LevelGenerationResultDto) => {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      setStatusMsg({
        text: `Level ${res.level} synthesized & published successfully! ${res.subjectCount} subjects (${res.radicalCount} Radicals, ${res.kanjiCount} Kanji, ${res.vocabCount} Vocabulary) added to curriculum.`,
      });
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err: any) => {
      setStatusMsg({ text: err.message || 'Level synthesis failed', isError: true });
    },
  });

  // Reset Level Mutation
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [levelToReset, setLevelToReset] = useState(1);

  const resetLevelMutation = useMutation({
    mutationFn: (lvl: number) => api.ai.resetLevel(lvl),
    onSuccess: (res) => {
      setStatusMsg({
        text: res.message || `Level ${res.level} curriculum was wiped cleanly.`,
        isError: false,
      });
      setIsResetModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
    },
    onError: (err: any) => {
      setStatusMsg({
        text: err.message || 'Failed to reset level curriculum.',
        isError: true,
      });
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: (id: number) => api.ai.approve(id),
    onSuccess: () => {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.ai.reject(id, reason),
    onSuccess: () => {
      setRejectingId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
    },
  });

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: ({ id, json }: { id: number; json: string }) =>
      api.ai.edit(id, json),
    onSuccess: () => {
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
    },
  });

  // Refine Mutation
  const refineMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: number; instruction: string }) =>
      api.ai.refine(id, instruction),
    onSuccess: () => {
      setRefiningId(null);
      setRefinePrompt('');
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
    },
  });

  // Approve All Mutation
  const approveAllMutation = useMutation({
    mutationFn: (subType?: SubjectType) => api.ai.approveAll(subType),
    onSuccess: (res) => {
      setIsApproveAllOpen(false);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      setStatusMsg({ text: res.message || `Approved ${res.count} subjects into the central curriculum.` });
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
    },
    onError: (err: any) => {
      setStatusMsg({ text: err.message || 'Bulk approval failed.', isError: true });
    },
  });

  // Reject All Mutation
  const rejectAllMutation = useMutation({
    mutationFn: ({ subType, reason }: { subType?: SubjectType; reason?: string }) =>
      api.ai.rejectAll(subType, reason),
    onSuccess: (res) => {
      setIsBulkRejectModalOpen(false);
      setBulkRejectReason('');
      setStatusMsg({ text: res.message || `Rejected ${res.count} subjects.` });
      queryClient.invalidateQueries({ queryKey: ['aiPending'] });
    },
    onError: (err: any) => {
      setStatusMsg({ text: err.message || 'Bulk rejection failed.', isError: true });
    },
  });

  // Non-admin guard
  if (!user?.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="glass-panel p-8 rounded-3xl border-amber-500/30">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            Administrator Access Required
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            The AI Deck Studio is restricted to curriculum administrators. Kotoba uses a unified central
            deck to deliver structured progression to all learners.
          </p>
          <a
            href="/"
            className="px-6 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white text-sm font-semibold transition-all inline-block"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const isGenerating = generateLevelMutation.isPending || generateMutation.isPending;
  const totalBatchCount = mode === 'batch' ? batchRadicals + batchKanji + batchVocab : 1;
  const estimatedSeconds = mode === 'batch' ? Math.max(22, Math.min(55, Math.round(totalBatchCount * 0.95))) : 8;

  React.useEffect(() => {
    if (!isGenerating) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    const tipTimer = setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 8000); // 8s — enough time to actually read the tip
    return () => {
      clearInterval(timer);
      clearInterval(tipTimer);
    };
  }, [isGenerating]);

  const progressPercent = Math.min(
    94,
    Math.round(5 + (elapsedSeconds / Math.max(1, estimatedSeconds)) * 85)
  );

  const currentStageIndex = PIPELINE_STAGES.findIndex((s, idx) => {
    const next = PIPELINE_STAGES[idx + 1];
    return elapsedSeconds >= s.atSec && (!next || elapsedSeconds < next.atSec);
  });
  const activeStage = PIPELINE_STAGES[currentStageIndex >= 0 ? currentStageIndex : PIPELINE_STAGES.length - 1];

  const handlePresetSelect = (preset: 'standard' | 'express') => {
    setBatchPreset(preset);
    if (preset === 'standard') {
      setBatchRadicals(10);
      setBatchKanji(14);
      setBatchVocab(16);
    } else if (preset === 'express') {
      setBatchRadicals(4);
      setBatchKanji(6);
      setBatchVocab(8);
    }
  };

  const handleSingleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!character.trim()) return;
    setStatusMsg(null);
    setElapsedSeconds(0);
    setIsMinimized(false);
    generateMutation.mutate({ type, character: character.trim(), level: singleLevel });
  };

  const handleBatchGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setElapsedSeconds(0);
    setIsMinimized(false);
    generateLevelMutation.mutate({
      level: batchLevel,
      theme: batchTheme.trim() ? batchTheme.trim() : undefined,
      radicalCount: batchRadicals,
      kanjiCount: batchKanji,
      vocabCount: batchVocab,
    });
  };

  const openEditModal = (item: AiPendingItem, parsed: any) => {
    setEditingItem({
      id: item.id,
      character: item.targetCharacter,
      type: item.subjectType,
      meaning: parsed.meanings?.[0]?.meaning || '',
      reading:
        typeof parsed.readings?.[0] === 'string'
          ? parsed.readings[0]
          : parsed.readings?.[0]?.reading || '',
      meaningMnemonic: getMeaningMnemonic(parsed),
      readingMnemonic: getReadingMnemonic(parsed),
    });
  };

  const saveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    // Find original item to preserve level and components
    const orig = pendingItems?.find((p) => p.id === editingItem.id);
    let originalParsed: any = {};
    if (orig) {
      try {
        originalParsed = JSON.parse(orig.parsedContentJson || '{}');
      } catch {}
    }

    const meaningTrimmed = editingItem.meaningMnemonic.trim();
    const readingTrimmed = editingItem.readingMnemonic.trim();

    const updatedJsonObj = {
      ...originalParsed,
      meanings: [
        { meaning: editingItem.meaning.trim(), isPrimary: true, accepted: true },
        ...(originalParsed.meanings?.slice(1) || []),
      ],
      readings: editingItem.reading.trim()
        ? [
            {
              reading: editingItem.reading.trim(),
              type: originalParsed.readings?.[0]?.type || 'Kunyomi',
              isPrimary: true,
            },
            ...(originalParsed.readings?.slice(1) || []),
          ]
        : [],
      meaningMnemonic: meaningTrimmed,
      readingMnemonic: readingTrimmed,
      mnemonics: [
        ...(meaningTrimmed
          ? [{
              type: 'Meaning',
              text: meaningTrimmed,
              hint: getMnemonicHint(originalParsed, 'Meaning'),
            }]
          : []),
        ...(readingTrimmed && editingItem.type !== 'Radical'
          ? [{
              type: 'Reading',
              text: readingTrimmed,
              hint: getMnemonicHint(originalParsed, 'Reading'),
            }]
          : []),
      ],
    };

    editMutation.mutate({
      id: editingItem.id,
      json: JSON.stringify(updatedJsonObj),
    });
  };

  const filteredItems = pendingItems?.filter((item) => {
    if (filterType === 'All') return true;
    return item.subjectType === filterType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 md:pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-5 h-5" />
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            AI Deck Studio & Curriculum Pipeline
          </h1>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-3xl">
          Automate curriculum deck synthesis for Kotoba. Generate interconnected Radicals, Kanji, and
          Vocabulary using <strong>gemini-2.5-flash</strong>. Approved cards are written to the central
          curriculum and automatically unlocked for learners at each level.
        </p>
      </div>

      {/* Mode Tabs & Reset Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode('batch')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mode === 'batch'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Progressive Level Synthesizer (2-Stage Pipeline)</span>
          </button>
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mode === 'single'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Single Subject Creator</span>
          </button>
        </div>

        <button
          onClick={() => {
            setLevelToReset(batchLevel);
            setIsResetModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset / Wipe Level Curriculum</span>
        </button>
      </div>

      {/* Status Alert or Tier 1 Quota Advisory */}
      {statusMsg?.isError &&
      (statusMsg.text.includes('429') ||
        statusMsg.text.includes('quota') ||
        statusMsg.text.includes('TooManyRequests') ||
        statusMsg.text.includes('RESOURCE_EXHAUSTED')) ? (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 text-amber-900 dark:text-amber-200 space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Gemini API Quota Exceeded (Free Tier Limit)
                </h4>
                <button
                  onClick={() => setStatusMsg(null)}
                  className="p-1 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                  title="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                Your Google AI Studio project is on the <strong>Free Tier</strong>. Google limits free preview model requests (e.g. 20 requests/day per model) or enforces temporary RPM cooldown intervals.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <span>🚀 Recommended Fix: Upgrade to Tier 1 (Pay-as-you-go)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 dark:text-amber-300">
              <li>Completely removes the 20 requests/day Free Tier cap</li>
              <li>Unlocks 1,000–2,000+ Requests Per Minute (RPM) &amp; 4,000,000 Tokens/Minute</li>
              <li>Has an automatic $10 / 10-minute spend safeguard cap</li>
              <li>Takes effect immediately upon linking a billing account</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <a
              href="https://ai.google.dev/gemini-api/docs/rate-limits#tier-1"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
            >
              <span>Tier 1 Rate Limits Guide ↗</span>
            </a>
            <a
              href="https://aistudio.google.com/plan_information"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-surface)] text-amber-900 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/10 transition-all flex items-center gap-1.5"
            >
              <span>Set Up Billing in Google AI Studio ↗</span>
            </a>
          </div>
        </div>
      ) : statusMsg && (
        <div
          className={`p-4 rounded-2xl text-sm flex items-center justify-between gap-2 ${
            statusMsg.isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 text-rose-800 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.isError ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-zinc-500"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Immersive Loading Screen Overlay */}
      {isGenerating && !isMinimized && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-md px-4">
          {/* Floating kanji glyphs (decorative) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            {['日', '月', '木', '山', '火', '水', '土', '金', '人', '口', '手', '目'].map((ch, i) => (
              <span
                key={i}
                className="absolute font-japanese font-black text-white/[0.03] animate-pulse"
                style={{
                  fontSize: `${60 + (i % 4) * 30}px`,
                  top: `${(i * 17 + 5) % 90}%`,
                  left: `${(i * 23 + 3) % 92}%`,
                  animationDelay: `${i * 0.4}s`,
                  animationDuration: `${3 + (i % 3)}s`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>

          <div className="relative w-full max-w-xl space-y-6 z-10">
            {/* Minimize button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span className="text-sm font-bold uppercase tracking-widest">AI Synthesis in Progress</span>
              </div>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs flex items-center gap-1.5"
                title="Minimize to pill"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Minimize</span>
              </button>
            </div>

            {/* Main Character */}
            <div className="text-center py-4">
              <span className="font-japanese text-9xl font-black text-white opacity-10 select-none">
                {mode === 'batch' ? `L${batchLevel}` : character || '?'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-mono">{progressPercent}% complete</span>
                <span className="text-zinc-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {elapsedSeconds}s elapsed · ~{Math.max(0, estimatedSeconds - elapsedSeconds)}s remaining
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 text-center">
                Generating {mode === 'batch' ? `${batchRadicals} Radicals + ${batchKanji} Kanji + ${batchVocab} Vocabulary` : '1 Subject'} for Level {mode === 'batch' ? batchLevel : singleLevel}
              </p>
            </div>

            {/* Pipeline Stages */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isPast = elapsedSeconds > (PIPELINE_STAGES[idx + 1]?.atSec ?? Infinity);
                const isCurrent = stage === activeStage;
                return (
                  <div
                    key={idx}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all ${
                      isPast
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : isCurrent
                        ? 'bg-amber-500/15 border border-amber-500/30 ring-1 ring-amber-500/20'
                        : 'bg-zinc-900/60 border border-zinc-800/50 opacity-40'
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                    )}
                    <span className={`text-[9px] font-semibold leading-tight ${isCurrent ? 'text-amber-300' : isPast ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {stage.title}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Active Stage Description */}
            {activeStage && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 transition-all duration-500">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-300 transition-all duration-500">{activeStage.title}</p>
                  <p className="text-xs text-zinc-400 transition-all duration-500">{activeStage.desc}</p>
                </div>
              </div>
            )}

            {/* Rotating Tip Card */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 min-h-[96px] overflow-hidden">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Brain className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-widest font-bold">Did you know?</span>
              </div>
              {/* Key change triggers CSS re-animation via the transition class */}
              <div
                key={activeTipIndex}
                className="space-y-1 animate-[fadeSlideIn_0.4s_ease_forwards]"
              >
                <p className="text-xl">{LOADING_TIPS[activeTipIndex].icon}</p>
                <p className="text-xs font-bold text-white">{LOADING_TIPS[activeTipIndex].title}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{LOADING_TIPS[activeTipIndex].tip}</p>
              </div>
            </div>

            {/* Tip progress dots */}
            <div className="flex justify-center gap-1.5">
              {LOADING_TIPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === activeTipIndex ? 'bg-amber-400 w-4' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Minimized pill */}
      {isGenerating && isMinimized && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900 border border-amber-500/30 shadow-2xl shadow-amber-950/40 cursor-pointer hover:bg-zinc-800 transition-all"
          onClick={() => setIsMinimized(false)}
        >
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-300">Synthesizing Level {mode === 'batch' ? batchLevel : singleLevel}</p>
            <p className="text-[10px] text-zinc-500">{progressPercent}% · {elapsedSeconds}s</p>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      )}

      {/* Generator Section */}
      {mode === 'batch' ? (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-rose-500" />
              Synthesize Full Level Curriculum
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Generates an interconnected curriculum tier: foundational Radicals → Kanji built from those radicals → Vocabulary using those kanji. Counts follow WaniKani's proven pedagogical ratios.
            </p>
          </div>

          <form onSubmit={handleBatchGenerate} className="space-y-5">
            {/* Level + Theme Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                  Curriculum Level (1–60)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={batchLevel}
                  onChange={(e) => setBatchLevel(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono text-lg font-bold focus:outline-none focus:border-red-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                  Pedagogical Theme (Optional)
                </label>
                <input
                  type="text"
                  value={batchTheme}
                  onChange={(e) => setBatchTheme(e.target.value)}
                  placeholder="e.g. Nature & elements, human body, daily routines..."
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-red-600"
                />
                {/* Quick theme chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_THEMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBatchTheme(t)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        batchTheme === t
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400'
                          : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  {batchTheme && (
                    <button
                      type="button"
                      onClick={() => setBatchTheme('')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subject Count Presets */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-zinc-500" />
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Subject Count
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'express' as const, label: 'Express', desc: 'Quick test pack', r: 4, k: 6, v: 8, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
                  { id: 'standard' as const, label: 'Standard', desc: 'WaniKani ratio', r: 10, k: 14, v: 16, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
                ]).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                      batchPreset === preset.id
                        ? `${preset.bg} border-opacity-100`
                        : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span className={`text-xs font-extrabold ${batchPreset === preset.id ? preset.color : 'text-zinc-700 dark:text-zinc-300'}`}>
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500">{preset.desc}</span>
                    <div className="flex gap-1 mt-1 text-[10px] font-mono font-bold">
                      <span className="text-[#00A1F1]">{preset.r}R</span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-[#F100A1]">{preset.k}K</span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-[#A100F1]">{preset.v}V</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>



            {/* Summary + Submit */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <div className="text-xs text-zinc-500 dark:text-zinc-500 space-y-0.5">
                <p>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {batchRadicals + batchKanji + batchVocab} total subjects
                  </span>
                  {' '}—{' '}
                  <span style={{ color: '#00A1F1' }}>{batchRadicals} Radicals</span>
                  {' · '}
                  <span style={{ color: '#F100A1' }}>{batchKanji} Kanji</span>
                  {' · '}
                  <span style={{ color: '#A100F1' }}>{batchVocab} Vocabulary</span>
                </p>
                <p className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Estimated synthesis time: ~{Math.max(22, Math.round((batchRadicals + batchKanji + batchVocab) * 0.95))}s
                </p>
              </div>
              <button
                type="submit"
                disabled={generateLevelMutation.isPending}
                className="py-3.5 px-8 rounded-xl font-bold text-sm bg-gradient-to-r from-red-700 via-rose-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white shadow-lg shadow-red-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                Synthesize Level {batchLevel}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Generate Single Subject
          </h2>
          <form onSubmit={handleSingleGenerate} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SubjectType)}
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium focus:outline-none focus:border-red-600"
              >
                <option value="Radical">Radical</option>
                <option value="Kanji">Kanji</option>
                <option value="Vocabulary">Vocabulary</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                Character / Word
              </label>
              <input
                type="text"
                required
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
                placeholder="e.g. 川, 山, 食べる"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 font-japanese text-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                Target Level
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={singleLevel}
                onChange={(e) => setSingleLevel(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="sm:col-span-4 mt-2">
              <button
                type="submit"
                disabled={generateMutation.isPending}
                className="py-3.5 px-8 rounded-xl font-bold text-sm bg-gradient-to-r from-teal-700 to-cyan-600 hover:from-teal-600 hover:to-cyan-500 text-white shadow-lg shadow-teal-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Subject</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Approval Pipeline */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Pending Human Review Queue
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Review, edit, reject, or prompt AI to refine before committing to the shared curriculum.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter pills */}
            {(['All', 'Radical', 'Kanji', 'Vocabulary'] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => setFilterType(ft)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  filterType === ft
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {ft}
              </button>
            ))}

            <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-bold ml-2">
              {filteredItems?.length || 0} Queued
            </span>

            {filteredItems && filteredItems.length > 0 && (
              <div className="flex items-center gap-2 ml-auto sm:ml-2">
                <button
                  onClick={() => setIsApproveAllOpen(true)}
                  disabled={approveAllMutation.isPending}
                  className="px-3 py-1 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="Approve all filtered pending items"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{approveAllMutation.isPending ? 'Approving...' : `Approve All (${filteredItems.length})`}</span>
                </button>

                <button
                  onClick={() => {
                    setBulkRejectReason('');
                    setIsBulkRejectModalOpen(true);
                  }}
                  disabled={rejectAllMutation.isPending}
                  className="px-3 py-1 rounded-xl font-semibold text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Reject all filtered pending items"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{rejectAllMutation.isPending ? 'Rejecting...' : `Reject All (${filteredItems.length})`}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {isLoadingPending ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !filteredItems || filteredItems.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            No items pending approval in this view. Use the synthesizer above to generate content!
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              let parsed: any = {};
              try {
                parsed = JSON.parse(item.parsedContentJson || '{}');
              } catch {}

              const isExpanded = expandedItemId === item.id;
              const isRejecting = rejectingId === item.id;
              const isRefining = refiningId === item.id;

              const primaryMeaning =
                typeof parsed.meanings?.[0] === 'string'
                  ? parsed.meanings[0]
                  : parsed.meanings?.[0]?.meaning || 'Meaning pending';

              const primaryReading =
                typeof parsed.readings?.[0] === 'string'
                  ? parsed.readings[0]
                  : parsed.readings?.[0]?.reading ||
                    (parsed.readings?.onyomi?.[0]
                      ? `${parsed.readings.onyomi[0]}${parsed.readings.kunyomi?.[0] ? ' / ' + parsed.readings.kunyomi[0] : ''}`
                      : '');

              const meaningMnemonic = getMeaningMnemonic(parsed);
              const readingMnemonic = getReadingMnemonic(parsed);
              const meaningHint = getMnemonicHint(parsed, 'Meaning');
              const readingHint = getMnemonicHint(parsed, 'Reading');

              const typeBadgeColor =
                item.subjectType === 'Radical'
                  ? 'bg-teal-600/10 border-teal-500/30 text-teal-600 dark:text-teal-400'
                  : item.subjectType === 'Kanji'
                  ? 'bg-red-600/10 border-red-500/30 text-red-600 dark:text-rose-400'
                  : 'bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-400';

              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-zinc-50 dark:bg-[#0c0d12] border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all shadow-sm"
                >
                  {/* Card Header Row */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Character Avatar */}
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center font-japanese text-2xl font-black shrink-0 border ${
                          item.subjectType === 'Radical'
                            ? 'bg-teal-600/10 border-teal-500/30 text-teal-600 dark:text-teal-300'
                            : item.subjectType === 'Kanji'
                            ? 'bg-red-600/10 border-red-500/30 text-red-600 dark:text-rose-300'
                            : 'bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-300'
                        }`}
                      >
                        {item.targetCharacter}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] uppercase font-bold px-2 py-0.5 rounded-md border ${typeBadgeColor}`}>
                            {item.subjectType}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                            Level {parsed.level || 1}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                            {item.model}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2 mt-1">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                            {primaryMeaning}
                          </h3>
                          {primaryReading && (
                            <span className="text-sm font-japanese text-red-600 dark:text-rose-400 font-semibold">
                              {primaryReading}
                            </span>
                          )}
                        </div>

                        {item.validationErrors && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{item.validationErrors}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* Toggle Details */}
                      <button
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide' : 'Details'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {/* Edit in Place */}
                      <button
                        onClick={() => openEditModal(item, parsed)}
                        className="p-2 rounded-xl text-xs font-semibold bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                        title="Edit Subject Data"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Refine with AI */}
                      <button
                        onClick={() => {
                          setRefiningId(isRefining ? null : item.id);
                          setRejectingId(null);
                        }}
                        className="p-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all"
                        title="Prompt AI to Refine"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>

                      {/* Reject */}
                      <button
                        onClick={() => {
                          setRejectingId(isRejecting ? null : item.id);
                          setRefiningId(null);
                        }}
                        className="p-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all"
                        title="Reject Subject"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Approve */}
                      <button
                        onClick={() => approveMutation.mutate(item.id)}
                        disabled={approveMutation.isPending}
                        className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>

                  {/* Refine with AI Inline Box */}
                  {isRefining && (
                    <div className="p-4 border-t border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-center gap-2">
                      <div className="w-full relative">
                        <input
                          type="text"
                          value={refinePrompt}
                          onChange={(e) => setRefinePrompt(e.target.value)}
                          placeholder="e.g. 'Make the mnemonic funnier' or 'Fix kunyomi reading'..."
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-amber-500/30 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            if (!refinePrompt.trim()) return;
                            refineMutation.mutate({ id: item.id, instruction: refinePrompt.trim() });
                          }}
                          disabled={refineMutation.isPending || !refinePrompt.trim()}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>{refineMutation.isPending ? 'Refining...' : 'Apply Prompt'}</span>
                        </button>
                        <button
                          onClick={() => setRefiningId(null)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reject Reason Inline Box */}
                  {isRejecting && (
                    <div className="p-4 border-t border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row items-center gap-2">
                      <div className="w-full">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Optional rejection reason (e.g. 'Duplicate character' or 'Incorrect reading')..."
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-rose-500/30 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            rejectMutation.mutate({ id: item.id, reason: rejectReason.trim() })
                          }
                          disabled={rejectMutation.isPending}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Confirm Reject</span>
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Details Panel */}
                  {isExpanded && (
                    <div className="p-5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-[#07080b] space-y-4 text-xs">
                      {/* Component Characters / Prerequisites */}
                      {parsed.componentCharacters && parsed.componentCharacters.length > 0 && (
                        <div>
                          <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                            Prerequisite Components
                          </span>
                          <div className="flex gap-2 mt-1">
                            {parsed.componentCharacters.map((c: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-japanese text-sm font-bold text-zinc-900 dark:text-white"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Concept / Structural Hint */}
                      {meaningHint && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                          <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-700 dark:text-amber-400 mb-0.5">
                            Concept Hint
                          </span>
                          <p className="leading-relaxed">{meaningHint}</p>
                        </div>
                      )}

                      {/* Mnemonics */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                          <span className="font-bold text-teal-600 dark:text-cyan-400 block mb-1">
                            Meaning Mnemonic
                          </span>
                          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                            {meaningMnemonic || 'No mnemonic provided'}
                          </p>
                        </div>

                        {readingMnemonic && (
                          <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                            <span className="font-bold text-red-600 dark:text-rose-400 block mb-1">
                              Reading Mnemonic
                            </span>
                            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {readingMnemonic}
                            </p>
                            {readingHint && (
                              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                                Hint: {readingHint}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Example Sentences for Vocabulary */}
                      {Array.isArray(parsed.exampleSentences) && parsed.exampleSentences.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                          <span className="font-bold text-purple-600 dark:text-purple-400 block uppercase tracking-wider text-[11px]">
                            Example Sentences
                          </span>
                          <div className="space-y-2">
                            {parsed.exampleSentences.map((sent: any, sIdx: number) => (
                              <div key={sIdx} className="border-l-2 border-purple-500/40 pl-3 py-1 space-y-0.5">
                                <p className="font-japanese text-sm font-semibold text-zinc-900 dark:text-white">
                                  {sent.japanese || sent.furigana}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                                  {sent.english}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit In Place Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl p-6 rounded-3xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="font-japanese text-2xl font-black text-red-600 dark:text-rose-400">
                  {editingItem.character}
                </span>
                <h3 className="font-bold text-zinc-900 dark:text-white">
                  Edit Subject Data ({editingItem.type})
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEditModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                  Primary Meaning
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.meaning}
                  onChange={(e) => setEditingItem({ ...editingItem, meaning: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm"
                />
              </div>

              {editingItem.type !== 'Radical' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                    Primary Reading (Kana)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.reading}
                    onChange={(e) => setEditingItem({ ...editingItem, reading: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-japanese text-zinc-900 dark:text-white text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                  Meaning Mnemonic
                </label>
                <textarea
                  rows={3}
                  value={editingItem.meaningMnemonic}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, meaningMnemonic: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-xs leading-relaxed"
                />
              </div>

              {editingItem.type !== 'Radical' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400 mb-1">
                    Reading Mnemonic
                  </label>
                  <textarea
                    rows={3}
                    value={editingItem.readingMnemonic}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, readingMnemonic: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-xs leading-relaxed"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-md shadow-red-950/40"
                >
                  {editMutation.isPending ? 'Saving Changes...' : 'Save & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Level Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="minimal-card max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setIsResetModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Reset Level Curriculum
                </h3>
                <p className="text-xs text-zinc-500">Destructive administrative action</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              This will completely wipe <strong>all Radicals, Kanji, and Vocabulary</strong> on the selected level, including associated parent/child dependencies, mnemonics, example sentences, and learner SRS review logs.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Select Level to Wipe (1–60):
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={levelToReset}
                onChange={(e) => setLevelToReset(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resetLevelMutation.mutate(levelToReset)}
                disabled={resetLevelMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {resetLevelMutation.isPending
                    ? `Wiping Level ${levelToReset}...`
                    : `Confirm Reset Level ${levelToReset}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={isApproveAllOpen}
        onClose={() => setIsApproveAllOpen(false)}
        onConfirm={() => approveAllMutation.mutate(filterType === 'All' ? undefined : filterType)}
        title={`Approve ${filterType === 'All' ? 'All Pending Items' : `${filterType}s`}?`}
        variant="primary"
        confirmText={
          approveAllMutation.isPending
            ? 'Approving...'
            : `Approve (${filteredItems?.length || 0}) Items`
        }
        isLoading={approveAllMutation.isPending}
        message={
          <p>
            Publish <strong>{filteredItems?.length || 0}</strong> {filterType === 'All' ? 'pending items' : `${filterType.toLowerCase()}s`} directly into the central curriculum deck? They will immediately be saved and ready for learners.
          </p>
        }
      />

      {/* Bulk Reject Modal in Kotoba Web Design */}
      {isBulkRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setIsBulkRejectModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Reject {filterType === 'All' ? 'All Pending Items' : `${filterType}s`}
                </h3>
                <p className="text-xs text-zinc-500">Discard queued AI drafts</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              This will discard all <strong>{filteredItems?.length || 0}</strong> queued {filterType === 'All' ? 'items' : `${filterType.toLowerCase()}s`} from the staging queue.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Optional Reason for Rejection:
              </label>
              <input
                type="text"
                placeholder="e.g. Inappropriate kanji stroke complexity, duplicate..."
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsBulkRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectAllMutation.mutate({
                    subType: filterType === 'All' ? undefined : filterType,
                    reason: bulkRejectReason.trim() || undefined,
                  });
                }}
                disabled={rejectAllMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>
                  {rejectAllMutation.isPending
                    ? 'Rejecting...'
                    : `Confirm Reject (${filteredItems?.length || 0})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
