import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fields = [
  ["kivApproach", "No. of KIV Approach"],
  ["existingCustomerApproach", "Existing Customer Approach"],
  ["baArranged", "No. of BA arranged"],
  ["newLeadSent", "No. of New lead Sent"],
  ["promo8RioVersion", "Promo8 rio version"],
  ["oldPromo8", "Old Promo8"],
  ["newPromo8", "New Promo8"],
  ["pelvicEnhancement", "Pelvic Enhancement"],
] as const;
type Field = typeof fields[number][0];
type Counts = Record<Field, number | null>;
const blank = () => Object.fromEntries(fields.map(([key]) => [key, null])) as Counts;
const sgToday = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export default function CsoDailyUpdates() {
  const today = sgToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [day, setDay] = useState(today);
  const [counts, setCounts] = useState<Counts>(blank);
  const [notice, setNotice] = useState("");
  const utils = trpc.useUtils();
  const list = trpc.csoDaily.list.useQuery({ from, to }, { enabled: from <= to });
  const me = trpc.auth.me.useQuery();
  const save = trpc.csoDaily.save.useMutation({
    onSuccess: async () => { setNotice(`Saved ${day} to MySQL.`); await utils.csoDaily.list.invalidate(); },
    onError: error => setNotice(error.message),
  });

  useEffect(() => {
    const saved = list.data?.find(row => row.day === day);
    setCounts(saved ? { ...blank(), ...saved.counts } : blank());
  }, [day, list.data]);

  function edit(row: { day: string; counts: Counts }) {
    setDay(row.day);
    setCounts({ ...blank(), ...row.counts });
    setNotice(`Editing ${row.day}. Values are saved only when you press Save.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className="mx-auto max-w-[1600px] space-y-5 p-2 sm:p-5">
    <header><h1 className="text-2xl font-bold">CSO Daily Update</h1><p className="text-sm text-muted-foreground">Backdate a daily record with its actual business date. Changes are recorded in MySQL with the editor and edit time.</p></header>
    <Card><CardHeader><CardTitle>Daily entry</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="block max-w-xs text-sm">Business date (Singapore time)<Input type="date" value={day} onChange={e => { const next = e.target.value; setDay(next); if (next < from) setFrom(next); if (next > to) setTo(next); setNotice(""); }} /></label>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{fields.map(([key,label]) => <label key={key} className="text-sm">{label}<Input aria-label={label} type="number" min="0" step="1" value={counts[key] ?? ""} onChange={e => setCounts(current => ({ ...current, [key]: e.target.value === "" ? null : Number(e.target.value) }))} /></label>)}</div>
      <p className="text-xs text-muted-foreground">Blank means unrecorded; 0 means confirmed none. This entry does not edit the original Google Sheet.</p>
      <Button disabled={me.data?.role !== "admin" || !day || save.isPending || Object.values(counts).some(v => v !== null && (!Number.isSafeInteger(v) || v < 0))} onClick={() => save.mutate({ day, counts })}>Save daily entry</Button>
      {me.data?.role !== "admin" && <p className="text-sm text-amber-700">Admin access is required to save changes.</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Historical entries</CardTitle></CardHeader><CardContent>
      <div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">From<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm">To<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      {from > to && <p className="text-sm text-red-700">From must be on or before To.</p>}
      {list.isError && <p className="text-sm text-red-700">{list.error.message}</p>}
      {list.isLoading && <p>Loading entries…</p>}
      {list.data && <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-2">Date</th>{fields.map(([key,label]) => <th key={key} className="p-2">{label}</th>)}<th className="p-2">Updated</th><th className="p-2"></th></tr></thead><tbody>{list.data.map(row => <tr key={row.day} className="border-b"><td className="p-2 font-medium">{row.day}</td>{fields.map(([key]) => <td key={key} className="p-2">{row.counts[key] ?? "—"}</td>)}<td className="p-2">{new Date(row.updatedAt).toLocaleString("en-SG",{timeZone:"Asia/Singapore"})}</td><td className="p-2"><Button variant="outline" size="sm" onClick={() => edit(row)}>Edit</Button></td></tr>)}</tbody></table>{!list.data.length && <p className="py-5 text-sm text-muted-foreground">No saved entries in this range.</p>}</div>}
    </CardContent></Card>
  </div>;
}
