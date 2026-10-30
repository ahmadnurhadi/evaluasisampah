import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/waste-bank")({
  head: () => ({ meta: [{ title: "Bank Sampah — Eco-School Waste Management" },
      {"name": "description", "content": "Pantau penjualan sampah, mitra, dan status pembayaran."},
      {"property": "og:title", "content": "Bank Sampah — Eco-School Waste Management"},
      {"property": "og:description", "content": "Pantau penjualan sampah, mitra, dan status pembayaran."},
      {"property": "og:type", "content": "website"},
      {"name": "twitter:card", "content": "summary_large_image"},
    ] }),
  component: () => <WasteOutcomePage kind="sales" />,
});
