<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useSync } from '../composables/useSync';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  initialToken?: string;
}>(), {
  initialMode: 'login',
  initialToken: '',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'authenticated'): void;
}>();

const { login, register, requestPasswordReset, confirmPasswordReset, sendVerificationCode } = useAuth();
const { syncNow } = useSync();

type Mode = 'login' | 'register' | 'forgot' | 'reset';
const mode = ref<Mode>(props.initialMode || 'login');

const email = ref('');
const password = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const resetToken = ref(props.initialToken || '');
const nickname = ref('');
const verificationCode = ref('');
const isSendingCode = ref(false);
const countdown = ref(0);
let countdownTimer: any = null;

const isLoading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const resetForm = () => {
  errorMsg.value = '';
  successMsg.value = '';
  verificationCode.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
};

const switchMode = (newMode: Mode) => {
  mode.value = newMode;
  resetForm();
};

watch(() => props.initialMode, (newVal) => {
  if (newVal) mode.value = newVal;
});

watch(() => props.initialToken, (newVal) => {
  if (newVal !== undefined) resetToken.value = newVal;
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.initialMode) mode.value = props.initialMode;
    if (props.initialToken) resetToken.value = props.initialToken;
    resetForm();
  }
});

const handleClose = () => {
  if (window.location.hash.includes('reset-password')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  emit('close');
};

const handleSendCode = async () => {
  const emailVal = email.value.trim().toLowerCase();
  if (!emailVal || !emailVal.includes('@')) {
    errorMsg.value = '请先输入有效的电子邮箱地址';
    return;
  }

  errorMsg.value = '';
  successMsg.value = '';
  isSendingCode.value = true;

  try {
    const res = await sendVerificationCode(emailVal, 'register');
    successMsg.value = res.message || '验证码已发送至您的邮箱，请查收！';
    countdown.value = 60;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
  } catch (err: any) {
    errorMsg.value = err.message || '发送验证码失败，请重试';
  } finally {
    isSendingCode.value = false;
  }
};

const handleSubmit = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  isLoading.value = true;

  try {
    if (mode.value === 'login') {
      await login(email.value, password.value);
      await syncNow();
      emit('authenticated');
      emit('close');
    } else if (mode.value === 'register') {
      if (!verificationCode.value.trim()) {
        errorMsg.value = '请输入 6 位邮箱验证码';
        isLoading.value = false;
        return;
      }
      await register(email.value, password.value, verificationCode.value.trim(), nickname.value);
      await syncNow();
      emit('authenticated');
      emit('close');
    } else if (mode.value === 'forgot') {
      const res = await requestPasswordReset(email.value);
      successMsg.value = res.message || '重置指令已发送至您的邮箱，请查收！';
    } else if (mode.value === 'reset') {
      if (!resetToken.value) {
        errorMsg.value = '缺少重置令牌或链接不完整，请重新申请找回密码';
        isLoading.value = false;
        return;
      }
      if (!newPassword.value || newPassword.value.length < 6) {
        errorMsg.value = '新密码长度至少需要 6 位字符';
        isLoading.value = false;
        return;
      }
      if (newPassword.value !== confirmPassword.value) {
        errorMsg.value = '两次输入的新密码不一致，请核对后重试';
        isLoading.value = false;
        return;
      }

      const res = await confirmPasswordReset(resetToken.value, newPassword.value);
      successMsg.value = res.message || '密码重置成功！正在为您跳转至登录...';
      if (window.location.hash.includes('reset-password')) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setTimeout(() => {
        password.value = '';
        switchMode('login');
      }, 1500);
    }
  } catch (err: any) {
    errorMsg.value = err.message || '操作失败，请重试';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop fade-in" @click.self="handleClose">
    <div class="auth-card glass-card scale-in">
      <button class="close-btn" @click="handleClose" aria-label="关闭">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="header">
        <div class="logo-mark">N</div>
        <h3>
          {{ mode === 'login' ? '登录 NuanceTEM 云端同步' : mode === 'register' ? '注册新学习账号' : mode === 'forgot' ? '找回密码' : '设置新密码' }}
        </h3>
        <p class="subtitle">
          {{ mode === 'login' ? '多设备实时漫游记忆曲线，复习进度永不丢失' : mode === 'register' ? '加入专业英语近义词辨析计划' : mode === 'forgot' ? '输入您的注册邮箱以获取重置链接' : '请为您的 NuanceTEM 账号设定一个新的安全密码' }}
        </p>
      </div>

      <div v-if="errorMsg" class="alert error">
        {{ errorMsg }}
      </div>
      <div v-if="successMsg" class="alert success">
        {{ successMsg }}
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- 重置新密码模式 -->
        <template v-if="mode === 'reset'">
          <div class="form-group">
            <label>新密码</label>
            <input
              v-model="newPassword"
              type="password"
              required
              minlength="6"
              placeholder="至少 6 位新密码"
              class="input-field"
            />
          </div>
          <div class="form-group">
            <label>确认新密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              minlength="6"
              placeholder="请再次输入新密码"
              class="input-field"
            />
          </div>
        </template>

        <!-- 常规模式：登录 / 注册 / 找回密码 -->
        <template v-else>
          <div v-if="mode === 'register'" class="form-group">
            <label>昵称 (可选)</label>
            <input v-model="nickname" type="text" placeholder="你的学习代号" class="input-field" />
          </div>

          <div class="form-group">
            <label>电子邮箱</label>
            <input v-model="email" type="email" required placeholder="your.name@example.com" class="input-field" />
          </div>

          <div v-if="mode === 'register'" class="form-group">
            <label>邮箱验证码</label>
            <div class="code-input-row">
              <input
                v-model="verificationCode"
                type="text"
                required
                maxlength="6"
                placeholder="6 位验证码"
                class="input-field code-input"
              />
              <button
                type="button"
                class="send-code-btn"
                :disabled="isSendingCode || countdown > 0"
                @click="handleSendCode"
              >
                <span v-if="isSendingCode" class="mini-spinner"></span>
                <span v-else>{{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}</span>
              </button>
            </div>
          </div>

          <div v-if="mode !== 'forgot'" class="form-group">
            <div class="label-row">
              <label>密码</label>
              <a v-if="mode === 'login'" href="#" @click.prevent="switchMode('forgot')" class="forgot-link">忘记密码？</a>
            </div>
            <input v-model="password" type="password" required minlength="6" placeholder="至少 6 位字符" class="input-field" />
          </div>
        </template>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>{{ mode === 'login' ? '立即登录' : mode === 'register' ? '创建账号并同步' : mode === 'forgot' ? '发送重置邮件' : '确认重置新密码' }}</span>
        </button>
      </form>

      <div class="footer">
        <template v-if="mode === 'login'">
          <span>还没有账号？</span>
          <a href="#" @click.prevent="switchMode('register')">免费注册</a>
        </template>
        <template v-else-if="mode === 'reset'">
          <span>想起来了？</span>
          <a href="#" @click.prevent="switchMode('login')">返回登录</a>
        </template>
        <template v-else>
          <span>已有账号？</span>
          <a href="#" @click.prevent="switchMode('login')">返回登录</a>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.auth-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.close-btn {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  background: transparent;
  color: var(--text-muted);
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: var(--text-main);
  background: var(--border-color);
}

.header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.logo-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  box-shadow: 0 4px 14px var(--primary-light);
  margin-bottom: 0.25rem;
}

.header h3 {
  font-size: 1.25rem;
  color: var(--text-main);
  margin: 0;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}
.alert.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
  border: 1px solid var(--error);
}
.alert.success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
  border: 1px solid var(--success);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.forgot-link {
  font-size: 0.75rem;
  color: var(--primary);
  text-decoration: none;
}
.forgot-link:hover {
  text-decoration: underline;
}

.input-field {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-app);
  color: var(--text-main);
  font-size: 0.95rem;
  transition: all 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.code-input-row {
  display: flex;
  gap: 0.5rem;
}

.code-input {
  flex: 1;
  letter-spacing: 3px;
  font-family: var(--font-mono, monospace);
  font-weight: 600;
}

.send-code-btn {
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--primary);
  background: var(--primary-light);
  color: var(--primary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 105px;
}

.send-code-btn:hover:not(:disabled) {
  background: var(--primary);
  color: var(--text-on-primary);
}

.send-code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  border-color: var(--border-color);
  color: var(--text-muted);
}

.mini-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.submit-btn {
  margin-top: 0.5rem;
  padding: 0.85rem;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-on-primary);
  font-weight: 700;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.submit-btn:hover:not(:disabled) {
  opacity: 0.95;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--primary-light);
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.footer {
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.footer a {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
}
.footer a:hover {
  text-decoration: underline;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
