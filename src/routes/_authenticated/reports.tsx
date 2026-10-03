import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileBarChart, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SchoolFolders } from "@/components/school-folders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchoolScope } from "@/components/school-scope";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, fmtDateTime, fmtKg, fmtPct, fmtRp, type WasteCategory } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Laporan — Eco-School Waste Management" }] }),
  component: ReportsPage,
});

type ReportKind = "daily" | "weekly" | "monthly" | "generated" | "composition" | "sources" | "processing" | "utilization" | "sales" | "residual" | "audits" | "findings" | "activities";
type ReportRow = Record<string, string | number>;
const REPORTS: { value: ReportKind; label: string }[] = [
  { value: "daily", label: "Sampah harian" },
  { value: "weekly", label: "Sampah mingguan" },
  { value: "monthly", label: "Sampah bulanan" },
  { value: "generated", label: "Sampah yang dihasilkan" },
  { value: "composition", label: "Komposisi sampah" },
  { value: "sources", label: "Sumber sampah" },
  { value: "processing", label: "Pengolahan" },
  { value: "utilization", label: "Pemanfaatan" },
  { value: "sales", label: "Bank sampah dan penjualan" },
  { value: "residual", label: "Residu" },
  { value: "audits", label: "Hasil audit" },
  { value: "findings", label: "Temuan dan aksi" },
  { value: "activities", label: "Kegiatan lingkungan" },
];

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }
function startDate(date: string) { return `${date}T00:00:00.000Z`; }
function endDate(date: string) { return `${date}T23:59:59.999Z`; }
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function ReportsPage() {
  const { schoolId, schools, isSuperAdmin } = useSchoolScope();
  const [kind, setKind] = useState<ReportKind>("generated");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState("all");

  const reportQuery = useQuery({
    queryKey: ["report", kind, from, to, category, schoolId],
    enabled: Boolean(schoolId),
    queryFn: async (): Promise<ReportRow[]> => {
      if (!schoolId) return [];
      if (["daily", "weekly", "monthly", "generated", "composition", "sources"].includes(kind)) {
        let request = supabase.from("waste_records")
          .select("id, recorded_at, weight_kg, category, locations(name), waste_sources(name), waste_batches(batch_code)")
          .eq("school_id", schoolId).is("deleted_at", null)
          .gte("recorded_at", startDate(from)).lte("recorded_at", endDate(to))
          .order("recorded_at", { ascending: false }).limit(1000);
        if (category !== "all") request = request.eq("category", category as WasteCategory);
        const { data, error } = await request;
        if (error) throw error;
        const records = data ?? [];
        if (kind === "weekly" || kind === "monthly") {
          const groups = new Map<string, { records: number; weight: number }>();
          for (const row of records) {
            const date = new Date(row.recorded_at);
            let period: string;
            if (kind === "monthly") {
              period = date.toISOString().slice(0, 7);
            } else {
              const weekDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
              const weekday = weekDate.getUTCDay() || 7;
              weekDate.setUTCDate(weekDate.getUTCDate() - weekday + 1);
              period = `Minggu ${weekDate.toISOString().slice(0, 10)}`;
            }
            const current = groups.get(period) ?? { records: 0, weight: 0 };
            current.records += 1;
            current.weight += Number(row.weight_kg);
            groups.set(period, current);
          }
          return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([period, total]) => ({ Periode: period, "Jumlah catatan": total.records, "Berat (kg)": Number(total.weight.toFixed(3)) }));
        }
        if (kind === "composition") {
          const totals = new Map<string, number>();
          for (const row of records) totals.set(row.category, (totals.get(row.category) ?? 0) + Number(row.weight_kg));
          return [...totals.entries()].map(([key, weight]) => ({ Kategori: CATEGORY_LABEL[key as WasteCategory], "Berat (kg)": Number(weight.toFixed(3)), "Persentase (%)": records.length ? Number((weight / records.reduce((sum, row) => sum + Number(row.weight_kg), 0) * 100).toFixed(1)) : 0 }));
        }
        if (kind === "sources") {
          const totals = new Map<string, number>();
          for (const row of records) { const source = Array.isArray(row.waste_sources) ? row.waste_sources[0] : row.waste_sources; const name = source?.name ?? "Tidak diisi"; totals.set(name, (totals.get(name) ?? 0) + Number(row.weight_kg)); }
          return [...totals.entries()].map(([name, weight]) => ({ Sumber: name, "Berat (kg)": Number(weight.toFixed(3)) }));
        }
        return records.map((row) => { const location = Array.isArray(row.locations) ? row.locations[0] : row.locations; const source = Array.isArray(row.waste_sources) ? row.waste_sources[0] : row.waste_sources; const batch = Array.isArray(row.waste_batches) ? row.waste_batches[0] : row.waste_batches; return { Tanggal: fmtDateTime(row.recorded_at), Batch: batch?.batch_code ?? "-", Lokasi: location?.name ?? "-", Sumber: source?.name ?? "-", Kategori: CATEGORY_LABEL[row.category], "Berat (kg)": Number(row.weight_kg) }; });
      }
      if (kind === "processing") {
        const { data, error } = await supabase.from("waste_processing").select("processed_at, method, input_weight_kg, output_weight_kg, responsible_name, waste_batches!inner(batch_code, school_id)").eq("waste_batches.school_id", schoolId).is("deleted_at", null).gte("processed_at", startDate(from)).lte("processed_at", endDate(to)).order("processed_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data ?? []).map((row) => ({ Tanggal: fmtDateTime(row.processed_at), Batch: row.waste_batches.batch_code, Metode: row.method, "Input (kg)": Number(row.input_weight_kg), "Output (kg)": Number(row.output_weight_kg), Penanggung_jawab: row.responsible_name ?? "-" }));
      }
      if (kind === "utilization") {
        const { data, error } = await supabase.from("waste_utilization").select("used_at, utilization_type, weight_kg, destination, economic_value, waste_batches!inner(batch_code, school_id)").eq("waste_batches.school_id", schoolId).is("deleted_at", null).gte("used_at", startDate(from)).lte("used_at", endDate(to)).order("used_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data ?? []).map((row) => ({ Tanggal: fmtDateTime(row.used_at), Batch: row.waste_batches.batch_code, Jenis: row.utilization_type, Tujuan: row.destination ?? "-", "Berat (kg)": Number(row.weight_kg), "Nilai ekonomi (Rp)": Number(row.economic_value) }));
      }
      if (kind === "sales") {
        const { data, error } = await supabase.from("waste_sales").select("transaction_code, sold_at, category, weight_kg, price_per_kg, total_value, payment_status, partners(name), waste_types(name), waste_batches(batch_code, school_id)").is("deleted_at", null).gte("sold_at", startDate(from)).lte("sold_at", endDate(to)).order("sold_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data ?? []).filter((row) => !row.waste_batches || row.waste_batches.school_id === schoolId).map((row) => { const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners; const type = Array.isArray(row.waste_types) ? row.waste_types[0] : row.waste_types; const batch = Array.isArray(row.waste_batches) ? row.waste_batches[0] : row.waste_batches; return { Transaksi: row.transaction_code, Tanggal: fmtDateTime(row.sold_at), Batch: batch?.batch_code ?? "-", Jenis: type?.name ?? CATEGORY_LABEL[row.category], Mitra: partner?.name ?? "-", "Berat (kg)": Number(row.weight_kg), "Harga/kg (Rp)": Number(row.price_per_kg), "Total (Rp)": Number(row.total_value ?? 0), Pembayaran: row.payment_status }; });
      }
      if (kind === "residual") {
        const { data, error } = await supabase.from("residual_disposals").select("disposed_at, weight_kg, destination, disposal_method, transporter, waste_batches!inner(batch_code, school_id)").eq("waste_batches.school_id", schoolId).is("deleted_at", null).gte("disposed_at", startDate(from)).lte("disposed_at", endDate(to)).order("disposed_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data ?? []).map((row) => ({ Tanggal: fmtDateTime(row.disposed_at), Batch: row.waste_batches.batch_code, Tujuan: row.destination ?? "-", Metode: row.disposal_method ?? "-", Pengangkut: row.transporter ?? "-", "Berat (kg)": Number(row.weight_kg) }));
      }
      if (kind === "audits") {
        const { data, error } = await supabase.from("audits").select("audited_at, total_score, auditor_name, notes, locations(name)").eq("school_id", schoolId).is("deleted_at", null).gte("audited_at", from).lte("audited_at", to).order("audited_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data ?? []).map((row) => { const location = Array.isArray(row.locations) ? row.locations[0] : row.locations; return { Tanggal: row.audited_at, Lokasi: location?.name ?? "-", Auditor: row.auditor_name ?? "-", "Skor (%)": Number(row.total_score), Catatan: row.notes ?? "" }; });
      }
      if (kind === "findings") {
        const { data, error } = await supabase.from("audit_findings").select("finding_code, category, description, severity, status, due_date, pic_name, audits(school_id), locations(school_id)").is("deleted_at", null).gte("created_at", startDate(from)).lte("created_at", endDate(to)).order("created_at", { ascending: false }).limit(1000);
        if (error) throw error;
        return (data ?? []).filter((row) => {
          const audit = Array.isArray(row.audits) ? row.audits[0] : row.audits;
          const location = Array.isArray(row.locations) ? row.locations[0] : row.locations;
          return audit?.school_id === schoolId || location?.school_id === schoolId;
        }).map((row) => ({ Kode: row.finding_code, Kategori: row.category, Temuan: row.description, Keparahan: row.severity, Status: row.status, PIC: row.pic_name ?? "-", Tenggat: row.due_date ?? "-" }));
      }
      const { data, error } = await supabase.from("activities").select("activity_date, name, organizer, participant_count, waste_collected_kg, waste_utilized_kg, result, locations(name)").eq("school_id", schoolId).is("deleted_at", null).gte("activity_date", from).lte("activity_date", to).order("activity_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []).map((row) => { const location = Array.isArray(row.locations) ? row.locations[0] : row.locations; return { Tanggal: row.activity_date, Kegiatan: row.name, Lokasi: location?.name ?? "-", Penyelenggara: row.organizer ?? "-", Peserta: row.participant_count, "Terkumpul (kg)": Number(row.waste_collected_kg), "Dimanfaatkan (kg)": Number(row.waste_utilized_kg), Hasil: row.result ?? "" }; });
    },
  });

  const rows = reportQuery.data ?? [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const summary = useMemo(() => {
    const weightKeys = ["Berat (kg)", "Input (kg)", "Terkumpul (kg)"];
    const valueKeys = ["Total (Rp)", "Nilai ekonomi (Rp)"];
    const totalWeight = rows.reduce((total, row) => total + weightKeys.reduce((subtotal, key) => subtotal + (typeof row[key] === "number" ? row[key] as number : 0), 0), 0);
    const totalValue = rows.reduce((total, row) => total + valueKeys.reduce((subtotal, key) => subtotal + (typeof row[key] === "number" ? row[key] as number : 0), 0), 0);
    return { totalWeight, totalValue };
  }, [rows]);

  function exportCsv() {
    if (!columns.length) return toast.error("Tidak ada data untuk diekspor.");
    const content = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eco-school-${kind}-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Laporan" description="Laporan berbasis data sekolah untuk rentang tanggal terpilih">
      {!schoolId ? <div role="status" className="eco-surface mb-4 p-4 text-sm">{isSuperAdmin ? "Pilih sekolah di menu atas untuk melihat laporan terperinci." : "Akun belum terhubung ke sekolah."}</div> : null}
      <div className="print-hidden eco-surface mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(13rem,1fr)_minmax(12rem,1fr)_minmax(14rem,1.2fr)_auto_auto]">
        <div className="space-y-2"><Label htmlFor="report-type">Jenis laporan</Label><Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}><SelectTrigger id="report-type"><SelectValue /></SelectTrigger><SelectContent>{REPORTS.map((report) => <SelectItem key={report.value} value={report.value}>{report.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="report-from">Dari</Label><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="report-to">Sampai</Label><Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
        {["daily", "weekly", "monthly", "generated", "composition", "sources"].includes(kind) ? <div className="space-y-2"><Label htmlFor="report-category">Kategori</Label><Select value={category} onValueChange={setCategory}><SelectTrigger id="report-category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua kategori</SelectItem>{Object.entries(CATEGORY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div> : null}
        <Button variant="outline" className="self-end" onClick={exportCsv} disabled={!rows.length}><Download /> Excel (CSV)</Button>
        <Button variant="outline" className="self-end" onClick={() => window.print()} disabled={!rows.length}><Printer /> Cetak / PDF</Button>
      </div>
      <section className="eco-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4"><div><div className="flex items-center gap-2"><FileBarChart className="size-5 text-primary" /><h2 className="font-display text-base font-bold">{REPORTS.find((report) => report.value === kind)?.label}</h2></div><p className="mt-1 text-xs text-muted-foreground">{from} sampai {to} · {rows.length} baris</p></div><div className="text-right text-xs text-muted-foreground">{summary.totalWeight > 0 ? <p>Total berat: <strong className="text-foreground">{fmtKg(summary.totalWeight)}</strong></p> : null}{summary.totalValue > 0 ? <p>Total nilai: <strong className="text-foreground">{fmtRp(summary.totalValue)}</strong></p> : null}{kind === "audits" && rows.length ? <p>Nilai rata-rata tersedia pada setiap baris audit</p> : null}</div></div>
        {reportQuery.isError ? <div role="alert" className="py-8 text-center text-sm text-destructive">Laporan gagal dimuat. Periksa akses sekolah dan koneksi.</div> : reportQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat laporan...</p> : (
          <SchoolFolders
            records={rows.map((row, index) => ({ id: String(row.id ?? row.Transaksi ?? row.Kode ?? `${kind}-${index}`), school_id: schoolId }))}
            schools={schools}
            emptyMessage="Tidak ada data untuk rentang tanggal dan filter ini."
            renderRecord={(_, index) => (
              <article key={index} className="grid gap-3 border-b border-border/70 py-3 last:border-0 sm:grid-cols-2 xl:grid-cols-3">
                {columns.map((column) => (
                  <div key={column} className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">{column.replaceAll("_", " ")}</p>
                    <p className="break-words text-sm">{typeof rows[index][column] === "number" ? Number(rows[index][column]).toLocaleString("id-ID", { maximumFractionDigits: 2 }) : rows[index][column]}</p>
                  </div>
                ))}
              </article>
            )}
          />
        )}
      </section>
      <style>{`@media print { @page { size: landscape; margin: 12mm; } body { background: white !important; color: black !important; } .print-hidden, aside, header { display: none !important; } main { max-width: none !important; padding: 0 !important; } .eco-surface { border: 0 !important; box-shadow: none !important; } table { font-size: 9pt !important; } }`}</style>
    </AppShell>
  );
}
