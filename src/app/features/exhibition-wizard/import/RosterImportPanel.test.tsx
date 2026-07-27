import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RosterImportPanel } from "./RosterImportPanel";

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

    expect(screen.getByRole("alert")).toHaveTextContent("MISSING_REQUIRED_VALUE");
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
});
