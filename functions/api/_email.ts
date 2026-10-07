/**
 * NuanceTEM 统一邮件服务与模板模块
 *
 * 设计原则：
 * 1. 极简学术美学：与 NuanceTEM 主视觉契合（标志性豆青色 #0f766e，柔和纸质背景，高可读性文字层级）
 * 2. 移动优先适配：自适应宽度（最大 540px）、防缩放 meta、邮件防截断 Preheader、超大触控热区按钮
 * 3. 客户端高兼容性：基于标准内联样式与容错表格布局，通过 Gmail、Apple Mail、Outlook、QQ 邮箱、微信内置预览测试
 * 4. 防垃圾邮件评级优化：HTML + PlainText 双版本生成，降低 Spam 分值
 * 5. 集中收敛：统一管理全系统邮件发件逻辑与模板渲染
 */

export const BRAND = {
  name: 'NuanceTEM · 豆英语',
  subtitle: '专四 / 专八近义词精准辨析与记忆系统',
  primaryColor: '#0f766e',
  primaryHover: '#115e59',
  bgBody: '#f8fafc',
  bgCard: '#ffffff',
  bgMuted: '#f1f5f9',
  textMain: '#0f172a',
  textBody: '#334155',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  borderColor: '#e2e8f0',
  defaultFrom: 'NuanceTEM <onboarding@resend.dev>',
  defaultSiteUrl: 'https://nuancetem.mumu233.top',
};

export interface EmailRenderResult {
  subject: string;
  html: string;
  text: string;
}

export interface BaseLayoutOptions {
  title: string;
  previewText?: string;
  badge?: string;
  contentHtml: string;
  siteUrl?: string;
}

export interface PasswordResetEmailOptions {
  userEmail: string;
  resetLink: string;
  expiresInMinutes?: number;
  siteUrl?: string;
}

export interface WelcomeEmailOptions {
  userEmail: string;
  nickname?: string;
  siteUrl?: string;
}

export interface SendEmailOptions {
  apiKey: string;
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * 基础邮件全局布局外壳
 * 负责包裹通用 Header、Footer、视口 Meta、隐藏 Preheader 摘要与移动端响应式样式
 */
export function renderEmailLayout(options: BaseLayoutOptions): string {
  const { title, previewText = '', badge = '系统通知', contentHtml, siteUrl = BRAND.defaultSiteUrl } = options;
  const currentYear = new Date().getFullYear();

  // 隐藏 Preheader 填充字符（用于填满收件箱列表预览区域，防止抓取后续代码或混乱直链）
  const preheaderPadding = '&#847; &zwnj; &nbsp; &#8199; &shy; '.repeat(15);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${title}</title>
  <style type="text/css">
    /* 客户端重置 */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: ${BRAND.bgBody}; }
    /* 移动端响应式 */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; margin: 0 auto !important; }
      .email-card { padding: 24px 18px !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .email-header { padding: 20px 18px 12px 18px !important; }
      .email-footer { padding: 20px 18px !important; }
      .btn-primary { width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bgBody}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${BRAND.textBody};">
  <!-- 隐藏摘要 Preheader：在收件箱列表呈现友好预览 -->
  <div style="display: none; font-size: 1px; color: ${BRAND.bgBody}; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${previewText}
    ${preheaderPadding}
  </div>

  <!-- 外层页面容器 -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND.bgBody};">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!-- 核心内容容器 (最大 540px，兼顾桌面与手机) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 540px; margin: 0 auto;">
          <!-- 页眉 Header -->
          <tr>
            <td class="email-header" style="padding: 12px 6px 20px 6px; text-align: left;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <a href="${siteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${BRAND.primaryColor}; margin-right: 8px; vertical-align: middle;"></span>
                      <span style="font-size: 18px; font-weight: 700; color: ${BRAND.primaryColor}; letter-spacing: 0.5px; vertical-align: middle;">NuanceTEM</span>
                      <span style="font-size: 14px; color: ${BRAND.textMuted}; margin-left: 6px; vertical-align: middle;">· 豆英语</span>
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; font-size: 11px; font-weight: 600; color: ${BRAND.primaryColor}; background-color: #ccfbf1; padding: 3px 8px; border-radius: 9999px;">
                      ${badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 主卡片 Card -->
          <tr>
            <td>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="background-color: ${BRAND.bgCard}; border: 1px solid ${BRAND.borderColor}; border-radius: 12px; padding: 32px 28px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);">
                <tr>
                  <td>
                    ${contentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 页脚 Footer -->
          <tr>
            <td class="email-footer" style="padding: 24px 12px 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND.textLight}; line-height: 1.6;">
                这是一封由系统自动发出的事务性邮件，请勿直接回复。<br/>
                如需继续备考，请访问 <a href="${siteUrl}" target="_blank" style="color: ${BRAND.primaryColor}; text-decoration: none; font-weight: 500;">NuanceTEM 官方网站</a>。
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1; letter-spacing: 0.2px;">
                © ${currentYear} NuanceTEM. 保留所有权利。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 模板 1：重置密码邮件（Password Reset）
 * 提供 HTML 与 PlainText 双版本
 */
export function renderPasswordResetEmail(options: PasswordResetEmailOptions): EmailRenderResult {
  const {
    userEmail,
    resetLink,
    expiresInMinutes = 60,
    siteUrl = BRAND.defaultSiteUrl,
  } = options;

  const subject = '【豆英语 · NuanceTEM】重置您的账户密码';
  const previewText = `您好！我们收到了重置您账户密码的申请，该重置链接在 ${expiresInMinutes} 分钟内有效。`;

  const contentHtml = `
    <!-- 标题 -->
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: ${BRAND.textMain}; line-height: 1.4;">
      重置您的账户密码
    </h1>

    <!-- 问候与说明 -->
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: ${BRAND.textBody};">
      您好，<strong style="color: ${BRAND.textMain};">${userEmail}</strong>：
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.65; color: ${BRAND.textBody};">
      我们收到了重置您 NuanceTEM 账户密码的申请。请点击下方按钮设置新密码（该链接在 <strong>${expiresInMinutes} 分钟</strong>内有效）：
    </p>

    <!-- 移动端友好的高对比度 CTA 按钮 (Table 结构保证客户端兼容) -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" style="border-radius: 8px; background-color: ${BRAND.primaryColor};">
                <a href="${resetLink}" target="_blank" class="btn-primary" style="display: inline-block; padding: 13px 36px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px;">
                  设置新密码
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 备用直链复制框（应对客户端禁用按钮交互） -->
    <div style="margin: 24px 0 20px 0; padding: 14px 16px; background-color: ${BRAND.bgBody}; border: 1px solid ${BRAND.borderColor}; border-radius: 8px;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: ${BRAND.textMuted};">
        如果上方按钮无法点击，请复制以下链接粘贴到浏览器访问：
      </p>
      <p style="margin: 0; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.5; word-break: break-all;">
        <a href="${resetLink}" target="_blank" style="color: ${BRAND.primaryColor}; text-decoration: underline;">
          ${resetLink}
        </a>
      </p>
    </div>

    <!-- 安全防伪提示 -->
    <div style="padding-top: 18px; border-top: 1px solid ${BRAND.borderColor};">
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${BRAND.textMuted};">
        🔒 <strong>安全提醒：</strong>如非您本人申请，请忽略此邮件，您的账户依然安全。请勿将此链接透露给任何人。
      </p>
    </div>
  `;

  const html = renderEmailLayout({
    title: subject,
    previewText,
    badge: '安全验证',
    contentHtml,
    siteUrl,
  });

  const text = `【豆英语 · NuanceTEM】重置您的账户密码

您好，${userEmail}：

我们收到了重置您 NuanceTEM 账户密码的申请。请在 ${expiresInMinutes} 分钟内访问以下链接设置新密码：

${resetLink}

---
安全提示：如非您本人申请，请忽略此邮件，您的账户密码不会被修改。
官方网站：${siteUrl}
本邮件由系统自动发出，请勿直接回复。`;

  return { subject, html, text };
}

/**
 * 模板 2：新用户欢迎邮件（预留扩展）
 */
export function renderWelcomeEmail(options: WelcomeEmailOptions): EmailRenderResult {
  const { userEmail, nickname = '学友', siteUrl = BRAND.defaultSiteUrl } = options;
  const subject = '【豆英语 · NuanceTEM】欢迎开启专四/专八词汇辨析之旅';
  const previewText = `欢迎加入 NuanceTEM，即刻开启基于 SM-2 记忆曲线的近义词深度辨析！`;

  const contentHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: ${BRAND.textMain};">
      欢迎加入 NuanceTEM！
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: ${BRAND.textBody};">
      您好，<strong style="color: ${BRAND.textMain};">${nickname}</strong>（${userEmail}）：
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: ${BRAND.textBody};">
      恭喜您成功注册 NuanceTEM 账号！您的所有做题进度、熟记词汇、错题集与 SM-2 记忆排程已开启云端多端同步。
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}" target="_blank" class="btn-primary" style="display: inline-block; padding: 13px 36px; font-size: 15px; font-weight: 600; color: #ffffff; background-color: ${BRAND.primaryColor}; text-decoration: none; border-radius: 8px;">
            进入题库开始练习
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderEmailLayout({
    title: subject,
    previewText,
    badge: '欢迎加入',
    contentHtml,
    siteUrl,
  });

  const text = `【豆英语 · NuanceTEM】欢迎加入 NuanceTEM！

您好，${nickname}：

欢迎开启专四/专八词汇辨析之旅！您的做题进度与记忆曲线已支持云端多端同步。

开始练习：${siteUrl}
本邮件由系统自动发出，请勿直接回复。`;

  return { subject, html, text };
}

/**
 * 统一发信执行器 (Resend)
 * 收敛 HTTP POST 调用、错误处理与日志打点
 */
export async function sendEmailViaResend(options: SendEmailOptions): Promise<SendEmailResult> {
  const { apiKey, from = BRAND.defaultFrom, to, subject, html, text } = options;

  if (!apiKey) {
    return { success: false, error: '缺少 RESEND_API_KEY 配置' };
  }

  const toList = Array.isArray(to) ? to : [to];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: toList,
        subject,
        html,
        text,
      }),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      const errMsg = data?.message || `Resend HTTP ${res.status}`;
      console.error('[EmailService] 邮件发送失败:', errMsg, data);
      return { success: false, error: errMsg };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('[EmailService] 邮件网络请求异常:', err);
    return { success: false, error: err?.message || '网络异常' };
  }
}
