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
}

export interface Progress {
  questionId: string;
  status: 'new' | 'learning' | 'mastered';
  interval: number; // in days
  ease: number; // SM-2 ease factor, defaults to 2.5
  repetitions: number; // consecutive correct answers
  nextReview: number; // timestamp in ms
  lastAnswered: number; // timestamp in ms
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
  }
}

export const db = new NuanceTEMDatabase();

// Initialize DB with JSON data if empty
export async function initializeDatabase(questionsData: Question[]) {
  const count = await db.questions.count();
  if (count === 0) {
    console.log('IndexedDB is empty. Seeding question database...');
    await db.questions.bulkPut(questionsData);
    
    // Seed default progress entries
    const progressEntries: Progress[] = questionsData.map(q => createDefaultProgress(q.id));
    await db.progress.bulkPut(progressEntries);
    console.log(`Database seeded with ${questionsData.length} questions.`);
  } else {
    // Sync all questions to ensure fixes/updates are applied to existing items
    await db.questions.bulkPut(questionsData);
    
    // Only create progress entries for brand new questions
    const existingIds = new Set(await db.progress.toCollection().primaryKeys());
    const newQuestions = questionsData.filter(q => !existingIds.has(q.id));
    if (newQuestions.length > 0) {
      console.log(`Adding ${newQuestions.length} new progress entries to database.`);
      const newProgressEntries: Progress[] = newQuestions.map(q => createDefaultProgress(q.id));
      await db.progress.bulkPut(newProgressEntries);
    }
  }
}

export function createDefaultProgress(questionId: string): Progress {
  return {
    questionId,
    status: 'new',
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    nextReview: 0,
    lastAnswered: 0,
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
  
  await db.progress.put(progress);
}
