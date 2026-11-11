import Dexie, { type Table } from 'dexie';

export interface Question {
  id: string;
  group_id: number;
  group_name: string;
  level: string;
  target_word: string;
  question: string;
  options: string[];
  answer: string;
  distractor_analysis: Record<string, string>;
  translation: string;
  field?: string; // 语义场 (FIELD_CHANGE, FIELD_STANCE, ...)
  mechanism?: string; // 辨析机制 (MECH_COLLOCATION, MECH_CONNOTATION, ...)
  taxonomy_notes?: string; // 辨析要点简记
}

// 标签分类元数据
export const TAXONOMY_FIELDS = {
  FIELD_CHANGE: { code: 'FIELD_CHANGE', label: '变化与态势', desc: '增减、涨跌、恶化、缓解、剧变' },
  FIELD_STANCE: { code: 'FIELD_STANCE', label: '立场与评价', desc: '赞同、攻讦、辩护、质疑、批判' },
  FIELD_COGNITION: { code: 'FIELD_COGNITION', label: '认知与思维', desc: '理解、晦涩、清晰、误导、推论' },
  FIELD_BEHAVIOR: { code: 'FIELD_BEHAVIOR', label: '意志与行事', desc: '勤勉、怠惰、坚持、放弃、挥霍' },
  FIELD_RELATION: { code: 'FIELD_RELATION', label: '规约与社会', desc: '顺从、抵触、契约、法庭、规章' },
  FIELD_NATURE: { code: 'FIELD_NATURE', label: '状态与时空', desc: '持续、短暂、分布、永恒、渗透' },
} as const;

export const TAXONOMY_MECHANISMS = {
  MECH_COLLOCATION: { code: 'MECH_COLLOCATION', label: '介词与搭配', color: '#1d4ed8' },
  MECH_CONNOTATION: { code: 'MECH_CONNOTATION', label: '感情与褒贬', color: '#7e22ce' },
  MECH_REGISTER: { code: 'MECH_REGISTER', label: '语境与庄谐', color: '#b45309' },
  MECH_NUANCE: { code: 'MECH_NUANCE', label: '词义与侧重', color: '#047857' },
} as const;

export interface Progress {
  questionId: string;
  status: 'new' | 'learning' | 'mastered';
  interval: number; // in days
  ease: number; // SM-2 ease factor, defaults to 2.5
  repetitions: number; // consecutive correct answers
  nextReview: number; // timestamp in ms
  lastAnswered: number; // timestamp in ms
  updatedAt?: number; // timestamp in ms (for two-way sync)
}

export interface StudyLog {
  id?: number;
  timestamp: number;
  questionId: string;
  userChoice: string;
  isCorrect: boolean;
  quality: number; // 0-5
}

class NuanceTEMDatabase extends Dexie {
  questions!: Table<Question>;
  progress!: Table<Progress>;
  logs!: Table<StudyLog>;

  constructor() {
    super('NuanceTEMDatabase');
    this.version(1).stores({
      questions: 'id, group_id, target_word',
      progress: 'questionId, status, nextReview',
      logs: '++id, timestamp, questionId',
    });
    this.version(2).stores({
      questions: 'id, group_id, target_word, level',
      progress: 'questionId, status, nextReview',
      logs: '++id, timestamp, questionId',
    });
    this.version(3).stores({
      questions: 'id, group_id, target_word, level, field, mechanism',
      progress: 'questionId, status, nextReview',
      logs: '++id, timestamp, questionId',
    });
  }
}

export const db = new NuanceTEMDatabase();

export function createDefaultProgress(questionId: string): Progress {
  return {
    questionId,
    status: 'new',
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    nextReview: 0,
    lastAnswered: 0,
    updatedAt: Date.now(),
  };
}

// SM-2 Spaced Repetition Algorithm
export function calculateSM2(
  quality: number, // 0 to 5
  prevInterval: number,
  prevEase: number,
  prevRepetitions: number
): { interval: number; ease: number; repetitions: number } {
  let interval = 1;
  let ease = prevEase;
  let repetitions = prevRepetitions;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      // First review interval depends on quality
      if (quality === 5) interval = 4;
      else if (quality === 4) interval = 2;
      else interval = 1;
    } else if (repetitions === 1) {
      // Second review interval depends on quality
      if (quality === 5) interval = 8;
      else if (quality === 4) interval = 6;
      else interval = 3;
    } else {
      interval = Math.round(prevInterval * prevEase);
    }
    repetitions++;
  } else {
    // Incorrect response
    repetitions = 0;
    interval = 1; // reset to 1 day
  }

  // Adjust Ease factor
  ease = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) {
    ease = 1.3;
  }

  return { interval, ease, repetitions };
}

// Update progress for a question after answering
export async function recordAttempt(
  questionId: string,
  userChoice: string,
  isCorrect: boolean,
  quality: number // 0-5
) {
  const timestamp = Date.now();
  
  // 1. Log the attempt
  await db.logs.add({
    timestamp,
    questionId,
    userChoice,
    isCorrect,
    quality,
  });

  // 2. Fetch existing progress
  let progress = await db.progress.get(questionId);
  if (!progress) {
    progress = createDefaultProgress(questionId);
  }

  // 3. Compute SM-2 variables
  const { interval, ease, repetitions } = calculateSM2(
    quality,
    progress.interval,
    progress.ease,
    progress.repetitions
  );

  // 4. Update status
  let status = progress.status;
  if (status !== 'mastered') {
    if (status === 'new' && isCorrect) {
      status = 'learning';
    } else if (!isCorrect) {
      status = 'learning'; // Demoted back to learning
    }
  }

  const nextReview = timestamp + interval * 24 * 60 * 60 * 1000;

  await db.progress.put({
    questionId,
    status,
    interval,
    ease,
    repetitions,
    nextReview,
    lastAnswered: timestamp,
    updatedAt: timestamp,
  });
}

// Toggle "mastered" (熟记) status. If mastered, it will be excluded from ordinary study.
export async function toggleMastered(questionId: string, isMastered: boolean) {
  let progress = await db.progress.get(questionId);
  if (!progress) {
    progress = createDefaultProgress(questionId);
  }

  progress.status = isMastered ? 'mastered' : 'learning';
  // If mastered, push next review far into future, or just rely on status filter
  progress.nextReview = isMastered ? Date.now() + 365 * 24 * 60 * 60 * 1000 : Date.now();
  progress.updatedAt = Date.now();
  
  await db.progress.put(progress);
}
