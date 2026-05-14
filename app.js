// 每日行情前端
// 数据：data/index.json（manifest）+ data/{date}-{slot}.json + data/{date}-{slot}-onchain.json
// 每日早盘 09:00 由本地 _fetch.py + _fetch_dex.py 生成后 publish.sh 推送
// slot 不再硬编码：从 manifest.by_date[date].slots 动态选择

const SLOT_PRIORITY = ['早盘', '晚盘', '午盘', '凌晨'];

const state = {
  date: null,
  slot: null,
  data: null,
  onchain: null,
  manifest: null,
  activeTab: 'radar',
};

function pickSlot(date) {
  const slots = state.manifest?.by_date?.[date]?.slots || [];
  for (const s of SLOT_PRIORITY) {
    if (slots.includes(s)) return s;
  }
  return slots[0] || '早盘';
}

// ===== 工具函数 =====

const $ = (sel) => document.querySelector(sel);

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function fnum(x, prefix = '') {
  if (x == null) return '-';
  const n = Number(x);
  if (Number.isNaN(n)) return '-';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}${prefix}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${prefix}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${prefix}${(a / 1e3).toFixed(2)}K`;
  return `${sign}${prefix}${a.toFixed(2)}`;
}

function fpct(x, decimals = 2) {
  if (x == null) return '-';
  const n = Number(x);
  if (Number.isNaN(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

function fpct4(x) {
  return fpct(x, 4);
}

function fprice(x) {
  if (x == null) return '-';
  const n = Number(x);
  if (Number.isNaN(n)) return '-';
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}

function chgCell(x, decimals = 2) {
  if (x == null) return '<td class="num">-</td>';
  const cls = x >= 0 ? 'up' : 'down';
  return `<td class="num ${cls}">${fpct(x, decimals)}</td>`;
}

function fundCell(x) {
  if (x == null) return '<td class="num">-</td>';
  const cls = x >= 0 ? 'up' : 'down';
  return `<td class="num ${cls}">${fpct(x, 4)}</td>`;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ===== 表格 builder =====

function tbl(headers, rows) {
  const head = headers.map((h) => `<th${h.num ? ' class="num"' : ''}>${esc(h.label)}</th>`).join('');
  const body = rows.map((r) => {
    const cls = r._cls ? ` class="${r._cls}"` : '';
    return `<tr${cls}>${r.cells.join('')}</tr>`;
  }).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function panel(title, desc, content) {
  return `
    <section class="panel">
      <h2>${esc(title)}</h2>
      ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
      ${content}
    </section>
  `;
}

// ===== 渲染：radar =====

function renderRadarSummary(s) {
  if (!s) return '';
  const lines = [];
  if (s.cross_exchange_top3 && s.cross_exchange_top3.length) {
    const names = s.cross_exchange_top3
      .map((r) => `<strong>${esc(r.base)}</strong>(${r.exchanges.join('+')})`)
      .join(' · ');
    lines.push(`🔥 <strong>跨所共振 OI 暴涨</strong>：${names}`);
  }
  if (s.oi_leader) {
    lines.push(`⚡ <strong>OI 增量榜首</strong>：<code>${esc(s.oi_leader.base)} (${esc(s.oi_leader.exchange)})</code> ${fpct(s.oi_leader.oi_24h_chg)} / 价格 ${fpct(s.oi_leader.chg)}`);
  }
  if (s.funding_max) {
    lines.push(`📈 <strong>费率最高（多头集中）</strong>：<code>${esc(s.funding_max.base)} (${esc(s.funding_max.exchange)})</code> ${fpct(s.funding_max.funding, 4)}`);
  }
  if (s.funding_min) {
    lines.push(`📉 <strong>费率最深负值（空头集中）</strong>：<code>${esc(s.funding_min.base)} (${esc(s.funding_min.exchange)})</code> ${fpct(s.funding_min.funding, 4)}`);
  }
  if (s.lsr_max) {
    lines.push(`🐂 <strong>大户多空比偏多</strong>：<code>${esc(s.lsr_max.base)} (${esc(s.lsr_max.exchange)})</code> ${s.lsr_max.lsr?.toFixed(2)}:1`);
  }
  if (s.lsr_min) {
    lines.push(`🐻 <strong>大户多空比偏空</strong>：<code>${esc(s.lsr_min.base)} (${esc(s.lsr_min.exchange)})</code> ${s.lsr_min.lsr?.toFixed(2)}:1`);
  }
  return `<div class="summary">${lines.join('<br>')}</div>`;
}

function renderResonance(rows) {
  if (!rows || !rows.length) return panel('1. 跨所共振榜', '≥2 家同进 OI Top 20', '<p class="desc">无数据</p>');
  const headers = [
    { label: '#' }, { label: '币种' }, { label: '上榜交易所' },
    { label: '平均 OI Δ', num: true }, { label: '平均涨跌', num: true },
  ];
  const trows = rows.map((r, i) => ({
    _cls: 'resonance-row',
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.base)}</td>`,
      `<td class="exchange">${esc((r.exchanges || []).join(' + '))}</td>`,
      chgCell(r.avg_oi_chg),
      chgCell(r.avg_chg),
    ],
  }));
  return panel('1. 跨所共振榜', '≥2 家同进 OI Top 20', tbl(headers, trows));
}

function renderOiTop(rows) {
  if (!rows || !rows.length) return '';
  const headers = [
    { label: '#' }, { label: '币种' }, { label: '交易所' },
    { label: 'OI 24h Δ', num: true }, { label: '当前 OI', num: true },
    { label: '24h 涨跌', num: true }, { label: '24h 成交额', num: true },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.base)}</td>`,
      `<td class="exchange">${esc(r.exchange)}</td>`,
      chgCell(r.oi_24h_chg),
      `<td class="num">${fnum(r.oi_usd, '$')}</td>`,
      chgCell(r.chg),
      `<td class="num">${fnum(r.qv, '$')}</td>`,
    ],
  }));
  return panel('2. OI 24h 增量榜 Top 30', null, tbl(headers, trows));
}

function renderFunding(rows, title, desc) {
  if (!rows || !rows.length) return '';
  const headers = [
    { label: '#' }, { label: '币种' }, { label: '交易所' },
    { label: '当前费率', num: true }, { label: '7d 累计', num: true },
    { label: '24h 涨跌', num: true }, { label: 'OI', num: true },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.base)}</td>`,
      `<td class="exchange">${esc(r.exchange)}</td>`,
      fundCell(r.funding),
      r.funding_7d != null ? fundCell(r.funding_7d) : '<td class="num">-</td>',
      chgCell(r.chg),
      `<td class="num">${fnum(r.oi_usd, '$')}</td>`,
    ],
  }));
  return panel(title, desc, tbl(headers, trows));
}

function renderLsr(rows, title) {
  if (!rows || !rows.length) return '';
  const headers = [
    { label: '#' }, { label: '币种' }, { label: '交易所' },
    { label: '多空比', num: true }, { label: '24h 涨跌', num: true },
    { label: '当前费率', num: true },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.base)}</td>`,
      `<td class="exchange">${esc(r.exchange)}</td>`,
      `<td class="num">${r.lsr?.toFixed(2) || '-'}</td>`,
      chgCell(r.chg),
      r.funding != null ? fundCell(r.funding) : '<td class="num">-</td>',
    ],
  }));
  return panel(title, null, tbl(headers, trows));
}

function renderChgLong(rows, title, period) {
  if (!rows || !rows.length) return '';
  const periodKey = period === '7d' ? 'chg_7d' : 'chg_30d';
  const headers = [
    { label: '#' }, { label: '币种' }, { label: '交易所' },
    { label: `${period} 涨幅`, num: true }, { label: '24h 涨幅', num: true },
    { label: '24h 成交额', num: true },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.base)}</td>`,
      `<td class="exchange">${esc(r.exchange)}</td>`,
      chgCell(r[periodKey]),
      chgCell(r.chg),
      `<td class="num">${fnum(r.qv, '$')}</td>`,
    ],
  }));
  return panel(title, null, tbl(headers, trows));
}

function renderLifecycle(rows) {
  if (!rows || !rows.length) return '';
  const headers = [
    { label: '#' }, { label: '币种' }, { label: '阶段' },
    { label: '24h', num: true }, { label: '7d', num: true }, { label: '30d', num: true },
    { label: '24h 成交', num: true }, { label: 'OI Δ', num: true }, { label: '入选维度' },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.base)}</td>`,
      `<td>${esc(r.stage || '-')}</td>`,
      chgCell(r.chg),
      chgCell(r.chg_7d),
      chgCell(r.chg_30d),
      `<td class="num">${fnum(r.qv, '$')}</td>`,
      r.oi_24h_chg != null ? chgCell(r.oi_24h_chg) : '<td class="num">-</td>',
      `<td>${esc(r.why || '-')}</td>`,
    ],
  }));
  return panel('10. 生命周期阶段诊断', 'v2.3 / 综合 24h+7d+30d+OI+成交', tbl(headers, trows));
}

function renderRadar(root) {
  const d = state.data;
  if (!d || !d.radar) {
    root.innerHTML = '<div class="loader">本日无 radar 数据</div>';
    return;
  }
  const r = d.radar;
  const html = [
    renderRadarSummary(r.summary),
    renderResonance(r.cross_exchange),
    renderOiTop(r.oi_top30),
    renderFunding(r.funding_pos_top20, '3. 资金费率正榜 Top 20', '多头集中'),
    renderFunding(r.funding_neg_top20, '4. 资金费率负榜 Top 20', '空头集中'),
    renderLsr(r.lsr_long_top15, '5. 大户多空比偏多 Top 15'),
    renderLsr(r.lsr_short_top15, '6. 大户多空比偏空 Top 15'),
    renderChgLong(r.gain_7d_top30, '7. 7d 涨幅榜 Top 30（中线热点）', '7d'),
    renderChgLong(r.gain_30d_top30, '8. 30d 涨幅榜 Top 30（趋势热点）', '30d'),
    renderChgLong(r.loss_30d_top30, '9. 30d 跌幅榜 Top 30（出榜候选）', '30d'),
    renderLifecycle(r.lifecycle),
  ].join('');
  root.innerHTML = html;
}

// ===== 渲染：gainers =====

function renderGainersTable(title, gainers, losers, isFut, isAlpha) {
  const headers = isFut
    ? [
        { label: '#' }, { label: '币种' },
        { label: '24h', num: true }, { label: '价格', num: true },
        { label: '成交额', num: true }, { label: 'OI', num: true },
        { label: '费率', num: true }, { label: '7d', num: true }, { label: '30d', num: true },
      ]
    : [
        { label: '#' }, { label: '币种' },
        ...(isAlpha ? [{ label: '链' }] : []),
        { label: '24h', num: true }, { label: '价格', num: true },
        { label: '成交额', num: true },
        { label: '7d', num: true }, { label: '30d', num: true },
      ];

  function rowOf(r, i) {
    if (isFut) {
      return {
        cells: [
          `<td>${i + 1}</td>`,
          `<td class="base">${esc(r.base || r.symbol)}</td>`,
          chgCell(r.chg),
          `<td class="num">${fprice(r.price)}</td>`,
          `<td class="num">${fnum(r.qv, '$')}</td>`,
          `<td class="num">${fnum(r.oi_usd, '$')}</td>`,
          r.funding != null ? fundCell(r.funding) : '<td class="num">-</td>',
          chgCell(r.chg_7d),
          chgCell(r.chg_30d),
        ],
      };
    }
    const chainCell = isAlpha ? `<td class="exchange">${esc(r.chain || '-')}</td>` : '';
    return {
      cells: [
        `<td>${i + 1}</td>`,
        `<td class="base">${esc(r.base || r.symbol)}</td>`,
        chainCell,
        chgCell(r.chg),
        `<td class="num">${fprice(r.price)}</td>`,
        `<td class="num">${fnum(r.qv, '$')}</td>`,
        chgCell(r.chg_7d),
        chgCell(r.chg_30d),
      ],
    };
  }

  const upTable = tbl(headers, (gainers || []).map(rowOf));
  const downTable = tbl(headers, (losers || []).map(rowOf));
  return `
    <section class="panel">
      <h2>${esc(title)}</h2>
      <div class="grid-2">
        <div><p class="desc">涨幅 TOP 30</p>${upTable}</div>
        <div><p class="desc">跌幅 TOP 30</p>${downTable}</div>
      </div>
    </section>
  `;
}

function renderGainers(root) {
  const g = state.data?.gainers;
  if (!g) { root.innerHTML = '<div class="loader">本日无 gainers 数据</div>'; return; }
  const order = [
    ['BN_spot', '币安现货', false, false],
    ['BN_fut', '币安合约', true, false],
    ['BN_alpha', '币安 Alpha', false, true],
    ['HTX_spot', 'HTX 现货', false, false],
    ['HTX_fut', 'HTX 合约', true, false],
    ['OKX_spot', 'OKX 现货', false, false],
    ['OKX_fut', 'OKX 合约', true, false],
    ['Bybit_spot', 'Bybit 现货', false, false],
    ['Bybit_fut', 'Bybit 合约', true, false],
  ];
  const html = order.map(([key, label, isFut, isAlpha]) => {
    const bucket = g[key];
    if (!bucket) return '';
    return renderGainersTable(label, bucket.gainers, bucket.losers, isFut, isAlpha);
  }).join('');
  root.innerHTML = html;
}

// ===== 渲染：onchain =====

function renderOnchainTable(title, desc, rows) {
  if (!rows || !rows.length) {
    return panel(title, desc, '<p class="desc">本榜无数据</p>');
  }
  const headers = [
    { label: '#' }, { label: 'Symbol' }, { label: '链' },
    { label: '24h', num: true }, { label: '1h', num: true },
    { label: 'mcap', num: true }, { label: 'vol', num: true },
    { label: 'holders', num: true }, { label: 'smart', num: true },
    { label: 'top10', num: true }, { label: 'rug', num: true },
    { label: 'tw', num: true }, { label: '红旗' },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.symbol || '?')}</td>`,
      `<td class="exchange">${esc((r._chain || '').toUpperCase())}</td>`,
      chgCell(r.price_change_percent, 0),
      chgCell(r.price_change_percent1h, 0),
      `<td class="num">${fnum(r.market_cap, '$')}</td>`,
      `<td class="num">${fnum(r.volume, '$')}</td>`,
      `<td class="num">${r.holder_count != null ? r.holder_count : '-'}</td>`,
      `<td class="num">${r.smart_degen_count != null ? r.smart_degen_count : '-'}</td>`,
      `<td class="num">${r.top_10_holder_rate != null ? (r.top_10_holder_rate * 100).toFixed(0) + '%' : '-'}</td>`,
      `<td class="num">${r.rug_ratio != null ? r.rug_ratio.toFixed(2) : '-'}</td>`,
      `<td class="num">${r.twitter_create_token_count != null ? r.twitter_create_token_count : '-'}</td>`,
      `<td>${r.red_flags ? `<span class="flag">${esc(r.red_flags)}</span>` : '✅'}</td>`,
    ],
  }));
  return panel(title, desc, tbl(headers, trows));
}

function renderOnchain(root) {
  const o = state.onchain;
  if (!o) {
    root.innerHTML = '<div class="loader">本日无 onchain 数据</div>';
    return;
  }
  const counts = o.counts || {};
  const html = [
    renderOnchainTable(
      '★★★ 综合热门（4 维 AND 全满足）',
      `${counts.comprehensive ?? 0} 个币 / 4 维 AND：24h≥+50% · vol≥$5M · smart≥30 · holders≥1000`,
      o.comprehensive,
    ),
    renderOnchainTable('Solana 24h Top', 'GMGN trending', o.by_chain?.sol),
    renderOnchainTable('BSC 24h Top', 'GMGN trending', o.by_chain?.bsc),
    renderOnchainTable('Base 24h Top', 'GMGN trending', o.by_chain?.base),
    renderOnchainTable('Ethereum 24h Top', 'DEXScreener', o.by_chain?.eth),
    renderOnchainTable(
      '🐋 聪明钱共识',
      `${counts.smart_consensus ?? 0} 个 / smart≥30 + holders≥1000 + 不深跌`,
      o.smart_consensus,
    ),
    renderOnchainTable(
      '🚨 散户预警',
      `${counts.retail_warning ?? 0} 个 / holders≥5K + 24h≥+100% + top10≥60%`,
      o.retail_warning,
    ),
    renderOnchainTable(
      '💼 商务跟进',
      `${counts.business_track ?? 0} 个 / mcap≥$10M + smart≥30`,
      o.business_track,
    ),
  ].join('');
  root.innerHTML = html;
}

// ===== 渲染：us stocks =====

function renderUsTable(title, desc, rows, sortKey) {
  if (!rows || !rows.length) return panel(title, desc, '<p class="desc">无数据</p>');
  const headers = [
    { label: '#' }, { label: '代码' }, { label: '板块' },
    { label: '价格', num: true }, { label: '涨跌', num: true },
    { label: '成交量', num: true }, { label: '成交额', num: true }, { label: '源' },
  ];
  const trows = rows.map((r, i) => ({
    cells: [
      `<td>${i + 1}</td>`,
      `<td class="base">${esc(r.symbol)}</td>`,
      `<td class="exchange">${esc(r.sector || '-')}</td>`,
      `<td class="num">${fprice(r.price)}</td>`,
      chgCell(r.chg),
      `<td class="num">${fnum(r.volume)}</td>`,
      `<td class="num">${fnum(r.dollar_volume, '$')}</td>`,
      `<td class="exchange">${esc(r.source || '-')}</td>`,
    ],
  }));
  return panel(title, desc, tbl(headers, trows));
}

function renderSectorDist(rows) {
  if (!rows || !rows.length) return '';
  const headers = [
    { label: '板块' },
    { label: 'TOP20 成交额', num: true }, { label: 'TOP20 占比', num: true },
    { label: '全池成交额', num: true }, { label: '全池占比', num: true },
  ];
  const trows = rows.map((r) => ({
    cells: [
      `<td class="base">${esc(r.sector)}</td>`,
      `<td class="num">${fnum(r.top20_dollar_volume, '$')}</td>`,
      `<td class="num">${r.top20_pct.toFixed(1)}%</td>`,
      `<td class="num">${fnum(r.all_dollar_volume, '$')}</td>`,
      `<td class="num">${r.all_pct.toFixed(1)}%</td>`,
    ],
  }));
  return panel('板块成交额分布（TOP20 vs 全池）', null, tbl(headers, trows));
}

function renderUS(root) {
  const u = state.data?.us_stocks;
  if (!u) { root.innerHTML = '<div class="loader">本日无 us_stocks 数据</div>'; return; }
  const html = [
    renderUsTable(`成交额 TOP 20（观察池 ${u.watchlist_size} 只）`, '盘后/盘中按数据源时间戳', u.top_volume),
    renderUsTable('涨幅 TOP 20', null, u.top_gainers),
    renderUsTable('跌幅 TOP 20', null, u.top_losers),
    renderSectorDist(u.sector_distribution),
  ].join('');
  root.innerHTML = html;
}

// ===== 主流程 =====

function updateMeta() {
  const m = $('#meta');
  if (state.data) {
    const ts = state.data.timestamp || '';
    const short = ts ? ts.slice(0, 16).replace('T', ' ') : '';
    m.textContent = `${state.slot} · ${short}`;
  } else {
    m.textContent = '--';
  }
  const errBox = $('#errors');
  if (state.data?.errors && Object.keys(state.data.errors).length) {
    const sum = Object.entries(state.data.errors).map(([k, v]) => `${k}(${v})`).join(' · ');
    errBox.textContent = `⚠ 数据异常：${sum}`;
  } else {
    errBox.textContent = '';
  }
}

async function loadDate(date) {
  state.date = date;
  state.slot = pickSlot(date);
  $('#content').innerHTML = '<div class="loader">加载中…</div>';
  try {
    const main = await fetchJSON(`data/${date}-${state.slot}.json`);
    state.data = main;
    state.onchain = await fetchJSON(`data/${date}-${state.slot}-onchain.json`).catch(() => null);
  } catch (e) {
    $('#content').innerHTML = `<div class="loader">加载失败：${esc(e.message)}</div>`;
    state.data = null;
    state.onchain = null;
  }
  updateMeta();
  render();
}

function render() {
  const root = $('#content');
  if (!state.data) {
    root.innerHTML = '<div class="loader">无数据</div>';
    return;
  }
  switch (state.activeTab) {
    case 'radar': renderRadar(root); break;
    case 'gainers': renderGainers(root); break;
    case 'onchain': renderOnchain(root); break;
    case 'us': renderUS(root); break;
  }
}

function bindTabs() {
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      render();
    });
  });
}

function populateDatePicker(dates) {
  const sel = $('#date-picker');
  sel.innerHTML = dates.map((d) => `<option value="${d}">${d}</option>`).join('');
  sel.addEventListener('change', () => loadDate(sel.value));
}

async function init() {
  bindTabs();
  let manifest;
  try {
    manifest = await fetchJSON('data/index.json');
  } catch (e) {
    $('#content').innerHTML = '<div class="loader">manifest 缺失：data/index.json 不存在</div>';
    return;
  }
  state.manifest = manifest;
  const dates = (manifest.dates || []).slice().sort().reverse();
  if (!dates.length) {
    $('#content').innerHTML = '<div class="loader">尚无数据</div>';
    return;
  }
  populateDatePicker(dates);
  await loadDate(dates[0]);
}

init();
