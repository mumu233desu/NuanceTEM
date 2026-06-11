import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  for (let i = 0; i < db.length; i++) {
    if (db[i].question.includes("The recipe requires you to boil the sauce for ten minutes to")) {
      console.log(`Found at index ${i}:`);
      console.log(JSON.stringify(db[i], null, 2));
      break;
    }
  }
} catch (e) {
  console.error("Error:", e);
}
