import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SchoolFolders } from "@/components/school-folders";
import { PhotoUpload } from "@/components/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAuditQueries } from "@/lib/query-invalidation";
import { fmtDate, fmtPct } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({ meta: [{ title: "Audit Lingkungan — Eco-School Waste Management" }] }),
  component: AuditsPage,
});

function AuditsPage() {
  const { user, isManager } = useAuthProfile();
  const queryClient = useQueryClient();
  const { schoolId, schools, isSuperAdmin } = useSchoolScope();
  const [locationId, setLocationId] = useState("");
  const [auditorName, setAuditorName] = useState(user?.profile?.full_name ?? "");
  const [auditedAt, setAuditedAt] = useState(new Date().toISOString().slice(0, 10));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [scoreNotes, setScoreNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user?.profile?.full_name && !auditorName) setAuditorName(user.profile.full_name);
  }, [auditorName, user?.profile?.full_name]);

  const locationsQuery = useQuery({
    queryKey: ["audit-locations", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name").eq("school_id", schoolId!).is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const indicatorsQuery = useQuery({
    queryKey: ["audit-indicators", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      let request = supabase.from("audit_indicators").select("id, name, description, weight, max_score").eq("active", true).order("name");
      if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });
  const auditsQuery = useQuery({
    queryKey: ["environmental-audits", schoolId],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase.from("audits")
        .select("id, school_id, audited_at, auditor_name, total_score, notes, locations(name)")
        .is("deleted_at", null).order("audited_at", { ascending: false }).limit(1000);
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const indicators = indicatorsQuery.data ?? [];
  const computedScore = useMemo(() => {
    const totalWeight = indicators.reduce((total, item) => total + Number(item.weight), 0);
    if (!totalWeight) return 0;
    const scoreTotal = indicators.reduce((total, item) => {
      return total + ((Number(scores[item.id]) || 0) / item.max_score) * 100 * Number(item.weight);
    }, 0);
    return scoreTotal / totalWeight;
  }, [indicators, scores]);

  const saveAudit = useMutation({
    mutationFn: async () => {
      if (!schoolId || !locationId || !auditorName.trim()) throw new Error("Pilih sekolah, lokasi, dan nama auditor.");
      if (!indicators.length) throw new Error("Belum ada indikator audit aktif.");
      if (indicators.some((indicator) => scores[indicator.id] === "" || scores[indicator.id] === undefined)) {
        throw new Error("Isi skor untuk setiap indikator audit.");
      }
      const payload = indicators.map((indicator) => ({
        indicator_id: indicator.id,
        score: Number(scores[indicator.id]),
        note: scoreNotes[indicator.id]?.trim() || null,
      }));
      const { data, error } = await supabase.rpc("record_environmental_audit", {
        p_school_id: schoolId,
        p_location_id: locationId,
        p_audited_at: auditedAt,
        p_auditor_name: auditorName.trim(),
        p_scores: payload,
        p_photo_url: photoUrl,
        p_notes: notes.trim() || null,
      } as never);
      if (error) throw error;
      if (!data?.[0]) throw new Error("Audit gagal disimpan.");
      return data[0];
    },
    onSuccess: async (result) => {
      toast.success(`Audit tersimpan dengan skor ${fmtPct(result.total_score)}.`);
      setScores({});
      setScoreNotes({});
      setNotes("");
      setPhotoUrl(null);
      await invalidateAuditQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal menyimpan audit."),
  });
  const archiveAudit = useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase.from("audits").update({ deleted_at: new Date().toISOString() }).eq("id", auditId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAuditQueries(queryClient),
    onError: (error) => toast.error(error.message || "Audit gagal diarsipkan."),
  });

  return (
    <AppShell title="Audit Lingkungan" description="Nilai kondisi sekolah berdasarkan indikator terukur">
      {!isManager ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Pembuatan audit hanya tersedia untuk pengelola sekolah.</div> : null}
      {!schoolId && !isSuperAdmin ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Akun belum terhubung ke sekolah.</div> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        {isManager ? (
          <form className="eco-surface space-y-5 p-4 sm:p-6" onSubmit={(event) => { event.preventDefault(); saveAudit.mutate(); }}>
            <div className="flex items-center gap-3 border-b border-border pb-4"><span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><ClipboardCheck className="size-5" /></span><div><h2 className="font-display text-base font-bold">Audit baru</h2><p className="text-xs text-muted-foreground">{indicators.length} indikator aktif · skor berbobot {fmtPct(computedScore)}</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="audit-location">Lokasi</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger id="audit-location"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger><SelectContent>{(locationsQuery.data ?? []).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="audit-date">Tanggal audit</Label><Input id="audit-date" type="date" required value={auditedAt} onChange={(event) => setAuditedAt(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="auditor-name">Auditor</Label><Input id="auditor-name" required value={auditorName} onChange={(event) => setAuditorName(event.target.value)} /></div>
            {indicatorsQuery.isLoading ? <p className="text-sm text-muted-foreground">Memuat indikator...</p> : indicators.map((indicator) => <div key={indicator.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_7rem]"><div><Label htmlFor={`score-${indicator.id}`}>{indicator.name} · bobot {indicator.weight}</Label>{indicator.description ? <p className="mt-1 text-xs text-muted-foreground">{indicator.description}</p> : null}<Input className="mt-2" placeholder="Catatan indikator" value={scoreNotes[indicator.id] ?? ""} onChange={(event) => setScoreNotes((current) => ({ ...current, [indicator.id]: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor={`score-${indicator.id}`}>Skor / {indicator.max_score}</Label><Input id={`score-${indicator.id}`} type="number" inputMode="decimal" min="0" max={indicator.max_score} step="0.1" required value={scores[indicator.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [indicator.id]: event.target.value }))} /></div></div>)}
            <PhotoUpload value={photoUrl} onChange={setPhotoUrl} label="Foto bukti (opsional)" />
            <div className="space-y-2"><Label htmlFor="audit-notes">Catatan umum</Label><textarea id="audit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={!isManager || !schoolId || !locationId || saveAudit.isPending || indicatorsQuery.isError || locationsQuery.isError}><span>{saveAudit.isPending ? <LoaderCircle className="animate-spin" /> : <ClipboardCheck />}</span>Simpan audit · {fmtPct(computedScore)}</Button>
          </form>
        ) : null}
        <section className="eco-surface min-w-0 p-4 sm:p-6">
          <div className="border-b border-border pb-4"><h2 className="font-display text-base font-bold">Riwayat audit</h2><p className="text-xs text-muted-foreground">Audit tersimpan menurut sekolah</p></div>
          {auditsQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Riwayat audit gagal dimuat.</p> : auditsQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Memuat audit...</p> : (
            <SchoolFolders records={auditsQuery.data ?? []} schools={schools} emptyMessage="Belum ada audit tercatat.">
              {(auditsQuery.data ?? []).map((audit) => {
                const location = Array.isArray(audit.locations) ? audit.locations[0] : audit.locations;
                return <article key={audit.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{location?.name ?? "Lokasi"}</p><p className="text-xs text-muted-foreground">{audit.auditor_name || "Auditor"} · {fmtDate(audit.audited_at)}</p></div><div className="flex shrink-0 items-center gap-2"><p className="font-display text-lg font-bold">{fmtPct(Number(audit.total_score))}</p>{isManager ? <Button variant="ghost" size="icon" title="Arsipkan audit" aria-label={`Arsipkan audit ${fmtDate(audit.audited_at)}`} disabled={archiveAudit.isPending} onClick={() => archiveAudit.mutate(audit.id)}><Trash2 /></Button> : null}</div></article>;
              })}
            </SchoolFolders>
          )}
        </section>
      </div>
    </AppShell>
  );
}
