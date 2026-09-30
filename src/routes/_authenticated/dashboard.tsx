import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchDashboard, type DashboardFilters } from "@/lib/dashboard";
import { CATEGORIES, CATEGORY_LABEL, fmtKg, fmtPct, fmtRp, type WasteCategory } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Eco-School Waste Management" },
      { name: "description", content: "Ringkasan sampah yang dihasilkan, pemanfaatan, dan KPI sekolah." },
      { property: "og:title", content: "Dashboard Sampah Sekolah" },
      { property: "og:description", content: "KPI dan tren pengelolaan sampah sekolah." },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function isDatabaseSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "PGRST205" || code === "42P01" || /schema cache|could not find the table|does not exist/i.test(message);
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="eco-surface p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({ from: daysAgo(30), to: today() });

  const { data: masters } = useQuery({
    queryKey: ["dashboard-masters"],
    queryFn: async () => {
      const [{ data: locations }, { data: sources }] = await Promise.all([
        supabase.from("locations").select("id, name").is("deleted_at", null).order("name"),
        supabase.from("waste_sources").select("id, name").is("deleted_at", null).order("name"),
      ]);
      return { locations: locations ?? [], sources: sources ?? [] };
    },
  });

  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => fetchDashboard(filters),
  });
  const schemaUnavailable = isDatabaseSchemaError(error);

  return (
    <AppShell title="Dashboard" description="Ringkasan pengelolaan sampah sekolah">
      <div className="eco-surface mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Dari tanggal</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sampai tanggal</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Lokasi</Label>
          <Select
            value={filters.locationId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, locationId: v === "all" ? undefined : v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua lokasi</SelectItem>
              {(masters?.locations ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kategori</Label>
          <Select
            value={filters.category ?? "all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, category: v === "all" ? undefined : (v as WasteCategory) }))
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sumber</Label>
          <Select
            value={filters.sourceId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, sourceId: v === "all" ? undefined : v }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua sumber</SelectItem>
              {(masters?.sources ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <div role="alert" className="eco-surface flex flex-col items-start gap-3 p-5">
          <div>
            <h2 className="font-display text-sm font-bold">
              {schemaUnavailable ? "Database belum siap" : "Data dashboard gagal dimuat"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {schemaUnavailable
                ? "Tabel dashboard belum tersedia. Terapkan migrasi database Supabase, lalu coba lagi."
                : "Periksa koneksi internet dan akses akun, lalu coba muat ulang."}
            </p>
          </div>
          <Button variant="outline" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sampah dihasilkan" value={fmtKg(data.totalGenerated)} />
            <Kpi label="Organik" value={fmtKg(data.organic)} />
            <Kpi label="Anorganik" value={fmtKg(data.inorganic)} />
            <Kpi label="B3 / berbahaya" value={fmtKg(data.b3)} />
            <Kpi label="Residu tercatat" value={fmtKg(data.residualGenerated)} />
            <Kpi label="Diolah" value={fmtKg(data.processed)} />
            <Kpi label="Dimanfaatkan" value={fmtKg(data.utilized)} />
            <Kpi label="Didaur ulang" value={fmtKg(data.recycled)} />
            <Kpi label="Terjual" value={fmtKg(data.sold)} />
            <Kpi label="Dibuang ke TPA" value={fmtKg(data.disposed)} />
            <Kpi label="Pendapatan bank sampah" value={fmtRp(data.revenue)} />
            <Kpi label="Estimasi nilai ekonomi" value={fmtRp(data.economicValue)} />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Waste diversion rate" value={fmtPct(data.kpi.diversionRate)} />
            <Kpi label="Recycling rate" value={fmtPct(data.kpi.recyclingRate)} />
            <Kpi label="Organic processing rate" value={fmtPct(data.kpi.organicProcessingRate)} />
            <Kpi label="Residual rate" value={fmtPct(data.kpi.residualRate)} />
            <Kpi
              label="Pengurangan sampah"
              value={data.kpi.prevTotal > 0 ? fmtPct(data.kpi.reductionRate) : "Belum ada data"}
              hint={
                data.kpi.prevTotal > 0
                  ? `Periode sebelumnya ${fmtKg(data.kpi.prevTotal)}`
                  : "Belum tersedia periode pembanding"
              }
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="eco-surface p-4">
              <h2 className="mb-3 font-display text-sm font-bold">Sampah yang dihasilkan</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="weight"
                      name="Berat (kg)"
                      stroke="var(--color-chart-1)"
                      fill="var(--color-chart-1)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="eco-surface p-4">
              <h2 className="mb-3 font-display text-sm font-bold">Komposisi sampah</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.composition.map((c) => ({
                        name: CATEGORY_LABEL[c.category],
                        value: Number(c.weight.toFixed(2)),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label
                    >
                      {data.composition.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="eco-surface p-4">
              <h2 className="mb-3 font-display text-sm font-bold">Sumber sampah</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.bySource}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="weight" name="Berat (kg)" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="eco-surface p-4">
              <h2 className="mb-3 font-display text-sm font-bold">Pemanfaatan</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.utilization}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="weight" name="Berat (kg)" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
