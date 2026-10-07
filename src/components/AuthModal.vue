<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useSync } from '../composables/useSync';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'authenticated'): void;
}>();

const { login, register, requestPasswordReset } = useAuth();
const { syncNow } = useSync();

type Mode = 'login' | 'register' | 'forgot';
const mode = ref<Mode>('login');

const email = ref('');
const password = ref('');
const nickname = ref('');
const isLoading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const resetForm = () => {
  errorMsg.value = '';
  successMsg.value = '';
};

const switchMode = (newMode: Mode) => {
  mode.value = newMode;
  resetForm();
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
      await register(email.value, password.value, nickname.value);
      await syncNow();
      emit('authenticated');
      emit('close');
    } else if (mode.value === 'forgot') {
      const res = await requestPasswordReset(email.value);
      successMsg.value = res.message || '重置指令已发送至您的邮箱，请查收！';
    }
  } catch (err: any) {
    errorMsg.value = err.message || '操作失败，请重试';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop fade-in" @click.self="emit('close')">
    <div class="auth-card glass-card scale-in">
      <button class="close-btn" @click="emit('close')" aria-label="关闭">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="header">
        <div class="logo-mark">N</div>
        <h3>
          {{ mode === 'login' ? '登录 NuanceTEM 云端同步' : mode === 'register' ? '注册新学习账号' : '找回密码' }}
        </h3>
        <p class="subtitle">
          {{ mode === 'login' ? '多设备实时漫游记忆曲线，复习进度永不丢失' : mode === 'register' ? '加入专业英语近义词辨析计划' : '输入您的注册邮箱以获取重置链接' }}
        </p>
      </div>

      <div v-if="errorMsg" class="alert error">
        {{ errorMsg }}
      </div>
      <div v-if="successMsg" class="alert success">
        {{ successMsg }}
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="mode === 'register'" class="form-group">
          <label>昵称 (可选)</label>
          <input v-model="nickname" type="text" placeholder="你的学习代号" class="input-field" />
        </div>

        <div class="form-group">
          <label>电子邮箱</label>
          <input v-model="email" type="email" required placeholder="your.name@example.com" class="input-field" />
        </div>

        <div v-if="mode !== 'forgot'" class="form-group">
          <div class="label-row">
            <label>密码</label>
            <a v-if="mode === 'login'" href="#" @click.prevent="switchMode('forgot')" class="forgot-link">忘记密码？</a>
          </div>
          <input v-model="password" type="password" required minlength="6" placeholder="至少 6 位字符" class="input-field" />
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>{{ mode === 'login' ? '立即登录' : mode === 'register' ? '创建账号并同步' : '发送重置邮件' }}</span>
        </button>
      </form>

      <div class="footer">
        <template v-if="mode === 'login'">
          <span>还没有账号？</span>
          <a href="#" @click.prevent="switchMode('register')">免费注册</a>
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
