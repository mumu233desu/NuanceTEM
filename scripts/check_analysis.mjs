import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  
  let missingAnalysisCount = 0;
  let partialAnalysisCount = 0;
  
  for (let q of db) {
    if (!q.distractor_analysis || Object.keys(q.distractor_analysis).length === 0) {
      missingAnalysisCount++;
      // console.log(`Question ID ${q.id} has no distractor_analysis at all.`);
    } else {
      let hasMissing = false;
      for (let opt of q.options) {
        if (!q.distractor_analysis[opt] || q.distractor_analysis[opt].trim() === '') {
          hasMissing = true;
          // console.log(`Question ID ${q.id} is missing analysis for option: ${opt}`);
        }
      }
      if (hasMissing) {
        partialAnalysisCount++;
      }
    }
  }
  
  console.log(`Total questions: ${db.length}`);
  console.log(`Questions with completely missing analysis: ${missingAnalysisCount}`);
  console.log(`Questions with partially missing analysis (some options missing): ${partialAnalysisCount}`);

} catch (e) {
  console.error("Error:", e);
}
