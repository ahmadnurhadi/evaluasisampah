import { createFileRoute } from "@tanstack/react-router";
import { WasteOutcomePage } from "@/components/waste-outcome";

export const Route = createFileRoute("/_authenticated/waste-bank")({
  head: () => ({ meta: [{ title: "Bank Sampah — Eco-School Waste Management" }] }),
  component: () => <WasteOutcomePage kind="sales" />,
});
