import { chromium } from '@playwright/test';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000); // Wait for animations/loading
  await page.screenshot({ path: 'screenshots/dashboard.png' });
  
  await page.click('text=词汇挑战');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/quiz.png' });
  
  await page.click('text=智能复习');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/review.png' });
  
  await page.click('text=词库浏览');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/database.png' });
  
  await page.click('text=设置');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/settings.png' });

  // 移动端视图
  const mobilePage = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobilePage.goto('http://localhost:5173/');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: 'screenshots/dashboard_mobile.png' });
  await mobilePage.click('.mobile-nav-item:has-text("词汇挑战")');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: 'screenshots/quiz_mobile.png' });

  await browser.close();
  console.log('Screenshots captured in screenshots/ directory');
})();
