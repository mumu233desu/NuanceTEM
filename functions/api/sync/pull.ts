import { getBearerToken, verifyJWT } from '../auth/_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const token = getBearerToken(context.request);
    if (!token) {
      return Response.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyJWT(token, context.env.JWT_SECRET);
    if (!payload) {
      return Response.json({ error: '凭证无效或已过期' }, { status: 401 });
    }

    // 拉取用户的所有进度记录
    const { results } = await context.env.DB.prepare(
      `SELECT question_id as questionId, status, interval, ease, repetitions, next_review as nextReview, last_answered as lastAnswered, updated_at as updatedAt 
       FROM user_progress 
       WHERE user_id = ?`
    ).bind(payload.userId).all();

    return Response.json({
      success: true,
      progressList: results || [],
      serverTime: Date.now(),
    });
  } catch (error: any) {
    return Response.json({ error: '同步拉取失败: ' + error.message }, { status: 500 });
  }
};
