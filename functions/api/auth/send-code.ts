import { renderVerificationCodeEmail, sendEmailViaResend, BRAND } from '../_email';

interface Env {
  DB: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  APP_URL?: string;
}

// 加密安全随机数生成 6 位纯数字验证码
function generateSecureCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const codeNum = (array[0] % 900000) + 100000;
  return codeNum.toString();
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { email?: string; type?: 'register' };
    const email = body.email?.trim().toLowerCase();
    const type = body.type || 'register';

    if (!email || !email.includes('@')) {
      return Response.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }

    // 1. 注册类型：检查是否已被注册
    if (type === 'register') {
      const existing = await context.env.DB.prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first();
      if (existing) {
        return Response.json({ error: '该邮箱已被注册，请直接登录' }, { status: 409 });
      }
    }

    // 2. 频率限制 (Rate Limit)：同一邮箱 60 秒内只能发送一次
    const now = Date.now();
    const recent = await context.env.DB.prepare(
      'SELECT created_at FROM email_verification_codes WHERE email = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1'
    ).bind(email, now - 60 * 1000).first<{ created_at: number }>();

    if (recent) {
      const remainingSecs = Math.ceil((recent.created_at + 60 * 1000 - now) / 1000);
      return Response.json(
        { error: `发送过于频繁，请等待 ${remainingSecs} 秒后再试` },
        { status: 429 }
      );
    }

    // 3. 短期不重复：查出该邮箱过去 24 小时内用过的验证码
    const recentCodes = await context.env.DB.prepare(
      'SELECT code FROM email_verification_codes WHERE email = ? AND created_at > ? ORDER BY created_at DESC LIMIT 5'
    ).bind(email, now - 24 * 60 * 60 * 1000).all<{ code: string }>();

    const usedCodesSet = new Set((recentCodes.results || []).map(r => r.code));

    let code = generateSecureCode();
    let attempts = 0;
    while (usedCodesSet.has(code) && attempts < 10) {
      code = generateSecureCode();
      attempts++;
    }

    // 4. 先将该邮箱以往所有未使用的有效验证码置为失效 (used = 1)，避免多码并存混淆
    await context.env.DB.prepare(
      'UPDATE email_verification_codes SET used = 1 WHERE email = ? AND used = 0'
    ).bind(email).run();

    // 5. 写入新验证码 (15 分钟有效)
    const codeId = crypto.randomUUID();
    const expiresInMinutes = 15;
    const expiresAt = now + expiresInMinutes * 60 * 1000;

    await context.env.DB.prepare(
      'INSERT INTO email_verification_codes (id, email, code, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    ).bind(codeId, email, code, expiresAt, now).run();

    // 6. 发送邮件
    const appUrl = context.env.APP_URL || new URL(context.request.url).origin;
    const emailData = renderVerificationCodeEmail({
      userEmail: email,
      code,
      expiresInMinutes,
      siteUrl: appUrl,
    });

    if (context.env.RESEND_API_KEY) {
      const sendRes = await sendEmailViaResend({
        apiKey: context.env.RESEND_API_KEY,
        from: context.env.RESEND_FROM || BRAND.defaultFrom,
        to: email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });

      if (!sendRes.success) {
        console.error('[SendCode Error]:', sendRes.error);
        return Response.json({ error: '验证码邮件发送失败，请稍后重试' }, { status: 500 });
      }
    } else {
      console.warn(`[DEV Verification Code for ${email}]: ${code}`);
    }

    return Response.json({
      success: true,
      message: '验证码已发送至您的邮箱，15分钟内有效',
    });
  } catch (error: any) {
    console.error('send-code failed:', error);
    return Response.json({ error: '请求处理失败: ' + error.message }, { status: 500 });
  }
};
