import { hashPassword } from './_utils';

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  APP_URL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as {
      action: 'request' | 'confirm';
      email?: string;
      token?: string;
      newPassword?: string;
    };

    // 1. 发起找回密码请求
    if (body.action === 'request') {
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        return Response.json({ error: '请输入邮箱地址' }, { status: 400 });
      }

      const user = await context.env.DB.prepare('SELECT id, email FROM users WHERE email = ?')
        .bind(email)
        .first<{ id: string; email: string }>();

      if (!user) {
        // 安全考量：不透露用户是否存在
        return Response.json({ success: true, message: '如果该邮箱已注册，重置密码指令已发送。' });
      }

      // 生成安全的重置 Token
      const token = crypto.randomUUID();
      const expiresAt = Date.now() + 1000 * 60 * 60; // 1小时有效
      const tokenId = crypto.randomUUID();

      await context.env.DB.prepare(
        'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(tokenId, user.id, token, expiresAt, Date.now()).run();

      const appUrl = context.env.APP_URL || new URL(context.request.url).origin;
      const resetLink = `${appUrl}/#reset-password?token=${token}`;

      // 如果配置了 Resend，发送真实邮件
      let emailSent = false;
      if (context.env.RESEND_API_KEY) {
        try {
          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'NuanceTEM <auth@resend.dev>',
              to: [email],
              subject: '【NuanceTEM】重置您的账户密码',
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <h2 style="color: #4f46e5;">NuanceTEM 账户密码重置</h2>
                  <p>您好！我们收到了重置您账户密码的请求。请在 1 小时内点击下方按钮设置新密码：</p>
                  <p style="margin: 25px 0;">
                    <a href="${resetLink}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">重置密码</a>
                  </p>
                  <p style="color: #64748b; font-size: 13px;">如果按钮无法点击，请复制以下链接到浏览器访问：<br/>${resetLink}</p>
                  <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">如非您本人操作，请忽略此邮件，您的账户依然安全。</p>
                </div>
              `,
            }),
          });
          emailSent = resendResp.ok;
        } catch (e) {
          console.error('Failed to send email via Resend:', e);
        }
      }

      return Response.json({
        success: true,
        message: '如果该邮箱已注册，重置密码指令已发送。',
        // 开发调试辅助 (无真实发信环境时提供便捷链接)
        debugResetLink: !context.env.RESEND_API_KEY ? resetLink : undefined,
      });
    }

    // 2. 执行密码重置
    if (body.action === 'confirm') {
      const { token, newPassword } = body;
      if (!token || !newPassword || newPassword.length < 6) {
        return Response.json({ error: '无效请求或新密码长度不足 6 位' }, { status: 400 });
      }

      const resetRecord = await context.env.DB.prepare(
        'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = ?'
      ).bind(token).first<{ id: string; user_id: string; expires_at: number; used: number }>();

      if (!resetRecord || resetRecord.used === 1 || Date.now() > resetRecord.expires_at) {
        return Response.json({ error: '重置链接无效或已过期，请重新申请' }, { status: 400 });
      }

      // 更新用户密码
      const newPasswordHash = await hashPassword(newPassword);
      await context.env.DB.prepare(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
      ).bind(newPasswordHash, Date.now(), resetRecord.user_id).run();

      // 标记 token 已使用
      await context.env.DB.prepare(
        'UPDATE password_reset_tokens SET used = 1 WHERE id = ?'
      ).bind(resetRecord.id).run();

      return Response.json({ success: true, message: '密码重置成功，请使用新密码登录' });
    }

    return Response.json({ error: '不支持的操作' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: '操作失败: ' + error.message }, { status: 500 });
  }
};
