import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/processing")({
  head: () => ({ meta: [{ title: "Pengolahan — Eco-School Waste Management" },
      {"name": "description", "content": "Catat pengolahan batch sampah dan hasil pengolahannya."},
      {"property": "og:title", "content": "Pengolahan — Eco-School Waste Management"},
      {"property": "og:description", "content": "Catat pengolahan batch sampah dan hasil pengolahannya."},
      {"property": "og:type", "content": "website"},
      {"name": "twitter:card", "content": "summary_large_image"},
    ] }),
  component: () => <WasteOutcomePage kind="processing" />,
});
