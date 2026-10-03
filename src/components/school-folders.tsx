import { Children, useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SchoolFolderRecord = object;
type School = { id: string; name: string };

export function SchoolFolders<T extends SchoolFolderRecord>({
  records,
  schools,
  renderRecord,
  children,
  getSchoolId,
  getSummary,
  emptyMessage,
}: {
  records: T[];
  schools: School[];
  renderRecord?: (record: T, index: number) => ReactNode;
  children?: ReactNode;
  getSchoolId?: (record: T) => string | null | undefined;
  getSummary?: (records: T[]) => ReactNode;
  emptyMessage: string;
}) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const childRows = Children.toArray(children);
  const groups = useMemo(() => {
    const grouped = new Map<string, { record: T; index: number }[]>();
    records.forEach((record, index) => {
      const schoolId = (getSchoolId ? getSchoolId(record) : (record as { school_id?: string | null }).school_id) ?? "unknown";
      grouped.set(schoolId, [...(grouped.get(schoolId) ?? []), { record, index }]);
    });
    return [...grouped.entries()].sort(([leftId], [rightId]) => {
      const leftName = schools.find((school) => school.id === leftId)?.name ?? "Sekolah belum diketahui";
      const rightName = schools.find((school) => school.id === rightId)?.name ?? "Sekolah belum diketahui";
      return leftName.localeCompare(rightName, "id");
    });
  }, [getSchoolId, records, schools]);

  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;

  return (
    <div className="divide-y divide-border">
      {groups.map(([schoolId, schoolRecords]) => {
        const isOpen = opened[schoolId] ?? false;
        const visibleCount = visibleCounts[schoolId] ?? 5;
        const schoolName = schools.find((school) => school.id === schoolId)?.name ?? "Sekolah belum diketahui";
        return (
          <section key={schoolId}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpened((current) => ({ ...current, [schoolId]: !isOpen }))}
              className="flex min-h-14 w-full items-center gap-3 py-3 text-left hover:text-primary"
            >
              {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
              <Building2 className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{schoolName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{getSummary ? getSummary(schoolRecords.map(({ record }) => record)) : `${schoolRecords.length} catatan`}</span>
              <span className="shrink-0 text-xs font-medium text-primary">{isOpen ? "Tutup detail" : "Detail"}</span>
            </button>
            {isOpen ? (
              <div className="pb-3 pl-4 sm:pl-7">
                <div className="divide-y divide-border">
                  {schoolRecords.slice(0, visibleCount).map(({ record, index }) => renderRecord ? renderRecord(record, index) : childRows[index])}
                </div>
                {visibleCount < schoolRecords.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setVisibleCounts((current) => ({ ...current, [schoolId]: visibleCount + 5 }))}
                  >
                    Muat lainnya ({schoolRecords.length - visibleCount} tersisa)
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}