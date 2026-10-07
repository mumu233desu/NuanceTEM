import { hashPassword } from './_utils';

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  APP_URL?: string;
}

async function hashToken(token: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
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

      if (user) {
        // 先作废该用户以往所有未使用的有效 Token
        await context.env.DB.prepare(
          'UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0'
        ).bind(user.id).run();

        // 生成安全的重置 Token
        const rawToken = crypto.randomUUID();
        const tokenHash = await hashToken(rawToken);
        const expiresAt = Date.now() + 1000 * 60 * 60; // 1小时有效
        const tokenId = crypto.randomUUID();

        // 仅将 Token 的 SHA-256 哈希值写入数据库
        await context.env.DB.prepare(
          'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(tokenId, user.id, tokenHash, expiresAt, Date.now()).run();

        const appUrl = context.env.APP_URL || new URL(context.request.url).origin;
        const resetLink = `${appUrl}/#reset-password?token=${rawToken}`;

        if (context.env.RESEND_API_KEY) {
          try {
            const fromEmail = context.env.RESEND_FROM || 'NuanceTEM <onboarding@resend.dev>';
            const resendResp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [email],
                subject: '【豆英语 · NuanceTEM】重置您的账户密码',
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 30px 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                    <div style="margin-bottom: 20px;">
                      <h2 style="color: #0f766e; margin: 0; font-size: 20px;">豆英语 · NuanceTEM</h2>
                    </div>
                    <p style="color: #1e293b; font-size: 15px; line-height: 1.6;">您好！我们收到了重置您账户密码的申请。请在 1 小时内点击下方按钮设置新密码：</p>
                    <div style="margin: 28px 0; text-align: center;">
                      <a href="${resetLink}" style="background: #0f766e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">设置新密码</a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5; word-break: break-all;">如果按钮无法点击，请复制以下链接至浏览器访问：<br/><a href="${resetLink}" style="color: #0f766e;">${resetLink}</a></p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">如非您本人申请，请忽略此邮件，您的账户依然安全。</p>
                  </div>
                `,
              }),
            });
            if (!resendResp.ok) {
              const errBody = await resendResp.text();
              console.error('[Resend Error]:', resendResp.status, errBody);
            }
          } catch (e) {
            console.error('Failed to send email via Resend:', e);
          }
        } else {
          // 本地无发信配置时仅在服务端安全日志打印，严禁通过 HTTP 响应输出
          console.warn(`[DEV Reset Link for ${email}]: ${resetLink}`);
        }
      }

      // 无论用户是否存在，均返回完全一致的信息，阻断邮箱探测
      return Response.json({
        success: true,
        message: '如果该邮箱已注册，重置密码指令已发送。',
      });
    }

    // 2. 执行密码重置
    if (body.action === 'confirm') {
      const { token, newPassword } = body;
      if (!token || !newPassword || newPassword.length < 6) {
        return Response.json({ error: '无效请求或新密码长度不足 6 位' }, { status: 400 });
      }

      const tokenHash = await hashToken(token);
      const resetRecord = await context.env.DB.prepare(
        'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = ?'
      ).bind(tokenHash).first<{ id: string; user_id: string; expires_at: number; used: number }>();

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
