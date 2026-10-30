import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/residual")({
  head: () => ({ meta: [{ title: "Residu — Eco-School Waste Management" },
      {"name": "description", "content": "Catat penanganan dan pembuangan residu sampah sekolah."},
      {"property": "og:title", "content": "Residu — Eco-School Waste Management"},
      {"property": "og:description", "content": "Catat penanganan dan pembuangan residu sampah sekolah."},
      {"property": "og:type", "content": "website"},
      {"name": "twitter:card", "content": "summary_large_image"},
    ] }),
  component: () => <WasteOutcomePage kind="residual" />,
});
