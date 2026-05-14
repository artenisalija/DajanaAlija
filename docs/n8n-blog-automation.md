# n8n Daily Blog Automation

This repo now has a GitHub Action that can publish static SEO blog posts from n8n.

## Flow Shape

1. Schedule trigger runs once per day in n8n.
2. Research branding/marketing topics from approved sources.
3. Generate an original article, not copied or lightly rewritten from sources.
4. Send the finished article JSON to GitHub with a `repository_dispatch` event.
5. GitHub Actions creates:
   - `blog/{slug}/index.html`
   - a new card in `blog/index.html`
   - a new URL in `sitemap.xml`

## GitHub Request From n8n

Use an HTTP Request node:

- Method: `POST`
- URL: `https://api.github.com/repos/artenisalija/DajanaAlija/dispatches`
- Authentication: GitHub personal access token
- Headers:
  - `Accept: application/vnd.github+json`
  - `Authorization: Bearer YOUR_GITHUB_TOKEN`
  - `X-GitHub-Api-Version: 2022-11-28`
- Body type: JSON

```json
{
  "event_type": "publish_blog_post",
  "client_payload": {
    "title": "Brand Audit Checklist: How to Find the Gaps Holding Your Business Back",
    "slug": "brand-audit-checklist",
    "category": "Brand Strategy",
    "publishedAt": "2026-05-14",
    "readTime": "8 min read",
    "metaDescription": "Use this brand audit checklist to find positioning, messaging, visual identity, and social media gaps that may be holding your business back.",
    "excerpt": "A practical brand audit checklist for founders who want to identify what is weakening trust, clarity, and conversion.",
    "keywords": [
      "brand audit checklist",
      "brand audit",
      "brand strategy audit",
      "brand consistency audit"
    ],
    "contentHtml": "<p>Your intro paragraph here.</p><h2>First Section</h2><p>Article body here.</p>",
    "ctaLabel": "Need a Brand Audit?",
    "ctaTitle": "Let's Strengthen Your <em class=\"gold-text italic\">Brand</em>",
    "ctaText": "If your brand feels scattered, a focused audit can show what needs to change first.",
    "ctaButtonText": "Get in Touch",
    "ctaButtonHref": "/contact/"
  }
}
```

## Required GitHub Token

Create a GitHub fine-grained personal access token with access to:

- Repository: `artenisalija/DajanaAlija`
- Permission: `Contents: Read and write`
- Permission: `Actions: Read and write` if your account requires it for dispatch events

Save it in n8n credentials or as an n8n environment variable. Do not put it in the workflow body.

## Recommended Article Rules

Ask the AI/content step to produce:

- 1,200 to 2,000 words
- one clear search intent
- one primary keyword
- 4 to 8 supporting keywords
- original analysis in Dajana's voice
- headings using `<h2>` and `<h3>`
- internal links to `/services/`, `/contact/`, and relevant `/blog/.../` posts
- no copied paragraphs from research sources
- no unsupported statistics unless sources are cited

## Suggested Research Sources

Use these as research inputs, then synthesize original content:

- Think with Google
- HubSpot Marketing Blog
- Semrush Blog
- Ahrefs Blog
- Moz Blog
- Search Engine Journal
- Nielsen Norman Group
- Content Marketing Institute
- Sprout Social Insights
- Hootsuite Blog
- Later Blog
- Buffer Blog

## Local Test

You can test the publisher locally:

```powershell
$env:ARTICLE_JSON = Get-Content -Raw .\sample-article.json
node scripts/publish-blog-post.mjs
```

