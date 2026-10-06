import { getBearerToken, verifyJWT } from './_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const token = getBearerToken(context.request);
    if (!token) {
      return Response.json({ error: '未登录或未授权' }, { status: 401 });
    }

    const payload = await verifyJWT(token, context.env.JWT_SECRET);
    if (!payload) {
      return Response.json({ error: '登录凭证无效或已过期' }, { status: 401 });
    }

    const user = await context.env.DB.prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?')
      .bind(payload.userId)
      .first<{ id: string; email: string; nickname: string; created_at: number }>();

    if (!user) {
      return Response.json({ error: '用户不存在' }, { status: 404 });
    }

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
