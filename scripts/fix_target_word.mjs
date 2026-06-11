import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  let fixedCount = 0;
  for (let q of db) {
    if (!q.target_word) {
      q.target_word = q.answer;
      fixedCount++;
    }
  }
  
  if (fixedCount > 0) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`Fixed ${fixedCount} questions by setting target_word = answer.`);
  } else {
    console.log("No missing target_word found.");
  }
} catch (e) {
  console.error("Error:", e);
}
