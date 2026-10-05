import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, Printer, QrCode, Search } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { AppShell } from "@/components/app-shell";
import { SchoolFolders } from "@/components/school-folders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/qr")({
  head: () => ({ meta: [{ title: "QR Lokasi — Eco-School Waste Management" }] }),
  component: QrPage,
});

function QrPage() {
  const { isManager } = useAuthProfile();
  const { schoolId, schools, isSuperAdmin } = useSchoolScope();
  const [search, setSearch] = useState("");
  const qrCanvases = useRef<Record<string, HTMLCanvasElement | null>>({});

  const locationsQuery = useQuery({
    queryKey: ["qr-locations", schoolId],
    enabled: isManager && (Boolean(schoolId) || isSuperAdmin),
    queryFn: async () => {
      let request = supabase.from("locations").select("id, school_id, name, code, type").is("deleted_at", null).order("name");
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      const { data: qrTokens, error: tokenError } = await supabase.rpc("get_location_qr_tokens" as never);
      if (tokenError) throw tokenError;
      const tokensByLocation = new Map(((qrTokens ?? []) as { location_id: string; qr_token: string }[]).map((token) => [token.location_id, token.qr_token]));
      return (data ?? []).flatMap((location) => {
        const qr_token = tokensByLocation.get(location.id);
        return qr_token ? [{ ...location, qr_token }] : [];
      });
    },
  });

  const locations = (locationsQuery.data ?? []).filter((location) =>
    `${location.name} ${location.code ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function reportUrl(locationId: string, qrToken: string) {
    return `${window.location.origin}/input?locationId=${encodeURIComponent(locationId)}&qrToken=${encodeURIComponent(qrToken)}`;
  }

  function downloadQr(location: { qr_token: string; name: string }) {
    const canvas = qrCanvases.current[location.qr_token];
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `eco-school-qr-${location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    anchor.click();
  }

  return (
    <AppShell title="QR Lokasi" description="Buat label pelaporan sampah sesuai lokasi">
      {!isManager ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Pengelolaan QR hanya tersedia untuk admin sekolah.</div> : null}
      <div className="print-hidden eco-surface mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" aria-label="Cari lokasi" placeholder="Cari lokasi atau kode" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      </div>
      {locationsQuery.isError ? <div role="alert" className="eco-surface p-5 text-sm text-destructive">Lokasi gagal dimuat.</div> : locationsQuery.isLoading ? <div className="eco-surface p-5 text-sm text-muted-foreground">Memuat lokasi...</div> : !schoolId && !isSuperAdmin ? <div className="eco-surface p-5 text-sm text-muted-foreground">Akun belum terhubung ke sekolah.</div> : (
        <SchoolFolders records={locations} schools={schools} emptyMessage="Tidak ada lokasi yang sesuai. Tambahkan lokasi melalui Master Data.">
          {locations.map((location) => {
            const target = reportUrl(location.id, location.qr_token);
            return <article key={location.id} className="eco-surface overflow-hidden p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-display font-bold">{location.name}</h2><p className="text-xs text-muted-foreground">{location.code ?? "Tanpa kode"} · {location.type.replaceAll("_", " ")}</p></div><QrCode className="size-5 shrink-0 text-primary" /></div><div className="my-4 flex justify-center bg-white p-3"><QRCodeCanvas value={target} size={240} level="H" className="size-44" aria-label={`QR code formulir sampah untuk ${location.name}`} ref={(canvas) => { qrCanvases.current[location.qr_token] = canvas; }} /></div><p className="mb-3 text-center text-[11px] text-muted-foreground">Pindai untuk membuka form dengan lokasi terpilih</p><div className="print-hidden flex gap-2"><Button variant="outline" className="flex-1" onClick={() => downloadQr(location)} disabled={!isManager}><Download /> PNG</Button><Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer /> Cetak</Button></div></article>;
          })}
        </SchoolFolders>
      )}
      <style>{`@media print { @page { margin: 10mm; } body { background: white !important; } .print-hidden, aside, header { display: none !important; } main { max-width: none !important; padding: 0 !important; } .eco-surface { box-shadow: none !important; break-inside: avoid; } }`}</style>
    </AppShell>
  );
}
