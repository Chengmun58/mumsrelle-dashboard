import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Download, FileJson, FileText, RefreshCw, UploadCloud, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function compact(value: number) {
  return new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function detectKeywordFileFormat(filename: string): "csv" | "json" {
  return filename.toLowerCase().endsWith(".json") ? "json" : "csv";
}

export function buildKeywordFilters(input: { from: string; to: string; keyword: string; country: string; device: string; page: string; source: string }) {
  return { from: input.from, to: input.to, keyword: input.keyword || undefined, country: input.country, device: input.device, page: input.page, source: input.source };
}

function formatDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function KeywordTrends() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => { const date = new Date(today); date.setDate(date.getDate() - 30); return iso(date); }, [today]);
  const initialTo = useMemo(() => iso(today), [today]);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("ALL");
  const [device, setDevice] = useState("ALL");
  const [page, setPage] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [refreshSeconds, setRefreshSeconds] = useState("60");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const filters = useMemo(() => buildKeywordFilters({ from, to, keyword, country, device, page, source }), [from, to, keyword, country, device, page, source]);
  const query = trpc.keywords.overview.useQuery(filters, { refetchInterval: Number(refreshSeconds) * 1000, refetchIntervalInBackground: true, staleTime: 30_000 });
  const importer = trpc.keywords.import.useMutation({ onSuccess: () => { setUploadError(null); void query.refetch(); }, onError: error => setUploadError(error.message) });
  const data = query.data;
  const trend = data?.trend ?? [];
  const topKeywords = data?.topKeywords ?? [];

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const format = detectKeywordFileFormat(file.name);
      importer.mutate({ format, content, filename: file.name, source: "offline-import" });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to read the selected file");
    } finally {
      event.target.value = "";
    }
  }

  function downloadTemplate(format: "csv" | "json") {
    const content = format === "csv" ? "date,keyword,clicks,impressions,ctr,position,country,device,page,source\n" : "[]\n";
    const url = URL.createObjectURL(new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `keyword-trend-template.${format}`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-950">
      <div className="mx-auto max-w-[1600px] space-y-5 p-2 sm:p-5">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">SEO / Keyword Trends</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Latest keyword performance</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Import verified Search Console, Ahrefs or Semrush exports and keep the dashboard refreshed without fabricating metrics.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.role === "admin" ? <><input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" aria-label="Keyword file" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={importer.isPending} className="gap-2"><UploadCloud className="h-4 w-4" /> Import CSV / JSON</Button></> : null}
            <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} className="gap-2"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
          </div>
        </header>

        <Card className="border-violet-100 bg-violet-50/60 shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${data?.meta.rowCount ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-amber-500 ring-4 ring-amber-100"}`} /><span className="font-semibold">Database-backed import source</span><span className="text-muted-foreground">{data?.meta.rowCount ? `${data.meta.rowCount.toLocaleString()} rows · ${data.meta.filename ?? "latest import"}` : "No verified keyword file imported yet"}</span></div><div className="text-xs text-muted-foreground">Latest data {formatDate(data?.meta.latestDate ?? null)} · Imported {data?.meta.importedAt ? new Date(data.meta.importedAt).toLocaleString("en-SG") : "—"} · Auto refresh every {refreshSeconds}s</div></CardContent></Card>

        <Card className="shadow-sm"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><div className="space-y-1.5"><Label htmlFor="keyword-from">From</Label><Input id="keyword-from" type="date" value={from} onChange={event => setFrom(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="keyword-to">To</Label><Input id="keyword-to" type="date" value={to} onChange={event => setTo(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="keyword-search">Keyword</Label><Input id="keyword-search" placeholder="Search query" value={keyword} onChange={event => setKeyword(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="country">Country</Label><select id="country" value={country} onChange={event => setCountry(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="ALL">All countries</option>{data?.options.countries.map(item => <option key={item}>{item}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="device">Device</Label><select id="device" value={device} onChange={event => setDevice(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="ALL">All devices</option>{data?.options.devices.map(item => <option key={item}>{item}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="page">Page</Label><select id="page" value={page} onChange={event => setPage(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="ALL">All pages</option>{data?.options.pages.map(item => <option key={item}>{item}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="source">Source</Label><select id="source" value={source} onChange={event => setSource(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="ALL">All sources</option>{data?.options.sources.map(item => <option key={item}>{item}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="refresh">Refresh</Label><select id="refresh" value={refreshSeconds} onChange={event => setRefreshSeconds(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="30">Every 30s</option><option value="60">Every 60s</option><option value="300">Every 5m</option></select></div></CardContent></Card>

        {uploadError ? <Card className="border-pink-200 bg-pink-50"><CardContent className="flex items-center gap-2 p-4 text-sm text-pink-700"><TriangleAlert className="h-4 w-4 shrink-0" /> {uploadError}</CardContent></Card> : null}
        {data?.meta.warning ? <Card className="border-amber-200 bg-amber-50"><CardContent className="flex items-center gap-2 p-4 text-sm text-amber-800"><TriangleAlert className="h-4 w-4 shrink-0" /> {data.meta.warning}</CardContent></Card> : null}
        {query.error ? <Card className="border-pink-200 bg-pink-50"><CardContent className="p-4 text-sm text-pink-700">Unable to load keyword data. {query.error.message}</CardContent></Card> : null}
        {!data?.meta.rowCount && !query.isLoading ? <Card className="border-amber-200 bg-amber-50"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-semibold text-amber-900">Import a verified keyword export to begin</p><p className="mt-1 text-sm text-amber-800">The charts remain empty until you provide real CSV or JSON rows.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => downloadTemplate("csv")} className="gap-2"><FileText className="h-4 w-4" /> CSV template</Button><Button variant="outline" onClick={() => downloadTemplate("json")} className="gap-2"><FileJson className="h-4 w-4" /> JSON template</Button></div></CardContent></Card> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Clicks" value={compact(data?.totals.clicks ?? 0)} detail="Selected period" /><Metric label="Impressions" value={compact(data?.totals.impressions ?? 0)} detail="Selected period" /><Metric label="CTR" value={percent(data?.totals.ctr ?? 0)} detail="Clicks ÷ impressions" /><Metric label="Average position" value={data?.totals.position ? data.totals.position.toFixed(1) : "—"} detail="Weighted by impressions" /></section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]"><ChartCard title="Keyword trend" subtitle="Daily clicks and impressions from the selected import"><ResponsiveContainer width="100%" height={320}><AreaChart data={trend}><defs><linearGradient id="keywordClicks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b45df" stopOpacity={0.28} /><stop offset="100%" stopColor="#5b45df" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" tickFormatter={compact} tick={{ fontSize: 11 }} /><YAxis yAxisId="right" orientation="right" tickFormatter={compact} tick={{ fontSize: 11 }} /><Tooltip /><Area yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#5b45df" fill="url(#keywordClicks)" strokeWidth={2.5} /><Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#28b48d" fill="none" strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Top keywords" subtitle="Ranked by clicks in the selected period"><ResponsiveContainer width="100%" height={320}><BarChart data={topKeywords.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="keyword" width={130} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="clicks" name="Clicks" fill="#ef4770" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard></section>

        <Card className="shadow-sm"><CardHeader><CardTitle>Keyword ranking detail</CardTitle><p className="text-sm text-muted-foreground">Real rows from the selected CSV/JSON import; no generated keywords are shown.</p></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Keyword</th><th className="p-3 text-right">Clicks</th><th className="p-3 text-right">Impressions</th><th className="p-3 text-right">CTR</th><th className="p-3 text-right">Position</th><th className="p-3 text-right">Change</th><th className="p-3">Source</th></tr></thead><tbody>{topKeywords.map(row => <tr key={row.keyword} className="border-b last:border-0"><td className="p-3 font-medium">{row.keyword}</td><td className="p-3 text-right">{row.clicks.toLocaleString()}</td><td className="p-3 text-right">{row.impressions.toLocaleString()}</td><td className="p-3 text-right">{percent(row.ctr)}</td><td className="p-3 text-right">{row.position ? row.position.toFixed(1) : "—"}</td><td className={`p-3 text-right font-semibold ${row.positionChange === null ? "text-muted-foreground" : row.positionChange > 0 ? "text-emerald-600" : row.positionChange < 0 ? "text-pink-600" : "text-muted-foreground"}`}>{row.positionChange === null ? "—" : `${row.positionChange > 0 ? "+" : ""}${row.positionChange.toFixed(1)}`}</td><td className="p-3 text-muted-foreground">{data?.meta.source ?? "—"}</td></tr>)}{!topKeywords.length ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No keyword rows match the current filters.</td></tr> : null}</tbody></table></div></CardContent></Card>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <Card className="border-l-4 border-l-violet-600 shadow-sm"><CardContent className="p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>; }
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <Card className="shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">{subtitle}</p></CardHeader><CardContent>{children}</CardContent></Card>; }
