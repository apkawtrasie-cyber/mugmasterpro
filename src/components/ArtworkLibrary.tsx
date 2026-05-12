"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedArtwork } from "@/lib/types";

type Props = {
  items: SavedArtwork[];
  onSelect: (artwork: SavedArtwork) => void;
  onDelete: (id: string) => void;
};

export function ArtworkLibrary({ items, onSelect, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-4 text-center text-[11px] text-muted-foreground">
        Twoja biblioteka grafik pojawi się tutaj po wgraniu pierwszego pliku.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Moja biblioteka
        </h3>
        <span className="text-[10px] text-muted-foreground/70">{items.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((a) => (
          <ArtworkCard
            key={a.id}
            artwork={a}
            onSelect={() => onSelect(a)}
            onDelete={(e) => {
              e.stopPropagation();
              onDelete(a.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ArtworkCard({
  artwork,
  onSelect,
  onDelete,
}: {
  artwork: SavedArtwork;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-md border border-border bg-card/40",
        "transition-colors hover:border-primary/60"
      )}
      title={artwork.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artwork.dataUrl}
        alt={artwork.name}
        className="aspect-square w-full object-cover"
      />
      <button
        onClick={onDelete}
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/65 text-red-400 group-hover:flex"
        title="Usuń"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
