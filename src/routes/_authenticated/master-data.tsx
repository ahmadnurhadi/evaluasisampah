import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateMasterDataQueries } from "@/lib/query-invalidation";
import { CATEGORY_LABEL, CATEGORIES, type WasteCategory } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/master-data")({
  head: () => ({ meta: [{ title: "Master Data — Eco-School Waste Management" }] }),
  component: MasterDataPage,
});

type Section = "locations" | "sources" | "types" | "partners" | "indicators" | "schools";
type Field = { key: string; label: string; type?: "text" | "number" | "textarea" | "select" | "checkbox"; options?: { value: string; label: string }[]; required?: boolean };
type Row = { id: string; title: string; detail: string; values: Record<string, string> };

const SECTIONS: { id: Section; label: string }[] = [
  { id: "locations", label: "Lokasi" },
  { id: "sources", label: "Sumber" },
  { id: "types", label: "Jenis sampah" },
  { id: "partners", label: "Mitra" },
  { id: "indicators", label: "Indikator" },
  { id: "schools", label: "Sekolah" },
];

const FIELDS: Record<Section, Field[]> = {
  locations: [
    { key: "name", label: "Nama lokasi", required: true },
    { key: "code", label: "Kode lokasi" },
    { key: "type", label: "Tipe lokasi", type: "select", required: true, options: ["classroom", "canteen", "garden", "collection_point", "office", "laboratory", "other"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
    { key: "description", label: "Deskripsi", type: "textarea" },
  ],
  sources: [{ key: "name", label: "Nama sumber", required: true }, { key: "description", label: "Deskripsi", type: "textarea" }],
  types: [
    { key: "name", label: "Nama jenis", required: true },
    { key: "category", label: "Kategori", type: "select", required: true, options: CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] })) },
    { key: "recyclable", label: "Dapat didaur ulang", type: "checkbox" },
    { key: "default_price_per_kg", label: "Harga default per kg (Rp)", type: "number" },
  ],
  partners: [
    { key: "name", label: "Nama mitra", required: true },
    { key: "type", label: "Tipe mitra", type: "select", required: true, options: ["waste_bank", "recycler", "transporter", "other"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
    { key: "contact_person", label: "Nama kontak" },
    { key: "phone", label: "Telepon" },
    { key: "address", label: "Alamat", type: "textarea" },
  ],
  indicators: [
    { key: "name", label: "Nama indikator", required: true },
    { key: "description", label: "Deskripsi", type: "textarea" },
    { key: "weight", label: "Bobot", type: "number", required: true },
    { key: "max_score", label: "Skor maksimum", type: "number", required: true },
  ],
  schools: [
    { key: "name", label: "Nama sekolah", required: true },
    { key: "npsn", label: "NPSN" },
    { key: "address", label: "Alamat", type: "textarea" },
    { key: "city", label: "Kota" },
    { key: "student_count", label: "Jumlah siswa", type: "number" },
  ],
};

function MasterDataPage() {
  const { user, roles, isManager } = useAuthProfile();
  const queryClient = useQueryClient();
  const isSuperAdmin = roles.includes("super_admin");
  const profileSchoolId = user?.profile?.school_id ?? undefined;
  const [schoolSelection, setSchoolSelection] = useState<string | null>(null);
  const schoolId = isSuperAdmin
    ? schoolSelection === null
      ? profileSchoolId
      : schoolSelection || undefined
    : profileSchoolId;
  const [section, setSection] = useState<Section>("locations");
  const [editingId, setEditingId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (schoolSelection === null && profileSchoolId) setSchoolSelection(profileSchoolId);
  }, [profileSchoolId, schoolSelection]);

  const schoolsQuery = useQuery({
    queryKey: ["master-school-options"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const recordsQuery = useQuery({
    queryKey: ["master-records", section, schoolId, isSuperAdmin],
    enabled: section === "schools" ? isSuperAdmin : Boolean(schoolId) || isSuperAdmin,
    queryFn: async (): Promise<Row[]> => {
      if (section === "locations") {
        let request = supabase.from("locations").select("id, name, code, type, description, school_id").is("deleted_at", null).order("name");
        if (schoolId) request = request.eq("school_id", schoolId);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, title: row.name, detail: `${row.type} · ${row.code ?? "tanpa kode"}`, values: { name: row.name, code: row.code ?? "", type: row.type, description: row.description ?? "" } }));
      }
      if (section === "sources") {
        let request = supabase.from("waste_sources").select("id, name, description, school_id").is("deleted_at", null).order("name");
        if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, title: row.name, detail: row.description ?? "", values: { name: row.name, description: row.description ?? "" } }));
      }
      if (section === "types") {
        let request = supabase.from("waste_types").select("id, name, category, recyclable, default_price_per_kg, school_id").is("deleted_at", null).order("name");
        if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, title: row.name, detail: `${CATEGORY_LABEL[row.category]} · ${row.recyclable ? "daur ulang" : "non-daur ulang"}`, values: { name: row.name, category: row.category, recyclable: String(row.recyclable), default_price_per_kg: String(row.default_price_per_kg) } }));
      }
      if (section === "partners") {
        let request = supabase.from("partners").select("id, name, type, contact_person, phone, address, school_id").is("deleted_at", null).order("name");
        if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, title: row.name, detail: `${row.type} · ${row.contact_person ?? row.phone ?? ""}`, values: { name: row.name, type: row.type, contact_person: row.contact_person ?? "", phone: row.phone ?? "", address: row.address ?? "" } }));
      }
      if (section === "indicators") {
        let request = supabase.from("audit_indicators").select("id, name, description, weight, max_score, school_id").eq("active", true).order("name");
        if (schoolId) request = request.or(`school_id.is.null,school_id.eq.${schoolId}`);
        const { data, error } = await request;
        if (error) throw error;
        return (data ?? []).map((row) => ({ id: row.id, title: row.name, detail: `Bobot ${row.weight} · maksimum ${row.max_score}`, values: { name: row.name, description: row.description ?? "", weight: String(row.weight), max_score: String(row.max_score) } }));
      }
      const { data, error } = await supabase.from("schools").select("id, name, npsn, address, city, student_count").is("deleted_at", null).order("name");
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, title: row.name, detail: `${row.npsn ?? "tanpa NPSN"} · ${row.city ?? ""}`, values: { name: row.name, npsn: row.npsn ?? "", address: row.address ?? "", city: row.city ?? "", student_count: row.student_count === null ? "" : String(row.student_count) } }));
    },
  });

  const sectionFields = FIELDS[section];
  const canEditSection = isSuperAdmin || (isManager && section !== "schools");

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditSection) return;
    if (section === "locations" && !schoolId) return toast.error("Pilih sekolah sebelum menambahkan lokasi.");
    if (section !== "schools" && !isSuperAdmin && !schoolId) return toast.error("Sekolah belum ditetapkan untuk akun ini.");

    const scopedSchool = isSuperAdmin ? schoolId || null : schoolId;
    let error: { message: string } | null = null;
    if (section === "locations") {
      const payload = { school_id: scopedSchool!, name: values.name?.trim(), code: values.code?.trim() || null, type: values.type || "other", description: values.description?.trim() || null };
      const result = editingId ? await supabase.from("locations").update(payload).eq("id", editingId) : await supabase.from("locations").insert(payload);
      error = result.error;
    } else if (section === "sources") {
      const payload = { school_id: scopedSchool, name: values.name?.trim(), description: values.description?.trim() || null };
      const result = editingId ? await supabase.from("waste_sources").update(payload).eq("id", editingId) : await supabase.from("waste_sources").insert(payload);
      error = result.error;
    } else if (section === "types") {
      const payload = { school_id: scopedSchool, name: values.name?.trim(), category: values.category as WasteCategory, recyclable: values.recyclable === "true", default_price_per_kg: Number(values.default_price_per_kg || 0) };
      const result = editingId ? await supabase.from("waste_types").update(payload).eq("id", editingId) : await supabase.from("waste_types").insert(payload);
      error = result.error;
    } else if (section === "partners") {
      const payload = { school_id: scopedSchool, name: values.name?.trim(), type: values.type || "other", contact_person: values.contact_person?.trim() || null, phone: values.phone?.trim() || null, address: values.address?.trim() || null };
      const result = editingId ? await supabase.from("partners").update(payload).eq("id", editingId) : await supabase.from("partners").insert(payload);
      error = result.error;
    } else if (section === "indicators") {
      const payload = { school_id: scopedSchool, name: values.name?.trim(), description: values.description?.trim() || null, weight: Number(values.weight), max_score: Number(values.max_score) };
      const result = editingId ? await supabase.from("audit_indicators").update(payload).eq("id", editingId) : await supabase.from("audit_indicators").insert(payload);
      error = result.error;
    } else {
      const payload = { name: values.name?.trim(), npsn: values.npsn?.trim() || null, address: values.address?.trim() || null, city: values.city?.trim() || null, student_count: values.student_count ? Number(values.student_count) : null };
      const result = editingId ? await supabase.from("schools").update(payload).eq("id", editingId) : await supabase.from("schools").insert(payload);
      error = result.error;
    }
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Data diperbarui." : "Data ditambahkan.");
    setEditingId("");
    setValues({});
    await invalidateMasterDataQueries(queryClient);
  }

  async function archiveRecord(id: string) {
    if (!canEditSection) return;
    let error: { message: string } | null = null;
    if (section === "locations") error = (await supabase.from("locations").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error;
    else if (section === "sources") error = (await supabase.from("waste_sources").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error;
    else if (section === "types") error = (await supabase.from("waste_types").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error;
    else if (section === "partners") error = (await supabase.from("partners").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error;
    else if (section === "indicators") error = (await supabase.from("audit_indicators").update({ active: false }).eq("id", id)).error;
    else error = (await supabase.from("schools").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error;
    if (error) return toast.error(error.message);
    toast.success("Data diarsipkan.");
    await invalidateMasterDataQueries(queryClient);
  }

  const rows = recordsQuery.data ?? [];
  const globalScopeText = useMemo(() => isSuperAdmin && !schoolId ? "Data global" : "Data sekolah terpilih", [isSuperAdmin, schoolId]);

  return (
    <AppShell title="Master Data" description="Kelola sekolah dan konfigurasi pengelolaan sampah">
      {!isManager ? <div role="alert" className="eco-surface mb-4 p-4 text-sm">Pengelolaan master data hanya tersedia untuk administrator.</div> : null}
      <div className="space-y-4">
        {isSuperAdmin ? <div className="eco-surface flex flex-wrap items-center gap-3 p-4"><Label htmlFor="master-school" className="min-w-24">Lingkup data</Label><Select value={schoolId ?? "global"} onValueChange={(value) => setSchoolSelection(value === "global" ? "" : value)}><SelectTrigger id="master-school" className="w-full sm:w-80"><SelectValue placeholder="Data global" /></SelectTrigger><SelectContent><SelectItem value="global" disabled={section === "locations" || section === "schools"}>Global</SelectItem>{(schoolsQuery.data ?? []).map((school) => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}</SelectContent></Select><span className="text-xs text-muted-foreground">{globalScopeText}</span></div> : null}
        <Tabs value={section} onValueChange={(value) => { setSection(value as Section); setEditingId(""); setValues({}); }}>
          <div className="overflow-x-auto"><TabsList className="w-max min-w-full justify-start">{SECTIONS.map((item) => <TabsTrigger key={item.id} value={item.id} disabled={item.id === "schools" && !isSuperAdmin}>{item.label}</TabsTrigger>)}</TabsList></div>
          {SECTIONS.map((item) => <TabsContent key={item.id} value={item.id}>
            <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
              {canEditSection ? <form className="eco-surface space-y-4 p-4 sm:p-5" onSubmit={saveRecord}>
                <div className="flex items-center gap-2"><Database className="size-5 text-primary" /><h2 className="font-display font-bold">{editingId ? "Ubah" : "Tambah"} {item.label.toLowerCase()}</h2></div>
                {section !== "schools" && !schoolId && !isSuperAdmin ? <p role="alert" className="text-sm text-destructive">Akun belum terhubung ke sekolah.</p> : null}
                {sectionFields.map((field) => <div key={field.key} className="space-y-2">
                  <Label htmlFor={`master-${field.key}`}>{field.label}</Label>
                  {field.type === "select" ? <Select value={values[field.key] ?? ""} onValueChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}><SelectTrigger id={`master-${field.key}`}><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent>{field.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : field.type === "textarea" ? <textarea id={`master-${field.key}`} required={field.required} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" /> : field.type === "checkbox" ? <label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={values[field.key] === "true"} onChange={(event) => setValues((current) => ({ ...current, [field.key]: String(event.target.checked) }))} className="size-5 accent-primary" />Aktif</label> : <Input id={`master-${field.key}`} type={field.type ?? "text"} min={field.type === "number" ? "0" : undefined} step={field.key === "weight" || field.key === "default_price_per_kg" ? "0.01" : "1"} required={field.required} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}
                </div>)}
                <div className="flex gap-2"><Button type="submit" disabled={!isManager || recordsQuery.isLoading}><Plus /> {editingId ? "Simpan perubahan" : "Tambah data"}</Button>{editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(""); setValues({}); }}>Batal</Button> : null}</div>
              </form> : <div className="eco-surface flex min-h-40 items-center p-5 text-sm text-muted-foreground">Bagian ini hanya dapat dikelola super-admin.</div>}
              <section className="eco-surface min-w-0 p-4 sm:p-5"><div className="border-b border-border pb-3"><h2 className="font-display font-bold">Daftar {item.label.toLowerCase()}</h2><p className="text-xs text-muted-foreground">Nilai yang tersedia pada lingkup akses Anda</p></div>{recordsQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Data gagal dimuat.</p> : recordsQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Memuat data...</p> : rows.length ? <div className="divide-y divide-border">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.title}</p><p className="truncate text-xs text-muted-foreground">{row.detail}</p></div>{canEditSection ? <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon" title="Ubah" aria-label={`Ubah ${row.title}`} onClick={() => { setEditingId(row.id); setValues(row.values); }}><Pencil /></Button><Button type="button" variant="ghost" size="icon" title="Arsipkan" aria-label={`Arsipkan ${row.title}`} onClick={() => archiveRecord(row.id)}><Trash2 /></Button></div> : null}</div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data pada bagian ini.</p>}</section>
            </div>
          </TabsContent>)}
        </Tabs>
      </div>
    </AppShell>
  );
}
