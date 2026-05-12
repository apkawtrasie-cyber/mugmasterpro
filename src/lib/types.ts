import type { MugParams } from "@/hooks/useMugRenderer";

export type MugTemplate = {
  id: string;
  name: string;
  /** URL path (for built-ins) or base64 data URL (for custom uploads). */
  baseUrl: string;
  isBuiltIn: boolean;
  /** Small thumbnail data URL (built-ins derive from baseUrl). */
  thumbnail?: string;
};

export type SavedArtwork = {
  id: string;
  name: string;
  /** Resized data URL (max ~1024 px wide). PNG when source has alpha,
   *  JPEG otherwise — keeps localStorage compact while preserving transparency. */
  dataUrl: string;
  createdAt: number;
};

export type SavedProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Artwork stored as a downscaled JPEG data URL (max 1024 px wide). */
  artworkDataUrl: string;
  params: MugParams;
  mugTemplateId: string;
  /** 256×256 JPEG snapshot of the canvas for the project card thumbnail. */
  thumbnailDataUrl: string;
};

/** Built-in templates shipped with the app. */
export const BUILT_IN_TEMPLATES: MugTemplate[] = [
  {
    id: "mug-user",
    name: "White Mug",
    baseUrl: "/mug.png",
    isBuiltIn: true,
  },
  {
    id: "mug-procedural",
    name: "Classic (Vector)",
    baseUrl: "",
    isBuiltIn: true,
  },
];
