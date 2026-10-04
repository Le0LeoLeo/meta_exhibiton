import { describe, expect, it } from "vitest";

import { mapRosterColumns } from "./columnMapping";

describe("mapRosterColumns", () => {
  it("maps traditional and simplified Chinese aliases", () => {
    expect(
      mapRosterColumns(["學生代碼", "作品名", "作者顯示名", "描述", "檔名"]).mapping,
    ).toEqual({
      studentCode: 0,
      workTitle: 1,
      authorDisplayName: 2,
      description: 3,
      fileName: 4,
    });

    expect(
      mapRosterColumns(["学生编号", "作品名称", "作者显示名", "作品说明", "文件名"]).mapping,
    ).toEqual({
      studentCode: 0,
      workTitle: 1,
      authorDisplayName: 2,
      description: 3,
      fileName: 4,
    });
  });

  it("reports duplicate columns that resolve to the same field", () => {
    const result = mapRosterColumns(["Student ID", "學號", "Title", "Filename"]);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATE_MAPPED_COLUMN",
        field: "studentCode",
        column: 2,
      }),
    );
  });
});
