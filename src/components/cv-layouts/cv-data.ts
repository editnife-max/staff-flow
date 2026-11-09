// Normalised, display-ready candidate values shared by every code-built CV layout.
// Rules mirror src/lib/docx-fill.ts so a layout's PDF shows the same values as the
// filled DOCX (salary, first-timer detection, skill aliases, language levels).
import {
  AR_EDUCATION,
  AR_MARITAL,
  AR_OCCUPATION,
  AR_RELIGION,
  AR_LEVEL,
  EN_EDUCATION,
  EN_EXPERIENCE,
  EN_LEVEL,
  EN_MARITAL,
  EN_OCCUPATION,
  EN_RELIGION,
  computeAge,
  toArabic,
  toEnglish,
} from "@/lib/docx-fill";
import type { Candidate } from "@/lib/docx-fill";

export type SkillKey =
  | "cooking"
  | "arabCooking"
  | "cleaning"
  | "washing"
  | "ironing"
  | "babySitting"
  | "childCare"
  | "elderCare"
  | "sewing"
  | "computer"
  | "tutoring";

const SKILL_KEYWORDS: Record<SkillKey, string[]> = {
  cooking: ["COOKING", "COOK"],
  arabCooking: ["ARAB COOKING", "ARABIC COOKING"],
  cleaning: ["CLEANING", "CLEAN"],
  washing: ["WASHING", "WASH", "LAUNDRY"],
  ironing: ["IRONING", "IRON"],
  babySitting: ["BABYSITTING", "BABY SITTING", "BABYSITTER"],
  childCare: [
    "CHILD CARE",
    "CHILDCARE",
    "CHILDCARING",
    "CHILDREN CARE",
    "BABYSITTING",
    "BABY SITTING",
  ],
  elderCare: ["ELDERLY CARE", "ELDER CARE", "ELDERLY"],
  sewing: ["SEWING", "TAILOR"],
  computer: ["COMPUTER"],
  tutoring: ["TUTORING", "TUTOR", "TEACHING"],
};

// Four-step scale used by the Tadbeer language table.
export type LevelStep = "POOR" | "LITTLE" | "FAIR" | "FLUENT";
const LEVEL_STEP: Record<string, LevelStep> = {
  POOR: "POOR",
  NONE: "POOR",
  NO: "POOR",
  BASIC: "LITTLE",
  LITTLE: "LITTLE",
  FAIR: "FAIR",
  AVERAGE: "FAIR",
  GOOD: "FAIR",
  "VERY GOOD": "FLUENT",
  EXCELLENT: "FLUENT",
  FLUENT: "FLUENT",
};

const AR_COUNTRY: Record<string, string> = {
  ETHIOPIA: "إثيوبيا",
  KENYA: "كينيا",
  UGANDA: "أوغندا",
  PHILIPPINES: "الفلبين",
  INDONESIA: "إندونيسيا",
  "SRI LANKA": "سريلانكا",
  INDIA: "الهند",
  BANGLADESH: "بنغلاديش",
  NEPAL: "نيبال",
  GHANA: "غانا",
  NIGERIA: "نيجيريا",
  BURUNDI: "بوروندي",
  RWANDA: "رواندا",
  TANZANIA: "تنزانيا",
  SUDAN: "السودان",
  ERITREA: "إريتريا",
  SOMALIA: "الصومال",
  "SIERRA LEONE": "سيراليون",
  MADAGASCAR: "مدغشقر",
  PAKISTAN: "باكستان",
};

export interface CvPhotos {
  /** Passport-size head shot (falls back to the full photo). */
  photo: string | null;
  /** Full-length photo (falls back to the head shot). */
  fullPhoto: string | null;
}

/** Links behind the CV's "Play video" / "Download video" buttons. */
export interface VideoLinks {
  /** Opens the video in a player (Drive preview, or the file itself in the browser). */
  play: string;
  /** Saves the file straight from storage, with no page or proxy in between. */
  download: string;
}

/**
 * Builds play/download links for a candidate's video URL. Download links ask the host to
 * send the file as an attachment so it saves directly instead of opening a player:
 * Google Drive skips its large-file virus-scan page (confirm=t), Supabase storage honours
 * `?download`, Dropbox honours `dl=1`. Other hosts get the original URL for both.
 */
export function videoLinks(raw: string | null | undefined): VideoLinks | null {
  const url = (raw ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return null;

  const driveId =
    /drive\.google\.com\/file\/d\/([\w-]+)/.exec(url)?.[1] ??
    /drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/.exec(url)?.[1];
  if (driveId) {
    return {
      play: `https://drive.google.com/file/d/${driveId}/view`,
      download: `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`,
    };
  }

  try {
    const u = new URL(url);
    if (u.pathname.includes("/storage/v1/object/public/")) {
      const dl = new URL(u);
      dl.searchParams.set("download", "");
      return { play: url, download: dl.toString() };
    }
    if (/(^|\.)dropbox\.com$/i.test(u.hostname)) {
      const play = new URL(u);
      play.searchParams.set("raw", "1");
      play.searchParams.delete("dl");
      const dl = new URL(u);
      dl.searchParams.set("dl", "1");
      dl.searchParams.delete("raw");
      return { play: play.toString(), download: dl.toString() };
    }
  } catch {
    /* not a parseable URL: fall through */
  }
  return { play: url, download: url };
}

export interface CvData {
  fullName: string;
  serial: string;
  passportNo: string;
  passportIssue: string;
  passportExpiry: string;
  placeOfIssue: string;
  nationalityEn: string;
  nationalityAr: string;
  occupationEn: string;
  occupationAr: string;
  religionEn: string;
  religionAr: string;
  isMuslim: boolean;
  maritalEn: string;
  maritalAr: string;
  educationEn: string;
  educationAr: string;
  englishLevel: string;
  arabicLevel: string;
  englishStep: LevelStep | null;
  arabicStep: LevelStep | null;
  age: string;
  dob: string;
  birthPlace: string;
  livingTown: string;
  children: string;
  height: string;
  weight: string;
  salary: string;
  experienceEn: string;
  isFirstTime: boolean;
  experienceCountry: string;
  experienceYears: string;
  phone1: string;
  phone2: string;
  remark: string;
  photos: CvPhotos;
  /** Video CV links, or null when the candidate has no video. */
  video: VideoLinks | null;
  hasSkill: (key: SkillKey) => boolean;
}

function isFirstTimer(experience: string | null | undefined): boolean {
  const exp = (experience ?? "").trim().toUpperCase();
  return (
    !exp || exp.includes("FIRST") || exp.includes("NO EXPER") || exp === "NONE" || exp === "NO"
  );
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

// The candidates table stores nationality as a demonym ("Ethiopian") or leaves it empty.
const COUNTRY_FROM_DEMONYM: Record<string, string> = {
  ETHIOPIAN: "ETHIOPIA",
  KENYAN: "KENYA",
  UGANDAN: "UGANDA",
  FILIPINO: "PHILIPPINES",
  FILIPINA: "PHILIPPINES",
  INDONESIAN: "INDONESIA",
  "SRI LANKAN": "SRI LANKA",
  INDIAN: "INDIA",
  BANGLADESHI: "BANGLADESH",
  NEPALI: "NEPAL",
  GHANAIAN: "GHANA",
  NIGERIAN: "NIGERIA",
  BURUNDIAN: "BURUNDI",
  RWANDAN: "RWANDA",
  TANZANIAN: "TANZANIA",
  SUDANESE: "SUDAN",
  ERITREAN: "ERITREA",
  SOMALI: "SOMALIA",
  "SIERRA LEONEAN": "SIERRA LEONE",
  MALAGASY: "MADAGASCAR",
  PAKISTANI: "PAKISTAN",
};

/**
 * Country key for display. Empty falls back to Ethiopia, matching the DOCX templates,
 * which keep their printed "ETHIOPIA" when the candidate has no country.
 */
function countryKey(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return "ETHIOPIA";
  return COUNTRY_FROM_DEMONYM[v] ?? v;
}

/** Display text for the experience field; first-timers read "First Time", not "No"/"None". */
function experienceLabel(raw: string | null | undefined, firstTime: boolean): string {
  if (firstTime) return "First Time";
  if ((raw ?? "").trim().toUpperCase() === "YES") return "Experienced";
  return toEnglish(raw, EN_EXPERIENCE);
}

export function buildCvData(c: Candidate, photos: CvPhotos): CvData {
  const skillsUpper = (c.skills ?? "").toUpperCase();
  const firstTime = isFirstTimer(c.experience);
  const country = countryKey(c.country);
  const religionEn = toEnglish(c.religion, EN_RELIGION);
  const step = (lvl: string | null) => LEVEL_STEP[(lvl ?? "").trim().toUpperCase()] ?? null;

  return {
    fullName: c.full_name ?? "",
    serial: c.serial_number ?? c.candidate_code ?? "",
    passportNo: c.passport_number ?? "",
    passportIssue: c.passport_issue_date ?? "",
    passportExpiry: c.passport_expiry_date ?? "",
    placeOfIssue: c.place_of_issue || titleCase(country),
    nationalityEn: titleCase(country),
    nationalityAr: AR_COUNTRY[country] ?? "",
    occupationEn: toEnglish(c.occupation, EN_OCCUPATION) || "House Maid",
    occupationAr: toArabic(c.occupation, AR_OCCUPATION) || "عاملة منزلية",
    religionEn,
    religionAr: toArabic(c.religion, AR_RELIGION),
    isMuslim: religionEn.toUpperCase() === "MUSLIM",
    maritalEn: toEnglish(c.marital_status, EN_MARITAL),
    maritalAr: toArabic(c.marital_status, AR_MARITAL),
    educationEn: toEnglish(c.education, EN_EDUCATION),
    educationAr: toArabic(c.education, AR_EDUCATION),
    englishLevel: toEnglish(c.english_level, EN_LEVEL),
    arabicLevel: toEnglish(c.arabic_level, EN_LEVEL),
    englishStep: step(c.english_level),
    arabicStep: step(c.arabic_level),
    age: c.age != null ? String(c.age) : computeAge(c.dob),
    dob: c.dob ?? "",
    birthPlace: c.birth_place ?? "",
    livingTown: c.living_town ?? "",
    children: c.children != null ? String(c.children) : "",
    height: c.height != null ? `${c.height} cm` : "",
    weight: c.weight != null ? `${c.weight} kg` : "",
    salary: firstTime ? "1000" : "1200",
    experienceEn: experienceLabel(c.experience, firstTime),
    isFirstTime: firstTime,
    experienceCountry: firstTime ? "" : (c.experience_country ?? ""),
    experienceYears: firstTime ? "" : (c.experience_years ?? ""),
    phone1: c.narrative_phone ?? "",
    phone2: c.emergency_contact ?? "",
    remark: c.notes ?? c.remark ?? "",
    photos,
    video: videoLinks(c.video_url),
    hasSkill: (key) => SKILL_KEYWORDS[key].some((k) => skillsUpper.includes(k)),
  };
}

/** Arabic level label for a level value, e.g. "Good" → "جيد". */
export function levelAr(levelEn: string): string {
  return toArabic(levelEn, AR_LEVEL);
}
