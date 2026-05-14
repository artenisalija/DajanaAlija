import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const domain = "https://dajanahoti.com";
const authorName = "Dajana Hoti";
const pixelCode = `<!-- Meta Pixel Code -->
  <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '1458621632129887'); fbq('track', 'PageView');</script>
  <noscript><img height="1" width="1" src="https://www.facebook.com/tr?id=1458621632129887&ev=PageView&noscript=1"/></noscript>
  <!-- End Meta Pixel Code -->`;

function readJsonPayload() {
  if (process.env.ARTICLE_JSON) {
    return JSON.parse(process.env.ARTICLE_JSON);
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error("No ARTICLE_JSON or GITHUB_EVENT_PATH payload found.");
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  if (event.client_payload) return event.client_payload.article || event.client_payload;
  if (event.inputs?.article_json) return JSON.parse(event.inputs.article_json);

  throw new Error("No article payload found. Send repository_dispatch.client_payload or workflow_dispatch input article_json.");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeArticleHtml(html) {
  const allowedTags = new Set([
    "p",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "a",
    "blockquote",
    "br",
  ]);

  return String(html || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(?:style|class|id)="[^"]*"/gi, "")
    .replace(/<\/?([a-z0-9-]+)(\s[^>]*)?>/gi, (match, tag, attrs = "") => {
      const normalizedTag = tag.toLowerCase();
      if (!allowedTags.has(normalizedTag)) return "";
      if (normalizedTag !== "a") return match.startsWith("</") ? `</${normalizedTag}>` : `<${normalizedTag}>`;

      const hrefMatch = attrs.match(/\shref=(["'])(.*?)\1/i);
      if (!hrefMatch) return match.startsWith("</") ? "</a>" : "<a>";

      const href = hrefMatch[2];
      const isAllowedHref = href.startsWith("/") || href.startsWith("https://") || href.startsWith("http://");
      if (!isAllowedHref) return match.startsWith("</") ? "</a>" : "<a>";

      const externalAttrs = href.startsWith("http") ? ` target="_blank" rel="noopener noreferrer"` : "";
      return match.startsWith("</") ? "</a>" : `<a href="${escapeHtml(href)}"${externalAttrs}>`;
    });
}

function formatDisplayDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid date: ${isoDate}`);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function normalizePayload(raw) {
  const publishedAt = raw.publishedAt || raw.datePublished || new Date().toISOString().slice(0, 10);
  const title = String(raw.title || "").trim();
  const description = String(raw.metaDescription || raw.description || "").trim();
  const excerpt = String(raw.excerpt || description).trim();
  const category = String(raw.category || "Brand Strategy").trim();
  const slug = slugify(raw.slug || title);
  const readTime = String(raw.readTime || raw.readingTime || "7 min read").trim();
  const keywords = Array.isArray(raw.keywords) ? raw.keywords.map(String).filter(Boolean) : [];
  const contentHtml = sanitizeArticleHtml(raw.contentHtml || raw.html || "");

  if (!title) throw new Error("Article payload needs a title.");
  if (!description) throw new Error("Article payload needs metaDescription or description.");
  if (!contentHtml || contentHtml.length < 1200) {
    throw new Error("Article payload needs contentHtml/html with at least 1200 characters.");
  }
  if (!slug) throw new Error("Could not create a slug from the title.");

  return {
    title,
    description,
    excerpt,
    category,
    slug,
    readTime,
    publishedAt,
    displayDate: formatDisplayDate(publishedAt),
    keywords,
    contentHtml,
    ctaLabel: String(raw.ctaLabel || "Ready to Build Your Brand?").trim(),
    ctaTitle: String(raw.ctaTitle || "Let's Build Your <em class=\"gold-text italic\">Strategy</em>").trim(),
    ctaText: String(
      raw.ctaText ||
        "If this topic connects with where your business is heading, the next step is a clear strategy built around your audience, offer, and goals."
    ).trim(),
    ctaButtonText: String(raw.ctaButtonText || "Get in Touch").trim(),
    ctaButtonHref: String(raw.ctaButtonHref || "/contact/").trim(),
  };
}

function buildArticlePage(article) {
  const url = `${domain}/blog/${article.slug}/`;
  const keywordJson = JSON.stringify(article.keywords);
  const articleJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      author: { "@type": "Person", name: authorName, url: domain },
      publisher: { "@type": "Person", name: authorName, url: domain },
      url,
      keywords: article.keywords,
    },
    null,
    8
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(article.description)}" />
    <title>${escapeHtml(article.title)} | Dajana Hoti Blog</title>
    <meta name="theme-color" content="#000000" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(article.title)}" />
    <meta property="og:description" content="${escapeHtml(article.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${domain}/assets/favicon.png" />
    <meta name="keywords" content="${escapeHtml(article.keywords.join(", "))}" />
    <link rel="icon" href="${domain}/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="${domain}/assets/favicon.png?v=2" />
    <link rel="apple-touch-icon" href="${domain}/assets/favicon-192.png?v=2" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600;1,700&display=swap"
      rel="stylesheet"
      media="print"
      onload="this.media='all'"
    />
    <noscript>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600;1,700&display=swap" rel="stylesheet" />
    </noscript>
    <link rel="stylesheet" href="../../styles.css" />
    <script type="application/ld+json">
      ${articleJson}
    </script>
    ${pixelCode}
  </head>
  <body>
    <header class="site-header">
      <div class="container nav-shell">
        <a href="/" class="logo">
          <img class="logo-primary" src="../../assets/logo-primary.png" alt="Dajana Hoti logo" width="600" height="200" />
        </a>
        <input type="checkbox" id="menu-toggle" class="menu-toggle" />
        <label for="menu-toggle" class="hamburger" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </label>
        <nav class="main-nav" aria-label="Main navigation">
          <a href="/services/">Services</a>
          <a href="/about/">About</a>
          <a href="/blog/">Blog</a>
          <a href="https://form.jotform.com/260553798020054" target="_blank" rel="noopener noreferrer">Tell Me More</a>
          <a href="/contact/" class="btn btn-nav">Contact</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="article-hero">
        <div class="container">
          <a href="/blog/" class="back-link">&larr; Back to Blog</a>
          <span class="blog-tag">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <div class="post-meta" style="margin-top:1.2rem">
            <span>${article.displayDate}</span>
            <span>${escapeHtml(article.readTime)}</span>
            <span>By ${authorName}</span>
          </div>
        </div>
      </section>

      <section class="article-wrap">
        <div class="container">
          <article class="article-body">
            ${article.contentHtml}

            <div class="article-cta">
              <p class="section-label">${escapeHtml(article.ctaLabel)}</p>
              <h2>${article.ctaTitle}</h2>
              <p>${escapeHtml(article.ctaText)}</p>
              <a class="btn" href="${escapeHtml(article.ctaButtonHref)}">${escapeHtml(article.ctaButtonText)}</a>
            </div>
          </article>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-shell">
        <p class="logo">
          <img class="logo-primary" src="../../assets/logo-primary.png" alt="Dajana Hoti logo" width="600" height="200" />
        </p>
        <p>&copy; 2026 Dajana Hoti. All rights reserved.</p>
      </div>
    </footer>
  </body>
</html>
`;
}

function buildBlogCard(article) {
  return `
            <a href="/blog/${article.slug}/" class="blog-card">
              <span class="blog-tag">${escapeHtml(article.category)}</span>
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(article.excerpt)}</p>
              <div class="post-meta">
                <span>${article.displayDate}</span>
                <span>${escapeHtml(article.readTime)}</span>
              </div>
            </a>`;
}

function updateBlogIndex(article) {
  const file = path.join(root, "blog", "index.html");
  let html = fs.readFileSync(file, "utf8");
  const href = `/blog/${article.slug}/`;
  if (html.includes(`href="${href}"`)) return;

  html = html.replace(/(<div class="blog-grid">)/, `$1\n${buildBlogCard(article)}\n`);
  fs.writeFileSync(file, html);
}

function updateSitemap(article) {
  const file = path.join(root, "sitemap.xml");
  let xml = fs.readFileSync(file, "utf8");
  const loc = `${domain}/blog/${article.slug}/`;
  if (xml.includes(`<loc>${loc}</loc>`)) return;

  const entry = `  <url>
    <loc>${loc}</loc>
    <lastmod>${article.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

`;
  xml = xml.replace("</urlset>", `${entry}</urlset>`);
  fs.writeFileSync(file, xml);
}

const article = normalizePayload(readJsonPayload());
const postDir = path.join(root, "blog", article.slug);
const postFile = path.join(postDir, "index.html");

if (fs.existsSync(postFile) && process.env.OVERWRITE_EXISTING !== "true") {
  throw new Error(`Blog post already exists: blog/${article.slug}/index.html. Set OVERWRITE_EXISTING=true to replace it.`);
}

fs.mkdirSync(postDir, { recursive: true });
fs.writeFileSync(postFile, buildArticlePage(article));
updateBlogIndex(article);
updateSitemap(article);

console.log(`Published blog post: ${domain}/blog/${article.slug}/`);
console.log(`Keywords: ${JSON.stringify(article.keywords)}`);
