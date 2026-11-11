// Contact icons for Custom CV headers and footers. Colours are passed explicitly
// (never currentColor) because html2canvas rasterises each SVG on its own.
import {
  AtSign,
  BadgeCheck,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Send,
  Smartphone,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { ContactKind } from "./config";

const CONTACT_ICONS: Record<ContactKind, LucideIcon> = {
  phone: Phone,
  mobile: Smartphone,
  whatsapp: MessageCircle,
  telegram: Send,
  email: Mail,
  website: Globe,
  address: MapPin,
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  linkedin: Linkedin,
  license: BadgeCheck,
};

export function ContactIcon({
  kind,
  size,
  color,
}: {
  kind: ContactKind;
  size: number;
  color: string;
}) {
  const Icon = CONTACT_ICONS[kind] ?? AtSign;
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={2.2}
      // html2canvas copies an SVG's computed styles onto its clone, including the app's
      // global oklch border/outline colours, which it can't parse. Pin them to plain values.
      style={{
        flexShrink: 0,
        display: "block",
        borderColor: "transparent",
        outlineColor: "transparent",
      }}
      aria-hidden
    />
  );
}
