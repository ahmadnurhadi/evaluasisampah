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
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>("");
  const schoolsQuery = useQuery({
    queryKey: ["app-school-scope-options", isSuperAdmin, user?.profile?.school_id],
    enabled: isSuperAdmin || Boolean(user?.profile?.school_id),
    queryFn: async () => {
      let request = supabase.from("schools").select("id, name").is("deleted_at", null).order("name");
      if (!isSuperAdmin && user?.profile?.school_id) request = request.eq("id", user.profile.school_id);
      const { data, error } = await request;
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
      setSchoolId: (id) => setSelectedSchoolId(id ?? ""),
    }}>
      {children}
    </SchoolScopeContext.Provider>
  );
}

export function useSchoolScope(): SchoolScope {
  const context = useContext(SchoolScopeContext);
  const { user, roles } = useAuthProfile();
  if (context) return context;
  // Fallback (e.g. after a hot reload recreates the context): use the account's own school.
  return {
    isSuperAdmin: roles.includes("super_admin"),
    schoolId: user?.profile?.school_id ?? undefined,
    schools: [],
    setSchoolId: () => {},
  };
}