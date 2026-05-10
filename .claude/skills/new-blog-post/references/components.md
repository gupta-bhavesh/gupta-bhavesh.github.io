# Blog Component Catalogue

All blog primitives live under `src/components/blog/`. Import paths from a post are `../../components/blog/<Name>`.

## BlogHero

Top of every post. Renders a full-bleed hero with tag, large serif title, subtitle, and a row of meta items.

```tsx
<BlogHero
  tag="Deep Dive · Transformers · Systems"
  title={
    <>
      FlashAttention:
      <br />
      <em>How Transformers</em>
      <br />
      Got Fast
    </>
  }
  subtitle="A ground-up explanation of FlashAttention 1 and 2..."
  meta={[
    { label: 'papers', value: 'FA1 (2022) & FA2 (2023)' },
    { label: 'by', value: 'Dao et al.' },
  ]}
/>
```

Notes:
- Wrap the highlighted phrase in `<em>` for the accent color.
- 1–3 lines max; line breaks via `<br />`.
- Meta is optional; supply 0–4 items.

## PostShell

Wraps the rest of the post body so it gets the right max-width and side padding.

```tsx
<PostShell>
  <Section ... />
  <Section ... />
</PostShell>
```

## Section

Every chapter of the post. Always pass `label` (the `§ NN — Topic` format) and `title`. Children are the body.

```tsx
<Section label="§ 03 — The Math" title="Online Softmax: The Key Algorithm">
  <p>...</p>
  <h3>...</h3>
</Section>
```

## Callout

Highlighted box. Pick a variant by intent.

```tsx
<Callout label="Core Insight" variant="insight">
  <p>The goal is not to reduce FLOPs — it's to eliminate HBM round trips.</p>
</Callout>
```

| Variant | When |
|--------|------|
| `insight` (default) | A non-obvious idea or takeaway |
| `success` | A nice result or "this is what makes X possible" |
| `warning` | Pitfalls, gotchas, things that look wrong |

Body must be one or more `<p>` tags.

## CodeBlock + Tok

Pseudo-code blocks. Default variant has a left border and tinted background. `variant="plain"` strips the chrome (use inside a `Diagram`).

```tsx
<CodeBlock>
  {Tok.c('# comment\n')}
  {Tok.k('for')} i in range(N):  {Tok.c('# loop\n')}
  {'    '}{Tok.v('x')} = compute(i)
</CodeBlock>
```

`Tok` colours:

| Token | Class | Color | Use |
|-------|-------|-------|-----|
| `Tok.c` | `tok-c` | text3 | Comments |
| `Tok.k` | `tok-k` | accent2 | Keywords (`for`, `if`, `final`) |
| `Tok.v` | `tok-v` | accent3 | "Good" or new value (often green) |
| `Tok.n` | `tok-n` | accent4 | Notation symbols |
| `Tok.h` | `tok-h` | yellow | Highlights |
| `Tok.r` | `tok-r` | red | "Bad" or old value |
| `Tok.b` | `tok-b` | blue | Hardware names (HBM, SRAM) |

Always preserve indentation with regular space strings. Don't use HTML entities for whitespace.

## MathBlock

Centered serif math. Use real `<sub>` and `<sup>`, not LaTeX.

```tsx
<MathBlock>
  Attention(Q, K, V) = softmax( QK<sup>T</sup> / √d<sub>k</sub> ) · V
</MathBlock>
```

## StatGrid + StatCard

Three-up "headline number" row. Auto-fits.

```tsx
<StatGrid>
  <StatCard value="64MB" label="attention matrix per head" color="var(--accent4)" />
  <StatCard value="O(N²)" label="memory complexity" color="var(--red)" />
  <StatCard value="O(N²)" label="time complexity" color="var(--accent2)" />
</StatGrid>
```

`color` accepts a CSS var. Available palette tokens (defined in `src/styles/theme.css`):
`--accent`, `--accent2`, `--accent3`, `--accent4`, `--red`, `--blue`, `--yellow`.

`label` can be a multiline ReactNode (use `<>...<br />...</>`) for two-line captions.

## ComparisonTable

The right tool for "before vs after" or N-way comparisons. Cells can be tone-tagged.

```tsx
<ComparisonTable
  headers={['Metric', 'Standard', 'FA1', 'FA2']}
  rows={[
    ['Memory complexity',
      { value: 'O(N²)', tone: 'bad' },
      { value: 'O(N)', tone: 'good' },
      { value: 'O(N)', tone: 'good' }],
    ['HBM reads/writes',
      { value: 'O(N²)', tone: 'bad' },
      'O(N² / M)',
      { value: '~O(N² / M)', tone: 'good' }],
  ]}
/>
```

Pass either a plain ReactNode or a `{ value, tone }` object per cell. `tone: 'good' | 'bad'`.

## Diagram

Wraps an ascii diagram, schematic, or inline SVG. Use a `CodeBlock variant="plain"` inside for ascii.

```tsx
<Diagram title="A100 GPU Memory Hierarchy">
  <CodeBlock variant="plain">{`SRAM  (on-chip, inside each SM)
  Size  : ~164 KB per SM
  Speed : ~19 TB/s

HBM   (off-chip, "GPU RAM")
  Size  : 40–80 GB
  Speed : ~2 TB/s`}</CodeBlock>
</Diagram>
```

## Improvement

Numbered cards with a colored left bar. Use them when you have 2–4 named "things that changed".

```tsx
<Improvement variant={1} number="Improvement 01" title="Swap the loop order">
  <p>...</p>
  <CodeBlock>...</CodeBlock>
</Improvement>
```

`variant: 1 | 2 | 3` cycles the accent color. Keep numbers and titles short.

## VisualEmbed

Inline call-to-action linking to an interactive visual under `/visuals/<slug>`.

```tsx
<VisualEmbed
  to="/visuals/attention-tiling"
  title="Attention Tiling — interactive"
  description="Step through how FA1 sweeps tiles. Adjust block size, watch m, ℓ, O update."
/>
```

Only include this if you actually shipped the visual at that slug. Don't link to a 404.
