const sections = [
  { id: 'overview', title: '经营概览' },
  { id: 'brands', title: '品牌与大店表现' },
  { id: 'intelligence', title: '行业与 AI 情报' },
];

export function reportViewModel(report) {
  return {
    sections,
    units: [...(report.business_units ?? []), report.overall].filter(Boolean),
    brands: [...(report.brands ?? [])],
    stores: [...(report.stores ?? [])],
    news: [...(report.news ?? [])],
  };
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.id) node.id = options.id;
  return node;
}

function money(value) {
  if (value === null || value === undefined) return '暂无';
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(Number(value) / 10000)}万`;
}

function percent(value) {
  if (value === null || value === undefined) return '暂无';
  return new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(Number(value));
}

function addText(parent, tag, text, className) {
  const child = element(tag, { text, className });
  parent.append(child);
  return child;
}

function addSectionHeader(parent, title, note, iconText) {
  const head = element('div', { className: 'section-head' });
  const titleWrap = element('div', { className: 'title' });
  addText(titleWrap, 'span', iconText, 'section-icon');
  addText(titleWrap, 'h2', title);
  head.append(titleWrap);
  addText(head, 'span', note, 'subtle');
  parent.append(head);
}

function targetView(value, target, timeProgress) {
  const root = element('div', { className: 'target' });
  const line = element('div', { className: 'target-line' });
  const fill = element('span', { className: 'target-fill' });
  fill.style.width = `${Math.min(Math.max(Number(value ?? 0) * 100, 0), 100)}%`;
  const marker = element('i', { className: 'target-marker' });
  marker.style.left = `${Math.min(Math.max(Number(timeProgress ?? 0) * 100, 0), 100)}%`;
  line.append(fill, marker);
  const meta = element('div', { className: 'target-meta' });
  addText(meta, 'span', percent(value));
  addText(meta, 'span', target == null ? '无独立目标' : money(target));
  root.append(line, meta);
  return root;
}

function renderUnit(unit, report, day, progress) {
  const card = element('article', { className: 'card unit' });
  addText(card, 'div', unit.brand, 'unit-name');
  const sales = element('div', { className: 'sales' });
  for (const [label, value, note] of [
    ['当日净销售额', unit.daily_net_sales, report.report_date],
    ['本月累计净销售额', unit.month_net_sales, `截至${day}日`],
  ]) {
    const metric = element('div', { className: 'metric' });
    addText(metric, 'div', label, 'label');
    addText(metric, 'div', money(value), 'money');
    addText(metric, 'div', note, 'subtle');
    sales.append(metric);
  }
  const quality = element('div', { className: 'quality' });
  const returns = element('div', { className: 'quality-row' });
  const returnValue = element('div');
  addText(returnValue, 'div', '整体退货率');
  addText(returnValue, 'div', percent(unit.return_rate), 'quality-value');
  addText(returns, 'div', `本月退款金额 ${money(unit.month_refund_amount)}`, 'refund');
  returns.prepend(returnValue);
  const attainment = element('div', { className: 'quality-row' });
  const attainmentValue = element('div');
  addText(attainmentValue, 'div', '月度目标达成率');
  addText(attainmentValue, 'div', percent(unit.target_attainment), 'quality-value');
  const attainmentDetail = element('div');
  attainmentDetail.append(targetView(unit.target_attainment, unit.monthly_target, progress));
  addText(attainmentDetail, 'div', `时间进度 ${percent(progress)}`, 'subtle');
  attainment.append(attainmentValue, attainmentDetail);
  quality.append(returns, attainment);
  card.append(sales, quality);
  return card;
}

function createTable(headers) {
  const wrap = element('div', { className: 'scroll' });
  const table = element('table');
  const thead = element('thead');
  const row = element('tr');
  headers.forEach((header) => addText(row, 'th', header));
  thead.append(row);
  const body = element('tbody');
  table.append(thead, body);
  wrap.append(table);
  return { wrap, body };
}

function addCell(row, text, className) {
  addText(row, 'td', text, className);
}

function fillBrandRows(body, brands, progress) {
  body.replaceChildren();
  brands.forEach((brand, index) => {
    const row = element('tr');
    addCell(row, index + 1);
    addCell(row, brand.brand);
    addCell(row, money(brand.daily_net_sales), 'money-cell');
    addCell(row, money(brand.month_net_sales), 'money-cell');
    addCell(row, money(brand.sampling_sales), 'money-cell');
    addCell(row, percent(brand.return_rate));
    const targetCell = element('td');
    targetCell.append(targetView(brand.target_attainment, brand.monthly_target, progress));
    row.append(targetCell);
    body.append(row);
  });
}

function fillStoreRows(body, stores, progress) {
  body.replaceChildren();
  if (!stores.length) {
    const row = element('tr');
    const cell = element('td', { text: '当前筛选范围没有大店', className: 'empty' });
    cell.colSpan = 8;
    row.append(cell);
    body.append(row);
    return;
  }
  stores.forEach((store, index) => {
    const row = element('tr');
    [index + 1, store.store, store.brand, money(store.daily_net_sales), money(store.month_net_sales), money(store.sampling_sales), percent(store.return_rate)].forEach((value, cellIndex) => addCell(row, value, cellIndex >= 3 && cellIndex <= 5 ? 'money-cell' : undefined));
    const targetCell = element('td');
    if (store.target_attainment == null) targetCell.textContent = '无独立目标';
    else targetCell.append(targetView(store.target_attainment, store.monthly_target, progress));
    row.append(targetCell);
    body.append(row);
  });
}

function renderNewsCard(news) {
  const card = element('article', { className: 'news-card' });
  const badges = element('div');
  addText(badges, 'span', news.quality_level ?? '常规更新', 'level-badge');
  addText(badges, 'span', news.category ?? '', 'tag');
  if (news.korea_related) addText(badges, 'span', '韩国事业部相关', 'tag');
  card.append(badges);
  addText(card, 'h3', news.headline ?? '');
  addText(card, 'p', news.summary ?? '');
  addText(card, 'div', '值得关注', 'why');
  addText(card, 'p', news.why_it_matters ?? '');
  const source = element('div', { className: 'source' });
  addText(source, 'span', news.primary_source ?? '');
  addText(source, 'span', `${news.independent_source_count ?? 0}个独立信源`);
  if (news.primary_url) {
    const link = element('a', { text: '查看原文' });
    link.href = news.primary_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    source.append(link);
  }
  card.append(source);
  return card;
}

export function renderReport(root, report) {
  const model = reportViewModel(report);
  const reportDate = new Date(`${report.report_date}T00:00:00`);
  const days = new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 0).getDate();
  const day = Number(report.report_date.slice(-2));
  const progress = report.time_progress == null ? day / days : Number(report.time_progress);
  const page = element('div', { className: 'page' });
  const header = element('header', { className: 'head' });
  const heading = element('div');
  addText(heading, 'div', 'KOREA BUSINESS DAILY REPORT', 'eyebrow');
  addText(heading, 'h1', '韩国事业部日报');
  addText(heading, 'div', `数据截至 ${report.report_date} 23:59`, 'meta');
  header.append(heading);
  addText(header, 'div', `今日 ${day} / ${days}`, 'date');
  page.append(header);
  const nav = element('nav', { className: 'nav' });
  model.sections.forEach(({ id, title }) => {
    const link = element('a', { text: title });
    link.href = `#${id}`;
    nav.append(link);
  });
  page.append(nav);

  const overview = element('section', { className: 'section', id: 'overview' });
  addSectionHeader(overview, '经营概览', '净销售额口径', '◔');
  const unitGrid = element('div', { className: 'unit-grid' });
  model.units.forEach((unit) => unitGrid.append(renderUnit(unit, report, day, progress)));
  overview.append(unitGrid);
  page.append(overview);

  const brandsSection = element('section', { className: 'section', id: 'brands' });
  addSectionHeader(brandsSection, '品牌与大店表现', '按本月累计净销售额降序', '▦');
  const filters = element('div', { className: 'filters' });
  const brandCard = element('div', { className: 'card table-card' });
  addText(brandCard, 'div', '品牌表现对比', 'table-head');
  const brandTable = createTable(['排名', '品牌', '当日净销售额', '月累计净销售额', '派样销售额', '退货率', '月目标达成率']);
  brandCard.append(brandTable.wrap);
  const storeCard = element('div', { className: 'card table-card' });
  storeCard.style.marginTop = '14px';
  const storeHead = element('div', { className: 'table-head' });
  addText(storeHead, 'strong', '今日大店');
  const storeCount = addText(storeHead, 'span', '', 'count');
  storeCard.append(storeHead);
  const storeTable = createTable(['排名', '大店名称', '所属品牌', '当日净销售额', '月累计净销售额', '派样销售额', '退货率', '月目标达成率']);
  storeCard.append(storeTable.wrap);
  const applyFilter = (brand) => {
    const visibleBrands = brand === 'all' ? model.brands : model.brands.filter((item) => item.brand === brand);
    const visibleStores = brand === 'all' ? model.stores : model.stores.filter((item) => item.brand === brand);
    fillBrandRows(brandTable.body, visibleBrands, progress);
    fillStoreRows(storeTable.body, visibleStores, progress);
    storeCount.textContent = `${visibleStores.length}家`;
  };
  ['全部品牌', ...model.brands.map((item) => item.brand)].forEach((label, index) => {
    const button = element('button', { text: label, className: `chip${index === 0 ? ' active' : ''}` });
    button.type = 'button';
    button.addEventListener('click', () => {
      filters.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      applyFilter(index === 0 ? 'all' : label);
    });
    filters.append(button);
  });
  brandsSection.append(filters, brandCard, storeCard);
  applyFilter('all');
  page.append(brandsSection);

  const intelligence = element('section', { className: 'section', id: 'intelligence' });
  addSectionHeader(intelligence, '行业与 AI 情报', '自动聚类与独立信源验证', '◎');
  const featured = model.news.find((item) => item.section === 'featured');
  if (featured) {
    const card = renderNewsCard(featured);
    card.classList.add('card', 'feature');
    intelligence.append(card);
  }
  const columns = element('div', { className: 'news-columns' });
  for (const [sectionName, title] of [['beauty', '美妆行业变化'], ['ai', 'AI 变化']]) {
    const column = element('section', { className: 'card news-column' });
    addText(column, 'h3', title);
    const list = element('div', { className: 'news-list' });
    model.news.filter((item) => item.section === sectionName).slice(0, 2).forEach((item) => list.append(renderNewsCard(item)));
    if (!list.childElementCount) addText(list, 'div', '新闻数据不完整', 'empty');
    column.append(list);
    columns.append(column);
  }
  intelligence.append(columns);
  page.append(intelligence);
  addText(page, 'footer', '页面仅展示已发布快照，同一新闻事件已合并重复转载。');
  root.replaceChildren(page);
}

function renderPublicationList(root, title, publications) {
  const page = element('div', { className: 'page' });
  addText(page, 'h1', title);
  const list = element('div', { className: 'unit-grid' });
  publications.forEach((publication) => {
    const link = element('a', { className: 'card feature' });
    link.href = publication.path ?? `./daily/${publication.report_date}/`;
    addText(link, 'strong', publication.label ?? publication.report_date);
    list.append(link);
  });
  page.append(list);
  root.replaceChildren(page);
}

export function renderHome(root, payload) {
  const publications = [payload.latest, ...(payload.history ?? [])].filter(Boolean);
  renderPublicationList(root, '韩国事业部日报', publications);
}

export function renderHistory(root, payload) {
  renderPublicationList(root, '历史日报', payload.publications ?? []);
}
