"use client";

import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw } from "lucide-react";
import type { MugParams } from "@/hooks/useMugRenderer";
import { DEFAULT_PARAMS } from "@/hooks/useMugRenderer";

type Props = {
  onChange: (patch: Partial<MugParams>) => void;
  onExport: (filename: string) => void;
  exporting: boolean;
  hasArtwork: boolean;
  /** Optional: when supplied, resets sliders to these values (e.g. on project load). */
  externalParams?: MugParams;
};

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: (v: number) => string;
  onChange: (v: number) => void;
};

function SliderRow({ label, value, min, max, step, display, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-xs text-foreground/80">
          {display ? display(value) : value.toFixed(2)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

export function ControlsPanel({ onChange, onExport, exporting, hasArtwork, externalParams }: Props) {
  const [p, setP] = useState<MugParams>({ ...DEFAULT_PARAMS });
  const [filename, setFilename] = useState<string>("mugmaster-mockup");

  useEffect(() => {
    if (externalParams) setP(externalParams);
  }, [externalParams]);

  const update = (patch: Partial<MugParams>) => {
    const next = { ...p, ...patch };
    setP(next);
    onChange(patch);
  };

  const reset = () => {
    setP({ ...DEFAULT_PARAMS });
    onChange({ ...DEFAULT_PARAMS });
  };

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-y-auto p-4">
      <Section title="Position">
        <SliderRow
          label="X"
          value={p.artworkX}
          min={0}
          max={1}
          step={0.001}
          display={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(v) => update({ artworkX: v })}
        />
        <SliderRow
          label="Y"
          value={p.artworkY}
          min={0}
          max={1}
          step={0.001}
          display={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(v) => update({ artworkY: v })}
        />
        <SliderRow
          label="Scale"
          value={p.artworkScale}
          min={0.05}
          max={2}
          step={0.01}
          onChange={(v) => update({ artworkScale: v })}
        />
      </Section>

      <Section title="Transform">
        <SliderRow
          label="Rotate"
          value={p.artworkRotation ?? 0}
          min={-180}
          max={180}
          step={1}
          display={(v) => `${v.toFixed(0)}°`}
          onChange={(v) => update({ artworkRotation: v })}
        />
        <SliderRow
          label="Skew X"
          value={p.artworkSkewX ?? 0}
          min={-45}
          max={45}
          step={0.5}
          display={(v) => `${v.toFixed(1)}°`}
          onChange={(v) => update({ artworkSkewX: v })}
        />
        <SliderRow
          label="Skew Y"
          value={p.artworkSkewY ?? 0}
          min={-45}
          max={45}
          step={0.5}
          display={(v) => `${v.toFixed(1)}°`}
          onChange={(v) => update({ artworkSkewY: v })}
        />
        <SliderRow
          label="Stretch X"
          value={p.artworkScaleX ?? 1}
          min={0.3}
          max={2.5}
          step={0.01}
          display={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => update({ artworkScaleX: v })}
        />
        <SliderRow
          label="Stretch Y"
          value={p.artworkScaleY ?? 1}
          min={0.3}
          max={2.5}
          step={0.01}
          display={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => update({ artworkScaleY: v })}
        />
      </Section>

      <Section title="Wrap">
        <SliderRow
          label="Curvature"
          value={p.displacementScaleX}
          min={0}
          max={100}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ displacementScaleX: v })}
        />
        <SliderRow
          label="Taper"
          value={p.displacementScaleY}
          min={0}
          max={100}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ displacementScaleY: v })}
        />
        <SliderRow
          label="Perspective"
          value={p.wrapTilt ?? 0}
          min={0}
          max={100}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ wrapTilt: v })}
        />
        <SliderRow
          label="Bottom arc"
          value={p.wrapBottomArc ?? 0}
          min={0}
          max={100}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ wrapBottomArc: v })}
        />
        <SliderRow
          label="Edge fade"
          value={p.wrapEdgeFade ?? 0}
          min={0}
          max={100}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ wrapEdgeFade: v })}
        />
        <div className="flex items-center justify-between pt-1">
          <Label className="cursor-pointer">Conform to mug</Label>
          <Switch
            checked={p.conformToMug ?? true}
            onCheckedChange={(v) => update({ conformToMug: v })}
          />
        </div>
      </Section>

      <Section title="Adjustments">
        <SliderRow
          label="Opacity"
          value={p.artworkOpacity ?? 100}
          min={0}
          max={100}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ artworkOpacity: v })}
        />
        <SliderRow
          label="Brightness"
          value={p.artworkBrightness ?? 100}
          min={0}
          max={200}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ artworkBrightness: v })}
        />
        <SliderRow
          label="Contrast"
          value={p.artworkContrast ?? 100}
          min={0}
          max={200}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ artworkContrast: v })}
        />
        <SliderRow
          label="Saturation"
          value={p.artworkSaturation ?? 100}
          min={0}
          max={200}
          step={1}
          display={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => update({ artworkSaturation: v })}
        />
      </Section>

      <Section title="Debug">
        <div className="flex items-center justify-between">
          <Label className="cursor-pointer">Show grid</Label>
          <Switch
            checked={p.showDebugGrid}
            onCheckedChange={(v) => update({ showDebugGrid: v })}
          />
        </div>
      </Section>

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="filename-input">Nazwa pliku</Label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 focus-within:border-foreground/40">
            <input
              id="filename-input"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="mugmaster-mockup"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <span className="font-mono text-xs text-muted-foreground">.png</span>
          </div>
        </div>
        <Button
          onClick={() => onExport(filename)}
          disabled={!hasArtwork || exporting}
          className="w-full"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Rendering 4K…" : "Generate 4K PNG (transparent)"}
        </Button>
        <Button variant="outline" onClick={reset} className="w-full">
          <RotateCcw className="h-4 w-4" />
          Reset parameters
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-3">{children}</div>
    </div>
  );
}
