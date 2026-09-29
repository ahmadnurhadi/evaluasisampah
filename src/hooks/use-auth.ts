import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MANAGER_ROLES, RECORDER_ROLES, type AppRole } from "@/lib/waste";

export function useAuthProfile() {
  const query = useQuery({
    queryKey: ["auth-profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        userId: user.id,
        email: user.email ?? "",
        profile,
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
  });

  const roles = query.data?.roles ?? [];
  return {
    ...query,
    user: query.data ?? null,
    roles,
    isManager: roles.some((r) => MANAGER_ROLES.includes(r)),
    canRecord: roles.some((r) => RECORDER_ROLES.includes(r)),
  };
}
