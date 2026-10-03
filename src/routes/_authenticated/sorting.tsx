import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LoaderCircle, Plus, SplitSquareHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";
import { invalidateWasteQueries } from "@/lib/query-invalidation";
import { CATEGORY_LABEL, CATEGORIES, fmtKg, type WasteCategory } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/sorting")({
  head: () => ({
    meta: [
      { title: "Pemilahan — Eco-School Waste Management" },
      { name: "description", content: "Pilah batch sampah dengan validasi massa dan persentase otomatis." },
    ],
  }),
  component: SortingPage,
});

type SortLine = { id: number; category: WasteCategory; wasteTypeId: string; weight: string };
const EMPTY_LINE = (): SortLine => ({ id: Date.now() + Math.random(), category: "organic", wasteTypeId: "", weight: "" });

function SortingPage() {
  const { canRecord } = useAuthProfile();
  const queryClient = useQueryClient();
  const { schoolId, isSuperAdmin } = useSchoolScope();
  const [batchId, setBatchId] = useState("");
  const [lines, setLines] = useState<SortLine[]>([EMPTY_LINE()]);
  const [notes, setNotes] = useState("");

  const batchesQuery = useQuery({
    queryKey: ["sortable-batches", schoolId],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase
        .from("waste_batches")
        .select("id, batch_code, initial_weight_kg, stage, waste_sorting(id), waste_collections(actual_weight_kg)")
        .in("stage", ["collected", "weighed"])
        .is("deleted_at", null)
        .order("generated_at", { ascending: true });
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).filter((batch) =>
        batch.waste_sorting.length === 0 && batch.waste_collections.length > 0,
      );
    },
  });

  const typesQuery = useQuery({
    queryKey: ["sorting-waste-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_types")
        .select("id, name, category")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedBatch = batchesQuery.data?.find((batch) => batch.id === batchId);
  const sortedTotal = useMemo(
    () => lines.reduce((total, line) => total + (Number(line.weight) || 0), 0),
    [lines],
  );
  const availableWeight = (selectedBatch?.waste_collections ?? []).reduce(
    (total, collection) => total + Number(collection.actual_weight_kg ?? 0),
    0,
  );
  const isOverweight = sortedTotal > availableWeight + 0.001;

  const saveSorting = useMutation({
    mutationFn: async () => {
      if (!selectedBatch) throw new Error("Pilih batch yang akan dipilah.");
      if (lines.some((line) => !line.weight || Number(line.weight) <= 0)) {
        throw new Error("Masukkan berat lebih besar dari nol untuk setiap kategori.");
      }
      if (isOverweight) throw new Error("Total pilahan melebihi berat awal batch.");
      const { data, error } = await supabase.rpc("record_waste_sorting", {
        p_batch_id: batchId,
        p_items: lines.map((line) => ({
          category: line.category,
          waste_type_id: line.wasteTypeId || null,
          weight_kg: Number(line.weight),
        })),
        p_notes: notes.trim() || null,
      } as never);
      if (error) throw error;
      if (!data) throw new Error("Hasil pilahan tidak berhasil disimpan.");
      return data;
    },
    onSuccess: async (count) => {
      toast.success(`${count} kategori hasil pilahan tersimpan.`);
      setBatchId("");
      setLines([EMPTY_LINE()]);
      setNotes("");
      await invalidateWasteQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal menyimpan hasil pilahan."),
  });

  return (
    <AppShell title="Pemilahan" description="Pecah batch menjadi kategori yang dapat ditelusuri">
      {!canRecord ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">Peran akun ini hanya dapat melihat data pemilahan.</div>
      ) : null}
      {!schoolId && !isSuperAdmin ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">Akun belum terhubung ke sekolah.</div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        {canRecord ? (
          <form
            className="eco-surface space-y-5 p-4 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              saveSorting.mutate();
            }}
          >
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <SplitSquareHorizontal className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold">Hasil pemilahan</h2>
                <p className="text-xs text-muted-foreground">Persentase dihitung dari berat batch awal.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sorting-batch">Batch yang sudah dikumpulkan</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger id="sorting-batch"><SelectValue placeholder="Pilih batch" /></SelectTrigger>
                <SelectContent>
                  {(batchesQuery.data ?? []).map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.batch_code} · {fmtKg(batch.waste_collections.reduce((total, collection) => total + Number(collection.actual_weight_kg ?? 0), 0))} terkumpul
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lines.map((line, index) => {
              const percent = availableWeight ? ((Number(line.weight) || 0) / availableWeight) * 100 : 0;
              const categoryTypes = (typesQuery.data ?? []).filter((type) => type.category === line.category);
              return (
                <div key={line.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(7rem,0.8fr)_2.5rem]">
                  <div className="space-y-2">
                    <Label htmlFor={`sort-category-${line.id}`}>Kategori {index + 1}</Label>
                    <Select
                      value={line.category}
                      onValueChange={(value) => setLines((current) => current.map((item) =>
                        item.id === line.id ? { ...item, category: value as WasteCategory, wasteTypeId: "" } : item,
                      ))}
                    >
                      <SelectTrigger id={`sort-category-${line.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((value) => (
                          <SelectItem key={value} value={value}>{CATEGORY_LABEL[value]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`sort-type-${line.id}`}>Jenis</Label>
                    <Select
                      value={line.wasteTypeId || "none"}
                      onValueChange={(value) => setLines((current) => current.map((item) =>
                        item.id === line.id ? { ...item, wasteTypeId: value === "none" ? "" : value } : item,
                      ))}
                    >
                      <SelectTrigger id={`sort-type-${line.id}`}><SelectValue placeholder="Opsional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belum ditentukan</SelectItem>
                        {categoryTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`sort-weight-${line.id}`}>Berat (kg)</Label>
                    <Input
                      id={`sort-weight-${line.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0.001"
                      step="0.001"
                      required
                      value={line.weight}
                      onChange={(event) => setLines((current) => current.map((item) =>
                        item.id === line.id ? { ...item, weight: event.target.value } : item,
                      ))}
                    />
                    <p className="text-[11px] text-muted-foreground">{percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</p>
                  </div>
                  <div className="flex items-end justify-center pb-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Hapus kategori"
                      aria-label={`Hapus kategori ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, EMPTY_LINE()])}>
              <Plus /> Tambah kategori
            </Button>

            <div className={`rounded-md border p-3 ${isOverweight ? "border-destructive bg-destructive/5" : "border-border bg-muted/30"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">Total hasil pilahan</p>
                <p className="font-display text-lg font-bold">{fmtKg(sortedTotal)}</p>
              </div>
              <p className={`mt-1 text-xs ${isOverweight ? "text-destructive" : "text-muted-foreground"}`}>
                Batas berat terkumpul {fmtKg(availableWeight)}
                {isOverweight ? " · total melebihi batas" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sorting-notes">Catatan</Label>
              <textarea
                id="sorting-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={1000}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full sm:w-auto"
              disabled={!canRecord || !selectedBatch || isOverweight || saveSorting.isPending || batchesQuery.isError}
            >
              {saveSorting.isPending ? <LoaderCircle className="animate-spin" /> : <SplitSquareHorizontal />}
              Simpan hasil pemilahan
            </Button>
          </form>
        ) : null}

        <aside className="eco-surface h-fit p-4 sm:p-6">
          <h2 className="font-display text-base font-bold">Validasi massa</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Setiap kategori disimpan sebagai bagian dari batch yang sama. Total seluruh kategori tidak boleh melampaui berat awal.
          </p>
          {batchesQuery.isError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">Daftar batch gagal dimuat.</p>
          ) : batchesQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Memuat batch...</p>
          ) : (batchesQuery.data ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Tidak ada batch terkumpul yang menunggu pemilahan.</p>
          ) : (
            <p className="mt-4 text-sm font-medium">{batchesQuery.data?.length} batch menunggu dipilah.</p>
          )}
          {typesQuery.isError ? (
            <p role="alert" className="mt-2 text-xs text-destructive">Daftar jenis sampah gagal dimuat.</p>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}