import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Filter, Compass, X, Plus, Edit3, Trash2, Sparkles, Wand2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { SubjectBadge } from '../components/SubjectBadge';
import type { SubjectType, CreateSubjectInput, UpdateSubjectInput } from '../types';

export const SubjectsList: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedType, setSelectedType] = useState<SubjectType | 'All'>('All');
  const [selectedLevel, setSelectedLevel] = useState<number | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);

  // Admin Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Styled Confirmation Modals
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<{ id: number; character: string; type: string } | null>(null);

  // Subject Form State (used for Add and Edit)
  const [formData, setFormData] = useState<{
    id?: number;
    character: string;
    type: SubjectType;
    level: number;
    meaning: string;
    meaningAlternatives: string;
    reading: string;
    readingAlternatives: string;
    readingType: 'Onyomi' | 'Kunyomi' | 'VocabularyReading';
    meaningHint: string;
    meaningMnemonic: string;
    readingMnemonic: string;
    sentenceJp: string;
    sentenceEn: string;
  }>({
    character: '',
    type: 'Kanji',
    level: 1,
    meaning: '',
    meaningAlternatives: '',
    reading: '',
    readingAlternatives: '',
    readingType: 'Onyomi',
    meaningHint: '',
    meaningMnemonic: '',
    readingMnemonic: '',
    sentenceJp: '',
    sentenceEn: '',
  });

  // Filtered query — drives the visible subjects grid
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjectsList', selectedType, selectedLevel],
    queryFn: () =>
      api.subjects.list({
        type: selectedType === 'All' ? undefined : selectedType,
        level: selectedLevel === 'All' ? undefined : selectedLevel,
      }),
    placeholderData: keepPreviousData, // keep old results visible while new fetch is in-flight
  });

  // Unfiltered snapshot — used ONLY to build the level chip list so chips never disappear
  const { data: allSubjectsForLevels } = useQuery({
    queryKey: ['subjectsList', 'allLevels'],
    queryFn: () => api.subjects.list({}),
    staleTime: 60_000, // re-fetch once per minute at most
  });

  const {
    data: activeSubjectDetail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    error: detailError,
  } = useQuery({
    queryKey: ['subjectDetail', activeSubjectId],
    queryFn: () => api.subjects.getDetail(activeSubjectId!),
    enabled: !!activeSubjectId,
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateSubjectInput) => api.subjects.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
      setIsAddModalOpen(false);
      setActiveSubjectId(res.id);
      showToast(`Subject '${res.character}' created successfully.`, 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to create subject.', 'error');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSubjectInput }) =>
      api.subjects.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['subjectDetail', res.id] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
      setIsEditModalOpen(false);
      showToast(`Subject '${res.character}' updated successfully.`, 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update subject.', 'error');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.subjects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
      setActiveSubjectId(null);
      setSubjectToDelete(null);
      showToast('Subject deleted from central deck.', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete subject.', 'error');
    },
  });

  // Reset Level Mutation
  const resetLevelMutation = useMutation({
    mutationFn: (lvl: number) => api.subjects.deleteLevel(lvl),
    onSuccess: (res) => {
      setIsResetConfirmOpen(false);
      showToast(res.message || `Level ${res.level} curriculum was reset.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['subjectsList'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeckStats'] });
      setSelectedLevel('All');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to reset level curriculum.', 'error');
    },
  });

  // Quick AI Generate for pre-filling form
  const handleAiQuickFill = async () => {
    if (!formData.character.trim()) {
      showToast('Please enter a Japanese Character or Word first.', 'warning');
      return;
    }
    setIsAiGenerating(true);
    try {
      const generated = await api.subjects.quickGenerate({
        character: formData.character.trim(),
        type: formData.type,
        level: formData.level,
      });

      const meanings = generated.meanings || [];
      const primaryM = meanings.find((m: any) => m.isPrimary) || meanings[0];
      const readings = generated.readings || [];
      const primaryR = readings.find((r: any) => r.isPrimary) || readings[0];
      const mnemonics = generated.mnemonics || [];
      const meaningM = mnemonics.find((m: any) => m.type === 'Meaning');
      const readingM = mnemonics.find((m: any) => m.type === 'Reading');
      const sentences = generated.exampleSentences || [];
      const firstSentence = sentences[0];

      setFormData((prev) => ({
        ...prev,
        meaning: primaryM?.meaning || primaryM?.meaningText || prev.meaning,
        meaningAlternatives: primaryM?.alternatives || primaryM?.acceptedAlternatives || prev.meaningAlternatives,
        reading: primaryR?.reading || primaryR?.readingText || prev.reading,
        readingAlternatives: primaryR?.alternatives || prev.readingAlternatives,
        readingType: primaryR?.type === 'Kunyomi' ? 'Kunyomi' : primaryR?.type === 'VocabularyReading' ? 'VocabularyReading' : 'Onyomi',
        meaningHint: generated.meaningHint || prev.meaningHint,
        meaningMnemonic: meaningM?.text || prev.meaningMnemonic,
        readingMnemonic: readingM?.text || prev.readingMnemonic,
        sentenceJp: firstSentence?.japanese || prev.sentenceJp,
        sentenceEn: firstSentence?.english || prev.sentenceEn,
      }));
      showToast('AI draft generated for inspection.', 'info');
    } catch (err: any) {
      showToast(err.message || 'AI generation failed. Please enter fields manually.', 'error');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      character: '',
      type: 'Kanji',
      level: 1,
      meaning: '',
      meaningAlternatives: '',
      reading: '',
      readingAlternatives: '',
      readingType: 'Onyomi',
      meaningHint: '',
      meaningMnemonic: '',
      readingMnemonic: '',
      sentenceJp: '',
      sentenceEn: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (!activeSubjectDetail) return;
    const primaryMeaning = activeSubjectDetail.meanings?.find((m) => m.isPrimary) || activeSubjectDetail.meanings?.[0];
    const primaryReading = activeSubjectDetail.readings?.find((r) => r.isPrimary) || activeSubjectDetail.readings?.[0];
    const meaningMnemonic = activeSubjectDetail.mnemonics?.find((m) => m.type === 'Meaning');
    const readingMnemonic = activeSubjectDetail.mnemonics?.find((m) => m.type === 'Reading');
    const firstSentence = activeSubjectDetail.exampleSentences?.[0];

    setFormData({
      id: activeSubjectDetail.id,
      character: activeSubjectDetail.character,
      type: activeSubjectDetail.type,
      level: activeSubjectDetail.level,
      meaning: primaryMeaning?.meaningText || '',
      meaningAlternatives: primaryMeaning?.acceptedAlternatives || '',
      reading: primaryReading?.readingText || '',
      readingAlternatives: primaryReading?.acceptedAlternatives || '',
      readingType:
        primaryReading?.type === 'Kunyomi'
          ? 'Kunyomi'
          : primaryReading?.type === 'VocabularyReading'
          ? 'VocabularyReading'
          : 'Onyomi',
      meaningHint: activeSubjectDetail.meaningHint || '',
      meaningMnemonic: meaningMnemonic?.text || '',
      readingMnemonic: readingMnemonic?.text || '',
      sentenceJp: firstSentence?.japanese || '',
      sentenceEn: firstSentence?.english || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.character.trim() || !formData.meaning.trim()) {
      showToast('Character and Primary Meaning are required.', 'warning');
      return;
    }

    const payload: CreateSubjectInput = {
      character: formData.character.trim(),
      type: formData.type,
      level: formData.level,
      meaningHint: formData.meaningHint.trim() || undefined,
      meanings: [
        {
          meaningText: formData.meaning.trim(),
          isPrimary: true,
          acceptedAlternatives: formData.meaningAlternatives.trim() || undefined,
        },
      ],
      readings:
        formData.type !== 'Radical' && formData.reading.trim()
          ? [
              {
                readingText: formData.reading.trim(),
                type: formData.readingType,
                isPrimary: true,
                acceptedAlternatives: formData.readingAlternatives.trim() || undefined,
              },
            ]
          : [],
      mnemonics: [
        ...(formData.meaningMnemonic.trim()
          ? [{ type: 'Meaning' as const, text: formData.meaningMnemonic.trim() }]
          : []),
        ...(formData.type !== 'Radical' && formData.readingMnemonic.trim()
          ? [{ type: 'Reading' as const, text: formData.readingMnemonic.trim() }]
          : []),
      ],
      exampleSentences:
        formData.type === 'Vocabulary' && formData.sentenceJp.trim()
          ? [{ japanese: formData.sentenceJp.trim(), english: formData.sentenceEn.trim() || '' }]
          : [],
    };

    createMutation.mutate(payload);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.character.trim() || !formData.meaning.trim()) {
      showToast('Character and Primary Meaning are required.', 'warning');
      return;
    }

    const payload: UpdateSubjectInput = {
      character: formData.character.trim(),
      type: formData.type,
      level: formData.level,
      meaningHint: formData.meaningHint.trim() || undefined,
      meanings: [
        {
          meaningText: formData.meaning.trim(),
          isPrimary: true,
          acceptedAlternatives: formData.meaningAlternatives.trim() || undefined,
        },
      ],
      readings:
        formData.type !== 'Radical' && formData.reading.trim()
          ? [
              {
                readingText: formData.reading.trim(),
                type: formData.readingType,
                isPrimary: true,
                acceptedAlternatives: formData.readingAlternatives.trim() || undefined,
              },
            ]
          : [],
      mnemonics: [
        ...(formData.meaningMnemonic.trim()
          ? [{ type: 'Meaning' as const, text: formData.meaningMnemonic.trim() }]
          : []),
        ...(formData.type !== 'Radical' && formData.readingMnemonic.trim()
          ? [{ type: 'Reading' as const, text: formData.readingMnemonic.trim() }]
          : []),
      ],
      exampleSentences:
        formData.type === 'Vocabulary' && formData.sentenceJp.trim()
          ? [{ japanese: formData.sentenceJp.trim(), english: formData.sentenceEn.trim() || '' }]
          : [],
    };

    updateMutation.mutate({ id: formData.id, data: payload });
  };

  const filteredSubjects = (subjects || []).filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.character.includes(q) ||
      s.primaryMeaning.toLowerCase().includes(q) ||
      (s.primaryReading && s.primaryReading.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24 md:pb-12 min-h-[85vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[var(--text-primary)]">
              {user?.isAdmin ? 'Central Deck Management' : 'Curriculum Library'}
            </h1>
            {user?.isAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-sage-light)] text-[var(--color-sage)] font-bold uppercase tracking-wider border border-[var(--color-sage)]/30">
                Admin Deck Curator
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {user?.isAdmin
              ? 'Configure, add, edit, and delete subjects in the centralized deck. AI-assisted synthesis keeps curriculum balanced.'
              : 'Explore Radicals, Kanji, and Vocabulary across your learning trajectory.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {user?.isAdmin && selectedLevel !== 'All' && (
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              disabled={resetLevelMutation.isPending}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
              title={`Reset Level ${selectedLevel}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {resetLevelMutation.isPending
                  ? `Resetting Lv.${selectedLevel}...`
                  : `Reset Lv.${selectedLevel}`}
              </span>
            </button>
          )}

          {user?.isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="btn-primary text-xs shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject to Deck</span>
            </button>
          )}

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search character or meaning..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-sage)]"
            />
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="minimal-card p-3 flex flex-wrap gap-2 items-center text-xs">
        <span className="font-semibold text-[var(--text-muted)] mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Type:
        </span>
        {(['All', 'Radical', 'Kanji', 'Vocabulary'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              selectedType === type
                ? type === 'Radical'
                  ? 'bg-[#00a1f1] text-white font-bold shadow-xs'
                  : type === 'Kanji'
                  ? 'bg-[#f100a1] text-white font-bold shadow-xs'
                  : type === 'Vocabulary'
                  ? 'bg-[#a100f1] text-white font-bold shadow-xs'
                  : 'bg-[var(--color-sage)] text-white font-bold shadow-xs'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {type}
          </button>
        ))}

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <span className="font-semibold text-[var(--text-muted)] mr-1">Level:</span>

        {/* Dynamic level chips — derived from the UNFILTERED snapshot so they never disappear */}
        {(() => {
          // Build a sorted set of levels that actually have subjects
          const existingLevels = new Set<number>(
            (allSubjectsForLevels ?? []).map((s: any) => s.level).filter(Boolean)
          );
          const levelOptions: (number | 'All')[] = [
            'All',
            ...[...existingLevels].sort((a, b) => a - b),
          ];
          return levelOptions.map((lvl) => (
            <button
              key={lvl.toString()}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedLevel === lvl
                  ? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-bold'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {lvl === 'All' ? 'All Levels' : `Lv.${lvl}`}
            </button>
          ));
        })()}

        <span className="text-[11px] font-mono text-[var(--text-muted)] ml-auto">
          {filteredSubjects.length} items
        </span>
      </div>

      {/* Subjects Grid */}
      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="minimal-card p-12 text-center rounded-2xl">
          <Compass className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">No subjects found</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {user?.isAdmin
              ? 'Use the "+ Add Subject to Deck" button above or the AI Deck Studio to add curriculum content.'
              : 'Try changing your search query or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {filteredSubjects.map((item) => (
            <SubjectBadge
              key={item.id}
              character={item.character}
              type={item.type}
              primaryMeaning={item.primaryMeaning}
              primaryReading={item.primaryReading}
              stage={item.stage}
              size="md"
              onClick={() => setActiveSubjectId(item.id)}
            />
          ))}
        </div>
      )}

      {/* Subject Detail & Admin Action Modal */}
      {activeSubjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="minimal-card max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6 relative shadow-xl">
            <button
              onClick={() => setActiveSubjectId(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoadingDetail ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-3 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isDetailError || !activeSubjectDetail ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm font-semibold text-rose-500">Failed to load subject details</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {(detailError as Error)?.message || 'Subject details could not be found or retrieved.'}
                </p>
                <button
                  onClick={() => setActiveSubjectId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)]"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Header Character Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-20 h-20 rounded-2xl flex items-center justify-center font-japanese text-4xl text-white font-medium shadow-sm ${
                        activeSubjectDetail.type === 'Radical'
                          ? 'bg-[#00a1f1]'
                          : activeSubjectDetail.type === 'Kanji'
                          ? 'bg-[#f100a1]'
                          : 'bg-[#a100f1]'
                      }`}
                    >
                      {activeSubjectDetail.character}
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-[var(--color-sage)]">
                        {activeSubjectDetail.type} · Level {activeSubjectDetail.level}
                      </span>
                      <h2 className="text-2xl font-black text-[var(--text-primary)] mt-0.5">
                        {activeSubjectDetail.meanings?.find((m) => m.isPrimary)?.meaningText || activeSubjectDetail.meanings?.[0]?.meaningText || activeSubjectDetail.character}
                      </h2>
                      {(activeSubjectDetail.readings ?? []).length > 0 && (
                        <div className="font-japanese text-sm text-[var(--text-secondary)] mt-0.5">
                          {activeSubjectDetail.readings.map((r) => r.readingText).join('、')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin Direct Actions on Subject */}
                  {user?.isAdmin && (
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={handleOpenEditModal}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] flex items-center gap-1.5 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          setSubjectToDelete({
                            id: activeSubjectDetail.id,
                            character: activeSubjectDetail.character,
                            type: activeSubjectDetail.type,
                          });
                        }}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Component Characters (if any) */}
                {activeSubjectDetail.componentCharacters && activeSubjectDetail.componentCharacters.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                      {activeSubjectDetail.type === 'Vocabulary' ? 'Kanji Components' : 'Radical Components'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeSubjectDetail.componentCharacters.map((c, idx) => (
                        <span
                          key={idx}
                          className="font-japanese text-sm px-2.5 py-1 rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium shadow-xs"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meanings & Readings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Meanings</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(activeSubjectDetail.meanings ?? []).map((m) => (
                        <span
                          key={m.id}
                          className={`text-xs px-2.5 py-1 rounded-md ${
                            m.isPrimary
                              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-bold shadow-xs'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {m.meaningText}
                        </span>
                      ))}
                    </div>
                  </div>

                  {(activeSubjectDetail.readings ?? []).length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Readings</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {activeSubjectDetail.readings.map((r) => (
                          <span
                            key={r.id}
                            className={`text-xs px-2.5 py-1 rounded-md font-japanese ${
                              r.isPrimary
                                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-bold shadow-xs'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            {r.readingText} ({r.type})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Meaning Hint */}
                {activeSubjectDetail.meaningHint && (
                  <div className="p-3.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--text-primary)] block mb-0.5">Concept Hint:</span>
                    {activeSubjectDetail.meaningHint}
                  </div>
                )}

                {/* Mnemonics */}
                {(activeSubjectDetail.mnemonics ?? []).map((mn) => (
                  <div key={mn.id} className="p-4 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-[11px] uppercase font-bold text-[var(--color-sage)]">
                      {mn.type} Mnemonic
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{mn.text}</p>
                  </div>
                ))}

                {/* Example Sentences */}
                {(activeSubjectDetail.exampleSentences ?? []).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Example Sentences</span>
                    {activeSubjectDetail.exampleSentences.map((ex) => (
                      <div key={ex.id} className="p-3.5 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)]">
                        <div className="font-japanese text-sm font-medium text-[var(--text-primary)]">{ex.japanese}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">{ex.english}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Admin Add / Edit Subject Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="minimal-card max-w-xl w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {isAddModalOpen ? 'Add New Subject to Central Deck' : `Edit Subject '${formData.character}'`}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Centralized deck changes reflect globally for all learners on or above this level.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit} className="space-y-4 text-xs">
              {/* Type, Level, Character */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Subject Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as SubjectType })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                  >
                    <option value="Radical">Radical</option>
                    <option value="Kanji">Kanji</option>
                    <option value="Vocabulary">Vocabulary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Level (1-60)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Character / Word
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.character}
                    onChange={(e) => setFormData({ ...formData, character: e.target.value })}
                    placeholder="e.g. 木, 林, 食べる"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-japanese text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                  />
                </div>
              </div>

              {/* AI Auto-fill trigger button */}
              <div className="p-3 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#f100a1]" />
                    AI Auto-populate
                  </span>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    Synthesize Japanese meaning, readings, and mnemonics with Gemini in 1 click.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAiQuickFill}
                  disabled={isAiGenerating || !formData.character.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#8b9a6e] hover:bg-[#78865f] text-white flex items-center gap-1.5 disabled:opacity-50 transition-all shrink-0"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{isAiGenerating ? 'Generating...' : 'Auto-fill'}</span>
                </button>
              </div>

              {/* Meanings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Primary Meaning
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.meaning}
                    onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                    placeholder="e.g. Tree"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Alternatives (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.meaningAlternatives}
                    onChange={(e) => setFormData({ ...formData, meaningAlternatives: e.target.value })}
                    placeholder="e.g. Wood, Timber"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                  />
                </div>
              </div>

              {/* Readings (if Kanji or Vocab) */}
              {formData.type !== 'Radical' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Reading (Kana)
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.reading}
                      onChange={(e) => setFormData({ ...formData, reading: e.target.value })}
                      placeholder="e.g. もく / き"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-japanese text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Reading Type
                    </label>
                    <select
                      value={formData.readingType}
                      onChange={(e) => setFormData({ ...formData, readingType: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                    >
                      <option value="Onyomi">Onyomi</option>
                      <option value="Kunyomi">Kunyomi</option>
                      <option value="VocabularyReading">Vocabulary Reading</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Alternative Kana
                    </label>
                    <input
                      type="text"
                      value={formData.readingAlternatives}
                      onChange={(e) => setFormData({ ...formData, readingAlternatives: e.target.value })}
                      placeholder="e.g. ぼく"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-japanese text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                    />
                  </div>
                </div>
              )}

              {/* Meaning Hint */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Concept Hint (Optional)
                </label>
                <input
                  type="text"
                  value={formData.meaningHint}
                  onChange={(e) => setFormData({ ...formData, meaningHint: e.target.value })}
                  placeholder="e.g. A visual tree with branches and trunk"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                />
              </div>

              {/* Mnemonics */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Meaning Mnemonic
                </label>
                <textarea
                  rows={2}
                  value={formData.meaningMnemonic}
                  onChange={(e) => setFormData({ ...formData, meaningMnemonic: e.target.value })}
                  placeholder="Memorable story linking visual character to meaning..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)] leading-relaxed"
                />
              </div>

              {formData.type !== 'Radical' && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Reading Mnemonic
                  </label>
                  <textarea
                    rows={2}
                    value={formData.readingMnemonic}
                    onChange={(e) => setFormData({ ...formData, readingMnemonic: e.target.value })}
                    placeholder="Phonetic recall story for pronunciation..."
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)] leading-relaxed"
                  />
                </div>
              )}

              {/* Vocabulary Sentences */}
              {formData.type === 'Vocabulary' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Example Sentence (Japanese)
                    </label>
                    <input
                      type="text"
                      value={formData.sentenceJp}
                      onChange={(e) => setFormData({ ...formData, sentenceJp: e.target.value })}
                      placeholder="e.g. 木の下で休みます。"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-japanese text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Translation (English)
                    </label>
                    <input
                      type="text"
                      value={formData.sentenceEn}
                      onChange={(e) => setFormData({ ...formData, sentenceEn: e.target.value })}
                      placeholder="e.g. I rest under the tree."
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-sage)]"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {isAddModalOpen
                    ? createMutation.isPending
                      ? 'Creating Subject...'
                      : 'Create Subject'
                    : updateMutation.isPending
                    ? 'Saving Changes...'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reset Level Confirmation Dialog in Kotoba Design */}
      <ConfirmModal
        isOpen={isResetConfirmOpen && selectedLevel !== 'All'}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          if (selectedLevel !== 'All') {
            resetLevelMutation.mutate(selectedLevel as number);
          }
        }}
        title={`Reset Level ${selectedLevel} Curriculum?`}
        variant="danger"
        confirmText={
          resetLevelMutation.isPending
            ? `Resetting Lv.${selectedLevel}...`
            : `Confirm Reset Level ${selectedLevel}`
        }
        isLoading={resetLevelMutation.isPending}
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to completely wipe all curriculum items on{' '}
              <strong className="text-[var(--text-primary)] font-bold">Level {selectedLevel}</strong>?
            </p>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs leading-relaxed space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <span>⚠️ Destructive Action</span>
              </div>
              <p>
                This will delete all Radicals, Kanji, and Vocabulary on Level {selectedLevel}, along with their component dependency linkages, mnemonics, example sentences, and learner SRS review logs.
              </p>
            </div>
            <p className="text-[var(--text-muted)] text-[11px]">
              This action cannot be undone. To restore curriculum, you will need to regenerate or recreate subjects.
            </p>
          </div>
        }
      />

      {/* Delete Subject Confirmation Dialog in Kotoba Design */}
      <ConfirmModal
        isOpen={!!subjectToDelete}
        onClose={() => setSubjectToDelete(null)}
        onConfirm={() => {
          if (subjectToDelete) {
            deleteMutation.mutate(subjectToDelete.id);
          }
        }}
        title={`Delete '${subjectToDelete?.character}'?`}
        variant="danger"
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete Subject'}
        isLoading={deleteMutation.isPending}
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to delete <strong className="text-[var(--text-primary)] font-bold">{subjectToDelete?.character}</strong> ({subjectToDelete?.type}) from the central curriculum deck?
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Any kanji or vocabulary items that depend on this subject will lose this component relationship.
            </p>
          </div>
        }
      />
    </div>
  );
};
