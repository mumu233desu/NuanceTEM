import fs from 'fs';
import path from 'path';

// 豆英语题库物理分包与自解释 ID 迁移器
const PREPOSITIONS = new Set(['to', 'with', 'by', 'from', 'for', 'of', 'in', 'on', 'at', 'against', 'into', 'upon']);

function detectMechanism(q) {
  if (q.primary_mechanism) {
    const map = {
      'MECH_COLLOCATION': { mechCode: 'col', mechanism: 'MECH_COLLOCATION', note: q.anchor_clue || '题干在句法结构、及物性或介词搭配习惯上存在严格限制。' },
      'MECH_CONNOTATION': { mechCode: 'pro', mechanism: 'MECH_CONNOTATION', note: q.anchor_clue || '词汇带有强烈的语篇情感色彩或语义韵（积极/消极），在语境感情色彩上互斥。' },
      'MECH_REGISTER': { mechCode: 'reg', mechanism: 'MECH_REGISTER', note: q.anchor_clue || '考查词汇所属的交际语域与正式度差异（学术公文/法律专有 vs 通用中性表达）。' },
      'MECH_NUANCE': { mechCode: 'nua', mechanism: 'MECH_NUANCE', note: q.anchor_clue || '核心概念相近，重点考查动作力度深浅、局部调整 vs 全面更替或具体特指范围差异。' }
    };
    if (map[q.primary_mechanism]) {
      return map[q.primary_mechanism];
    }
  }

  const text = q.question.toLowerCase();
  const analysisText = Object.values(q.distractor_analysis || {}).join(' ').toLowerCase();

  // 1. 介词与搭配检测: 题干空后紧跟介词，或解析明确强调搭配/及物性
  const blankMatch = text.match(/___\s+([a-z]+)/);
  if (blankMatch && PREPOSITIONS.has(blankMatch[1])) {
    return {
      mechCode: 'col',
      mechanism: 'MECH_COLLOCATION',
      note: `题干空后紧跟介词 "${blankMatch[1]}"，考查固定动介/形介搭配约束。`
    };
  }
  if (analysisText.includes('后接') || analysisText.includes('搭配') || analysisText.includes('及物') || analysisText.includes('不及物')) {
    return {
      mechCode: 'col',
      mechanism: 'MECH_COLLOCATION',
      note: '选项在句法结构、及物性或介词搭配习惯上存在严格限制。'
    };
  }

  // 2. 感情色彩与褒贬检测
  if (analysisText.includes('褒义') || analysisText.includes('贬义') || analysisText.includes('消极') || 
      analysisText.includes('负面') || analysisText.includes('恶意') || analysisText.includes('美德') ||
      analysisText.includes('抹黑') || analysisText.includes('固执') || analysisText.includes('贬低')) {
    return {
      mechCode: 'pro',
      mechanism: 'MECH_CONNOTATION',
      note: '词汇带有强烈的语篇情感色彩或语义韵（积极/消极），在语境感情色彩上互斥。'
    };
  }

  // 3. 语境庄谐与正式度检测
  if (analysisText.includes('正式') || analysisText.includes('公文') || analysisText.includes('学术') || 
      analysisText.includes('口语') || analysisText.includes('庄重') || analysisText.includes('法庭') ||
      analysisText.includes('书面语') || analysisText.includes('罕见') || analysisText.includes('语体')) {
    return {
      mechCode: 'reg',
      mechanism: 'MECH_REGISTER',
      note: '考查词汇所属的交际语域与正式度差异（学术公文/法律专有 vs 通用中性表达）。'
    };
  }

  // 4. 默认：词义侧重与深浅
  return {
    mechCode: 'nua',
    mechanism: 'MECH_NUANCE',
    note: '核心概念相近，重点考查动作力度深浅、局部调整 vs 全面更替或具体特指范围差异。'
  };
}

function detectField(q) {
  if (q.field) {
    return q.field;
  }
  const allText = (q.group_name + ' ' + q.question + ' ' + q.translation).toLowerCase();

  if (/change|alter|modify|transform|vary|increase|decrease|reduce|decline|diminish|alleviate|mitigate|palliate|soothe|fluctuat|deteriorat|expand|contract|grow|drop|fall/.test(allText)) {
    return 'FIELD_CHANGE';
  }
  if (/disparag|denigrat|belittl|deprecat|prais|critic|condemn|support|defend|vindicat|disput|challeng|contest|impugn|object|approv|blam|accuse/.test(allText)) {
    return 'FIELD_STANCE';
  }
  if (/comply|adhere|conform|abide|acquit|absolv|exonerat|law|rule|court|order|prohibit|forbid|ban|duty|obligat|punish|crime|penalty/.test(allText)) {
    return 'FIELD_RELATION';
  }
  if (/persist|persever|assidu|diligent|sedul|industri|attempt|strive|endeavor|hesitat|refus|yield|surrender|profligat|extravagan|prodigal|labor|effort/.test(allText)) {
    return 'FIELD_BEHAVIOR';
  }
  if (/ephemeral|transient|fleeting|evanescent|pervasiv|ubiquit|omnipresent|widespread|frequent|seldom|rare|often|period|duration|last|remain|exist/.test(allText)) {
    return 'FIELD_NATURE';
  }
  return 'FIELD_COGNITION';
}

function runMigration() {
  const dataDir = path.resolve('public/data');
  const tem4Dir = path.join(dataDir, 'tem4');
  const tem8Dir = path.join(dataDir, 'tem8');

  fs.mkdirSync(tem4Dir, { recursive: true });
  fs.mkdirSync(tem8Dir, { recursive: true });

  const idMapping = {}; // old_id -> new_id

  // 1. 处理专四题库
  const tem4SourcePath = fs.existsSync(path.join(dataDir, 'questions_tem4.json'))
    ? path.join(dataDir, 'questions_tem4.json')
    : path.join(dataDir, 'questions.json');
  
  const rawTem4 = JSON.parse(fs.readFileSync(tem4SourcePath, 'utf8').replace(/^\uFEFF/, ''));

  const tem4Buckets = {
    col: [],
    pro: [],
    reg: [],
    nua: []
  };

  rawTem4.forEach(q => {
    const { mechCode, mechanism, note } = detectMechanism(q);
    const field = detectField(q);
    const index = (tem4Buckets[mechCode].length + 1).toString().padStart(3, '0');
    const newId = `tem4_${mechCode}_${index}`;

    idMapping[q.id] = newId;

    tem4Buckets[mechCode].push({
      ...q,
      id: newId,
      level: 'TEM-4',
      field,
      mechanism,
      taxonomy_notes: note,
      legacy_id: q.id
    });
  });

  // 2. 处理专八题库
  const tem8SourcePath = path.join(dataDir, 'questions_tem8.json');
  const rawTem8 = fs.existsSync(tem8SourcePath)
    ? JSON.parse(fs.readFileSync(tem8SourcePath, 'utf8').replace(/^\uFEFF/, ''))
    : [];

  const tem8Buckets = {
    col: [],
    pro: [],
    reg: [],
    nua: []
  };

  rawTem8.forEach(q => {
    const { mechCode, mechanism, note } = detectMechanism(q);
    const field = detectField(q);
    const index = (tem8Buckets[mechCode].length + 1).toString().padStart(3, '0');
    const newId = `tem8_${mechCode}_${index}`;

    idMapping[q.id] = newId;

    tem8Buckets[mechCode].push({
      ...q,
      id: newId,
      level: 'TEM-8',
      field,
      mechanism,
      taxonomy_notes: note,
      legacy_id: q.id
    });
  });

  // 3. 写入各个考点独立分包文件
  const writeBuckets = (dir, buckets) => {
    fs.writeFileSync(path.join(dir, 'collocation.json'), JSON.stringify(buckets.col, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'connotation.json'), JSON.stringify(buckets.pro, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'register.json'), JSON.stringify(buckets.reg, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'nuance.json'), JSON.stringify(buckets.nua, null, 2), 'utf8');
  };

  writeBuckets(tem4Dir, tem4Buckets);
  writeBuckets(tem8Dir, tem8Buckets);

  // 4. 生成统一的 manifest.json
  const manifest = {
    version: '2026.10.09',
    updated_at: Date.now(),
    packages: {
      tem4: {
        collocation: { path: 'tem4/collocation.json', count: tem4Buckets.col.length, label: '介词与句式搭配' },
        connotation: { path: 'tem4/connotation.json', count: tem4Buckets.pro.length, label: '感情色彩与褒贬' },
        register: { path: 'tem4/register.json', count: tem4Buckets.reg.length, label: '语境庄谐与文体' },
        nuance: { path: 'tem4/nuance.json', count: tem4Buckets.nua.length, label: '词义侧重与深浅' },
        total_count: rawTem4.length
      },
      tem8: {
        collocation: { path: 'tem8/collocation.json', count: tem8Buckets.col.length, label: '介词与句式搭配' },
        connotation: { path: 'tem8/connotation.json', count: tem8Buckets.pro.length, label: '感情色彩与褒贬' },
        register: { path: 'tem8/register.json', count: tem8Buckets.reg.length, label: '语境庄谐与文体' },
        nuance: { path: 'tem8/nuance.json', count: tem8Buckets.nua.length, label: '词义侧重与深浅' },
        total_count: rawTem8.length
      }
    }
  };

  fs.writeFileSync(path.join(dataDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'id_mapping.json'), JSON.stringify(idMapping, null, 2), 'utf8');

  console.log('Migration completed successfully!');
  console.log('TEM-4 Distribution:', {
    collocation: tem4Buckets.col.length,
    connotation: tem4Buckets.pro.length,
    register: tem4Buckets.reg.length,
    nuance: tem4Buckets.nua.length,
    total: rawTem4.length
  });
  console.log('TEM-8 Distribution:', {
    collocation: tem8Buckets.col.length,
    connotation: tem8Buckets.pro.length,
    register: tem8Buckets.reg.length,
    nuance: tem8Buckets.nua.length,
    total: rawTem8.length
  });
}

runMigration();
