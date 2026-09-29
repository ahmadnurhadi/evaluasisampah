import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/utilization")({
  head: () => ({ meta: [{ title: "Pemanfaatan — Eco-School Waste Management" }] }),
  component: () => <WasteOutcomePage kind="utilization" />,
});
