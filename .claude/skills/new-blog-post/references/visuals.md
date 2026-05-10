# Building an Interactive Visual

A "visual" is a small playable React component lives under `src/visuals/<slug>/` and is reachable at `/visuals/<slug>`. Posts link to them via `<VisualEmbed>`.

Two examples to read first:

- `src/visuals/attention-tiling/AttentionTilingVisual.tsx` — step-through animation, mode toggle, sliders, derived stats
- `src/visuals/memory-hierarchy/MemoryHierarchyVisual.tsx` — animated tower, hover reveals, side-bar narration

Both are roughly 200 lines of TSX + a CSS file. Aim for that size — anything bigger is two visuals.

## Anatomy

```
src/visuals/<slug>/
├── meta.ts                  # VisualMeta with slug, title, description, relatedPostSlug
├── <Name>Visual.tsx         # default-exported React component
└── <Name>Visual.css         # scoped styles, BEM-ish class names: <kebab>, <kebab>__part
```

Then register in `src/visuals/index.ts`:

```ts
import { meta as <camel>Meta } from './<slug>/meta';
import <Name>Visual from './<slug>/<Name>Visual';

export const visuals: Visual[] = [
  { meta: <camel>Meta, Component: <Name>Visual },
  ...
];
```

## Design rules

- **No external chart libraries.** React + SVG + CSS only. Keep the bundle small and the source readable.
- **One visual = one idea.** If you find yourself adding tabs for unrelated demos, split.
- **Deterministic frames.** Render is a pure function of the current state. Animations come from advancing state on a `setInterval`, not from CSS keyframes that drift out of sync with state.
- **Always provide controls.** Play/pause, reset, and at least one parameter slider or mode toggle. The reader should be able to *do something*.
- **Keep the legend visible.** If colors mean things, label them in a tiny legend row at the bottom.
- **Mobile-friendly.** Use `flex-wrap` on control rows, set `overflow-x: auto` on wide diagrams. Test at 375 px.
- **Cleanup.** Every `setInterval`/`setTimeout` must be cleared in the effect's cleanup.

## Color tokens

Use the same palette as the rest of the site (so the visual feels like part of the post, not an iframe):

| Token | Hex | Used for |
|-------|-----|---------|
| `--bg` | `#0a0a0f` | Page background |
| `--bg2` | `#111118` | Card background |
| `--bg3` | `#1a1a24` | Inputs, chips |
| `--border` | `#2a2a3a` | Dividers |
| `--accent` | `#7c6af7` | Primary accent (purple) |
| `--accent2` | `#a594ff` | Light accent |
| `--accent3` | `#4adeaa` | "Good" / green |
| `--accent4` | `#f7a06a` | "Warning" / orange |
| `--red` | `#f76a7c` | "Bad" |
| `--blue` | `#6ab4f7` | Hardware names |
| `--yellow` | `#f7d96a` | Highlights |

## Performance

- Memoize anything that depends on slider values (`useMemo`)
- Avoid creating large arrays in the render path
- Don't trigger React re-renders at >60 Hz; cap intervals to ≥150 ms
- Use SVG `rect`s for grids of cells; canvas only if you have hundreds of moving particles

## Linking from the post

Inside the post, drop:

```tsx
<VisualEmbed
  to="/visuals/<slug>"
  title="<Title>"
  description="<What the reader will play with.>"
/>
```

Place it where the corresponding text idea peaks — usually at the end of the section where you'd otherwise put a static diagram.
