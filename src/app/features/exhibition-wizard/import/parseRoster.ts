import { mapRosterColumns } from "./columnMapping";
import {
  REQUIRED_ROSTER_FIELDS,
  ROSTER_FIELDS,
  type ImportedRosterRow,
  type RosterColumnMapping,
  type RosterImportError,
  type RosterImportResult,
} from "./importTypes";

interface ParsedCsv {
  table: string[][];
  sourceRows: number[];
  errors: RosterImportError[];
}

function parseCsvTable(input: string): ParsedCsv {
  const table: string[][] = [];
  const sourceRows: number[] = [];
  const errors: RosterImportError[] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;

  const finishRecord = () => {
    record.push(field);
    table.push(record);
    sourceRows.push(recordStartLine);
    record = [];
    field = "";
    recordStartLine = line + 1;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
        if (character === "\n") line += 1;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      finishRecord();
      line += 1;
      recordStartLine = line;
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (inQuotes) {
    errors.push({
      code: "MALFORMED_CSV",
      message: `Unclosed quoted field starting on row ${recordStartLine}.`,
      row: recordStartLine,
    });
  }

  if (record.length > 0 || field.length > 0 || !input.endsWith("\n")) {
    finishRecord();
  }

  return { table, sourceRows, errors };
}

function valueAt(row: readonly unknown[], mapping: RosterColumnMapping, field: keyof ImportedRosterRow) {
  if (field === "sourceRow") return "";
  const column = mapping[field];
  return column === undefined ? "" : String(row[column] ?? "").trim();
}

function parseTable(
  table: readonly (readonly unknown[])[],
  sourceRows: readonly number[],
  initialErrors: readonly RosterImportError[] = [],
): RosterImportResult {
  if (table.length === 0 || table[0].every((value) => String(value ?? "").trim() === "")) {
    return {
      rows: [],
      mapping: {},
      errors: [
        ...initialErrors,
        { code: "EMPTY_INPUT", message: "The roster does not contain a header row." },
      ],
    };
  }

  const header = table[0].map((value) => String(value ?? ""));
  const columnResult = mapRosterColumns(header);
  const errors = [...initialErrors, ...columnResult.errors];

  if (columnResult.errors.some((error) => error.code === "MISSING_REQUIRED_COLUMN")) {
    return { rows: [], mapping: columnResult.mapping, errors };
  }

  const rows: ImportedRosterRow[] = [];
  const firstRowByStudentCode = new Map<string, number>();

  table.slice(1).forEach((source, index) => {
    const rowNumber = sourceRows[index + 1] ?? index + 2;
    if (source.every((value) => String(value ?? "").trim() === "")) {
      errors.push({ code: "EMPTY_ROW", message: `Row ${rowNumber} is empty.`, row: rowNumber });
      return;
    }

    const row: ImportedRosterRow = {
      studentCode: valueAt(source, columnResult.mapping, "studentCode"),
      workTitle: valueAt(source, columnResult.mapping, "workTitle"),
      authorDisplayName: valueAt(source, columnResult.mapping, "authorDisplayName"),
      description: valueAt(source, columnResult.mapping, "description"),
      fileName: valueAt(source, columnResult.mapping, "fileName"),
      sourceRow: rowNumber,
    };

    const missingFields = REQUIRED_ROSTER_FIELDS.filter((field) => row[field] === "");
    for (const field of missingFields) {
      errors.push({
        code: "MISSING_REQUIRED_VALUE",
        message: `Row ${rowNumber} is missing a value for ${field}.`,
        row: rowNumber,
        field,
      });
    }
    if (missingFields.length > 0) return;

    const normalizedStudentCode = row.studentCode.toLocaleLowerCase();
    const firstRow = firstRowByStudentCode.get(normalizedStudentCode);
    if (firstRow !== undefined) {
      errors.push({
        code: "DUPLICATE_STUDENT_CODE",
        message: `Student code ${row.studentCode} duplicates row ${firstRow}.`,
        row: rowNumber,
        field: "studentCode",
        relatedRow: firstRow,
      });
    } else {
      firstRowByStudentCode.set(normalizedStudentCode, rowNumber);
    }

    rows.push(row);
  });

  return { rows, mapping: columnResult.mapping, errors };
}

export function parseRosterCsv(input: string): RosterImportResult {
  const parsed = parseCsvTable(input.replace(/^\uFEFF/, ""));
  return parseTable(parsed.table, parsed.sourceRows, parsed.errors);
}

export function parseRosterTable(table: readonly (readonly unknown[])[]): RosterImportResult {
  return parseTable(
    table,
    table.map((_, index) => index + 1),
  );
}

export type { ImportedRosterRow, RosterImportError, RosterImportResult } from "./importTypes";
export { ROSTER_FIELDS };
