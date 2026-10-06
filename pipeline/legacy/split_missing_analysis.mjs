import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
const scratchDir = "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch";

try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  const missingAnalysisQuestions = [];
  
  for (let q of db) {
    if (!q.distractor_analysis || Object.keys(q.distractor_analysis).length === 0) {
      missingAnalysisQuestions.push({
        id: q.id,
        group_name: q.group_name,
        question: q.question,
        options: q.options,
        answer: q.answer,
        translation: q.translation
      });
    }
  }

  console.log(`Found ${missingAnalysisQuestions.length} questions missing analysis.`);

  const chunkSize = 20;
  for (let i = 0; i < 5; i++) {
    const chunk = missingAnalysisQuestions.slice(i * chunkSize, (i + 1) * chunkSize);
    const outFile = path.join(scratchDir, `missing_analysis_chunk_${i}.json`);
    fs.writeFileSync(outFile, JSON.stringify(chunk, null, 2), 'utf-8');
    console.log(`Wrote ${chunk.length} questions to missing_analysis_chunk_${i}.json`);
  }

} catch (e) {
  console.error("Error:", e);
}
