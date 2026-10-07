import fs from 'fs';
import path from 'path';

// 专八（TEM-8）高频核心近义词深度辨析题库构建器 (40 题完整典范集)
// 语料技术底座：
// 1. ECDICT & 官方大纲词表：确定 TEM-8 核心考点词级范围
// 2. WordNet 3.0：Synsets 认知语义网精准近义词聚类
// 3. Merriam-Webster (MWDS / MW Collegiate)：提取原生外刊学术语境与辨析说明
// 4. 四步排他性挖空增强：保留固定介词锚点 (Collocation Anchor) + 绝对排他逻辑 + 逐项干扰排除剖析

const tem8Questions = [
  // ==========================================
  // Group 1: alleviate, mitigate, palliate, soothe (FIELD_CHANGE)
  // ==========================================
  {
    id: "tem8_1_1",
    group_id: 101,
    group_name: "alleviate, mitigate, palliate, soothe",
    level: "TEM-8",
    target_word: "palliate",
    question: "The economic reform was merely a temporary compromise intended to ___ the acute social discontent rather than solve the underlying crisis.",
    options: ["alleviate", "mitigate", "palliate", "soothe"],
    answer: "palliate",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_CHANGE",
    anchor_clue: "后文 'rather than solve the underlying crisis'（而非解决根本危机）是绝对排他线索，专指治标不治本的敷衍妥协。",
    distractor_analysis: {
      "palliate": "v. 专指“姑息、掩饰、治标不治本”，通过表面妥协来暂时缓和尖锐矛盾或病痛（后文 rather than solve 形成绝对排他）。",
      "alleviate": "v. 侧重实质性减轻痛苦、贫困或紧迫症状（alleviate poverty/suffering），而非虚与委蛇的治标敷衍。",
      "mitigate": "v. 常用于法律、风险、气候等政经领域，指主动降低危害严重性（mitigate the impact/risk），不合治标妥协的语境。",
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
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_CHANGE",
    anchor_clue: "搭配抽象的全局性灾难后果（consequences of global warming），为正式环保政经学术经典动宾搭配。",
    distractor_analysis: {
      "mitigate": "v. 正式学术及政经用语，固定搭配后果、危害或风险（mitigate consequences/effects/penalties），指主动干预以降低危害严重性。",
      "alleviate": "v. 侧重于缓和已存在的沉重痛苦、贫困或紧迫症状（alleviate poverty/suffering）。",
      "palliate": "v. 指姑息疗法或敷衍遮掩，不合环保治理主动应对的政策语境。",
      "soothe": "v. 抚慰、镇定，不能搭配抽象的全球变暖灾难性后果。"
    },
    translation: "环保机构实施了严格的碳排放上限，以紧急减轻全球变暖带来的毁灭性后果。"
  },

  // ==========================================
  // Group 2: ephemeral, transient, fleeting, evanescent (FIELD_NATURE)
  // ==========================================
  {
    id: "tem8_2_1",
    group_id: 102,
    group_name: "ephemeral, transient, fleeting, evanescent",
    level: "TEM-8",
    target_word: "evanescent",
    question: "In the chilly autumn dawn, the morning mist was as ___ as vapor, dissipating completely the moment the first rays of sunlight broke through.",
    options: ["ephemeral", "transient", "fleeting", "evanescent"],
    answer: "evanescent",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_NATURE",
    anchor_clue: "题干比喻 'as vapor, dissipating completely'（如水汽般消散隐没），精准对应词源像蒸汽般化为虚无的意象。",
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
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_CONNOTATION",
    field: "FIELD_NATURE",
    anchor_clue: "形容网络流行热度与聚光灯关注度生命周期短暂（vanishing after only a few days in the spotlight）。",
    distractor_analysis: {
      "ephemeral": "adj. 最常用于形容名利、潮流或热度的“生命周期极短”，如昙花一现（与后文 a few days 严密呼应）。",
      "evanescent": "adj. 强调物理上的消散隐没（如晨雾、泡沫），不用于社会文化热点现象。",
      "transient": "adj. 强调过境、流动性或驻留短暂。",
      "fleeting": "adj. 强调时间流逝之快或瞥视的一瞬间。"
    },
    translation: "在快节奏的社交媒体时代，网络爆红往往是众所周知的昙花一现，在聚光灯下不过停留寥寥数日便销声匿迹。"
  },

  // ==========================================
  // Group 3: disparage, denigrate, belittle, deprecate (FIELD_STANCE)
  // ==========================================
  {
    id: "tem8_3_1",
    group_id: 103,
    group_name: "disparage, denigrate, belittle, deprecate",
    level: "TEM-8",
    target_word: "denigrate",
    question: "The political campaign took a malicious turn when the rival party launched ads designed to completely ___ the candidate's moral integrity and character.",
    options: ["disparage", "denigrate", "belittle", "deprecate"],
    answer: "denigrate",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_STANCE",
    anchor_clue: "修饰政治竞选中恶意攻击对手的名誉与道德操守（malicious, moral integrity and character）。",
    distractor_analysis: {
      "denigrate": "v. 词源含有“抹黑、玷污”之意，语气极重，专门搭配并恶意攻击他人名誉、人格、品德（denigrate integrity/character）。",
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
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_CONNOTATION",
    field: "FIELD_STANCE",
    anchor_clue: "前文 'Known for his modesty'（以谦逊著称）明确判定为学者自谦贬抑，属文雅高阶自谦语体。",
    distractor_analysis: {
      "deprecate": "v. 用于自谦语境时，表示“谦逊地贬抑自身价值”，与前文 modesty 形成严密语境呼应。",
      "denigrate": "v. 恶意抹黑诽谤，不可能用于学者对自身谦逊的自述。",
      "disparage": "v. 带有蔑视贬低色彩，语感偏向攻讦他人。",
      "belittle": "v. 贬低轻视，语域不如 deprecate 高级和文雅。"
    },
    translation: "这位著名的学者以谦逊著称，有着一种自我贬抑、谦虚看待自己在现代语言学开创性贡献的可爱习惯。"
  },

  // ==========================================
  // Group 4: vindicate, exonerate, acquit, absolve (FIELD_RELATION)
  // ==========================================
  {
    id: "tem8_4_1",
    group_id: 104,
    group_name: "vindicate, exonerate, acquit, absolve",
    level: "TEM-8",
    target_word: "acquit",
    question: "After reviewing the undisputed forensic evidence, the jury voted unanimously to ___ the defendant of all felony charges.",
    options: ["vindicate", "exonerate", "acquit", "absolve"],
    answer: "acquit",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_RELATION",
    anchor_clue: "主语是陪审团（the jury），固定介词搭配 'acquit sb. OF felony charges'。",
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
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_RELATION",
    anchor_clue: "主语是市场崩盘事实，宾语是预测（vindicate his predictions），表示事实证明原论断正确无误。",
    distractor_analysis: {
      "vindicate": "v. 侧重“事态发展证实了先前的理论/预测是正确的，为其正名”（vindicate predictions/claims/rights）。",
      "acquit": "v. 法律宣告无罪，宾语不能是抽象理论或预测 predictions。",
      "exonerate": "v. 侧重洗脱嫌疑或过错，不用于证实预测准确。",
      "absolve": "v. 免除罪孽或法律责任，宾语必须为人或责任义务。"
    },
    translation: "尽管十年前他非正统的经济学理论曾饱受嘲弄，但近期的一系列市场崩盘彻底证实了他的预测是正确的。"
  },

  // ==========================================
  // Group 5: equivocal, ambiguous, obscure, enigmatic (FIELD_COGNITION)
  // ==========================================
  {
    id: "tem8_5_1",
    group_id: 105,
    group_name: "equivocal, ambiguous, obscure, enigmatic",
    level: "TEM-8",
    target_word: "equivocal",
    question: "When questioned about his direct involvement in the financial scandal, the minister deliberately gave an ___ response to evade taking a firm stance.",
    options: ["equivocal", "ambiguous", "obscure", "enigmatic"],
    answer: "equivocal",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_COGNITION",
    anchor_clue: "副词 'deliberately'（故意地）与目的 'to evade taking a firm stance'（以逃避表态），唯一锁定政客故意含糊其辞。",
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
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_COGNITION",
    anchor_clue: "后文 'remains an impenetrable mystery'（至今仍是一个无法参透的谜团），修饰艺术品微笑。",
    distractor_analysis: {
      "enigmatic": "adj. 经典搭配用于艺术品、表情或人物性格，表示“神秘莫测、耐人寻味”（与后文 impenetrable mystery 严丝合缝）。",
      "equivocal": "adj. 政治外交式故意模棱两可，不能形容微笑的艺术美感。",
      "ambiguous": "adj. 侧重字面歧义，语境不协调。",
      "obscure": "adj. 侧重偏僻无名或文本艰涩。"
    },
    translation: "蒙娜丽莎之所以持续吸引着艺术史学家，主要是因为她那微妙而神秘莫测的微笑，其真实情感至今仍是一个无法参透的谜团。"
  },

  // ==========================================
  // Group 6: assiduous, sedulous, diligent, industrious (FIELD_BEHAVIOR)
  // ==========================================
  {
    id: "tem8_6_1",
    group_id: 106,
    group_name: "assiduous, sedulous, diligent, industrious",
    level: "TEM-8",
    target_word: "assiduous",
    question: "Through decades of ___ archival research and relentless attention to detail, she uncovered the long-forgotten manuscripts of the Renaissance poet.",
    options: ["assiduous", "sedulous", "diligent", "industrious"],
    answer: "assiduous",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_BEHAVIOR",
    anchor_clue: "搭配学术文献考证 'archival research and relentless attention to detail'，属于严谨考证的高阶学术语域。",
    distractor_analysis: {
      "assiduous": "adj. 专八高阶学术用语，强调在学术考证、精细任务中“持之以恒、极其注重细节且一丝不苟”（搭配 attention to detail 是经典考点）。",
      "industrious": "adj. 侧重体力劳动或工农生产的勤奋耐劳（如 an industrious worker）。",
      "diligent": "adj. 通用基础词汇，偏重认真好学或克尽职守，学术语域不如 assiduous 精妙。",
      "sedulous": "adj. 偏向坚持不懈的刻苦模仿或繁复操作，在学术文献档案研究搭配中频次略逊于 assiduous。"
    },
    translation: "经过数十年一丝不苟的档案文献研究以及对细节坚持不懈的执着，她发掘出了这位文艺复兴时期诗人被遗忘已久的手稿。"
  },
  {
    id: "tem8_6_2",
    group_id: 106,
    group_name: "assiduous, sedulous, diligent, industrious",
    level: "TEM-8",
    target_word: "sedulous",
    question: "The novice essayist acquired his polished rhetorical style through the ___ imitation of Addison's prose, rewriting essays dozens of times.",
    options: ["assiduous", "sedulous", "diligent", "industrious"],
    answer: "sedulous",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_BEHAVIOR",
    anchor_clue: "搭配修辞摹写 'sedulous imitation of Addison's prose'，典故出自文学史中的刻苦揣摩模仿。",
    distractor_analysis: {
      "sedulous": "adj. 经典文学与学术搭配，专指在学习技巧、修辞仿写或艺术训练中“孜孜不倦、精雕细琢的刻苦模仿”（sedulous imitation）。",
      "industrious": "adj. 侧重工农产业劳动勤劳，不可用于文风修辞模仿。",
      "diligent": "adj. 中性泛指勤奋，缺乏精雕细琢摹仿的特定意象。",
      "assiduous": "adj. 侧重对待考据、照料细节的专心致志。"
    },
    translation: "这位初涉文坛的散文家通过对艾迪生散文孜孜不倦的刻苦摹写，将散文重写数十遍，最终习得了精湛圆融的修辞风格。"
  },

  // ==========================================
  // Group 7: supercilious, disdainful, haughty, arrogant (FIELD_STANCE)
  // ==========================================
  {
    id: "tem8_7_1",
    group_id: 107,
    group_name: "supercilious, disdainful, haughty, arrogant",
    level: "TEM-8",
    target_word: "supercilious",
    question: "The wealthy aristocrat cast a ___ glance down his nose at the modest cottage, as if the mere sight of poverty offended his delicate sensibilities.",
    options: ["supercilious", "disdainful", "haughty", "arrogant"],
    answer: "supercilious",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_STANCE",
    anchor_clue: "搭配具象动作 'cast a glance down his nose'（从鼻孔里看人、扬起眉毛），直指词源挑眉目空一切之意象。",
    distractor_analysis: {
      "supercilious": "adj. 词源来自“挑起眉毛（eyebrow）”，形象地指“傲慢地扬起眉毛、用鼻孔看人、目空一切”（搭配 glance down his nose 是典型形象写照）。",
      "arrogant": "adj. 普通日常高频词，泛指狂妄自大，缺乏身体动作的具象感。",
      "haughty": "adj. 侧重贵族式的孤高冷傲，态度矜持。",
      "disdainful": "adj. 侧重鄙夷、嫌恶他人的轻蔑神色。"
    },
    translation: "这位富有的贵族轻蔑地扬起眉毛，从鼻孔里俯视着那座简陋的小屋，仿佛仅仅看到贫困就冒犯了他那娇贵的情感。"
  },
  {
    id: "tem8_7_2",
    group_id: 107,
    group_name: "supercilious, disdainful, haughty, arrogant",
    level: "TEM-8",
    target_word: "haughty",
    question: "Accustomed to courtly deference, the dowager duchess maintained a ___ aloofness, refusing to engage with anyone beneath her noble pedigree.",
    options: ["supercilious", "disdainful", "haughty", "arrogant"],
    answer: "haughty",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_CONNOTATION",
    field: "FIELD_STANCE",
    anchor_clue: "搭配门第身份孤傲 'courtly deference, maintained a haughty aloofness... beneath her noble pedigree'。",
    distractor_analysis: {
      "haughty": "adj. 专指因高贵出身、特权或优越社会地位而产生的“贵族式孤高冷傲、目中无人”（haughty aloofness/manner）。",
      "supercilious": "adj. 侧重挑眉冷笑的具象神态，不特指门第阶层的孤傲冷漠。",
      "arrogant": "adj. 泛指自负狂妄，缺乏贵族阶级特权文体色彩。",
      "disdainful": "adj. 侧重鄙视与嫌恶情绪。"
    },
    translation: "习惯了宫廷式尊崇的公爵遗孀保持着一种贵族式的孤高冷傲，拒绝与任何门第地位低于她的人打交道。"
  },

  // ==========================================
  // Group 8: ubiquitous, pervasive, omnipresent, widespread (FIELD_NATURE)
  // ==========================================
  {
    id: "tem8_8_1",
    group_id: 108,
    group_name: "ubiquitous, pervasive, omnipresent, widespread",
    level: "TEM-8",
    target_word: "pervasive",
    question: "The stench of industrial pollution was so ___ throughout the valley that residents could smell it even inside tightly sealed rooms.",
    options: ["ubiquitous", "pervasive", "omnipresent", "widespread"],
    answer: "pervasive",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_NATURE",
    anchor_clue: "修饰恶臭且具有穿透性 'stench ... could smell it even inside tightly sealed rooms'，消极渗透语义韵。",
    distractor_analysis: {
      "pervasive": "adj. 侧重于气味、思想、氛围像气体一样“无孔不入、渗透弥漫”（pervasive stench/influence，后文 smell inside tightly sealed 强关联）。",
      "ubiquitous": "adj. 侧重实体物品“随处可见”（如 smartphones are ubiquitous），不形容气味的渗透性。",
      "omnipresent": "adj. 偏宗教或哲学意义上的“无所不在”（如 God is omnipresent）。",
      "widespread": "adj. 侧重地理分布范围广阔（如 widespread damage/criticism）。"
    },
    translation: "工业污染的恶臭在整个山谷中弥漫渗透，以至于居民即使在紧闭门窗的室内也能闻到。"
  },
  {
    id: "tem8_8_2",
    group_id: 108,
    group_name: "ubiquitous, pervasive, omnipresent, widespread",
    level: "TEM-8",
    target_word: "ubiquitous",
    question: "Within less than two decades, handheld smartphones have transformed from luxury oddities into ___ tools found in every corner of the globe.",
    options: ["ubiquitous", "pervasive", "omnipresent", "widespread"],
    answer: "ubiquitous",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_NATURE",
    anchor_clue: "修饰实体数码产品随处可见 'smartphones ... tools found in every corner of the globe'。",
    distractor_analysis: {
      "ubiquitous": "adj. 现代科技社论经典用词，专指实体物品或技术“无处不在、随处可见”（ubiquitous smartphones/computing）。",
      "pervasive": "adj. 强调无形事物、气氛或气味的渗透性弥漫，不用于实体工具的遍及。",
      "omnipresent": "adj. 带有神学或无所不在的抽象压迫感，语域不符。",
      "widespread": "adj. 仅说明分布广泛，缺乏 ubiquitous 所传递的“随时随地近在眼前”的强烈冲击。"
    },
    translation: "在不到二十年的时间里，手持智能手机已从奢侈罕物演变为在全球每个角落随处可见的必备工具。"
  },

  // ==========================================
  // Group 9: placate, appease, mollify, propitiate (FIELD_RELATION)
  // ==========================================
  {
    id: "tem8_9_1",
    group_id: 109,
    group_name: "placate, appease, mollify, propitiate",
    level: "TEM-8",
    target_word: "propitiate",
    question: "In ancient times, the tribe would sacrifice their finest cattle on the sacred altar in an effort to ___ the wrath of the tempest gods.",
    options: ["placate", "appease", "mollify", "propitiate"],
    answer: "propitiate",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_RELATION",
    anchor_clue: "祭坛祭神献祭语境 'sacrifice cattle on the sacred altar to the gods'，属宗教学术祭神专有语域。",
    distractor_analysis: {
      "propitiate": "v. 专用于宗教、神话祭祀场景，指“通过供奉献祭来抚慰神明或超自然力量以求宽恕”（后文 sacrifice on altar to gods 为绝对线索）。",
      "appease": "v. 政治外交领域的“绥靖、姑息侵略者”，通过割让原则换取暂时苟安。",
      "placate": "v. 侧重安抚发怒的顾客、民众或抗议者（如 placate angry customers）。",
      "mollify": "v. 侧重平息肉体伤痛或安抚个体受挫的激烈情绪。"
    },
    translation: "在远古时代，部落会在神圣的祭坛上宰杀最好的牛只作为祭品，试图借此平息风暴之神的怒火。"
  },
  {
    id: "tem8_9_2",
    group_id: 109,
    group_name: "placate, appease, mollify, propitiate",
    level: "TEM-8",
    target_word: "appease",
    question: "History has repeatedly demonstrated that yielding sovereignty in a desperate attempt to ___ an aggressive dictator only invites further subjugation.",
    options: ["placate", "appease", "mollify", "propitiate"],
    answer: "appease",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_RELATION",
    anchor_clue: "地缘政治与割让主权妥协侵略者 'yielding sovereignty ... to an aggressive dictator'，政经绥靖消极语义韵。",
    distractor_analysis: {
      "appease": "v. 国际政治与历史经典专有术语，专指“绥靖政策（appeasement）”，通过违背原则的屈服妥协来姑息侵略者。",
      "propitiate": "v. 祭祀供奉以取悦神明，不用于国际政局对独裁者的妥协。",
      "mollify": "v. 抚慰受伤自尊或肉体创伤，语域不符。",
      "placate": "v. 安抚商业或日常争端中的不满者，语体不够深沉严肃。"
    },
    translation: "历史屡次证明，试图通过让渡主权来苟安绥靖侵略成性的独裁者，只会招致进一步的奴役与征服。"
  },

  // ==========================================
  // Group 10: reticent, taciturn, reserved, laconic (FIELD_BEHAVIOR)
  // ==========================================
  {
    id: "tem8_10_1",
    group_id: 110,
    group_name: "reticent, taciturn, reserved, laconic",
    level: "TEM-8",
    target_word: "laconic",
    question: "When asked for an explanation of the unexpected defeat, the grim coach offered only a ___ three-word reply: 'We weren\\'t ready.'",
    options: ["reticent", "taciturn", "reserved", "laconic"],
    answer: "laconic",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_BEHAVIOR",
    anchor_clue: "修饰极度简练的回答 'a three-word reply: We weren't ready'，典故源自斯巴达人语言风格。",
    distractor_analysis: {
      "laconic": "adj. 源自斯巴达人（Laconia），专指语言风格“言简意赅、惜字如金、甚至显得冷峻”（搭配 three-word reply 是标准用法）。",
      "taciturn": "adj. 形容人的性格天生沉默寡言、不苟言笑，指长久性格特质而非单次发言的修辞。",
      "reticent": "adj. 强调心理上的谨慎克制，不愿透露私人情感或秘密（reticent about personal life）。",
      "reserved": "adj. 强调举止矜持、不轻易表露喜怒哀乐。"
    },
    translation: "当被要求解释这场出人意料的失利时，面色阴沉的主教练仅仅给出了极其简练的三个字回复：“我们没准备好。”"
  },
  {
    id: "tem8_10_2",
    group_id: 110,
    group_name: "reticent, taciturn, reserved, laconic",
    level: "TEM-8",
    target_word: "taciturn",
    question: "Raised in the rugged highlands, the old mountaineer was naturally ___, often spending entire days trekking without uttering a single syllable.",
    options: ["reticent", "taciturn", "reserved", "laconic"],
    answer: "taciturn",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_BEHAVIOR",
    anchor_clue: "形容与生俱来的沉默寡言性格特质 'naturally ... trekking without uttering a single syllable'。",
    distractor_analysis: {
      "taciturn": "adj. 强调性格气质上的“习惯性寡言少语、孤僻沉默”（a taciturn disposition），指长久的人格特征。",
      "laconic": "adj. 侧重言辞表达上的简短精辟（a laconic comment），不直接形容终日不语的性格沉默。",
      "reticent": "adj. 侧重克制保留，不愿畅所欲言或隐瞒信息。",
      "reserved": "adj. 侧重彬彬有礼的矜持与内敛社交。"
    },
    translation: "在这片崎岖高地长大的老登山家天生沉默寡言，经常一整天跋涉徒步却不吐露半个字句。"
  },

  // ==========================================
  // Group 11: ingenious, ingenuous, naive, subtle (FIELD_COGNITION / Paronym)
  // ==========================================
  {
    id: "tem8_11_1",
    group_id: 111,
    group_name: "ingenious, ingenuous, naive, subtle",
    level: "TEM-8",
    target_word: "ingenuous",
    question: "The experienced diplomats were thoroughly disarmed by the young ambassador's ___ candor, which was completely devoid of political guile.",
    options: ["ingenious", "ingenuous", "naive", "subtle"],
    answer: "ingenuous",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_COGNITION",
    anchor_clue: "修饰坦诚且无政治心机 'candor, completely devoid of political guile'，专八核心形似词辨析。",
    distractor_analysis: {
      "ingenuous": "adj. 专八高频易混形似词，指人“单纯天真、真诚坦率、毫无心机”（搭配 candor/frankness 是绝对考点）。",
      "ingenious": "adj. 拼写仅一字之差，指方案、发明或头脑“机巧敏锐、设计精妙”（an ingenious device）。",
      "naive": "adj. 通用词汇，多含贬义，指幼稚、缺乏世故甚至愚蠢可欺。",
      "subtle": "adj. 巧妙微妙、难以捉摸，与后文 devoid of guile（毫无心机）语义冲突。"
    },
    translation: "经验丰富的外交官们被这位年轻大使那毫不掩饰、毫无政治心机的单纯真诚彻底卸下了防备。"
  },
  {
    id: "tem8_11_2",
    group_id: 111,
    group_name: "ingenious, ingenuous, naive, subtle",
    level: "TEM-8",
    target_word: "ingenious",
    question: "Confronted with an unexpected power blackout, the aerospace engineer devised an ___ workaround that kept life-support systems operational.",
    options: ["ingenious", "ingenuous", "naive", "subtle"],
    answer: "ingenious",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_COGNITION",
    anchor_clue: "搭配技术应急方案 'devised an ingenious workaround that kept life-support systems operational'。",
    distractor_analysis: {
      "ingenious": "adj. 专指构思、发明或解题构想“精巧独创、设计巧妙”（an ingenious solution/workaround）。",
      "ingenuous": "adj. 形似词，指人天真单纯、毫不做作，不能修饰工程解决方案。",
      "naive": "adj. 幼稚天真，语意相悖。",
      "subtle": "adj. 侧重隐约细微，不如 ingenious 强调机敏的创造力。"
    },
    translation: "面对突如其来的电力中断，这位航天工程师设计出了一个极其精巧的应急方案，使得生命维持系统得以持续运转。"
  },

  // ==========================================
  // Group 12: perfunctory, peremptory, cursory, imperative (FIELD_BEHAVIOR / Paronym)
  // ==========================================
  {
    id: "tem8_12_1",
    group_id: 112,
    group_name: "perfunctory, peremptory, cursory, imperative",
    level: "TEM-8",
    target_word: "peremptory",
    question: "The military governor issued a ___ decree ordering all foreign nationals to evacuate the province immediately, brooking no debate or delay.",
    options: ["perfunctory", "peremptory", "cursory", "imperative"],
    answer: "peremptory",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_BEHAVIOR",
    anchor_clue: "专横号令且不容辩驳 'brooking no debate or delay'（不容辩驳与延误），命令口吻绝对断然。",
    distractor_analysis: {
      "peremptory": "adj. 专八高频形似词，指态度或命令“专横跋扈的、强制不容置疑的”（结合 brooking no debate 是标准信号词）。",
      "perfunctory": "adj. 形似词，指做事“敷衍了事的、例行公事毫无热情的”（如 a perfunctory nod）。",
      "cursory": "adj. 侧重动作飞快匆忙、浮于表面（a cursory glance）。",
      "imperative": "adj. 必要的、当务之急的，缺乏语气上的专横独断色彩。"
    },
    translation: "军政长官发布了一项不容抗辩的严苛法令，命令所有外国公民立即撤离该省，不容任何争论与延误。"
  },
  {
    id: "tem8_12_2",
    group_id: 112,
    group_name: "perfunctory, peremptory, cursory, imperative",
    level: "TEM-8",
    target_word: "perfunctory",
    question: "Exhausted from the long shift, the border guard gave only a ___ glance at their passports before waving the convoy through.",
    options: ["perfunctory", "peremptory", "cursory", "imperative"],
    answer: "perfunctory",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_BEHAVIOR",
    anchor_clue: "搭配例行公事敷衍走过场 'gave only a perfunctory glance... waving the convoy through'。",
    distractor_analysis: {
      "perfunctory": "adj. 专指“例行公事、敷衍应付的”（perfunctory inspection/glance），缺乏责任心与专注。",
      "peremptory": "adj. 专横跋扈、不容置疑，不能修饰例行敷衍的眼神扫视。",
      "cursory": "adj. 虽指粗略，但强调动作速度快，不如 perfunctory 强烈体现“敷衍渎职、应付差事”的态度。",
      "imperative": "adj. 紧迫的、必要的，语意不合。"
    },
    translation: "长时间执勤已精疲力竭，边防守卫只是敷衍草率地瞥了一眼他们的护照，便挥手示意车队通过。"
  },

  // ==========================================
  // Group 13: quash, quell, suppress, stifle (FIELD_RELATION / Collocation)
  // ==========================================
  {
    id: "tem8_13_1",
    group_id: 113,
    group_name: "quash, quell, suppress, stifle",
    level: "TEM-8",
    target_word: "quash",
    question: "The Supreme Court acted decisively to ___ the lower tribunal's controversial ruling, citing severe constitutional violations.",
    options: ["quash", "quell", "suppress", "stifle"],
    answer: "quash",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_RELATION",
    anchor_clue: "最高法院撤销下级法庭判决 'The Supreme Court ... ruling'，司法撤销判决专属动宾搭配。",
    distractor_analysis: {
      "quash": "v. 专有法律审判术语，指“由上级法院依法宣布撤销、作废判决或传票”（quash a verdict/ruling/subpoena）。",
      "quell": "v. 侧重武力平息暴乱、骚乱或平复内心强烈恐惧（quell riots/fears）。",
      "suppress": "v. 泛指国家机器镇压起义或压抑言论出版自由。",
      "stifle": "v. 侧重物理使窒息或扼杀新生创造力、打哈欠（stifle yawn/creativity）。"
    },
    translation: "最高法院采取果断行动撤销了下级法庭的争议性裁决，理由是存在严重的违宪行为。"
  },
  {
    id: "tem8_13_2",
    group_id: 113,
    group_name: "quash, quell, suppress, stifle",
    level: "TEM-8",
    target_word: "quell",
    question: "The newly deployed peacekeeping troops succeeded in their mission to ___ the violent civil unrest engulfing the port city.",
    options: ["quash", "quell", "suppress", "stifle"],
    answer: "quell",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_RELATION",
    anchor_clue: "搭配平息武装骚乱暴动 'peacekeeping troops ... violent civil unrest'。",
    distractor_analysis: {
      "quell": "v. 经典军事政经动宾搭配，专指“武力平定骚乱、平息暴力暴动”（quell unrest/rebellion/riots）。",
      "quash": "v. 专用于司法审判撤销判决，或压制非武装的谣言/疑虑。",
      "stifle": "v. 扼杀、使窒息，不能搭配大规模城市武装骚乱。",
      "suppress": "v. 镇压，语义偏向高压政治统治，语境搭配不如 quell civil unrest 权威地道。"
    },
    translation: "新部署的维和部队成功完成了使命，平息了席卷这座港口城市的暴力民间骚乱。"
  },

  // ==========================================
  // Group 14: sensuous, sensual, aesthetic, voluptuous (FIELD_COGNITION / Paronym)
  // ==========================================
  {
    id: "tem8_14_1",
    group_id: 114,
    group_name: "sensuous, sensual, aesthetic, voluptuous",
    level: "TEM-8",
    target_word: "sensuous",
    question: "John Keats's Romantic verse is widely celebrated for its rich, ___ imagery that enchants the ears, eyes, and tactile imagination of the reader.",
    options: ["sensuous", "sensual", "aesthetic", "voluptuous"],
    answer: "sensuous",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_CONNOTATION",
    field: "FIELD_COGNITION",
    anchor_clue: "修饰济慈浪漫主义诗歌的感官审美意象 'Romantic verse ... imagery that enchants ears, eyes, and tactile imagination'。",
    distractor_analysis: {
      "sensuous": "adj. 弥尔顿创造的高雅审美词，专指“文学艺术引发的丰富感官愉悦美感（五官审美享受）”，纯粹高雅且毫无肉欲下流色彩。",
      "sensual": "adj. 形似词，侧重“肉欲的、肉体享乐的”，通常带有放荡沉溺的贬义色彩（sensual pleasures）。",
      "aesthetic": "adj. 美学的、审美的，偏哲学抽象范畴，不如 sensuous 体现具体五官通感的生动细腻。",
      "voluptuous": "adj. 丰满性感的、酒池肉林的奢靡肉欲享受。"
    },
    translation: "约翰·济慈的浪漫主义诗篇以其丰富而通感的感官审美意象著称，令读者的耳朵、眼睛及触觉想象沉醉其中。"
  },
  {
    id: "tem8_14_2",
    group_id: 114,
    group_name: "sensuous, sensual, aesthetic, voluptuous",
    level: "TEM-8",
    target_word: "sensual",
    question: "The decadent Roman banquets were notorious for indulging guests in pure, unbridled ___ excess, devoid of any intellectual or moral restraint.",
    options: ["sensuous", "sensual", "aesthetic", "voluptuous"],
    answer: "sensual",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_COGNITION",
    anchor_clue: "修饰奢靡宴席的纯粹肉体感官放纵 'decadent banquets ... unbridled sensual excess, devoid of moral restraint'。",
    distractor_analysis: {
      "sensual": "adj. 专指“肉体的、肉欲享乐的”（结合 decadent banquets 与 devoid of moral restraint 为绝对线索）。",
      "sensuous": "adj. 强调艺术文学中的纯洁通感美，绝不用于纸醉金迷的肉体放纵贬义语境。",
      "aesthetic": "adj. 审美的、艺术的，语意截然相反。",
      "voluptuous": "adj. 常修饰女性身材体态丰满婀娜，不直接搭配 abstract excess。"
    },
    translation: "罗马帝国颓废时期的宴会以沉溺于纯粹、肆无忌惮的肉欲享乐而臭名昭著，毫无任何精神追求或道德约束。"
  },

  // ==========================================
  // Group 15: judicious, judicial, prudent, legislative (FIELD_COGNITION / Paronym)
  // ==========================================
  {
    id: "tem8_15_1",
    group_id: 115,
    group_name: "judicious, judicial, prudent, legislative",
    level: "TEM-8",
    target_word: "judicious",
    question: "Through a remarkably ___ allocation of capital reserves during the market crash, the executive steered the conglomerate clear of bankruptcy.",
    options: ["judicious", "judicial", "prudent", "legislative"],
    answer: "judicious",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_COGNITION",
    anchor_clue: "修饰资本调配决策明智审慎 'judicious allocation of capital reserves'，专八核心形似词。",
    distractor_analysis: {
      "judicious": "adj. 专八核心形似词，指判断、选择或决策“审慎明智、深谋远虑的”（judicious allocation/choice）。",
      "judicial": "adj. 拼写极为相似，专指“司法的、审判的、法官的”（judicial review/system），不可形容商业资本分配。",
      "prudent": "adj. 偏防守稳健，在财经政经决策搭配中不及 judicious 体现精妙判断力。",
      "legislative": "adj. 立法的，语域完全不符。"
    },
    translation: "通过在市场崩溃期间对资本储备极其明智审慎的调配，这位高管带领整个企业集团避开了破产厄运。"
  },
  {
    id: "tem8_15_2",
    group_id: 115,
    group_name: "judicious, judicial, prudent, legislative",
    level: "TEM-8",
    target_word: "judicial",
    question: "Civil rights advocacy groups petitioned the European Court of Human Rights seeking ___ review of the newly passed surveillance act.",
    options: ["judicious", "judicial", "prudent", "legislative"],
    answer: "judicial",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_COGNITION",
    anchor_clue: "法学公文专有固定搭配 'seeking judicial review'（申请司法审查）。",
    distractor_analysis: {
      "judicial": "adj. 法律与宪法专有术语，固定搭配司法审查（judicial review）及司法机构（judicial branch）。",
      "judicious": "adj. 形似词，指头脑明智审慎，不可与 review 组合为专有法学名词。",
      "prudent": "adj. 谨慎的，非公文专有名词。",
      "legislative": "adj. 立法的，与法庭司法审查（judicial review）性质相反。"
    },
    translation: "民权倡导组织向欧洲人权法院提起申诉，请求对新近通过的监控法案进行司法审查。"
  },

  // ==========================================
  // Group 16: deteriorate, degenerate, retrogress, decline (FIELD_CHANGE)
  // ==========================================
  {
    id: "tem8_16_1",
    group_id: 116,
    group_name: "deteriorate, degenerate, retrogress, decline",
    level: "TEM-8",
    target_word: "degenerate",
    question: "What began as a civilized intellectual debate soon ___ into a chaotic brawl marked by personal insults and petty vitriol.",
    options: ["deteriorate", "degenerate", "retrogress", "decline"],
    answer: "degenerate",
    primary_mechanism: "MECH_CONNOTATION",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_CHANGE",
    anchor_clue: "固定搭配 'degenerate into' 蜕变堕落成低级下流的混乱打斗，贬义语义韵强烈。",
    distractor_analysis: {
      "degenerate": "v. 侧重性质、品格或事态“蜕化、堕落、恶化退化为低劣下流的状态”（固定介词搭配 degenerate into insults/chaos）。",
      "deteriorate": "v. 侧重客观状况、健康、天气或关系的“恶化变糟”，不常接 into + 混乱低级形式。",
      "retrogress": "v. 偏向学术用语的“历史或进化倒退”，语境不符。",
      "decline": "v. 侧重数量、威力或经济实力的“下降、衰退”。"
    },
    translation: "原本一场文质彬彬的学术辩论，很快就堕落蜕变为一场充斥着人身攻击与狭隘攻讦的混乱混战。"
  },
  {
    id: "tem8_16_2",
    group_id: 116,
    group_name: "deteriorate, degenerate, retrogress, decline",
    level: "TEM-8",
    target_word: "deteriorate",
    question: "As the extreme heatwave entered its fourth consecutive week, the patient's respiratory condition ___ at an alarming rate.",
    options: ["deteriorate", "degenerate", "retrogress", "decline"],
    answer: "deteriorate",
    primary_mechanism: "MECH_NUANCE",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_CHANGE",
    anchor_clue: "搭配病情与客观身体状况恶化 'respiratory condition deteriorated at an alarming rate'。",
    distractor_analysis: {
      "deteriorate": "v. 经典医学与自然环境用词，专指健康状况、病情、气候条件“不断恶化、每况愈下”（condition deteriorated）。",
      "degenerate": "v. 侧重道德品质上的败坏或事态变质，不形容单纯生理病理指标变差。",
      "retrogress": "v. 历史倒退，不用于生命体征。",
      "decline": "v. 虽可形容衰落，但语气不如 deteriorate 紧迫和严重。"
    },
    translation: "随着极端热浪进入连续第四周，这名患者的呼吸系统病情以惊人的速度恶化。"
  },

  // ==========================================
  // Group 17: capricious, mercurial, volatile, erratic (FIELD_NATURE)
  // ==========================================
  {
    id: "tem8_17_1",
    group_id: 117,
    group_name: "capricious, mercurial, volatile, erratic",
    level: "TEM-8",
    target_word: "mercurial",
    question: "Known for his ___ temperament, the theater director could pivot in seconds from radiant jubilation to thunderous, screaming fury.",
    options: ["capricious", "mercurial", "volatile", "erratic"],
    answer: "mercurial",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_NATURE",
    anchor_clue: "形容艺术名家性情如水银般阴晴不定 'mercurial temperament ... pivot in seconds from jubilation to fury'。",
    distractor_analysis: {
      "mercurial": "adj. 词源出自墨丘利神（水银），专指人的才华性格“敏捷多变、喜怒无常、阴晴莫测”（mercurial temperament）。",
      "volatile": "adj. 偏向政经金融或化学气体的易挥发、暴烈不稳定（volatile markets）。",
      "capricious": "adj. 强调任性胡来、毫无根据地一时冲动改变主意。",
      "erratic": "adj. 侧重运行轨道、节律古怪不稳定，偏机械属性。"
    },
    translation: "这位戏剧导演以喜怒无常的性情著称，几秒钟内便能从容光焕发的狂喜突变为雷霆万钧的狂怒。"
  },
  {
    id: "tem8_17_2",
    group_id: 117,
    group_name: "capricious, mercurial, volatile, erratic",
    level: "TEM-8",
    target_word: "volatile",
    question: "Financial authorities abruptly halted trading after a spike in geopolitical tensions made the commodities market dangerously ___.",
    options: ["capricious", "mercurial", "volatile", "erratic"],
    answer: "volatile",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_NATURE",
    anchor_clue: "大宗商品金融市场动荡不稳定 'commodities market dangerously volatile'。",
    distractor_analysis: {
      "volatile": "adj. 权威财经政经核心用词，固定搭配市场、局势易爆剧烈波动（volatile market/situation）。",
      "mercurial": "adj. 专指人物性格多变，不修饰宏观大宗商品交易市场。",
      "capricious": "adj. 强调个体主观任性冲动，缺乏金融暴烈波动的严密性。",
      "erratic": "adj. 侧重偏离常规轨迹，不如 volatile 传神表达暴跌暴涨的危险态势。"
    },
    translation: "在地缘政治紧张局势骤然升级导致大宗商品市场出现极度危险的剧烈动荡后，金融监管机构紧急叫停了交易。"
  },

  // ==========================================
  // Group 18: connive, conspire, collude, scheme (FIELD_RELATION / Collocation)
  // ==========================================
  {
    id: "tem8_18_1",
    group_id: 118,
    group_name: "connive, conspire, collude, scheme",
    level: "TEM-8",
    target_word: "connive",
    question: "Whistleblowers alleged that senior port inspectors had actively ___ at contraband smuggling by deliberately disabling security scanners.",
    options: ["connive", "conspire", "collude", "scheme"],
    answer: "connive",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_CONNOTATION",
    field: "FIELD_RELATION",
    anchor_clue: "固定介词搭配 'connive AT contraband smuggling'，指放任纵容默许违法行为。",
    distractor_analysis: {
      "connive": "v. 专八高频搭配动词，固定接介词 AT（connive at sth.），专指“默许、纵容、包庇罪行”（睁一只眼闭一只眼）。",
      "conspire": "v. 密谋、图谋，接 with sb. 或 to do sth.，不搭配 at contraband。",
      "collude": "v. 串通勾结，通常接 with 或 in，不接 at。",
      "scheme": "v. 耍阴谋密谋，及物动词或接 for/to do。"
    },
    translation: "举报人指控资深港口稽查员故意关闭安检扫描仪，公然对违禁品走私活动予以默许纵容。"
  },
  {
    id: "tem8_18_2",
    group_id: 118,
    group_name: "connive, conspire, collude, scheme",
    level: "TEM-8",
    target_word: "collude",
    question: "Antitrust regulators penalized the telecom giants after evidence confirmed they had secretly ___ to fix mobile data prices.",
    options: ["connive", "conspire", "collude", "scheme"],
    answer: "collude",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_RELATION",
    anchor_clue: "反垄断寡头共谋固定搭配 'collude to fix prices'（反垄断价格串通）。",
    distractor_analysis: {
      "collude": "v. 反垄断法与政经专用术语，专指寡头企业之间“暗中勾结、非法串通”（collude to fix prices/rig bids）。",
      "connive": "v. 纵容默许渎职，不指企业间主动协议串通控价。",
      "conspire": "v. 泛指密谋犯罪，商业反垄断语境专有程度不如 collude。",
      "scheme": "v. 暗中策划，语阶偏通用口语色彩。"
    },
    translation: "反垄断监管机构在掌握确凿证据证实数家电信巨头暗中非法串通操纵移动数据价格后，对其处以了巨额罚款。"
  },

  // ==========================================
  // Group 19: wreak, inflict, impose, execute (FIELD_CHANGE / Collocation)
  // ==========================================
  {
    id: "tem8_19_1",
    group_id: 119,
    group_name: "wreak, inflict, impose, execute",
    level: "TEM-8",
    target_word: "wreak",
    question: "The catastrophic cyclone made landfall at midnight, ___ unprecedented havoc across the unfortified agricultural heartland.",
    options: ["wreak", "inflict", "impose", "execute"],
    answer: "wreak",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_CONNOTATION",
    field: "FIELD_CHANGE",
    anchor_clue: "英语最经典强连带动宾搭配之一 'wreak havoc'（造成毁灭性破坏）。",
    distractor_analysis: {
      "wreak": "v. 专八顶级固定动宾连带（Lexical Priming），必考搭配 'wreak havoc/destruction/vengeance'（造成浩劫/肆虐破坏）。",
      "inflict": "v. 接 pain, injury, damage, defeat upon sb.，不接 havoc。",
      "impose": "v. 强加关税、制裁或限制（impose tariffs/sanctions）。",
      "execute": "v. 执行命令、处决犯人，语意不合。"
    },
    translation: "这场灾难性的飓风在半夜登陆，对未设防的农业腹地造成了前所未有的毁灭性浩劫。"
  },
  {
    id: "tem8_19_2",
    group_id: 119,
    group_name: "wreak, inflict, impose, execute",
    level: "TEM-8",
    target_word: "inflict",
    question: "The drone strikes were calculated to ___ maximum casualties upon the entrenched command post while minimizing civilian harm.",
    options: ["wreak", "inflict", "impose", "execute"],
    answer: "inflict",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_NUANCE",
    field: "FIELD_CHANGE",
    anchor_clue: "搭配给予敌方沉重打击或伤亡 'inflict maximum casualties upon sb.'。",
    distractor_analysis: {
      "inflict": "v. 军事与法律标准搭配，指主动施加打击、伤亡或创伤（inflict casualties/damage/punishment UPON sb.）。",
      "wreak": "v. 专配 havoc/vengeance，不可接 casualties 作为直接宾语。",
      "impose": "v. 强制推行制度法令，不指造成肉体伤亡。",
      "execute": "v. 执行任务或死刑处决，语法结构不同。"
    },
    translation: "这次无人机精确打击旨在对固守的指挥所造成最大程度的伤亡，同时将对平民的附带伤害降至最低。"
  },

  // ==========================================
  // Group 20: broker, negotiate, mediate, arbitrate (FIELD_RELATION / Collocation)
  // ==========================================
  {
    id: "tem8_20_1",
    group_id: 120,
    group_name: "broker, negotiate, mediate, arbitrate",
    level: "TEM-8",
    target_word: "broker",
    question: "After seventy-two hours of intense diplomatic deadlock, the United Nations envoy successfully ___ a fragile temporary ceasefire.",
    options: ["broker", "negotiate", "mediate", "arbitrate"],
    answer: "broker",
    primary_mechanism: "MECH_COLLOCATION",
    secondary_mechanism: "MECH_REGISTER",
    field: "FIELD_RELATION",
    anchor_clue: "外交居中斡旋促成协议停火经典动宾连带 'broker a fragile ceasefire/truce/agreement'。",
    distractor_analysis: {
      "broker": "v. 高阶外刊政经核心动词，专指外交家或斡旋者“居中促成、斡旋达成重大协议”（broker a ceasefire/peace/deal）。",
      "negotiate": "v. 谈判协商，主语多为争端当事方本身，作为及物动词时不如 broker a ceasefire 强调第三方的穿梭斡旋。",
      "mediate": "v. 调解居中（mediate between parties），通常不直接以协议或停火作为宾语。",
      "arbitrate": "v. 正式仲裁裁决（arbitrate disputes），带有准司法强制裁决属性。"
    },
    translation: "在长达七十二小时剑拔弩张的外交僵局之后，联合国特使终于成功斡旋达成了一项脆弱的临时停火协议。"
  },
  {
    id: "tem8_20_2",
    group_id: 120,
    group_name: "broker, negotiate, mediate, arbitrate",
    level: "TEM-8",
    target_word: "arbitrate",
    question: "The international shipping contract stipulates that any maritime salvage disputes must be referred to a London tribunal to ___.",
    options: ["broker", "negotiate", "mediate", "arbitrate"],
    answer: "arbitrate",
    primary_mechanism: "MECH_REGISTER",
    secondary_mechanism: "MECH_COLLOCATION",
    field: "FIELD_RELATION",
    anchor_clue: "合同法律争议移交独立法庭裁决 'stipulates that disputes must be referred to a tribunal to arbitrate'。",
    distractor_analysis: {
      "arbitrate": "v. 司法与国际商事公文专有动词，指作为第三方仲裁员依法“仲裁、公断纠纷”（arbitrate disputes），裁决具有法律约束力。",
      "broker": "v. 促成商业交易或停火协议，不用于法庭对纠纷的司法仲裁。",
      "mediate": "v. 民间调解，其结果无强制法律效力。",
      "negotiate": "v. 协商，由争议双方当事人主导。"
    },
    translation: "这份国际航运合同明确规定，任何海难救助纠纷均须移交伦敦仲裁庭予以法定仲裁。"
  }
];

const outputPath = path.resolve('public/data/questions_tem8.json');
fs.writeFileSync(outputPath, JSON.stringify(tem8Questions, null, 2), 'utf8');
console.log(`Successfully compiled ${tem8Questions.length} TEM-8 questions to ${outputPath}!`);
