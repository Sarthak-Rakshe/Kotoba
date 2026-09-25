export type SubjectType = 'Radical' | 'Kanji' | 'Vocabulary';

export type SrsStage =
  | 'Locked'
  | 'Initiate'
  | 'Apprentice1'
  | 'Apprentice2'
  | 'Apprentice3'
  | 'Apprentice4'
  | 'Guru1'
  | 'Guru2'
  | 'Master'
  | 'Enlightened'
  | 'Burned';

export type ReviewType = 'Meaning' | 'Reading';

export interface MeaningDto {
  id: number;
  meaningText: string;
  isPrimary: boolean;
  acceptedAlternatives?: string;
}

export interface ReadingDto {
  id: number;
  readingText: string;
  type: 'Onyomi' | 'Kunyomi' | 'Nanori' | 'VocabularyReading';
  isPrimary: boolean;
  acceptedAlternatives?: string;
}

export interface MnemonicDto {
  id: number;
  type: ReviewType;
  text: string;
  hint?: string;
}

export interface ExampleSentenceDto {
  id: number;
  japanese: string;
  english: string;
  furigana?: string;
}

export interface SubjectSummaryDto {
  id: number;
  character: string;
  type: SubjectType;
  level: number;
  primaryMeaning: string;
  primaryReading?: string;
  stage: SrsStage;
  isUnlocked: boolean;
  lessonPosition?: number;
}

export interface SubjectDetailDto {
  id: number;
  character: string;
  type: SubjectType;
  level: number;
  meaningHint?: string;
  readingHint?: string;
  meanings: MeaningDto[];
  readings: ReadingDto[];
  mnemonics: MnemonicDto[];
  exampleSentences: ExampleSentenceDto[];
  componentCharacters: string[];
  lessonPosition?: number;
}

export interface LessonItemDto {
  subjectId: number;
  character: string;
  type: SubjectType;
  level: number;
  meaningHint?: string;
  readingHint?: string;
  meanings: MeaningDto[];
  readings: ReadingDto[];
  mnemonics: MnemonicDto[];
  exampleSentences: ExampleSentenceDto[];
  components: string[];
}

export interface ReviewQueueItemDto {
  srsItemId: number;
  subjectId: number;
  character: string;
  type: SubjectType;
  level: number;
  reviewType: ReviewType;
  acceptedMeanings: string[];
  acceptedReadings: string[];
}

export interface SubmitReviewRequest {
  srsItemId: number;
  reviewType: ReviewType;
  submittedAnswer: string;
  responseTimeMs: number;
}

export interface SubmitReviewResponse {
  isCorrect: boolean;
  hasTypoWarning: boolean;
  submittedAnswer: string;
  previousStage: SrsStage;
  newStage: SrsStage;
  nextReviewAt?: string;
  unlockedSubjects: string[];
  leveledUp: boolean;
  newLevel?: number;
}

export interface SrsDistributionDto {
  locked: number;
  initiate: number;
  apprentice: number;
  guru: number;
  master: number;
  enlightened: number;
  burned: number;
}

export interface DashboardStatsDto {
  currentLevel: number;
  levelProgressPercentage: number;
  lessonsAvailable: number;
  reviewsAvailable: number;
  totalLearned: number;
  radicalsLearned: number;
  kanjiLearned: number;
  vocabularyLearned: number;
  todayReviewsCount: number;
  accuracyRate: number;
  srsDistribution: SrsDistributionDto;
  recentSubjects: SubjectSummaryDto[];
}

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  email: string;
  currentLevel: number;
  isAdmin: boolean;
}

export interface HourlyForecastItem {
  timeLabel: string;
  timestamp: string;
  count: number;
  cumulativeCount: number;
}

export interface DailyForecastItem {
  dayLabel: string;
  date: string;
  count: number;
}

export interface ReviewForecast {
  dueNow: number;
  next24Hours: HourlyForecastItem[];
  next7Days: DailyForecastItem[];
}

export interface AiPendingItem {
  id: number;
  subjectType: SubjectType;
  targetCharacter: string;
  parsedContentJson: string;
  provider: string;
  model: string;
  status: string;
  validationErrors?: string;
  createdAt: string;
}

export interface MeaningInput {
  meaningText: string;
  isPrimary?: boolean;
  acceptedAlternatives?: string;
}

export interface ReadingInput {
  readingText: string;
  type?: 'Onyomi' | 'Kunyomi' | 'Nanori' | 'VocabularyReading';
  isPrimary?: boolean;
  acceptedAlternatives?: string;
}

export interface MnemonicInput {
  type: ReviewType;
  text: string;
  hint?: string;
}

export interface ExampleSentenceInput {
  japanese: string;
  english: string;
  furigana?: string;
}

export interface CreateSubjectInput {
  character: string;
  type: SubjectType;
  level: number;
  meaningHint?: string;
  readingHint?: string;
  meanings: MeaningInput[];
  readings?: ReadingInput[];
  mnemonics?: MnemonicInput[];
  exampleSentences?: ExampleSentenceInput[];
  componentCharacters?: string[];
}

export interface UpdateSubjectInput {
  character: string;
  type: SubjectType;
  level: number;
  meaningHint?: string;
  readingHint?: string;
  meanings: MeaningInput[];
  readings?: ReadingInput[];
  mnemonics?: MnemonicInput[];
  exampleSentences?: ExampleSentenceInput[];
  componentCharacters?: string[];
}

export interface AdminLevelDistribution {
  level: number;
  radicalsCount: number;
  kanjiCount: number;
  vocabCount: number;
  totalCount: number;
}

export interface AdminDeckStats {
  totalSubjects: number;
  totalRadicals: number;
  totalKanji: number;
  totalVocabulary: number;
  totalLevels: number;
  pendingAiCount: number;
  totalLearners: number;
  levelDistribution: AdminLevelDistribution[];
  recentSubjects: SubjectSummaryDto[];
}

export interface BulkActionResponse {
  success: boolean;
  count: number;
  message: string;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: string;
  method: string;
  endpoint: string;
  statusCode?: number;
  durationMs: number;
  message: string;
  user?: string;
  clientIp?: string;
  details?: string;
}

export interface ResetLevelResult {
  success: boolean;
  level: number;
  deletedSubjectsCount: number;
  deletedDependenciesCount: number;
  deletedSrsItemsCount: number;
  message: string;
}

export interface LevelGenerationResultDto {
  level: number;
  success: boolean;
  message: string;
  subjectCount: number;
  radicalCount: number;
  kanjiCount: number;
  vocabCount: number;
  subjects: SubjectSummaryDto[];
  validationNotes: string[];
}

