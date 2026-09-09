import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LOOKBACK_MS = 72 * 60 * 60 * 1000;
const EDITORIAL_SECTIONS = ['industry', 'competitor', 'operations_ai'];

function cleanText(value) {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlValue(fragment, names) {
  for (const name of names) {
    const match = fragment.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return cleanText(match[1]);
  }
  return '';
}

function atomLink(fragment) {
  const match = fragment.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  return match ? cleanText(match[1]) : '';
}

function parseItems(xml) {
  const blocks = [...String(xml).matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  return blocks.map((match) => {
    const fragment = match[2];
    return {
      title: xmlValue(fragment, ['title']),
      url: xmlValue(fragment, ['link']) || atomLink(fragment),
      publishedAt: xmlValue(fragment, ['pubDate', 'published', 'updated']),
      summary: xmlValue(fragment, ['description', 'summary', 'content']),
    };
  });
}

function sourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error(`Only public HTTPS URLs are allowed: ${value}`);
  }
  return url;
}

function toCandidate(source, item) {
  let primaryUrl;
  let publishedAt;
  try {
    primaryUrl = sourceUrl(item.url).href;
    publishedAt = new Date(item.publishedAt);
  } catch {
    return null;
  }
  const headline = cleanText(item.title);
  if (!headline || Number.isNaN(publishedAt.valueOf())) return null;
  const summary = cleanText(item.summary).slice(0, 320) || '公开来源已发布该动态；请打开原文核验。';
  return {
    event_id: `${source.id}-${createHash('sha256').update(primaryUrl).digest('hex').slice(0, 16)}`,
    domain: source.domain,
    category: source.category ?? '公开动态',
    quality_level: '常规更新',
    published_at: publishedAt.toISOString(),
    headline,
    summary,
    why_it_matters: '已由公开原文核验，可点击查看完整内容。',
    primary_source: source.source,
    primary_url: primaryUrl,
    independent_source_count: 1,
    evidence_has_primary: true,
    verification_status: 'candidate',
    evidence_sources: [{ name: source.source, url: primaryUrl, kind: 'primary' }],
    korea_related: Boolean(source.korea_related),
  };
}

function validateSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('At least one public news source is required');
  for (const source of sources) {
    if (!source || typeof source.id !== 'string' || !['beauty', 'ai'].includes(source.domain)
      || typeof source.source !== 'string' || !source.source.trim()) {
      throw new Error('Invalid public news source definition');
    }
    sourceUrl(source.url);
  }
}

export async function collectPublicNews({ sources, now = new Date().toISOString(), fetchImpl = fetch }) {
  validateSources(sources);
  const nowMs = new Date(now).valueOf();
  if (Number.isNaN(nowMs)) throw new Error('Invalid public-news check time');
  const candidates = [];
  for (const source of sources) {
    let response;
    try {
      response = await fetchImpl(source.url, { credentials: 'omit', redirect: 'error' });
    } catch {
      continue;
    }
    if (!response?.ok) continue;
    let xml;
    try {
      xml = await response.text();
    } catch {
      continue;
    }
    for (const item of parseItems(xml)) {
      const candidate = toCandidate(source, item);
      if (!candidate) continue;
      const age = nowMs - new Date(candidate.published_at).valueOf();
      if (age < 0 || age > LOOKBACK_MS) continue;
      candidates.push(candidate);
    }
  }
  return candidates;
}

function publishedTime(item) {
  const time = new Date(item.published_at).valueOf();
  if (Number.isNaN(time)) throw new Error('Invalid public news timestamp');
  return time;
}

function assertNoDuplicates(items) {
  const urls = new Set();
  const titles = new Set();
  for (const item of items) {
    if (!item?.primary_url || !item?.headline || !EDITORIAL_SECTIONS.includes(item.section)) {
      throw new Error('Invalid public news item');
    }
    if (item.verification_status !== 'verified') {
      throw new Error('Public news item is not cross-verified');
    }
    const evidence = Array.isArray(item.evidence_sources) ? item.evidence_sources : [];
    const hasPrimary = evidence.some((source) => source?.kind === 'primary');
    const hasIndependent = evidence.some((source) => source?.kind === 'independent');
    if (!hasPrimary || !hasIndependent) {
      throw new Error('Verified public news requires primary and independent evidence');
    }
    for (const source of evidence) sourceUrl(source?.url);
    sourceUrl(item.primary_url);
    publishedTime(item);
    const url = item.primary_url.trim();
    const title = item.headline.trim().toLocaleLowerCase('en-US');
    if (urls.has(url) || titles.has(title)) throw new Error('Duplicate public news event');
    urls.add(url);
    titles.add(title);
  }
}

export function selectPublicNews(items) {
  assertNoDuplicates(items);
  const sorted = [...items].sort((left, right) => publishedTime(right) - publishedTime(left));
  const sectionCounts = new Map(EDITORIAL_SECTIONS.map((section) => [section, 0]));
  const selected = [];
  for (const item of sorted) {
    const count = sectionCounts.get(item.section);
    if (count >= 3) continue;
    selected.push(item);
    sectionCounts.set(item.section, count + 1);
  }
  return { items: selected.slice(0, 9) };
}

async function writeJsonAtomically(destination, value) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, destination);
}

export async function writeNewsArtifacts({ outputRoot, checkedAt, selection = null, error = null }) {
  if (!outputRoot || !checkedAt) throw new Error('outputRoot and checkedAt are required');
  const newsRoot = path.join(outputRoot, 'news');
  const status = selection && !error
    ? (selection.items.length ? 'updated' : 'checked_no_new')
    : 'review_required';
  const itemCount = selection && !error ? selection.items.length : 0;
  if (selection && !error) {
    await writeJsonAtomically(path.join(newsRoot, 'latest.json'), {
      schema_version: 2,
      generated_at: checkedAt,
      items: selection.items,
    });
  }
  await writeJsonAtomically(path.join(newsRoot, 'status.json'), {
    status,
    checked_at: checkedAt,
    item_count: itemCount,
  });
}

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(scriptPath), '..');
  const sources = JSON.parse(await readFile(path.join(root, 'news', 'sources.json'), 'utf8'));
  const checkedAt = new Date().toISOString();
  try {
    const candidates = await collectPublicNews({ sources, now: checkedAt });
    throw new Error(`${candidates.length} discovery candidates require editorial cross-verification`);
  } catch (error) {
    await writeNewsArtifacts({ outputRoot: root, checkedAt, error });
    console.warn(`Public news review required: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
