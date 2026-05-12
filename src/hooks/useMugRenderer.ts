"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SCENE_W,
  SCENE_H,
  MESH_NX,
  MESH_NY,
  MESH_BASE,
  rebuildMeshGeometry,
  loadOrFallback,
  makeMugBaseCanvas,
  makeDisplacementCanvas,
  makeAlphaMaskCanvas,
  makeShadowsCanvas,
  makeHighlightsCanvas,
  makeEdgeFadeCanvas,
  makeGridCanvas,
} from "@/lib/pixi-utils";

/**
 * useMugRenderer
 * --------------
 * PixiJS-based renderer that composes a photoreal mug mockup:
 *   1. Mug base photo (Sprite)
 *   2. User artwork — SimplePlane mesh, vertices deformed into a wrapped
 *      cylinder/cone surface (see `rebuildMeshGeometry`).
 *   3. Shadows overlay (MULTIPLY) — darkens artwork in shadowed mug regions.
 *   4. Highlights overlay (SCREEN) — adds white specular shine on top of
 *      the artwork so it reads as glossy ceramic, not a matte sticker.
 *
 * All canvas generators + maths helpers live in `lib/pixi-utils.ts`.
 */

export type MugParams = {
  artworkX: number;       // 0..1 (relative to scene width)
  artworkY: number;       // 0..1
  artworkScale: number;   // uniform master scale  (0.05 .. 2)
  /** Independent horizontal stretch (default 1). */
  artworkScaleX?: number;
  /** Independent vertical stretch (default 1). */
  artworkScaleY?: number;
  /** In-plane rotation in degrees (-180 .. 180). */
  artworkRotation?: number;
  /** Horizontal skew in degrees (-45 .. 45) — "tilt". */
  artworkSkewX?: number;
  /** Vertical skew in degrees (-45 .. 45). */
  artworkSkewY?: number;
  displacementScaleX: number; // wrap curvature (0..100)
  displacementScaleY: number; // conical taper (0..100)
  /** Perspective tilt (0..100) → 0..30°. Curves top + bottom edges. */
  wrapTilt?: number;
  /** Additional curve concentrated on the BOTTOM edge (0..100). */
  wrapBottomArc?: number;
  /** Soft horizontal fade on left/right artwork edges — simulates wrapping behind the mug (0..100). */
  wrapEdgeFade?: number;
  /** Soft-conform the artwork to the printable mug surface (feathered mask). */
  conformToMug?: boolean;
  /** Artwork opacity (0..100, default 100). */
  artworkOpacity?: number;
  /** Brightness (0..200, default 100 = neutral). */
  artworkBrightness?: number;
  /** Contrast (0..200, default 100 = neutral). */
  artworkContrast?: number;
  /** Saturation (0..200, default 100 = neutral). */
  artworkSaturation?: number;
  showDebugGrid: boolean;
};

export const DEFAULT_PARAMS: MugParams = {
  artworkX: 0.46,
  artworkY: 0.52,
  artworkScale: 0.48,
  artworkScaleX: 1,
  artworkScaleY: 1,
  artworkRotation: 0,
  artworkSkewX: 0,
  artworkSkewY: 0,
  displacementScaleX: 60,
  displacementScaleY: 22,
  wrapTilt: 35,
  wrapBottomArc: 30,
  wrapEdgeFade: 35,
  conformToMug: false,
  artworkOpacity: 100,
  artworkBrightness: 100,
  artworkContrast: 100,
  artworkSaturation: 100,
  showDebugGrid: false,
};

// Scene constants live in lib/pixi-utils.ts and are imported above.
// (Kept the local re-binding to avoid touching every reference below.)
void MESH_NX; void MESH_NY;

type RendererRefs = {
  pixi: typeof import("pixi.js");
  app: import("pixi.js").Application;
  root: import("pixi.js").Container;
  baseSprite: import("pixi.js").Sprite;
  artworkContainer: import("pixi.js").Container;
  artworkMesh: import("pixi.js").SimplePlane;
  /** Mutable holder so applyParams can read the latest texture aspect ratio. */
  artworkAspect: { value: number };
  colorFilter: import("pixi.js").ColorMatrixFilter;
  maskSprite: import("pixi.js").Sprite;
  overlaySprite: import("pixi.js").Sprite;     // shadows (MULTIPLY)
  highlightSprite: import("pixi.js").Sprite;   // specular highlights (SCREEN)
  /** Per-mesh horizontal fade mask — hides left/right wrap edges. */
  edgeFadeMask: import("pixi.js").Sprite;
  /** Cached fade value so we only regenerate the gradient texture on change. */
  edgeFadeCache: { value: number };
  gridSprite: import("pixi.js").Sprite;
};

export function useMugRenderer(
  containerRef: React.RefObject<HTMLDivElement>,
  onPositionChange?: (artworkX: number, artworkY: number) => void
) {
  const [ready, setReady] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);
  const refs = useRef<RendererRefs | null>(null);
  const paramsRef = useRef<MugParams>({ ...DEFAULT_PARAMS });
  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => { onPositionChangeRef.current = onPositionChange; }, [onPositionChange]);

  // ---------------- Initialise PIXI ----------------
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const PIXI = await import("pixi.js");
      if (disposed || !containerRef.current) return;

      const app = new PIXI.Application({
        width: SCENE_W,
        height: SCENE_H,
        antialias: true,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      const view = app.view as HTMLCanvasElement;
      view.style.width = "100%";
      view.style.height = "100%";
      view.style.display = "block";
      containerRef.current.appendChild(view);

      // Build textures — prefer /mug.png (user asset), then /assets/*, and
      // finally the procedural fallback so the app always renders something.
      const baseTex      = await loadOrFallback("/mug.png",                       makeMugBaseCanvas,      PIXI);
      const dispTex      = await loadOrFallback("/assets/mug_displacement.png",  makeDisplacementCanvas, PIXI);
      const maskTex      = await loadOrFallback("/assets/mug_alpha.png",         makeAlphaMaskCanvas,    PIXI);
      const overlayTex   = await loadOrFallback("/assets/mug_shadows.png",       makeShadowsCanvas,      PIXI);
      const highlightTex = await loadOrFallback("/assets/mug_highlights.png",    makeHighlightsCanvas,   PIXI);
      const gridTex      = PIXI.Texture.from(makeGridCanvas());

      // Scene root
      const root = new PIXI.Container();
      app.stage.addChild(root);

      // 1) Base mug photo
      const baseSprite = new PIXI.Sprite(baseTex);
      baseSprite.width = SCENE_W;
      baseSprite.height = SCENE_H;
      root.addChild(baseSprite);

      // 2) Artwork container (clipped by alpha mask)
      const artworkContainer = new PIXI.Container();
      root.addChild(artworkContainer);

      // ---- Artwork as a SimplePlane mesh ----
      // The mesh has (MESH_NX+1) × (MESH_NY+1) vertices arranged in a grid.
      // We deform those vertices into a cylindrical / conical surface so the
      // artwork is *geometrically* wrapped, not just pixel-shifted.
      const artworkMesh = new PIXI.SimplePlane(
        PIXI.Texture.WHITE,
        MESH_NX + 1,
        MESH_NY + 1
      );
      artworkMesh.alpha = 0; // hidden until artwork is loaded
      artworkContainer.addChild(artworkMesh);

      // Color-matrix filter for brightness / contrast / saturation adjustments.
      const colorFilter = new PIXI.ColorMatrixFilter();
      artworkMesh.filters = [colorFilter];

      // Optional debug grid (on top of artwork inside the masked area)
      const gridSprite = new PIXI.Sprite(gridTex);
      gridSprite.width = SCENE_W;
      gridSprite.height = SCENE_H;
      gridSprite.alpha = 0;
      artworkContainer.addChild(gridSprite);

      // Suppress unused-var warning — dispTex is no longer needed but loadOrFallback
      // still runs (kept for asset-swap parity).  Reference it so TS stays happy.
      void dispTex;

      const artworkAspect = { value: 1 };

      // 3) Soft-conform mask: built once, applied/cleared via applyParams
      const maskSprite = new PIXI.Sprite(maskTex);
      maskSprite.width = SCENE_W;
      maskSprite.height = SCENE_H;
      // Mask sprites in PixiJS v7 read the texture directly — NEVER add to display tree.

      // 4a) Shadows overlay — MULTIPLY blend darkens the artwork where the
      //     mug surface would naturally be shaded (left side, top rim, bottom).
      //     The mug photo already has baked-in lighting, so these overlays are
      //     hidden until the user loads artwork (toggled in applyParams).
      const overlaySprite = new PIXI.Sprite(overlayTex);
      overlaySprite.width = SCENE_W;
      overlaySprite.height = SCENE_H;
      overlaySprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
      overlaySprite.alpha = 0;
      overlaySprite.visible = false;
      root.addChild(overlaySprite);

      // 4b) Highlights overlay — SCREEN blend adds white specular reflections.
      //     Kept very subtle and only shown when artwork is present.
      const highlightSprite = new PIXI.Sprite(highlightTex);
      highlightSprite.width = SCENE_W;
      highlightSprite.height = SCENE_H;
      highlightSprite.blendMode = PIXI.BLEND_MODES.SCREEN;
      highlightSprite.alpha = 0;
      highlightSprite.visible = false;
      root.addChild(highlightSprite);

      // 5) Edge fade mask — horizontal alpha gradient applied to the mesh so
      //    its left + right edges fade out, simulating wrap-behind on a cylinder.
      const edgeFadeMask = new PIXI.Sprite(
        PIXI.Texture.from(makeEdgeFadeCanvas(0.35))
      );
      edgeFadeMask.anchor.set(0.5);
      edgeFadeMask.renderable = false; // used as mask, never directly rendered
      root.addChild(edgeFadeMask);
      const edgeFadeCache = { value: 0.35 };

      refs.current = {
        pixi: PIXI,
        app,
        root,
        baseSprite,
        artworkContainer,
        artworkMesh,
        artworkAspect,
        colorFilter,
        maskSprite,
        overlaySprite,
        highlightSprite,
        edgeFadeMask,
        edgeFadeCache,
        gridSprite,
      };

      applyParams(paramsRef.current);
      setReady(true);

      // -------- Pointer-drag to reposition artwork --------
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let spriteStartX = 0;
      let spriteStartY = 0;

      const toScene = (e: PointerEvent): [number, number] => {
        const rect = view.getBoundingClientRect();
        return [
          ((e.clientX - rect.left) / rect.width) * SCENE_W,
          ((e.clientY - rect.top) / rect.height) * SCENE_H,
        ];
      };

      const onDown = (e: PointerEvent) => {
        const r = refs.current;
        if (!r || r.artworkMesh.alpha === 0) return;
        const [px, py] = toScene(e);
        const bounds = r.artworkMesh.getBounds();
        const pad = 20;
        if (px >= bounds.x - pad && px <= bounds.x + bounds.width + pad &&
            py >= bounds.y - pad && py <= bounds.y + bounds.height + pad) {
          isDragging = true;
          dragStartX = px;
          dragStartY = py;
          spriteStartX = r.artworkMesh.x;
          spriteStartY = r.artworkMesh.y;
          view.setPointerCapture(e.pointerId);
          view.style.cursor = "grabbing";
          e.preventDefault();
        }
      };

      const onMove = (e: PointerEvent) => {
        const r = refs.current;
        if (!r) return;
        if (isDragging) {
          const [px, py] = toScene(e);
          r.artworkMesh.x = spriteStartX + (px - dragStartX);
          r.artworkMesh.y = spriteStartY + (py - dragStartY);
          paramsRef.current.artworkX = r.artworkMesh.x / SCENE_W;
          paramsRef.current.artworkY = r.artworkMesh.y / SCENE_H;
        } else if (r.artworkMesh.alpha > 0) {
          const [px, py] = toScene(e);
          const b = r.artworkMesh.getBounds();
          const over = px >= b.x - 10 && px <= b.x + b.width + 10 &&
                       py >= b.y - 10 && py <= b.y + b.height + 10;
          view.style.cursor = over ? "grab" : "default";
        }
      };

      const onUp = (e: PointerEvent) => {
        if (isDragging) {
          isDragging = false;
          view.style.cursor = "grab";
          view.releasePointerCapture(e.pointerId);
          if (refs.current) {
            const ax = refs.current.artworkMesh.x / SCENE_W;
            const ay = refs.current.artworkMesh.y / SCENE_H;
            onPositionChangeRef.current?.(ax, ay);
          }
        }
      };

      view.addEventListener("pointerdown", onDown);
      view.addEventListener("pointermove", onMove);
      view.addEventListener("pointerup", onUp);
      view.addEventListener("pointercancel", onUp);

      // Resize handling
      const ro = new ResizeObserver(() => {});
      if (containerRef.current) ro.observe(containerRef.current);

      cleanup = () => {
        view.removeEventListener("pointerdown", onDown);
        view.removeEventListener("pointermove", onMove);
        view.removeEventListener("pointerup", onUp);
        view.removeEventListener("pointercancel", onUp);
        ro.disconnect();
        app.destroy(true, { children: true, texture: true, baseTexture: true });
        refs.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [containerRef]);

  // ---------------- Apply params ----------------
  const applyParams = useCallback((p: MugParams) => {
    paramsRef.current = p;
    const r = refs.current;
    if (!r) return;
    const {
      pixi: PIXI,
      artworkMesh, artworkAspect, artworkContainer,
      maskSprite, gridSprite, colorFilter,
      overlaySprite, highlightSprite,
      edgeFadeMask, edgeFadeCache,
    } = r;

    const DEG = Math.PI / 180;
    const sX = p.artworkScaleX ?? 1;
    const sY = p.artworkScaleY ?? 1;
    const rot = (p.artworkRotation ?? 0) * DEG;
    const skX = (p.artworkSkewX ?? 0) * DEG;
    const skY = (p.artworkSkewY ?? 0) * DEG;

    // Position (centre of mesh)
    artworkMesh.position.set(p.artworkX * SCENE_W, p.artworkY * SCENE_H);

    // Scale: master scale × per-axis stretch × texture aspect ratio (for X)
    const sizeY = MESH_BASE * p.artworkScale * sY;
    const sizeX = MESH_BASE * p.artworkScale * sX * artworkAspect.value;
    artworkMesh.scale.set(sizeX, sizeY);

    // In-plane rotation + skew
    artworkMesh.rotation = rot;
    artworkMesh.skew.set(skX, skY);

    // Wrap geometry (cylinder + taper + perspective tilt + bottom arc)
    const curve01     = Math.max(0, Math.min(1, Math.abs(p.displacementScaleX) / 100));
    const taper01     = Math.max(0, Math.min(1, p.displacementScaleY / 100));
    const tilt01      = Math.max(0, Math.min(1, (p.wrapTilt ?? 0) / 100));
    const bottomArc01 = Math.max(0, Math.min(1, (p.wrapBottomArc ?? 0) / 100));
    rebuildMeshGeometry(artworkMesh, curve01, taper01, tilt01, bottomArc01);

    // Soft-conform mask on the container (clips artwork to the mug surface)
    artworkContainer.mask = (p.conformToMug ?? true) ? maskSprite : null;

    // Edge fade mask on the MESH itself — left/right edges become transparent
    // so the artwork visually wraps behind the cylinder.
    const edgeFade01 = Math.max(0, Math.min(1, (p.wrapEdgeFade ?? 0) / 100));
    if (edgeFade01 > 0.005) {
      if (Math.abs(edgeFadeCache.value - edgeFade01) > 0.005) {
        edgeFadeMask.texture = PIXI.Texture.from(makeEdgeFadeCanvas(edgeFade01));
        edgeFadeCache.value = edgeFade01;
      }
      // Match the mesh transform so the fade gradient aligns with the artwork.
      // Add padding for vertices that get pushed outside the mesh's own bounds
      // by the perspective tilt / bottom arc deformations.
      edgeFadeMask.width  = sizeX * 1.05;
      edgeFadeMask.height = sizeY * 1.5;
      edgeFadeMask.position.copyFrom(artworkMesh.position);
      edgeFadeMask.rotation = artworkMesh.rotation;
      edgeFadeMask.skew.copyFrom(artworkMesh.skew);
      artworkMesh.mask = edgeFadeMask;
    } else {
      artworkMesh.mask = null;
    }

    // Opacity (only applied once artwork has been loaded — alpha=0 means "no artwork yet")
    if (hasArtwork) {
      artworkMesh.alpha = (p.artworkOpacity ?? 100) / 100;
    }

    // Shadow / highlight overlays only kick in once an artwork is loaded so the
    // bare ceramic photo stays clean. Intensities are tied to artwork opacity.
    const opacity01 = (p.artworkOpacity ?? 100) / 100;
    overlaySprite.visible   = hasArtwork && opacity01 > 0.01;
    highlightSprite.visible = hasArtwork && opacity01 > 0.01;
    overlaySprite.alpha   = hasArtwork ? 0.30 * opacity01 : 0;
    highlightSprite.alpha = hasArtwork ? 0.10 * opacity01 : 0;

    // Colour adjustments: brightness / contrast / saturation
    const brightness = (p.artworkBrightness ?? 100) / 100; // 1 = neutral
    const contrast   = (p.artworkContrast   ?? 100) / 100 - 1; // 0 = neutral (range -1..1)
    const saturation = (p.artworkSaturation ?? 100) / 100 - 1; // 0 = neutral (range -1..1)
    colorFilter.reset();
    if (brightness !== 1) colorFilter.brightness(brightness, true);
    if (contrast   !== 0) colorFilter.contrast(contrast, true);
    if (saturation !== 0) colorFilter.saturate(saturation, true);

    gridSprite.alpha = p.showDebugGrid ? 0.85 : 0;
  }, [hasArtwork]);

  const setParams = useCallback(
    (patch: Partial<MugParams>) => {
      const next = { ...paramsRef.current, ...patch };
      applyParams(next);
    },
    [applyParams]
  );

  // ---------------- Load user artwork ----------------
  const loadArtwork = useCallback(async (file: File) => {
    const r = refs.current;
    if (!r) return;
    const { pixi: PIXI, artworkMesh, artworkAspect } = r;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load artwork"));
        img.src = url;
      });
      const tex = PIXI.Texture.from(img);
      artworkMesh.texture = tex;
      artworkAspect.value = img.naturalWidth / Math.max(1, img.naturalHeight);
      artworkMesh.alpha = 1;
      applyParams(paramsRef.current);
      setHasArtwork(true);
    } catch (err) {
      console.error("[MugMaster] artwork load error", err);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }, [applyParams]);

  // ---------------- Export 4K PNG ----------------
  const export4K = useCallback(async (filename?: string) => {
    const r = refs.current;
    if (!r) return;
    const { pixi: PIXI, app, root, gridSprite } = r;

    // Hide the debug grid for export regardless of UI state.
    const gridAlpha = gridSprite.alpha;
    gridSprite.alpha = 0;

    const TARGET = 4096;
    const rt = PIXI.RenderTexture.create({ width: TARGET, height: TARGET, resolution: 1 });
    const transform = new PIXI.Matrix();
    transform.scale(TARGET / SCENE_W, TARGET / SCENE_H);

    app.renderer.render(root, { renderTexture: rt, transform, clear: true });
    const canvas = app.renderer.extract.canvas(rt) as HTMLCanvasElement;

    gridSprite.alpha = gridAlpha;

    const blob: Blob | null = await new Promise((resolve) => {
      if ((canvas as HTMLCanvasElement).toBlob) {
        (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), "image/png");
      } else {
        resolve(null);
      }
    });

    rt.destroy(true);

    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (filename ?? "").trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\.png$/i, "");
    a.download = safe ? `${safe}.png` : `mugmaster-${Date.now()}-4k.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  // ---------------- Load a new mug base from a URL or data URL ----------------
  const loadMugBase = useCallback(async (url: string) => {
    const r = refs.current;
    if (!r) return;
    const { pixi: PIXI, baseSprite } = r;
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
        img.crossOrigin = "anonymous";
        img.src = url;
      });
      const tex = PIXI.Texture.from(img);
      baseSprite.texture = tex;
      baseSprite.width = SCENE_W;
      baseSprite.height = SCENE_H;
    } catch {
      console.warn("[MugMaster] could not load mug base:", url);
    }
  }, []);

  // ---------------- Capture a thumbnail of the current render ----------------
  const captureSnapshot = useCallback((thumbPx = 256): string | null => {
    const r = refs.current;
    if (!r) return null;
    const { app, root } = r;
    try {
      const raw = app.renderer.extract.canvas(root) as HTMLCanvasElement;
      const c = document.createElement("canvas");
      c.width = thumbPx;
      c.height = thumbPx;
      c.getContext("2d")!.drawImage(raw, 0, 0, thumbPx, thumbPx);
      return c.toDataURL("image/jpeg", 0.82);
    } catch {
      return null;
    }
  }, []);

  return { ready, hasArtwork, setParams, loadArtwork, loadMugBase, captureSnapshot, export4K, defaults: DEFAULT_PARAMS };
}
