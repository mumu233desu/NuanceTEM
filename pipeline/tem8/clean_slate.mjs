import fs from 'fs';
import path from 'path';

const dataDir = path.resolve('public/data');
const tem8Dir = path.join(dataDir, 'tem8');

// 1. 清空 questions_tem8.json
fs.writeFileSync(path.join(dataDir, 'questions_tem8.json'), '[]\n', 'utf8');

// 2. 清空 tem8 分包
['collocation.json', 'connotation.json', 'register.json', 'nuance.json'].forEach(file => {
  fs.writeFileSync(path.join(tem8Dir, file), '[]\n', 'utf8');
});

// 3. 更新 manifest.json
const manifestPath = path.join(dataDir, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = '2026.10.08.reset';
  manifest.updated_at = Date.now();
  manifest.packages.tem8 = {
    collocation: { path: 'tem8/collocation.json', count: 0, label: '介词与句式搭配' },
    connotation: { path: 'tem8/connotation.json', count: 0, label: '感情色彩与褒贬' },
    register: { path: 'tem8/register.json', count: 0, label: '语境庄谐与文体' },
    nuance: { path: 'tem8/nuance.json', count: 0, label: '词义侧重与深浅' },
    total_count: 0
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

// 4. 清理 id_mapping.json 中的 tem8 旧映射
const mappingPath = path.join(dataDir, 'id_mapping.json');
if (fs.existsSync(mappingPath)) {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const cleaned = {};
  for (const [k, v] of Object.entries(mapping)) {
    if (!k.startsWith('tem8_') && !v.startsWith('tem8_')) {
      cleaned[k] = v;
    }
  }
  fs.writeFileSync(mappingPath, JSON.stringify(cleaned, null, 2), 'utf8');
}

console.log('Step 0 Clean Slate: Successfully reset all TEM-8 questions and packages to empty!');
