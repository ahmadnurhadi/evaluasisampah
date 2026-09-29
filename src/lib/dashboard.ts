import { supabase } from "@/integrations/supabase/client";
import { INORGANIC, ratio, type WasteCategory } from "@/lib/waste";

export type DashboardFilters = {
  from: string; // ISO date (yyyy-mm-dd)
  to: string;
  locationId?: string;
  category?: WasteCategory;
  sourceId?: string;
};

export type DashboardData = Awaited<ReturnType<typeof fetchDashboard>>;

function endOfDay(date: string) {
  return `${date}T23:59:59.999Z`;
}
function startOfDay(date: string) {
  return `${date}T00:00:00.000Z`;
}

export async function fetchDashboard(f: DashboardFilters) {
  let records = supabase
    .from("waste_records")
    .select("weight_kg, category, recorded_at, location_id, source_id")
    .is("deleted_at", null)
    .gte("recorded_at", startOfDay(f.from))
    .lte("recorded_at", endOfDay(f.to));
  if (f.locationId) records = records.eq("location_id", f.locationId);
  if (f.category) records = records.eq("category", f.category);
  if (f.sourceId) records = records.eq("source_id", f.sourceId);

  const prevSpanMs = new Date(f.to).getTime() - new Date(f.from).getTime();
  const prevTo = new Date(new Date(f.from).getTime() - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(prevTo).getTime() - prevSpanMs).toISOString().slice(0, 10);

  const [
    { data: recordRows },
    { data: prevRows },
    { data: processingRows },
    { data: utilRows },
    { data: saleRows },
    { data: residualRows },
    { data: sourceRows },
  ] = await Promise.all([
    records,
    supabase
      .from("waste_records")
      .select("weight_kg")
      .is("deleted_at", null)
      .gte("recorded_at", startOfDay(prevFrom))
      .lte("recorded_at", endOfDay(prevTo)),
    supabase
      .from("waste_processing")
      .select("input_weight_kg, output_weight_kg, method, processed_at")
      .is("deleted_at", null)
      .gte("processed_at", startOfDay(f.from))
      .lte("processed_at", endOfDay(f.to)),
    supabase
      .from("waste_utilization")
      .select("weight_kg, economic_value, utilization_type, used_at")
      .is("deleted_at", null)
      .gte("used_at", startOfDay(f.from))
      .lte("used_at", endOfDay(f.to)),
    supabase
      .from("waste_sales")
      .select("weight_kg, total_value, category, sold_at")
      .is("deleted_at", null)
      .gte("sold_at", startOfDay(f.from))
      .lte("sold_at", endOfDay(f.to)),
    supabase
      .from("residual_disposals")
      .select("weight_kg, disposed_at")
      .is("deleted_at", null)
      .gte("disposed_at", startOfDay(f.from))
      .lte("disposed_at", endOfDay(f.to)),
    supabase.from("waste_sources").select("id, name").is("deleted_at", null),
  ]);

  const recs = recordRows ?? [];
  const sum = (arr: { weight_kg: number | string }[]) =>
    arr.reduce((a, r) => a + Number(r.weight_kg ?? 0), 0);

  const totalGenerated = sum(recs);
  const byCategory = new Map<string, number>();
  for (const r of recs) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.weight_kg ?? 0));
  }
  const organic = byCategory.get("organic") ?? 0;
  const inorganic = INORGANIC.reduce((a, c) => a + (byCategory.get(c) ?? 0), 0);
  const b3 = byCategory.get("b3") ?? 0;
  const residualGenerated = byCategory.get("residual") ?? 0;

  const processed = (processingRows ?? []).reduce((a, r) => a + Number(r.input_weight_kg ?? 0), 0);
  const organicProcessed = (processingRows ?? [])
    .filter((r) => r.method === "composting" || r.method === "eco_enzyme")
    .reduce((a, r) => a + Number(r.input_weight_kg ?? 0), 0);
  const recycled = (processingRows ?? [])
    .filter((r) => r.method === "recycling" || r.method === "upcycling")
    .reduce((a, r) => a + Number(r.input_weight_kg ?? 0), 0);

  const utilized = sum(utilRows ?? []);
  const utilizationValue = (utilRows ?? []).reduce((a, r) => a + Number(r.economic_value ?? 0), 0);
  const sold = sum(saleRows ?? []);
  const revenue = (saleRows ?? []).reduce((a, r) => a + Number(r.total_value ?? 0), 0);
  const disposed = sum(residualRows ?? []);

  const diverted = utilized + sold + recycled;
  const prevTotal = sum(prevRows ?? []);

  // monthly trend from records
  const trendMap = new Map<string, number>();
  for (const r of recs) {
    const key = String(r.recorded_at).slice(0, 10);
    trendMap.set(key, (trendMap.get(key) ?? 0) + Number(r.weight_kg ?? 0));
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weight]) => ({ date, weight: Number(weight.toFixed(2)) }));

  const sourceNames = new Map((sourceRows ?? []).map((s) => [s.id, s.name]));
  const sourceMap = new Map<string, number>();
  for (const r of recs) {
    const name = r.source_id ? (sourceNames.get(r.source_id) ?? "Lainnya") : "Tidak diisi";
    sourceMap.set(name, (sourceMap.get(name) ?? 0) + Number(r.weight_kg ?? 0));
  }

  return {
    totalGenerated,
    organic,
    inorganic,
    b3,
    residualGenerated,
    processed,
    organicProcessed,
    recycled,
    utilized,
    sold,
    disposed,
    revenue,
    economicValue: revenue + utilizationValue,
    kpi: {
      diversionRate: ratio(diverted, totalGenerated),
      recyclingRate: ratio(recycled + sold, totalGenerated),
      organicProcessingRate: ratio(organicProcessed, organic),
      residualRate: ratio(residualGenerated, totalGenerated),
      reductionRate: prevTotal ? ((prevTotal - totalGenerated) / prevTotal) * 100 : 0,
      prevTotal,
    },
    composition: [...byCategory.entries()].map(([category, weight]) => ({
      category: category as WasteCategory,
      weight,
    })),
    bySource: [...sourceMap.entries()].map(([name, weight]) => ({ name, weight })),
    trend,
    utilization: [
      { name: "Diolah", weight: processed },
      { name: "Dimanfaatkan", weight: utilized },
      { name: "Dijual", weight: sold },
      { name: "Dibuang", weight: disposed },
    ],
  };
}
