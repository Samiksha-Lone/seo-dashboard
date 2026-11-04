const { existsSync } = require('node:fs');
const path = require('node:path');

const CATEGORY_LABELS = {
  technical: 'Technical',
  on_page: 'On-page',
  content: 'Content',
  core_web_vitals: 'Core Web Vitals',
  schema: 'Schema',
};

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function text(value, fallback = 'Not available') {
  return escapeHtml(value == null || value === '' ? fallback : value).replace(/\r?\n/g, '<br>');
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return escapeHtml(new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)) + ' UTC';
}

function renderScoreBreakdown(scoreBreakdown) {
  const entries = [
    ['technical', 'Technical'],
    ['on_page', 'On-page'],
    ['content', 'Content'],
    ['core_web_vitals', 'Core Web Vitals'],
    ['schema', 'Schema'],
  ];
  return entries.map(([key, label]) => {
    const score = scoreBreakdown && scoreBreakdown[key];
    const value = Number.isInteger(score) && score >= 0 && score <= 100
      ? `${score}<span class="denominator"> / 100</span>`
      : 'Unavailable';
    return `<div class="score-card"><span>${label}</span><strong>${value}</strong></div>`;
  }).join('');
}

function renderIssues(issues, emptyMessage) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return `<p class="muted">${text(emptyMessage)}</p>`;
  }
  return `<div class="cards">${issues.map((issue) => `
    <article class="card">
      <h3>${text(issue.title || issue.category)}</h3>
      <p class="meta">${text(issue.category)} · Impact: ${text(issue.estimated_impact)} · Effort: ${text(issue.effort)}</p>
      <p><strong>Finding</strong><br>${text(issue.finding)}</p>
      <p><strong>Suggested fix</strong><br>${text(issue.fix)}</p>
      <p><strong>How to verify</strong><br>${text(issue.falsifiability_check)}</p>
    </article>`).join('')}</div>`;
}

function renderRecommendations(recommendations) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return '<p class="muted">No recommendations are available for this audit.</p>';
  }
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return `<div class="cards">${recommendations
    .map((recommendation, index) => ({ recommendation, index }))
    .sort((a, b) =>
      (priorityOrder[a.recommendation.priority] ?? 3) -
        (priorityOrder[b.recommendation.priority] ?? 3) || a.index - b.index
    )
    .map(({ recommendation }) => `
      <article class="card recommendation">
        <div class="recommendation-heading">
          <h3>${text(recommendation.category, 'Recommendation')}</h3>
          <span class="priority">${text(recommendation.priority, 'Priority unavailable')}</span>
        </div>
        <p class="meta">Impact: ${text(recommendation.estimated_impact)} · Effort: ${text(recommendation.effort)}</p>
        <p><strong>Finding</strong><br>${text(recommendation.finding)}</p>
        <p><strong>Exact fix</strong><br>${text(recommendation.fix)}</p>
        <p><strong>Falsifiability check</strong><br>${text(recommendation.falsifiability_check)}</p>
      </article>`).join('')}</div>`;
}

function renderSignalAvailability(signals, mockMode) {
  const entries = signals && typeof signals === 'object' && !Array.isArray(signals)
    ? Object.entries(signals)
    : [];
  const unavailable = entries
    .filter(([, signal]) => !signal || signal.status !== 'success')
    .map(([name]) => name);
  const summary = unavailable.length
    ? `Unavailable signals: ${unavailable.map(escapeHtml).join(', ')}.`
    : 'No signal collection errors were recorded.';
  const modeNotice = mockMode
    ? '<p class="signal-note">Mock mode is enabled. Some provider signals in this report may be mocked.</p>'
    : '<p class="signal-note">This report reflects saved audit signals; it does not imply every provider supplied live data.</p>';
  return `<p>${summary}</p>${modeNotice}`;
}

function getLocalChromePath() {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

  return candidates.find((candidate) => existsSync(candidate));
}

function createReportHtml({ audit, report, signals, mockMode = false }) {
  const categories = report && report.score_breakdown;
  const critical = report && report.critical_issues;
  const important = report && report.important_issues;
  const quickWins = report && report.quick_wins;
  const recommendations = report && report.recommendations;
  const score = report && Number.isInteger(report.overall_score)
    ? `${report.overall_score}<span class="denominator"> / 100</span>`
    : 'Unavailable';
  const website = audit && audit.website;
  const client = website && website.client;
  const date = audit && (audit.startedAt || audit.createdAt);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body { color: #172033; font: 10pt/1.55 Arial, Helvetica, sans-serif; margin: 0; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 25pt; line-height: 1.15; margin: 9mm 0 3mm; }
    h2 { border-bottom: 1px solid #dbe2ed; color: #172033; font-size: 15pt; margin: 11mm 0 4mm; padding-bottom: 2mm; }
    h3 { font-size: 11pt; margin: 0 0 2mm; }
    p { margin-bottom: 3mm; overflow-wrap: anywhere; }
    .eyebrow, .meta, .muted { color: #627087; }
    .eyebrow { font-size: 8pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
    .hero { border-bottom: 3px solid #4f46e5; padding-bottom: 7mm; }
    .url { color: #4f46e5; overflow-wrap: anywhere; }
    .client { color: #46546a; margin-top: 4mm; }
    .overall { align-items: baseline; color: #4f46e5; display: flex; gap: 2mm; margin-top: 5mm; }
    .overall strong { font-size: 28pt; }
    .denominator { color: #8390a3; font-size: 9pt; font-weight: 400; }
    .score-grid { display: grid; gap: 3mm; grid-template-columns: repeat(5, 1fr); }
    .score-card { background: #f3f5fa; border-radius: 2mm; min-height: 20mm; padding: 3mm; }
    .score-card span { color: #627087; display: block; font-size: 8pt; }
    .score-card strong { display: block; font-size: 13pt; margin-top: 2mm; }
    .cards { display: grid; gap: 3mm; }
    .card { border: 1px solid #dbe2ed; border-radius: 2mm; break-inside: avoid; padding: 4mm; }
    .card p:last-child { margin-bottom: 0; }
    .meta { font-size: 8pt; }
    .priority { background: #eef2ff; border-radius: 4mm; color: #4338ca; font-size: 8pt; font-weight: 700; padding: 1mm 3mm; }
    .recommendation-heading { align-items: center; display: flex; justify-content: space-between; gap: 4mm; }
    .signal-note { background: #fff8e6; border-left: 2px solid #e5a817; color: #664c13; padding: 3mm; }
    .section { break-inside: auto; }
  </style>
</head>
<body>
  <header class="hero">
    <p class="eyebrow">SEO Audit Report</p>
    <h1>${text(website && website.name, 'Website audit')}</h1>
    <p class="url">${text(website && website.url)}</p>
    <p class="client">${text(client && client.businessName)}${client ? ` · ${text(client.businessType, '')} · ${text([client.city, client.state].filter(Boolean).join(', '), '')}` : ''}</p>
    <p class="meta">Audit date: ${formatDate(date)}</p>
    <div class="overall"><strong>${score}</strong><span>Overall SEO score</span></div>
  </header>
  <section class="section">
    <h2>Score breakdown</h2>
    <div class="score-grid">${renderScoreBreakdown(categories)}</div>
  </section>
  <section class="section">
    <h2>Executive summary</h2>
    <p>${text(report && report.executive_summary)}</p>
  </section>
  <section class="section"><h2>Critical issues</h2>${renderIssues(critical, 'No critical issues were identified.')}</section>
  <section class="section"><h2>Important issues</h2>${renderIssues(important, 'No important issues were identified.')}</section>
  <section class="section"><h2>Quick wins</h2>${renderIssues(quickWins, 'No quick wins were identified.')}</section>
  <section class="section"><h2>Prioritized recommendations</h2>${renderRecommendations(recommendations)}</section>
  <section class="section"><h2>Signal availability</h2>${renderSignalAvailability(signals, mockMode)}</section>
</body>
</html>`;
}

async function generatePdfBuffer(reportData, puppeteerInstance) {
  let browser;
  try {
    let puppeteer = puppeteerInstance;
    let launchOptions = { headless: true };

    if (!puppeteer && process.env.VERCEL) {
      const [puppeteerModule, chromiumModule] = await Promise.all([
        import('puppeteer-core'),
        import('@sparticuz/chromium'),
      ]);
      const chromium = chromiumModule.default;
      puppeteer = puppeteerModule.default;
      launchOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      };
    } else if (!puppeteer) {
      const puppeteerModule = await import('puppeteer-core');
      puppeteer = puppeteerModule.default;
      const executablePath = getLocalChromePath();
      if (executablePath) launchOptions.executablePath = executablePath;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(createReportHtml(reportData), { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font:8px Arial;color:#64748b;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' },
    });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { createReportHtml, escapeHtml, generatePdfBuffer };
