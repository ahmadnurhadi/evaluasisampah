import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Boxes, Clock3, MapPin, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_LABEL,
  STAGE_LABEL,
  fmtDateTime,
  fmtKg,
  fmtRp,
  type BatchStage,
  type WasteCategory,
} from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/batches")({
  head: () => ({
    meta: [
      { title: "Batch Sampah — Eco-School Waste Management" },
      { name: "description", content: "Telusuri sumber, status, dan lini masa setiap batch sampah." },
    ],
  }),
  component: BatchesPage,
});

const STAGES = Object.keys(STAGE_LABEL) as BatchStage[];

function BatchesPage() {
  const { user, roles } = useAuthProfile();
  const schoolId = user?.profile?.school_id ?? undefined;
  const canViewAll = roles.includes("super_admin");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");

  const batchesQuery = useQuery({
    queryKey: ["waste-batches", schoolId, canViewAll],
    enabled: Boolean(schoolId) || canViewAll,
    queryFn: async () => {
      let request = supabase
        .from("waste_batches")
        .select("id, batch_code, initial_weight_kg, stage, generated_at, collected_at, notes, locations(name), waste_sources(name), waste_records(category, weight_kg, recorded_at), waste_movements(id, stage, description, weight_kg, occurred_at), waste_collections(id, actual_weight_kg, collected_at, collector_name), waste_sorting(id, category, weight_kg, sorted_at), waste_processing(id, method, input_weight_kg, output_weight_kg, processed_at), waste_utilization(id, utilization_type, weight_kg, used_at), waste_sales(id, transaction_code, weight_kg, total_value, sold_at), residual_disposals(id, weight_kg, destination, disposed_at)")
        .is("deleted_at", null)
        .order("generated_at", { ascending: false })
        .limit(100);
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const visibleBatches = useMemo(
    () =>
      (batchesQuery.data ?? []).filter((batch) => {
        const matchesSearch = batch.batch_code.toLowerCase().includes(search.trim().toLowerCase());
        return matchesSearch && (stage === "all" || batch.stage === stage);
      }),
    [batchesQuery.data, search, stage],
  );

  return (
    <AppShell title="Batch Sampah" description="Telusuri perjalanan sampah berdasarkan batch">
      <div className="eco-surface mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari ID batch"
            className="pl-9"
            aria-label="Cari ID batch"
          />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger aria-label="Filter tahap"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tahap</SelectItem>
            {STAGES.map((value) => (
              <SelectItem key={value} value={value}>{STAGE_LABEL[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {batchesQuery.isError ? (
        <div role="alert" className="eco-surface p-5 text-sm">
          Data batch gagal dimuat. Periksa koneksi dan akses sekolah Anda, lalu muat ulang halaman.
        </div>
      ) : batchesQuery.isLoading ? (
        <div className="eco-surface p-6 text-sm text-muted-foreground">Memuat batch...</div>
      ) : !schoolId && !canViewAll ? (
        <div className="eco-surface p-6 text-sm text-muted-foreground">
          Akun belum terhubung ke sekolah.
        </div>
      ) : visibleBatches.length === 0 ? (
        <div className="eco-surface flex flex-col items-center p-10 text-center">
          <Boxes className="size-8 text-muted-foreground" />
          <h2 className="mt-3 font-display font-bold">Belum ada batch yang cocok</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Batch baru akan muncul setelah sampah dicatat.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleBatches.map((batch) => {
            const timeline = [
              ...(batch.waste_movements ?? []).map((movement) => ({
                id: `movement-${movement.id}`,
                title: STAGE_LABEL[movement.stage],
                date: movement.occurred_at,
                detail: movement.description ?? "Perubahan tahap batch",
                weight: movement.weight_kg,
              })),
              ...(batch.waste_collections ?? []).map((collection) => ({
                id: `collection-${collection.id}`,
                title: "Berat dikumpulkan",
                date: collection.collected_at,
                detail: collection.collector_name ?? "Petugas",
                weight: collection.actual_weight_kg,
              })),
              ...(batch.waste_sorting ?? []).map((sorting) => ({
                id: `sorting-${sorting.id}`,
                title: `Dipilah · ${CATEGORY_LABEL[sorting.category]}`,
                date: sorting.sorted_at,
                detail: "Hasil pemilahan batch",
                weight: sorting.weight_kg,
              })),
              ...(batch.waste_processing ?? []).map((processing) => ({
                id: `processing-${processing.id}`,
                title: `Diolah · ${processing.method}`,
                date: processing.processed_at,
                detail: `Output ${fmtKg(Number(processing.output_weight_kg))}`,
                weight: processing.input_weight_kg,
              })),
              ...(batch.waste_utilization ?? []).map((utilization) => ({
                id: `utilization-${utilization.id}`,
                title: `Dimanfaatkan · ${utilization.utilization_type}`,
                date: utilization.used_at,
                detail: "Pemanfaatan tercatat",
                weight: utilization.weight_kg,
              })),
              ...(batch.waste_sales ?? []).map((sale) => ({
                id: `sale-${sale.id}`,
                title: `Dijual · ${sale.transaction_code}`,
                date: sale.sold_at,
                detail: fmtRp(Number(sale.total_value ?? 0)),
                weight: sale.weight_kg,
              })),
              ...(batch.residual_disposals ?? []).map((disposal) => ({
                id: `disposal-${disposal.id}`,
                title: "Residu dibuang",
                date: disposal.disposed_at,
                detail: disposal.destination ?? "Tujuan tidak diisi",
                weight: disposal.weight_kg,
              })),
            ].sort((left, right) => left.date.localeCompare(right.date));
            const records = batch.waste_records ?? [];
            const location = Array.isArray(batch.locations) ? batch.locations[0] : batch.locations;
            const source = Array.isArray(batch.waste_sources)
              ? batch.waste_sources[0]
              : batch.waste_sources;

            return (
              <article key={batch.id} className="eco-surface overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-bold">{batch.batch_code}</h2>
                      <Badge variant="secondary">{STAGE_LABEL[batch.stage]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dibuat {fmtDateTime(batch.generated_at)}
                    </p>
                  </div>
                  <p className="font-display text-lg font-bold">{fmtKg(Number(batch.initial_weight_kg))}</p>
                </div>

                <div className="grid gap-2 border-b border-border px-4 py-3 text-sm sm:grid-cols-3 sm:px-5">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 shrink-0" /> {location?.name ?? "Lokasi tidak tersedia"}
                  </p>
                  <p className="truncate text-muted-foreground">Sumber: {source?.name ?? "Tidak diisi"}</p>
                  <p className="text-muted-foreground">
                    {records.map((record) => CATEGORY_LABEL[record.category as WasteCategory]).join(", ") || "Kategori belum dicatat"}
                  </p>
                </div>

                <div className="p-4 sm:p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Clock3 className="size-4" /> Riwayat batch
                  </h3>
                  {timeline.length ? (
                    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {timeline.map((event, index) => (
                        <li key={event.id} className="relative flex gap-3">
                          <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{fmtDateTime(event.date)}</p>
                            {event.detail ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                            ) : null}
                            {event.weight !== null ? (
                              <p className="mt-0.5 text-xs">{fmtKg(Number(event.weight))}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum ada riwayat pergerakan.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}