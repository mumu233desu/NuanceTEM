import { getBearerToken, verifyJWT } from '../auth/_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
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

    // 彻底清除该用户在云端的进度与答题流水记录
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM user_progress WHERE user_id = ?').bind(payload.userId),
      context.env.DB.prepare('DELETE FROM user_attempts WHERE user_id = ?').bind(payload.userId),
    ]);

    return Response.json({
      success: true,
      message: '云端同步进度与答题记录已彻底清空',
    });
  } catch (error: any) {
    return Response.json({ error: '重置云端数据失败: ' + error.message }, { status: 500 });
  }
};
