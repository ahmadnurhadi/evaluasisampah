import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function EvidenceImage({
  path,
  className,
  alt = "Foto bukti",
}: {
  path: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const { data } = useQuery({
    queryKey: ["signed-url", path],
    enabled: Boolean(path),
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    },
  });

  if (!path) return null;
  if (!data) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-4" />
      </div>
    );
  }
  return <img src={data} alt={alt} className={cn("object-cover", className)} loading="lazy" />;
}
