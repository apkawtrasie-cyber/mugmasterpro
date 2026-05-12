"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MugTemplate } from "@/lib/types";
import { BUILT_IN_TEMPLATES } from "@/lib/types";
import {
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  uid,
} from "@/lib/mugStorage";

type Props = {
  activeMugId: string;
  onSelect: (template: MugTemplate) => void;
};

export function TemplatesPanel({ activeMugId, onSelect }: Props) {
  const [customTemplates, setCustomTemplates] = useState<MugTemplate[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomTemplates(getCustomTemplates());
  }, []);

  const all = [...BUILT_IN_TEMPLATES, ...customTemplates];

  const handleAddMug = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const tmpl: MugTemplate = {
        id: uid(),
        name: file.name.replace(/\.[^.]+$/, ""),
        baseUrl: dataUrl,
        isBuiltIn: false,
        thumbnail: dataUrl,
      };
      saveCustomTemplate(tmpl);
      setCustomTemplates(getCustomTemplates());
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteCustomTemplate(id);
      setCustomTemplates(getCustomTemplates());
    },
    []
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Click a mug to switch the base template.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add mug
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAddMug(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {all.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            active={t.id === activeMugId}
            onSelect={onSelect}
            onDelete={t.isBuiltIn ? undefined : (e) => handleDelete(t.id, e)}
          />
        ))}
      </div>
    </div>
  );
}

type CardProps = {
  template: MugTemplate;
  active: boolean;
  onSelect: (t: MugTemplate) => void;
  onDelete?: (e: React.MouseEvent) => void;
};

function TemplateCard({ template, active, onSelect, onDelete }: CardProps) {
  const src = template.thumbnail ?? template.baseUrl;
  return (
    <div
      onClick={() => onSelect(template)}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border bg-card/40 transition-all",
        active
          ? "border-primary shadow-[0_0_0_2px] shadow-primary/40"
          : "border-border hover:border-border/80"
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={template.name}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-secondary text-xs text-muted-foreground">
          Procedural
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <p className="truncate text-[10px] font-medium text-white">{template.name}</p>
      </div>
      {active && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute left-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-red-400 group-hover:flex"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
