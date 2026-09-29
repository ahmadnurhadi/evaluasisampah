import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Printer, QrCode, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/qr")({
  head: () => ({ meta: [{ title: "QR Lokasi — Eco-School Waste Management" }] }),
  component: QrPage,
});

function QrPage() {
  const { user, roles, isManager } = useAuthProfile();
  const profileSchoolId = user?.profile?.school_id ?? undefined;
  const isSuperAdmin = roles.includes("super_admin");
  const [schoolSelection, setSchoolSelection] = useState<string | null>(null);
  const schoolId = isSuperAdmin ? schoolSelection === null ? profileSchoolId : schoolSelection || undefined : profileSchoolId;
  const [search, setSearch] = useState("");

  const schoolsQuery = useQuery({
    queryKey: ["qr-schools"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const locationsQuery = useQuery({
    queryKey: ["qr-locations", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name, code, type, qr_token").eq("school_id", schoolId!).is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const locations = (locationsQuery.data ?? []).filter((location) =>
    `${location.name} ${location.code ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function reportUrl(locationId: string) {
    return `${window.location.origin}/input?locationId=${encodeURIComponent(locationId)}`;
  }

  function downloadQr(location: { id: string; name: string }) {
    const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=png&data=${encodeURIComponent(reportUrl(location.id))}`;
    const anchor = document.createElement("a");
    anchor.href = imageUrl;
    anchor.download = `eco-school-qr-${location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  return (
    <AppShell title="QR Lokasi" description="Buat label pelaporan sampah sesuai lokasi">
      {!isManager ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Pengelolaan QR hanya tersedia untuk admin sekolah.</div> : null}
      <div className="print-hidden eco-surface mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" aria-label="Cari lokasi" placeholder="Cari lokasi atau kode" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {isSuperAdmin ? <div className="space-y-2"><Label htmlFor="qr-school">Sekolah</Label><Select value={schoolId ?? ""} onValueChange={(value) => setSchoolSelection(value)}><SelectTrigger id="qr-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger><SelectContent>{(schoolsQuery.data ?? []).map((school) => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}</SelectContent></Select></div> : null}
      </div>
      {locationsQuery.isError ? <div role="alert" className="eco-surface p-5 text-sm text-destructive">Lokasi gagal dimuat.</div> : locationsQuery.isLoading ? <div className="eco-surface p-5 text-sm text-muted-foreground">Memuat lokasi...</div> : !schoolId ? <div className="eco-surface p-5 text-sm text-muted-foreground">Akun belum terhubung ke sekolah.</div> : !locations.length ? <div className="eco-surface p-8 text-center text-sm text-muted-foreground">Tidak ada lokasi yang sesuai. Tambahkan lokasi melalui Master Data.</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">{locations.map((location) => { const target = reportUrl(location.id); const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&data=${encodeURIComponent(target)}`; return <article key={location.id} className="eco-surface overflow-hidden p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-display font-bold">{location.name}</h2><p className="text-xs text-muted-foreground">{location.code ?? "Tanpa kode"} · {location.type.replaceAll("_", " ")}</p></div><QrCode className="size-5 shrink-0 text-primary" /></div><div className="my-4 flex justify-center bg-white p-3"><img src={qrImage} alt={`QR code formulir sampah untuk ${location.name}`} className="size-44" loading="lazy" /></div><p className="mb-3 text-center text-[11px] text-muted-foreground">Pindai untuk membuka form dengan lokasi terpilih</p><div className="print-hidden flex gap-2"><Button variant="outline" className="flex-1" onClick={() => downloadQr(location)} disabled={!isManager}><Download /> PNG</Button><Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer /> Cetak</Button></div></article>; })}</div>}
      <style>{`@media print { @page { margin: 10mm; } body { background: white !important; } .print-hidden, aside, header { display: none !important; } main { max-width: none !important; padding: 0 !important; } .eco-surface { box-shadow: none !important; break-inside: avoid; } }`}</style>
    </AppShell>
  );
}
