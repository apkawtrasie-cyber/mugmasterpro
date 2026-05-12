"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SavedProject } from "@/lib/types";
import type { MugParams } from "@/hooks/useMugRenderer";
import { getProjects, upsertProject, deleteProject, uid } from "@/lib/mugStorage";

type Props = {
  /** Data URL of the current artwork (null if no artwork loaded). */
  artworkDataUrl: string | null;
  /** Snapshot function that returns a 256×256 JPEG data URL of the canvas. */
  snapshotFn: () => string | null;
  currentParams: MugParams;
  activeMugTemplateId: string;
  onLoad: (project: SavedProject) => void;
};

export function ProjectsPanel({
  artworkDataUrl,
  snapshotFn,
  currentParams,
  activeMugTemplateId,
  onLoad,
}: Props) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => setProjects(getProjects()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = useCallback(async () => {
    if (!artworkDataUrl) return;
    setSaving(true);
    try {
      const thumbnail = snapshotFn() ?? artworkDataUrl;
      const now = Date.now();
      const project: SavedProject = {
        id: uid(),
        name: `Projekt ${new Date(now).toLocaleDateString("pl-PL", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        createdAt: now,
        updatedAt: now,
        artworkDataUrl,
        params: currentParams,
        mugTemplateId: activeMugTemplateId,
        thumbnailDataUrl: thumbnail,
      };
      upsertProject(project);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [artworkDataUrl, snapshotFn, currentParams, activeMugTemplateId, refresh]);

  const handleDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteProject(id);
      refresh();
    },
    [refresh]
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <Button
        className="w-full gap-2"
        disabled={!artworkDataUrl || saving}
        onClick={handleSave}
      >
        <Save className="h-4 w-4" />
        {saving ? "Zapisywanie…" : "Zapisz projekt"}
      </Button>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
          <FolderOpen className="h-8 w-8 opacity-40" />
          <span>Brak zapisanych projektów</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onLoad={onLoad}
              onDelete={(e) => handleDelete(p.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CardProps = {
  project: SavedProject;
  onLoad: (p: SavedProject) => void;
  onDelete: (e: React.MouseEvent) => void;
};

function ProjectCard({ project, onLoad, onDelete }: CardProps) {
  const date = new Date(project.createdAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  return (
    <div
      onClick={() => onLoad(project)}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card/40 transition-colors hover:border-primary/50"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={project.thumbnailDataUrl}
        alt={project.name}
        className="aspect-square w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-1.5">
        <p className="truncate text-[10px] font-semibold text-white">{project.name}</p>
        <p className="text-[9px] text-white/60">{date}</p>
      </div>
      <button
        onClick={onDelete}
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-red-400 group-hover:flex"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
