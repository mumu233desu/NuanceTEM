import fs from 'fs';
import path from 'path';

const inputFile = path.join(process.cwd(), 'koolearn_tutorials.json');
const scratchDir = path.join("C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch");

try {
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const chunks = 6;
  const chunkSize = Math.ceil(data.length / chunks);

  for (let i = 0; i < chunks; i++) {
    const chunkData = data.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunkData.length > 0) {
      fs.writeFileSync(path.join(scratchDir, `chunk_${i}.json`), JSON.stringify(chunkData, null, 2));
      console.log(`Saved chunk_${i}.json with ${chunkData.length} items`);
    }
  }
} catch (e) {
  console.error(e);
}
