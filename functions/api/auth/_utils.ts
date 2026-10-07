// Web Crypto 原生安全工具集 (适用于 Cloudflare Workers / Pages Functions)

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

// 辅助函数：跨平台安全 Base64URL 编解码（支持 UTF-8 任意多字节字符）
function uint8ToBase64Url(uint8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8[i] = binary.charCodeAt(i);
  }
  return uint8;
}

const base64UrlEncode = (str: string) => uint8ToBase64Url(new TextEncoder().encode(str));
const base64UrlDecode = (str: string) => new TextDecoder().decode(base64UrlToUint8(str));

// 1. 密码安全哈希 (PBKDF2-SHA256 + 16字节随机 Salt)
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

// 2. 密码恒定时间安全比对校验
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [saltHex, originalHashHex] = parts;

    const saltMatches = saltHex.match(/.{1,2}/g);
    const origMatches = originalHashHex.match(/.{1,2}/g);
    if (!saltMatches || saltMatches.length !== 16 || !origMatches || origMatches.length !== 32) {
      return false;
    }

    const salt = new Uint8Array(saltMatches.map(byte => parseInt(byte, 16)));
    const originalHash = new Uint8Array(origMatches.map(byte => parseInt(byte, 16)));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedHashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const derivedHash = new Uint8Array(derivedHashBuffer);
    return crypto.subtle.timingSafeEqual(originalHash, derivedHash);
  } catch {
    return false;
  }
}

// 3. 生成 JWT Token（严禁硬编码默认 Secret，强制要求注入环境变量）
export async function signJWT(payload: { userId: string; email: string }, secret?: string): Promise<string> {
  if (!secret) {
    throw new Error('Server configuration error: JWT_SECRET is required');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30天有效期
  const fullPayload: TokenPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataToSign));
  const encodedSignature = uint8ToBase64Url(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

// 4. 解析并恒定时间校验 JWT Token
export async function verifyJWT(token: string, secret?: string): Promise<TokenPayload | null> {
  if (!secret) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const binarySignature = base64UrlToUint8(signature);
    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, binarySignature, encoder.encode(dataToSign));
    if (!isValid) return null;

    const payloadText = base64UrlDecode(encodedPayload);
    const payload: TokenPayload = JSON.parse(payloadText);

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // 过期
    }

    return payload;
  } catch {
    return null;
  }
}

// 5. 从请求中提取 Token
export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
}
