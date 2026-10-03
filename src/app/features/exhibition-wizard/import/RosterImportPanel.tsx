import { useEffect, useId, useState } from "react";
import { useI18n } from "@/app/components/I18nProvider";

import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { cn } from "@/app/components/ui/utils";

import {
  parseRosterCsv,
  parseRosterTable,
  type ImportedRosterRow,
  type RosterImportResult,
} from "./parseRoster";

const PREVIEW_ROW_LIMIT = 5;

export interface RosterImportPanelProps {
  spreadsheetRows?: readonly (readonly unknown[])[];
  onImport: (rows: ImportedRosterRow[]) => void;
  className?: string;
}

function resultFromSpreadsheetRows(
  spreadsheetRows: RosterImportPanelProps["spreadsheetRows"],
): RosterImportResult | null {
  return spreadsheetRows ? parseRosterTable(spreadsheetRows) : null;
}

export function RosterImportPanel({
  spreadsheetRows,
  onImport,
  className,
}: RosterImportPanelProps) {
  const { t } = useI18n();
  const inputId = useId();
  const helpId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<RosterImportResult | null>(() =>
    resultFromSpreadsheetRows(spreadsheetRows),
  );
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    setFileName(null);
    setReadError(null);
    setResult(resultFromSpreadsheetRows(spreadsheetRows));
  }, [spreadsheetRows]);

  const hasBlockingErrors = Boolean(readError || (result && result.errors.length > 0));
  const canImport = Boolean(result && result.rows.length > 0 && !hasBlockingErrors && !isReading);
  const previewRows = result?.rows.slice(0, PREVIEW_ROW_LIMIT) ?? [];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);
    setReadError(null);
    setIsReading(true);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setReadError("wizardImportReadRetry");
        setIsReading(false);
        return;
      }

      setResult(parseRosterCsv(reader.result));
      setIsReading(false);
    };
    reader.onerror = () => {
      setReadError("wizardImportReadFailed");
      setIsReading(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  return (
    <Card data-slot="roster-import-panel" className={cn("gap-4", className)}>
      <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
        <CardTitle>{t('wizardImportTitle')}</CardTitle>
        <CardDescription id={helpId}>
          {t('wizardImportHelp')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="space-y-2">
          <Label htmlFor={inputId}>{t('wizardImportFile')}</Label>
          <Input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            aria-describedby={helpId}
            onChange={handleFileChange}
            className="h-11 cursor-pointer py-1.5 file:mr-3"
          />
          {fileName ? <p className="text-sm text-muted-foreground">{t('wizardImportSelected', { fileName })}</p> : null}
        </div>

        <div className="min-h-6 text-sm" aria-live="polite" aria-atomic="true">
          {isReading ? <p>{t('wizardImportReading')}</p> : null}
          {!isReading && result ? (
            <p>
              {t(result.errors.length > 0 ? 'wizardImportParsedErrors' : 'wizardImportParsedValid', { count: result.rows.length, errors: result.errors.length })}
            </p>
          ) : null}
        </div>

        {readError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('wizardImportReadTitle')}</AlertTitle>
            <AlertDescription>{t(readError)}</AlertDescription>
          </Alert>
        ) : null}

        {result && result.errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>{t('wizardImportFixTitle')}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {result.errors.map((error, index) => (
                  <li key={`${error.code}-${error.row ?? "none"}-${error.column ?? "none"}-${index}`}>
                    {t(`wizardImportError_${error.code}`, {
                      field: error.field ? t(`wizardImportField_${error.field}`) : '',
                      relatedRow: error.relatedRow ?? '',
                    })}
                    {error.row ? t('wizardImportRow', { row: error.row }) : ''}
                    {error.column ? t('wizardImportColumn', { column: error.column }) : ''}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {previewRows.length > 0 ? (
          <section aria-labelledby={`${inputId}-preview`} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`${inputId}-preview`} className="font-medium">{t('wizardImportPreview')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('wizardImportPreviewCount', { visible: previewRows.length, total: result?.rows.length ?? 0 })}
              </p>
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('wizardImportField_studentCode')}</TableHead>
                    <TableHead>{t('wizardImportField_workTitle')}</TableHead>
                    <TableHead>{t('wizardImportField_authorDisplayName')}</TableHead>
                    <TableHead>{t('wizardImportField_fileName')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow key={`${row.sourceRow}-${row.studentCode}`}>
                      <TableCell>{row.studentCode}</TableCell>
                      <TableCell>{row.workTitle}</TableCell>
                      <TableCell>{row.authorDisplayName || "—"}</TableCell>
                      <TableCell>{row.fileName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </CardContent>

      <CardFooter className="px-4 pb-4 sm:px-6 sm:pb-6">
        <Button
          type="button"
          size="lg"
          className="min-h-11 w-full sm:w-auto"
          disabled={!canImport}
          onClick={() => {
            if (canImport && result) onImport(result.rows);
          }}
        >
          {t('wizardImportSubmit', { count: canImport ? result?.rows.length ?? 0 : 0 })}
        </Button>
      </CardFooter>
    </Card>
  );
}
