import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarHeart, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EvidenceImage } from "@/components/evidence-image";
import { PhotoUpload } from "@/components/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";
import { invalidateActivityQueries } from "@/lib/query-invalidation";
import { fmtDate, fmtKg } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/activities")({
  head: () => ({ meta: [{ title: "Kegiatan Lingkungan — Eco-School Waste Management" }] }),
  component: ActivitiesPage,
});

function ActivitiesPage() {
  const { user, canRecord } = useAuthProfile();
  const queryClient = useQueryClient();
  const { schoolId, isSuperAdmin } = useSchoolScope();
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState("");
  const [organizer, setOrganizer] = useState(user?.profile?.full_name ?? "");
  const [participants, setParticipants] = useState("");
  const [wasteCollected, setWasteCollected] = useState("0");
  const [wasteUtilized, setWasteUtilized] = useState("0");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});


  const locationsQuery = useQuery({
    queryKey: ["activity-locations", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name").eq("school_id", schoolId!).is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const activitiesQuery = useQuery({
    queryKey: ["environmental-activities", schoolId],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase.from("activities")
        .select("id, name, activity_date, organizer, participant_count, waste_collected_kg, waste_utilized_kg, description, result, photo_url, locations(name), activity_participants(id, name)")
        .is("deleted_at", null).order("activity_date", { ascending: false }).limit(100);
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createActivity = useMutation({
    mutationFn: async () => {
      const collected = Number(wasteCollected);
      const utilized = Number(wasteUtilized);
      if (!schoolId || !name.trim()) throw new Error("Pilih sekolah dan isi nama kegiatan.");
      if (!Number.isFinite(collected) || collected < 0 || !Number.isFinite(utilized) || utilized < 0 || utilized > collected) {
        throw new Error("Berat harus valid dan dimanfaatkan tidak boleh melebihi terkumpul.");
      }
      const participantNames = participants.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean);
      const { data, error } = await supabase.rpc("record_environmental_activity", {
        p_school_id: schoolId,
        p_name: name.trim(),
        p_activity_date: date,
        p_location_id: locationId || null,
        p_organizer: organizer.trim() || null,
        p_participants: participantNames,
        p_waste_collected_kg: collected,
        p_waste_utilized_kg: utilized,
        p_photo_url: photoUrl,
        p_description: description.trim() || null,
        p_result: result.trim() || null,
      } as never);
      if (error) throw error;
      if (!data) throw new Error("Kegiatan tidak berhasil disimpan.");
      return data;
    },
    onSuccess: async () => {
      toast.success("Kegiatan lingkungan tersimpan.");
      setName(""); setParticipants(""); setWasteCollected("0"); setWasteUtilized("0");
      setDescription(""); setResult(""); setPhotoUrl(null);
      await invalidateActivityQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal menyimpan kegiatan."),
  });

  const saveResult = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase.from("activities").update({ result: resultDrafts[activityId]?.trim() || null }).eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hasil kegiatan diperbarui.");
      return invalidateActivityQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Hasil kegiatan gagal diperbarui."),
  });

  const archiveActivity = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => invalidateActivityQueries(queryClient),
    onError: (error) => toast.error(error.message || "Kegiatan gagal diarsipkan."),
  });

  return (
    <AppShell title="Kegiatan Lingkungan" description="Catat partisipasi dan dampak kegiatan sekolah">
      {!schoolId && !isSuperAdmin ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Akun belum terhubung ke sekolah.</div> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        {canRecord ? (
          <form className="eco-surface space-y-4 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); createActivity.mutate(); }}>
            <div className="flex items-center gap-2"><CalendarHeart className="size-5 text-primary" /><h2 className="font-display font-bold">Kegiatan baru</h2></div>
            <div className="space-y-2"><Label htmlFor="activity-name">Nama kegiatan</Label><Input id="activity-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Jumat Bersih" /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="activity-date">Tanggal</Label><Input id="activity-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="activity-organizer">Penyelenggara</Label><Input id="activity-organizer" value={organizer} onChange={(event) => setOrganizer(event.target.value)} /></div></div>
            <div className="space-y-2"><Label htmlFor="activity-location">Lokasi (opsional)</Label><Select value={locationId || "none"} onValueChange={(value) => setLocationId(value === "none" ? "" : value)}><SelectTrigger id="activity-location"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger><SelectContent><SelectItem value="none">Lokasi umum sekolah</SelectItem>{(locationsQuery.data ?? []).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="activity-participants">Peserta</Label><textarea id="activity-participants" value={participants} onChange={(event) => setParticipants(event.target.value)} rows={3} placeholder="Satu nama per baris atau pisahkan dengan koma" className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /><p className="text-xs text-muted-foreground">{participants.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean).length} peserta</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="activity-collected">Sampah dikumpulkan (kg)</Label><Input id="activity-collected" type="number" min="0" step="0.001" value={wasteCollected} onChange={(event) => setWasteCollected(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="activity-utilized">Sampah dimanfaatkan (kg)</Label><Input id="activity-utilized" type="number" min="0" step="0.001" value={wasteUtilized} onChange={(event) => setWasteUtilized(event.target.value)} /></div></div>
            <div className="space-y-2"><Label htmlFor="activity-description">Deskripsi</Label><textarea id="activity-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <div className="space-y-2"><Label htmlFor="activity-result">Hasil</Label><textarea id="activity-result" value={result} onChange={(event) => setResult(event.target.value)} rows={2} maxLength={1500} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <PhotoUpload value={photoUrl} onChange={setPhotoUrl} label="Foto kegiatan (opsional)" />
            <Button type="submit" size="lg" className="h-12 w-full" disabled={createActivity.isPending || !schoolId || locationsQuery.isError}>{createActivity.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}Simpan kegiatan</Button>
          </form>
        ) : null}
        <section className="eco-surface min-w-0 p-4 sm:p-6"><div className="border-b border-border pb-4"><h2 className="font-display text-base font-bold">Riwayat kegiatan</h2><p className="text-xs text-muted-foreground">Kegiatan dan peserta yang tercatat</p></div>{activitiesQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Kegiatan gagal dimuat.</p> : activitiesQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Memuat kegiatan...</p> : activitiesQuery.data?.length ? <div className="divide-y divide-border">{activitiesQuery.data.map((activity) => { const location = Array.isArray(activity.locations) ? activity.locations[0] : activity.locations; return <article key={activity.id} className="space-y-3 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-display font-bold">{activity.name}</h3><p className="text-xs text-muted-foreground">{fmtDate(activity.activity_date)} · {location?.name ?? "Area sekolah"} · {activity.organizer ?? "Penyelenggara"}</p></div><div className="text-right"><p className="text-sm font-semibold">{activity.participant_count} peserta</p><p className="text-xs text-muted-foreground">{fmtKg(Number(activity.waste_collected_kg))} terkumpul · {fmtKg(Number(activity.waste_utilized_kg))} dimanfaatkan</p></div></div>{activity.photo_url ? <EvidenceImage path={activity.photo_url} className="h-36 w-full rounded-md object-cover sm:w-56" alt={`Foto kegiatan ${activity.name}`} /> : null}{activity.description ? <p className="text-sm text-muted-foreground">{activity.description}</p> : null}<div className="flex flex-col gap-2 sm:flex-row">{canRecord ? <><Input aria-label={`Hasil kegiatan ${activity.name}`} value={resultDrafts[activity.id] ?? activity.result ?? ""} onChange={(event) => setResultDrafts((current) => ({ ...current, [activity.id]: event.target.value }))} placeholder="Hasil kegiatan" /><Button variant="outline" size="sm" disabled={saveResult.isPending} onClick={() => saveResult.mutate(activity.id)}><Save /> Simpan hasil</Button><Button variant="ghost" size="icon" title="Arsipkan kegiatan" aria-label={`Arsipkan ${activity.name}`} disabled={archiveActivity.isPending} onClick={() => archiveActivity.mutate(activity.id)}><Trash2 /></Button></> : <p className="text-sm">{activity.result || "Hasil belum dicatat"}</p>}</div>{activity.activity_participants.length ? <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Lihat peserta ({activity.activity_participants.length})</summary><p className="mt-2 text-xs text-muted-foreground">{activity.activity_participants.map((participant) => participant.name).join(", ")}</p></details> : null}</article>; })}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Belum ada kegiatan.</p>}</section>
      </div>
    </AppShell>
  );
}
