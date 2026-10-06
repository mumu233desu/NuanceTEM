import fs from 'fs';
import path from 'path';

// 标签与辨析机制规则推导器 (带瑕疵检测)

const PREPOSITIONS = new Set(['to', 'with', 'by', 'from', 'for', 'of', 'in', 'on', 'at', 'against', 'into', 'upon']);

function detectMechanism(q) {
  const text = q.question.toLowerCase();
  const analysisText = Object.values(q.distractor_analysis || {}).join(' ').toLowerCase();

  // 1. 介词与搭配检测: 题干空后紧跟介词，或解析明确强调搭配
  const blankMatch = text.match(/___\s+([a-z]+)/);
  if (blankMatch && PREPOSITIONS.has(blankMatch[1])) {
    return {
      mech: 'MECH_COLLOCATION',
      note: `题干空后存在强搭配介词 "${blankMatch[1]}"，重点考查动介/形介固定搭配约束。`
    };
  }
  if (analysisText.includes('后接') || analysisText.includes('搭配') || analysisText.includes('及物') || analysisText.includes('不及物')) {
    return {
      mech: 'MECH_COLLOCATION',
      note: '选项在句法结构、及物性或介词搭配习惯上存在严格限制。'
    };
  }

  // 2. 感情色彩与褒贬检测
  if (analysisText.includes('褒义') || analysisText.includes('贬义') || analysisText.includes('消极') || 
      analysisText.includes('负面') || analysisText.includes('恶意') || analysisText.includes('美德') ||
      analysisText.includes('抹黑') || analysisText.includes('固执') || analysisText.includes('贬低')) {
    return {
      mech: 'MECH_CONNOTATION',
      note: '词汇带有强烈的语篇情感色彩或语义韵（积极/消极），在语境感情色彩上互斥。'
    };
  }

  // 3. 语境庄谐与正式度检测
  if (analysisText.includes('正式') || analysisText.includes('公文') || analysisText.includes('学术') || 
      analysisText.includes('口语') || analysisText.includes('庄重') || analysisText.includes('法庭') ||
      analysisText.includes('书面语') || analysisText.includes('罕见') || analysisText.includes('语体')) {
    return {
      mech: 'MECH_REGISTER',
      note: '考查词汇所属的交际语域与正式度差异（学术公文/法律专有 vs 通用中性表达）。'
    };
  }

  // 4. 默认：词义侧重与深浅
  return {
    mech: 'MECH_NUANCE',
    note: '核心概念相近，重点考查动作力度深浅、局部调整 vs 全面更替或具体特指范围差异。'
  };
}

function detectField(q) {
  const allText = (q.group_name + ' ' + q.question + ' ' + q.translation).toLowerCase();

  // 1. 变化与态势
  if (/change|alter|modify|transform|vary|increase|decrease|reduce|decline|diminish|alleviate|mitigate|palliate|soothe|fluctuat|deteriorat|expand|contract|grow|drop|fall/.test(allText)) {
    return 'FIELD_CHANGE';
  }

  // 2. 立场与评价
  if (/disparag|denigrat|belittl|deprecat|prais|critic|condemn|support|defend|vindicat|disput|challeng|contest|impugn|object|approv|blam|accuse/.test(allText)) {
    return 'FIELD_STANCE';
  }

  // 3. 规约与社会
  if (/comply|adhere|conform|abide|acquit|absolv|exonerat|law|rule|court|order|prohibit|forbid|ban|duty|obligat|punish|crime|penalty/.test(allText)) {
    return 'FIELD_RELATION';
  }

  // 4. 意志与行事
  if (/persist|persever|assidu|diligent|sedul|industri|attempt|strive|endeavor|hesitat|refus|yield|surrender|profligat|extravagan|prodigal|labor|effort/.test(allText)) {
    return 'FIELD_BEHAVIOR';
  }

  // 5. 状态与时空
  if (/ephemeral|transient|fleeting|evanescent|pervasiv|ubiquit|omnipresent|widespread|frequent|seldom|rare|often|period|duration|last|remain|exist/.test(allText)) {
    return 'FIELD_NATURE';
  }

  // 6. 认知与思维 (默认抽象认知)
  return 'FIELD_COGNITION';
}

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const questions = JSON.parse(content);

  const stats = {
    total: questions.length,
    fields: {},
    mechs: {},
  };

  const processed = questions.map(q => {
    const { mech, note } = detectMechanism(q);
    const field = detectField(q);

    stats.fields[field] = (stats.fields[field] || 0) + 1;
    stats.mechs[mech] = (stats.mechs[mech] || 0) + 1;

    return {
      ...q,
      field,
      mechanism: mech,
      taxonomy_notes: note,
    };
  });

  fs.writeFileSync(filePath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`Processed ${filePath}:`, stats);
}

// 统一为专四、专八及总库打标
processFile(path.resolve('public/data/questions_tem4.json'));
processFile(path.resolve('public/data/questions_tem8.json'));
processFile(path.resolve('public/data/questions.json'));
