import { useEffect, useId, useState } from "react";

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
        setReadError("無法讀取此 CSV 檔案，請重新選擇檔案。");
        setIsReading(false);
        return;
      }

      setResult(parseRosterCsv(reader.result));
      setIsReading(false);
    };
    reader.onerror = () => {
      setReadError("無法讀取此 CSV 檔案，請檢查檔案後再試。");
      setIsReading(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  return (
    <Card data-slot="roster-import-panel" className={cn("gap-4", className)}>
      <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
        <CardTitle>匯入學生作品資料</CardTitle>
        <CardDescription id={helpId}>
          選擇 UTF-8 CSV；Excel 資料可由上層解碼後傳入。必填欄位為學生編號、作品名稱和檔案名稱。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="space-y-2">
          <Label htmlFor={inputId}>CSV 檔案</Label>
          <Input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            aria-describedby={helpId}
            onChange={handleFileChange}
            className="h-11 cursor-pointer py-1.5 file:mr-3"
          />
          {fileName ? <p className="text-sm text-muted-foreground">已選擇：{fileName}</p> : null}
        </div>

        <div className="min-h-6 text-sm" aria-live="polite" aria-atomic="true">
          {isReading ? <p>正在讀取檔案…</p> : null}
          {!isReading && result ? (
            <p>
              已解析 <strong>{result.rows.length}</strong> 筆可預覽資料
              {result.errors.length > 0 ? `，發現 ${result.errors.length} 項錯誤` : "，資料格式正確"}。
            </p>
          ) : null}
        </div>

        {readError ? (
          <Alert variant="destructive">
            <AlertTitle>檔案讀取失敗</AlertTitle>
            <AlertDescription>{readError}</AlertDescription>
          </Alert>
        ) : null}

        {result && result.errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>請修正匯入資料</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {result.errors.map((error, index) => (
                  <li key={`${error.code}-${error.row ?? "none"}-${error.column ?? "none"}-${index}`}>
                    <span className="font-medium">{error.code}</span>
                    {error.row ? `（第 ${error.row} 列）` : ""}
                    {error.column ? `（第 ${error.column} 欄）` : ""}
                    {error.field ? `［${error.field}］` : ""}：{error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {previewRows.length > 0 ? (
          <section aria-labelledby={`${inputId}-preview`} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`${inputId}-preview`} className="font-medium">資料預覽</h3>
              <p className="text-sm text-muted-foreground">
                顯示前 {previewRows.length} 筆，共 {result?.rows.length ?? 0} 筆
              </p>
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>學生編號</TableHead>
                    <TableHead>作品名稱</TableHead>
                    <TableHead>作者</TableHead>
                    <TableHead>檔案名稱</TableHead>
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
          匯入 {canImport ? result?.rows.length : 0} 筆資料
        </Button>
      </CardFooter>
    </Card>
  );
}
