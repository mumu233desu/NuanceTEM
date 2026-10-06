import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  for (let i = 0; i < db.length; i++) {
    const q = db[i];
    if (!q.target_word || !q.group_name || !q.translation || !q.question) {
      console.log(`Missing field in question index ${i}, id ${q.id}`);
      console.log('q.target_word:', q.target_word);
      console.log('q.group_name:', q.group_name);
      console.log('q.translation:', q.translation);
      console.log('q.question:', q.question);
    }
  }
  console.log("Check complete.");
} catch (e) {
  console.error("Error:", e);
}
