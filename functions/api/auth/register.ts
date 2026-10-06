import { hashPassword, signJWT } from './_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { email?: string; password?: string; nickname?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const nickname = body.nickname?.trim() || (email ? email.split('@')[0] : '学习者');

    // 参数校验
    if (!email || !email.includes('@')) {
      return Response.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return Response.json({ error: '密码长度不能少于 6 位' }, { status: 400 });
    }

    // 查重
    const existing = await context.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existing) {
      return Response.json({ error: '该邮箱已被注册，请直接登录' }, { status: 409 });
    }

    // 哈希密码并插入
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = Date.now();

    await context.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, passwordHash, nickname, now, now).run();

    // 签发 JWT
    const token = await signJWT({ userId, email }, context.env.JWT_SECRET);

    return Response.json({
      success: true,
      user: {
        id: userId,
        email,
        nickname,
      },
      token,
    }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: '注册失败，请稍后重试: ' + error.message }, { status: 500 });
  }
};
