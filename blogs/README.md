# Writing a blog post

1. Create a Markdown file in this folder, e.g. `blogs/peer-teaching-guide.md`.
   The file name becomes the URL: `https://feynlearn.in/blog/peer-teaching-guide/`.
2. Start it with front matter:

```markdown
---
title: Peer Teaching: What It Is and Why It Works
description: One or two sentences (max ~155 characters). Shown in Google results.
date: 2026-11-01
updated: 2026-11-05            # optional, set when you edit a published post
author: Ajit Mote              # optional, defaults to "Feynlearn Team"
author_role: Founding Engineer # optional, shown after the name
keywords: peer teaching, peer learning, learn by teaching   # optional
tags: Peer Learning, Study Tips                             # optional, shown on the page
cover: /blog-images/peer-teaching.jpg                       # optional, 1200×630 recommended
cover_alt: Two students explaining a maths problem          # optional
slug: peer-teaching                                         # optional, overrides the file name
draft: true                                                 # optional, draft posts are not published
---
```

3. Write the article below the front matter. Supported Markdown:
   `## Heading` / `### Subheading`, paragraphs, `**bold**`, `*italic*`, `[links](/blog/other-post/)`,
   `![images](/blog-images/x.jpg)`, `- lists`, `1. lists`, `> quotes`, tables, code blocks, `---`.
   Don't use a single `#` heading. The title is already the page's H1.
4. Commit and push the `.md` file (and any new images) to `main`. That's it.
   The deploy builds the HTML page, adds it to the blog list and updates `sitemap.xml` automatically.
   Editing a `.md` file and pushing updates the live post. Deleting it removes the post.

Notes
- There's nothing to run. If a post is missing `title`, `description` or `date`, the deploy fails.
  The error is shown in the GitHub **Actions** tab, and the live site stays unchanged.
- Optional local preview: `node scripts/build-blog.js` then `npx serve .` and open `http://localhost:3000/blog/`.

## Adding images

1. Put the image file in the `blog-images/` folder at the project root, e.g. `blog-images/peer-teaching-diagram.jpg`.
2. Use it in the post:

```markdown
![Two students solving an equation together](blog-images/peer-teaching-diagram.jpg)

![Student explaining on a whiteboard](blog-images/whiteboard.jpg "This text becomes a caption under the image")
```

- Any size works. Images shrink to fit the article width on desktop and mobile, keep their shape,
  and very tall images are capped so they don't take over the page. Nothing will overflow.
- An image on its own line is centred, and the optional `"..."` text becomes a caption.
- Always write the `[alt text]`: describe the picture for Google and for screen readers.
- `blog-images/x.jpg`, `/blog-images/x.jpg` and `../blog-images/x.jpg` all work.
- Cover image (optional, shown at the top of the post and in WhatsApp/LinkedIn link previews, not on the blog list):
  `cover: blog-images/x.jpg` in the front matter. It's cropped to 1200×630, so keep the important part in the centre.
  Use .jpg or .png for covers, because social apps don't show SVG previews.
- Use `.jpg` for photos and `.png` or `.svg` for diagrams and screenshots, ideally under 500 KB
  (compress at squoosh.app). File names: lowercase-with-dashes, no spaces.
- If an image path is wrong or the file is missing, the deploy stops with a clear error naming the image,
  and the live site stays unchanged.
- SEO: target **one main search phrase per post**. Use it in the title, description, first paragraph and one `##` heading,
  and link to at least one other post plus the homepage. See `SEO-KEYWORDS.md` for topic ideas.
- Files starting with `_` are ignored (useful for templates).
