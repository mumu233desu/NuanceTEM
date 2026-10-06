import fs from 'fs';
import path from 'path';

// 专八高频核心近义词深度辨析题库构建器
// 严格遵从：
// 1. 保留关键介词/句式锚点 (Collocation Markers)
// 2. 强排他性语境 (Discriminative Context)
// 3. 详细解释每个干扰项“为什么在此语境不能选” (Distractor Exclusion Logic)

const tem8Questions = [
  // Group 1: alleviate, mitigate, palliate, soothe
  {
    id: "tem8_1_1",
    group_id: 101,
    group_name: "alleviate, mitigate, palliate, soothe",
    level: "TEM-8",
    target_word: "palliate",
    question: "The economic reform was merely a temporary compromise intended to ___ the acute social discontent rather than solve the underlying crisis.",
    options: ["alleviate", "mitigate", "palliate", "soothe"],
    answer: "palliate",
    distractor_analysis: {
      "palliate": "v. 专指“姑息、掩饰、治标不治本”，通过表面妥协来暂时缓和尖锐矛盾或病痛（后文 rather than solve 形成绝对排他）。",
      "alleviate": "v. 侧重减轻痛苦、负担或身体不适，通常是带来实质性的减负，而非治标不治本。",
      "mitigate": "v. 常用于法律、风险、气候等领域，指“减轻危害程度/降低恶劣影响”（mitigate the impact/risk）。",
      "soothe": "v. 侧重抚慰神经、平息焦虑或缓和肉体灼痛，偏向生理或感官的安抚。"
    },
    translation: "这项经济改革只是一种权宜妥协，旨在姑息缓和尖锐的社会不满情绪，而不是解决根本危机。"
  },
  {
    id: "tem8_1_2",
    group_id: 101,
    group_name: "alleviate, mitigate, palliate, soothe",
    level: "TEM-8",
    target_word: "mitigate",
    question: "The environmental agency implemented stringent carbon caps in an urgent effort to ___ the devastating consequences of global warming.",
    options: ["alleviate", "mitigate", "palliate", "soothe"],
    answer: "mitigate",
    distractor_analysis: {
      "mitigate": "v. 正式学术及政经用语，固定搭配后果、危害或风险（mitigate consequences/effects/penalties），指主动干预以降低危害严重性。",
      "alleviate": "v. 侧重于缓和已存在的沉重痛苦、贫困或紧迫症状（alleviate poverty/suffering）。",
      "palliate": "v. 指姑息疗法或敷衍塞责的遮掩，不合环保治理的政策语境。",
      "soothe": "v. 抚慰、镇定，不能搭配抽象的全球变暖灾难性后果。"
    },
    translation: "环保机构实施了严格的碳排放上限，以紧急减轻全球变暖带来的毁灭性后果。"
  },

  // Group 2: ephemeral, transient, fleeting, evanescent
  {
    id: "tem8_2_1",
    group_id: 102,
    group_name: "ephemeral, transient, fleeting, evanescent",
    level: "TEM-8",
    target_word: "evanescent",
    question: "In the chilly autumn dawn, the morning mist was as ___ as vapor, dissipating completely the moment the first rays of sunlight broke through.",
    options: ["ephemeral", "transient", "fleeting", "evanescent"],
    answer: "evanescent",
    distractor_analysis: {
      "evanescent": "adj. 侧重像蒸汽、薄雾或光影一样“逐渐消散并淡化成虚无”（结合后文 as vapor and dissipating 是绝对信号词）。",
      "ephemeral": "adj. 侧重指寿命极短（原意仅活一天的蜉蝣），常形容狂热、名气或流行文化只存在转瞬数日。",
      "transient": "adj. 侧重指人员流动、暂住或事物短暂停留后离去（如 transient guests/workers）。",
      "fleeting": "adj. 侧重速度飞快、一掠而过（如 a fleeting glimpse/smile/moment）。"
    },
    translation: "在清冷的秋日黎明，晨雾如水汽般稍纵即逝，在第一缕阳光穿透的瞬间便彻底消散。"
  },
  {
    id: "tem8_2_2",
    group_id: 102,
    group_name: "ephemeral, transient, fleeting, evanescent",
    level: "TEM-8",
    target_word: "ephemeral",
    question: "In the fast-paced age of social media, internet viral fame is notoriously ___, often vanishing after only a few days in the spotlight.",
    options: ["ephemeral", "transient", "fleeting", "evanescent"],
    answer: "ephemeral",
    distractor_analysis: {
      "ephemeral": "adj. 最常用于形容名利、潮流或热度的“生命周期极短”，如昙花一现（与后文 a few days 严密呼应）。",
      "evanescent": "adj. 强调物理上的消散隐没（如晨雾、泡沫），不用于社会热点现象。",
      "transient": "adj. 强调过境、流动性或驻留短暂。",
      "fleeting": "adj. 强调时间流逝之快或瞥视的一瞬间。"
    },
    translation: "在快节奏的社交媒体时代，网络爆红往往是众所周知的昙花一现，在聚光灯下不过停留寥寥数日便销声匿迹。"
  },

  // Group 3: disparage, denigrate, belittle, deprecate
  {
    id: "tem8_3_1",
    group_id: 103,
    group_name: "disparage, denigrate, belittle, deprecate",
    level: "TEM-8",
    target_word: "denigrate",
    question: "The political campaign took a malicious turn when the rival party launched ads designed to completely ___ the candidate's moral integrity and character.",
    options: ["disparage", "denigrate", "belittle", "deprecate"],
    answer: "denigrate",
    distractor_analysis: {
      "denigrate": "v. 词源含有“抹黑、玷污”之意，语气极重，专门搭配并攻击他人名誉、人格、品德（denigrate integrity/character）。",
      "belittle": "v. 侧重在言语上“轻视、贬低他人成就的价值”（belittle sb.'s achievements）。",
      "disparage": "v. 侧重不公平地轻蔑评价某事物的质量或地位。",
      "deprecate": "v. 侧重表示强烈反对或自谦地自我贬抑（self-deprecating）。"
    },
    translation: "当对手政党投放旨在彻底玷污抹黑该候选人道德操守与人品的恶意广告时，这场政治竞选变了味。"
  },
  {
    id: "tem8_3_2",
    group_id: 103,
    group_name: "disparage, denigrate, belittle, deprecate",
    level: "TEM-8",
    target_word: "deprecate",
    question: "Known for his modesty, the distinguished scholar had a charming habit to ___ his own groundbreaking contributions to modern linguistics.",
    options: ["disparage", "denigrate", "belittle", "deprecate"],
    answer: "deprecate",
    distractor_analysis: {
      "deprecate": "v. 用于自谦语境时，表示“谦逊地贬抑自身价值”，与前文 modesty 形成严密语境呼应。",
      "denigrate": "v. 恶意抹黑诽谤，不可能用于学者对自身谦逊的自述。",
      "disparage": "v. 带有蔑视贬低色彩，语感偏向攻讦他人。",
      "belittle": "v. 贬低轻视，语域不如 deprecate 高级和文雅。"
    },
    translation: "这位著名的学者以谦逊著称，有着一种自我贬抑、谦虚看待自己在现代语言学开创性贡献的可爱习惯。"
  },

  // Group 4: vindicate, exonerate, acquit, absolve
  {
    id: "tem8_4_1",
    group_id: 104,
    group_name: "vindicate, exonerate, acquit, absolve",
    level: "TEM-8",
    target_word: "acquit",
    question: "After reviewing the undisputed forensic evidence, the jury voted unanimously to ___ the defendant of all felony charges.",
    options: ["vindicate", "exonerate", "acquit", "absolve"],
    answer: "acquit",
    distractor_analysis: {
      "acquit": "v. 严密的法律审判动词，主语通常是法官或陪审团（the jury），固定介词搭配 acquit sb. OF charges（宣判无罪）。",
      "vindicate": "v. 侧重通过后续事实“证明某人的主张/荣誉是正确且正当的”，不接 of charges 这种严格法庭宣告。",
      "exonerate": "v. 免除罪责或指控，多强调从道德或调查层面洗刷冤屈，语法上不如 jury acquit 专一。",
      "absolve": "v. 宗教或良心层面的“赦免/宽恕”，接 of/from sin or guilt。"
    },
    translation: "在审查了无可争议的法医物证之后，陪审团一致裁定宣告被告的所有重罪指控不成立。"
  },
  {
    id: "tem8_4_2",
    group_id: 104,
    group_name: "vindicate, exonerate, acquit, absolve",
    level: "TEM-8",
    target_word: "vindicate",
    question: "Although his unorthodox economic theories were widely mocked a decade ago, recent market crashes have thoroughly ___ his predictions.",
    options: ["vindicate", "exonerate", "acquit", "absolve"],
    answer: "vindicate",
    distractor_analysis: {
      "vindicate": "v. 侧重“事态发展证实了先前的理论/预测是正确的，为其正名”（vindicate predictions/claims/rights）。",
      "acquit": "v. 法律宣告无罪，宾语不能是抽象理论或预测 predictions。",
      "exonerate": "v. 侧重洗脱嫌疑或过错，不用于证实预测准确。",
      "absolve": "v. 免除罪孽或法律责任，宾语必须为人或责任义务。"
    },
    translation: "尽管十年前他非正统的经济学理论曾饱受嘲弄，但近期的一系列市场崩盘彻底证实了他的预测是正确的。"
  },

  // Group 5: equivocal, ambiguous, obscure, enigmatic
  {
    id: "tem8_5_1",
    group_id: 105,
    group_name: "equivocal, ambiguous, obscure, enigmatic",
    level: "TEM-8",
    target_word: "equivocal",
    question: "When questioned about his direct involvement in the financial scandal, the minister deliberately gave an ___ response to evade taking a firm stance.",
    options: ["equivocal", "ambiguous", "obscure", "enigmatic"],
    answer: "equivocal",
    distractor_analysis: {
      "equivocal": "adj. 专指“主观上故意含糊其辞、模棱两可”（deliberately evasive），旨在推卸责任或避开正面回答（后文 deliberately 和 evade 为决定性线索）。",
      "ambiguous": "adj. 侧重客观表达存在多种理解（可能是无意造成的歧义）。",
      "obscure": "adj. 侧重信息晦涩艰深、难以理解，或者鲜为人知。",
      "enigmatic": "adj. 侧重如同谜团一般神秘、令人捉摸不透（如 an enigmatic smile）。"
    },
    translation: "当被问及他是否直接卷入这起金融丑闻时，部长故意给出了模棱两可的回答，以回避采取明确立场。"
  },
  {
    id: "tem8_5_2",
    group_id: 105,
    group_name: "equivocal, ambiguous, obscure, enigmatic",
    level: "TEM-8",
    target_word: "enigmatic",
    question: "The Mona Lisa continues to bewitch art historians primarily due to her subtle and ___ smile, whose true emotion remains an impenetrable mystery.",
    options: ["equivocal", "ambiguous", "obscure", "enigmatic"],
    answer: "enigmatic",
    distractor_analysis: {
      "enigmatic": "adj. 经典搭配用于艺术品、表情或人物性格，表示“神秘莫测、耐人寻味”（与后文 impenetrable mystery 严丝合缝）。",
      "equivocal": "adj. 政治外交式故意模棱两可，不能形容微笑的艺术美感。",
      "ambiguous": "adj. 侧重字面歧义，语境不协调。",
      "obscure": "adj. 侧重偏僻无名或文本艰涩。"
    },
    translation: "蒙娜丽莎之所以持续吸引着艺术史学家，主要是因为她那微妙而神秘莫测的微笑，其真实情感至今仍是一个无法参透的谜团。"
  },

  // Group 6: assiduous, sedulous, diligent, industrious
  {
    id: "tem8_6_1",
    group_id: 106,
    group_name: "assiduous, sedulous, diligent, industrious",
    level: "TEM-8",
    target_word: "assiduous",
    question: "Through decades of ___ archival research and relentless attention to detail, she uncovered the long-forgotten manuscripts of the Renaissance poet.",
    options: ["assiduous", "sedulous", "diligent", "industrious"],
    answer: "assiduous",
    distractor_analysis: {
      "assiduous": "adj. 专八高阶学术用语，强调在学术考证、精细任务中“持之以恒、极其注重细节且一丝不苟”（搭配 attention to detail 是经典考点）。",
      "industrious": "adj. 侧重体力劳动或工农生产的勤奋耐劳（如 an industrious worker）。",
      "diligent": "adj. 通用基础词汇，偏重认真好学或克尽职守，学术语域不如 assiduous 精妙。",
      "sedulous": "adj. 偏向坚持不懈的刻苦模仿或繁复操作，在学术研究搭配中频次略逊于 assiduous。"
    },
    translation: "经过数十年一丝不苟的档案文献研究以及对细节坚持不懈的执着，她发掘出了这位文艺复兴时期诗人被遗忘已久的手稿。"
  },

  // Group 7: supercilious, disdainful, haughty, arrogant
  {
    id: "tem8_7_1",
    group_id: 107,
    group_name: "supercilious, disdainful, haughty, arrogant",
    level: "TEM-8",
    target_word: "supercilious",
    question: "The wealthy aristocrat cast a ___ glance down his nose at the modest cottage, as if the mere sight of poverty offended his delicate sensibilities.",
    options: ["supercilious", "disdainful", "haughty", "arrogant"],
    answer: "supercilious",
    distractor_analysis: {
      "supercilious": "adj. 词源来自“挑起眉毛（eyebrow）”，形象地指“傲慢地扬起眉毛、用鼻孔看人、目空一切”（搭配 glance down his nose 是典型形象写照）。",
      "arrogant": "adj. 普通日常高频词，泛指狂妄自大，缺乏身体动作的具象感。",
      "haughty": "adj. 侧重贵族式的孤高冷傲，态度矜持。",
      "disdainful": "adj. 侧重鄙夷、嫌恶他人的轻蔑神色。"
    },
    translation: "这位富有的贵族轻蔑地扬起眉毛，从鼻孔里俯视着那座简陋的小屋，仿佛仅仅看到贫困就冒犯了他那娇贵的情感。"
  },

  // Group 8: ubiquitous, pervasive, omnipresent, widespread
  {
    id: "tem8_8_1",
    group_id: 108,
    group_name: "ubiquitous, pervasive, omnipresent, widespread",
    level: "TEM-8",
    target_word: "pervasive",
    question: "The stench of industrial pollution was so ___ throughout the valley that residents could smell it even inside tightly sealed rooms.",
    options: ["ubiquitous", "pervasive", "omnipresent", "widespread"],
    answer: "pervasive",
    distractor_analysis: {
      "pervasive": "adj. 侧重于气味、思想、氛围像气体一样“无孔不入、渗透弥漫”（pervasive stench/influence，后文 smell inside tightly sealed 强关联）。",
      "ubiquitous": "adj. 侧重实体物品“随处可见”（如 smartphones are ubiquitous），不形容气味的渗透性。",
      "omnipresent": "adj. 偏宗教或哲学意义上的“无所不在”（如 God is omnipresent）。",
      "widespread": "adj. 侧重地理分布范围广阔（如 widespread damage/criticism）。"
    },
    translation: "工业污染的恶臭在整个山谷中弥漫渗透，以至于居民即使在紧闭门窗的室内也能闻到。"
  },

  // Group 9: placate, appease, mollify, propitiate
  {
    id: "tem8_9_1",
    group_id: 109,
    group_name: "placate, appease, mollify, propitiate",
    level: "TEM-8",
    target_word: "propitiate",
    question: "In ancient times, the tribe would sacrifice their finest cattle on the sacred altar in an effort to ___ the wrath of the tempest gods.",
    options: ["placate", "appease", "mollify", "propitiate"],
    answer: "propitiate",
    distractor_analysis: {
      "propitiate": "v. 专用于宗教、神话祭祀场景，指“通过供奉献祭来抚慰神明或超自然力量以求宽恕”（后文 sacrifice on altar to gods 为绝对线索）。",
      "appease": "v. 政治外交领域的“绥靖、姑息侵略者”，通过割让原则换取暂时苟安。",
      "placate": "v. 侧重安抚发怒的顾客、民众或抗议者（如 placate angry customers）。",
      "mollify": "v. 侧重平息肉体伤痛或安抚个体受挫的激烈情绪。"
    },
    translation: "在远古时代，部落会在神圣的祭坛上宰杀最好的牛只作为祭品，试图借此平息风暴之神的怒火。"
  },

  // Group 10: reticent, taciturn, reserved, laconic
  {
    id: "tem8_10_1",
    group_id: 110,
    group_name: "reticent, taciturn, reserved, laconic",
    level: "TEM-8",
    target_word: "laconic",
    question: "When asked for an explanation of the unexpected defeat, the grim coach offered only a ___ three-word reply: 'We weren\\'t ready.'",
    options: ["reticent", "taciturn", "reserved", "laconic"],
    answer: "laconic",
    distractor_analysis: {
      "laconic": "adj. 源自斯巴达人（Laconia），专指语言风格“言简意赅、惜字如金、甚至显得冷峻”（搭配 three-word reply 是标准用法）。",
      "taciturn": "adj. 形容人的性格天生沉默寡言、不苟言笑，指性格特质而非单次发言的修辞。",
      "reticent": "adj. 强调心理上的谨慎克制，不愿透露私人情感或秘密（reticent about personal life）。",
      "reserved": "adj. 强调举止矜持、不轻易表露喜怒哀乐。"
    },
    translation: "当被要求解释这场出人意料的失利时，面色阴沉的主教练仅仅给出了极其简练的三个字回复：“我们没准备好。”"
  }
];

const outputPath = path.resolve('public/data/questions_tem8.json');
fs.writeFileSync(outputPath, JSON.stringify(tem8Questions, null, 2), 'utf8');
console.log(`Successfully generated ${tem8Questions.length} TEM-8 questions to ${outputPath}`);
