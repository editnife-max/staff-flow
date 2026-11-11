import { useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Group, Row, Segmented } from "./controls";
import { SLOT_OPTIONS, patch, type PanelProps } from "./types";

/** Shrinks a logo to at most 700px (PNG keeps transparency) before upload. */
async function shrinkLogo(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 700 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Couldn't read the image");
  return blob;
}

export function HeaderPanel({ config, update }: PanelProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const h = config.header;

  async function onLogo(file: File | undefined) {
    if (!file || !user) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Choose an image file (PNG, JPG or WebP).");
    setUploading(true);
    try {
      const blob = await shrinkLogo(file);
      // Logos live under custom-cv/<manager id>/ (the server only accepts that folder).
      const path = `custom-cv/${user.id}/${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage
        .from("candidate-files")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
      update(
        patch("header", {
          logoUrl: data.publicUrl,
          logoPosition: h.logoPosition === "hidden" ? "left" : h.logoPosition,
        }),
      );
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Group title="Header style">
        <Row label="Style">
          <Segmented
            label="Header style"
            value={h.style}
            onChange={(v) => update(patch("header", { style: v }))}
            options={[
              { value: "band", label: "Coloured band" },
              { value: "plain", label: "White + rule" },
              { value: "outline", label: "Outlined box" },
            ]}
          />
        </Row>
        <Row label="Height">
          <Segmented
            label="Header height"
            value={h.height}
            onChange={(v) => update(patch("header", { height: v }))}
            options={[
              { value: "compact", label: "Compact" },
              { value: "standard", label: "Standard" },
              { value: "tall", label: "Tall" },
            ]}
          />
        </Row>
      </Group>

      <Group title="Logo">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-32 shrink-0 items-center justify-center border border-dashed border-border bg-muted/30">
            {h.logoUrl ? (
              <img src={h.logoUrl} alt="Logo" className="max-h-14 max-w-28 object-contain" />
            ) : (
              <span className="text-[11px] text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-none"
              disabled={uploading}
              asChild
            >
              <label className="cursor-pointer">
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageUp className="mr-1.5 h-3.5 w-3.5" />
                )}
                {h.logoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onLogo(e.target.files?.[0])}
                />
              </label>
            </Button>
            {h.logoUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-start rounded-none text-destructive"
                onClick={() => update(patch("header", { logoUrl: null }))}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
        {h.logoUrl && (
          <>
            <Row label="Position">
              <Segmented
                label="Logo position"
                value={h.logoPosition}
                onChange={(v) => update(patch("header", { logoPosition: v }))}
                options={SLOT_OPTIONS}
              />
            </Row>
            <Row label="Size">
              <Segmented
                label="Logo size"
                value={h.logoSize}
                onChange={(v) => update(patch("header", { logoSize: v }))}
                options={[
                  { value: "s", label: "Small" },
                  { value: "m", label: "Medium" },
                  { value: "l", label: "Large" },
                ]}
              />
            </Row>
          </>
        )}
      </Group>

      <Group
        title="Company name"
        description="Shown large in the header; long names shrink to fit when size is Auto."
      >
        <Input
          value={h.companyName}
          maxLength={80}
          placeholder="Company name"
          onChange={(e) => update(patch("header", { companyName: e.target.value }))}
          className="rounded-none"
        />
        <Input
          value={h.companyNameAr}
          maxLength={80}
          dir="rtl"
          placeholder="اسم الشركة (اختياري)"
          onChange={(e) => update(patch("header", { companyNameAr: e.target.value }))}
          className="rounded-none"
        />
        <Input
          value={h.tagline}
          maxLength={90}
          placeholder="Tagline (optional), e.g. Licensed Foreign Employment Agency"
          onChange={(e) => update(patch("header", { tagline: e.target.value }))}
          className="rounded-none"
        />
        <Row label="Position">
          <Segmented
            label="Company name position"
            value={h.companyPosition}
            onChange={(v) => update(patch("header", { companyPosition: v }))}
            options={SLOT_OPTIONS}
          />
        </Row>
        <Row label="Size">
          <Segmented
            label="Company name size"
            value={h.companySize}
            onChange={(v) => update(patch("header", { companySize: v }))}
            options={[
              { value: "auto", label: "Auto" },
              { value: "s", label: "S" },
              { value: "m", label: "M" },
              { value: "l", label: "L" },
              { value: "xl", label: "XL" },
            ]}
          />
        </Row>
      </Group>

      <Group
        title="CV title"
        description="E.g. CURRICULUM VITAE / السيرة الذاتية. Placed under the company name when they share a position."
      >
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={h.titleEn}
            maxLength={50}
            placeholder="English title"
            onChange={(e) => update(patch("header", { titleEn: e.target.value }))}
            className="rounded-none"
          />
          <Input
            value={h.titleAr}
            maxLength={50}
            dir="rtl"
            placeholder="العنوان بالعربية"
            onChange={(e) => update(patch("header", { titleAr: e.target.value }))}
            className="rounded-none"
          />
        </div>
        <Row label="Position">
          <Segmented
            label="Title position"
            value={h.titlePosition}
            onChange={(v) => update(patch("header", { titlePosition: v }))}
            options={SLOT_OPTIONS}
          />
        </Row>
      </Group>
    </div>
  );
}
