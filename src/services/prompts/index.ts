import type { NovelParams } from '@/types'
import type { GenreItem } from '@/stores/uiStore'

const SYSTEM_PROMPT = `你是一位专业的网络小说创作助手，擅长中文网络小说的创作。你需要根据用户提供的参数，帮助生成小说的各个部分。请用中文回答，内容要符合网络小说的风格和读者期望。

重要规则：当用户指定了目标字数时，你必须严格遵守。如果要求精确字数，则输出字数必须在指定范围的±5%以内。在写作过程中时刻注意字数控制，宁可适当精简也不要超出上限。`

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildProjectContext(params: NovelParams, genres?: GenreItem[]): string {
  const genreNames = params.genre ? params.genre.split(',').filter(Boolean) : []
  const genreInfos = genreNames.map((name) => genres?.find((g) => g.name === name)).filter(Boolean) as GenreItem[]
  const genreDetail = genreInfos.length > 0
    ? genreInfos.map((gi) => `\n  【${gi.name}】定义：${gi.definition} | 标签：${gi.tagDescription} | 建议元素：${gi.suggestedElements} | 不建议元素：${gi.notSuggestedElements} | 流行设定：${gi.popularSettings}`).join('')
    : ''
  return `【小说基本信息】
- 书名：${params.topic || '未命名'}
- 类型：${genreNames.length > 0 ? genreNames.join('、') : '未指定'}${genreDetail}
- 总章数：${params.chapterCount}
- 每章字数目标：${params.wordsPerChapter}字
${params.storyPremise ? `- 故事梗概：${params.storyPremise}` : ''}
${params.narrativePerspective ? `- 叙事视角：${params.narrativePerspective}` : ''}
${params.userGuidance ? `- 创作指导：${params.userGuidance}` : ''}
${params.coreCharacters ? `- 核心角色：${params.coreCharacters}` : ''}
${params.keyItems ? `- 关键道具：${params.keyItems}` : ''}
${params.sceneLocation ? `- 场景地点：${params.sceneLocation}` : ''}
${params.timePressure ? `- 时间压力：${params.timePressure}` : ''}
${params.writingStyle ? `- 文笔风格：${params.writingStyle}` : ''}`
}

export function architecturePrompt(params: NovelParams, genres?: GenreItem[], existingCharacters?: { name: string; weight: string; age: string; personality: string; abilities: string[]; basicInfo: string }[], existingRelationships?: { from: string; to: string; type: string; description: string }[]): string {
  let existingCharBlock = ''
  if (existingCharacters && existingCharacters.length > 0) {
    existingCharBlock = `\n\n【已有角色】以下角色已存在，请将它们纳入架构，保持一致性，并在此基础上补充更多角色：\n${existingCharacters.map((c) => `- ${c.name}（${c.weight}）：年龄${c.age || '未知'}，性格：${c.personality || '未知'}，能力：${c.abilities.join('、') || '未知'}。${c.basicInfo}`).join('\n')}`
  }
  if (existingRelationships && existingRelationships.length > 0) {
    existingCharBlock += `\n\n【已有关系】\n${existingRelationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')}`
  }

  return `${buildProjectContext(params, genres)}${existingCharBlock}

请为这部小说生成完整的架构方案，包含以下六个模块：

1. **核心使命**：一句话概括整个故事的核心驱动力
2. **世界观设定**：地理、历史、势力、规则体系
3. **主线情节**：起承转合的大纲，包含3-5个关键转折点
4. **角色体系**：所有重要角色的详细设定，必须包含主角、重要配角、反派
5. **角色关系**：角色之间的关系网络
6. **叙事风格**：视角选择、节奏规划、语言风格建议

请用 JSON 格式输出，结构如下：
\`\`\`json
{
  "mission": "核心使命",
  "worldbuilding": "世界观设定（详细）",
  "plotOutline": "主线情节（详细）",
  "characters": [
    {
      "name": "角色名",
      "role": "主角/重要配角/配角/反派",
      "age": "年龄（如：18岁）",
      "personality": "性格特点描述",
      "abilities": "初始能力/实力",
      "description": "详细的人物背景、外貌、经历、成长弧线"
    }
  ],
  "relationships": [
    {
      "from": "角色A名字",
      "to": "角色B名字",
      "type": "恋人/师徒/敌对/同门/盟友/朋友/亲人/其他",
      "description": "关系描述"
    }
  ],
  "narrativeStyle": "叙事风格建议"
}
\`\`\`

注意：
- characters 必须是数组格式，请列出所有重要角色（至少5个以上），不要遗漏任何角色
- relationships 必须是数组格式，请列出所有主要角色之间的关系
- 角色名必须在 characters 中存在
- 所有字符串值必须使用双引号，绝对不要使用单引号`
}

export function novelOutlinePrompt(
  params: NovelParams,
  architecture: string,
  genres?: GenreItem[],
  characters?: { name: string; weight: string; age: string; personality: string; abilities: string[]; basicInfo: string }[],
  relationships?: { from: string; to: string; type: string; description: string }[],
): string {
  let charBlock = ''
  if (characters && characters.length > 0) {
    charBlock = `
【角色体系】（请严格基于以下角色来规划，如需新增角色请在 characterChanges 中标注）
${characters.map((c) => `- ${c.name}（${c.weight}）：年龄${c.age || '未知'}，性格：${c.personality || '未知'}，能力：${c.abilities.join('、') || '未知'}。${c.basicInfo}`).join('\n')}
`
  }
  if (relationships && relationships.length > 0) {
    charBlock += `
【角色关系】
${relationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')}
`
  }

  const stageGuidance = params.chapterCount > 50
    ? `本书共 ${params.chapterCount} 章，请自动划分为3-5个"大阶段"（根据剧情需要），每个阶段有独立的情感基调和冲突层次。`
    : `本书共 ${params.chapterCount} 章，请根据剧情需要划分为2-3个阶段。`

  return `基于以下架构，为这部小说生成全书大纲：

${buildProjectContext(params, genres)}

【小说架构】
${architecture}
${charBlock}
${stageGuidance}

每个阶段包含：
- 阶段名
- 核心主题（一句话）
- 章节范围（第X章到第Y章）
- 关键事件（3-5个）
- 情感基调（如：紧张激烈、温馨成长、悲壮沉重等）
- 角色变化要点（文字描述）
- 角色变化详情（结构化数据）

请用 JSON 数组格式输出：
\`\`\`json
[
  {
    "stageIndex": 1,
    "title": "阶段名",
    "theme": "核心主题",
    "chapterRange": [1, 10],
    "keyEvents": ["事件1", "事件2", "事件3"],
    "emotionalTone": "情感基调描述",
    "characterArcs": "角色变化要点（文字描述）",
    "characterChanges": [
      {
        "name": "角色名",
        "type": "status_update",
        "changes": {
          "age": "新年龄（如有变化）",
          "personality": "新性格特征（如有变化）",
          "abilities": ["新获得的能力"],
          "basicInfo": "补充或更新的描述",
          "location": "当前位置",
          "status": "alive 或 dead"
        }
      },
      {
        "name": "角色名",
        "type": "new_character",
        "changes": {
          "role": "配角/反派/龙套",
          "age": "年龄",
          "personality": "性格",
          "abilities": ["能力列表"],
          "description": "详细描述"
        }
      }
    ],
    "relationshipChanges": [
      {
        "from": "角色A",
        "to": "角色B",
        "action": "add 或 change",
        "type": "恋人/师徒/敌对/同门/盟友/朋友/亲人/其他",
        "description": "关系描述"
      }
    ]
  }
]
\`\`\`

注意：
- characterChanges 中的 type 为 status_update 表示已有角色的状态变化，new_character 表示本阶段新出现的角色
- status_update 中只需填写有变化的字段，无需重复未变化的字段
- relationshipChanges 中的 action 为 add 表示新增关系，change 表示关系类型发生变化
- 每个阶段都必须包含角色变化信息和情感基调
- 情感基调应与剧情节奏匹配，各阶段之间有起伏变化`
}

export function blueprintPrompt(
  params: NovelParams,
  novelOutline: string,
  genres?: GenreItem[],
  characters?: { name: string; weight: string; age: string; personality: string; abilities: string[]; basicInfo: string }[],
  relationships?: { from: string; to: string; type: string; description: string }[],
): string {
  let charBlock = ''
  if (characters && characters.length > 0) {
    charBlock = `
【角色体系】（请严格基于以下角色来规划，如需新增角色请在 characterChanges 中标注）
${characters.map((c) => `- ${c.name}（${c.weight}）：年龄${c.age || '未知'}，性格：${c.personality || '未知'}，能力：${c.abilities.join('、') || '未知'}。${c.basicInfo}`).join('\n')}
`
  }
  if (relationships && relationships.length > 0) {
    charBlock += `
【角色关系】
${relationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')}
`
  }

  return `基于以下小说大纲，生成详细的章节目录：

${buildProjectContext(params, genres)}

【小说大纲】
${novelOutline}
${charBlock}
请为全部 ${params.chapterCount} 章生成章节标题和简述。每章包含：
- 章节号
- 标题（简短有力，3-8个字）
- 一句话概要（20-50字，描述本章核心事件）
- 涉及角色（列出本章出现的角色名）
- 角色变化（如有新角色登场、角色状态变化、关系变化，在此标注）

请用 JSON 数组格式输出：
\`\`\`json
[
  {
    "chapterIndex": 1,
    "title": "章节标题",
    "summary": "一句话概要",
    "characters": ["角色A", "角色B"],
    "characterChanges": [
      {
        "name": "角色名",
        "type": "status_update",
        "changes": {
          "abilities": ["新能力"],
          "location": "新位置",
          "status": "alive 或 dead"
        }
      },
      {
        "name": "新角色名",
        "type": "new_character",
        "changes": {
          "role": "配角/反派/龙套",
          "age": "年龄",
          "personality": "性格",
          "abilities": ["能力"],
          "description": "描述"
        }
      }
    ],
    "relationshipChanges": [
      {
        "from": "角色A",
        "to": "角色B",
        "action": "add",
        "type": "朋友/敌对/恋人/师徒等",
        "description": "关系描述"
      }
    ]
  }
]
\`\`\`

注意：
- 大部分章节的 characterChanges 和 relationshipChanges 可以为空数组，只在确实有变化时才填写
- 新角色首次登场的章节必须用 new_character 类型添加
- 重要剧情转折点（如角色死亡、获得新能力、关系破裂）必须标注`
}

export interface DraftContext {
  prevChapterSummary?: string
  activeCharacters?: { name: string; status: string; location: string; emotion: string }[]
  openForeshadowing?: { type: string; content: string }[]
  currentTime?: string
  nextChapterHint?: string
  runningSummary?: string
  volumeSummaries?: { index: number; summary: string }[]
  recentSummaries?: { index: number; summary: string }[]
  prevChapterEndings?: { index: number; ending: string }[]
  recentSceneTypes?: { chapterIndex: number; sceneTypes: string[]; pacingTag: string; emotionIntensity: string }[]
  prevFullChapter?: string
  prevPrevFullChapter?: string
}

export function draftPrompt(
  params: NovelParams,
  blueprint: string,
  chapterIndex: number,
  _previousContent?: string,
  context?: DraftContext,
  genres?: GenreItem[],
  characters?: { name: string; weight: string; age: string; personality: string; abilities: string[]; basicInfo: string }[],
  relationships?: { from: string; to: string; type: string; description: string }[],
): string {
  let contextBlock = ''
  if (context) {
    const parts: string[] = []
    if (context.prevFullChapter) {
      parts.push(`【前一章完整内容】\n${context.prevFullChapter}`)
    }
    if (context.prevPrevFullChapter) {
      parts.push(`【前两章完整内容】\n${context.prevPrevFullChapter}`)
    }
    if (context.prevChapterSummary) {
      parts.push(`【前章摘要】\n${context.prevChapterSummary}`)
    }
    if (context.activeCharacters && context.activeCharacters.length > 0) {
      parts.push(`【本章相关角色当前状态】\n${context.activeCharacters.map((c) => `- ${c.name}: ${c.status}, 位置:${c.location}, 情绪:${c.emotion}`).join('\n')}`)
    }
    if (context.openForeshadowing && context.openForeshadowing.length > 0) {
      parts.push(`【未收束伏笔(请在合适时机推进或收束)】\n${context.openForeshadowing.map((f) => `- [${f.type}] ${f.content}`).join('\n')}`)
    }
    if (context.currentTime) {
      parts.push(`【当前时间线】${context.currentTime}`)
    }
    if (context.nextChapterHint) {
      parts.push(`【用户剧情指引（请优先遵循）】\n${context.nextChapterHint}`)
    }
    if (context.runningSummary) {
      parts.push(`【递进总摘要（前情回顾）】\n${context.runningSummary}`)
    }
    if (context.recentSceneTypes && context.recentSceneTypes.length > 0) {
      const sceneWarn = context.recentSceneTypes
        .flatMap((s) => s.sceneTypes)
        .reduce<Record<string, number>>((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc }, {})
      const repeated = Object.entries(sceneWarn).filter(([, c]) => c >= 3).map(([t]) => t)
      const sceneInfo = context.recentSceneTypes.map((s) => `第${s.chapterIndex + 1}章：${s.sceneTypes.join('、')}（节奏:${s.pacingTag} 情感:${s.emotionIntensity}）`).join('\n')
      let sceneBlock = `【近期已使用场景类型（请避免连续重复相同类型）】\n${sceneInfo}`
      if (repeated.length > 0) {
        sceneBlock += `\n⚠️ 注意："${repeated.join('"、"')}"在近期章节中已反复出现，请在本章使用不同的场景类型和节奏`
      }
      parts.push(sceneBlock)
    }
    if (context.recentSummaries && context.recentSummaries.length > 0) {
      parts.push(`【近10章摘要】\n${context.recentSummaries.map((s) => `第${s.index + 1}章：${s.summary}`).join('\n')}`)
    }
    if (context.prevChapterEndings && context.prevChapterEndings.length > 0) {
      parts.push(`【前几章结尾段落】\n${context.prevChapterEndings.map((e) => `--- 第${e.index + 1}章结尾 ---\n${e.ending}`).join('\n\n')}`)
    }
    if (parts.length > 0) {
      contextBlock = '\n' + parts.join('\n\n') + '\n'
    }
  }

  let charBlock = ''
  if (characters && characters.length > 0) {
    charBlock = `
【完整角色信息】
${characters.map((c) => `- ${c.name}（${c.weight}）：年龄${c.age || '未知'}，性格：${c.personality || '未知'}，能力：${c.abilities.join('、') || '未知'}。${c.basicInfo}`).join('\n')}
`
  }
  if (relationships && relationships.length > 0) {
    charBlock += `
【角色关系】
${relationships.map((r) => `- ${r.from} ←${r.type}→ ${r.to}${r.description ? `：${r.description}` : ''}`).join('\n')}
`
  }

  const wordConstraint = params.strictWordCount
    ? `- 【最重要】目标字数：${params.wordsPerChapter}字。这是硬性要求，输出字数必须严格控制在${Math.round(params.wordsPerChapter * 0.95)}~${Math.round(params.wordsPerChapter * 1.05)}字之间（${params.wordsPerChapter}字的±5%）。写到接近上限时必须立即收尾，宁可戛然而止也不要多写一个字。超出字数范围是不可接受的。`
    : `- 目标字数：${params.wordsPerChapter}字`

  const isLastChapter = chapterIndex === params.chapterCount - 1
  const isNearEnd = chapterIndex >= params.chapterCount - 2
  let foreshadowingWarning = ''
  if (context?.openForeshadowing && context.openForeshadowing.length > 0) {
    if (isLastChapter) {
      foreshadowingWarning = `\n- 【关键】这是全书最后一章！以下伏笔必须在本章全部收束/揭示，绝不能留到章后：\n${context.openForeshadowing.map((f) => `  - [${f.type}] ${f.content}`).join('\n')}`
    } else if (isNearEnd) {
      foreshadowingWarning = `\n- 【重要】本书即将完结（还剩${params.chapterCount - chapterIndex}章），请在本章开始推进以下未收束伏笔的收束工作：\n${context.openForeshadowing.map((f) => `  - [${f.type}] ${f.content}`).join('\n')}`
    }
  }

  return `请为这部小说撰写第 ${chapterIndex + 1} 章的草稿。

${buildProjectContext(params, genres)}

【章节目录】
${blueprint}
${charBlock}
${contextBlock}
要求：
${wordConstraint}
- 严格遵循角色的当前状态和位置设定
- 注意角色性格和说话风格的一致性
- 包含对话、动作、心理描写
- 节奏张弛有度${chapterIndex > 0 ? `
- 【场景衔接规则】如果本章开头的场景/时间/情绪与上一章结尾不同，必须在开头明确交代过渡；如果场景连续，自然延续即可。禁止无过渡的突兀跳转` : ''}
${foreshadowingWarning}
${params.strictWordCount ? `\n再次强调：你的输出必须在${Math.round(params.wordsPerChapter * 0.95)}~${Math.round(params.wordsPerChapter * 1.05)}字之间，这是一个字符都不能超出的硬限制。请精确控制篇幅。` : ''}

请按以下格式输出：
1. 第一行必须输出章节标题，格式为：第${chapterIndex + 1}章 章节标题（从上方【章节目录】中查找第${chapterIndex + 1}章对应的标题）
2. 空一行后开始正文
3. 章节开头必须完整自然，要有清晰的场景切入，不能从半截剧情突然出现，不能省略开头铺垫直接跳入事件中间
4. 开头应交代场景、时间、人物状态等基本信息，让读者能够自然进入本章情境

【严禁事项】
- 直接输出小说正文，从章节标题开始
- 禁止输出任何前言、说明、寒暄、解释性文字（如"好的"、"以下是..."、"根据要求..."等）
- 第一行必须是章节标题，第二行开始就是正文内容`
}

export function reviewPrompt(
  content: string,
  characters: string,
  foreshadowingList?: string,
  continuityContext?: { runningSummary?: string; recentSummaries?: { index: number; summary: string }[] },
  extraContext?: {
    blueprintChapter?: { title: string; summary: string }
    relationships?: string
  },
): string {
  let continuityBlock = ''
  if (continuityContext) {
    const parts: string[] = []
    if (continuityContext.runningSummary) {
      parts.push(`【递进总摘要】\n${continuityContext.runningSummary}`)
    }
    if (continuityContext.recentSummaries && continuityContext.recentSummaries.length > 0) {
      parts.push(`【近几章摘要】\n${continuityContext.recentSummaries.map((s) => `第${s.index + 1}章：${s.summary}`).join('\n')}`)
    }
    if (parts.length > 0) {
      continuityBlock = parts.join('\n\n') + '\n'
    }
  }

  let blueprintBlock = ''
  if (extraContext?.blueprintChapter) {
    blueprintBlock = `\n【本章计划（来自章节目录）】\n标题：《${extraContext.blueprintChapter.title}》\n计划概要：${extraContext.blueprintChapter.summary}\n请检查本章内容是否完成了上述计划中的核心事件。\n`
  }

  let relBlock = ''
  if (extraContext?.relationships) {
    relBlock = `\n【角色关系】\n${extraContext.relationships}\n`
  }

  return `请审校以下章节内容，检查一致性问题：

【章节内容】
${content}

${characters ? `【角色设定】\n${characters}\n` : ''}
${relBlock}
${foreshadowingList ? `【活跃伏笔列表】\n${foreshadowingList}\n` : ''}
${blueprintBlock}
${continuityBlock ? `${continuityBlock}\n` : ''}
请从以下维度检查：
1. 章节标题：是否有正确的章节标题（格式：第X章 标题，且位于内容第一行），标题是否与章节目录一致
2. 章节开头：开头是否完整自然，是否有清晰的场景切入（场景描写、时间交代、人物状态），是否像从半截剧情突然出现，是否缺少开头铺垫
3. 角色一致性：行为、性格、说话风格是否与设定一致，位置是否合理，已死亡角色是否不应再出场
4. 情节连贯性：是否有逻辑漏洞或前后矛盾
5. 时间线：时间推进是否合理
6. 伏笔管理：是否有遗忘的伏笔需要回收，是否有新伏笔可以埋设
7. 文笔质量：是否有重复用词、生硬表达
8. 前后连贯性：与前面章节的剧情逻辑是否一致，有无设定冲突或时间线错误
9. 场景多样性：本章的场景类型是否与前几章过度重复，是否存在连续多章使用相同叙事模式的问题
10. 过渡段质量（非首章时）：章节开头是否与上一章结尾形成了自然的场景/情绪/位置衔接，是否存在突兀跳转，场景/时间/情绪变化时是否有明确交代
11. 计划完成度：本章内容是否完成了章节目录中计划的核心事件（如果有章节目录参考）

请用 JSON 格式输出：
\`\`\`json
{
  "issues": [
    {
      "type": "character|plot|timeline|foreshadowing|style|continuity|scene_diversity|transition|blueprint",
      "severity": "high|medium|low",
      "location": "问题描述位置",
      "description": "具体问题描述",
      "suggestion": "修改建议"
    }
  ],
  "overallScore": 85,
  "summary": "总体评价"
}
\`\`\``
}

export function rewritePrompt(
  content: string,
  reviewResult: string,
  params?: NovelParams,
  extraContext?: { characters?: string; relationships?: string },
): string {
  const wordLine = params?.strictWordCount
    ? `- 【最重要】改写后的字数必须严格控制在${Math.round(params.wordsPerChapter * 0.95)}~${Math.round(params.wordsPerChapter * 1.05)}字之间（${params.wordsPerChapter}字的±5%），超出范围是不可接受的。如果原文超出此范围，必须大幅精简。`
    : params ? `- 改写后的字数与原文相近（目标${params.wordsPerChapter}字左右）`
    : '- 改写后的字数与原文相近'

  const charBlock = extraContext?.characters
    ? `\n【角色状态（请确保改写后角色描写与此一致）】\n${extraContext.characters}\n`
    : ''
  const relBlock = extraContext?.relationships
    ? `\n【角色关系（请确保改写后角色关系与此一致）】\n${extraContext.relationships}\n`
    : ''

  return `请根据审校意见改写以下章节：

【原文】
${content}

【审校意见】
${reviewResult}
${charBlock}${relBlock}
要求：
- 保持原文的整体结构和节奏
- 针对性地修复审校中指出的问题
- 不要大幅改动没有问题的部分
${wordLine}
- 必须保留章节标题（第一行的"# 第X章 标题"格式），如果原文缺少标题，必须根据章节目录补上
- 章节开头必须完整自然，有清晰的场景切入，不能从半截剧情突然出现

【严禁事项】
- 直接输出小说正文，从章节标题"# 第X章 ..."开始
- 禁止输出任何前言、说明、寒暄、解释性文字（如"好的"、"以下是改写后的..."、"根据审校意见..."等）
- 禁止在正文前后添加任何非小说内容的文字
- 第一行必须是章节标题，第二行开始就是正文内容`
}

export interface ChapterMetaExtraction {
  summary: string
  timeline: string
  foreshadowingPlanted: { type: string; content: string }[]
  foreshadowingResolved: string[]
}

export function extractChapterMetaPrompt(
  chapterIndex: number,
  chapterContent: string,
  existingForeshadowing?: { id: string; type: string; content: string; status: string }[],
): string {
  let fsBlock = ''
  if (existingForeshadowing && existingForeshadowing.length > 0) {
    fsBlock = `
【当前已有伏笔（未收束的请注意是否在本章被回收）】
${existingForeshadowing.map((f, i) => `${i + 1}. [${f.status === 'planted' ? '未收束' : '已收束'}] ${f.content}`).join('\n')}
`
  }

  return `请分析以下章节内容，提取结构化元数据。

【第 ${chapterIndex + 1} 章正文】
${chapterContent.slice(0, 8000)}
${fsBlock}
请用 JSON 格式输出：
\`\`\`json
{
  "summary": "本章概要（50-100字，描述核心事件和情节推进）",
  "timeline": "本章结束时的故事时间点（如：修炼第三天黄昏）",
  "sceneTypes": ["场景类型1", "场景类型2"],
  "pacingTag": "tension 或 calm 或 transition",
  "emotionIntensity": "high 或 medium 或 low",
  "foreshadowingPlanted": [
    {"type": "主线伏笔|动作伏笔|角色伏笔|设定伏笔|预言伏笔", "content": "伏笔内容描述"}
  ],
  "foreshadowingResolved": ["已收束的已有伏笔的内容描述（必须与上方列表中的内容匹配）"],
  "characterChanges": [
    {
      "name": "角色名",
      "type": "status_update",
      "changes": {
        "abilities": ["新获得的能力"],
        "location": "角色当前位置",
        "status": "alive 或 dead"
      }
    },
    {
      "name": "新角色名",
      "type": "new_character",
      "changes": {
        "role": "配角/反派/龙套",
        "age": "年龄",
        "personality": "性格",
        "abilities": ["能力"],
        "description": "描述"
      }
    }
  ],
  "relationshipChanges": [
    {
      "from": "角色A",
      "to": "角色B",
      "action": "add 或 change",
      "type": "朋友/敌对/恋人/师徒等",
      "description": "关系描述"
    }
  ]
}
\`\`\`

场景类型参考（从中选取1-3个最匹配的，也可自行概括）：战斗升级、修炼突破、密谋揭露、感情升温、日常闲聊、探险发现、危机降临、背叛反转、谈判博弈、回忆穿插、训练成长、追杀逃亡、祭祀仪式、情报收集、情感告白、势力冲突、解谜揭秘、救援行动、权力更迭、离别重逢

注意：
- summary 要涵盖本章的主要事件、角色变化和情节推进
- timeline 要具体到故事内的时间节点
- pacingTag：tension=紧张高压、calm=舒缓平静、transition=过渡衔接
- emotionIntensity：high=强烈情绪冲击、medium=中等情绪波动、low=平淡冷静
- foreshadowingPlanted 只提取本章新埋设的伏笔
- foreshadowingResolved 是本章中已经回收的已有伏笔
- characterChanges 中 status_update 表示已有角色的状态变化，new_character 表示本章新出现的角色
- relationshipChanges 中 add 表示新增关系，change 表示关系类型发生变化
- 如果没有角色变化或关系变化，对应数组留空`
}

export function nextChapterPredictionPrompt(
  chapterIndex: number,
  blueprint: string,
): string {
  return `根据章节目录，用一句话描述第 ${chapterIndex + 2} 章可能的剧情走向。

【章节目录】
${blueprint}

只输出一句话，不要加编号、不要换行。`
}

export function blueprintDedupPrompt(
  chapters: { chapterIndex: number; title: string; summary: string }[],
): string {
  const chapterList = chapters.map((c) => `第${c.chapterIndex + 1}章《${c.title}》：${c.summary}`).join('\n')
  return `请分析以下章节目录，检测情节结构是否存在重复或雷同的章节。

【所有章节目录】
${chapterList}

请检查：
1. 是否有多章使用了相同或高度相似的叙事模式（如多次"遭遇强敌→绝境→突破"）
2. 是否有多章的核心冲突类型相同
3. 角色成长路径是否单调重复
4. 场景变换是否缺乏多样性

请用 JSON 格式输出：
\`\`\`json
{
  "duplicateGroups": [
    {
      "chapters": [3, 7, 15],
      "reason": "雷同原因描述",
      "suggestion": "替换方案建议"
    }
  ],
  "overallScore": 8,
  "summary": "整体评价"
}
\`\`\`

注意：
- duplicateGroups 只列出真正雷同的章节组，如果整体结构多样则为空数组
- overallScore 为1-10分，10分表示完全无重复
- 只输出 JSON，不要加其他内容`
}

export function blueprintDedupRewritePrompt(
  chapters: { chapterIndex: number; title: string; summary: string }[],
  targets: { chapterIndex: number; currentTitle: string; currentSummary: string; reason: string; suggestion: string }[],
): string {
  const allTitles = chapters.map((c) => `《${c.title}》`).join('、')
  const chapterList = chapters.map((c) => `第${c.chapterIndex + 1}章《${c.title}》：${c.summary}`).join('\n')
  const targetList = targets.map((t) =>
    `第${t.chapterIndex + 1}章《${t.currentTitle}》| 雷同原因：${t.reason} | 替换建议：${t.suggestion}`
  ).join('\n')

  return `以下章节目录中，部分章节被标记为需要重写（标题和摘要都有重复）。请为这些章节生成全新的标题和摘要。

【完整章节目录（供参考连贯性）】
${chapterList}

【必须重写的章节（只重写以下章节，其他章节保持不变）】
${targetList}

【严格规则】
1. 只重写上面列出的章节，不要修改其他任何章节
2. 每个新标题必须是独一无二的，绝对禁止与以下任何已有标题相同：${allTitles}
3. 重写后的章节之间也不能有相同标题，每个标题都必须完全不同
4. 参考"替换建议"方向生成完全不同的情节走向
5. 保持与前后的情节连贯性，不要引入矛盾
6. 标题风格与其他章节保持一致（2-4字为佳）
7. 摘要控制在30-60字
8. 所有字符串值必须使用双引号，不要使用单引号

请严格按以下 JSON 格式输出重写结果（chapterIndex 必须与上面列出的章节号对应）：
\`\`\`json
[
  { "chapterIndex": ${targets[0]?.chapterIndex ?? 0}, "title": "新标题A", "summary": "新摘要A" },
  { "chapterIndex": ${targets[1]?.chapterIndex ?? 1}, "title": "新标题B", "summary": "新摘要B" }
]
\`\`\`

只输出被重写的章节 JSON 数组。`
}

export function regenerateSummaryPrompt(
  chapterIndex: number,
  fullContent: string,
): string {
  return `请根据以下章节的完整内容，生成一份精准的章节摘要。

【第 ${chapterIndex + 1} 章完整内容】
${fullContent.slice(0, 10000)}

请输出 50-100 字的摘要，要求：
- 涵盖本章核心事件和情节推进
- 包含关键角色变化
- 只输出摘要正文，不要加标题或其他内容`
}

export function updateRunningSummaryPrompt(
  oldSummary: string,
  newChapterSummary: string,
  chapterIndex: number,
): string {
  const isNew = !oldSummary
  const oldParsed = !isNew ? tryParseStructuredSummary(oldSummary) : null

  return `你是一个小说剧情整理助手。请根据新的章节摘要，更新结构化递进总摘要。

${!isNew && oldParsed ? `【当前结构化摘要】
主线进展：${oldParsed.mainPlotProgress}
活跃冲突：${oldParsed.activeConflicts.join('；')}
未解之谜：${oldParsed.unresolvedMysteries.join('；')}
情感基调：${oldParsed.emotionalTone}
近期事件：${oldParsed.recentEvents.join('；')}
势力格局：${oldParsed.powerBalance}
重大转折点：${oldParsed.keyTurningPoints.join('；')}` : isNew ? '（暂无总摘要，这是第一章）' : `【当前递进总摘要（纯文本）】\n${oldSummary}`}

【第 ${chapterIndex + 1} 章摘要】
${newChapterSummary}

请输出更新后的结构化摘要，严格使用以下 JSON 格式：
\`\`\`json
{
  "mainPlotProgress": "当前主线进展（1-2句话）",
  "activeConflicts": ["当前活跃冲突1", "当前活跃冲突2"],
  "unresolvedMysteries": ["未解之谜1", "未解之谜2"],
  "emotionalTone": "当前情感基调（如：紧张、温馨、悲壮、轻松等）",
  "recentEvents": ["最近3-5章的关键事件"],
  "powerBalance": "势力/力量格局的当前状态",
  "keyTurningPoints": ["重大转折点1", "重大转折点2"]
}
\`\`\`

注意：
- mainPlotProgress 要概括到第 ${chapterIndex + 1} 章为止的主线进展
- activeConflicts 列出当前正在进行的冲突
- unresolvedMysteries 列出尚未解决的谜团
- recentEvents 只保留最近3-5个事件，更早的可以删除
- keyTurningPoints 是全书重大转折点列表，只增不减，即使写到后期也要保留早期的重要转折
- 只输出 JSON，不要加其他内容`
}

function tryParseStructuredSummary(text: string): { mainPlotProgress: string; activeConflicts: string[]; unresolvedMysteries: string[]; emotionalTone: string; recentEvents: string[]; powerBalance: string; keyTurningPoints: string[] } | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (parsed.mainPlotProgress) return parsed as typeof parsed
    return null
  } catch {
    return null
  }
}

// ==================== Full Novel Review (4-pass) ====================

export const FULL_REVIEW_DIMENSIONS = {
  pass1: ['整体架构', '主线情节', '情节连贯性', '节奏控制', '角色成长弧线', '伏笔管理', '段落衔接', '高潮设计', '结局满意度', '主题深度'],
  pass2: ['开篇吸引力', '世界观构建', '主角塑造', '文笔风格', '对话质量', '场景描写', '情感渲染', '读者代入感'],
  pass3: ['冲突升级', '配角塑造', '伏笔运用', '节奏变化', '情感张力', '世界观扩展', '叙事视角一致性'],
  pass4: ['高潮爆发力', '伏笔回收率', '角色结局合理性', '主题升华', '情感余韵', '结局完整性'],
} as const

export type ReviewPass = 'pass1' | 'pass2' | 'pass3' | 'pass4'

export const PASS_LABELS: Record<ReviewPass, string> = {
  pass1: '结构总览',
  pass2: '开篇审核',
  pass3: '中段采样',
  pass4: '结局审核',
}

export function fullReviewPass1Prompt(data: {
  runningSummary: string
  chapterSummaries: { index: number; summary: string }[]
  architecture: string
  characters: { name: string; weight: string; basicInfo: string }[]
  foreshadowings: { type: string; content: string; status: string; plantedChapter: number; resolvedChapter?: number }[]
}): string {
  const summaryList = data.chapterSummaries.map((s) => `第${s.index + 1}章：${s.summary}`).join('\n')
  const charList = data.characters.map((c) => `${c.name}(${c.weight})：${c.basicInfo}`).join('\n')
  const fsList = data.foreshadowings.map((f) =>
    `[${f.type}] ${f.content} (第${f.plantedChapter + 1}章埋${f.status === 'resolved' ? `，第${f.resolvedChapter! + 1}章收` : '，未收'})`
  ).join('\n')

  return `你是一位资深网络小说编辑，请对以下小说进行「结构总览」维度的评审。

【小说架构】
${data.architecture}

【递进总摘要】
${data.runningSummary}

【各章摘要】
${summaryList}

【角色列表】
${charList}

${fsList ? `【伏笔列表】\n${fsList}` : ''}

请从以下10个维度逐一评审，每个维度给出0-100分和简短评语：
${FULL_REVIEW_DIMENSIONS.pass1.join('、')}

评审要点提示：
- 情节连贯性：重点检查各章之间的剧情衔接是否自然，有无逻辑断裂、时间线矛盾、设定前后不一致
- 伏笔管理：埋下的伏笔是否合理收束，有无遗忘的伏笔

请用JSON输出：
\`\`\`json
{
  "dimensions": [
    { "name": "整体架构", "score": 85, "comment": "评语" },
    ...
  ],
  "passSummary": "本轮总评（一段话）"
}
\`\`\``
}

export function fullReviewPass2Prompt(data: {
  chapters: { index: number; content: string }[]
  architecture: string
  characters: { name: string; weight: string; basicInfo: string }[]
}): string {
  const chText = data.chapters.map((c) => `===== 第${c.index + 1}章 =====\n${c.content}`).join('\n\n')
  const charList = data.characters.map((c) => `${c.name}(${c.weight})：${c.basicInfo}`).join('\n')

  return `你是一位资深网络小说编辑，请对以下小说的「开篇部分」进行评审。

【小说架构】
${data.architecture}

【角色设定】
${charList}

【开篇章节原文】
${chText}

请从以下8个维度逐一评审，每个维度给出0-100分和简短评语：
${FULL_REVIEW_DIMENSIONS.pass2.join('、')}

请用JSON输出：
\`\`\`json
{
  "dimensions": [
    { "name": "开篇吸引力", "score": 85, "comment": "评语" },
    ...
  ],
  "passSummary": "本轮总评（一段话）"
}
\`\`\``
}

export function fullReviewPass3Prompt(data: {
  chapters: { index: number; content: string }[]
  adjacentSummaries: { index: number; summary: string }[]
}): string {
  const chText = data.chapters.map((c) => `===== 第${c.index + 1}章 =====\n${c.content}`).join('\n\n')
  const sumText = data.adjacentSummaries.map((s) => `第${s.index + 1}章：${s.summary}`).join('\n')

  return `你是一位资深网络小说编辑，请对以下小说的「中段」进行采样评审。

【相邻章节摘要（提供上下文）】
${sumText}

【采样章节原文】
${chText}

请从以下7个维度逐一评审，每个维度给出0-100分和简短评语：
${FULL_REVIEW_DIMENSIONS.pass3.join('、')}

请用JSON输出：
\`\`\`json
{
  "dimensions": [
    { "name": "冲突升级", "score": 85, "comment": "评语" },
    ...
  ],
  "passSummary": "本轮总评（一段话）"
}
\`\`\``
}

export function fullReviewPass4Prompt(data: {
  chapters: { index: number; content: string }[]
  foreshadowings: { type: string; content: string; status: string; plantedChapter: number; resolvedChapter?: number }[]
}): string {
  const chText = data.chapters.map((c) => `===== 第${c.index + 1}章 =====\n${c.content}`).join('\n\n')
  const fsList = data.foreshadowings.map((f) =>
    `[${f.type}] ${f.content} (${f.status === 'resolved' ? `第${f.resolvedChapter! + 1}章已收` : '未收'})`
  ).join('\n')

  return `你是一位资深网络小说编辑，请对以下小说的「结局部分」进行评审。

${fsList ? `【全部伏笔状态】\n${fsList}` : ''}

【结局章节原文】
${chText}

请从以下6个维度逐一评审，每个维度给出0-100分和简短评语：
${FULL_REVIEW_DIMENSIONS.pass4.join('、')}

请用JSON输出：
\`\`\`json
{
  "dimensions": [
    { "name": "高潮爆发力", "score": 85, "comment": "评语" },
    ...
  ],
  "passSummary": "本轮总评（一段话）"
}
\`\`\``
}

export function fullReviewSuggestionPrompt(allDimensions: { name: string; score: number; comment: string }[], overallScore: number): string {
  const dimList = allDimensions.map((d) => `${d.name}: ${d.score}分 — ${d.comment}`).join('\n')

  return `你是一位资深网络小说编辑。以下是一部小说的全文审核评分结果，综合评分 ${overallScore} 分（满分100）。

【各维度评分】
${dimList}

请给出：
1. 总体评价（2-3句话概括优缺点）
2. 针对得分最低的3个维度，给出具体可操作的整改建议（指出问题出在哪些章节，如何修改）
3. 如果某些问题严重到需要重写某些章节，明确指出

请用JSON输出：
\`\`\`json
{
  "summary": "总体评价...",
  "suggestions": ["建议1...", "建议2...", "..."]
}
\`\`\``
}
