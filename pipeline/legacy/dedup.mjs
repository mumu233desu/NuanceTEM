import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');

try {
  const existingDb = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  
  // Deduplicate by question text
  const uniqueQuestions = [];
  const seenQuestionText = new Set();
  
  existingDb.forEach(q => {
    if (!seenQuestionText.has(q.question)) {
      seenQuestionText.add(q.question);
      uniqueQuestions.push(q);
    }
  });

  fs.writeFileSync(dbFile, JSON.stringify(uniqueQuestions, null, 2), 'utf-8');
  console.log(`✅ 去重完成！当前总题量: ${uniqueQuestions.length} 道题`);

} catch (e) {
  console.error("去重出错: ", e);
}
