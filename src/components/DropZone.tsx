"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onFile: (file: File) => void;
  hasArtwork: boolean;
};

export function DropZone({ onFile, hasArtwork }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files[0]) return;
      const f = files[0];
      if (!f.type.startsWith("image/")) return;
      onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-4 text-center transition-colors hover:border-primary/60 hover:bg-card",
        drag && "border-primary bg-primary/10"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
        {hasArtwork ? <ImageIcon className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
      </div>
      <div className="text-sm font-medium">
        {hasArtwork ? "Replace artwork" : "Drop artwork or click to upload"}
      </div>
      <div className="text-xs text-muted-foreground">PNG · JPG · SVG up to ~20 MB</div>
    </div>
  );
}
