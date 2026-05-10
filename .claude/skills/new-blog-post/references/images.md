# Images and Static Assets

Most of the site's "visuals" are React components, ASCII diagrams, or inline SVG. Use raster images sparingly — they're heavy, they don't theme with dark mode, and they tend to age poorly.

When you do need a real image (a photo, a paper figure with permission, a hand-drawn diagram you've already exported), follow the conventions below.

## Where to put files

Static assets live under `public/`. Vite serves the contents of `public/` at the site root.

For post-scoped images:

```
public/posts/<post-slug>/<filename>
```

For visual-scoped:

```
public/visuals/<visual-slug>/<filename>
```

For shared / site-wide:

```
public/<filename>
```

URL = the path with `public/` stripped. So `public/posts/flash-attention/diagram.png` becomes `/posts/flash-attention/diagram.png`.

## Embedding an image in a post

Use a plain `<img>` inside a `<Diagram>` so the image gets the standard frame, caption, and overflow handling.

```tsx
<Diagram title="Memory hierarchy of an A100">
  <img
    src="/posts/flash-attention/memory-tower.svg"
    alt="A100 memory hierarchy: SRAM (164 KB, 19 TB/s) sits above HBM (40-80 GB, 2 TB/s)."
    style={{ width: '100%', display: 'block' }}
    loading="lazy"
  />
</Diagram>
```

Always:

- **alt text** is mandatory. Describe the *information*, not the appearance ("A100 memory hierarchy: SRAM..." not "diagram of memory").
- **`loading="lazy"`** on every image not above the fold.
- **`width: 100%`** so it fits the post container.
- Use **SVG** when possible. Vector. Themable. Tiny.

## Format guidance

| Type | Format | When |
|------|--------|------|
| Schematics, diagrams, math figures | SVG | Always preferred |
| Screenshots from existing tools | PNG | Lossless |
| Photos | WebP | Smaller than JPEG, modern browsers fine |
| Animations | Use a React visual instead | Avoid GIFs (huge, ugly) |

## Sizes

Keep raster images ≤ 800 KB and ≤ 1600 px wide. Run them through `cwebp -q 80` or `pngquant` before committing.

## Alternatives to images (preferred)

Most of the time, the right answer is not an image:

- For text-shaped diagrams → ASCII inside `<Diagram><CodeBlock variant="plain">...</CodeBlock></Diagram>`
- For schematics → inline SVG (declared right in the JSX)
- For anything the reader should manipulate → an interactive visual under `src/visuals/`

If you find yourself wanting to embed a screenshot of a chart, ask whether you could rebuild the chart in SVG and skip the bitmap.
