import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EvidenceImage } from "@/components/evidence-image";
import { PhotoUpload } from "@/components/photo-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAuditQueries } from "@/lib/query-invalidation";
import { FINDING_STATUS_LABEL, SEVERITY_LABEL, fmtDate, type FindingStatus, type Severity } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/findings")({
  head: () => ({ meta: [{ title: "Temuan dan Tindakan — Eco-School Waste Management" }] }),
  component: FindingsPage,
});

const STATUSES = Object.keys(FINDING_STATUS_LABEL) as FindingStatus[];
const SEVERITIES = Object.keys(SEVERITY_LABEL) as Severity[];

function FindingsPage() {
  const { canRecord, isManager } = useAuthProfile();
  const queryClient = useQueryClient();
  const { schoolId: activeSchoolId, isSuperAdmin } = useSchoolScope();
  const [locationId, setLocationId] = useState("");
  const [auditId, setAuditId] = useState("");
  const [category, setCategory] = useState("kebersihan");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [recommendation, setRecommendation] = useState("");
  const [picName, setPicName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [planFindingId, setPlanFindingId] = useState("");
  const [planAction, setPlanAction] = useState("");
  const [planPic, setPlanPic] = useState("");
  const [planDueDate, setPlanDueDate] = useState("");


  const locationsQuery = useQuery({
    queryKey: ["finding-locations", activeSchoolId],
    enabled: Boolean(activeSchoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name").eq("school_id", activeSchoolId!).is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const auditsQuery = useQuery({
    queryKey: ["finding-audits", activeSchoolId],
    enabled: Boolean(activeSchoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("audits").select("id, audited_at, locations(name)").eq("school_id", activeSchoolId!).is("deleted_at", null).order("audited_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const findingsQuery = useQuery({
    queryKey: ["audit-findings", activeSchoolId],
    enabled: Boolean(activeSchoolId) || isSuperAdmin,
    queryFn: async () => {
      const request = supabase.from("audit_findings")
        .select("id, finding_code, category, description, severity, recommendation, pic_name, due_date, status, created_at, audit_id, audits(school_id), locations(name, school_id), action_plans(id, action, pic_name, due_date, status)")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).filter((finding) => {
        const audit = Array.isArray(finding.audits) ? finding.audits[0] : finding.audits;
        const location = Array.isArray(finding.locations) ? finding.locations[0] : finding.locations;
        if (!activeSchoolId && isSuperAdmin) return true;
        return audit?.school_id === activeSchoolId || location?.school_id === activeSchoolId;
      });
    },
  });

  const saveFinding = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !locationId || !description.trim()) throw new Error("Pilih sekolah, lokasi, dan isi deskripsi temuan.");
      if (auditId && !auditsQuery.data?.some((audit) => audit.id === auditId)) throw new Error("Audit tidak sesuai sekolah yang dipilih.");
      const { error } = await supabase.from("audit_findings").insert({
        audit_id: auditId || null,
        location_id: locationId,
        category: category.trim(),
        description: description.trim(),
        severity,
        recommendation: recommendation.trim() || null,
        pic_name: picName.trim() || null,
        due_date: dueDate || null,
        photo_url: photoUrl,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Temuan audit tersimpan.");
      setDescription(""); setRecommendation(""); setPicName(""); setDueDate(""); setPhotoUrl(null);
      await invalidateAuditQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal menyimpan temuan."),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!planFindingId || !planAction.trim()) throw new Error("Pilih temuan dan isi tindakan perbaikan.");
      const { error } = await supabase.from("action_plans").insert({
        finding_id: planFindingId,
        action: planAction.trim(),
        pic_name: planPic.trim() || null,
        due_date: planDueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Rencana aksi tersimpan.");
      setPlanAction(""); setPlanPic(""); setPlanDueDate("");
      await invalidateAuditQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || "Gagal menyimpan rencana aksi."),
  });

  const updateFindingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FindingStatus }) => {
      const { error } = await supabase.from("audit_findings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAuditQueries(queryClient),
    onError: (error) => toast.error(error.message || "Status temuan gagal diperbarui."),
  });
  const updatePlanStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FindingStatus }) => {
      const { error } = await supabase.from("action_plans").update({ status, completed_at: status === "resolved" || status === "verified" ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAuditQueries(queryClient),
    onError: (error) => toast.error(error.message || "Status rencana aksi gagal diperbarui."),
  });

  return (
    <AppShell title="Temuan dan Tindakan" description="Ubah temuan audit menjadi rencana perbaikan terukur">
      {!activeSchoolId && !isSuperAdmin ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Akun belum terhubung ke sekolah.</div> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        {canRecord ? (
          <div className="space-y-5">
            <form className="eco-surface space-y-4 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); saveFinding.mutate(); }}>
              <div className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-600" /><h2 className="font-display font-bold">Temuan baru</h2></div>
              <div className="space-y-2"><Label htmlFor="finding-location">Lokasi</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger id="finding-location"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger><SelectContent>{(locationsQuery.data ?? []).map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="finding-audit">Audit terkait (opsional)</Label><Select value={auditId || "none"} onValueChange={(value) => setAuditId(value === "none" ? "" : value)}><SelectTrigger id="finding-audit"><SelectValue placeholder="Pilih audit" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa audit</SelectItem>{(auditsQuery.data ?? []).map((audit) => <SelectItem key={audit.id} value={audit.id}>{fmtDate(audit.audited_at)}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="finding-category">Kategori</Label><Input id="finding-category" value={category} onChange={(event) => setCategory(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="finding-severity">Tingkat</Label><Select value={severity} onValueChange={(value) => setSeverity(value as Severity)}><SelectTrigger id="finding-severity"><SelectValue /></SelectTrigger><SelectContent>{SEVERITIES.map((value) => <SelectItem key={value} value={value}>{SEVERITY_LABEL[value]}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="space-y-2"><Label htmlFor="finding-description">Deskripsi</Label><textarea id="finding-description" required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
              <div className="space-y-2"><Label htmlFor="finding-recommendation">Rekomendasi</Label><textarea id="finding-recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} rows={2} maxLength={1500} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="finding-pic">PIC</Label><Input id="finding-pic" value={picName} onChange={(event) => setPicName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="finding-due">Tenggat</Label><Input id="finding-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div>
              <PhotoUpload value={photoUrl} onChange={setPhotoUrl} label="Foto bukti (opsional)" />
              <Button type="submit" className="h-11 w-full" disabled={saveFinding.isPending || !activeSchoolId || !locationId || locationsQuery.isError}><Plus /> Simpan temuan</Button>
            </form>

            {isManager ? <form className="eco-surface space-y-4 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); savePlan.mutate(); }}><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-display font-bold">Rencana aksi</h2></div><div className="space-y-2"><Label htmlFor="plan-finding">Temuan terkait</Label><Select value={planFindingId} onValueChange={setPlanFindingId}><SelectTrigger id="plan-finding"><SelectValue placeholder="Pilih temuan" /></SelectTrigger><SelectContent>{(findingsQuery.data ?? []).map((finding) => <SelectItem key={finding.id} value={finding.id}>{finding.finding_code} · {finding.description.slice(0, 55)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="plan-action">Tindakan korektif</Label><textarea id="plan-action" required value={planAction} onChange={(event) => setPlanAction(event.target.value)} rows={2} maxLength={1500} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="plan-pic">PIC</Label><Input id="plan-pic" value={planPic} onChange={(event) => setPlanPic(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="plan-due">Tenggat</Label><Input id="plan-due" type="date" value={planDueDate} onChange={(event) => setPlanDueDate(event.target.value)} /></div></div><Button type="submit" variant="outline" className="w-full" disabled={savePlan.isPending || !planFindingId}><Plus /> Tambah rencana aksi</Button></form> : null}
          </div>
        ) : null}

        <section className="eco-surface min-w-0 p-4 sm:p-6"><div className="border-b border-border pb-4"><h2 className="font-display text-base font-bold">Daftar temuan</h2><p className="text-xs text-muted-foreground">Temuan dan progres tindakan korektif</p></div>{findingsQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Temuan gagal dimuat.</p> : findingsQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Memuat temuan...</p> : findingsQuery.data?.length ? <div className="divide-y divide-border">{findingsQuery.data.map((finding) => { const location = Array.isArray(finding.locations) ? finding.locations[0] : finding.locations; return <article key={finding.id} className="space-y-3 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{finding.finding_code}</h3><Badge variant={finding.severity === "critical" || finding.severity === "high" ? "destructive" : "secondary"}>{SEVERITY_LABEL[finding.severity]}</Badge></div><p className="mt-1 text-sm">{finding.description}</p>{(finding as { photo_url?: string | null }).photo_url ? <EvidenceImage path={(finding as { photo_url?: string | null }).photo_url} className="mt-2 h-36 w-full rounded-md object-cover sm:w-56" alt={`Bukti temuan ${finding.finding_code}`} /> : null}<p className="text-xs text-muted-foreground">{location?.name ?? "Lokasi"} · PIC {finding.pic_name ?? "belum ditetapkan"} · tenggat {fmtDate(finding.due_date)}</p></div><Select value={finding.status} onValueChange={(value) => updateFindingStatus.mutate({ id: finding.id, status: value as FindingStatus })} disabled={updateFindingStatus.isPending || !canRecord}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((value) => <SelectItem key={value} value={value}>{FINDING_STATUS_LABEL[value]}</SelectItem>)}</SelectContent></Select></div>{finding.recommendation ? <p className="text-xs text-muted-foreground">Rekomendasi: {finding.recommendation}</p> : null}{finding.action_plans.length ? <div className="space-y-2 border-l-2 border-primary/30 pl-3">{finding.action_plans.map((plan) => <div key={plan.id} className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm">{plan.action}</p><p className="text-xs text-muted-foreground">{plan.pic_name ?? "PIC belum diisi"} · {fmtDate(plan.due_date)}</p></div><Select value={plan.status} onValueChange={(value) => updatePlanStatus.mutate({ id: plan.id, status: value as FindingStatus })} disabled={!isManager || updatePlanStatus.isPending}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((value) => <SelectItem key={value} value={value}>{FINDING_STATUS_LABEL[value]}</SelectItem>)}</SelectContent></Select></div>)}</div> : <p className="text-xs text-muted-foreground">Belum ada rencana aksi.</p>}</article>; })}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Belum ada temuan.</p>}</section>
      </div>
    </AppShell>
  );
}
