import fs from 'fs';
import path from 'path';

const inputFile = path.join(process.cwd(), 'koolearn_tutorials.json');

try {
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  let cleanedCount = 0;

  const cleanedData = data.map(item => {
    let originalText = item.content;
    let cleanedText = originalText;

    // Remove the title from the beginning if it matches
    if (cleanedText.startsWith(item.title)) {
      cleanedText = cleanedText.substring(item.title.length);
    }

    // Remove common advertising paragraphs
    const ads = [
      "2020专四词汇考点分为六类：专四词汇近义词辨析、形近词辨析、动词词组、词根词缀辨析、从句引导词、逻辑连词。另外专四词汇在背诵时可以根据近义词、近形词来区分记忆，新东方在线英语专四频道整理了一系列专四词汇辨析希望专四考生在复习之初夯实基础。",
      "2020专四词汇辨析汇总",
      "专四专八：历年真题免费领",
      "专四专八：精选好课 暖心助学"
    ];

    ads.forEach(ad => {
      // Create a regex to match the exact ad, allowing for whitespace variations around it
      // but simple string replace is safer
      cleanedText = cleanedText.split(ad).join('');
    });

    // Clean up excessive newlines and spaces caused by the removals
    cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n').trim();
    // Clean up leading spaces/tabs on the first line
    cleanedText = cleanedText.replace(/^[ \u3000]+/g, '');

    if (cleanedText !== originalText) {
      cleanedCount++;
    }

    return {
      ...item,
      content: cleanedText
    };
  });

  fs.writeFileSync(inputFile, JSON.stringify(cleanedData, null, 2), 'utf-8');
  console.log(`✅ 数据清洗完成！共清理了 ${cleanedCount} 条包含广告和冗余字符的数据。`);

} catch (err) {
  console.error("处理出错:", err);
}
