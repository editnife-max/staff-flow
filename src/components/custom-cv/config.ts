// Custom CV templates: the design model.
//
// A template is one JSON document (custom_cv_templates.config). Everything here is plain
// data so it can be stored, validated on the server and rendered in the browser.
// normalizeConfig() is the single validator: it fills defaults, drops unknown values and
// keeps every section/field present exactly once, so older saved templates keep working
// when new options are added.
import type { CvData, SkillKey } from "@/components/cv-layouts/cv-data";

export const CONFIG_VERSION = 1;

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

export type Align = "left" | "center" | "right";
export const ALIGNS: Align[] = ["left", "center", "right"];

/** How the page body is arranged. "side" sections sit with the photo in every structure. */
export type Structure = "photo-column" | "sidebar" | "single" | "two-column" | "hero" | "flow";
export const STRUCTURE_IDS: Structure[] = [
  "photo-column",
  "sidebar",
  "single",
  "two-column",
  "hero",
  "flow",
];
/** Structures whose main sections flow into two balanced columns. */
export const TWO_COLUMN_FLOW: Structure[] = ["hero", "flow"];
export const STRUCTURES: Array<{
  id: Structure;
  name: string;
  description: string;
  sideLabel: string;
  mainLabel: string;
}> = [
  {
    id: "photo-column",
    name: "Photo column",
    description: "Photo in a column of its own with sections under it; the rest beside it.",
    sideLabel: "Photo column",
    mainLabel: "Main column",
  },
  {
    id: "sidebar",
    name: "Coloured sidebar",
    description: "Full-height coloured sidebar with the photo; header and sections beside it.",
    sideLabel: "Sidebar",
    mainLabel: "Main column",
  },
  {
    id: "single",
    name: "Single column",
    description: "Photo with a few sections beside it at the top, then full-width sections.",
    sideLabel: "Beside photo",
    mainLabel: "Full width",
  },
  {
    id: "two-column",
    name: "Two equal columns",
    description: "Page split in half: photo and sections on one side, sections on the other.",
    sideLabel: "Photo half",
    mainLabel: "Other half",
  },
  {
    id: "hero",
    name: "Hero band",
    description: "Photos and key details in a coloured band, then sections in two columns.",
    sideLabel: "In the band",
    mainLabel: "Two columns below",
  },
  {
    id: "flow",
    name: "Magazine flow",
    description:
      "Photos with key details at the top, then sections flowing into two balanced columns.",
    sideLabel: "Beside photo",
    mainLabel: "Two columns below",
  },
];

export type Zone = "side" | "main";
export type ColumnWidth = "narrow" | "medium" | "wide";
export const COLUMN_WIDTH_PX: Record<ColumnWidth, number> = { narrow: 210, medium: 250, wide: 290 };

export type HeaderStyle = "band" | "plain" | "outline";
export type HeaderHeight = "compact" | "standard" | "tall";
export const HEADER_HEIGHT_PX: Record<HeaderHeight, number> = {
  compact: 78,
  standard: 100,
  tall: 128,
};
export type SlotPosition = Align | "hidden";
export type Size = "s" | "m" | "l";
export type NameSize = "auto" | "s" | "m" | "l" | "xl";

export type PhotoShape = "rect" | "rounded" | "circle";

/** The passport photo stays in a top corner, separate from the full-size photo. */
export type SecondPlacement = "header-left" | "header-right";
export const SECOND_PLACEMENTS: Array<{ id: SecondPlacement; label: string }> = [
  { id: "header-left", label: "Top · left" },
  { id: "header-right", label: "Top · right" },
];
export type NameBlockStyle = "band" | "plain" | "none";

export type HeadingStyle = "bar" | "underline" | "accent" | "plain";
export type LabelMode = "bilingual" | "english" | "arabic";
export type Density = "compact" | "normal" | "relaxed";
export type PageBorder = "none" | "thin" | "thick";
export type FooterStyle = "band" | "line" | "plain";

export const FONTS: Array<{ family: string; weights: number[] }> = [
  { family: "Cairo", weights: [400, 600, 700, 800] },
  { family: "Tajawal", weights: [400, 500, 700, 800] },
  { family: "Almarai", weights: [400, 700, 800] },
  { family: "Noto Kufi Arabic", weights: [400, 600, 700, 800] },
  { family: "IBM Plex Sans Arabic", weights: [400, 500, 600, 700] },
];

// ---------------------------------------------------------------------------
// Contacts (header/footer items with icons)
// ---------------------------------------------------------------------------

export type ContactKind =
  | "phone"
  | "mobile"
  | "whatsapp"
  | "telegram"
  | "email"
  | "website"
  | "address"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "license";

export const CONTACT_KINDS: Array<{ id: ContactKind; label: string; placeholder: string }> = [
  { id: "phone", label: "Phone", placeholder: "+251 11 000 0000" },
  { id: "mobile", label: "Mobile", placeholder: "+251 9 0000 0000" },
  { id: "whatsapp", label: "WhatsApp", placeholder: "+251 9 0000 0000" },
  { id: "telegram", label: "Telegram", placeholder: "@youragency" },
  { id: "email", label: "Email", placeholder: "info@agency.com" },
  { id: "website", label: "Website", placeholder: "www.agency.com" },
  { id: "address", label: "Address", placeholder: "Bole, Addis Ababa" },
  { id: "facebook", label: "Facebook", placeholder: "YourAgency" },
  { id: "instagram", label: "Instagram", placeholder: "@youragency" },
  { id: "tiktok", label: "TikTok", placeholder: "@youragency" },
  { id: "youtube", label: "YouTube", placeholder: "YourAgency" },
  { id: "x", label: "X (Twitter)", placeholder: "@youragency" },
  { id: "linkedin", label: "LinkedIn", placeholder: "your-agency" },
  { id: "license", label: "License no.", placeholder: "Lic. 123/2024" },
];

/** Where a contact item is printed. */
export type Placement = `header-${Align}` | `footer-${Align}`;
export const PLACEMENTS: Array<{ id: Placement; label: string }> = [
  { id: "header-left", label: "Header · left" },
  { id: "header-center", label: "Header · centre" },
  { id: "header-right", label: "Header · right" },
  { id: "footer-left", label: "Footer · left" },
  { id: "footer-center", label: "Footer · centre" },
  { id: "footer-right", label: "Footer · right" },
];

export interface ContactItem {
  id: string;
  kind: ContactKind;
  /** Optional prefix, e.g. "Office". */
  label: string;
  value: string;
  placement: Placement;
}

// ---------------------------------------------------------------------------
// Fields and sections
// ---------------------------------------------------------------------------

export interface FieldDef {
  en: string;
  ar: string;
  value: (d: CvData) => string;
  /** Arabic value, when the data has one (nationality, religion…). */
  valueAr?: (d: CvData) => string;
}

const SKILL_LABELS: Record<SkillKey, [string, string]> = {
  cooking: ["Cooking", "الطبخ"],
  arabCooking: ["Arabic Cooking", "الطبخ العربي"],
  cleaning: ["Cleaning", "التنظيف"],
  washing: ["Laundry", "الغسيل"],
  ironing: ["Ironing", "الكي"],
  babySitting: ["Baby Sitting", "مجالسة الأطفال"],
  childCare: ["Child Care", "رعاية الأطفال"],
  elderCare: ["Elderly Care", "رعاية المسنين"],
  sewing: ["Sewing", "الخياطة"],
  computer: ["Computer", "الحاسوب"],
  tutoring: ["Tutoring", "التدريس"],
};
export const SKILL_KEYS = Object.keys(SKILL_LABELS) as SkillKey[];

export const FIELDS: Record<string, FieldDef> = {
  fullName: { en: "Full Name", ar: "الاسم الكامل", value: (d) => d.fullName },
  nationality: {
    en: "Nationality",
    ar: "الجنسية",
    value: (d) => d.nationalityEn,
    valueAr: (d) => d.nationalityAr,
  },
  religion: {
    en: "Religion",
    ar: "الديانة",
    value: (d) => d.religionEn,
    valueAr: (d) => d.religionAr,
  },
  dob: { en: "Date of Birth", ar: "تاريخ الميلاد", value: (d) => d.dob },
  age: { en: "Age", ar: "العمر", value: (d) => d.age },
  birthPlace: { en: "Place of Birth", ar: "مكان الميلاد", value: (d) => d.birthPlace },
  livingTown: { en: "Living Town", ar: "مكان السكن", value: (d) => d.livingTown },
  marital: {
    en: "Marital Status",
    ar: "الحالة الاجتماعية",
    value: (d) => d.maritalEn,
    valueAr: (d) => d.maritalAr,
  },
  children: { en: "No. of Children", ar: "عدد الأطفال", value: (d) => d.children },
  height: { en: "Height", ar: "الطول", value: (d) => d.height },
  weight: { en: "Weight", ar: "الوزن", value: (d) => d.weight },
  education: {
    en: "Education",
    ar: "المستوى التعليمي",
    value: (d) => d.educationEn,
    valueAr: (d) => d.educationAr,
  },

  passportNo: { en: "Passport No.", ar: "رقم الجواز", value: (d) => d.passportNo },
  passportIssue: { en: "Date of Issue", ar: "تاريخ الإصدار", value: (d) => d.passportIssue },
  passportExpiry: { en: "Date of Expiry", ar: "تاريخ الانتهاء", value: (d) => d.passportExpiry },
  placeOfIssue: { en: "Place of Issue", ar: "مكان الإصدار", value: (d) => d.placeOfIssue },

  serial: { en: "Reference No.", ar: "الرقم المرجعي", value: (d) => d.serial },
  occupation: {
    en: "Position Applied For",
    ar: "الوظيفة المطلوبة",
    value: (d) => d.occupationEn,
    valueAr: (d) => d.occupationAr,
  },
  salary: { en: "Monthly Salary", ar: "الراتب الشهري", value: (d) => d.salary },

  phone1: { en: "Contact No.", ar: "رقم الهاتف", value: (d) => d.phone1 },
  phone2: { en: "Emergency Contact", ar: "رقم الطوارئ", value: (d) => d.phone2 },

  experienceStatus: { en: "Experience", ar: "الخبرة", value: (d) => d.experienceEn },
  experienceCountry: { en: "Country", ar: "الدولة", value: (d) => d.experienceCountry },
  experienceYears: { en: "Period", ar: "المدة", value: (d) => d.experienceYears },

  english: { en: "English", ar: "الإنجليزية", value: (d) => d.englishLevel },
  arabic: { en: "Arabic", ar: "العربية", value: (d) => d.arabicLevel },

  remark: { en: "Remarks", ar: "ملاحظات", value: (d) => d.remark },

  ...Object.fromEntries(
    SKILL_KEYS.map((k): [string, FieldDef] => [
      `skill:${k}`,
      {
        en: SKILL_LABELS[k][0],
        ar: SKILL_LABELS[k][1],
        value: (d) => (d.hasSkill(k) ? "Yes" : ""),
      },
    ]),
  ),
};

export type SectionId =
  | "personal"
  | "passport"
  | "application"
  | "contact"
  | "languages"
  | "experience"
  | "skills"
  | "remarks";

/** How a section draws its fields. */
export type SectionStyle =
  "table" | "grid" | "list" | "ticks" | "bars" | "checklist" | "chips" | "box";

export interface SectionDef {
  en: string;
  ar: string;
  fields: string[];
  styles: Array<{ id: SectionStyle; label: string }>;
}

const TEXT_STYLES: SectionDef["styles"] = [
  { id: "table", label: "Bordered table" },
  { id: "grid", label: "Two-column grid" },
  { id: "list", label: "Simple list" },
];

export const SECTIONS: Record<SectionId, SectionDef> = {
  personal: {
    en: "Personal Details",
    ar: "البيانات الشخصية",
    fields: [
      "fullName",
      "nationality",
      "religion",
      "dob",
      "age",
      "birthPlace",
      "livingTown",
      "marital",
      "children",
      "height",
      "weight",
      "education",
    ],
    styles: TEXT_STYLES,
  },
  passport: {
    en: "Passport Details",
    ar: "بيانات الجواز",
    fields: ["passportNo", "passportIssue", "passportExpiry", "placeOfIssue"],
    styles: TEXT_STYLES,
  },
  application: {
    en: "Application",
    ar: "تفاصيل الطلب",
    fields: ["serial", "occupation", "salary"],
    styles: TEXT_STYLES,
  },
  contact: { en: "Contact", ar: "التواصل", fields: ["phone1", "phone2"], styles: TEXT_STYLES },
  languages: {
    en: "Languages",
    ar: "اللغات",
    fields: ["english", "arabic"],
    styles: [
      { id: "ticks", label: "Level tick boxes" },
      { id: "bars", label: "Level bars" },
      { id: "list", label: "Simple list" },
      { id: "table", label: "Bordered table" },
    ],
  },
  experience: {
    en: "Experience Abroad",
    ar: "الخبرة خارج البلاد",
    fields: ["experienceStatus", "experienceCountry", "experienceYears"],
    styles: [
      { id: "table", label: "Table row" },
      { id: "list", label: "Simple list" },
    ],
  },
  skills: {
    en: "Skills",
    ar: "المهارات",
    fields: SKILL_KEYS.map((k) => `skill:${k}`),
    styles: [
      { id: "checklist", label: "Checklist (ticked / unticked)" },
      { id: "chips", label: "Only the candidate's skills" },
    ],
  },
  remarks: {
    en: "Remarks",
    ar: "ملاحظات",
    fields: ["remark"],
    styles: [{ id: "box", label: "Text box" }],
  },
};
export const SECTION_IDS = Object.keys(SECTIONS) as SectionId[];

export interface FieldToggle {
  id: string;
  enabled: boolean;
}

export interface SectionConfig {
  id: SectionId;
  enabled: boolean;
  zone: Zone;
  style: SectionStyle;
  /** Heading override; "" uses the default. */
  titleEn: string;
  titleAr: string;
  /** Ordered. */
  fields: FieldToggle[];
}

// ---------------------------------------------------------------------------
// The template config
// ---------------------------------------------------------------------------

export interface CustomCvConfig {
  v: number;
  structure: Structure;
  photoSide: "left" | "right";
  columnWidth: ColumnWidth;
  attachPassport: boolean;

  theme: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
    font: string;
    /** 0.85 – 1.15 */
    fontScale: number;
    density: Density;
    corners: "square" | "rounded";
    headingStyle: HeadingStyle;
    labels: LabelMode;
    arabicValues: boolean;
    hideEmpty: boolean;
    pageBorder: PageBorder;
  };

  header: {
    style: HeaderStyle;
    height: HeaderHeight;
    logoUrl: string | null;
    logoPosition: SlotPosition;
    logoSize: Size;
    companyName: string;
    companyNameAr: string;
    companyPosition: SlotPosition;
    companySize: NameSize;
    titleEn: string;
    titleAr: string;
    titlePosition: SlotPosition;
    tagline: string;
  };

  photo: {
    show: boolean;
    shape: PhotoShape;
    size: Size;
    frame: boolean;
    videoButtons: boolean;
    /** Optional passport-size photo, kept in a top corner separately from the full-size photo. */
    second: {
      show: boolean;
      placement: SecondPlacement;
      size: Size;
      shape: PhotoShape;
    };
  };

  nameBlock: {
    style: NameBlockStyle;
    showPosition: boolean;
    showNationality: boolean;
  };

  /** Ordered. */
  sections: SectionConfig[];

  contacts: ContactItem[];

  footer: {
    show: boolean;
    style: FooterStyle;
    companyPosition: SlotPosition;
    note: string;
    notePosition: Align;
  };
}

const DEFAULT_SECTION_ZONE: Record<SectionId, Zone> = {
  personal: "main",
  passport: "main",
  application: "main",
  contact: "side",
  languages: "side",
  experience: "main",
  skills: "main",
  remarks: "main",
};
const DEFAULT_SECTION_STYLE: Record<SectionId, SectionStyle> = {
  personal: "table",
  passport: "table",
  application: "table",
  contact: "list",
  languages: "ticks",
  experience: "table",
  skills: "checklist",
  remarks: "box",
};

function defaultSections(): SectionConfig[] {
  const order: SectionId[] = [
    "application",
    "personal",
    "passport",
    "contact",
    "languages",
    "experience",
    "skills",
    "remarks",
  ];
  return order.map((id) => ({
    id,
    enabled: id !== "remarks",
    zone: DEFAULT_SECTION_ZONE[id],
    style: DEFAULT_SECTION_STYLE[id],
    titleEn: "",
    titleAr: "",
    // fullName duplicates the name block by default.
    fields: SECTIONS[id].fields.map((f) => ({
      id: f,
      enabled: f !== "fullName" && f !== "livingTown",
    })),
  }));
}

export function defaultConfig(): CustomCvConfig {
  return {
    v: CONFIG_VERSION,
    structure: "photo-column",
    photoSide: "left",
    columnWidth: "medium",
    attachPassport: true,
    theme: {
      primary: "#1a3a52",
      secondary: "#5cb8c4",
      text: "#1f2937",
      background: "#ffffff",
      font: "Cairo",
      fontScale: 1,
      density: "normal",
      corners: "rounded",
      headingStyle: "bar",
      labels: "bilingual",
      arabicValues: false,
      hideEmpty: false,
      pageBorder: "none",
    },
    header: {
      style: "band",
      height: "standard",
      logoUrl: null,
      logoPosition: "left",
      logoSize: "m",
      companyName: "",
      companyNameAr: "",
      companyPosition: "center",
      companySize: "auto",
      titleEn: "CURRICULUM VITAE",
      titleAr: "السيرة الذاتية",
      titlePosition: "right",
      tagline: "",
    },
    photo: {
      show: true,
      shape: "rounded",
      size: "m",
      frame: true,
      videoButtons: true,
      second: { show: false, placement: "header-left", size: "m", shape: "rect" },
    },
    nameBlock: { style: "band", showPosition: true, showNationality: true },
    sections: defaultSections(),
    contacts: [],
    footer: {
      show: true,
      style: "line",
      companyPosition: "hidden",
      note: "",
      notePosition: "center",
    },
  };
}

// ---------------------------------------------------------------------------
// Presets: complete starting points for a new template
// ---------------------------------------------------------------------------

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function preset(
  patch: DeepPartial<CustomCvConfig>,
  sections?: (s: SectionConfig[]) => SectionConfig[],
): CustomCvConfig {
  const base = defaultConfig();
  const merged: CustomCvConfig = {
    ...base,
    ...patch,
    theme: { ...base.theme, ...patch.theme },
    header: { ...base.header, ...patch.header },
    photo: {
      ...base.photo,
      ...patch.photo,
      second: { ...base.photo.second, ...patch.photo?.second },
    } as CustomCvConfig["photo"],
    nameBlock: { ...base.nameBlock, ...patch.nameBlock },
    footer: { ...base.footer, ...patch.footer },
    sections: base.sections,
    contacts: [],
  } as CustomCvConfig;
  if (sections) merged.sections = sections(merged.sections);
  return merged;
}

const zones = (map: Partial<Record<SectionId, Zone>>) => (s: SectionConfig[]) =>
  s.map((x) => ({ ...x, zone: map[x.id] ?? x.zone }));
const styles = (map: Partial<Record<SectionId, SectionStyle>>) => (s: SectionConfig[]) =>
  s.map((x) => ({ ...x, style: map[x.id] ?? x.style }));

export const PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  config: () => CustomCvConfig;
}> = [
  {
    id: "corporate",
    name: "Corporate",
    description: "Coloured header band, photo column, bordered tables.",
    config: () => preset({}),
  },
  {
    id: "official",
    name: "Official Form",
    description: "Government-form look: outlined header, square corners, everything in tables.",
    config: () =>
      preset(
        {
          header: {
            style: "outline",
            height: "tall",
            titleEn: "APPLICATION FOR EMPLOYMENT",
            titleAr: "طلب توظيف",
            // Company name large in the centre with the form title under it.
            titlePosition: "center",
            companyPosition: "center",
          },
          theme: {
            primary: "#365f91",
            secondary: "#8db3e0",
            corners: "square",
            headingStyle: "bar",
            density: "compact",
          },
          // Official forms carry a small passport photo in the top corner too.
          photo: { shape: "rect", second: { show: true, placement: "header-right", size: "m" } },
          nameBlock: { style: "plain" },
          footer: { style: "line" },
        },
        (s) =>
          // Wide tables in the main column; the short application list under the photo.
          styles({ contact: "table", languages: "ticks", application: "list" })(
            zones({ contact: "main", languages: "main", passport: "main", application: "side" })(s),
          ),
      ),
  },
  {
    id: "modern",
    name: "Modern Sidebar",
    description: "Full-height coloured sidebar with photo, contact, languages and skills.",
    config: () =>
      preset(
        {
          structure: "sidebar",
          columnWidth: "wide",
          header: {
            style: "plain",
            companyPosition: "left",
            titlePosition: "right",
            logoPosition: "hidden",
          },
          theme: { primary: "#1e3a5f", secondary: "#f59e0b", headingStyle: "underline" },
          photo: { shape: "rounded" },
          nameBlock: { style: "plain" },
        },
        (s) =>
          styles({
            personal: "grid",
            passport: "grid",
            application: "grid",
            languages: "bars",
            skills: "checklist",
          })(zones({ skills: "side", languages: "side", contact: "side" })(s)),
      ),
  },
  {
    id: "letterhead",
    name: "Letterhead",
    description: "White letterhead with logo and name on the left, accent headings, grid details.",
    config: () =>
      preset(
        {
          photoSide: "right",
          header: {
            style: "plain",
            logoPosition: "left",
            companyPosition: "left",
            titlePosition: "right",
            height: "standard",
          },
          theme: { primary: "#a42449", secondary: "#074f6a", headingStyle: "accent" },
          nameBlock: { style: "band" },
        },
        (s) => styles({ personal: "grid", passport: "grid", application: "grid" })(s),
      ),
  },
  {
    id: "compact",
    name: "Single Column",
    description: "Photo with application details beside it, then full-width sections. Fits a lot.",
    config: () =>
      preset(
        {
          structure: "single",
          header: {
            style: "band",
            height: "compact",
            companyPosition: "left",
            titlePosition: "right",
          },
          theme: {
            primary: "#14532d",
            secondary: "#65a30d",
            density: "compact",
            headingStyle: "underline",
          },
          photo: { size: "s" },
          nameBlock: { style: "none" },
        },
        // No name band here, so the personal table carries the full name.
        (s) =>
          zones({
            application: "side",
            contact: "side",
            personal: "main",
            passport: "main",
            languages: "main",
          })(s).map((x) =>
            x.id === "personal"
              ? {
                  ...x,
                  fields: x.fields.map((f) => (f.id === "fullName" ? { ...f, enabled: true } : f)),
                }
              : x,
          ),
      ),
  },
  {
    id: "two-photos",
    name: "Two Photos",
    description: "Full-size photo in the photo column; passport photo in a separate top corner.",
    config: () =>
      preset(
        {
          photo: { size: "l", second: { show: true, placement: "header-left", size: "s" } },
          theme: { primary: "#0f4c5c", secondary: "#e36414" },
        },
        (s) => zones({ contact: "main" })(s),
      ),
  },
  {
    id: "hero",
    name: "Hero Band",
    description: "Both photos and key details in a coloured band; sections in two columns below.",
    config: () =>
      preset(
        {
          structure: "hero",
          header: {
            style: "plain",
            companyPosition: "left",
            titlePosition: "right",
            height: "compact",
          },
          theme: {
            primary: "#1e3a5f",
            secondary: "#f59e0b",
            headingStyle: "underline",
            density: "compact",
          },
          photo: { size: "s", second: { show: true, placement: "header-left", size: "s" } },
          nameBlock: { style: "plain" },
        },
        (s) =>
          styles({ application: "list", contact: "list", languages: "bars" })(
            zones({ application: "side", contact: "side", languages: "main", personal: "main" })(s),
          ),
      ),
  },
  {
    id: "two-column",
    name: "Two Columns",
    description:
      "Page split in half: photo and personal details on one side, the rest on the other.",
    config: () =>
      preset(
        {
          structure: "two-column",
          header: { style: "band", companyPosition: "center", titlePosition: "right" },
          theme: {
            primary: "#4c1d95",
            secondary: "#a78bfa",
            headingStyle: "accent",
            density: "compact",
          },
          photo: { size: "s" },
          nameBlock: { style: "band" },
        },
        (s) =>
          styles({ personal: "list", passport: "list", application: "list", contact: "list" })(
            zones({
              personal: "side",
              contact: "side",
              application: "main",
              passport: "main",
              languages: "main",
            })(s),
          ),
      ),
  },
  {
    id: "magazine",
    name: "Magazine",
    description: "Photo with key details at the top, sections flowing into two balanced columns.",
    config: () =>
      preset(
        {
          structure: "flow",
          header: {
            style: "band",
            height: "compact",
            companyPosition: "left",
            titlePosition: "right",
          },
          theme: {
            primary: "#7f1d1d",
            secondary: "#d97706",
            headingStyle: "bar",
            density: "compact",
          },
          photo: { size: "m", second: { show: true, placement: "header-left", size: "s" } },
          nameBlock: { style: "band" },
        },
        (s) =>
          styles({ application: "grid", personal: "table" })(
            zones({
              application: "side",
              contact: "side",
              personal: "main",
              passport: "main",
              languages: "main",
            })(s),
          ),
      ),
  },
];

// ---------------------------------------------------------------------------
// Validation / normalisation
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const str = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const color = (v: unknown, fallback: string): string =>
  typeof v === "string" && HEX.test(v) ? v : fallback;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const SLOT_POSITIONS: SlotPosition[] = ["left", "center", "right", "hidden"];
const PLACEMENT_IDS = PLACEMENTS.map((p) => p.id);
const CONTACT_IDS = CONTACT_KINDS.map((k) => k.id);

function normalizeSections(raw: unknown): SectionConfig[] {
  const defaults = defaultSections();
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<SectionId>();
  const out: SectionConfig[] = [];
  for (const item of list) {
    const s = obj(item);
    const id = s.id as SectionId;
    if (!SECTION_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    const def = defaults.find((d) => d.id === id)!;
    const allowed = SECTIONS[id].fields;
    const fieldSeen = new Set<string>();
    const fields: FieldToggle[] = [];
    for (const f of Array.isArray(s.fields) ? s.fields : []) {
      const fo = obj(f);
      const fid = typeof fo.id === "string" ? fo.id : "";
      if (!allowed.includes(fid) || fieldSeen.has(fid)) continue;
      fieldSeen.add(fid);
      fields.push({ id: fid, enabled: bool(fo.enabled, true) });
    }
    // Fields added to the app later appear (disabled) at the end.
    for (const fid of allowed) if (!fieldSeen.has(fid)) fields.push({ id: fid, enabled: false });
    out.push({
      id,
      enabled: bool(s.enabled, def.enabled),
      zone: pick(s.zone, ["side", "main"] as const, def.zone),
      style: pick(
        s.style,
        SECTIONS[id].styles.map((x) => x.id),
        def.style,
      ),
      titleEn: str(s.titleEn, 40),
      titleAr: str(s.titleAr, 40),
      fields,
    });
  }
  // Sections added to the app later appear (disabled) at the end.
  for (const d of defaults) if (!seen.has(d.id)) out.push({ ...d, enabled: false });
  return out;
}

/** Validates and completes a stored or imported config. Never throws. */
export function normalizeConfig(raw: unknown): CustomCvConfig {
  const d = defaultConfig();
  const r = obj(raw);
  const t = obj(r.theme);
  const h = obj(r.header);
  const p = obj(r.photo);
  const secondPhoto = obj(p.second);
  // Older configs could make the passport photo primary and the full-size photo secondary.
  // Migrate those visibility toggles to the new fixed roles before dropping `source`.
  const legacyHeadFirst = p.source === "head";
  const n = obj(r.nameBlock);
  const f = obj(r.footer);
  const fontScale =
    typeof t.fontScale === "number" && Number.isFinite(t.fontScale)
      ? Math.min(1.15, Math.max(0.85, t.fontScale))
      : 1;

  return {
    v: CONFIG_VERSION,
    structure: pick(r.structure, STRUCTURE_IDS, d.structure),
    photoSide: pick(r.photoSide, ["left", "right"] as const, d.photoSide),
    columnWidth: pick(r.columnWidth, ["narrow", "medium", "wide"] as const, d.columnWidth),
    attachPassport: bool(r.attachPassport, d.attachPassport),
    theme: {
      primary: color(t.primary, d.theme.primary),
      secondary: color(t.secondary, d.theme.secondary),
      text: color(t.text, d.theme.text),
      background: color(t.background, d.theme.background),
      font: pick(
        t.font,
        FONTS.map((x) => x.family),
        d.theme.font,
      ),
      fontScale: Math.round(fontScale * 100) / 100,
      density: pick(t.density, ["compact", "normal", "relaxed"] as const, d.theme.density),
      corners: pick(t.corners, ["square", "rounded"] as const, d.theme.corners),
      headingStyle: pick(
        t.headingStyle,
        ["bar", "underline", "accent", "plain"] as const,
        d.theme.headingStyle,
      ),
      labels: pick(t.labels, ["bilingual", "english", "arabic"] as const, d.theme.labels),
      arabicValues: bool(t.arabicValues, d.theme.arabicValues),
      hideEmpty: bool(t.hideEmpty, d.theme.hideEmpty),
      pageBorder: pick(t.pageBorder, ["none", "thin", "thick"] as const, d.theme.pageBorder),
    },
    header: {
      style: pick(h.style, ["band", "plain", "outline"] as const, d.header.style),
      height: pick(h.height, ["compact", "standard", "tall"] as const, d.header.height),
      logoUrl:
        typeof h.logoUrl === "string" && /^https:\/\//.test(h.logoUrl)
          ? h.logoUrl.slice(0, 500)
          : null,
      logoPosition: pick(h.logoPosition, SLOT_POSITIONS, d.header.logoPosition),
      logoSize: pick(h.logoSize, ["s", "m", "l"] as const, d.header.logoSize),
      companyName: str(h.companyName, 80),
      companyNameAr: str(h.companyNameAr, 80),
      companyPosition: pick(h.companyPosition, SLOT_POSITIONS, d.header.companyPosition),
      companySize: pick(
        h.companySize,
        ["auto", "s", "m", "l", "xl"] as const,
        d.header.companySize,
      ),
      titleEn: str(h.titleEn, 50, d.header.titleEn),
      titleAr: str(h.titleAr, 50, d.header.titleAr),
      titlePosition: pick(h.titlePosition, SLOT_POSITIONS, d.header.titlePosition),
      tagline: str(h.tagline, 90),
    },
    photo: {
      show: legacyHeadFirst
        ? bool(secondPhoto.show, d.photo.second.show)
        : bool(p.show, d.photo.show),
      shape: pick(p.shape, ["rect", "rounded", "circle"] as const, d.photo.shape),
      size: pick(p.size, ["s", "m", "l"] as const, d.photo.size),
      frame: bool(p.frame, d.photo.frame),
      videoButtons: bool(p.videoButtons, d.photo.videoButtons),
      second: {
        show: legacyHeadFirst
          ? bool(p.show, d.photo.show)
          : bool(secondPhoto.show, d.photo.second.show),
        // Former templates could stack the two photos in a column or name band. Keep the
        // passport photo in a top corner after normalization.
        placement: pick(secondPhoto.placement, SECOND_PLACEMENTS.map((x) => x.id), "header-left"),
        size: pick(secondPhoto.size, ["s", "m", "l"] as const, d.photo.second.size),
        shape: pick(
          secondPhoto.shape,
          ["rect", "rounded", "circle"] as const,
          d.photo.second.shape,
        ),
      },
    },
    nameBlock: {
      style: pick(n.style, ["band", "plain", "none"] as const, d.nameBlock.style),
      showPosition: bool(n.showPosition, d.nameBlock.showPosition),
      showNationality: bool(n.showNationality, d.nameBlock.showNationality),
    },
    sections: normalizeSections(r.sections),
    contacts: (Array.isArray(r.contacts) ? r.contacts : [])
      .slice(0, 12)
      .flatMap((c, i): ContactItem[] => {
        const o = obj(c);
        const value = str(o.value, 80).trim();
        if (!value) return [];
        return [
          {
            id: str(o.id, 40) || `c${i}`,
            kind: pick(o.kind, CONTACT_IDS, "phone"),
            label: str(o.label, 24),
            value,
            placement: pick(o.placement, PLACEMENT_IDS, "footer-center"),
          },
        ];
      }),
    footer: {
      show: bool(f.show, d.footer.show),
      style: pick(f.style, ["band", "line", "plain"] as const, d.footer.style),
      companyPosition: pick(f.companyPosition, SLOT_POSITIONS, d.footer.companyPosition),
      note: str(f.note, 120),
      notePosition: pick(f.notePosition, ALIGNS, d.footer.notePosition),
    },
  };
}

/** The colour of text drawn on `bg` (#rrggbb): white on dark backgrounds, ink on light. */
export function onColor(bg: string, dark = "#111827"): string {
  const n = parseInt(bg.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? dark : "#ffffff";
}

/** Mixes a #rrggbb colour with white; t=0 keeps the colour, t=1 gives white. */
export function tint(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const v = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${(v | (1 << 24)).toString(16).slice(1)}`;
}

export const COLOR_THEMES: Array<{ name: string; primary: string; secondary: string }> = [
  { name: "Staff-Flow", primary: "#1a3a52", secondary: "#5cb8c4" },
  { name: "Forest", primary: "#14532d", secondary: "#c9a227" },
  { name: "Maroon", primary: "#a42449", secondary: "#074f6a" },
  { name: "Royal", primary: "#4c1d95", secondary: "#f59e0b" },
  { name: "Charcoal", primary: "#1f2937", secondary: "#dc2626" },
  { name: "Ocean", primary: "#0369a1", secondary: "#f97316" },
  { name: "Official", primary: "#365f91", secondary: "#8db3e0" },
  { name: "Olive", primary: "#4d6b1f", secondary: "#9bba58" },
];
