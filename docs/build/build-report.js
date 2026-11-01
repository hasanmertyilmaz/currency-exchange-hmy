// Builds docs/M1/Group7_M1_Analysis_and_Design.{docx,pdf} from report-content.js.
// Usage: node build-report.js [--chrome <path>]   (see docs/build/README.md)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, TableOfContents, Footer, PageNumber, PageBreak,
  LevelFormat, TabStopType, PageOrientation,
} = require('docx');
const { meta, blocks } = require('./report-content');

const ROOT = path.resolve(__dirname, '..', 'M1');
const DIAGRAMS = path.join(ROOT, 'diagrams');
const OUT = path.join(ROOT, 'Group7_M1_Analysis_and_Design');
const NAVY = '1F3A68';
const CONTENT_DXA = 9638; // A4 width 11906 minus 2 × 1134 (2 cm margins)

// ── inline markup ────────────────────────────────────────────────────────────
function tokens(text) {
  return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/).filter(Boolean).map((t) => {
    if (t.startsWith('**')) return { t: t.slice(2, -2), b: true };
    if (t.startsWith('`')) return { t: t.slice(1, -1), c: true };
    if (t.startsWith('*') && t.length > 2) return { t: t.slice(1, -1), i: true };
    return { t };
  });
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inlineHtml = (text) => tokens(text).map((k) =>
  k.b ? `<strong>${esc(k.t)}</strong>` : k.c ? `<code>${esc(k.t)}</code>` : k.i ? `<em>${esc(k.t)}</em>` : esc(k.t)).join('');
const runs = (text, base = {}) => tokens(text).map((k) => new TextRun({
  text: k.t, bold: k.b || base.bold, italics: k.i || base.italics,
  font: k.c ? 'Courier New' : undefined, size: base.size, color: base.color,
}));

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// ── DOCX ─────────────────────────────────────────────────────────────────────
function docxTable(b) {
  const widths = b.widths.map((w) => Math.round((w / 100) * CONTENT_DXA));
  widths[widths.length - 1] += CONTENT_DXA - widths.reduce((a, c) => a + c, 0);
  const size = b.small ? 16 : 18;
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'A6B4CC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, i, header) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    borders,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'DCE4F2' } : undefined,
    children: [new Paragraph({ children: runs(text, { size, bold: header }) })],
  });
  const out = [];
  if (b.caption) out.push(new Paragraph({ keepNext: true, spacing: { before: 160, after: 60 }, children: runs(b.caption, { size: 18, bold: true, color: NAVY }) }));
  out.push(new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: b.header.map((h, i) => cell(h, i, true)) }),
      ...b.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  }));
  out.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
  return out;
}

function buildDocx() {
  let listInstance = 0;
  let body = [];
  const chunks = []; // { landscape, children }
  const flush = (landscape) => { chunks.push({ landscape, children: body }); body = []; };
  for (const b of blocks) {
    switch (b.type) {
      case 'h1':
        body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(b.text)] }));
        break;
      case 'h2': body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(b.text)] })); break;
      case 'h3': body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun(b.text)] })); break;
      case 'p': body.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: runs(b.text) })); break;
      case 'note': body.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: 'FFF4E5', color: 'auto' }, spacing: { after: 120 }, children: runs(b.text) })); break;
      case 'ul':
        b.items.forEach((it) => body.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 }, children: runs(it) })));
        break;
      case 'ol': {
        const instance = ++listInstance;
        b.items.forEach((it) => body.push(new Paragraph({ numbering: { reference: 'numbers', level: 0, instance }, spacing: { after: 60 }, children: runs(it) })));
        break;
      }
      case 'refs':
        b.items.forEach((it, i) => body.push(new Paragraph({
          spacing: { after: 80 }, indent: { left: 567, hanging: 567 },
          children: [new TextRun(`[${i + 1}]\t`), ...runs(it)],
          tabStops: [{ type: TabStopType.LEFT, position: 567 }],
        })));
        break;
      case 'table': body.push(...docxTable(b)); break;
      case 'figure': {
        const file = path.join(DIAGRAMS, 'png', `${b.file}.png`);
        const { w, h } = pngSize(file);
        let width = Math.round(640 * (b.width / 100));
        let height = Math.round((h / w) * width);
        if (b.landscape) {
          flush(false);
          width = 920; height = Math.round((h / w) * width);
          if (height > 560) { width = Math.round((560 / height) * width); height = 560; }
        } else if (height > 820) { width = Math.round((820 / height) * width); height = 820; }
        body.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120 }, children: [
          new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width, height }, altText: { title: b.caption, description: b.caption, name: b.file } }),
        ] }));
        body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: runs(b.caption, { size: 18, italics: true }) }));
        if (b.landscape) flush(true);
        break;
      }
      case 'code':
        b.text.split('\n').forEach((line, i, all) => body.push(new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: 'F3F5F8', color: 'auto' },
          spacing: { after: i === all.length - 1 ? 60 : 0, line: 240 },
          children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 16 })],
        })));
        if (b.label) body.push(new Paragraph({ spacing: { after: 200 }, children: runs(b.label, { size: 18, italics: true }) }));
        break;
      case 'pagebreak': body.push(new Paragraph({ children: [new PageBreak()] })); break;
      default: throw new Error(`unknown block ${b.type}`);
    }
  }
  flush(false);

  const center = (text, opts = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 120 }, children: [new TextRun({ text, ...opts })] });
  const cover = [
    center(meta.university, { size: 22, color: '555555', after: 40 }),
    center(meta.course, { size: 24, color: '555555', after: 1400 }),
    center(meta.documentTitle, { size: 28, bold: true, color: NAVY }),
    center(meta.milestone, { size: 24, color: NAVY, after: 600 }),
    center(meta.projectName, { size: 40, bold: true, color: NAVY, after: 80 }),
    center(`${meta.projectVariant} · ${meta.group}`, { size: 24, after: 1200 }),
    center('Authors', { size: 20, color: '777777', after: 40 }),
    center(meta.authors.join(' · '), { size: 24, bold: true, after: 300 }),
    center('Supervisor', { size: 20, color: '777777', after: 40 }),
    center(meta.supervisor, { size: 24, after: 300 }),
    center(meta.dateLine, { size: 22, after: 40 }),
    center(meta.repo, { size: 18, color: '555555' }),
    new Paragraph({ children: [new PageBreak()] }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  ];

  const doc = new Document({
    creator: meta.authors.join(', '),
    title: `${meta.projectName} — ${meta.milestone}`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: '333333' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
      ],
    },
    numbering: { config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
    ] },
    sections: chunks.map((c, i) => ({
      properties: { page: {
        size: { width: 11906, height: 16838, orientation: c.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
      } },
      footers: { default: new Footer({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: c.landscape ? 16838 - 2268 : CONTENT_DXA }],
        children: [
          new TextRun({ text: `${meta.projectName} · M1 Analysis & Design · Group 7`, size: 16, color: '777777' }),
          new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '777777' }),
        ],
      })] }) },
      children: i === 0 ? [...cover, ...c.children] : c.children,
    })),
  });
  return Packer.toBuffer(doc);
}

// ── HTML / PDF ───────────────────────────────────────────────────────────────
function buildHtml(tocPages = {}) {
  let n = 0;
  const toc = [];
  const parts = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'h1': case 'h2': case 'h3': {
        const id = `s${++n}`;
        toc.push({ level: b.type, text: b.text, id });
        parts.push(`<${b.type} id="${id}">${esc(b.text)}</${b.type}>`);
        break;
      }
      case 'p': parts.push(`<p>${inlineHtml(b.text)}</p>`); break;
      case 'note': parts.push(`<p class="note">${inlineHtml(b.text)}</p>`); break;
      case 'ul': parts.push(`<ul>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</ul>`); break;
      case 'ol': parts.push(`<ol>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</ol>`); break;
      case 'refs': parts.push(`<ol class="refs">${b.items.map((i, k) => `<li><span>[${k + 1}]</span> ${inlineHtml(i)}</li>`).join('')}</ol>`); break;
      case 'table': {
        const cols = b.widths.map((w) => `<col style="width:${w}%">`).join('');
        parts.push(`<div class="tbl">${b.caption ? `<div class="cap">${inlineHtml(b.caption)}</div>` : ''}<table class="${b.small ? 'small' : ''}"><colgroup>${cols}</colgroup><thead><tr>${b.header.map((h) => `<th>${inlineHtml(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        break;
      }
      case 'figure':
        if (b.landscape) { parts.push(`<section class="land"><figure><img src="file://${path.join(DIAGRAMS, 'svg', `${b.file}.svg`)}"><figcaption>${inlineHtml(b.caption)}</figcaption></figure></section>`); break; }
        parts.push(`<figure><img src="file://${path.join(DIAGRAMS, 'svg', `${b.file}.svg`)}" style="max-width:${b.width}%"><figcaption>${inlineHtml(b.caption)}</figcaption></figure>`);
        break;
      case 'code': parts.push(`<pre>${esc(b.text)}</pre>${b.label ? `<div class="lst">${inlineHtml(b.label)}</div>` : ''}`); break;
      case 'pagebreak': parts.push('<div class="pb"></div>'); break;
      default: throw new Error(`unknown block ${b.type}`);
    }
  }
  const tocHtml = toc.map((t) => `<div class="toc-${t.level}"><a href="#${t.id}">${esc(t.text)}</a><span class="dots"></span><span class="pg">${tocPages[t.text] ?? '00'}</span></div>`).join('');
  return { toc, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(meta.projectName)} — M1</title><style>
@page { size: A4; margin: 18mm 18mm 20mm 18mm; }
@page land { size: A4 landscape; margin: 14mm 14mm 18mm 14mm; }
.land { page: land; break-before: page; break-after: page; } .land figure { margin: 0; } .land img { max-width: 100%; max-height: 165mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.42; color: #1d1d1d; }
h1 { font-size: 17pt; color: #${NAVY}; break-before: page; margin: 0 0 10pt; border-bottom: 1.5pt solid #${NAVY}; padding-bottom: 3pt; }
h2 { font-size: 13pt; color: #${NAVY}; margin: 16pt 0 6pt; break-after: avoid; }
h3 { font-size: 11pt; color: #333; margin: 12pt 0 4pt; break-after: avoid; }
p { margin: 0 0 7pt; text-align: justify; }
code { font-family: Menlo, 'Courier New', monospace; font-size: 8.6pt; background: #F1F3F7; padding: 0 2px; border-radius: 2px; }
ul, ol { margin: 0 0 8pt; padding-left: 18pt; } li { margin-bottom: 3pt; }
.tbl { margin: 8pt 0 10pt; } .cap { font-weight: bold; color: #${NAVY}; font-size: 9pt; margin-bottom: 3pt; break-after: avoid; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.8pt; }
table.small { font-size: 8pt; }
th { background: #DCE4F2; text-align: left; } th, td { border: 0.6pt solid #A6B4CC; padding: 3pt 4pt; vertical-align: top; word-wrap: break-word; }
tr { break-inside: avoid; } thead { display: table-header-group; }
figure { margin: 10pt 0 12pt; text-align: center; break-inside: avoid; } figure img { max-height: 225mm; }
figcaption { font-style: italic; font-size: 9pt; margin-top: 4pt; }
pre { font-family: Menlo, 'Courier New', monospace; font-size: 7.8pt; background: #F3F5F8; border: 0.6pt solid #D5DCE8; padding: 6pt 8pt; white-space: pre-wrap; break-inside: avoid; margin: 6pt 0 2pt; }
.lst { font-style: italic; font-size: 8.8pt; margin-bottom: 10pt; }
.note { background: #FFF4E5; padding: 6pt 8pt; }
.refs { list-style: none; padding-left: 0; } .refs li { padding-left: 26pt; text-indent: -26pt; margin-bottom: 5pt; } .refs span { display: inline-block; width: 26pt; text-indent: 0; }
.cover { height: 250mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
.cover .uni { margin-top: 6mm; color: #555; font-size: 11pt; } .cover .course { color: #555; font-size: 12pt; }
.cover .doc { margin-top: 55mm; font-size: 14pt; font-weight: bold; color: #${NAVY}; } .cover .ms { font-size: 12pt; color: #${NAVY}; margin-top: 3pt; }
.cover .name { margin-top: 22mm; font-size: 22pt; font-weight: bold; color: #${NAVY}; } .cover .var { font-size: 12pt; margin-top: 4pt; }
.cover .lbl { margin-top: 16mm; font-size: 9.5pt; color: #777; } .cover .lbl + div { font-size: 12pt; font-weight: bold; }
.cover .sup { font-size: 12pt; } .cover .date { margin-top: auto; font-size: 11pt; } .cover .repo { font-size: 9pt; color: #555; }
.cover .rule { width: 60mm; border-top: 2pt solid #${NAVY}; margin-top: 10mm; }
.tochead { font-size: 17pt; color: #${NAVY}; font-weight: bold; break-before: page; margin-bottom: 10pt; }
.toc-h1, .toc-h2, .toc-h3 { display: flex; align-items: baseline; margin: 2pt 0; }
.toc-h1 { font-weight: bold; margin-top: 7pt; } .toc-h2 { padding-left: 14pt; } .toc-h3 { padding-left: 28pt; font-size: 9pt; }
.toc-h1 a, .toc-h2 a, .toc-h3 a { color: inherit; text-decoration: none; }
.dots { flex: 1; border-bottom: 0.8pt dotted #999; margin: 0 4pt; transform: translateY(-3pt); }
</style></head><body>
<section class="cover">
<div class="uni">${esc(meta.university)}</div><div class="course">${esc(meta.course)}</div>
<div class="doc">${esc(meta.documentTitle)}</div><div class="ms">${esc(meta.milestone)}</div>
<div class="rule"></div>
<div class="name">${esc(meta.projectName)}</div><div class="var">${esc(meta.projectVariant)} · ${esc(meta.group)}</div>
<div class="lbl">Authors</div><div>${meta.authors.map(esc).join(' · ')}</div>
<div class="lbl">Supervisor</div><div class="sup">${esc(meta.supervisor)}</div>
<div class="date">${esc(meta.dateLine)}</div><div class="repo">${esc(meta.repo)}</div>
</section>
<div class="tochead">Table of Contents</div>${tocHtml}
${parts.join('\n')}
</body></html>` };
}

async function printPdf(html, chrome) {
  const puppeteer = require('puppeteer-core');
  const tmp = path.join(__dirname, '.cache');
  fs.mkdirSync(tmp, { recursive: true });
  const file = path.join(tmp, 'report.html');
  fs.writeFileSync(file, html);
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.goto(`file://${file}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: `${OUT}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true,
    margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-family:Arial;font-size:7.5pt;color:#777;width:100%;padding:0 18mm;display:flex;justify-content:space-between"><span>${esc(meta.projectName)} · M1 Analysis &amp; Design · Group 7</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
}

// Finds the page of each heading in the printed PDF (pass 1) so the TOC shows real page numbers.
function headingPages(toc, python) {
  const script = `
import sys, json, pymupdf
doc = pymupdf.open(sys.argv[1]); heads = json.load(open(sys.argv[2]))
texts = [" ".join(p.get_text().split()) for p in doc]
start = next(i for i, t in enumerate(texts) if "1. General Information" in t and "Project Name" in t)
out, cur = {}, start
for h in heads:
    norm = " ".join(h.split())
    for i in range(cur, len(texts)):
        if norm in texts[i]:
            out[h] = i + 1; cur = i; break
print(json.dumps(out))`;
  const tmp = path.join(__dirname, '.cache');
  fs.writeFileSync(path.join(tmp, 'pages.py'), script);
  fs.writeFileSync(path.join(tmp, 'heads.json'), JSON.stringify(toc.map((t) => t.text)));
  const res = execFileSync(python, [path.join(tmp, 'pages.py'), `${OUT}.pdf`, path.join(tmp, 'heads.json')], { env: process.env });
  return JSON.parse(res.toString());
}

(async () => {
  const args = process.argv.slice(2);
  const chrome = args.includes('--chrome') ? args[args.indexOf('--chrome') + 1] : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  fs.writeFileSync(`${OUT}.docx`, await buildDocx());
  console.log('wrote', `${OUT}.docx`);
  const first = buildHtml();
  await printPdf(first.html, chrome);
  let pages = {};
  try { pages = headingPages(first.toc, process.env.PYTHON || 'python3'); } catch (e) { console.warn('TOC page numbers skipped:', e.message.split('\n')[0]); }
  const missing = first.toc.filter((t) => !pages[t.text]).map((t) => t.text);
  if (missing.length) console.warn('headings not located:', missing);
  await printPdf(buildHtml(pages).html, chrome);
  console.log('wrote', `${OUT}.pdf`);
})();
