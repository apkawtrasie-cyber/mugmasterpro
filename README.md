# MugMaster Pro

Photoreal mug mockup studio built with **Next.js 14 (App Router)**, **PixiJS 7 (WebGL)**, **Tailwind + shadcn/ui**, deployed as an offline-capable **PWA** (`next-pwa`).

The renderer composes four layers per frame:

1. **Mug base** — your photo of a ceramic mug.
2. **User artwork** — distorted in real time by `PIXI.DisplacementFilter` driven by a height-map (the *displacement map*).
3. **Alpha mask** — clips the artwork to the printable region of the mug.
4. **Overlay** — shadows + highlights drawn over the artwork so specular reflections "go on top of" your logo.

Because PixiJS pushes everything to the GPU, dragging the artwork, scaling it and tweaking displacement strength stays at 60 fps even with very large source images.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The app ships with a procedural fallback set of textures so it works out of the box. To get a *truly* photoreal result, drop your own four 1024×1024 PNGs into `public/assets/`:

| File | Purpose |
|---|---|
| `mug_base.png` | Photo of the bare mug. |
| `mug_displacement.png` | Greyscale height-map. `#808080` = no displacement, lighter pushes right, darker pulls left. Same convention vertically. |
| `mug_alpha.png` | White = printable surface, black = ignore. |
| `mug_shadows.png` | Shadows + highlights on transparent background, drawn on top of the artwork. |

## Project layout

```
src/
├── app/
│   ├── layout.tsx       # PWA metadata, manifest, dark theme
│   ├── page.tsx         # 3-column "Pro Tools" workspace
│   └── globals.css      # Tailwind + theme tokens
├── components/
│   ├── MugCanvas.tsx    # WebGL viewport host
│   ├── ControlsPanel.tsx# Sliders, switch, export button
│   ├── DropZone.tsx     # Drag & drop artwork uploader
│   └── ui/              # shadcn primitives (button, slider, switch, label)
├── hooks/
│   └── useMugRenderer.ts# PixiJS scene + filters + 4K export
└── lib/utils.ts
```

## Controls

- **Position X / Y / Scale** — move and size the artwork on the mug.
- **Displacement X / Y** — strength of the lensing effect along each axis.
- **Show grid** — overlays a debug grid that is deformed by the same displacement filter, so you can see the curvature the engine is applying.
- **Generate 4K PNG** — re-renders the scene into a 4096×4096 transparent PNG and downloads it.

## How the renderer works

```
Stage
└── root (Container)
    ├── baseSprite        (mug photo)
    ├── artworkContainer  ← filters: [DisplacementFilter(displacementSprite)]
    │   ├── userArtwork
    │   └── debugGrid
    ├── maskSprite        ← used as artworkContainer.mask
    ├── displacementSprite (renderable=false, only feeds the filter)
    └── overlaySprite     (shadows + highlights)
```

`useMugRenderer` lazily imports `pixi.js` inside `useEffect` so SSR stays clean. Parameter updates mutate the live PixiJS scene directly via refs — React never re-renders the canvas tree, which is what keeps the 60 fps even with rapid slider input.

## PWA

`next-pwa` is wired in `next.config.js`; service worker and Workbox bundles land in `public/` on `next build`. The app is installable from the browser address bar and works offline once cached.

## License

MIT.
