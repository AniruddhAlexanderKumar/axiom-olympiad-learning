export interface User {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
  language: string;
  goal: string | null;
  placementSkillId: string | null;
  dailyGoalXp: number;
}

export interface Level {
  level: number;
  title: string;
  nextLevelXp: number;
  progress: number;
}

export interface Stats {
  xp: number;
  streak: number;
  longestStreak: number;
  lastActiveOn: string | null;
  freezes: number;
  hearts: number;
  heartsUpdatedAt: string;
  leagueTier: string;
  contestLanguage: string;
  level: Level;
  todayXp: number;
  dailyGoalXp: number;
  heartsMax: number;
  nextHeartAt: string | null;
  weeklyXp: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
}

export interface Overview {
  user: User;
  stats: Stats;
  nextLesson: { id: string; title: string; skillTitle: string } | null;
  reviewDue: number;
  league: { tier: string; rank: number | null; members: number; weeklyXp: number };
  badges: Badge[];
  badgesEarned: number;
  badgesTotal: number;
  heatmap: { day: string; xp: number }[];
  mastery: { topicId: string; label: string; ratio: number }[];
  contests: { id: string; title: string; score: number; finished: boolean }[];
}

export interface LessonSummary {
  xpEarned: number;
  accuracy: number;
  mistakes: number;
  streak: number;
  newBadges: string[];
  hearts: number;
}

export interface Challenge {
  id: string;
  type:
    | 'mcq'
    | 'fill-blank'
    | 'word-bank'
    | 'order'
    | 'match'
    | 'bug'
    | 'true-false'
    | 'frq';
  prompt: string;
  code?: string;
  xp: number;
  options?: { id: string; text: string }[];
  template?: string;
  mode?: 'type' | 'wordbank';
  bank?: string[];
  blankCount?: number;
  lines?: { id: string; text: string }[];
  left?: string[];
  rightOptions?: string[];
  fixes?: { id: string; text: string }[];
  statement?: string;
  starterCode?: Record<string, string>;
  sampleTest?: { stdin: string; expected: string } | null;
  testCount?: number;
}

export interface LessonSession {
  sessionId: string;
  lesson: { id: string; title: string; xp: number; intro: { title: string; body: string; sample?: string } } | null;
  challenge: Challenge | null;
  progress: { solved: number; total: number; hearts: number; mistakes?: number };
  mode?: 'lesson' | 'review';
}

export interface AnswerResponse {
  result: { correct: boolean; expected: string; given: string; explanation: string };
  hearts: number;
  progress: { solved: number; total: number; mistakes: number };
  next: Challenge | null;
  complete: boolean;
  summary: LessonSummary | null;
}

export interface LearnLesson {
  id: string;
  title: string;
  completed: boolean;
  xp: number;
}

export interface Skill {
  id: string;
  title: string;
  summary: string;
  unlocked: boolean;
  completed: boolean;
  lessonCount: number;
  lessonsDone: number;
  lessons: LearnLesson[];
}

export interface LearnTrack {
  id: string;
  title: string;
  language: string;
  description: string;
  available: boolean;
  skills: Skill[];
  completedLessons: number;
  totalLessons: number;
}

export interface LearnData {
  tracks: LearnTrack[];
  activeTrackId: string | null;
  nextLesson: { lessonId: string; skillId: string; title: string; skillTitle: string } | null;
  hearts: number;
  reviewDue: number;
}

export interface CompeteTopic {
  id: string;
  title: string;
  summary: string;
  unlocked: boolean;
  mastery: number;
  problems: number;
  solved: number;
}

export interface CompeteTier {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockSkills: string[];
  topics: CompeteTopic[];
}

export interface CompeteData {
  tracks: { id: string; title: string; description: string; available: boolean; tiers: CompeteTier[] }[];
  contestLanguages: { id: string; label: string }[];
  contestLanguage: string;
  judgeConfigured: boolean;
}

export interface TopicDetail {
  track: { id: string; title: string };
  tier: { id: string; title: string };
  topic: {
    id: string;
    title: string;
    summary: string;
    explanation: string;
    workedExample: string;
    editorial: string;
    checks: Challenge[];
    problems: { id: string; title: string; difficulty: string; points: number; solved: boolean; attempts: number }[];
  };
}

export interface Problem {
  id: string;
  title: string;
  tier: string;
  difficulty: string;
  statement: string;
  topics: string[];
  points: number;
  sampleTest: { stdin: string; expected: string } | null;
  testCount: number;
  starterCode: Record<string, string>;
  attempts: number;
  solved: boolean;
  editorialUnlocked: boolean;
  editorial: string | null;
  editorialHint: string | null;
  contestLanguage: string;
  languages: { id: string; label: string }[];
  judgeConfigured: boolean;
}

export interface RunOutcome {
  index: number;
  passed: boolean;
  status: string;
  message: string;
  timeMs: number | null;
  memoryKb: number | null;
}

export interface SubmitResponse {
  passed: number;
  total: number;
  solved: boolean;
  score: number;
  xpAwarded: number;
  outcomes: RunOutcome[];
  editorialUnlocked: boolean;
}

export interface ContestSummary {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemCount: number;
  kind: 'weekly' | 'practice';
  entry: { score: number; startedAt: string; finishedAt: string | null; endsAt: string } | null;
}

export interface LeagueStanding {
  userId: string;
  displayName: string;
  xp: number;
  rank: number;
  isYou: boolean;
  zone: 'promotion' | 'demotion' | 'safe';
}

export interface LeagueData {
  tier: string;
  weekStart: string;
  weeklyXp: number;
  standings: LeagueStanding[];
}
