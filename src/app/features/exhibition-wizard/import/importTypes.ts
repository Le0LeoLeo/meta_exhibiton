export const ROSTER_FIELDS = [
  "studentCode",
  "workTitle",
  "authorDisplayName",
  "description",
  "fileName",
] as const;

export type RosterField = (typeof ROSTER_FIELDS)[number];

export const REQUIRED_ROSTER_FIELDS = ["studentCode", "workTitle", "fileName"] as const;

export type RequiredRosterField = (typeof REQUIRED_ROSTER_FIELDS)[number];

export interface ImportedRosterRow {
  studentCode: string;
  workTitle: string;
  authorDisplayName: string;
  description: string;
  fileName: string;
  sourceRow: number;
}

export type RosterColumnMapping = Partial<Record<RosterField, number>>;

export type RosterImportErrorCode =
  | "EMPTY_INPUT"
  | "MALFORMED_CSV"
  | "MISSING_REQUIRED_COLUMN"
  | "DUPLICATE_MAPPED_COLUMN"
  | "EMPTY_ROW"
  | "MISSING_REQUIRED_VALUE"
  | "DUPLICATE_STUDENT_CODE";

export interface RosterImportError {
  code: RosterImportErrorCode;
  message: string;
  row?: number;
  column?: number;
  field?: RosterField;
  relatedRow?: number;
}

export interface RosterColumnMappingResult {
  mapping: RosterColumnMapping;
  errors: RosterImportError[];
}

export interface RosterImportResult extends RosterColumnMappingResult {
  rows: ImportedRosterRow[];
}
