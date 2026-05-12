import type { SavedProject, MugTemplate, SavedArtwork } from "@/lib/types";

const PROJECTS_KEY  = "mugmaster_projects";
const TEMPLATES_KEY = "mugmaster_custom_templates";
const ARTWORKS_KEY  = "mugmaster_artworks";
const MAX_ARTWORKS  = 30;

// ─── Artwork library ───────────────────────────────────────────────────────────

export function getArtworks(): SavedArtwork[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ARTWORKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Save (or move to top) an artwork in the library. De-dupes by dataUrl so
 * re-loading from the library never creates a duplicate row.
 */
export function saveArtwork(artwork: SavedArtwork): void {
  if (typeof window === "undefined") return;
  let all = getArtworks().filter((a) => a.dataUrl !== artwork.dataUrl);
  all.unshift(artwork);
  if (all.length > MAX_ARTWORKS) all = all.slice(0, MAX_ARTWORKS);
  try {
    localStorage.setItem(ARTWORKS_KEY, JSON.stringify(all));
  } catch (e) {
    // Quota exceeded — drop the oldest half and retry once.
    console.warn("[mugStorage] localStorage quota hit, trimming", e);
    all = all.slice(0, Math.floor(MAX_ARTWORKS / 2));
    try { localStorage.setItem(ARTWORKS_KEY, JSON.stringify(all)); } catch { /* give up */ }
  }
}

export function deleteArtwork(id: string): void {
  if (typeof window === "undefined") return;
  const all = getArtworks().filter((a) => a.id !== id);
  localStorage.setItem(ARTWORKS_KEY, JSON.stringify(all));
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export function getProjects(): SavedProject[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveProjects(projects: SavedProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function upsertProject(project: SavedProject): void {
  const all = getProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    all[idx] = project;
  } else {
    all.unshift(project);
  }
  saveProjects(all);
}

export function deleteProject(id: string): void {
  saveProjects(getProjects().filter((p) => p.id !== id));
}

// ─── Custom Templates ──────────────────────────────────────────────────────────

export function getCustomTemplates(): MugTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: MugTemplate): void {
  const all = getCustomTemplates();
  const idx = all.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    all[idx] = template;
  } else {
    all.unshift(template);
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all));
}

export function deleteCustomTemplate(id: string): void {
  const all = getCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(all));
}

// ─── Image helpers ─────────────────────────────────────────────────────────────

/**
 * Resize an HTMLImageElement to at most `maxPx` on its longest side and return
 * a data URL.
 *
 *   • If the source has any transparent pixel (PNG / SVG / WebP-alpha) → PNG
 *     so the alpha channel is preserved when the user re-loads from the library.
 *   • Otherwise → JPEG (smaller payload in localStorage).
 */
export function resizeToDataUrl(
  img: HTMLImageElement,
  maxPx = 1024,
  quality = 0.85
): string {
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  // Detect transparency in a sparse sample (cheap — every Nth pixel).
  let hasAlpha = false;
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    const step = Math.max(4, Math.floor(data.length / 4 / 4096)) * 4; // ~4k samples
    for (let i = 3; i < data.length; i += step) {
      if (data[i] < 255) { hasAlpha = true; break; }
    }
  } catch {
    // Cross-origin/tainted canvas — assume alpha to be safe.
    hasAlpha = true;
  }

  return hasAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", quality);
}

/**
 * Scale a render canvas down to `thumbPx` × `thumbPx` JPEG.
 */
export function canvasToThumb(canvas: HTMLCanvasElement, thumbPx = 256): string {
  const c = document.createElement("canvas");
  c.width = thumbPx;
  c.height = thumbPx;
  c.getContext("2d")!.drawImage(canvas, 0, 0, thumbPx, thumbPx);
  return c.toDataURL("image/jpeg", 0.82);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
