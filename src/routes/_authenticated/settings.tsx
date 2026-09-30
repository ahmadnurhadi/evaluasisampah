import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateUserQueries } from "@/lib/query-invalidation";
import { ROLE_LABEL, type AppRole } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Pengguna dan Akses — Eco-School Waste Management" }] }),
  component: SettingsPage,
});

const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as AppRole[];

function SettingsPage() {
  const { user, roles } = useAuthProfile();
  const queryClient = useQueryClient();
  const isSuperAdmin = roles.includes("super_admin");
  const canManageUsers = isSuperAdmin || roles.includes("school_admin");
  const profileSchoolId = user?.profile?.school_id ?? undefined;
  const [schoolSelection, setSchoolSelection] = useState<string | null>(null);
  const schoolId = isSuperAdmin
    ? schoolSelection === null
      ? profileSchoolId
      : schoolSelection || undefined
    : profileSchoolId;
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleToAdd, setRoleToAdd] = useState<AppRole | "">("");
  const [schoolToAssign, setSchoolToAssign] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (schoolSelection === null && profileSchoolId) setSchoolSelection(profileSchoolId);
  }, [profileSchoolId, schoolSelection]);

  const schoolsQuery = useQuery({
    queryKey: ["user-admin-schools"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersQuery = useQuery({
    queryKey: ["managed-users", schoolId, isSuperAdmin],
    enabled: canManageUsers,
    queryFn: async () => {
      let request = supabase.from("profiles").select("id, full_name, email, school_id").order("full_name");
      if (schoolId) request = request.eq("school_id", schoolId);
      const { data: profiles, error } = await request;
      if (error) throw error;
      const profileRows = profiles ?? [];
      if (!profileRows.length) return [];
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .in("user_id", profileRows.map((profile) => profile.id));
      if (rolesError) throw rolesError;
      const byUser = new Map<string, { id: string; role: AppRole }[]>();
      for (const row of roleRows ?? []) {
        const current = byUser.get(row.user_id) ?? [];
        current.push({ id: row.id, role: row.role });
        byUser.set(row.user_id, current);
      }
      return profileRows.map((profile) => ({ ...profile, roles: byUser.get(profile.id) ?? [] }));
    },
  });

  const selectedUser = usersQuery.data?.find((profile) => profile.id === selectedUserId);
  const assignableRoles = useMemo(
    () => isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((role) => role !== "super_admin" && role !== "school_admin"),
    [isSuperAdmin],
  );

  async function assignSchool() {
    if (!isSuperAdmin || !selectedUserId || !schoolToAssign) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ school_id: schoolToAssign }).eq("id", selectedUserId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Akun berhasil dihubungkan ke sekolah.");
    setSchoolSelection(schoolToAssign);
    await invalidateUserQueries(queryClient);
  }

  async function addRole() {
    if (!selectedUserId || !roleToAdd) return;
    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: selectedUserId, role: roleToAdd });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Peran ${ROLE_LABEL[roleToAdd]} ditambahkan.`);
    setRoleToAdd("");
    await invalidateUserQueries(queryClient);
  }

  async function removeRole(roleId: string, role: AppRole) {
    if (!selectedUserId) return;
    setSaving(true);
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Peran ${ROLE_LABEL[role]} dihapus.`);
    await invalidateUserQueries(queryClient);
  }

  return (
    <AppShell title="Pengguna dan Akses" description="Hubungkan akun ke sekolah dan atur peran berbasis kewenangan">
      {!canManageUsers ? <div role="alert" className="eco-surface p-4 text-sm">Pengelolaan pengguna hanya tersedia untuk admin sekolah dan super-admin.</div> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
          <section className="eco-surface min-w-0 p-4 sm:p-5">
            {isSuperAdmin ? <div className="mb-4 space-y-2"><Label htmlFor="user-school">Sekolah</Label><Select value={schoolId ?? "all"} onValueChange={(value) => { setSchoolSelection(value === "all" ? "" : value); setSelectedUserId(""); }}><SelectTrigger id="user-school"><SelectValue placeholder="Semua sekolah" /></SelectTrigger><SelectContent><SelectItem value="all">Semua sekolah dan akun belum terhubung</SelectItem>{(schoolsQuery.data ?? []).map((school) => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}</SelectContent></Select></div> : null}
            <div className="border-b border-border pb-3"><h2 className="font-display font-bold">Akun terdaftar</h2><p className="text-xs text-muted-foreground">Akun dibuat melalui signup aplikasi</p></div>
            {usersQuery.isError ? <p role="alert" className="py-5 text-sm text-destructive">Daftar pengguna gagal dimuat.</p> : usersQuery.isLoading ? <p className="py-5 text-sm text-muted-foreground">Memuat pengguna...</p> : usersQuery.data?.length ? <div className="divide-y divide-border">{usersQuery.data.map((profile) => <button key={profile.id} type="button" onClick={() => { setSelectedUserId(profile.id); setSchoolToAssign(profile.school_id ?? ""); }} className={`w-full py-3 text-left ${selectedUserId === profile.id ? "text-primary" : ""}`}><span className="block truncate text-sm font-semibold">{profile.full_name || "Nama belum diisi"}</span><span className="block truncate text-xs text-muted-foreground">{profile.email ?? profile.id}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{profile.roles.map((role) => ROLE_LABEL[role.role]).join(", ") || "Tanpa peran"}{!profile.school_id ? " · belum terhubung ke sekolah" : ""}</span></button>)}</div> : <p className="py-6 text-sm text-muted-foreground">Tidak ada akun untuk lingkup ini.</p>}
          </section>

          <section className="eco-surface min-w-0 p-4 sm:p-5">
            {!selectedUser ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><UserCog className="size-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Pilih akun untuk mengelola sekolah dan role.</p></div> : <div className="space-y-6">
              <div className="border-b border-border pb-4"><div className="flex items-center gap-2"><UserCog className="size-5 text-primary" /><h2 className="font-display font-bold">{selectedUser.full_name || "Akun pengguna"}</h2></div><p className="mt-1 text-sm text-muted-foreground">{selectedUser.email ?? selectedUser.id}</p></div>
              {isSuperAdmin ? <div className="space-y-3"><h3 className="text-sm font-semibold">Sekolah pengguna</h3><div className="flex flex-col gap-2 sm:flex-row"><Select value={schoolToAssign} onValueChange={setSchoolToAssign}><SelectTrigger><SelectValue placeholder="Pilih sekolah" /></SelectTrigger><SelectContent>{(schoolsQuery.data ?? []).map((school) => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={assignSchool} disabled={!schoolToAssign || saving}>Hubungkan</Button></div></div> : null}
              <div className="space-y-3"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h3 className="text-sm font-semibold">Peran dan hak akses</h3></div>{selectedUser.roles.length ? <div className="divide-y divide-border rounded-md border border-border">{selectedUser.roles.map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-3 px-3 py-2"><span className="text-sm">{ROLE_LABEL[assignment.role]}</span><Button type="button" variant="ghost" size="sm" disabled={saving || (!isSuperAdmin && (assignment.role === "school_admin" || assignment.role === "super_admin"))} onClick={() => removeRole(assignment.id, assignment.role)}>Hapus</Button></div>)}</div> : <p className="text-sm text-muted-foreground">Pengguna ini belum memiliki role.</p>}
                <div className="flex flex-col gap-2 sm:flex-row"><Select value={roleToAdd} onValueChange={(value) => setRoleToAdd(value as AppRole)}><SelectTrigger><SelectValue placeholder="Pilih peran yang akan diberikan" /></SelectTrigger><SelectContent>{assignableRoles.filter((role) => !selectedUser.roles.some((assignment) => assignment.role === role)).map((role) => <SelectItem key={role} value={role}>{ROLE_LABEL[role]}</SelectItem>)}</SelectContent></Select><Button onClick={addRole} disabled={!roleToAdd || saving || !selectedUser.school_id && !isSuperAdmin}>{saving ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Tetapkan peran</Button></div>
                {!selectedUser.school_id ? <p className="text-xs text-muted-foreground">Hubungkan akun ke sekolah sebelum menetapkan peran sekolah.</p> : null}
              </div>
            </div>}
          </section>
        </div>
      )}
    </AppShell>
  );
}
