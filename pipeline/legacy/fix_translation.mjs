import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  let fixed = false;
  for (let i = 0; i < db.length; i++) {
    if (db[i].id === "q_2_49_1") {
      db[i].translation = "这个食谱要求你把酱汁煮十分钟，以使其味道更浓郁。";
      fixed = true;
      break;
    }
  }
  
  if (fixed) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
    console.log("Fixed translation for q_2_49_1.");
  }
} catch (e) {
  console.error("Error:", e);
}
