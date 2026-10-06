import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
const approvedFile = path.join("C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch", 'approved_changes.json');

try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  let rawApproved = fs.readFileSync(approvedFile, 'utf-8');
  if (rawApproved.charCodeAt(0) === 0xFEFF) rawApproved = rawApproved.slice(1);
  const approvedChanges = JSON.parse(rawApproved);

  const changesMap = new Map();
  for (const change of approvedChanges) {
    if (change && change.id) {
      changesMap.set(change.id, change);
    }
  }

  let updateCount = 0;
  for (let q of db) {
    const change = changesMap.get(q.id);
    if (change) {
      if (change.suggested_question) q.question = change.suggested_question;
      if (change.suggested_answer) q.answer = change.suggested_answer;
      updateCount++;
    }
  }

  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`✅ 成功应用了 ${updateCount} 处大修，保存至 questions.json。当前总题量: ${db.length} 道题。`);

} catch (e) {
  console.error("Error applying fixes:", e);
}
