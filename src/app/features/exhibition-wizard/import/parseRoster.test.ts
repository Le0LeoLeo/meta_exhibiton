import { describe, expect, it } from "vitest";

import { parseRosterCsv, parseRosterTable } from "./parseRoster";

describe("parseRosterCsv", () => {
  it("parses UTF-8 BOM, Chinese headers, quoted commas, escaped quotes, and newlines", () => {
    const result = parseRosterCsv(
      '\uFEFF學號,作品名稱,作者,作品說明,檔名\r\nS001,"澳門,我的家","陳""小明","第一行\n第二行",photo-1.jpg',
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        studentCode: "S001",
        workTitle: "澳門,我的家",
        authorDisplayName: '陳"小明',
        description: "第一行\n第二行",
        fileName: "photo-1.jpg",
        sourceRow: 2,
      },
    ]);
  });

  it("maps common English headers without case or separator sensitivity", () => {
    const result = parseRosterCsv(
      "Student ID,Artwork_Title,Author Display Name,Description,File Name\nA-01,Sunrise,Ada,Warm colors,sunrise.png",
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      studentCode: "A-01",
      workTitle: "Sunrise",
      authorDisplayName: "Ada",
      description: "Warm colors",
      fileName: "sunrise.png",
    });
  });

  it("reports missing required columns", () => {
    const result = parseRosterCsv("作者,描述\nAda,Study");

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_REQUIRED_COLUMN", field: "studentCode" }),
        expect.objectContaining({ code: "MISSING_REQUIRED_COLUMN", field: "workTitle" }),
        expect.objectContaining({ code: "MISSING_REQUIRED_COLUMN", field: "fileName" }),
      ]),
    );
  });

  it("reports duplicate student codes case-insensitively and internal empty rows", () => {
    const result = parseRosterCsv(
      "student code,title,filename\nS001,First,one.jpg\n,,\ns001,Second,two.jpg\n",
    );

    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EMPTY_ROW", row: 3 }),
        expect.objectContaining({ code: "DUPLICATE_STUDENT_CODE", row: 4, relatedRow: 2 }),
      ]),
    );
  });

  it("reports required values missing from a populated row", () => {
    const result = parseRosterCsv(
      "student code,title,filename\nS001,,one.jpg\n,Second,two.jpg",
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_REQUIRED_VALUE", row: 2, field: "workTitle" }),
        expect.objectContaining({ code: "MISSING_REQUIRED_VALUE", row: 3, field: "studentCode" }),
      ]),
    );
  });

  it("accepts decoded spreadsheet rows through the table parser", () => {
    const result = parseRosterTable([
      ["學生編號", "作品名", "檔案名稱"],
      ["B01", "Clay Study", "clay.pdf"],
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      studentCode: "B01",
      workTitle: "Clay Study",
      fileName: "clay.pdf",
    });
  });
});
