import { getBearerToken, verifyJWT } from '../auth/_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

interface SyncItem {
  questionId: string;
  status: 'new' | 'learning' | 'mastered';
  interval: number;
  ease: number;
  repetitions: number;
  nextReview: number;
  lastAnswered: number;
  updatedAt?: number;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const token = getBearerToken(context.request);
    if (!token) {
      return Response.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyJWT(token, context.env.JWT_SECRET);
    if (!payload) {
      return Response.json({ error: '凭证无效或已过期' }, { status: 401 });
    }

    const body = await context.request.json() as { items?: SyncItem[] };
    const items = body.items || [];

    if (items.length === 0) {
      return Response.json({ success: true, updatedCount: 0 });
    }

    const now = Date.now();
    // 使用 D1 batch 执行批量 Upsert
    const statements = items.map(item => {
      const updatedAt = item.updatedAt || item.lastAnswered || now;
      return context.env.DB.prepare(`
        INSERT INTO user_progress (
          user_id, question_id, status, interval, ease, repetitions, next_review, last_answered, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
          status = excluded.status,
          interval = excluded.interval,
          ease = excluded.ease,
          repetitions = excluded.repetitions,
          next_review = excluded.next_review,
          last_answered = excluded.last_answered,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= user_progress.updated_at
      `).bind(
        payload.userId,
        item.questionId,
        item.status,
        item.interval,
        item.ease,
        item.repetitions,
        item.nextReview,
        item.lastAnswered,
        updatedAt
      );
    });

    // D1 一次性最多批处理 100 条
    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE);
      await context.env.DB.batch(chunk);
    }

    return Response.json({
      success: true,
      updatedCount: items.length,
      serverTime: now,
    });
  } catch (error: any) {
    return Response.json({ error: '同步推送失败: ' + error.message }, { status: 500 });
  }
};
