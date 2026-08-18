import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, CalendarDays, RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const quickRanges = ["Today", "Yesterday", "This Week", "Last Week", "This Month", "Last Month", "Last 3 Months", "This Year"] as const;
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const chartColors = { purple: "#5b45df", pink: "#ef4770", teal: "#28b48d", body: "#5b45df", retail: "#1aa9bd", face: "#f0a328" };

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function money(value: number) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", minimumFractionDigits: 2 }).format(value);
}

function compact(value: number) {
  return new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function monthLabel(value: string) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function rangeFor(name: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (name === "Today") return [today, today];
  if (name === "Yesterday") {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return [date, date];
  }
  if (name === "This Week") {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    return [startOfWeek, end];
  }
  if (name === "Last Week") {
    const start = new Date(startOfWeek);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return [start, end];
  }
  if (name === "This Month") return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)];
  if (name === "Last Month") return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
  if (name === "Last 3 Months") return [new Date(today.getFullYear(), today.getMonth() - 2, 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)];
  return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
}

export function periodDescription(from: string, to: string, previousFrom?: string, previousTo?: string) {
  if (!from || !to) return "Select a date range to compare periods";
  const days = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1;
  return `${displayDate(from)} → ${displayDate(to)} · ${days} ${days === 1 ? "day" : "days"}${previousFrom && previousTo ? ` · previous ${displayDate(previousFrom)} → ${displayDate(previousTo)}` : ""}`;
}

function MetricCard({ label, value, sub, tone = "purple", delta }: { label: string; value: string; sub: string; tone?: "purple" | "gray" | "pink"; delta?: number | null }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className={`border-l-4 ${tone === "gray" ? "border-l-slate-400" : tone === "pink" ? "border-l-pink-500" : "border-l-violet-600"}`}>
      <CardContent className="relative p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        {delta !== undefined && delta !== null ? (
          <span className={`absolute right-4 top-5 inline-flex items-center text-sm font-semibold ${positive ? "text-emerald-600" : "text-pink-600"}`}>
            {positive ? <ArrowUpRight className="mr-1 h-4 w-4" /> : <ArrowDownRight className="mr-1 h-4 w-4" />}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const initialFrom = "2025-12-01";
  const initialTo = "2025-12-31";
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [activeQuick, setActiveQuick] = useState<string>("This Month");
  const [month, setMonth] = useState("11");
  const [year, setYear] = useState("2025");
  const query = trpc.dashboard.overview.useQuery({ from, to }, { refetchInterval: 300000, staleTime: 300000 });
  const data = query.data;

  const trend = useMemo(() => data?.trend.map(item => ({ ...item, label: monthLabel(item.month) })) ?? [], [data?.trend]);
  const comparison = data ? [{ outlet: "Mumsrelle MSOG", current: data.sales.current, previous: data.sales.previous }] : [];
  const outlets = data?.outlets.map(item => ({ outlet: item.name, value: item.value })) ?? [];
  const departments = data ? [{ outlet: "Mumsrelle MSOG", BODY: data.departments.BODY, "RETAIL PRODUCT": data.departments["RETAIL PRODUCT"], FACE: data.departments.FACE }] : [];
  const sourceMax = Math.max(...(data?.cso?.topSources.map(source => source.count) ?? [1]), 1);
  const hasComparison = Boolean(data && (data.sales.current || data.sales.previous));
  const hasDepartments = Boolean(data && Object.values(data.departments).some(value => value > 0));
  const positive = (data?.sales.difference ?? 0) >= 0;

  function applyQuick(name: string) {
    const [start, end] = rangeFor(name);
    setActiveQuick(name);
    setFrom(iso(start));
    setTo(iso(end));
  }

  function applyMonth(nextMonth: string, nextYear: string) {
    const start = new Date(Number(nextYear), Number(nextMonth), 1);
    const end = new Date(Number(nextYear), Number(nextMonth) + 1, 0);
    setMonth(nextMonth);
    setYear(nextYear);
    setActiveQuick("This Month");
    setFrom(iso(start));
    setTo(iso(end));
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-950">
      <div className="mx-auto max-w-[1600px] space-y-5 p-2 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Reports / Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Sales performance overview</h1>
          </div>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </header>

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <b className="text-slate-900">CSO Casesheet</b>
              <span>{data?.cso ? `Live · refreshed ${new Date(data.cso.refreshedAt).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}` : "Connecting…"}</span>
              <span className="text-slate-300">|</span>
              <b className="text-slate-900">Mumsrelle Overview</b>
              <span>verified snapshot · latest data {data?.sources.overview.latestDataDate ?? "—"}</span>
              {data?.warning ? <span className="inline-flex items-center gap-1 font-semibold text-pink-600"><TriangleAlert className="h-3.5 w-3.5" /> {data.warning}</span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {quickRanges.map(item => <Button key={item} size="sm" variant={activeQuick === item ? "default" : "outline"} onClick={() => applyQuick(item)} className="rounded-full">{item}</Button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5"><Label htmlFor="month">Month</Label><select id="month" value={month} onChange={event => applyMonth(event.target.value, year)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{months.map((item, index) => <option key={item} value={index}>{item}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="year">Year</Label><select id="year" value={year} onChange={event => applyMonth(month, event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{[2024, 2025, 2026, 2027].map(item => <option key={item}>{item}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="from">From</Label><Input id="from" type="date" value={from} onChange={event => { setFrom(event.target.value); setActiveQuick("Custom Period"); }} /></div>
              <div className="space-y-1.5"><Label htmlFor="to">To</Label><Input id="to" type="date" value={to} onChange={event => { setTo(event.target.value); setActiveQuick("Custom Period"); }} /></div>
              <div className="flex items-end sm:col-span-2 xl:col-span-5"><div className="flex min-h-10 w-full items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" /> {periodDescription(from, to, data?.range.previousFrom, data?.range.previousTo)}</div></div>
            </div>
          </CardContent>
        </Card>

        {query.isError ? <Card className="border-pink-200 bg-pink-50"><CardContent className="p-4 text-sm text-pink-700">Unable to load dashboard data. Please refresh and try again.</CardContent></Card> : null}
        {query.isLoading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading sales and CSO data…</CardContent></Card> : null}
        {!query.isLoading && data?.sales.outsideOverview ? <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4 text-sm text-amber-800">The selected period is outside the Overview snapshot ({data.sources.overview.firstDataDate} → {data.sources.overview.latestDataDate}). Sales values are shown as zero until a newer snapshot is connected.</CardContent></Card> : null}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Current Period" value={money(data?.sales.current ?? 0)} sub={activeQuick} />
          <MetricCard label="Previous Period" value={money(data?.sales.previous ?? 0)} sub={data ? `${displayDate(data.range.previousFrom)} → ${displayDate(data.range.previousTo)}` : "—"} tone="gray" />
          <MetricCard label="Difference" value={money(data?.sales.difference ?? 0)} sub="Current period minus previous period" tone="pink" delta={data?.sales.difference} />
          <MetricCard label="Period-on-Period" value={data?.sales.pop === null || data?.sales.pop === undefined ? "—" : `${data.sales.pop.toFixed(2)}%`} sub="Change versus previous period" tone="pink" delta={data?.sales.pop} />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Outlet Comparison" subtitle="Current period vs previous period">
            {hasComparison ? <ResponsiveContainer width="100%" height={300}><BarChart data={comparison} barGap={8}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="outlet" tick={{ fontSize: 12 }} /><YAxis tickFormatter={compact} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => money(value)} /><Legend /><Bar dataKey="current" name="Current Period" fill={chartColors.purple} radius={[4, 4, 0, 0]} /><Bar dataKey="previous" name="Previous Period" fill={chartColors.pink} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart message="No sales rows are available for this period." />}
          </ChartCard>
          <ChartCard title="Top 5 Outlets" subtitle={data?.outletDimensionAvailable ? "Ranked by current period net collection" : "Outlet dimension unavailable in the current Overview snapshot"}>
            {outlets.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={outlets} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={compact} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="outlet" width={120} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => money(value)} /><Bar dataKey="value" name="Net collection" fill={chartColors.purple} radius={[0, 4, 4, 0]}>{outlets.map((_, index) => <Cell key={index} fill={index === 0 ? chartColors.purple : "#a99cf3"} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyChart message="No outlet-level rows are available in this snapshot." />}
          </ChartCard>
          <ChartCard title="12-Month Collection Trend" subtitle="Rolling 12 months ending in the selected period">
            {trend.length ? <ResponsiveContainer width="100%" height={300}><AreaChart data={trend}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.teal} stopOpacity={0.3} /><stop offset="100%" stopColor={chartColors.teal} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis tickFormatter={compact} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => money(value)} /><Area type="monotone" dataKey="value" name="Collection" stroke={chartColors.teal} fill="url(#trendFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer> : <EmptyChart message="No monthly trend is available for this selection." />}
          </ChartCard>
          <ChartCard title="Top 5 Departments by Outlet" subtitle="GT1-allocated revenue per department (current period)">
            {hasDepartments ? <ResponsiveContainer width="100%" height={300}><BarChart data={departments}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="outlet" tick={{ fontSize: 12 }} /><YAxis tickFormatter={compact} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => money(value)} /><Legend /><Bar dataKey="BODY" stackId="department" fill={chartColors.body} /><Bar dataKey="RETAIL PRODUCT" stackId="department" fill={chartColors.retail} /><Bar dataKey="FACE" stackId="department" fill={chartColors.face} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart message="No department revenue is available for this period." />}
          </ChartCard>
        </section>

        <Card className="shadow-sm"><CardHeader><CardTitle>CSO Case Pipeline</CardTitle><p className="text-sm text-muted-foreground">Privacy-safe summary from KIV and Signed Up tabs</p></CardHeader><CardContent>{data?.cso ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Active KIV", data?.cso?.activeKiv], ["Due Today", data?.cso?.dueToday], ["Overdue", data?.cso?.overdue], ["New Leads", data?.cso?.newLeads], ["Signed Up", data?.cso?.signedUp]].map(([label, value]) => <div key={label} className="rounded-xl border bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : "—"}</p></div>)}</div><div className="mt-6"><p className="mb-3 text-sm font-semibold">Top active-KIV sources</p><div className="space-y-3">{data?.cso?.topSources.length ? data.cso.topSources.map(source => <div key={source.name} className="grid grid-cols-[120px_1fr_42px] items-center gap-3 text-sm"><span className="truncate">{source.name}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400" style={{ width: `${Math.max(4, source.count / sourceMax * 100)}%` }} /></div><b className="text-right">{source.count}</b></div>) : <p className="text-sm text-muted-foreground">No active KIV sources available.</p>}</div></div></> : <EmptyChart message="CSO Casesheet is unavailable for this period." />}</CardContent></Card>
        <p className="text-right text-xs text-muted-foreground">Data refreshes automatically every 5 minutes · {query.dataUpdatedAt ? `last dashboard refresh ${new Date(query.dataUpdatedAt).toLocaleString("en-SG")}` : "loading"}</p>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) { return <div className="flex h-[300px] items-center justify-center rounded-lg bg-slate-50 text-sm text-muted-foreground">{message}</div>; }

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <Card className="shadow-sm"><CardHeader className="pb-0"><CardTitle className="text-base">{title}</CardTitle><p className="text-xs text-muted-foreground">{subtitle}</p></CardHeader><CardContent className="pt-3">{children}</CardContent></Card>;
}
