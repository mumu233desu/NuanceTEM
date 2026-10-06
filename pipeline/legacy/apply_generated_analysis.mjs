import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');

const filesToMerge = [
  "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\42c7253a-dba3-4ae7-8b91-0046183a1c61\\scratch\\generated_analysis_0.json",
  "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\2e08323e-b163-4796-a587-52ec18ad42af\\scratch\\generated_analysis_1.json",
  "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\995a9989-3d87-483a-8d05-fa92d6d7099c\\scratch\\generated_analysis_2.json",
  "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\eb0c25e2-0a6a-4d1a-a837-b28b56e7177e\\scratch\\generated_analysis_3.json",
  "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\56a8c110-2d87-4fb9-baa1-eb9bfe2efe72\\scratch\\generated_analysis_4.json"
];

try {
  let db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  const analysisMap = new Map();

  for (const file of filesToMerge) {
    if (fs.existsSync(file)) {
      let raw = fs.readFileSync(file, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const data = JSON.parse(raw);
      
      for (const item of data) {
        if (item.id && item.distractor_analysis) {
          analysisMap.set(item.id, item.distractor_analysis);
        }
      }
    } else {
      console.log("File not found:", file);
    }
  }

  let mergedCount = 0;
  for (let q of db) {
    if (analysisMap.has(q.id)) {
      q.distractor_analysis = analysisMap.get(q.id);
      mergedCount++;
    }
  }

  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`Successfully applied ${mergedCount} analyses to the database.`);

} catch (e) {
  console.error("Error applying analyses:", e);
}
