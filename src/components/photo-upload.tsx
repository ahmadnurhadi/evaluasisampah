import { useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { EvidenceImage } from "@/components/evidence-image";

export function PhotoUpload({
  value,
  onChange,
  label = "Foto bukti",
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const { data: userData } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userData.user?.id ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("evidence").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) return toast.error("Gagal mengunggah foto.");
    onChange(path);
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {value ? (
        <div className="relative w-fit">
          <EvidenceImage path={value} className="h-28 w-28 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
            aria-label="Hapus foto"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <label className="flex h-28 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          {uploading ? "Mengunggah..." : "Ambil / pilih foto"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

export function PhotoButton({ onUploaded }: { onUploaded: (path: string) => void }) {
  return <Button variant="outline" onClick={() => onUploaded("")}>Foto</Button>;
}
