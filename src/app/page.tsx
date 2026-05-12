"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee, ImageIcon, Package, FolderOpen } from "lucide-react";
import { useMugRenderer, DEFAULT_PARAMS } from "@/hooks/useMugRenderer";
import type { MugParams } from "@/hooks/useMugRenderer";
import { MugCanvas, type CanvasBg } from "@/components/MugCanvas";
import { ControlsPanel } from "@/components/ControlsPanel";
import { DropZone } from "@/components/DropZone";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { ArtworkLibrary } from "@/components/ArtworkLibrary";
import { cn } from "@/lib/utils";
import type { MugTemplate, SavedProject, SavedArtwork } from "@/lib/types";
import { BUILT_IN_TEMPLATES } from "@/lib/types";
import {
  resizeToDataUrl,
  uid,
  getArtworks,
  saveArtwork,
  deleteArtwork,
} from "@/lib/mugStorage";

type Tab = "artwork" | "mugs" | "projects";

export default function HomePage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    ready,
    hasArtwork,
    setParams,
    loadArtwork,
    loadMugBase,
    captureSnapshot,
    export4K,
  } = useMugRenderer(canvasRef, (artworkX, artworkY) => {
    // Sync sliders after the user drags artwork on the canvas
    setCurrentParams((prev) => ({ ...prev, artworkX, artworkY }));
  });

  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<Tab>("artwork");
  const [canvasBg, setCanvasBg] = useState<CanvasBg>("grey");
  const [activeMugTemplate, setActiveMugTemplate] = useState<MugTemplate>(BUILT_IN_TEMPLATES[0]);
  const [artworkDataUrl, setArtworkDataUrl] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<MugParams>({ ...DEFAULT_PARAMS });
  const [savedArtworks, setSavedArtworks] = useState<SavedArtwork[]>([]);

  // Hydrate the artwork library from localStorage on first render
  useEffect(() => {
    setSavedArtworks(getArtworks());
  }, []);

  const handleExport = async (filename: string) => {
    setExporting(true);
    try {
      await export4K(filename);
    } finally {
      setExporting(false);
    }
  };

  const handleArtworkFile = useCallback(
    async (file: File) => {
      await loadArtwork(file);

      // Reset adjustment sliders to neutral defaults so settings from a
      // previously-loaded artwork don't bleed into the new one.
      const adjustmentReset: Partial<MugParams> = {
        artworkOpacity:    DEFAULT_PARAMS.artworkOpacity,
        artworkBrightness: DEFAULT_PARAMS.artworkBrightness,
        artworkContrast:   DEFAULT_PARAMS.artworkContrast,
        artworkSaturation: DEFAULT_PARAMS.artworkSaturation,
      };
      setCurrentParams((prev) => ({ ...prev, ...adjustmentReset }));
      setParams(adjustmentReset);

      // Downscale and persist to the artwork library + remember for project saving.
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const dataUrl = resizeToDataUrl(img, 1024, 0.88);
        setArtworkDataUrl(dataUrl);
        URL.revokeObjectURL(img.src);
        // Auto-save into the library (de-duped by dataUrl in storage layer).
        saveArtwork({
          id: uid(),
          name: file.name.replace(/\.[^.]+$/, "") || "artwork",
          dataUrl,
          createdAt: Date.now(),
        });
        setSavedArtworks(getArtworks());
      };
    },
    [loadArtwork, setParams]
  );

  const handleLoadSavedArtwork = useCallback(
    async (artwork: SavedArtwork) => {
      const res = await fetch(artwork.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${artwork.name}.jpg`, { type: blob.type });
      await handleArtworkFile(file);
    },
    [handleArtworkFile]
  );

  const handleDeleteSavedArtwork = useCallback((id: string) => {
    deleteArtwork(id);
    setSavedArtworks(getArtworks());
  }, []);

  const handleTemplateSelect = useCallback(
    async (tmpl: MugTemplate) => {
      setActiveMugTemplate(tmpl);
      if (tmpl.baseUrl) {
        await loadMugBase(tmpl.baseUrl);
      } else {
        // Procedural template — reset to built-in procedural mug
        await loadMugBase("/mug.png");
      }
    },
    [loadMugBase]
  );

  const handleParamsChange = useCallback(
    (patch: Partial<MugParams>) => {
      const next = { ...currentParams, ...patch };
      setCurrentParams(next);
      setParams(patch);
    },
    [currentParams, setParams]
  );

  const handleProjectLoad = useCallback(
    async (project: SavedProject) => {
      // Restore artwork
      const img = new Image();
      img.src = project.artworkDataUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      // Build a File-like from the data URL via a Blob
      const res = await fetch(project.artworkDataUrl);
      const blob = await res.blob();
      const file = new File([blob], "project_artwork.jpg", { type: blob.type });
      await handleArtworkFile(file);

      // Restore mug template
      const allTemplates = [...BUILT_IN_TEMPLATES];
      const tmpl = allTemplates.find((t) => t.id === project.mugTemplateId) ?? BUILT_IN_TEMPLATES[0];
      await handleTemplateSelect(tmpl);

      // Restore params — merge with defaults so older saves get sensible
      // values for newer fields (rotation, skew, scaleX/Y, etc.)
      const merged = { ...DEFAULT_PARAMS, ...project.params };
      setCurrentParams(merged);
      setParams(merged);
      setTab("artwork");
    },
    [handleArtworkFile, handleTemplateSelect, setParams]
  );

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "artwork", label: "Grafika", icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { id: "mugs", label: "Kubki", icon: <Package className="h-3.5 w-3.5" /> },
    { id: "projects", label: "Projekty", icon: <FolderOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/40 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Coffee className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">MugMaster Pro</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              PixiJS · WebGL · 4K
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              ready ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {ready ? "Renderer gotowy" : "Ładowanie…"}
        </div>
      </header>

      {/* Workspace */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/30 md:flex">
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[11px] font-medium transition-colors",
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab === "artwork" && (
              <div className="flex flex-col gap-4 p-4">
                <p className="text-xs text-muted-foreground">
                  Wgraj PNG/JPG/SVG. Przezroczyste tło pozwala przeświecać ceramice kubka.
                </p>
                <DropZone hasArtwork={hasArtwork} onFile={handleArtworkFile} />
                <ArtworkLibrary
                  items={savedArtworks}
                  onSelect={handleLoadSavedArtwork}
                  onDelete={handleDeleteSavedArtwork}
                />
              </div>
            )}

            {tab === "mugs" && (
              <TemplatesPanel
                activeMugId={activeMugTemplate.id}
                onSelect={handleTemplateSelect}
              />
            )}

            {tab === "projects" && (
              <ProjectsPanel
                artworkDataUrl={artworkDataUrl}
                snapshotFn={captureSnapshot}
                currentParams={currentParams}
                activeMugTemplateId={activeMugTemplate.id}
                onLoad={handleProjectLoad}
              />
            )}
          </div>
        </aside>

        {/* Center: viewport */}
        <section className="flex flex-1 overflow-hidden">
          <MugCanvas
            ref={canvasRef}
            ready={ready}
            bgColor={canvasBg}
            onBgChange={setCanvasBg}
          />
        </section>

        {/* Right: parameter panel */}
        <aside className="hidden w-80 shrink-0 border-l border-border bg-card/30 lg:block">
          <ControlsPanel
            onChange={handleParamsChange}
            onExport={handleExport}
            exporting={exporting}
            hasArtwork={hasArtwork}
            externalParams={currentParams}
          />
        </aside>
      </main>
    </div>
  );
}
