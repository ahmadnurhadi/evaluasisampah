import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, Info, LoaderCircle, Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SchoolFolders } from "@/components/school-folders";
import { PhotoUpload } from "@/components/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";
import { invalidateWasteQueries } from "@/lib/query-invalidation";
import {
  listQueuedWasteGeneration,
  queueWasteGeneration,
  removeQueuedWasteGeneration,
  type WasteGenerationPayload,
} from "@/lib/offline-waste-queue";
import { CATEGORY_LABEL, CATEGORIES, STAGE_LABEL, fmtDateTime, fmtKg, type WasteCategory } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/input")({
  validateSearch: (search: Record<string, unknown>) => ({
    locationId: typeof search.locationId === "string" ? search.locationId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Input Sampah — Eco-School Waste Management" },
      { name: "description", content: "Catat jumlah sampah dan buat batch yang mudah dilacak." },
    ],
  }),
  component: WasteInput,
});

function localDateTime() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function MasterDataHint({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Info ${label}`}
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-center">
          <p>
            Belum ada pilihan {label}. Tambahkan dulu di menu{" "}
            <Link to="/master-data" className="font-semibold underline">
              Data Master
            </Link>
            , lalu kembali ke sini.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function WasteInput() {
  const { user, roles, canInputWaste: canRecord } = useAuthProfile();
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");
  const search = Route.useSearch();
  const isSuperAdmin = roles.includes("super_admin");
  const { schoolId: displaySchoolId, schools } = useSchoolScope();
  const profileSchoolId = user?.profile?.school_id ?? undefined;
  const [schoolName, setSchoolName] = useState("");
  const [locationId, setLocationId] = useState(search.locationId ?? "");
  const [sourceId, setSourceId] = useState("");
  const [category, setCategory] = useState<WasteCategory>("organic");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [weight, setWeight] = useState("");
  const [recordedAt, setRecordedAt] = useState(localDateTime);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const schoolsQuery = useQuery({
    queryKey: ["waste-input-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const typed = schoolName.trim().toLowerCase();
  const allSchools = schoolsQuery.data ?? [];
  const partial = typed ? allSchools.filter((school) => school.name.toLowerCase().includes(typed)) : [];
  const typedSchool =
    allSchools.find((school) => school.name.trim().toLowerCase() === typed) ??
    (partial.length === 1 ? partial[0] : undefined);
  // Unmatched names still record into the account's school so every module stays in sync.
  const schoolId = typedSchool?.id ?? profileSchoolId;
  const schoolUnmatched = Boolean(typed) && !typedSchool;
  const prefilledRef = useRef(false);

  const locationsQuery = useQuery({
    queryKey: ["waste-input-locations", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("school_id", schoolId!)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sourcesQuery = useQuery({
    queryKey: ["waste-input-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_sources")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const typesQuery = useQuery({
    queryKey: ["waste-input-types", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_types")
        .select("id, name, category")
        .eq("category", category)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const recentQuery = useQuery({
    queryKey: ["recent-waste-records", displaySchoolId, isSuperAdmin],
    enabled: Boolean(displaySchoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase
        .from("waste_records")
        .select("id, school_id, category, weight_kg, recorded_at, waste_batches(batch_code, stage)")
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false })
        .limit(1000);
      if (displaySchoolId) request = request.eq("school_id", displaySchoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (prefilledRef.current || !profileSchoolId) return;
    const own = schoolsQuery.data?.find((school) => school.id === profileSchoolId);
    if (own) {
      prefilledRef.current = true;
      setSchoolName(own.name);
    }
  }, [profileSchoolId, schoolName, schoolsQuery.data]);

  useEffect(() => {
    if (!locationId && search.locationId) setLocationId(search.locationId);
  }, [locationId, search.locationId]);

  useEffect(() => {
    const userId = user?.userId;
    if (!userId) return;
    let active = true;

    async function refreshPending() {
      const queued = await listQueuedWasteGeneration(userId!);
      if (active) setPendingCount(queued.length);
    }

    async function syncPending() {
      if (!navigator.onLine || syncingRef.current) return;
      syncingRef.current = true;
      setSyncMessage("");
      try {
        const queued = await listQueuedWasteGeneration(userId!);
        let synced = 0;
        for (const entry of queued) {
          const { error } = await supabase.rpc("record_waste_generation_v2", {
            p_request_id: entry.requestId,
            p_school_id: entry.schoolId,
            p_location_id: entry.locationId,
            p_source_id: entry.sourceId,
            p_category: entry.category,
            p_weight_kg: entry.weightKg,
            p_recorded_at: entry.recordedAt,
            p_waste_type_id: entry.wasteTypeId,
            p_photo_url: entry.photoUrl,
            p_notes: entry.notes,
          } as never);
          if (error) {
            setSyncMessage("Sebagian catatan belum tersinkron. Antrean akan dicoba lagi saat koneksi tersedia.");
            break;
          }
          await removeQueuedWasteGeneration(entry.requestId);
          synced += 1;
        }
        const remaining = await listQueuedWasteGeneration(userId!);
        if (active) setPendingCount(remaining.length);
        if (synced) {
          toast.success(`${synced} catatan offline berhasil disinkronkan.`);
          await invalidateWasteQueries(queryClient);
        }
      } catch {
        if (active) setSyncMessage("Antrean offline tidak dapat dibaca. Data tersimpan di perangkat.");
      } finally {
        syncingRef.current = false;
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      void syncPending();
    };
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    void refreshPending().then(() => syncPending());
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queryClient, schoolId, user?.userId]);

  useEffect(() => {
    if (wasteTypeId && !typesQuery.data?.some((item) => item.id === wasteTypeId)) {
      setWasteTypeId("");
    }
  }, [typesQuery.data, wasteTypeId]);

  const createRecord = useMutation({
    mutationFn: async (): Promise<{ queued: boolean; batchCode?: string }> => {
      if (!user?.userId || !schoolId || !locationId || !sourceId || !weight || !recordedAt) {
        throw new Error("Lengkapi sekolah, lokasi, sumber, waktu, dan berat sampah.");
      }
      const payload: WasteGenerationPayload = {
        requestId: crypto.randomUUID(),
        userId: user.userId,
        schoolId,
        locationId,
        sourceId,
        category,
        weightKg: Number(weight),
        recordedAt: new Date(recordedAt).toISOString(),
        wasteTypeId: wasteTypeId || null,
        photoUrl,
        notes:
          [schoolUnmatched ? `Sekolah (input manual): ${schoolName.trim()}` : "", notes.trim()]
            .filter(Boolean)
            .join(" · ") || null,
      };
      if (!Number.isFinite(payload.weightKg) || payload.weightKg <= 0) {
        throw new Error("Berat sampah harus lebih besar dari nol.");
      }
      if (!navigator.onLine) {
        await queueWasteGeneration(payload);
        return { queued: true };
      }
      const { data, error } = await supabase.rpc("record_waste_generation_v2", {
        p_request_id: payload.requestId,
        p_school_id: payload.schoolId,
        p_location_id: payload.locationId,
        p_source_id: payload.sourceId,
        p_category: payload.category,
        p_weight_kg: payload.weightKg,
        p_recorded_at: payload.recordedAt,
        p_waste_type_id: payload.wasteTypeId,
        p_photo_url: payload.photoUrl,
        p_notes: payload.notes,
      } as never);
      if (error) {
        if (!navigator.onLine || error.message.toLowerCase().includes("fetch")) {
          await queueWasteGeneration(payload);
          return { queued: true };
        }
        throw error;
      }
      const created = data?.[0];
      if (!created) throw new Error("Batch tidak berhasil dibuat.");
      return { queued: false, batchCode: created.batch_code };
    },
    onSuccess: async (result) => {
      if (result.queued) {
        const queued = user?.userId ? await listQueuedWasteGeneration(user.userId) : [];
        setPendingCount(queued.length);
        toast.success("Catatan disimpan di perangkat dan akan disinkronkan saat online.");
      } else {
        toast.success(`Sampah berhasil dicatat. ID batch ${result.batchCode}`);
      }
      setWeight("");
      setPhotoUrl(null);
      setNotes("");
      setRecordedAt(localDateTime());
      await invalidateWasteQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal mencatat sampah."),
  });

  const queryFailed =
    schoolsQuery.isError || locationsQuery.isError || sourcesQuery.isError || typesQuery.isError;

  return (
    <AppShell title="Input Sampah" description="Catat jumlah sampah dan buat batch yang dapat dilacak">
      {!isOnline || pendingCount > 0 || syncMessage ? (
        <div role="status" className="eco-surface mb-4 flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <p>{!isOnline ? "Offline: catatan baru disimpan di perangkat." : pendingCount ? `${pendingCount} catatan menunggu sinkronisasi.` : syncMessage}</p>
          {syncMessage ? <p className="text-xs text-muted-foreground">{syncMessage}</p> : null}
        </div>
      ) : null}
      {queryFailed ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">
          Data formulir gagal dimuat. Periksa koneksi atau akses akun, lalu muat ulang halaman.
        </div>
      ) : null}

      {!canRecord ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">
          Peran akun ini hanya dapat melihat data, bukan mencatat sampah.
        </div>
      ) : null}

      {!profileSchoolId && !isSuperAdmin ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">
          Akun belum terhubung ke sekolah. Minta administrator menetapkan sekolah sebelum mencatat data.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        {canRecord ? (
          <form
            className="eco-surface space-y-5 p-4 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              createRecord.mutate();
            }}
          >
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Scale className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold">Catatan sampah baru</h2>
                <p className="text-xs text-muted-foreground">Batch dan riwayat awal dibuat otomatis.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">Sekolah</Label>
              <Input
                id="school"
                list="school-names"
                required
                maxLength={200}
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                placeholder="Ketik nama sekolah"
                className="h-12"
              />
              <datalist id="school-names">
                {(schoolsQuery.data ?? []).map((school) => (
                  <option key={school.id} value={school.name} />
                ))}
              </datalist>
              {schoolUnmatched && !schoolsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Nama sekolah dicatat di keterangan; data tetap masuk ke sekolah akun Anda.</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Lokasi</Label>
                <Select value={locationId} onValueChange={setLocationId} disabled={!schoolId}>
                  <SelectTrigger id="location"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                  <SelectContent>
                    {(locationsQuery.data ?? []).map((location) => (
                      <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Sumber sampah</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger id="source"><SelectValue placeholder="Pilih sumber" /></SelectTrigger>
                  <SelectContent>
                    {(sourcesQuery.data ?? []).map((source) => (
                      <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as WasteCategory)}>
                  <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>{CATEGORY_LABEL[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waste-type">Jenis sampah</Label>
                <Select value={wasteTypeId || "none"} onValueChange={(value) => setWasteTypeId(value === "none" ? "" : value)}>
                  <SelectTrigger id="waste-type"><SelectValue placeholder="Pilih jenis (opsional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Jenis belum ditentukan</SelectItem>
                    {(typesQuery.data ?? []).map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weight">Berat aktual (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="0.001"
                  required
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder="0,000"
                  className="h-12 text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recorded-at">Tanggal dan waktu</Label>
                <Input
                  id="recorded-at"
                  type="datetime-local"
                  required
                  value={recordedAt}
                  onChange={(event) => setRecordedAt(event.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            <PhotoUpload value={photoUrl} onChange={setPhotoUrl} label="Foto bukti (opsional)" />

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Keterangan singkat"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full sm:w-auto"
              disabled={!canRecord || createRecord.isPending || queryFailed}
            >
              {createRecord.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
              Simpan dan buat batch
            </Button>
          </form>
        ) : null}

        <section className="eco-surface min-w-0 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="font-display text-base font-bold">Catatan terbaru</h2>
              <p className="text-xs text-muted-foreground">Catatan sampah dan batch di sekolah terpilih</p>
            </div>
            <Camera className="size-5 text-muted-foreground" />
          </div>

          {!displaySchoolId && !isSuperAdmin ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sekolah belum dipilih.</p>
          ) : recentQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat catatan...</p>
          ) : recentQuery.isError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">Catatan gagal dimuat.</p>
          ) : (
            <SchoolFolders records={recentQuery.data ?? []} schools={schools} emptyMessage="Belum ada sampah yang dicatat." getSummary={(records) => `${records.length} input · ${fmtKg(records.reduce((total, record) => total + Number(record.weight_kg), 0))}`}>
              {(recentQuery.data ?? []).map((record) => {
                const batch = Array.isArray(record.waste_batches)
                  ? record.waste_batches[0]
                  : record.waste_batches;
                return (
                  <div key={record.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{batch?.batch_code ?? "Batch belum tersedia"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {CATEGORY_LABEL[record.category]} · {fmtDateTime(record.recorded_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{fmtKg(Number(record.weight_kg))}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch?.stage ? STAGE_LABEL[batch.stage as keyof typeof STAGE_LABEL] : "Baru dicatat"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </SchoolFolders>
          )}
        </section>
      </div>
    </AppShell>
  );
}