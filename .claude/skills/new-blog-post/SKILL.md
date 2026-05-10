---
name: new-blog-post
description: Author a new blog post for this personal site. Use when the user wants to add, draft, write, or publish a blog post, port an article, or create a deep-dive write-up. Sets up the post directory, the meta + Post.tsx files, registers in the index, follows the site's component vocabulary, and optionally scaffolds a companion interactive visual.
---

# New Blog Post

A guide for authoring a blog post on this site with the same look, feel, and engineering quality as the existing posts (`flash-attention`, `hardware-story`).

The site is a Vite + React + TypeScript SPA. Posts are React components, not Markdown. They compose a small library of typed components (hero, section, callout, code block, comparison table, stat cards, diagrams, improvement cards, visual embeds). Following these conventions keeps every post visually consistent and easy to maintain.

## When to use this skill

Trigger this skill when the user asks any of:

- "Add a blog post about X"
- "Port this article to the site"
- "Write a new deep-dive on Y"
- "Create a draft for Z"
- "Add a new entry to the blog"

Do **not** trigger for: tweaks to an existing post, layout changes, or non-blog content.

## What you'll produce

For every new post:

1. `src/posts/<slug>/meta.ts` — typed metadata
2. `src/posts/<slug>/Post.tsx` — the post itself
3. One added line in `src/posts/index.ts` — registration

Optionally, when the post benefits from an interactive demo:

4. `src/visuals/<visual-slug>/meta.ts`
5. `src/visuals/<visual-slug>/<Name>Visual.tsx` (+ `.css`)
6. One added line in `src/visuals/index.ts`
7. A `<VisualEmbed to="/visuals/<visual-slug>" ... />` link inside the post

## End-to-end workflow

Follow these steps in order. Stop and ask the user only when input is genuinely ambiguous (slug name, tone, whether to include a visual).

### 1. Gather inputs

Confirm with the user (one short message, not a barrage):

- **Topic** — the actual subject of the post
- **Source** — original article URL, paper, notes, or "from scratch"
- **Slug suggestion** — short kebab-case (default: derived from the title)
- **Visual?** — should it ship with an interactive companion under `/visuals/<slug>`?

If the user already supplied these in their initial message, proceed without re-asking.

### 2. Read the existing site

Before writing anything, read `src/posts/flash-attention/Post.tsx` to internalize the structure and component usage. The new post should feel like a sibling, not a stylistic outlier. Then skim `src/components/blog/` to confirm the available primitives.

### 3. Choose the slug + create the directory

Slug is kebab-case, descriptive, stable (will live in URLs). Examples: `flash-attention`, `hardware-story-behind-llms`, `kv-cache-tour`.

Create `src/posts/<slug>/` and write `meta.ts` and `Post.tsx`. Templates live alongside this skill in `templates/`.

### 4. Author with the component vocabulary

See `references/components.md` for the full catalogue. Quick mental model:

- `BlogHero` — once at the top, sets the tag/title/subtitle/meta
- `PostShell` — wraps the body so layout stays consistent
- `Section` — every numbered chapter (`§ 01 — ...`); always `label + title + body`
- `Callout` — set off insights, warnings, or "the punchline" (`variant: insight | warning | success`)
- `CodeBlock` + `Tok` — colored pseudo-code; never paste raw `<pre>`
- `MathBlock` — formulas; uses real `<sup>` / `<sub>` tags, not LaTeX
- `StatGrid` + `StatCard` — three-up "headline number" rows
- `ComparisonTable` — the right tool for "before vs after" or "A vs B" rows; cells can be tone-tagged `{ value, tone: 'good' | 'bad' }`
- `Diagram` — wraps an ascii diagram, schematic, or inline SVG with a caption
- `Improvement` — numbered cards (`variant: 1 | 2 | 3`) for "this is what changed"
- `VisualEmbed` — link to an interactive page under `/visuals/...`

When in doubt, follow what `flash-attention/Post.tsx` does for that situation.

### 5. Style + voice

Read `references/style-guide.md`. Short version:

- Lead with the question, not the conclusion
- Each section opens with one sentence stating its job
- Prefer short paragraphs (3–5 sentences)
- Numbers > adjectives ("64MB", "9× faster", not "very fast")
- Italics in `<em>` only inside `BlogHero` titles for the highlighted phrase
- Strong (`<strong>`) for one or two terms per paragraph, not whole clauses
- Wrap inline code/numbers in `<code>` when they're API-shaped (`QKᵀ`, `O(N²)`)
- Use real Unicode glyphs in body text (`×`, `−`, `√`, `Σ`, `→`, `ᵀ`)
- End each post with a "bigger picture" Section, ideally containing one Callout

### 6. Add visuals (the visual ones)

Three kinds of visual content are welcome:

| Kind | Use when | How |
|------|----------|-----|
| ASCII / textual diagram | Hierarchies, layouts, mask shapes | `<Diagram title="..."><CodeBlock variant="plain">{...}</CodeBlock></Diagram>` |
| Static SVG | Simple, fixed schematics | Inline `<svg>` inside a `<Diagram>` |
| Interactive visualization | Anything the reader should *play* with — animations, sliders, mode toggles, simulations | New entry under `src/visuals/<visual-slug>/` + `<VisualEmbed>` in the post. See `references/visuals.md`. |

Static images go in `public/posts/<slug>/<filename>` and are referenced as `/posts/<slug>/<filename>`. See `references/images.md`.

### 7. Register the post

Add the import + entry in `src/posts/index.ts`. The list is sorted by date in `getSortedPosts`, so order in the array doesn't matter for users — but keep newest at the top of the array for clarity.

### 8. Verify

Run, in order:

```bash
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:5173/blog/<slug>` and walk the page top to bottom. Check that:

- The hero renders with the right tag, title, subtitle, meta
- Every Section has a numbered label and title
- Code blocks are not overflowing horizontally
- Stat cards are colored
- Comparison tables have tone colors where appropriate
- Any `VisualEmbed` links open the matching visual page

Then visit `/blog` to confirm the new card appears with the right meta.

If a companion visual was added, also load `/visuals/<visual-slug>` and click around it.

### 9. Commit

Use a Conventional Commit:

```
feat(blog): add <title> post
```

If a visual is included:

```
feat(blog): add <title> post + <visual> visual
```

Push to `main` — the GitHub Actions workflow rebuilds and redeploys the site automatically.

## Quality bar — do not ship a post until all of these are true

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Post renders on `/blog/<slug>` with no console errors
- [ ] Card renders on `/blog`
- [ ] No raw `<pre>`, no inline `style={{ ...}}` blobs, no inline `<table>` outside `ComparisonTable`
- [ ] No emojis (unless the user explicitly asked)
- [ ] No comments inside the React tree explaining what each component does
- [ ] No TODOs, no commented-out scaffolding
- [ ] Each section has a label, a title, a one-sentence opener, and a clean close
- [ ] At least one Callout in the post (insight, success, or warning)
- [ ] The closing Section ties back to the opening question

## Files

- `templates/meta.ts.tpl` — meta.ts skeleton
- `templates/Post.tsx.tpl` — post skeleton
- `templates/visual-meta.ts.tpl` — visual meta skeleton
- `templates/Visual.tsx.tpl` — visual component skeleton
- `references/components.md` — full component catalogue with usage
- `references/style-guide.md` — voice, structure, do's and don'ts
- `references/visuals.md` — how to build a visual that fits the site
- `references/images.md` — where to put images and how to embed them
