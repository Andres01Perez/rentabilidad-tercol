import * as React from "react";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dropzone } from "@/components/excel/Dropzone";
import { SheetAndHeaderPicker } from "@/components/excel/SheetAndHeaderPicker";
import { ColumnMapper, type MapField } from "@/components/excel/ColumnMapper";
import {
  parseExcelSheets,
  parseExcelWithMapping,
  suggestHeader,
  suggestHeaderRow,
  type SheetPreview,
  type ParsedExcelResult,
} from "@/lib/excel";
import { cn } from "@/lib/utils";

export interface WizardField<TKey extends string> extends MapField<TKey> {
  /** Header name aliases used to auto-suggest the column. */
  suggestedAliases?: readonly string[];
}

interface Props<TKey extends string> {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: WizardField<TKey>[];
  numericKeys?: TKey[];
  /** Called when user confirms; returns true to close the dialog. */
  onConfirm: (rows: Record<TKey, string | number | null>[]) => Promise<boolean | void>;
  /** Label of the final submit button (e.g., "Crear lista", "Reemplazar"). */
  submitLabel: string;
  /** Optional element rendered above the dropzone in step 1 (e.g., name input). */
  extraStep1?: React.ReactNode;
  /** Whether step 1 is allowed to advance (e.g., requires name). */
  step1Valid?: boolean;
  /** Optional key to drop rows whose value is 0 (e.g., precio = 0). */
  zeroDropKey?: TKey;
}

type Step = "file" | "map" | "preview";

export function ImportWizardDialog<TKey extends string>({
  open,
  onClose,
  title,
  description,
  fields,
  numericKeys,
  onConfirm,
  submitLabel,
  extraStep1,
  step1Valid = true,
  zeroDropKey,
}: Props<TKey>) {
  const [step, setStep] = React.useState<Step>("file");
  const [file, setFile] = React.useState<File | null>(null);
  const [sheets, setSheets] = React.useState<SheetPreview[] | null>(null);
  const [loadingSheets, setLoadingSheets] = React.useState(false);
  const [picker, setPicker] = React.useState<{ sheet: string; headerRow: number } | null>(null);
  const [mapping, setMapping] = React.useState<Partial<Record<TKey, string | null>>>({});
  const [preview, setPreview] = React.useState<ParsedExcelResult<TKey> | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [dropZero, setDropZero] = React.useState(true);

  const reset = React.useCallback(() => {
    setStep("file");
    setFile(null);
    setSheets(null);
    setPicker(null);
    setMapping({});
    setPreview(null);
    setParsing(false);
    setSubmitting(false);
    setDropZero(true);
  }, []);

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  // Load sheets when file is set
  React.useEffect(() => {
    if (!file) {
      setSheets(null);
      setPicker(null);
      return;
    }
    setLoadingSheets(true);
    parseExcelSheets(file)
      .then((sh) => {
        setSheets(sh);
        // Pick the sheet with the most data rows as default
        const best = sh.reduce((a, b) => (b.rowCount > a.rowCount ? b : a), sh[0]);
        const headerRow = suggestHeaderRow(best.rows);
        setPicker({ sheet: best.name, headerRow });
      })
      .catch((e: Error) => {
        toast.error(e.message);
        setFile(null);
      })
      .finally(() => setLoadingSheets(false));
  }, [file]);

  // Auto-suggest mapping when picker changes
  React.useEffect(() => {
    if (!sheets || !picker) return;
    const sheet = sheets.find((s) => s.name === picker.sheet);
    if (!sheet) return;
    const headerRow = sheet.rows[picker.headerRow] ?? [];
    const headers = headerRow.map((h) => (h == null ? "" : String(h).trim()));
    const next: Partial<Record<TKey, string | null>> = {};
    fields.forEach((f) => {
      next[f.key] = suggestHeader(headers, f.suggestedAliases ?? []);
    });
    setMapping(next);
  }, [sheets, picker, fields]);

  // Re-parse preview when entering step 3
  React.useEffect(() => {
    if (step !== "preview" || !file || !picker) return;
    setParsing(true);
    parseExcelWithMapping<TKey>(file, {
      sheetName: picker.sheet,
      headerRowIndex: picker.headerRow,
      mapping,
      requiredKeys: fields.filter((f) => f.required).map((f) => f.key),
      numericKeys,
      dropZeroForKey: dropZero ? zeroDropKey : undefined,
    })
      .then((res) => setPreview(res))
      .catch((e: Error) => {
        toast.error(e.message);
        setStep("map");
      })
      .finally(() => setParsing(false));
  }, [step, file, picker, mapping, fields, numericKeys, dropZero, zeroDropKey]);

  const currentSheet = sheets && picker ? sheets.find((s) => s.name === picker.sheet) : null;
  const headersForMapper = React.useMemo(() => {
    if (!currentSheet || !picker) return [];
    const row = currentSheet.rows[picker.headerRow] ?? [];
    return row.map((c) => (c == null ? "" : String(c).trim()));
  }, [currentSheet, picker]);

  const sampleRowsForMapper = React.useMemo(() => {
    if (!currentSheet || !picker) return [];
    return currentSheet.rows.slice(picker.headerRow + 1, picker.headerRow + 6);
  }, [currentSheet, picker]);

  const requiredOk = fields.every(
    (f) => !f.required || (mapping[f.key] && mapping[f.key] !== ""),
  );

  const handleSubmit = async () => {
    if (!preview || preview.rows.length === 0) return;
    setSubmitting(true);
    try {
      const shouldClose = await onConfirm(preview.rows);
      if (shouldClose !== false) {
        reset();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {step === "file" && (
            <div className="space-y-4">
              {extraStep1}
              <Dropzone file={file} onFile={setFile} />
              {loadingSheets && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Leyendo archivo…
                </p>
              )}
            </div>
          )}

          {step === "map" && sheets && picker && (
            <div className="space-y-6">
              <SheetAndHeaderPicker sheets={sheets} value={picker} onChange={setPicker} />
              <div className="border-t border-border/60 pt-4">
                <ColumnMapper
                  headers={headersForMapper}
                  sampleRows={sampleRowsForMapper}
                  fields={fields}
                  value={mapping}
                  onChange={setMapping}
                />
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              {parsing ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
                </p>
              ) : preview ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-white/60 p-3 backdrop-blur">
                    <div className="text-sm">
                      <strong className="text-foreground">{preview.rows.length}</strong>{" "}
                      <span className="text-muted-foreground">filas válidas</span>
                      {preview.skippedRows > 0 && (
                        <>
                          {" · "}
                          <span className="text-muted-foreground">
                            {preview.skippedRows} descartadas
                          </span>
                        </>
                      )}
                    </div>
                    {zeroDropKey && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="drop-zero"
                          checked={dropZero}
                          onCheckedChange={setDropZero}
                        />
                        <Label htmlFor="drop-zero" className="text-xs">
                          Descartar filas con precio = 0
                        </Label>
                      </div>
                    )}
                  </div>

                  {preview.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground">⚠ {w}</p>
                  ))}

                  <PreviewTable fields={fields} rows={preview.rows.slice(0, 10)} />
                </>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:space-x-0">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {step !== "file" && (
              <Button
                variant="outline"
                onClick={() => setStep(step === "preview" ? "map" : "file")}
                disabled={submitting}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
            )}
            {step === "file" && (
              <Button
                onClick={() => setStep("map")}
                disabled={!file || !sheets || !picker || !step1Valid || loadingSheets}
                className="bg-gradient-brand text-white"
              >
                Siguiente <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === "map" && (
              <Button
                onClick={() => setStep("preview")}
                disabled={!requiredOk}
                className="bg-gradient-brand text-white"
              >
                Siguiente <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleSubmit}
                disabled={!preview || preview.rows.length === 0 || submitting}
                className="bg-gradient-brand text-white"
              >
                {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "file", label: "1. Archivo" },
    { key: "map", label: "2. Mapear columnas" },
    { key: "preview", label: "3. Vista previa" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-medium transition-colors",
              i === idx
                ? "bg-gradient-brand text-white"
                : i < idx
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
    </div>
  );
}

function PreviewTable<TKey extends string>({
  fields,
  rows,
}: {
  fields: MapField<TKey>[];
  rows: Record<TKey, string | number | null>[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-white/60 backdrop-blur">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr>
            {fields.map((f) => (
              <th key={f.key} className="px-2 py-2 text-left font-medium text-muted-foreground">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {fields.map((f) => (
                <td key={f.key} className="max-w-[200px] truncate px-2 py-1.5">
                  {r[f.key] == null
                    ? "—"
                    : typeof r[f.key] === "number"
                      ? new Intl.NumberFormat("es-CO").format(r[f.key] as number)
                      : String(r[f.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}