import { verifyPassword, signJWT } from './_utils';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return Response.json({ error: '请输入邮箱和密码' }, { status: 400 });
    }

    // 查找用户
    const user = await context.env.DB.prepare('SELECT id, email, password_hash, nickname FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; password_hash: string; nickname: string }>();

    if (!user) {
      return Response.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    // 校验密码
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return Response.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    // 签发 JWT
    const token = await signJWT({ userId: user.id, email: user.email }, context.env.JWT_SECRET);

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
      token,
    });
  } catch (error: any) {
    return Response.json({ error: '登录失败: ' + error.message }, { status: 500 });
  }
};
