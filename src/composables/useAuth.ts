import { ref, computed } from 'vue';

export interface User {
  id: string;
  email: string;
  nickname: string;
  createdAt?: number;
}

const TOKEN_KEY = 'nuancetem_auth_token';
const USER_KEY = 'nuancetem_auth_user';

const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
const user = ref<User | null>(
  localStorage.getItem(USER_KEY) ? JSON.parse(localStorage.getItem(USER_KEY)!) : null
);

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  const setAuth = (newToken: string, newUser: User) => {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const clearAuth = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const register = async (email: string, password: string, nickname?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    setAuth(data.token, data.user);
    return data;
  };

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    setAuth(data.token, data.user);
    return data;
  };

  const logout = () => {
    clearAuth();
  };

  const requestPasswordReset = async (email: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  };

  const confirmPasswordReset = async (tokenStr: string, newPassword: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', token: tokenStr, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '重置失败');
    return data;
  };

  const refreshProfile = async () => {
    if (!token.value) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      });
      if (res.ok) {
        const data = await res.json();
        user.value = data.user;
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } else if (res.status === 401) {
        clearAuth();
      }
    } catch {
      // 离线时忽略
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    register,
    login,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
    refreshProfile,
  };
}
