import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LoaderCircle, Truck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PhotoUpload } from "@/components/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateWasteQueries } from "@/lib/query-invalidation";
import { STAGE_LABEL, fmtDateTime, fmtKg } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/collection")({
  head: () => ({
    meta: [
      { title: "Pengumpulan — Eco-School Waste Management" },
      { name: "description", content: "Catat pengumpulan sampah dari batch sekolah." },
    ],
  }),
  component: CollectionPage,
});

function localDateTime() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function CollectionPage() {
  const { user, roles, canRecord } = useAuthProfile();
  const queryClient = useQueryClient();
  const schoolId = user?.profile?.school_id ?? undefined;
  const isSuperAdmin = roles.includes("super_admin");
  const [batchId, setBatchId] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
  const [collectedAt, setCollectedAt] = useState(localDateTime);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const batchesQuery = useQuery({
    queryKey: ["collectable-batches", schoolId, isSuperAdmin],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase
        .from("waste_batches")
        .select("id, batch_code, initial_weight_kg, stage, locations(name)")
        .in("stage", ["generated", "collected"])
        .is("deleted_at", null)
        .order("generated_at", { ascending: true });
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const collectionsQuery = useQuery({
    queryKey: ["recent-collections", schoolId, isSuperAdmin],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase
        .from("waste_collections")
        .select("id, collected_at, estimated_weight_kg, actual_weight_kg, collector_name, waste_batches!inner(batch_code, school_id)")
        .is("deleted_at", null)
        .order("collected_at", { ascending: false })
        .limit(20);
      if (schoolId) request = request.eq("waste_batches.school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedBatch = batchesQuery.data?.find((batch) => batch.id === batchId);

  const saveCollection = useMutation({
    mutationFn: async () => {
      if (!batchId || !actualWeight || Number(actualWeight) <= 0) {
        throw new Error("Pilih batch dan masukkan berat aktual lebih besar dari nol.");
      }
      const { data, error } = await supabase.rpc("record_waste_collection", {
        p_batch_id: batchId,
        p_collected_at: new Date(collectedAt).toISOString(),
        p_actual_weight_kg: Number(actualWeight),
        p_estimated_weight_kg: estimatedWeight ? Number(estimatedWeight) : null,
        p_photo_url: photoUrl,
        p_notes: notes.trim() || null,
      } as never);
      if (error) throw error;
      if (!data) throw new Error("Pengumpulan tidak berhasil disimpan.");
      return data;
    },
    onSuccess: async () => {
      toast.success("Pengumpulan tercatat dan timeline batch diperbarui.");
      setBatchId("");
      setActualWeight("");
      setEstimatedWeight("");
      setCollectedAt(localDateTime());
      setPhotoUrl(null);
      setNotes("");
      await invalidateWasteQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal mencatat pengumpulan."),
  });

  return (
    <AppShell title="Pengumpulan" description="Timbang dan catat perpindahan batch">
      {!canRecord ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">
          Peran akun ini hanya dapat melihat data pengumpulan.
        </div>
      ) : null}
      {!schoolId && !isSuperAdmin ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">
          Akun belum terhubung ke sekolah.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]">
        {canRecord ? (
          <form
            className="eco-surface space-y-5 p-4 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              saveCollection.mutate();
            }}
          >
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Truck className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold">Catat pengumpulan</h2>
                <p className="text-xs text-muted-foreground">Batch dan berat total tervalidasi di database.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch">Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger id="batch"><SelectValue placeholder="Pilih batch yang dikumpulkan" /></SelectTrigger>
                <SelectContent>
                  {(batchesQuery.data ?? []).map((batch) => {
                    const location = Array.isArray(batch.locations) ? batch.locations[0] : batch.locations;
                    return (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.batch_code} · {location?.name ?? "Lokasi"} · {fmtKg(Number(batch.initial_weight_kg))}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedBatch ? (
                <p className="text-xs text-muted-foreground">
                  Tahap {STAGE_LABEL[selectedBatch.stage]}; berat awal {fmtKg(Number(selectedBatch.initial_weight_kg))}.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estimated">Berat perkiraan (kg)</Label>
                <Input
                  id="estimated"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  value={estimatedWeight}
                  onChange={(event) => setEstimatedWeight(event.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual">Berat aktual (kg)</Label>
                <Input
                  id="actual"
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  max={selectedBatch ? Number(selectedBatch.initial_weight_kg) : undefined}
                  step="0.001"
                  required
                  value={actualWeight}
                  onChange={(event) => setActualWeight(event.target.value)}
                  className="h-12 text-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collected-at">Tanggal dan waktu</Label>
              <Input
                id="collected-at"
                type="datetime-local"
                required
                value={collectedAt}
                onChange={(event) => setCollectedAt(event.target.value)}
              />
            </div>

            <PhotoUpload value={photoUrl} onChange={setPhotoUrl} label="Foto pengumpulan (opsional)" />

            <div className="space-y-2">
              <Label htmlFor="collection-notes">Catatan</Label>
              <textarea
                id="collection-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full sm:w-auto"
              disabled={!canRecord || !batchId || saveCollection.isPending || batchesQuery.isError}
            >
              {saveCollection.isPending ? <LoaderCircle className="animate-spin" /> : <Truck />}
              Simpan pengumpulan
            </Button>
          </form>
        ) : null}

        <section className="eco-surface min-w-0 p-4 sm:p-6">
          <div className="border-b border-border pb-4">
            <h2 className="font-display text-base font-bold">Pengumpulan terbaru</h2>
            <p className="text-xs text-muted-foreground">Riwayat timbang batch sekolah</p>
          </div>
          {collectionsQuery.isError ? (
            <p role="alert" className="py-8 text-sm text-destructive">Data pengumpulan gagal dimuat.</p>
          ) : collectionsQuery.isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Memuat pengumpulan...</p>
          ) : collectionsQuery.data?.length ? (
            <div className="divide-y divide-border">
              {collectionsQuery.data.map((collection) => {
                const batch = Array.isArray(collection.waste_batches)
                  ? collection.waste_batches[0]
                  : collection.waste_batches;
                return (
                  <div key={collection.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{batch?.batch_code ?? "Batch"}</p>
                      <p className="text-xs text-muted-foreground">
                        {collection.collector_name || "Petugas"} · {fmtDateTime(collection.collected_at)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold">{fmtKg(Number(collection.actual_weight_kg ?? 0))}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pengumpulan tercatat.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}