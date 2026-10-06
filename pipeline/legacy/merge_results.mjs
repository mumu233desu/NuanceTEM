import fs from 'fs';
import path from 'path';

const scratchDir = path.join("C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch");
const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');

try {
  let allNewQuestions = [];

  // Read the 6 result files
  for (let i = 0; i < 6; i++) {
    const resultFile = path.join(scratchDir, `result_${i}.json`);
    if (fs.existsSync(resultFile)) {
      let rawData = fs.readFileSync(resultFile, 'utf-8');
      // Strip BOM
      if (rawData.charCodeAt(0) === 0xFEFF) {
        rawData = rawData.slice(1);
      }
      const data = JSON.parse(rawData);
      allNewQuestions = allNewQuestions.concat(data);
      console.log(`Loaded result_${i}.json with ${data.length} questions`);
    } else {
      console.log(`Warning: result_${i}.json not found!`);
    }
  }

  // Ensure IDs are unique and add them to the existing database
  const existingDb = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  const existingIds = new Set(existingDb.map(q => q.id));

  allNewQuestions.forEach(q => {
    // Basic validation
    if (!q.id) {
      q.id = 'q_' + Math.random().toString(36).substr(2, 6);
    }
    // Prevent ID collision
    while (existingIds.has(q.id)) {
      q.id = 'q_' + Math.random().toString(36).substr(2, 6);
    }
    existingIds.add(q.id);
    existingDb.push(q);
  });

  fs.writeFileSync(dbFile, JSON.stringify(existingDb, null, 2), 'utf-8');
  console.log(`\n✅ 成功将 ${allNewQuestions.length} 道新题合并至 src/db/questions.json`);
  console.log(`当前总题量: ${existingDb.length} 道题`);

} catch (e) {
  console.error("合并出错: ", e);
}
