import fs from 'fs';
import path from 'path';

const dbFile = path.join(process.cwd(), 'public', 'data', 'questions.json');
const scratchDir = path.join("C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch");

try {
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  const chunks = 5;
  const chunkSize = Math.ceil(db.length / chunks);
  
  for (let i = 0; i < chunks; i++) {
    const chunkData = db.slice(i * chunkSize, (i + 1) * chunkSize);
    const outFile = path.join(scratchDir, `audit_chunk_${i}.json`);
    fs.writeFileSync(outFile, JSON.stringify(chunkData, null, 2), 'utf-8');
    console.log(`Saved audit_chunk_${i}.json with ${chunkData.length} items.`);
  }
} catch (e) {
  console.error("Error splitting:", e);
}
