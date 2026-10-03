import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Coins, LoaderCircle, Recycle, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PhotoUpload } from "@/components/photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { useSchoolScope } from "@/components/school-scope";
import { supabase } from "@/integrations/supabase/client";
import { invalidateWasteQueries } from "@/lib/query-invalidation";
import {
  CATEGORY_LABEL,
  METHOD_LABEL,
  PAYMENT_LABEL,
  fmtDateTime,
  fmtKg,
  fmtRp,
  type PaymentStatus,
  type ProcessingMethod,
  type WasteCategory,
} from "@/lib/waste";

export type WasteOutcomeKind = "processing" | "utilization" | "sales" | "residual";

type OutcomeForm = {
  batchId: string;
  weight: string;
  outputWeight: string;
  method: ProcessingMethod;
  typeId: string;
  price: string;
  payment: PaymentStatus;
  partnerId: string;
  destination: string;
  transporter: string;
  date: string;
  economicValue: string;
  responsible: string;
  result: string;
  notes: string;
  photo: string | null;
};

const KINDS = {
  processing: { title: "Pengolahan", noun: "pengolahan", icon: Recycle },
  utilization: { title: "Pemanfaatan", noun: "pemanfaatan", icon: Sprout },
  sales: { title: "Bank Sampah", noun: "penjualan", icon: Coins },
  residual: { title: "Residu", noun: "pembuangan residu", icon: Trash2 },
} satisfies Record<WasteOutcomeKind, { title: string; noun: string; icon: typeof Recycle }>;

const METHODS = Object.keys(METHOD_LABEL) as ProcessingMethod[];
const PAYMENT_STATUSES = Object.keys(PAYMENT_LABEL) as PaymentStatus[];

function localDateTime() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function initialForm(): OutcomeForm {
  return {
    batchId: "",
    weight: "",
    outputWeight: "",
    method: "composting",
    typeId: "",
    price: "",
    payment: "unpaid",
    partnerId: "",
    destination: "",
    transporter: "",
    date: localDateTime(),
    economicValue: "0",
    responsible: "",
    result: "",
    notes: "",
    photo: null,
  };
}

export function WasteOutcomePage({ kind }: { kind: WasteOutcomeKind }) {
  const definition = KINDS[kind];
  const Icon = definition.icon;
  const { canRecord, isManager } = useAuthProfile();
  const { schoolId, schools, isSuperAdmin } = useSchoolScope();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OutcomeForm>(initialForm);
  const recordAt = kind === "processing" ? "processed_at" : kind === "utilization" ? "used_at" : kind === "sales" ? "sold_at" : "disposed_at";
  const canSubmit = canRecord && (kind !== "sales" || isManager);

  const batchesQuery = useQuery({
    queryKey: ["outcome-batches", kind, schoolId],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      let request = supabase
        .from("waste_batches")
        .select("id, batch_code, initial_weight_kg, stage, waste_sorting(category, waste_type_id, weight_kg), waste_processing(input_weight_kg, output_weight_kg)")
        .is("deleted_at", null)
        .order("generated_at", { ascending: false })
        .limit(150);
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const partnersQuery = useQuery({
    queryKey: ["outcome-partners", schoolId],
    queryFn: async () => {
      let request = supabase.from("partners").select("id, name").is("deleted_at", null).order("name");
      if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const typesQuery = useQuery({
    queryKey: ["outcome-recyclable-types", schoolId],
    queryFn: async () => {
      let request = supabase
        .from("waste_types")
        .select("id, name, category, recyclable, default_price_per_kg")
        .eq("recyclable", true)
        .is("deleted_at", null)
        .order("name");
      if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const batches = useMemo(() => {
    return (batchesQuery.data ?? []).filter((batch) => {
      if (kind === "processing") return ["collected", "weighed", "sorted", "processed"].includes(batch.stage);
      if (kind === "utilization") return batch.waste_processing.some((row) => Number(row.output_weight_kg) > 0);
      if (kind === "sales") return batch.waste_sorting.some((row) => row.waste_type_id && row.weight_kg > 0);
      return batch.waste_sorting.some((row) => row.category === "residual" && row.weight_kg > 0);
    });
  }, [batchesQuery.data, kind]);

  const recordsQuery = useQuery({
    queryKey: ["outcome-records", kind, schoolId],
    enabled: Boolean(schoolId) || isSuperAdmin,
    queryFn: async () => {
      if (kind === "processing") {
        let request = supabase.from("waste_processing")
          .select("id, input_weight_kg, output_weight_kg, method, processed_at, responsible_name, waste_batches!inner(batch_code, school_id)")
          .is("deleted_at", null).order("processed_at", { ascending: false }).limit(50);
        if (schoolId) request = request.eq("waste_batches.school_id", schoolId);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, schoolId: row.waste_batches.school_id, batch: row.waste_batches.batch_code, date: row.processed_at, weight: row.input_weight_kg, detail: `${METHOD_LABEL[row.method]} · output ${fmtKg(row.output_weight_kg)}` }));
      }
      if (kind === "utilization") {
        let request = supabase.from("waste_utilization")
          .select("id, weight_kg, utilization_type, economic_value, used_at, waste_batches!inner(batch_code, school_id)")
          .is("deleted_at", null).order("used_at", { ascending: false }).limit(50);
        if (schoolId) request = request.eq("waste_batches.school_id", schoolId);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, schoolId: row.waste_batches.school_id, batch: row.waste_batches.batch_code, date: row.used_at, weight: row.weight_kg, detail: `${row.utilization_type} · ${fmtRp(row.economic_value)}` }));
      }
      if (kind === "sales") {
        let request = supabase.from("waste_sales")
          .select("id, transaction_code, weight_kg, total_value, sold_at, payment_status, waste_batches(batch_code, school_id)")
          .is("deleted_at", null).order("sold_at", { ascending: false }).limit(50);
        if (schoolId) request = request.eq("waste_batches.school_id", schoolId);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, schoolId: row.waste_batches?.school_id ?? null, batch: row.waste_batches?.batch_code ?? row.transaction_code, date: row.sold_at, weight: row.weight_kg, detail: `${fmtRp(Number(row.total_value ?? 0))} · ${PAYMENT_LABEL[row.payment_status]}` }));
      }
      let request = supabase.from("residual_disposals")
        .select("id, weight_kg, destination, disposal_method, disposed_at, waste_batches!inner(batch_code, school_id)")
        .is("deleted_at", null).order("disposed_at", { ascending: false }).limit(50);
      if (schoolId) request = request.eq("waste_batches.school_id", schoolId);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, schoolId: row.waste_batches.school_id, batch: row.waste_batches.batch_code, date: row.disposed_at, weight: row.weight_kg, detail: `${row.destination} · ${row.disposal_method}` }));
    },
  });

  const selectedBatch = batches.find((batch) => batch.id === form.batchId);
  const selectedType = typesQuery.data?.find((type) => type.id === form.typeId);
  const recordsBySchool = new Map<string, { name: string; records: NonNullable<typeof recordsQuery.data> }>();
  for (const record of recordsQuery.data ?? []) {
    const schoolKey = record.schoolId ?? "unknown";
    const group = recordsBySchool.get(schoolKey) ?? {
      name: schools.find((school) => school.id === record.schoolId)?.name ?? "Sekolah tidak diketahui",
      records: [],
    };
    group.records.push(record);
    recordsBySchool.set(schoolKey, group);
  }

  useEffect(() => {
    if (kind === "sales" && selectedType) {
      setForm((current) => current.typeId === selectedType.id && !current.price
        ? { ...current, price: String(selectedType.default_price_per_kg) }
        : current,
      );
    }
  }, [kind, selectedType]);

  const mutation = useMutation({
    mutationFn: async () => {
      const weight = Number(form.weight);
      if (!form.batchId || !Number.isFinite(weight) || weight <= 0) throw new Error("Pilih batch dan masukkan berat yang valid.");
      const date = new Date(form.date).toISOString();
      if (kind === "processing") {
        const output = Number(form.outputWeight);
        if (!Number.isFinite(output) || output < 0 || output > weight) throw new Error("Output harus nol atau lebih dan tidak melebihi input.");
        const { data, error } = await supabase.rpc("record_waste_processing", {
          p_batch_id: form.batchId, p_method: form.method, p_input_weight_kg: weight,
          p_output_weight_kg: output, p_processed_at: date, p_responsible_name: form.responsible || null,
          p_result: form.result || null, p_photo_url: form.photo, p_notes: form.notes || null,
        } as never);
        if (error) throw error;
        return data;
      }
      if (kind === "utilization") {
        const value = Number(form.economicValue || 0);
        if (!Number.isFinite(value) || value < 0) throw new Error("Nilai ekonomi tidak valid.");
        const { data, error } = await supabase.rpc("record_waste_utilization", {
          p_batch_id: form.batchId, p_utilization_type: form.destination || "Pemanfaatan sekolah",
          p_weight_kg: weight, p_destination: form.destination || null, p_partner_id: form.partnerId || null,
          p_used_at: date, p_economic_value: value, p_photo_url: form.photo, p_notes: form.notes || null,
        } as never);
        if (error) throw error;
        return data;
      }
      if (kind === "sales") {
        if (!form.typeId || !form.partnerId) throw new Error("Pilih jenis material dan mitra penjualan.");
        const price = Number(form.price);
        if (!Number.isFinite(price) || price < 0) throw new Error("Harga per kilogram tidak valid.");
        const { data, error } = await supabase.rpc("record_waste_sale", {
          p_batch_id: form.batchId, p_waste_type_id: form.typeId, p_weight_kg: weight,
          p_price_per_kg: price, p_partner_id: form.partnerId, p_sold_at: date,
          p_payment_status: form.payment, p_notes: form.notes || null,
        } as never);
        if (error) throw error;
        return data?.[0]?.transaction_code ?? data?.[0]?.sale_id;
      }
      if (!form.destination || !form.method) throw new Error("Isi tujuan dan metode pembuangan.");
      const { data, error } = await supabase.rpc("record_residual_disposal", {
        p_batch_id: form.batchId, p_weight_kg: weight, p_destination: form.destination,
        p_disposal_method: form.method, p_disposed_at: date, p_transporter: form.transporter || null,
        p_photo_url: form.photo, p_notes: form.notes || null,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success(`Catatan ${definition.noun} tersimpan.`);
      setForm(initialForm());
      await invalidateWasteQueries(queryClient);
    },
    onError: (error) => toast.error(error.message || `Gagal menyimpan ${definition.noun}.`),
  });

  return (
    <AppShell title={definition.title} description={`Catat dan telusuri ${definition.noun} per batch`}>
      {!canSubmit ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">
          {kind === "sales" ? "Transaksi penjualan hanya dapat dicatat oleh pengelola sekolah." : "Peran akun ini hanya dapat melihat data."}
        </div>
      ) : null}
      {!schoolId && !isSuperAdmin ? (
        <div role="alert" className="eco-surface mb-4 p-4 text-sm">Akun belum terhubung ke sekolah.</div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)]">
        {canSubmit ? (
          <form className="eco-surface space-y-5 p-4 sm:p-6" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-5" /></span>
              <div><h2 className="font-display text-base font-bold">Catat {definition.noun}</h2><p className="text-xs text-muted-foreground">Validasi massa dilakukan di database.</p></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${kind}-batch`}>Batch</Label>
              <Select value={form.batchId} onValueChange={(value) => setForm((current) => ({ ...current, batchId: value }))}>
                <SelectTrigger id={`${kind}-batch`}><SelectValue placeholder="Pilih batch" /></SelectTrigger>
                <SelectContent>{batches.map((batch) => <SelectItem key={batch.id} value={batch.id}>{batch.batch_code} · {fmtKg(Number(batch.initial_weight_kg))}</SelectItem>)}</SelectContent>
              </Select>
              {kind === "sales" && selectedBatch ? <p className="text-xs text-muted-foreground">{selectedBatch.waste_sorting.filter((row) => row.category !== "residual").map((row) => CATEGORY_LABEL[row.category as WasteCategory]).join(", ")}</p> : null}
            </div>
            {kind === "processing" ? (
              <>
                <div className="space-y-2"><Label htmlFor="process-method">Metode pengolahan</Label><Select value={form.method} onValueChange={(value) => setForm((current) => ({ ...current, method: value as ProcessingMethod }))}><SelectTrigger id="process-method"><SelectValue /></SelectTrigger><SelectContent>{METHODS.map((method) => <SelectItem key={method} value={method}>{METHOD_LABEL[method]}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="process-input">Berat input (kg)</Label><Input id="process-input" type="number" min="0.001" step="0.001" required value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="process-output">Berat output (kg)</Label><Input id="process-output" type="number" min="0" step="0.001" required value={form.outputWeight} onChange={(event) => setForm((current) => ({ ...current, outputWeight: event.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="process-responsible">Penanggung jawab</Label><Input id="process-responsible" value={form.responsible} onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="process-result">Hasil pengolahan</Label><Input id="process-result" value={form.result} onChange={(event) => setForm((current) => ({ ...current, result: event.target.value }))} /></div>
              </>
            ) : null}
            {kind === "utilization" ? (
              <>
                <div className="space-y-2"><Label htmlFor="utilization-weight">Berat dimanfaatkan (kg)</Label><Input id="utilization-weight" type="number" min="0.001" step="0.001" required value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="utilization-destination">Jenis dan tujuan pemanfaatan</Label><Input id="utilization-destination" required value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))} placeholder="Contoh: kompos untuk taman sekolah" /></div>
                <div className="space-y-2"><Label htmlFor="utilization-partner">Mitra (opsional)</Label><Select value={form.partnerId || "none"} onValueChange={(value) => setForm((current) => ({ ...current, partnerId: value === "none" ? "" : value }))}><SelectTrigger id="utilization-partner"><SelectValue placeholder="Pilih mitra" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa mitra</SelectItem>{(partnersQuery.data ?? []).map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="economic-value">Nilai ekonomi (Rp)</Label><Input id="economic-value" type="number" min="0" step="1" value={form.economicValue} onChange={(event) => setForm((current) => ({ ...current, economicValue: event.target.value }))} /></div>
              </>
            ) : null}
            {kind === "sales" ? (
              <>
                <div className="space-y-2"><Label htmlFor="sale-type">Material daur ulang</Label><Select value={form.typeId} onValueChange={(value) => { const type = typesQuery.data?.find((item) => item.id === value); setForm((current) => ({ ...current, typeId: value, price: type ? String(type.default_price_per_kg) : "" })); }}><SelectTrigger id="sale-type"><SelectValue placeholder="Pilih material" /></SelectTrigger><SelectContent>{(typesQuery.data ?? []).map((type) => <SelectItem key={type.id} value={type.id}>{type.name} · {CATEGORY_LABEL[type.category]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="sale-partner">Mitra pembeli</Label><Select value={form.partnerId} onValueChange={(value) => setForm((current) => ({ ...current, partnerId: value }))}><SelectTrigger id="sale-partner"><SelectValue placeholder="Pilih mitra" /></SelectTrigger><SelectContent>{(partnersQuery.data ?? []).map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sale-weight">Berat (kg)</Label><Input id="sale-weight" type="number" min="0.001" step="0.001" required value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="sale-price">Harga per kg (Rp)</Label><Input id="sale-price" type="number" min="0" step="1" required value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></div></div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 p-3"><span className="text-sm">Nilai transaksi</span><strong>{fmtRp((Number(form.weight) || 0) * (Number(form.price) || 0))}</strong></div>
                <div className="space-y-2"><Label htmlFor="sale-payment">Status pembayaran</Label><Select value={form.payment} onValueChange={(value) => setForm((current) => ({ ...current, payment: value as PaymentStatus }))}><SelectTrigger id="sale-payment"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_STATUSES.map((status) => <SelectItem key={status} value={status}>{PAYMENT_LABEL[status]}</SelectItem>)}</SelectContent></Select></div>
              </>
            ) : null}
            {kind === "residual" ? (
              <>
                <div className="space-y-2"><Label htmlFor="residual-weight">Berat residu (kg)</Label><Input id="residual-weight" type="number" min="0.001" step="0.001" required value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="residual-destination">Tujuan</Label><Input id="residual-destination" required value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="residual-method">Metode pembuangan</Label><Input id="residual-method" required value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as ProcessingMethod }))} placeholder="Contoh: TPA resmi" /></div></div>
                <div className="space-y-2"><Label htmlFor="transporter">Pengangkut</Label><Input id="transporter" value={form.transporter} onChange={(event) => setForm((current) => ({ ...current, transporter: event.target.value }))} /></div>
              </>
            ) : null}
            <div className="space-y-2"><Label htmlFor={`${kind}-date`}>Tanggal dan waktu</Label><Input id={`${kind}-date`} type="datetime-local" required value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></div>
            <PhotoUpload value={form.photo} onChange={(photo) => setForm((current) => ({ ...current, photo }))} label="Foto bukti (opsional)" />
            <div className="space-y-2"><Label htmlFor={`${kind}-notes`}>Catatan</Label><textarea id={`${kind}-notes`} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} maxLength={1000} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={!canSubmit || !form.batchId || mutation.isPending || batchesQuery.isError || (kind === "sales" && (typesQuery.isError || partnersQuery.isError))}>
              {mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Icon />}
              Simpan {definition.noun}
            </Button>
          </form>
        ) : null}
        <section className="eco-surface min-w-0 p-4 sm:p-6">
          <div className="border-b border-border pb-4"><h2 className="font-display text-base font-bold">Riwayat {definition.noun}</h2><p className="text-xs text-muted-foreground">50 transaksi terakhir</p></div>
          {recordsQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Riwayat gagal dimuat.</p> : recordsQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Memuat riwayat...</p> : recordsQuery.data?.length ? (
            <div className="divide-y divide-border">{[...recordsBySchool.entries()].map(([schoolIdKey, group]) => <section key={schoolIdKey}><h3 className="bg-muted/40 px-3 py-2 text-xs font-semibold">{group.name} · {group.records.length} catatan</h3><div className="divide-y divide-border">{group.records.map((record) => <div key={record.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{record.batch}</p><p className="text-xs text-muted-foreground">{record.detail} · {fmtDateTime(record.date)}</p></div><p className="shrink-0 text-sm font-bold">{fmtKg(Number(record.weight))}</p></div>)}</div></section>)}</div>
          ) : <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>}
          {batchesQuery.isError || partnersQuery.isError ? <p role="alert" className="mt-3 text-xs text-destructive">Data pendukung gagal dimuat.</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
