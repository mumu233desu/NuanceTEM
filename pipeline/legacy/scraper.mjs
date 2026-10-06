import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const urlsFile = "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch\\koolearn_urls.txt";
const outputFile = path.join(process.cwd(), 'koolearn_tutorials.json');

// 创建一个命令行交互接口，用于阻塞等待用户手动解决验证码
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

// 1. 读取所有待爬取的 URL
const allUrls = fs.readFileSync(urlsFile, 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0 && !l.includes('806504.html'));

// 2. 检查本地是否已有历史爬取记录
let results = [];
let existingUrls = new Set();
if (fs.existsSync(outputFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    results = Array.isArray(data) ? data : [];
    results.forEach(item => existingUrls.add(item.url));
    console.log(`检测到本地已有 ${results.length} 条历史记录，将跳过已爬取的页面。`);
  } catch (e) {
    console.log('读取历史文件失败，将从头开始。');
  }
}

// 3. 过滤掉已经爬取过的 URL
const urlsToScrape = allUrls.filter(url => !existingUrls.has(url));
console.log(`准备爬取剩余未抓取的网页教程，共计 ${urlsToScrape.length} 个页面`);

(async () => {
  if (urlsToScrape.length === 0) {
    console.log('\n✅ 所有网页都已爬取完毕！');
    process.exit(0);
  }

  // 使用有头模式（真实浏览器）
  const browser = await chromium.launch({ headless: false }); 
  const page = await browser.newPage();
  
  for (let i = 0; i < urlsToScrape.length; i++) {
    const url = urlsToScrape[i];
    console.log(`\n[${i + 1}/${urlsToScrape.length}] 正在抓取: ${url}`);
    
    let success = false;
    
    // 【反爬阻断机制】：如果抓取失败，进入循环等待用户手动解决，而不是直接跳过
    while (!success) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // 尝试等待正文元素出现，如果10秒内没出现，可能就是遇到反爬验证码或被封IP了
        try {
          await page.waitForSelector('.xqy_core_text, .article-content', { timeout: 10000 });
        } catch (e) {
          throw new Error("页面加载完毕，但未能找到正文模块。可能是遇到了反爬虫验证。");
        }
        
        // 提取所需信息
        const content = await page.evaluate(() => {
          const titleEl = document.querySelector('title');
          const title = titleEl ? titleEl.innerText.split('_')[0] : '';
          
          const coreTextEl = document.querySelector('.xqy_core_text') || document.querySelector('.article-content');
          if (!coreTextEl) return null;
          
          return {
            title: title,
            text: coreTextEl.innerText
          };
        });
        
        if (content && content.text.length > 50) {
          results.push({ url, title: content.title, content: content.text });
          console.log(`  -> 成功抓取: ${content.title}`);
          
          // 增量保存
          fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
          success = true; // 抓取成功，跳出 while 循环
        } else {
          throw new Error("正文内容过短或为空。");
        }
      } catch (err) {
        console.log(`  ❌ 抓取异常: ${err.message}`);
        console.log(`  ⚠️ 爬虫已暂停！请在弹出的浏览器窗口中查看是否遇到验证码，或尝试切换代理/IP。`);
        
        // 阻塞程序执行，等待用户在终端中按下回车
        await askQuestion('  👉 解决问题后，请在此控制台中按下【回车键】重试当前页面 (或者按 Ctrl+C 退出)...');
        console.log('  🔄 正在重新尝试抓取当前页面...');
      }
    }
    
    // 【限流防封机制】：每次成功抓取完毕随机等待 2 到 4 秒
    const delay = Math.floor(Math.random() * 2000) + 2000;
    console.log(`  [防封限流] 等待 ${delay} 毫秒...`);
    await page.waitForTimeout(delay);
  }
  
  await browser.close();
  console.log('\n✅ 剩余任务爬取完毕！已保存至 koolearn_tutorials.json');
  process.exit(0);
})();
