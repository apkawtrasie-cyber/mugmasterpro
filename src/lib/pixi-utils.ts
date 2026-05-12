/**
 * pixi-utils.ts
 * --------------
 * Pure helpers used by the renderer:
 *   1.  Canvas generators for the procedural mug layers
 *       (base / displacement / mask / shadows / highlights / grid).
 *   2.  Texture loader with procedural fallback.
 *   3.  SimplePlane vertex deformer (cylindrical + conical + perspective).
 *
 * Keeping these in their own module shrinks `useMugRenderer` significantly
 * and makes the renderer hook easier to reason about.
 */

// ─── Scene constants (shared with the renderer hook) ──────────────────────────
export const SCENE_W = 1024;
export const SCENE_H = 1024;
export const MESH_NX = 28;
export const MESH_NY = 20;
export const MESH_BASE = 720;

// ─── Mesh deformer (cylindrical + conical + perspective) ──────────────────────

/**
 * Deform a SimplePlane's vertex buffer into a wrapped mug surface.
 *
 *   curve01      0 = flat, 1 = full half-circle (π rad arc)
 *   taper01      0 = pure cylinder, 1 = strongly conical
 *   tilt01       0 = no perspective, 1 = strong (up to 30°) — curves top/bottom
 *   bottomArc01  0 = uniform, 1 = extra +45° concentrated on the bottom edge
 *
 * Vertices are emitted in normalised local space (±0.5) so the mesh's scale
 * and position transforms control the final on-screen size.
 */
export function rebuildMeshGeometry(
  mesh: import("pixi.js").SimplePlane,
  curve01: number,
  taper01: number,
  tilt01: number = 0,
  bottomArc01: number = 0
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = (mesh.geometry as any).getBuffer("aVertexPosition");
  const verts = buffer.data as Float32Array;

  const arc = Math.max(0.001, curve01 * Math.PI);
  const halfArc = arc / 2;
  const norm = 2 * Math.sin(halfArc);

  const baseTiltRad  = tilt01      * (Math.PI / 6);   // up to 30°
  const bottomArcRad = bottomArc01 * (Math.PI / 4);   // up to 45° extra at bottom
  const cosTilt = Math.cos(baseTiltRad);
  const DEPTH = 0.32;

  for (let j = 0; j <= MESH_NY; j++) {
    for (let i = 0; i <= MESH_NX; i++) {
      const idx = (j * (MESH_NX + 1) + i) * 2;
      const nx = i / MESH_NX;
      const ny = j / MESH_NY;

      const angle = (nx - 0.5) * arc;
      const xCyl  = Math.sin(angle) / norm;
      // Quadratic taper — bottom narrows faster (rounder mug bases).
      const taperFactor = 1 - taper01 * 0.4 * ny * ny;

      // ny-interpolated tilt: top uses baseTilt, bottom adds bottomArc smoothly.
      const localSinTilt = Math.sin(baseTiltRad + bottomArcRad * ny);

      const yBase  = (ny - 0.5) * cosTilt;
      const yDepth = DEPTH * Math.cos(angle) * localSinTilt;

      verts[idx]     = xCyl * taperFactor;
      verts[idx + 1] = yBase + yDepth;
    }
  }
  buffer.update();
}

// ─── Texture loader with procedural fallback ──────────────────────────────────
export async function loadOrFallback(
  url: string,
  fallback: () => HTMLCanvasElement,
  PIXI: typeof import("pixi.js")
): Promise<import("pixi.js").Texture> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("missing asset"));
      img.src = url;
    });
    return PIXI.Texture.from(img);
  } catch {
    return PIXI.Texture.from(fallback());
  }
}

// ─── Low-level canvas helpers ─────────────────────────────────────────────────
function makeCanvas(
  w = SCENE_W,
  h = SCENE_H
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─── Procedural layer generators ──────────────────────────────────────────────

/** Procedural mug base (ceramic body + rim + handle). Used only when /mug.png is missing. */
export function makeMugBaseCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas();
  const bodyGrad = ctx.createLinearGradient(0, 0, SCENE_W, 0);
  bodyGrad.addColorStop(0, "#cdd2d6");
  bodyGrad.addColorStop(0.5, "#ffffff");
  bodyGrad.addColorStop(1, "#b8bec3");
  ctx.fillStyle = bodyGrad;
  const bx = SCENE_W * 0.18;
  const by = SCENE_H * 0.2;
  const bw = SCENE_W * 0.64;
  const bh = SCENE_H * 0.6;
  roundRect(ctx, bx, by, bw, bh, 28);
  ctx.fill();
  ctx.fillStyle = "#9aa0a6";
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by, bw / 2, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f2226";
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by, bw / 2 - 14, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#cdd2d6";
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.arc(bx + bw + 10, by + bh * 0.45, 80, -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();
  return c;
}

/**
 * Sinusoidal cylindrical displacement map (RG-encoded).
 * Retained for asset-swap parity with the legacy DisplacementFilter pipeline.
 */
export function makeDisplacementCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas();
  const px0 = SCENE_W * 0.15;
  const py0 = SCENE_H * 0.18;
  const px1 = SCENE_W * 0.78;
  const py1 = SCENE_H * 0.88;

  const imageData = ctx.createImageData(SCENE_W, SCENE_H);
  const d = imageData.data;

  for (let y = 0; y < SCENE_H; y++) {
    const t = (y - py0) / (py1 - py0);
    const leftX  = px0 + (SCENE_W * 0.02) * t;
    const rightX = px1 - (SCENE_W * 0.06) * t;

    for (let x = 0; x < SCENE_W; x++) {
      const idx = (y * SCENE_W + x) * 4;
      let rVal = 128, gVal = 128;

      if (y >= py0 && y <= py1 && x >= leftX && x <= rightX) {
        const nx = (x - leftX) / (rightX - leftX);
        const ny = (y - py0) / (py1 - py0);
        rVal = 128 + 127 * Math.sin((nx - 0.5) * Math.PI);
        gVal = 128 + 12 * (ny - 0.5);
      }

      d[idx]     = Math.round(Math.max(0, Math.min(255, rVal)));
      d[idx + 1] = Math.round(Math.max(0, Math.min(255, gVal)));
      d[idx + 2] = 128;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return c;
}

/**
 * Heavily blurred trapezoid alpha mask matching the conical mug surface.
 * Soft falloff so artwork edges fade rather than hard-clip.
 */
export function makeAlphaMaskCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);

  ctx.filter = "blur(4px)";
  ctx.fillStyle = "#fff";

  const topLeft   = SCENE_W * 0.13;
  const topRight  = SCENE_W * 0.77;
  const topY      = SCENE_H * 0.18;
  const botLeft   = SCENE_W * 0.17;
  const botRight  = SCENE_W * 0.72;
  const botY      = SCENE_H * 0.88;

  ctx.beginPath();
  ctx.moveTo(topLeft,  topY);
  ctx.lineTo(topRight, topY);
  ctx.lineTo(botRight, botY);
  ctx.lineTo(botLeft,  botY);
  ctx.closePath();
  ctx.fill();
  ctx.filter = "none";
  return c;
}

/**
 * Shadow overlay — used with `MULTIPLY` blend.
 * Only dark gradients here; highlights live in a separate canvas (SCREEN blend).
 */
export function makeShadowsCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas();
  // Left-side shade (mug body shadowed away from the light)
  const left = ctx.createLinearGradient(SCENE_W * 0.18, 0, SCENE_W * 0.5, 0);
  left.addColorStop(0, "rgba(0,0,0,0.42)");
  left.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  // Top rim shadow band (the curved lip casts a soft shadow downward)
  const top = ctx.createLinearGradient(0, SCENE_H * 0.2, 0, SCENE_H * 0.27);
  top.addColorStop(0, "rgba(0,0,0,0.55)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  // Bottom curvature shade (slight darkening near the base)
  const bot = ctx.createLinearGradient(0, SCENE_H * 0.78, 0, SCENE_H * 0.88);
  bot.addColorStop(0, "rgba(0,0,0,0)");
  bot.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  return c;
}

/**
 * Highlight overlay — used with `SCREEN` blend.
 * Very subtle white specular reflections (overlay alpha is also kept low).
 */
export function makeHighlightsCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas();
  // Right-side specular band — gentle
  const right = ctx.createLinearGradient(SCENE_W * 0.60, 0, SCENE_W * 0.80, 0);
  right.addColorStop(0, "rgba(255,255,255,0)");
  right.addColorStop(1, "rgba(255,255,255,0.20)");
  ctx.fillStyle = right;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  return c;
}

/**
 * Horizontal alpha gradient used as a soft mask on the artwork mesh — fades
 * the left and right edges so the artwork visually "wraps behind" the mug.
 *
 *   fade01 = 0  → no fade (fully opaque from edge to edge)
 *   fade01 = 1  → maximum fade (entire texture is a smooth gradient)
 */
export function makeEdgeFadeCanvas(fade01: number): HTMLCanvasElement {
  const w = 512, h = 32;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const stop1 = Math.max(0.001, Math.min(0.49, fade01 * 0.5));
  const stop2 = 1 - stop1;

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0,     "rgba(255,255,255,0)");
  grad.addColorStop(stop1, "rgba(255,255,255,1)");
  grad.addColorStop(stop2, "rgba(255,255,255,1)");
  grad.addColorStop(1,     "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Debug grid overlay (transparent background). */
export function makeGridCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas();
  ctx.strokeStyle = "rgba(0, 200, 255, 0.9)";
  ctx.lineWidth = 1.5;
  const step = 40;
  for (let x = 0; x <= SCENE_W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SCENE_H);
    ctx.stroke();
  }
  for (let y = 0; y <= SCENE_H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCENE_W, y);
    ctx.stroke();
  }
  return c;
}
