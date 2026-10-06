import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');

try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  let modified = false;

  for (let q of db) {
    if (q.question.includes('The driver had to') && q.question.includes('to the police that he caused the accident')) {
      console.log('Found question:', q.question);
      console.log('Old answer:', q.answer);
      q.answer = 'confess';
      console.log('New answer:', q.answer);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
    console.log('✅ 修正成功并已保存到 questions.json');
  } else {
    console.log('⚠️ 未找到对应的题目');
  }

} catch (e) {
  console.error(e);
}
