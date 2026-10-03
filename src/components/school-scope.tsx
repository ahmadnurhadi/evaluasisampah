import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type SchoolScope = {
  isSuperAdmin: boolean;
  schoolId?: string;
  schools: { id: string; name: string }[];
  setSchoolId: (schoolId: string | undefined) => void;
};

const SchoolScopeContext = createContext<SchoolScope | null>(null);

export function SchoolScopeProvider({ children }: { children: ReactNode }) {
  const { user, roles } = useAuthProfile();
  const isSuperAdmin = roles.includes("super_admin");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const schoolsQuery = useQuery({
    queryKey: ["app-school-scope-options"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name").is("deleted_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <SchoolScopeContext.Provider value={{
      isSuperAdmin,
      schoolId: isSuperAdmin
        ? selectedSchoolId === null ? user?.profile?.school_id ?? undefined : selectedSchoolId || undefined
        : user?.profile?.school_id ?? undefined,
      schools: schoolsQuery.data ?? [],
      setSchoolId: setSelectedSchoolId,
    }}>
      {children}
    </SchoolScopeContext.Provider>
  );
}

export function useSchoolScope() {
  const context = useContext(SchoolScopeContext);
  if (!context) throw new Error("useSchoolScope must be used inside SchoolScopeProvider.");
  return context;
}