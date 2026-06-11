import fs from 'fs';
import path from 'path';

function searchInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchInDir(fullPath);
    } else if (fullPath.endsWith('.vue') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("status: 'new'")) {
        console.log("\n---", fullPath, "---");
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes("status: 'new'")) {
            for (let j = Math.max(0, i-2); j <= Math.min(lines.length-1, i+6); j++) {
              console.log(`${j+1}: ${lines[j]}`);
            }
          }
        });
      }
    }
  }
}

searchInDir(path.join(process.cwd(), 'src'));
