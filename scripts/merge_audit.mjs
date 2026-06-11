import fs from 'fs';
import path from 'path';

const scratchDir = "C:\\Users\\mumu\\.gemini\\antigravity\\brain\\d20b70b8-3169-4c7c-b0d8-3a15cab8c6fd\\scratch";
let merged = [];

try {
  for (let i = 0; i < 5; i++) {
    const reportFile = path.join(scratchDir, `audit_report_${i}.json`);
    if (fs.existsSync(reportFile)) {
      let raw = fs.readFileSync(reportFile, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        merged = merged.concat(data);
        console.log(`Loaded ${data.length} issues from audit_report_${i}.json`);
      }
    } else {
      console.log(`Warning: audit_report_${i}.json not found!`);
    }
  }

  const outFile = path.join(scratchDir, 'merged_audit_reports.json');
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`Merged ${merged.length} total issues into merged_audit_reports.json`);

} catch (e) {
  console.error("Error merging:", e);
}
