import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './env.js';

export type QuestionType =
  | 'mcq'
  | 'fill-blank'
  | 'word-bank'
  | 'order'
  | 'match'
  | 'bug'
  | 'true-false'
  | 'frq';

export interface ChallengeBase {
  id: string;
  type: QuestionType;
  prompt: string;
  code?: string;
  explanation: string;
  xp?: number;
}

export interface McqChallenge extends ChallengeBase {
  type: 'mcq';
  options: { id: string; text: string }[];
  answer: string;
}

export interface FillBlankChallenge extends ChallengeBase {
  type: 'fill-blank' | 'word-bank';
  template: string;
  mode: 'type' | 'wordbank';
  bank?: string[];
  blanks: { answers: string[]; caseSensitive?: boolean }[];
}

export interface OrderChallenge extends ChallengeBase {
  type: 'order';
  lines: { id: string; text: string }[];
  answer: string[];
}

export interface MatchChallenge extends ChallengeBase {
  type: 'match';
  pairs: { left: string; right: string }[];
}

export interface BugChallenge extends ChallengeBase {
  type: 'bug';
  lines: { id: string; text: string }[];
  fixes: { id: string; text: string }[];
  answer: { lineId: string; fixId: string };
}

export interface TrueFalseChallenge extends ChallengeBase {
  type: 'true-false';
  statement: string;
  answer: boolean;
}

export interface FrqChallenge extends ChallengeBase {
  type: 'frq';
  starterCode: Record<string, string>;
  tests: { stdin: string; expected: string }[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
}

export type Challenge =
  | McqChallenge
  | FillBlankChallenge
  | OrderChallenge
  | MatchChallenge
  | BugChallenge
  | TrueFalseChallenge
  | FrqChallenge;

export interface Lesson {
  id: string;
  title: string;
  skillId: string;
  language: string;
  xp: number;
  intro: { title: string; body: string; sample?: string };
  challenges: Challenge[];
}

export interface Skill {
  id: string;
  title: string;
  summary: string;
  lessons: string[];
}

export interface LearnTrack {
  id: string;
  title: string;
  language: string;
  description: string;
  available: boolean;
  skills: Skill[];
}

export interface CompetеTopic {
  id: string;
  title: string;
  summary: string;
  lesson: { explanation: string; workedExample: string; checks: Challenge[] };
  editorial: string;
  problemIds: string[];
}

export interface CompeteTier {
  id: string;
  title: string;
  description: string;
  unlockSkills: string[];
  topics: CompetеTopic[];
}

export interface ProblemTest {
  stdin: string;
  expected: string;
}

export interface Problem {
  id: string;
  title: string;
  tier: string;
  track: string;
  difficulty: string;
  statement: string;
  topics: string[];
  points: number;
  timeLimitMs: number;
  memoryLimitKb: number;
  starterCode: Record<string, string>;
  tests: ProblemTest[];
  editorial: string;
  editorialUnlockAfterAttempts: number;
}

export interface CompeteTrack {
  id: string;
  title: string;
  description: string;
  available: boolean;
  tiers: CompeteTier[];
  problems: Problem[];
}

export interface Contest {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemIds: string[];
  kind: 'weekly' | 'practice';
}

export interface PlacementQuestion {
  id: string;
  skillId: string;
  prompt: string;
  code?: string;
  options: { id: string; text: string }[];
  answer: string;
}

export interface ContentIndex {
  learnTracks: LearnTrack[];
  lessons: Map<string, Lesson>;
  competeTracks: CompeteTrack[];
  problems: Map<string, Problem>;
  contests: Contest[];
  placement: PlacementQuestion[];
  challenges: Map<string, { challenge: Challenge; lessonId: string; topicId?: string }>;
}

let cache: ContentIndex | null = null;

function contentRoot(): string {
  if (config.contentDir) return resolve(config.contentDir);
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, '../../content'), resolve(process.cwd(), 'content'), resolve(process.cwd(), '../content')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Content directory not found.');
  return found;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function loadLearnTracks(root: string, lessons: Map<string, Lesson>): Promise<LearnTrack[]> {
  const learnDir = join(root, 'learn');
  if (!existsSync(learnDir)) return [];
  const tracks: LearnTrack[] = [];
  for (const trackId of await readdir(learnDir)) {
    const trackFile = join(learnDir, trackId, 'track.json');
    if (!existsSync(trackFile)) continue;
    const track = await readJson<LearnTrack>(trackFile);
    const lessonsDir = join(learnDir, trackId, 'lessons');
    if (existsSync(lessonsDir)) {
      for (const file of (await readdir(lessonsDir)).filter((name) => name.endsWith('.json'))) {
        const lesson = await readJson<Lesson>(join(lessonsDir, file));
        lessons.set(lesson.id, { ...lesson, language: lesson.language ?? track.language });
      }
    }
    tracks.push(track);
  }
  return tracks;
}

async function loadCompete(
  root: string,
  problems: Map<string, Problem>,
): Promise<CompeteTrack[]> {
  const dir = join(root, 'compete');
  if (!existsSync(dir)) return [];
  const tracks: CompeteTrack[] = [];
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json'))) {
    const track = await readJson<CompeteTrack>(join(dir, file));
    for (const problem of track.problems ?? []) {
      problems.set(problem.id, { ...problem, track: track.id });
    }
    tracks.push(track);
  }
  return tracks;
}

export async function loadContent(): Promise<ContentIndex> {
  if (cache) return cache;
  const root = contentRoot();
  const lessons = new Map<string, Lesson>();
  const problems = new Map<string, Problem>();
  const learnTracks = await loadLearnTracks(root, lessons);
  const competeTracks = (await loadCompete(root, problems)).sort((a, b) =>
    a.id === 'usaco' ? -1 : b.id === 'usaco' ? 1 : a.id.localeCompare(b.id),
  );
  const contestsFile = join(root, 'contests.json');
  const contests = existsSync(contestsFile) ? (await readJson<{ contests: Contest[] }>(contestsFile)).contests : [];
  const placementFile = join(root, 'placement.json');
  const placement = existsSync(placementFile)
    ? (await readJson<{ questions: PlacementQuestion[] }>(placementFile)).questions
    : [];

  const challenges = new Map<string, { challenge: Challenge; lessonId: string; topicId?: string }>();
  for (const lesson of lessons.values()) {
    for (const challenge of lesson.challenges) {
      challenges.set(challenge.id, { challenge, lessonId: lesson.id });
    }
  }
  for (const track of competeTracks) {
    for (const tier of track.tiers) {
      for (const topic of tier.topics) {
        for (const check of topic.lesson.checks) {
          challenges.set(check.id, { challenge: check, lessonId: `topic:${topic.id}`, topicId: topic.id });
        }
      }
    }
  }

  cache = { learnTracks, lessons, competeTracks, problems, contests, placement, challenges };
  return cache;
}

export function resetContentCache(): void {
  cache = null;
}

export async function getContent(): Promise<ContentIndex> {
  return cache ?? loadContent();
}

export function lessonFor(content: ContentIndex, lessonId: string): Lesson {
  const lesson = content.lessons.get(lessonId);
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  return lesson;
}

export function findTopic(content: ContentIndex, topicId: string) {
  for (const track of content.competeTracks) {
    for (const tier of track.tiers) {
      const topic = tier.topics.find((entry) => entry.id === topicId);
      if (topic) return { track, tier, topic };
    }
  }
  return null;
}
