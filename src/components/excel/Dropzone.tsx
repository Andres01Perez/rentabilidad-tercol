import * as React from "react";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  hint?: string;
}

export function Dropzone({ file, onFile, accept = ".xlsx,.xls", hint }: DropzoneProps) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/60 p-4 backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand-soft">
          <FileSpreadsheet className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button
          type="button"
          onClick={() => onFile(null)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Quitar archivo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        over
          ? "border-foreground/40 bg-gradient-brand-soft"
          : "border-border/60 bg-white/40 hover:border-foreground/30 hover:bg-white/60",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand-soft">
        <UploadCloud className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium">Arrastra el archivo o haz click</p>
      <p className="text-xs text-muted-foreground">{hint ?? "Excel (.xlsx, .xls)"}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}