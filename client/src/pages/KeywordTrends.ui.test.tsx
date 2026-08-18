// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KeywordTrends from "./KeywordTrends";

const { useQuery, mutate, refetch } = vi.hoisted(() => ({ useQuery: vi.fn(), mutate: vi.fn(), refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    keywords: {
      overview: { useQuery },
      import: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));

vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Area: Stub, AreaChart: Stub, Bar: Stub, BarChart: Stub, CartesianGrid: Stub, ResponsiveContainer: Stub, Tooltip: Stub, XAxis: Stub, YAxis: Stub };
});

function emptyQuery() {
  return {
    data: { meta: { rowCount: 0, filename: null, importedAt: null, latestDate: null, source: null }, totals: { clicks: 0, impressions: 0, ctr: 0, position: null }, trend: [], topKeywords: [], options: { countries: [], devices: [], pages: [], sources: [] } },
    isLoading: false,
    error: null,
    refetch,
  };
}

describe("KeywordTrends UI", () => {
  beforeEach(() => { useQuery.mockReset().mockImplementation(emptyQuery); mutate.mockReset(); refetch.mockReset(); });

  it("renders an explicit empty state instead of invented metrics", () => {
    render(<KeywordTrends />);
    expect(screen.getByText("Import a verified keyword export to begin")).toBeInTheDocument();
    expect(screen.getByText("The charts remain empty until you provide real CSV or JSON rows.")).toBeInTheDocument();
    expect(screen.getByText("0.00%")).toBeInTheDocument();
  });

  it("applies keyword and source filters to the query input", () => {
    useQuery.mockImplementation(() => ({ ...emptyQuery(), data: { ...emptyQuery().data, options: { countries: [], devices: [], pages: [], sources: ["gsc-export.csv"] } } }));
    render(<KeywordTrends />);
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "maternal care" } });
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "gsc-export.csv" } });
    const latestInput = useQuery.mock.calls.at(-1)?.[0];
    expect(latestInput).toMatchObject({ keyword: "maternal care", source: "gsc-export.csv" });
  });

  it("triggers import on file selection and exposes manual refresh controls", async () => {
    render(<KeywordTrends />);
    expect(screen.getAllByRole("button", { name: "Refresh" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Refresh")).toHaveValue("60");
    expect(useQuery.mock.calls.at(-1)?.[1]).toMatchObject({ refetchInterval: 60_000, refetchIntervalInBackground: true });
    fireEvent.change(screen.getByLabelText("Refresh"), { target: { value: "300" } });
    expect(useQuery.mock.calls.at(-1)?.[1]).toMatchObject({ refetchInterval: 300_000, refetchIntervalInBackground: true });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(["date,keyword\n"], "export.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ format: "csv", filename: "export.csv" })));
    fireEvent.click(screen.getAllByRole("button", { name: "Refresh" })[0]);
    expect(refetch).toHaveBeenCalled();
  });
});
