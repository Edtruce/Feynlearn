#!/usr/bin/env node
/*
 * Feynlearn blog builder — zero dependencies.
 *
 *   node scripts/build-blog.js
 *
 * Reads   blogs/*.md            (Markdown with front matter, see blogs/README.md)
 * Writes  blog/index.html       (list of posts)
 *         blog/<slug>/index.html (one page per post)
 *         sitemap.xml           (homepage + blog URLs)
 *
 * Styling is copied from the <style> block in index.html at build time, so blog
 * pages always match the homepage. Only article-specific rules are added below.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'blogs');
const OUT_DIR = path.join(ROOT, 'blog');
const SITE = 'https://feynlearn.in';
const DEFAULT_IMAGE = `${SITE}/logoo2.png`;

// ── helpers ──────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const fmtDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const absUrl = u => !u ? DEFAULT_IMAGE : /^https?:\/\//.test(u) ? u : SITE + '/' + u.replace(/^\/+/, '');
// "blog-images/x.jpg", "./blog-images/x.jpg", "../blog-images/x.jpg" → "/blog-images/x.jpg"
const imgPath = u => !u || /^(https?:)?\/\//.test(u) ? u : '/' + u.replace(/^(\.{0,2}\/)+/, '');

function parseFrontMatter(raw, file) {
  const m = raw.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter (--- ... ---) at top of file`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    meta[kv[1].toLowerCase()] = v;
  }
  return { meta, body: m[2] };
}

// ── tiny Markdown renderer ───────────────────────────────────────────────
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(esc(c)) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, alt, src, t) => `<img src="${imgPath(src)}" alt="${alt}" loading="lazy" decoding="async"${t ? ` title="${t}"` : ''}>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, href) => {
    const ext = /^https?:\/\//.test(href) && !href.startsWith(SITE);
    return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

function markdown(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let i = 0;
  const isBlockStart = l => /^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+\.\s|---+\s*$|\|)/.test(l) || /^<\w/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('```')) {                                    // code fence
      const lang = line.slice(3).trim(); const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*$/);                   // headings (# is demoted: page has one H1)
    if (h) {
      const level = Math.max(2, h[1].length); const id = slugify(h[2]);
      if (level === 2) headings.push({ id, text: h[2] });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`); i++; continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }  // rule
    if (/^<\w/.test(line)) {                                          // raw HTML block (trusted authors)
      const buf = []; while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
      out.push(buf.join('\n')); continue;
    }
    if (line.startsWith('>')) {                                       // blockquote
      const buf = []; while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${markdown(buf.join('\n')).html}</blockquote>`); continue;
    }
    if (/^\|/.test(line)) {                                           // table
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]); const body = rows.slice(/^\|[\s:|-]+\|?$/.test(rows[1] || '') ? 2 : 1);
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>` +
        body.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>');
      continue;
    }
    const li = line.match(/^\s*([-*+]|\d+\.)\s+/);                    // lists
    if (li) {
      const tag = /\d/.test(li[1]) ? 'ol' : 'ul'; const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    const buf = [];                                                   // paragraph
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++].trim());
    const para = inline(buf.join(' '));
    const fig = para.match(/^<img [^>]*?(?: title="([^"]*)")?>$/);   // image on its own line → figure (+ caption from "title")
    out.push(fig ? `<figure>${para.replace(/ title="[^"]*"/, '')}${fig[1] ? `<figcaption>${fig[1]}</figcaption>` : ''}</figure>` : `<p>${para}</p>`);
  }
  return { html: out.join('\n'), headings };
}

// ── shared page chrome (reuses homepage CSS) ─────────────────────────────
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const siteCss = (indexHtml.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

const BLOG_CSS = `
  /* ── BLOG (article-only rules; everything else comes from index.html) ── */
  .blog-main { padding: 13rem 5% 5rem; max-width: 1100px; margin: 0 auto; }
  .post-author { font-size: 0.85rem; color: var(--navy); font-weight: 500; }
  .post-author span { color: #6b7280; font-weight: 400; }
  .blog-head { margin-bottom: 3rem; }
  .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
  .post-card { display: flex; flex-direction: column; background: #fff; border: 1px solid rgba(26,42,82,0.07); border-radius: 1.2rem; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; }
  .post-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(26,42,82,0.1); }
  .post-card-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }
  .post-card h2 { font-family: 'Playfair Display', serif; font-size: 1.25rem; color: var(--navy); line-height: 1.3; }
  .post-card p { font-size: 0.9rem; line-height: 1.65; color: #6b7280; flex: 1; }
  .post-meta { font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--light-green); font-weight: 500; }
  .post-empty { color: #6b7280; }
  .breadcrumb { font-size: 0.82rem; color: #6b7280; margin-bottom: 1.2rem; }
  .breadcrumb a { color: var(--navy); text-decoration: none; }
  .breadcrumb a:hover { color: var(--light-green); }
  .article { max-width: 760px; margin: 0 auto; }
  .article-title { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 4.5vw, 3rem); font-weight: 900; color: var(--navy); line-height: 1.15; margin: 0.6rem 0 1rem; }
  .article-desc { font-size: 1.1rem; line-height: 1.7; color: var(--text); margin-bottom: 1.5rem; }
  .article-cover { display: block; width: 100%; height: auto; aspect-ratio: 1200/630; object-fit: cover; border-radius: 1.2rem; margin: 1rem 0 2rem; background: var(--navy); }
  .prose { font-size: 1.05rem; line-height: 1.8; color: var(--text); }
  .prose > * + * { margin-top: 1.2rem; }
  .prose h2 { font-family: 'Playfair Display', serif; font-size: 1.7rem; color: var(--navy); margin-top: 2.6rem; line-height: 1.25; scroll-margin-top: 140px; }
  .prose h3 { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: var(--navy); margin-top: 2rem; scroll-margin-top: 140px; }
  .prose h4, .prose h5, .prose h6 { color: var(--navy); margin-top: 1.6rem; }
  .prose a { color: var(--green); text-underline-offset: 3px; }
  .prose a:hover { color: var(--light-green); }
  .prose strong { color: var(--navy); }
  .prose ul, .prose ol { padding-left: 1.4rem; }
  .prose li + li { margin-top: 0.45rem; }
  .prose li::marker { color: var(--light-green); }
  .prose blockquote { border-left: 3px solid var(--light-green); background: #fff; padding: 1.2rem 1.5rem; border-radius: 0 1rem 1rem 0; font-family: 'Playfair Display', serif; font-style: italic; color: var(--navy); }
  .prose { overflow-wrap: break-word; }
  /* images never overflow: scale down to the column width, keep their ratio, cap very tall ones */
  .prose img { display: block; width: auto; max-width: 100%; height: auto; max-height: 640px; object-fit: contain; margin: 0 auto; border-radius: 1rem; }
  .prose p img { display: inline-block; vertical-align: middle; }
  .prose figure { margin: 2.2rem 0; }
  .prose figcaption { text-align: center; font-size: 0.85rem; color: #6b7280; margin-top: 0.7rem; line-height: 1.5; }
  .prose table img { max-height: 200px; }
  .prose code { background: rgba(26,42,82,0.07); padding: 0.1rem 0.4rem; border-radius: 0.3rem; font-size: 0.9em; }
  .prose pre { background: var(--navy); color: #fff; padding: 1.2rem; border-radius: 1rem; overflow-x: auto; }
  .prose pre code { background: none; padding: 0; }
  .prose hr { border: none; height: 1px; background: rgba(26,42,82,0.12); margin: 2.5rem 0; }
  .prose .table-wrap { overflow-x: auto; }
  .prose table { width: 100%; border-collapse: collapse; font-size: 0.95rem; background: #fff; border-radius: 1rem; overflow: hidden; }
  .prose th, .prose td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid rgba(26,42,82,0.07); }
  .prose th { background: var(--navy); color: #fff; font-weight: 500; }
  .toc { background: #fff; border: 1px solid rgba(26,42,82,0.07); border-radius: 1.2rem; padding: 1.3rem 1.6rem; margin-bottom: 2.5rem; }
  .toc p { font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--light-green); font-weight: 500; margin-bottom: 0.6rem; }
  .toc ol { padding-left: 1.2rem; font-size: 0.95rem; line-height: 1.9; }
  .toc a { color: var(--navy); text-decoration: none; }
  .toc a:hover { color: var(--light-green); }
  .post-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 3rem; }
  .post-tag { background: rgba(82,183,136,0.15); color: var(--green); font-size: 0.78rem; padding: 0.35rem 0.9rem; border-radius: 50px; }
  .article-cta { margin-top: 3.5rem; background: var(--navy); border-radius: 1.5rem; padding: 2.5rem; text-align: center; }
  .article-cta h2 { font-family: 'Playfair Display', serif; color: #fff; font-size: 1.6rem; margin-bottom: 0.6rem; }
  .article-cta p { color: rgba(255,255,255,0.65); margin-bottom: 1.5rem; line-height: 1.6; }
  .article-cta .btn-primary { background: var(--light-green); display: inline-block; }
  .related { margin-top: 4rem; }
  .related h2 { font-family: 'Playfair Display', serif; color: var(--navy); font-size: 1.5rem; margin-bottom: 1.5rem; }
  @media (max-width: 600px) { .blog-main { padding-top: 10rem; } }
`;

const NAV = `
<nav>
  <div class="nav-logo">
    <a href="/"><img src="/logoo2.png" alt="Feynlearn — learning by teaching"></a>
  </div>
  <ul class="nav-links">
    <li><a href="/#problem">Problem</a></li>
    <li><a href="/#science">Science</a></li>
    <li><a href="/#solution">How It Works</a></li>
    <li><a href="/#roadmap">Roadmap</a></li>
    <li><a href="/blog/" style="color:var(--light-green);">Blog</a></li>
  </ul>
  <a href="/#cta" class="nav-cta">Join the Pilot</a>
</nav>`;

const FOOTER = `
<footer>
  <div class="footer-logo">Feyn<span>learn</span></div>
  <p>© ${new Date().getFullYear()} Feynlearn (Edtruce) — Learning by Teaching</p>
  <p>Pilot Phase Active · Pune, India</p>
</footer>`;

// depth = folder levels below the site root (blog/ = 1, blog/<slug>/ = 2).
// Root-absolute links ("/#cta", "/logoo2.png") are rewritten to relative ones so
// pages work on feynlearn.in, a GitHub Pages sub-path and a local preview alike.
function page({ depth, ...opts }) {
  const up = '../'.repeat(depth);
  return pageHtml(opts).replace(/(href|src)="\/(?!\/)/g, `$1="${up}`);
}

function pageHtml({ title, description, canonical, keywords, image, ogType = 'website', jsonld, extraHead = '', body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Generated by scripts/build-blog.js — edit the Markdown in /blogs, not this file. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${keywords ? `<meta name="keywords" content="${esc(keywords)}">\n` : ''}<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${canonical}">
<meta name="author" content="Feynlearn (Edtruce)">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Feynlearn">
<meta property="og:locale" content="en_IN">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="${image === DEFAULT_IMAGE ? 'summary' : 'summary_large_image'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
${extraHead}<link rel="icon" href="/logoo2.png" type="image/png" />
<link rel="apple-touch-icon" href="/logoo2.png" />
<meta name="theme-color" content="#ffffff">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c')}
</script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<script defer src="/_vercel/insights/script.js"></script>
<style>${siteCss}${BLOG_CSS}</style>
</head>
<body>
${NAV}
${body}
${FOOTER}
</body>
</html>
`;
}

const ORG = { '@type': 'EducationalOrganization', '@id': `${SITE}/#org`, name: 'Feynlearn', url: `${SITE}/`, logo: DEFAULT_IMAGE };

const authorLine = p => `<span class="post-author">By ${esc(p.author)}${p.authorRole ? `<span>, ${esc(p.authorRole)}</span>` : ''}</span>`;

function card(p) {
  return `
    <a class="post-card" href="/blog/${p.slug}/">
      <div class="post-card-body">
        <span class="post-meta">${fmtDate(p.date)} · ${p.readMins} min read</span>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.description)}</p>
        ${authorLine(p)}
        <span class="btn-ghost">Read article</span>
      </div>
    </a>`;
}

// ── load posts ───────────────────────────────────────────────────────────
if (!fs.existsSync(SRC_DIR)) fs.mkdirSync(SRC_DIR);
const errors = [];
const posts = fs.readdirSync(SRC_DIR)
  .filter(f => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md')
  .map(file => {
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'), file);
    for (const k of ['title', 'description', 'date']) if (!meta[k]) errors.push(`${file}: missing "${k}" in front matter`);
    if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) errors.push(`${file}: date must be YYYY-MM-DD`);
    if (meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) errors.push(`${file}: updated must be YYYY-MM-DD`);
    if (meta.description && meta.description.length > 160) console.warn(`warn  ${file}: description is ${meta.description.length} chars (Google shows ~155)`);
    const { html, headings } = markdown(body);
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      file, html, headings,
      slug: slugify(meta.slug || file.replace(/\.md$/, '')),
      title: meta.title, description: meta.description, date: meta.date, updated: meta.updated || meta.date,
      author: meta.author || 'Feynlearn Team',
      authorRole: meta.author_role || '',
      keywords: meta.keywords || '',
      tags: (meta.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      cover: imgPath(meta.cover || ''), coverAlt: meta.cover_alt || meta.title,
      draft: /^(true|yes)$/i.test(meta.draft || ''),
      readMins: Math.max(1, Math.round(words / 200)),
    };
  })
  .filter(p => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

for (const p of posts) {                                              // local images must exist
  const srcs = [...p.html.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]).concat(p.cover || []);
  for (const src of srcs) {
    if (/^(https?:)?\/\//.test(src)) continue;
    const file = path.join(ROOT, decodeURIComponent(src.split(/[?#]/)[0]));
    if (!fs.existsSync(file)) { errors.push(`${p.file}: image not found "${src}" (put it in /blog-images/)`); continue; }
    const kb = Math.round(fs.statSync(file).size / 1024);
    if (kb > 500) console.warn(`warn  ${p.file}: "${src}" is ${kb} KB, compress it below 500 KB (e.g. squoosh.app) for faster pages`);
  }
}

const slugs = new Set();
for (const p of posts) { if (slugs.has(p.slug)) errors.push(`duplicate slug "${p.slug}"`); slugs.add(p.slug); }
if (errors.length) { console.error(errors.map(e => 'error ' + e).join('\n')); process.exit(1); }

// ── write pages ──────────────────────────────────────────────────────────
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const p of posts) {
  const url = `${SITE}/blog/${p.slug}/`;
  const image = absUrl(p.cover);
  const related = posts.filter(o => o !== p).slice(0, 2);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting', '@id': `${url}#article`, headline: p.title, description: p.description,
        image, datePublished: p.date, dateModified: p.updated, inLanguage: 'en-IN',
        author: p.author === 'Feynlearn Team'
          ? { '@type': 'Organization', name: p.author, url: `${SITE}/` }
          : { '@type': 'Person', name: p.author, ...(p.authorRole && { jobTitle: p.authorRole }), worksFor: { '@id': `${SITE}/#org` } },
        publisher: ORG, mainEntityOfPage: url,
        ...(p.keywords && { keywords: p.keywords }),
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
    ],
  };
  const body = `
<main class="blog-main">
  <article class="article">
    <div class="breadcrumb"><a href="/">Home</a> › <a href="/blog/">Blog</a> › ${esc(p.title)}</div>
    <span class="post-meta">${fmtDate(p.date)} · ${p.readMins} min read</span>
    <h1 class="article-title">${esc(p.title)}</h1>
    <p class="article-desc">${esc(p.description)}</p>
    <p>${authorLine(p)}</p>
    ${p.cover ? `<img class="article-cover" src="${esc(p.cover)}" alt="${esc(p.coverAlt)}">` : ''}
    ${p.headings.length >= 3 ? `<aside class="toc" aria-label="Table of contents"><p>In this article</p><ol>${p.headings.map(h => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')}</ol></aside>` : ''}
    <div class="prose">
${p.html}
    </div>
    ${p.tags.length ? `<div class="post-tags">${p.tags.map(t => `<span class="post-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="article-cta">
      <h2>Learn by teaching with Feynlearn</h2>
      <p>20-minute teach-to-peer Feynman sessions, smart study plans and daily quizzes for Class 9 &amp; 10 students.</p>
      <a class="btn-primary" href="/#cta">Join the Pilot</a>
    </div>
    ${related.length ? `<section class="related"><h2>Keep reading</h2><div class="post-grid">${related.map(card).join('')}</div></section>` : ''}
  </article>
</main>`;
  const dir = path.join(OUT_DIR, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({
    title: `${p.title} | Feynlearn Blog`, description: p.description, canonical: url, keywords: p.keywords,
    image, ogType: 'article', jsonld, body, depth: 2,
    extraHead: `<meta property="article:published_time" content="${p.date}">\n<meta property="article:modified_time" content="${p.updated}">\n`,
  }));
}

const listUrl = `${SITE}/blog/`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), page({
  title: 'Feynlearn Blog — Learning by Teaching, Feynman Technique & Study Tips',
  description: 'Guides on learning by teaching, the Feynman Technique, peer learning and building a consistent study habit for Class 9 & 10 students.',
  canonical: listUrl, image: DEFAULT_IMAGE, depth: 1,
  jsonld: {
    '@context': 'https://schema.org', '@type': 'Blog', '@id': `${listUrl}#blog`, name: 'Feynlearn Blog', url: listUrl,
    inLanguage: 'en-IN', publisher: ORG,
    blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}/`, datePublished: p.date })),
  },
  body: `
<main class="blog-main">
  <div class="blog-head">
    <div class="section-label">Feynlearn Blog</div>
    <h1 class="section-title">Learn it. <em>Teach it.</em><br>Master it.</h1>
    <p class="section-sub">Guides on learning by teaching, the Feynman Technique, peer learning and studying consistently.</p>
  </div>
  ${posts.length ? `<div class="post-grid">${posts.map(card).join('')}</div>` : '<p class="post-empty">New articles coming soon.</p>'}
</main>`,
}));

// ── sitemap ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, lastmod: today, image: DEFAULT_IMAGE },
  { loc: listUrl, lastmod: posts[0]?.updated || today },
  ...posts.map(p => ({ loc: `${SITE}/blog/${p.slug}/`, lastmod: p.updated, image: p.cover ? absUrl(p.cover) : '' })),
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>${u.image ? `\n    <image:image><image:loc>${esc(u.image)}</image:loc></image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`);

console.log(`built ${posts.length} post(s) → blog/, sitemap.xml updated`);
