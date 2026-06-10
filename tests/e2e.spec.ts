import { test, expect } from '@playwright/test';

test.describe('NuanceTEM Visual & E2E Testing', () => {
  
  test('Dashboard and Navigation Layout Test', async ({ page }) => {
    // 1. 访问首页
    await page.goto('/');

    // 验证 Dashboard 是否加载，并检查主标题
    await expect(page.locator('h1')).toContainText('Welcome to NuanceTEM');
    
    // 你可以使用 toHaveScreenshot() 来做视觉回归测试（Visual Regression Testing）
    // 第一次运行会生成基准图片，后续运行会比较是否发生了像素级的差异
    // await expect(page).toHaveScreenshot('dashboard.png');

    // 2. 导航到 Quiz 页面
    // 点击导航栏中的中文文本
    await page.click('text=词汇挑战');
    // 验证页面的 h2 标题
    await expect(page.locator('h2').first()).toContainText('每日词辨挑战');

    // 3. 导航到 Review 页面
    await page.click('text=智能复习');
    // 验证页面的 h2 标题
    await expect(page.locator('h2').first()).toContainText('Spaced Repetition 复习面板');

    // 如果你想在测试中间暂停下来，手动去检查布局或者调试 CSS，可以取消注释下面这行代码：
    // await page.pause();
  });

});
