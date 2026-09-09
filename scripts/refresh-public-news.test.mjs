import assert from 'node:assert/strict';
import test from 'node:test';

import { selectPublicNews } from './refresh-public-news.mjs';

function verifiedItem(id, section, publishedAt = '2026-09-09T07:00:00.000Z') {
  return {
    event_id: id,
    section,
    category: section,
    headline: `headline-${id}`,
    summary: `summary-${id}`,
    why_it_matters: `impact-${id}`,
    primary_source: `source-${id}`,
    primary_url: `https://official.example.com/${id}`,
    published_at: publishedAt,
    evidence_has_primary: true,
    verification_status: 'verified',
    evidence_sources: [
      { name: 'Official', url: `https://official.example.com/${id}`, kind: 'primary' },
      { name: 'Independent', url: `https://media.example.com/${id}`, kind: 'independent' },
    ],
  };
}

test('selects up to three verified items per editorial section without filling a quota', () => {
  const items = [
    verifiedItem('i1', 'industry'),
    verifiedItem('i2', 'industry', '2026-09-09T06:00:00.000Z'),
    verifiedItem('c1', 'competitor'),
  ];
  const selected = selectPublicNews(items);
  assert.equal(selected.items.length, 3);
  assert.deepEqual(selected.items.map((item) => item.event_id), ['i1', 'c1', 'i2']);
});

test('rejects discovery-only RSS candidates that have not been cross-verified', () => {
  const item = verifiedItem('candidate', 'industry');
  item.verification_status = 'candidate';
  assert.throws(() => selectPublicNews([item]), /cross-verified/i);
});

test('rejects a verified item without independent evidence', () => {
  const item = verifiedItem('one-source', 'industry');
  item.evidence_sources = item.evidence_sources.slice(0, 1);
  assert.throws(() => selectPublicNews([item]), /independent evidence/i);
});

test('caps each section at three items and the result at nine', () => {
  const items = ['industry', 'competitor', 'operations_ai'].flatMap((section) =>
    [1, 2, 3, 4].map((index) => verifiedItem(`${section}-${index}`, section)));
  const selected = selectPublicNews(items);
  assert.equal(selected.items.length, 9);
  for (const section of ['industry', 'competitor', 'operations_ai']) {
    assert.equal(selected.items.filter((item) => item.section === section).length, 3);
  }
});
