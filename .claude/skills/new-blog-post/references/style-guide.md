# Voice and Structure Guide

The site's voice is that of an engineer explaining something to a smart peer. Direct, specific, no fluff.

## Voice rules

- **Lead with the question, not the conclusion.** First sentence of the post tells the reader what problem this post answers.
- **Numbers > adjectives.** "9× faster" beats "much faster". "64 MB" beats "a lot of memory".
- **Active voice.** "FlashAttention keeps Q in SRAM" — not "Q is kept in SRAM".
- **Short paragraphs.** 3–5 sentences. If a paragraph runs longer, it's two ideas, split it.
- **Hedge sparingly.** "It's roughly 2×" is fine. "Some might argue" is not.
- **Real glyphs in body text.** `×`, `−`, `√`, `Σ`, `→`, `ᵀ`. Not `*`, `-`, `sqrt`, `sum`, `->`, `^T`. Inside `<CodeBlock>` either is fine.
- **No emojis** unless the user explicitly asks.
- **No "we", "I", "you" speeches.** "Notice that" / "The cost is" is the register. "I think" / "we'll see" is not.

## Structure rules

A post has the shape:

1. **Hero** — tag, title, subtitle, meta
2. **§ 01 — The Problem / The Question** — sets up *why* this exists
3. **§ 02..N — The Substance** — each Section is one idea, broken into sub-sections via `<h3>`
4. **§ N — Summary / Takeaway** — closes the loop, ideally with one Callout

Section labels are `§ NN — <Topic>`. Two digits, em-dash with spaces.

Section titles use the serif display font; keep them short (4–7 words) and concrete. Avoid clickbait ("The Surprising Truth About X") and avoid fluff ("Some Thoughts On Y").

Inside a Section:
- One sentence opener stating the section's job
- Body paragraphs, broken by `<h3>` for sub-topics
- Visual aids (`Diagram`, `MathBlock`, `CodeBlock`, `StatGrid`, `ComparisonTable`)
- One `Callout` for the section's punchline (optional but encouraged)

## Strong / em / code rules

- `<strong>` highlights one or two terms per paragraph. If everything is strong, nothing is.
- `<em>` is for *natural* emphasis ("the *where* of computation"). It is not bold's quieter sibling.
- `<code>` is for things that look like code: variable names (`Q`, `O`, `m_new`), API shapes (`QKᵀ`, `O(N²)`), file paths.
- Numbers with units stay in plain text: "64 MB", not `<code>64 MB</code>`.

## What not to do

- Don't open a section with "Let's talk about X." Open with what *about* X you'll say.
- Don't paste long code dumps. If a CodeBlock is more than ~40 lines, condense or split.
- Don't write multi-paragraph captions on diagrams; the diagram's title plus a following paragraph is enough.
- Don't repeat what a `ComparisonTable` already shows in prose. Pick one.
- Don't add a "Conclusion" Section labelled "Conclusion". It's "Takeaway", "The Bigger Picture", or topic-specific.
- Don't include TODO comments, scaffolding, or commented-out blocks in shipped posts.
