import { supabase } from "@/integrations/supabase/client";
import { INORGANIC, ratio, type WasteCategory } from "@/lib/waste";

export type DashboardFilters = {
  from: string; // ISO date (yyyy-mm-dd)
  to: string;
  locationId?: string;
  category?: WasteCategory;
  sourceId?: string;
};

type DashboardMetrics = {
  totalGenerated: number;
  organic: number;
  inorganic: number;
  b3: number;
  residualGenerated: number;
  processed: number;
  organicProcessed: number;
  recycled: number;
  utilized: number;
  sold: number;
  disposed: number;
  revenue: number;
  economicValue: number;
  kpi: {
    diversionRate: number;
    recyclingRate: number;
    organicProcessingRate: number;
    residualRate: number;
    reductionRate: number;
    prevTotal: number;
  };
  composition: { category: WasteCategory; weight: number }[];
  bySource: { name: string; weight: number }[];
  trend: { date: string; weight: number }[];
  utilization: { name: string; weight: number }[];
};

export type DashboardData = DashboardMetrics & { source: "database" | "demo" };

function isMissingDatabaseSchema(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "PGRST205" || code === "42P01" || /schema cache|could not find the table|does not exist/i.test(message);
}

function isWithinDateRange(value: string, filters: DashboardFilters) {
  const date = value.slice(0, 10);
  return date >= filters.from && date <= filters.to;
}

export function createDemoDashboard(filters: DashboardFilters): DashboardData {
  const demoLocationId = "demo-location";
  const demoSourceId = "demo-source";
  const now = Date.now();
  const records = [
    { category: "organic", weight_kg: 12, daysAgo: 6 },
    { category: "plastic", weight_kg: 8, daysAgo: 5 },
    { category: "paper", weight_kg: 5, daysAgo: 4 },
    { category: "residual", weight_kg: 3.2, daysAgo: 3 },
    { category: "organic", weight_kg: 9, daysAgo: 2 },
    { category: "cardboard", weight_kg: 7, daysAgo: 1 },
  ].map((record) => ({
    ...record,
    recorded_at: new Date(now - record.daysAgo * 86400000).toISOString(),
    location_id: demoLocationId,
    source_id: demoSourceId,
  })).filter((record) =>
    isWithinDateRange(record.recorded_at, filters)
    && (!filters.locationId || filters.locationId === demoLocationId)
    && (!filters.sourceId || filters.sourceId === demoSourceId)
    && (!filters.category || record.category === filters.category),
  );
  const processingRows = [
    { input_weight_kg: 10, output_weight_kg: 3.2, method: "composting", daysAgo: 4 },
    { input_weight_kg: 8, output_weight_kg: 3, method: "eco_enzyme", daysAgo: 1 },
    { input_weight_kg: 6, output_weight_kg: 4, method: "recycling", daysAgo: 0 },
  ].filter((row) => isWithinDateRange(new Date(now - row.daysAgo * 86400000).toISOString(), filters));
  const utilizationRows = [
    { weight_kg: 2, economic_value: 25000, daysAgo: 3 },
    { weight_kg: 2, economic_value: 15000, daysAgo: 0 },
  ].filter((row) => isWithinDateRange(new Date(now - row.daysAgo * 86400000).toISOString(), filters));
  const salesRows = [
    { weight_kg: 6.5, total_value: 52000, daysAgo: 3 },
    { weight_kg: 4, total_value: 10000, daysAgo: 2 },
  ].filter((row) => isWithinDateRange(new Date(now - row.daysAgo * 86400000).toISOString(), filters));
  const residualRows = [{ weight_kg: 2.5, daysAgo: 1 }]
    .filter((row) => isWithinDateRange(new Date(now - row.daysAgo * 86400000).toISOString(), filters));

  const sum = (rows: { weight_kg: number }[]) => rows.reduce((total, row) => total + row.weight_kg, 0);
  const totalGenerated = sum(records);
  const byCategory = new Map<string, number>();
  for (const record of records) {
    byCategory.set(record.category, (byCategory.get(record.category) ?? 0) + record.weight_kg);
  }
  const organic = byCategory.get("organic") ?? 0;
  const inorganic = INORGANIC.reduce((total, category) => total + (byCategory.get(category) ?? 0), 0);
  const b3 = byCategory.get("b3") ?? 0;
  const residualGenerated = byCategory.get("residual") ?? 0;
  const processed = processingRows.reduce((total, row) => total + row.input_weight_kg, 0);
  const organicProcessed = processingRows
    .filter((row) => row.method === "composting" || row.method === "eco_enzyme")
    .reduce((total, row) => total + row.input_weight_kg, 0);
  const recycled = processingRows
    .filter((row) => row.method === "recycling" || row.method === "upcycling")
    .reduce((total, row) => total + row.input_weight_kg, 0);
  const utilized = sum(utilizationRows);
  const utilizationValue = utilizationRows.reduce((total, row) => total + row.economic_value, 0);
  const sold = sum(salesRows);
  const revenue = salesRows.reduce((total, row) => total + row.total_value, 0);
  const disposed = sum(residualRows);
  const trendMap = new Map<string, number>();
  for (const record of records) {
    const date = record.recorded_at.slice(0, 10);
    trendMap.set(date, (trendMap.get(date) ?? 0) + record.weight_kg);
  }
  const sourceMap = new Map<string, number>();
  if (records.length) sourceMap.set("Kantin Demo", totalGenerated);

  return {
    source: "demo",
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
      diversionRate: ratio(utilized + sold + recycled, totalGenerated),
      recyclingRate: ratio(recycled + sold, totalGenerated),
      organicProcessingRate: ratio(organicProcessed, organic),
      residualRate: ratio(residualGenerated, totalGenerated),
      reductionRate: 0,
      prevTotal: 0,
    },
    composition: [...byCategory.entries()].map(([category, weight]) => ({
      category: category as WasteCategory,
      weight,
    })),
    bySource: [...sourceMap.entries()].map(([name, weight]) => ({ name, weight })),
    trend: [...trendMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, weight]) => ({ date, weight: Number(weight.toFixed(2)) })),
    utilization: [
      { name: "Diolah", weight: processed },
      { name: "Dimanfaatkan", weight: utilized },
      { name: "Dijual", weight: sold },
      { name: "Dibuang", weight: disposed },
    ],
  };
}

function endOfDay(date: string) {
  return `${date}T23:59:59.999Z`;
}
function startOfDay(date: string) {
  return `${date}T00:00:00.000Z`;
}

async function fetchAllRows<T>(
  fetchPage: (start: number, end: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await fetchPage(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function fetchLiveDashboard(f: DashboardFilters): Promise<DashboardMetrics> {
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
  let previousRecords = supabase
    .from("waste_records")
    .select("weight_kg, location_id, source_id, category")
    .is("deleted_at", null)
    .gte("recorded_at", startOfDay(prevFrom))
    .lte("recorded_at", endOfDay(prevTo));
  if (f.locationId) previousRecords = previousRecords.eq("location_id", f.locationId);
  if (f.category) previousRecords = previousRecords.eq("category", f.category);
  if (f.sourceId) previousRecords = previousRecords.eq("source_id", f.sourceId);

  const [recordRows, prevRows, processingRows, utilRows, saleRows, residualRows, sourceRows] = await Promise.all([
    fetchAllRows((start, end) => records.range(start, end)),
    fetchAllRows((start, end) => previousRecords.range(start, end)),
    fetchAllRows((start, end) => supabase
      .from("waste_processing")
      .select("input_weight_kg, output_weight_kg, method, processed_at")
      .is("deleted_at", null)
      .gte("processed_at", startOfDay(f.from))
      .lte("processed_at", endOfDay(f.to))
      .range(start, end)),
    fetchAllRows((start, end) => supabase
      .from("waste_utilization")
      .select("weight_kg, economic_value, utilization_type, used_at")
      .is("deleted_at", null)
      .gte("used_at", startOfDay(f.from))
      .lte("used_at", endOfDay(f.to))
      .range(start, end)),
    fetchAllRows((start, end) => supabase
      .from("waste_sales")
      .select("weight_kg, total_value, category, sold_at")
      .is("deleted_at", null)
      .gte("sold_at", startOfDay(f.from))
      .lte("sold_at", endOfDay(f.to))
      .range(start, end)),
    fetchAllRows((start, end) => supabase
      .from("residual_disposals")
      .select("weight_kg, disposed_at")
      .is("deleted_at", null)
      .gte("disposed_at", startOfDay(f.from))
      .lte("disposed_at", endOfDay(f.to))
      .range(start, end)),
    fetchAllRows((start, end) => supabase
      .from("waste_sources")
      .select("id, name")
      .is("deleted_at", null)
      .range(start, end)),
  ]);

  const recs = recordRows;
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

  const processed = processingRows.reduce((a, r) => a + Number(r.input_weight_kg ?? 0), 0);
  const organicProcessed = processingRows
    .filter((r) => r.method === "composting" || r.method === "eco_enzyme")
    .reduce((a, r) => a + Number(r.input_weight_kg ?? 0), 0);
  const recycled = processingRows
    .filter((r) => r.method === "recycling" || r.method === "upcycling")
    .reduce((a, r) => a + Number(r.input_weight_kg ?? 0), 0);

  const utilized = sum(utilRows);
  const utilizationValue = utilRows.reduce((a, r) => a + Number(r.economic_value ?? 0), 0);
  const sold = sum(saleRows);
  const revenue = saleRows.reduce((a, r) => a + Number(r.total_value ?? 0), 0);
  const disposed = sum(residualRows);

  const diverted = utilized + sold + recycled;
  const prevTotal = sum(prevRows);

  // monthly trend from records
  const trendMap = new Map<string, number>();
  for (const r of recs) {
    const key = String(r.recorded_at).slice(0, 10);
    trendMap.set(key, (trendMap.get(key) ?? 0) + Number(r.weight_kg ?? 0));
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weight]) => ({ date, weight: Number(weight.toFixed(2)) }));

  const sourceNames = new Map(sourceRows.map((s) => [s.id, s.name]));
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

export async function fetchDashboard(filters: DashboardFilters): Promise<DashboardData> {
  try {
    return { ...(await fetchLiveDashboard(filters)), source: "database" };
  } catch (error) {
    if (!isMissingDatabaseSchema(error)) throw error;
    return createDemoDashboard(filters);
  }
}
