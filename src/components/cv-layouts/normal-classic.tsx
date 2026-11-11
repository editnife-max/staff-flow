// "Normal CV" (green) — code-built recreation of public/normal-cv.docx.
// The DOCX itself is still what "Download DOCX" fills; this layout only produces the PDF,
// because browser DOCX renderers mis-place its tables and RTL labels.
//
// Everything sits on one grid: 32px page margins, a 240px photo column, and 30px rows,
// so sections share the same edges and nothing drifts or stretches.
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Page, PhotoBox, Tick, VideoButtons, PAGE_W } from "./primitives";

export const NORMAL_CLASSIC_FONT_FAMILY = "Cairo";
const FONT = `'${NORMAL_CLASSIC_FONT_FAMILY}', 'Segoe UI', Tahoma, Arial, sans-serif`;

const C = {
  green: "#1F6B45",
  tint: "#EAF4EE",
  paper: "#F8FBF9",
  ink: "#1E2A24",
  muted: "#7A8A80",
  line: "#CFE3D6",
};

const MARGIN = 32;
const CONTENT_W = PAGE_W - MARGIN * 2; // 730
const PHOTO_W = 240;
const GAP = 14;
const RIGHT_X = MARGIN + PHOTO_W + GAP; // 286
const RIGHT_W = CONTENT_W - PHOTO_W - GAP; // 476
const BAR_H = 30;
const ROW_H = 30;

const TOP_Y = 120;
// Personal (9 rows) + 10px gap + Applicant (7 rows), each section with a 1px border.
const PERSONAL_H = BAR_H + 9 * ROW_H + 2;
const APPLICANT_H = BAR_H + 7 * ROW_H + 2;
const TOP_H = PERSONAL_H + 10 + APPLICANT_H; // 554
const LANG_Y = TOP_Y + TOP_H + 16;
const LANG_H = BAR_H + 3 * ROW_H + 2;
const EXP_Y = LANG_Y + LANG_H + 16;
const EXP_HEAD_H = 26;
const EXP_H = BAR_H + EXP_HEAD_H + 2 * ROW_H + 2;
const SKILLS_Y = EXP_Y + EXP_H + 16;

function Ar({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span dir="rtl" style={{ unicodeBidi: "isolate", ...style }}>
      {children}
    </span>
  );
}

function Bar({ en, ar }: { en: string; ar: string }) {
  return (
    <div
      style={{
        height: BAR_H,
        flexShrink: 0,
        background: C.green,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
        {en}
      </span>
      <Ar style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{ar}</Ar>
    </div>
  );
}

function Section({
  x,
  y,
  w,
  en,
  ar,
  children,
}: {
  x: number;
  y: number;
  w: number;
  en: string;
  ar: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        boxSizing: "border-box",
        border: `1px solid ${C.line}`,
        borderRadius: 4,
        overflow: "hidden",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Bar en={en} ar={ar} />
      {children}
    </div>
  );
}

/** One "English label · value · Arabic label" row. */
function Row({
  en,
  ar,
  value,
  shade,
  labelW = 138,
  arW = 128,
}: {
  en: string;
  ar: string;
  value: string;
  shade: boolean;
  labelW?: number;
  arW?: number;
}) {
  return (
    <div
      style={{
        height: ROW_H,
        flexShrink: 0,
        boxSizing: "border-box",
        background: shade ? C.tint : "#ffffff",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
      }}
    >
      <span
        style={{
          width: labelW,
          flexShrink: 0,
          fontSize: 11.5,
          fontWeight: 700,
          color: C.green,
          whiteSpace: "nowrap",
        }}
      >
        {en}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12.5,
          fontWeight: 700,
          color: C.ink,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {value}
      </span>
      <Ar
        style={{
          width: arW,
          flexShrink: 0,
          textAlign: "right",
          fontSize: 12,
          fontWeight: 600,
          color: C.green,
          whiteSpace: "nowrap",
        }}
      >
        {ar}
      </Ar>
    </div>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 15,
        height: 15,
        boxSizing: "border-box",
        borderRadius: 3,
        flexShrink: 0,
        border: `1.5px solid ${checked ? C.green : C.muted}`,
        background: checked ? C.green : "#ffffff",
      }}
    >
      {checked && <Tick size={9} color="#ffffff" weight={2} />}
    </span>
  );
}

const SKILLS: Array<[SkillKey, string, string]> = [
  ["arabCooking", "Arabic Cooking", "الطبخ العربي"],
  ["cooking", "Cooking", "الطبخ"],
  ["cleaning", "Cleaning", "التنظيف"],
  ["washing", "Washing", "الغسيل"],
  ["ironing", "Ironing", "الكي"],
  ["babySitting", "Baby Sitting", "رعاية الأطفال"],
  ["childCare", "Children Care", "العناية بالأطفال"],
  ["elderCare", "Elderly Care", "رعاية المسنين"],
  ["tutoring", "Tutoring", "التدريس"],
];

function PhotoPlaceholder() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        color: C.muted,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700 }}>Insert photo here</span>
      <Ar style={{ fontSize: 12, fontWeight: 600 }}>صورة كاملة</Ar>
    </div>
  );
}

function experienceYears(d: CvData): string {
  const y = d.experienceYears.trim();
  return /^\d+(\.\d+)?$/.test(y) ? `${y} ${y === "1" ? "year" : "years"}` : y;
}

export function NormalClassicCv({ d }: { d: CvData }) {
  const personal: Array<[string, string, string]> = [
    ["Full Name", "الاسم الكامل", d.fullName],
    ["Contact Number", "رقم الهاتف", d.phone1 || d.phone2],
    ["Position Applied For", "الوظيفة المطلوبة", d.occupationEn],
    ["Expected Salary", "الراتب المتوقع", d.salary],
    ["Contract Period", "مدة العقد", "2 Years"],
    ["Passport Number", "رقم الجواز", d.passportNo],
    ["Religion", "الديانة", d.religionEn],
    ["Height", "الطول", d.height],
    ["Weight", "الوزن", d.weight],
  ];
  const applicant: Array<[string, string, string]> = [
    ["Nationality", "الجنسية", d.nationalityEn],
    ["Date of Birth", "تاريخ الميلاد", d.dob],
    ["Age", "العمر", d.age],
    ["Place of Birth", "مكان الميلاد", d.birthPlace],
    ["Address", "العنوان", d.livingTown || d.birthPlace],
    ["Marital Status", "الحالة الاجتماعية", d.maritalEn],
    ["Number of Children", "عدد الأطفال", d.children],
  ];
  const language: Array<[string, string, string]> = [
    ["English Level", "مستوى اللغة الإنجليزية", d.englishLevel],
    ["Arabic Level", "مستوى اللغة العربية", d.arabicLevel],
    ["Education", "المستوى التعليمي", d.educationEn],
  ];

  const hasExperience = !d.isFirstTime && !!(d.experienceCountry || d.experienceYears);
  const expColW = (CONTENT_W - 2) / 3;
  const expCell = (text: React.ReactNode, i: number): React.ReactNode => (
    <div
      key={i}
      style={{
        width: expColW,
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        borderLeft: i ? `1px solid ${C.line}` : undefined,
        boxSizing: "border-box",
        padding: "0 8px",
      }}
    >
      {text}
    </div>
  );
  const expRowStyle = (shade: boolean): React.CSSProperties => ({
    height: ROW_H,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    background: shade ? C.tint : "#ffffff",
    fontSize: 12.5,
    fontWeight: 700,
    color: C.ink,
  });

  // Photo column: bar, photo, then the video buttons when the candidate has a video.
  const BUTTONS_H = 40;
  const photoH = TOP_H - BAR_H - 2 - (d.video ? BUTTONS_H + 10 : 0);

  return (
    <Page style={{ background: "#ffffff", fontFamily: FONT, color: C.ink }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 26,
          width: CONTENT_W,
          textAlign: "center",
          color: C.green,
          fontSize: 38,
          fontWeight: 800,
          lineHeight: "48px",
          letterSpacing: 1,
        }}
      >
        NORMAL CV
      </div>
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 76,
          width: CONTENT_W,
          textAlign: "center",
          color: C.muted,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: "16px",
          letterSpacing: 2.5,
          whiteSpace: "pre",
        }}
      >
        {"QUALIFIED   •   RELIABLE   •   TRUSTWORTHY"}
      </div>
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 102,
          width: CONTENT_W,
          height: 3,
          background: C.green,
          borderRadius: 2,
        }}
      />

      {/* Full size photo */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: TOP_Y,
          width: PHOTO_W,
          height: TOP_H,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            boxSizing: "border-box",
            border: `1px solid ${C.line}`,
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Bar en="FULL SIZE PHOTO" ar="صورة كاملة" />
          <PhotoBox
            src={d.photos.fullPhoto}
            fit="contain"
            placeholder={<PhotoPlaceholder />}
            style={{ height: photoH, backgroundColor: C.paper }}
          />
        </div>
        {d.video && (
          <VideoButtons
            play={d.video.play}
            download={d.video.download}
            color={C.green}
            height={BUTTONS_H}
            font={FONT}
            style={{ marginTop: 10 }}
          />
        )}
      </div>

      {/* Personal information */}
      <Section x={RIGHT_X} y={TOP_Y} w={RIGHT_W} en="PERSONAL INFORMATION" ar="المعلومات الشخصية">
        {personal.map(([en, ar, v], i) => (
          <Row key={en} en={en} ar={ar} value={v} shade={i % 2 === 0} />
        ))}
      </Section>

      {/* Applicant details */}
      <Section
        x={RIGHT_X}
        y={TOP_Y + PERSONAL_H + 10}
        w={RIGHT_W}
        en="APPLICANT DETAILS"
        ar="بيانات المتقدمة"
      >
        {applicant.map(([en, ar, v], i) => (
          <Row key={en} en={en} ar={ar} value={v} shade={i % 2 === 0} />
        ))}
      </Section>

      {/* Language & education */}
      <Section x={MARGIN} y={LANG_Y} w={CONTENT_W} en="LANGUAGE & EDUCATION" ar="اللغة والتعليم">
        {language.map(([en, ar, v], i) => (
          <Row
            key={en}
            en={en}
            ar={ar}
            value={v}
            shade={i % 2 === 0}
            labelW={PHOTO_W - 12}
            arW={190}
          />
        ))}
      </Section>

      {/* Experience abroad */}
      <Section x={MARGIN} y={EXP_Y} w={CONTENT_W} en="EXPERIENCE ABROAD" ar="الخبرة خارج البلاد">
        <div
          style={{
            height: EXP_HEAD_H,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            background: C.paper,
            borderBottom: `1px solid ${C.line}`,
            boxSizing: "border-box",
            fontSize: 11.5,
            fontWeight: 700,
            color: C.green,
          }}
        >
          {[
            ["Country", "الدولة"],
            ["Period", "المدة"],
            ["Position", "الوظيفة"],
          ].map(([en, ar], i) =>
            expCell(
              <>
                {en}
                <span style={{ color: C.muted, margin: "0 8px" }}>|</span>
                <Ar>{ar}</Ar>
              </>,
              i,
            ),
          )}
        </div>
        {hasExperience ? (
          <>
            <div style={expRowStyle(true)}>
              {[d.experienceCountry, experienceYears(d), d.occupationEn].map((t, i) =>
                expCell(t, i),
              )}
            </div>
            <div style={expRowStyle(false)}>{["", "", ""].map((t, i) => expCell(t, i))}</div>
          </>
        ) : (
          <div
            style={{
              ...expRowStyle(true),
              height: ROW_H * 2,
              justifyContent: "center",
              gap: 10,
              color: C.muted,
              fontSize: 12.5,
            }}
          >
            <span>First Time — no previous experience abroad</span>
            <span>·</span>
            <Ar>لا توجد خبرة سابقة خارج البلاد</Ar>
          </div>
        )}
      </Section>

      {/* Skills */}
      <Section x={MARGIN} y={SKILLS_Y} w={CONTENT_W} en="SKILLS" ar="المهارات">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {SKILLS.map(([key, en, ar], i) => (
            <div
              key={key}
              style={{
                height: ROW_H,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 12px",
                background: Math.floor(i / 3) % 2 === 0 ? C.tint : "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <CheckBox checked={d.hasSkill(key)} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{en}</span>
              <Ar style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>{ar}</Ar>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer band */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: PAGE_W,
          height: 22,
          background: C.green,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: 2,
          whiteSpace: "pre",
        }}
      >
        {"NORMAL CV   •   QUALIFIED   •   RELIABLE   •   TRUSTWORTHY"}
      </div>
    </Page>
  );
}
