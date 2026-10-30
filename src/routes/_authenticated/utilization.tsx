import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/utilization")({
  head: () => ({ meta: [{ title: "Pemanfaatan — Eco-School Waste Management" },
      {"name": "description", "content": "Catat pemanfaatan hasil pengolahan sampah sekolah."},
      {"property": "og:title", "content": "Pemanfaatan — Eco-School Waste Management"},
      {"property": "og:description", "content": "Catat pemanfaatan hasil pengolahan sampah sekolah."},
      {"property": "og:type", "content": "website"},
      {"name": "twitter:card", "content": "summary_large_image"},
    ] }),
  component: () => <WasteOutcomePage kind="utilization" />,
});
