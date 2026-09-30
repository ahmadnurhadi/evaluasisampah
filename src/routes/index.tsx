import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, Recycle, ClipboardCheck, BarChart3, QrCode, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eco-School Waste Management — Monitoring Sampah Sekolah" },
      {
        name: "description",
        content:
          "Pantau sampah yang dihasilkan, dikumpulkan, dipilah, diolah, dimanfaatkan, dan dijual dalam satu sistem terintegrasi.",
      },
      { property: "og:title", content: "Eco-School Waste Management" },
      {
        property: "og:description",
        content: "Sistem monitoring, evaluasi, dan pemanfaatan sampah sekolah.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Scale, title: "Pencatatan & Penimbangan", text: "Catat berat sampah per lokasi dan sumber dalam hitungan detik." },
  { icon: Recycle, title: "Pemilahan & Pengolahan", text: "Pilah satu batch jadi beberapa kategori, lalu olah jadi kompos atau produk baru." },
  { icon: QrCode, title: "QR per Lokasi", text: "Pindai QR di kelas atau tempat sampah, form langsung terisi lokasinya." },
  { icon: ClipboardCheck, title: "Audit Lingkungan", text: "Nilai kebersihan, catat temuan, dan pantau rencana perbaikan." },
  { icon: BarChart3, title: "Dashboard & Laporan", text: "KPI diversion rate, daur ulang, residu, dan nilai ekonomi sampah." },
  { icon: Leaf, title: "Telusur Penuh", text: "Setiap batch punya kode unik dan lini masa lengkap sampai akhir." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="eco-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold">ECO-SCHOOL</p>
            <p className="text-[11px] text-muted-foreground">Waste Management</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Masuk</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-8 pb-16 text-center sm:pt-16">
        <p className="mx-auto w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          Monitoring · Evaluasi · Pemanfaatan
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold sm:text-5xl">
          Kelola sampah sekolah dari pencatatan hingga pemanfaatan
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Sistem terintegrasi untuk mencatat, menelusuri, mengaudit, dan melaporkan seluruh siklus
          sampah sekolah — cepat dipakai dari ponsel oleh guru dan petugas kebersihan.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Mulai sekarang</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard">Lihat dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="eco-surface p-5">
            <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <f.icon className="size-5" />
            </span>
            <h3 className="font-display text-base font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Eco-School Waste Management · Sistem Monitoring, Evaluasi, dan Pemanfaatan Sampah Sekolah
      </footer>
    </div>
  );
}
