import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/processing")({
  head: () => ({ meta: [{ title: "Pengolahan — Eco-School Waste Management" }] }),
  component: () => <WasteOutcomePage kind="processing" />,
});
