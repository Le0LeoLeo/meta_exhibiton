import { cleanup, fireEvent, render as baseRender, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from 'react';
import { I18nProvider, useI18n } from '@/app/components/I18nProvider';

import { RosterImportPanel } from "./RosterImportPanel";

const render = (ui: ReactElement) => baseRender(ui, { wrapper: I18nProvider });
beforeEach(() => localStorage.setItem('metaexpo-locale', 'zh-TW'));
afterEach(() => { cleanup(); localStorage.clear(); });

describe("RosterImportPanel", () => {
  it("reads a CSV, announces the count, previews rows, and imports valid data", async () => {
    const onImport = vi.fn();
    render(<RosterImportPanel onImport={onImport} />);

    const file = new File(
      ["student code,title,filename\nS001,Sunrise,sunrise.jpg"],
      "students.csv",
      { type: "text/csv" },
    );
    fireEvent.change(screen.getByLabelText("CSV 檔案"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/已解析/)).toHaveTextContent("1"));
    expect(screen.getByText("Sunrise")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "匯入 1 筆資料" }));
    expect(onImport).toHaveBeenCalledWith([
      expect.objectContaining({ studentCode: "S001", workTitle: "Sunrise" }),
    ]);
  });

  it("shows structured errors and prevents importing invalid data", () => {
    const onImport = vi.fn();
    render(
      <RosterImportPanel
        spreadsheetRows={[
          ["student code", "title", "filename"],
          ["S001", "", "one.jpg"],
        ]}
        onImport={onImport}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("尚未填寫必填資料：作品名稱。");
    expect(screen.getByRole("alert")).toHaveTextContent("第 2 列");
    expect(screen.getByRole("button", { name: "匯入 0 筆資料" })).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("accepts decoded spreadsheet rows and shows only the first five preview rows", () => {
    const onImport = vi.fn();
    const spreadsheetRows = [
      ["student code", "title", "filename"],
      ...Array.from({ length: 6 }, (_, index) => [
        `S00${index + 1}`,
        `Work ${index + 1}`,
        `work-${index + 1}.jpg`,
      ]),
    ];

    render(<RosterImportPanel spreadsheetRows={spreadsheetRows} onImport={onImport} />);

    expect(screen.getByText("顯示前 5 筆，共 6 筆")).toBeInTheDocument();
    expect(screen.getByText("Work 5")).toBeInTheDocument();
    expect(screen.queryByText("Work 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "匯入 6 筆資料" }));
    expect(onImport).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ studentCode: "S006" }),
    ]));
  });

  it('retranslates validation errors without losing imported records on a language change', () => {
    const onImport = vi.fn();
    const rows = [['student code', 'title', 'filename'], ['S001', 'Sunrise', 'one.jpg'], ['S001', 'Moonlight', 'two.jpg']];
    function LocaleControl() {
      const { setLocale } = useI18n();
      return <><button onClick={() => setLocale('en')}>English</button><button onClick={() => setLocale('zh-CN')}>简体中文</button></>;
    }
    render(<><LocaleControl /><RosterImportPanel spreadsheetRows={rows} onImport={onImport} /></>);
    expect(screen.getByRole('alert')).toHaveTextContent('學生編號與第 2 列重複。');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The student code duplicates row 2. (row 3)');
    expect(screen.getByText('Sunrise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 records' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '简体中文' }));
    expect(screen.getByRole('alert')).toHaveTextContent('学生编号与第 2 行重复。');
    expect(screen.getByText('Moonlight')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入 0 条数据' })).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });
});
