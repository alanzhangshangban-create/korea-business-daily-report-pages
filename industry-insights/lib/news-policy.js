export const ALLOWED_CATEGORIES = ['美妆', '护肤', '宠物保健', 'Target集团', '电商AI'];
export const ALLOWED_LEVELS = ['重大变化', '重要动态', '常规更新'];
export const ALLOWED_EVIDENCE_TYPES = [
  'regulatorInterpretation',
  'professionalImplementation',
  'industryAssociationInterpretation',
  'companyResponse'
];
export const FORBIDDEN_TERMS = [
  '管理层判断', '丽人启示', '建议行动', '后续措施', '业务Tracking', '业务 tracking',
  '目标达成率', '风险店铺', '内部预算', '内部目标', '待定'
];

function sourceGate(sources = []) {
  const official = sources.filter(source => source.kind === 'official').length;
  const independent = sources.filter(source => source.kind !== 'official').length;
  return (official >= 1 && independent >= 1) || independent >= 3;
}

export function requiresImplementationEvidence(news) {
  return ['policy', 'standard'].includes(news.eventType);
}

export function validateIssues(issues) {
  const errors = [];
  for (const issue of issues) {
    if (issue.items.length > 6) errors.push(`${issue.id} 新闻数量超过6条`);
    const categoryCounts = new Map();
    for (const news of issue.items) {
      categoryCounts.set(news.category, (categoryCounts.get(news.category) || 0) + 1);
      if (!ALLOWED_CATEGORIES.includes(news.category)) errors.push(`${news.id} 使用了未允许板块`);
      if (!ALLOWED_LEVELS.includes(news.level)) errors.push(`${news.id} 事件等级无效`);
      if (news.score < 70) errors.push(`${news.id} 评分低于70分`);
      if (!Array.isArray(news.industryImpact) || news.industryImpact.length < 1 || news.industryImpact.length > 3) errors.push(`${news.id} 行业影响需包含1至3点`);
      if (!sourceGate(news.sources)) errors.push(`${news.id} 来源未通过核验门槛`);
      for (const source of news.sources) {
        if (!source.url.startsWith('https://')) errors.push(`${news.id} 存在非HTTPS来源`);
      }
      if (requiresImplementationEvidence(news)) {
        if (!Array.isArray(news.implementationEvidence) || news.implementationEvidence.length === 0) {
          errors.push(`${news.id} 缺少落地证据`);
        } else {
          for (const evidence of news.implementationEvidence) {
            if (!ALLOWED_EVIDENCE_TYPES.includes(evidence.type)) errors.push(`${news.id} 落地证据类型无效`);
            if (!evidence.sourceUrl?.startsWith('https://')) errors.push(`${news.id} 落地证据存在非HTTPS来源`);
          }
        }
      }
      const body = `${news.title} ${news.summary} ${(news.industryImpact || []).join(' ')}`.toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        if (body.includes(term.toLowerCase())) errors.push(`${news.id} 包含敏感或禁用表述：${term}`);
      }
    }
    for (const [category, count] of categoryCounts) {
      if (count > 2) errors.push(`${issue.id} 的${category}板块超过2条`);
    }
  }
  return errors;
}

export function getLatestIssue(issues) {
  if (!issues.length) return null;
  return [...issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
