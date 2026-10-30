import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Leaf, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/use-auth";
import { ROLE_LABEL } from "@/lib/waste";
import { cn } from "@/lib/utils";
import { useSchoolScope } from "@/components/school-scope";
import { NAV_ITEMS, MENU_TILE_COLORS } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/menu")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Menu Utama — Eco-School Waste Management" },
      { name: "description", content: "Pilih modul pengelolaan sampah sekolah dari menu utama." },
      { property: "og:title", content: "Menu Utama — Eco-School Waste Management" },
      { property: "og:description", content: "Pilih modul pengelolaan sampah sekolah dari menu utama." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const { user, roles, canInputWaste: canRecord, isManager } = useAuthProfile();
  const schoolScope = useSchoolScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: { redirect: undefined } });
  }

  const items = NAV_ITEMS
    .filter((item) => item.permission !== "recorder" || canRecord)
    .filter((item) => item.permission !== "manager" || isManager)
    .filter((item) => item.to !== "/settings" || roles.some((role) => role === "super_admin" || role === "school_admin"));

  const firstName = (user?.profile?.full_name || user?.email || "").split(" ")[0];

  return (
    <div className="min-h-screen bg-sidebar pb-24">
      <header className="border-b border-sidebar-border bg-sidebar">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
          <span className="eco-gradient flex size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-sm font-bold">ECO-SCHOOL</p>
            <p className="text-[11px] text-muted-foreground">Waste Management</p>
          </div>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-xs font-medium">{user?.profile?.full_name || user?.email}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {roles.map((r) => ROLE_LABEL[r]).join(", ") || "Tanpa peran"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" /> Keluar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="font-display text-xl font-bold sm:text-2xl">
          Selamat datang{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilih modul yang ingin Anda buka.</p>

        {schoolScope.isSuperAdmin ? (
          <div className="mt-4 max-w-xs">
            <Select value={schoolScope.schoolId ?? "all"} onValueChange={(value) => schoolScope.setSchoolId(value === "all" ? "" : value)}>
              <SelectTrigger aria-label="Lingkup sekolah" className="h-12 w-full">
                <SelectValue placeholder="Pilih sekolah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua sekolah</SelectItem>
                {schoolScope.schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <nav aria-label="Menu utama" className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item, index) => (
            <MenuTile key={item.to} to={item.to} label={item.label} colorIndex={index} />
          ))}
        </nav>
      </main>
    </div>
  );
}

function MenuTile({ to, label, colorIndex }: { to: string; label: string; colorIndex: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(`${to}/`);
  const Icon = NAV_ITEMS.find((item) => item.to === to)?.icon ?? Leaf;
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl shadow-sm transition-transform active:scale-90 sm:size-16",
          MENU_TILE_COLORS[colorIndex % MENU_TILE_COLORS.length],
          active && "ring-2 ring-ring ring-offset-2 ring-offset-sidebar",
        )}
      >
        <Icon className="size-6" />
      </span>
      <span
        className={cn(
          "min-w-0 text-center text-xs font-medium leading-snug",
          active ? "text-primary" : "text-foreground/80",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
