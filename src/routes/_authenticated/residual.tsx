import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/residual")({
  head: () => ({ meta: [{ title: "Residu — Eco-School Waste Management" }] }),
  component: () => <WasteOutcomePage kind="residual" />,
});
