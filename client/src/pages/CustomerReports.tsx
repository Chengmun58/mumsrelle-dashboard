import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Database, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const colors = {
  violet: "#5b45df",
  pink: "#ef4770",
  teal: "#28b48d",
  amber: "#f0a328",
  slate: "#64748b",
};

function number(value: number) {
  return new Intl.NumberFormat("en-SG").format(value);
}

function monthLabel(value: string) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: "short",
  });
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Metric({
  label,
  value,
  detail,
  tone = "violet",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "violet" | "pink" | "teal" | "slate";
}) {
  const border =
    tone === "pink"
      ? "border-l-pink-500"
      : tone === "teal"
        ? "border-l-emerald-500"
        : tone === "slate"
          ? "border-l-slate-400"
          : "border-l-violet-600";
  return (
    <Card className={`border-l-4 ${border} shadow-sm`}>
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function RankedList({
  rows,
  color = colors.violet,
}: {
  rows: Array<{ name: string; count: number }>;
  color?: string;
}) {
  const maximum = Math.max(...rows.map(row => row.count), 1);
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div
          key={row.name}
          className="grid grid-cols-[minmax(110px,1fr)_minmax(100px,1.8fr)_58px] items-center gap-3 text-sm"
        >
          <span className="truncate" title={row.name}>
            {row.name}
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.count / maximum) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <b className="text-right tabular-nums">{number(row.count)}</b>
        </div>
      ))}
    </div>
  );
}

export default function CustomerReports() {
  const query = trpc.customerReports.overview.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });
  const data = query.data;
  const activity =
    data?.monthlyActivity.map(row => ({
      ...row,
      label: monthLabel(row.month),
    })) ?? [];
  const futureDated = data
    ? Object.values(data.quality.futureDatedFields).reduce(
        (sum, value) => sum + value,
        0
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-950">
      <div className="mx-auto max-w-[1600px] space-y-5 p-2 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
              Reports / Customer Reports
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              CSO customer pipeline
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              KIV, Signed Up, source, service, PRHB and SC reporting from the
              CSO mirror.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4" /> Aggregated — no customer PII
          </div>
        </header>

        {query.isLoading ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Loading customer reports…
            </CardContent>
          </Card>
        ) : null}
        {query.isError ? (
          <Card className="border-pink-200 bg-pink-50">
            <CardContent className="p-5 text-sm text-pink-700">
              Customer reports could not be loaded. Please refresh the page.
            </CardContent>
          </Card>
        ) : null}

        {data ? (
          <>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-xs text-muted-foreground sm:p-5">
                <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                  <Database className="h-4 w-4 text-violet-600" />{" "}
                  {data.source.recordSource}
                </span>
                <span>Google Drive mirror: {data.source.title}</span>
                <span>Updated {dateLabel(data.source.driveUpdatedAt)}</span>
                <span className="ml-auto">
                  Snapshot {dateLabel(data.source.snapshotAt)}
                </span>
              </CardContent>
            </Card>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric
                label="Total Records"
                value={number(data.totals.records)}
                detail="Reporting mirror"
              />
              <Metric
                label="Active KIV"
                value={number(data.totals.activeKiv)}
                detail="Current status"
                tone="slate"
              />
              <Metric
                label="Signed Up"
                value={number(data.totals.signedUp)}
                detail={`${data.totals.signedRate.toFixed(1)}% of all records`}
                tone="teal"
              />
              <Metric
                label="Declined"
                value={number(data.totals.declined)}
                detail="Current status"
                tone="pink"
              />
              <Metric
                label="Open + Won Share"
                value={`${data.totals.signedShareOfOpenAndWon.toFixed(1)}%`}
                detail="Signed Up ÷ (KIV + Signed Up)"
                tone="teal"
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>2026 customer activity</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Non-future-dated contact and status activity in the
                    reporting mirror.
                  </p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={330}>
                    <LineChart data={activity} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => number(value)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="lastContact"
                        name="Last contact"
                        stroke={colors.violet}
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="prhbActivity"
                        name="PRHB activity"
                        stroke={colors.pink}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="scActivity"
                        name="SC activity"
                        stroke={colors.teal}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="appointments"
                        name="Appointments"
                        stroke={colors.amber}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Current case status</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    All records with a recognized CSO status.
                  </p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={330}>
                    <BarChart
                      data={data.statusBreakdown}
                      layout="vertical"
                      margin={{ left: 24, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(value: number) => number(value)} />
                      <Bar
                        dataKey="count"
                        name="Records"
                        fill={colors.violet}
                        radius={[0, 5, 5, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Top acquisition sources</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Highest-volume sources across the CSO reporting mirror.
                  </p>
                </CardHeader>
                <CardContent>
                  <RankedList rows={data.topSources} />
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Service and promotion mix</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Long package names are grouped into reporting categories.
                  </p>
                </CardHeader>
                <CardContent>
                  <RankedList
                    rows={data.serviceCategories}
                    color={colors.pink}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>PRHB status</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Top PRHB outcomes and follow-up states.
                  </p>
                </CardHeader>
                <CardContent>
                  <RankedList
                    rows={data.prhbStatus.slice(0, 8)}
                    color={colors.teal}
                  />
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>SC status</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Top SC outcomes and follow-up states.
                  </p>
                </CardHeader>
                <CardContent>
                  <RankedList
                    rows={data.scStatus.slice(0, 8)}
                    color={colors.amber}
                  />
                </CardContent>
              </Card>
            </section>

            <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <TriangleAlert className="h-5 w-5" /> Data-quality checks
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-amber-900 md:grid-cols-3">
                <div>
                  <p className="text-2xl font-bold">{number(futureDated)}</p>
                  <p className="mt-1 text-amber-800">
                    Future-dated contact/status fields excluded from the 2026
                    activity chart.
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {number(data.quality.appointmentSpellingVariant)}
                  </p>
                  <p className="mt-1 text-amber-800">
                    Appointment rows use “Attented” instead of “Attended”.
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold">Snapshot</p>
                  <p className="mt-1 text-amber-800">
                    This privacy-safe report is refreshed from Google Drive, not
                    a public raw-sheet feed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
