import { issues } from '../data/issues.js';
import { getLatestIssue, validateIssues } from '../lib/news-policy.js';

const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function categoryIcon(category) {
  const common = 'class="category-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    美妆: `<svg ${common}><path d="m12 3 1.25 4.15L17 9l-3.75 1.85L12 15l-1.25-4.15L7 9l3.75-1.85L12 3Z"/><path d="m18.5 14 .72 2.28L21.5 17l-2.28.72L18.5 20l-.72-2.28L15.5 17l2.28-.72L18.5 14Z"/></svg>`,
    护肤: `<svg ${common}><path d="M12 3.2S6.5 9.5 6.5 14a5.5 5.5 0 0 0 11 0c0-4.5-5.5-10.8-5.5-10.8Z"/><path d="M9.5 14.5a2.7 2.7 0 0 0 2.7 2.7"/></svg>`,
    宠物保健: `<svg ${common}><circle cx="7" cy="8" r="1.7"/><circle cx="17" cy="8" r="1.7"/><circle cx="9.2" cy="4.8" r="1.5"/><circle cx="14.8" cy="4.8" r="1.5"/><path d="M12 10.2c-3.1 0-5.5 2.7-5.5 5.1 0 2 1.6 3.5 3.5 3.5.8 0 1.4-.4 2-.4s1.2.4 2 .4c1.9 0 3.5-1.5 3.5-3.5 0-2.4-2.4-5.1-5.5-5.1Z"/></svg>`,
    Target集团: `<svg ${common}><path d="M4 20V8l8-4 8 4v12"/><path d="M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/></svg>`,
    电商AI: `<svg ${common}><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>`
  };
  return icons[category] || icons['电商AI'];
}

function newsCard(news, featured = false) {
  const primaryUrl = news.sources[0]?.url || '#';
  const sources = news.sources.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>`).join('');
  const impact = news.industryImpact.map(point => escapeHtml(point)).join(' ');
  return `<article class="news-card${featured ? ' featured' : ''}">
    <div class="card-meta"><span class="category-badge">${categoryIcon(news.category)}<span class="category category-${escapeHtml(news.category)}">${escapeHtml(news.category)}</span></span><span>${escapeHtml(news.level)}</span><span>${escapeHtml(news.publishedAt)}</span></div>
    <h2><a class="headline-link" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener noreferrer" aria-label="阅读源稿：${escapeHtml(news.title)}">${escapeHtml(news.title)}</a></h2>
    <p>${escapeHtml(news.summary)}</p>
    <section class="impact" aria-label="影响分析"><h3>影响分析</h3><p>${impact}</p></section>
    <div class="card-foot"><span class="score" aria-label="筛选评分${news.score}分"><strong>${news.score}</strong>分</span><span class="verified">已核验 ${news.sources.length} 个来源</span></div>
    <div class="sources" aria-label="新闻来源">${sources}</div>
  </article>`;
}

export function renderIssueMarkup(issue) {
  if (!issue.items.length) return `<section class="empty"><p>本期无达到发布标准的重要行业动态</p></section>`;
  const ordered = [...issue.items].sort((a,b) => b.score - a.score);
  return `<section class="issue-heading"><p class="date-range">${escapeHtml(issue.dateRange)}</p><h1>公开行业新闻</h1><p>${ordered.length}条经核验的重要动态</p></section>
    <section class="featured-wrap"><div class="section-label">本周重点</div>${newsCard(ordered[0], true)}</section>
    <section class="news-list"><div class="section-label">行业动态</div>${ordered.slice(1).map(item => newsCard(item)).join('')}</section>`;
}

export function renderHistoryMarkup(allIssues) {
  const sorted = [...allIssues].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  return `<section class="issue-heading"><h1>历史期次</h1><p>按更新时间倒序排列，仅保留已核验的公开信息。</p></section><div class="history-list">${sorted.map(issue => {
    const categories = [...new Set(issue.items.map(item => item.category))].join(' · ');
    return `<a class="history-row" href="#issue=${escapeHtml(issue.id)}"><span><strong>${escapeHtml(issue.dateRange)}</strong><small>${escapeHtml(categories)}</small></span><em>${issue.items.length}条</em></a>`;
  }).join('')}</div>`;
}

function route() {
  const hash = location.hash || '#latest';
  const main = document.querySelector('#content');
  const latest = getLatestIssue(issues);
  document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.getAttribute('href') === hash || (hash.startsWith('#issue=') && link.dataset.route === 'history')));
  if (hash === '#history') main.innerHTML = renderHistoryMarkup(issues);
  else if (hash.startsWith('#issue=')) main.innerHTML = renderIssueMarkup(issues.find(issue => issue.id === hash.slice(7)) || latest);
  else main.innerHTML = renderIssueMarkup(latest);
  window.scrollTo({top:0, behavior:'instant'});
}

if (typeof document !== 'undefined') {
  const errors = validateIssues(issues);
  const main = document.querySelector('#content');
  if (errors.length) main.innerHTML = `<section class="empty"><p>内容核验未通过，本期暂不展示。</p></section>`;
  else { window.addEventListener('hashchange', route); route(); }
}
