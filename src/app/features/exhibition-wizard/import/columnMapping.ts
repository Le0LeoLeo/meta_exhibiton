import {
  REQUIRED_ROSTER_FIELDS,
  type RosterColumnMappingResult,
  type RosterField,
} from "./importTypes";

const HEADER_ALIASES: Record<RosterField, readonly string[]> = {
  studentCode: [
    "studentcode",
    "studentid",
    "studentnumber",
    "學生代碼",
    "学生代码",
    "學生編號",
    "学生编号",
    "學號",
    "学号",
  ],
  workTitle: [
    "worktitle",
    "artworktitle",
    "title",
    "作品名",
    "作品名稱",
    "作品名称",
    "標題",
    "标题",
  ],
  authorDisplayName: [
    "authordisplayname",
    "author",
    "studentname",
    "作者顯示名",
    "作者显示名",
    "作者",
    "學生姓名",
    "学生姓名",
  ],
  description: [
    "description",
    "artworkdescription",
    "描述",
    "作品描述",
    "作品說明",
    "作品说明",
    "簡介",
    "简介",
  ],
  fileName: [
    "filename",
    "assetfilename",
    "檔名",
    "檔案名",
    "檔案名稱",
    "文件名",
    "文件名稱",
  ],
};

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

function resolveField(header: string): RosterField | undefined {
  const normalized = normalizeHeader(header);
  return (Object.keys(HEADER_ALIASES) as RosterField[]).find((field) =>
    HEADER_ALIASES[field].includes(normalized),
  );
}

export function mapRosterColumns(headers: readonly string[]): RosterColumnMappingResult {
  const mapping: RosterColumnMappingResult["mapping"] = {};
  const errors: RosterColumnMappingResult["errors"] = [];

  headers.forEach((header, index) => {
    const field = resolveField(header);
    if (!field) return;

    if (mapping[field] !== undefined) {
      errors.push({
        code: "DUPLICATE_MAPPED_COLUMN",
        message: `Column ${index + 1} maps to an already mapped field: ${field}.`,
        column: index + 1,
        field,
      });
      return;
    }

    mapping[field] = index;
  });

  for (const field of REQUIRED_ROSTER_FIELDS) {
    if (mapping[field] === undefined) {
      errors.push({
        code: "MISSING_REQUIRED_COLUMN",
        message: `Required column is missing: ${field}.`,
        field,
      });
    }
  }

  return { mapping, errors };
}
