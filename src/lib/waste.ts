import type { Database } from "@/integrations/supabase/types";

export type WasteCategory = Database["public"]["Enums"]["waste_category"];
export type BatchStage = Database["public"]["Enums"]["batch_stage"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type ProcessingMethod = Database["public"]["Enums"]["processing_method"];
export type FindingStatus = Database["public"]["Enums"]["finding_status"];
export type Severity = Database["public"]["Enums"]["severity_level"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type CollectionStatus = Database["public"]["Enums"]["collection_status"];

export const CATEGORY_LABEL: Record<WasteCategory, string> = {
  organic: "Organik",
  plastic: "Plastik",
  paper: "Kertas",
  cardboard: "Kardus",
  metal: "Logam",
  glass: "Kaca",
  b3: "B3 / Berbahaya",
  residual: "Residu",
  other: "Lainnya",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as WasteCategory[];

export const INORGANIC: WasteCategory[] = ["plastic", "paper", "cardboard", "metal", "glass"];

export const STAGE_LABEL: Record<BatchStage, string> = {
  generated: "Timbulan",
  collected: "Dikumpulkan",
  weighed: "Ditimbang",
  sorted: "Dipilah",
  processed: "Diolah",
  utilized: "Dimanfaatkan",
  sold: "Dijual",
  recycled: "Didaur ulang",
  disposed: "Dibuang",
};

export const METHOD_LABEL: Record<ProcessingMethod, string> = {
  composting: "Pengomposan",
  recycling: "Daur ulang",
  reuse: "Guna ulang",
  upcycling: "Upcycling",
  eco_enzyme: "Eco-enzyme",
  waste_bank: "Bank sampah",
  other: "Lainnya",
};

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  resolved: "Selesai",
  verified: "Diverifikasi",
  closed: "Ditutup",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Belum dibayar",
  partial: "Sebagian",
  paid: "Lunas",
};

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  pending: "Menunggu",
  in_progress: "Berjalan",
  collected: "Terkumpul",
  cancelled: "Dibatalkan",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  school_admin: "Admin Sekolah",
  coordinator: "Koordinator Lingkungan",
  teacher: "Guru",
  cleaning_staff: "Petugas Kebersihan",
  student: "Siswa",
  principal: "Kepala Sekolah / Manajemen",
};

export const MANAGER_ROLES: AppRole[] = ["super_admin", "school_admin", "coordinator"];
export const RECORDER_ROLES: AppRole[] = [
  "super_admin",
  "school_admin",
  "coordinator",
  "teacher",
  "cleaning_staff",
  "student",
];

export function fmtKg(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })} kg`;
}

export function fmtRp(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ratio(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}
