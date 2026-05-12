"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type CanvasBg = "white" | "grey" | "black" | "checker";

type Props = {
  ready: boolean;
  bgColor: CanvasBg;
  onBgChange: (bg: CanvasBg) => void;
};

const BG_STYLES: Record<CanvasBg, React.CSSProperties> = {
  white: { background: "#ffffff" },
  grey:  { background: "#d8dce0" },
  black: { background: "#141414" },
  checker: {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(45deg, #c8ccd0 25%, transparent 25%)," +
      "linear-gradient(-45deg, #c8ccd0 25%, transparent 25%)," +
      "linear-gradient(45deg, transparent 75%, #c8ccd0 75%)," +
      "linear-gradient(-45deg, transparent 75%, #c8ccd0 75%)",
    backgroundSize: "24px 24px",
    backgroundPosition: "0 0, 0 12px, 12px -12px, 12px 0px",
  },
};

const BG_SWATCHES: { id: CanvasBg; label: string; preview: React.CSSProperties }[] = [
  { id: "white",   label: "White",  preview: { background: "#ffffff" } },
  { id: "grey",    label: "Grey",   preview: { background: "#d8dce0" } },
  { id: "black",   label: "Black",  preview: { background: "#141414" } },
  {
    id: "checker", label: "Transparent",
    preview: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(45deg, #b8bcc0 25%, transparent 25%)," +
        "linear-gradient(-45deg, #b8bcc0 25%, transparent 25%)," +
        "linear-gradient(45deg, transparent 75%, #b8bcc0 75%)," +
        "linear-gradient(-45deg, transparent 75%, #b8bcc0 75%)",
      backgroundSize: "8px 8px",
      backgroundPosition: "0 0, 0 4px, 4px -4px, 4px 0px",
    },
  },
];

export const MugCanvas = forwardRef<HTMLDivElement, Props>(function MugCanvas(
  { ready, bgColor, onBgChange },
  ref
) {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      {/* Subtle grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(220 13% 60%) 1px, transparent 1px), linear-gradient(to bottom, hsl(220 13% 60%) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Canvas viewport */}
      <div className="relative aspect-square w-full max-h-full max-w-[min(80vh,900px)]">
        <div
          ref={ref}
          className="absolute inset-0 overflow-hidden rounded-xl border border-border/40 shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
          style={BG_STYLES[bgColor]}
        />

        {/* Background picker (top-right overlay) */}
        <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md border border-border bg-card/80 p-1 backdrop-blur">
          {BG_SWATCHES.map((s) => (
            <button
              key={s.id}
              title={s.label}
              onClick={() => onBgChange(s.id)}
              className={cn(
                "h-6 w-6 rounded border transition-all",
                bgColor === s.id
                  ? "border-primary ring-2 ring-primary/50"
                  : "border-border/60 hover:border-border"
              )}
              style={s.preview}
            />
          ))}
        </div>

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Initialising WebGL renderer…
          </div>
        )}
      </div>
    </div>
  );
});
