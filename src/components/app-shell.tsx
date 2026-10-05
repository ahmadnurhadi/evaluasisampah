import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  LayoutDashboard,
  PlusCircle,
  Truck,
  Boxes,
  SplitSquareHorizontal,
  Recycle,
  Sprout,
  Coins,
  ClipboardCheck,
  AlertTriangle,
  CalendarHeart,
  FileBarChart,
  Database,
  Settings,
  Menu,
  LogOut,
  Leaf,
  Trash2,
  QrCode,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthProfile } from "@/hooks/use-auth";
import { ROLE_LABEL } from "@/lib/waste";
import { cn } from "@/lib/utils";
import { useSchoolScope } from "@/components/school-scope";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavItem = { to: string; label: string; icon: typeof Leaf; permission?: "recorder" | "manager" };

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/input", label: "Input Sampah", icon: PlusCircle, permission: "recorder" },
  { to: "/collection", label: "Pengumpulan", icon: Truck, },
  { to: "/batches", label: "Batch Sampah", icon: Boxes },
  { to: "/sorting", label: "Pemilahan", icon: SplitSquareHorizontal, },
  { to: "/processing", label: "Pengolahan", icon: Recycle, },
  { to: "/utilization", label: "Pemanfaatan", icon: Sprout, },
  { to: "/waste-bank", label: "Bank Sampah", icon: Coins, permission: "manager" },
  { to: "/residual", label: "Residu", icon: Trash2, },
  { to: "/audits", label: "Audit", icon: ClipboardCheck },
  { to: "/findings", label: "Temuan", icon: AlertTriangle, },
  { to: "/activities", label: "Kegiatan", icon: CalendarHeart, },
  { to: "/reports", label: "Laporan", icon: FileBarChart },
  { to: "/qr", label: "QR Code", icon: QrCode, permission: "manager" },
  { to: "/master-data", label: "Master Data", icon: Database, permission: "manager" },
  { to: "/settings", label: "Pengguna dan Akses", icon: Settings, permission: "manager" },
];

function NavLinks({ onNavigate, canRecord, isManager, roles }: { onNavigate?: () => void; canRecord: boolean; isManager: boolean; roles: ReturnType<typeof useAuthProfile>["roles"] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.filter((item) => item.permission !== "recorder" || canRecord)
        .filter((item) => item.permission !== "manager" || isManager)
          .filter((item) => item.to !== "/settings" || roles.some((role) => role === "super_admin" || role === "school_admin"))
        .map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
        })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <span className="eco-gradient flex size-10 items-center justify-center rounded-xl text-primary-foreground">
        <Leaf className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm font-bold">ECO-SCHOOL</p>
        <p className="text-[11px] text-muted-foreground">Waste Management</p>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, roles, canInputWaste: canRecord, isManager } = useAuthProfile();
  const schoolScope = useSchoolScope();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  function handleBack() {
    if (router.history.canGoBack()) router.history.back();
    else navigate({ to: "/dashboard" });
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavLinks canRecord={canRecord} isManager={isManager} roles={roles} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <p className="truncate text-xs font-medium">{user?.profile?.full_name || user?.email}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {roles.map((r) => ROLE_LABEL[r]).join(", ") || "Tanpa peran"}
          </p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={handleSignOut}>
            <LogOut className="size-4" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Kembali" title="Kembali" onClick={handleBack}>
            <ArrowLeft className="size-5" />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Buka menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              <Brand />
              <div className="max-h-[calc(100vh-9rem)] overflow-y-auto">
                <NavLinks onNavigate={() => setOpen(false)} canRecord={canRecord} isManager={isManager} roles={roles} />
              </div>
              <div className="border-t border-sidebar-border p-3">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
                  <LogOut className="size-4" /> Keluar
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold">{title}</h1>
            {description ? (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {schoolScope.isSuperAdmin ? (
            <Select value={schoolScope.schoolId ?? "all"} onValueChange={(value) => schoolScope.setSchoolId(value === "all" ? "" : value)}>
              <SelectTrigger aria-label="Lingkup sekolah" className="w-28 shrink-0 sm:w-48">
                <SelectValue placeholder="Pilih sekolah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua sekolah</SelectItem>
                {schoolScope.schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {actions}
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-24">{children}</main>
      </div>
    </div>
  );
}
