// "Normal" CV — bilingual recruitment CV built from the supplied design image.
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Page, PhotoBox, Tick } from "./primitives";

export const NORMAL_FONT_FAMILY = "Cairo";
const FONT = `'${NORMAL_FONT_FAMILY}', 'Segoe UI', Tahoma, Arial, sans-serif`;

const C = {
  page: "#eef8fa",
  navy: "#174a6b",
  navyText: "#1d3f63",
  red: "#e3262d",
  line: "#9fdde3",
  card: "#f8fdfe",
  teal: "#2a9da6",
  magenta: "#b5196f",
  orange: "#f47f4f",
  cyan: "#58cdd2",
  muted: "#8d9aa8",
};

/** Arabic run: isolated so it never reorders the English half of a bilingual label. */
function A({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span dir="rtl" style={{ unicodeBidi: "isolate", ...style }}>
      {children}
    </span>
  );
}

/** "English / عربي" label. */
function Bi({ en, ar, arFirst = false }: { en: string; ar: string; arFirst?: boolean }) {
  return arFirst ? (
    <>
      <A>{ar}</A> / {en}
    </>
  ) : (
    <>
      {en} / <A>{ar}</A>
    </>
  );
}

function Field({
  en,
  ar,
  value,
  style,
}: {
  en: string;
  ar: string;
  value: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        boxSizing: "border-box",
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 6,
        padding: "7px 11px 6px",
        ...style,
      }}
    >
      <div
        style={{
          color: C.red,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: "16px",
          whiteSpace: "nowrap",
        }}
      >
        <Bi en={en} ar={ar} />
      </div>
      <div
        style={{
          color: C.navyText,
          fontSize: 13.5,
          fontWeight: 700,
          lineHeight: "17px",
          marginTop: 3,
          maxHeight: 34,
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
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
        width: 17,
        height: 17,
        boxSizing: "border-box",
        borderRadius: 4,
        flexShrink: 0,
        border: `1.5px solid ${checked ? C.teal : "#8a9aa6"}`,
        background: checked ? C.teal : "#ffffff",
      }}
    >
      {checked && <Tick size={10} color="#ffffff" weight={2} />}
    </span>
  );
}

const SKILLS: Array<[SkillKey, string, string]> = [
  ["cooking", "Cooking", "الطبخ"],
  ["elderCare", "Elder care", "رعاية المسنين"],
  ["childCare", "Child care", "رعاية الأطفال"],
  ["ironing", "Ironing", "الكي"],
  ["washing", "Laundry", "الغسيل"],
  ["cleaning", "Cleaning", "التنظيف"],
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
        gap: 14,
      }}
    >
      <div
        style={{
          width: 74,
          height: 64,
          boxSizing: "border-box",
          border: `5px solid ${C.muted}`,
          borderRadius: 9,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 13,
            top: 10,
            width: 12,
            height: 12,
            borderRadius: 6,
            background: C.muted,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 6,
            bottom: -14,
            width: 40,
            height: 40,
            background: C.muted,
            transform: "rotate(45deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 30,
            bottom: -18,
            width: 40,
            height: 40,
            background: C.muted,
            transform: "rotate(45deg)",
          }}
        />
      </div>
      <div style={{ color: C.muted, fontSize: 17, fontWeight: 700 }}>No photo provided</div>
    </div>
  );
}

function experienceText(d: CvData): string {
  if (d.isFirstTime) return d.experienceEn || "First Time";
  const years =
    d.experienceYears && /^\d+(\.\d+)?$/.test(d.experienceYears.trim())
      ? `${d.experienceYears.trim()} years`
      : d.experienceYears;
  return [d.experienceEn, d.experienceCountry, years].filter(Boolean).join(" · ");
}

export function NormalCv({ d }: { d: CvData }) {
  const nationalityEn = d.nationalityEn || "—";
  const ROW_TOP = 214,
    ROW_STEP = 67.5,
    ROW_H = 58;
  const COL1 = { left: 331, width: 215 };
  const COL2 = { left: 556, width: 212 };
  const fields: Array<[string, string, string]> = [
    ["Full name", "الاسم الكامل", d.fullName],
    ["Passport no.", "رقم جواز السفر", d.passportNo],
    ["Age", "العمر", d.age],
    ["Birth date", "تاريخ الميلاد", d.dob],
    ["Height", "الطول", d.height],
    ["Weight", "الوزن", d.weight],
    ["Education", "التعليم", d.educationEn],
    ["Religion", "الديانة", d.religionEn],
    ["Marital status", "الحالة الاجتماعية", d.maritalEn],
    ["Children", "الأطفال", d.children],
    ["Applied for", "الوظيفة المطلوبة", d.occupationEn],
    ["Salary", "الراتب", d.salary],
    ["Contact 1", "رقم التواصل 1", d.phone1],
    ["Contact 2", "رقم التواصل 2", d.phone2],
  ];

  return (
    <Page style={{ background: C.page, fontFamily: FONT, color: C.navyText }}>
      {/* Badge */}
      <div
        style={{
          position: "absolute",
          left: 580,
          top: 33,
          width: 188,
          height: 58,
          borderRadius: 6,
          background: C.navy,
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: "20px" }}>
          <A>التوظيف / السيرة الذاتية</A>
        </div>
        <div style={{ fontSize: 8.5, fontWeight: 600, lineHeight: "14px", marginTop: 2 }}>
          RECRUITMENT CV
        </div>
      </div>

      {/* Colour rule */}
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 108,
          width: 742,
          height: 7,
          borderRadius: 4,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ width: 262, background: C.magenta }} />
        <div style={{ width: 164, background: C.orange }} />
        <div style={{ flex: 1, background: C.cyan }} />
      </div>

      {/* Portrait card */}
      <div
        style={{
          position: "absolute",
          left: 27,
          top: 137,
          width: 287,
          height: 565,
          boxSizing: "border-box",
          border: `1px solid ${C.line}`,
          borderRadius: 6,
          background: C.card,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 11,
            top: 15,
            color: C.red,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <Bi en="CANDIDATE PORTRAIT" ar="صورة المرشحة" arFirst />
        </div>
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          placeholder={<PhotoPlaceholder />}
          style={{
            position: "absolute",
            left: 11,
            top: 44,
            width: 265,
            height: 510,
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            backgroundColor: "#ffffff",
          }}
        />
      </div>

      {/* Nationality */}
      <div style={{ position: "absolute", left: 27, top: 707, width: 287, textAlign: "center" }}>
        <div style={{ color: C.navyText, fontSize: 21, fontWeight: 800, lineHeight: "28px" }}>
          {d.nationalityAr ? <Bi en={nationalityEn} ar={d.nationalityAr} arFirst /> : nationalityEn}
        </div>
        <div
          style={{
            color: C.navyText,
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: "20px",
            marginTop: 2,
          }}
        >
          <Bi en="Nationality" ar="الجنسية" arFirst />
        </div>
      </div>

      {/* Profile note */}
      <div
        style={{
          position: "absolute",
          left: 27,
          top: 770,
          width: 287,
          height: 206,
          boxSizing: "border-box",
          borderRadius: 6,
          background: C.teal,
          color: "#ffffff",
          padding: "22px 15px 14px",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: "18px" }}>
          <Bi en="PROFILE NOTE" ar="ملاحظة عن السيرة" arFirst />
        </div>
        <div
          dir="rtl"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            lineHeight: "19px",
            marginTop: 16,
            textAlign: "left",
          }}
        >
          يتم مراجعة بيانات المرشحة من قبل فريق التوظيف.
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: "19px", marginTop: 4 }}>
          Candidate details verified by the recruitment team.
        </div>
        {d.remark && (
          <div
            style={{
              fontSize: 11.5,
              lineHeight: "16px",
              marginTop: 8,
              maxHeight: 48,
              overflow: "hidden",
            }}
          >
            {d.remark}
          </div>
        )}
      </div>

      {/* Nationality header card */}
      <div
        style={{
          position: "absolute",
          left: 331,
          top: 132,
          width: 437,
          height: 65,
          boxSizing: "border-box",
          borderRadius: 8,
          background: C.navy,
          color: "#ffffff",
          padding: "6px 16px",
        }}
      >
        <div
          style={{
            fontSize: 27,
            fontWeight: 700,
            lineHeight: "40px",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {d.nationalityAr ? <Bi en={nationalityEn} ar={d.nationalityAr} /> : nationalityEn}
        </div>
        <div style={{ position: "absolute", right: 12, bottom: 6, fontSize: 8, fontWeight: 600 }}>
          <Bi en={d.occupationEn} ar={d.occupationAr} />
        </div>
      </div>

      {/* Detail fields */}
      {fields.map(([en, ar, value], i) => (
        <Field
          key={en}
          en={en}
          ar={ar}
          value={value}
          style={{
            top: ROW_TOP + Math.floor(i / 2) * ROW_STEP,
            height: ROW_H,
            ...(i % 2 === 0 ? COL1 : COL2),
          }}
        />
      ))}
      <Field
        en="Previous experience"
        ar="الخبرات السابقة"
        value={experienceText(d)}
        style={{ top: 683, height: 61, left: 331, width: 437 }}
      />

      {/* Languages */}
      <div
        style={{
          position: "absolute",
          left: 333,
          top: 757,
          fontSize: 17,
          fontWeight: 800,
          lineHeight: "24px",
        }}
      >
        <Bi en="LANGUAGES" ar="اللغات" arFirst />
      </div>
      <Field
        en="English"
        ar="الإنجليزية"
        value={d.englishLevel}
        style={{ top: 786, height: 70, left: 332, width: 161 }}
      />
      <Field
        en="Arabic"
        ar="العربية"
        value={d.arabicLevel}
        style={{ top: 786, height: 70, left: 500, width: 268 }}
      />

      {/* Skills */}
      <div
        style={{
          position: "absolute",
          left: 333,
          top: 866,
          fontSize: 17,
          fontWeight: 800,
          lineHeight: "24px",
        }}
      >
        <Bi en="SKILLS" ar="المهارات" arFirst />
      </div>
      <div
        style={{
          position: "absolute",
          left: 332,
          top: 898,
          width: 436,
          height: 87,
          boxSizing: "border-box",
          border: `1px solid ${C.line}`,
          borderRadius: 6,
          background: C.card,
          padding: "9px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 6,
          columnGap: 18,
        }}
      >
        {SKILLS.map(([key, en, ar]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: "17px",
            }}
          >
            <CheckBox checked={d.hasSkill(key)} />
            <span>
              <Bi en={en} ar={ar} arFirst />
            </span>
          </div>
        ))}
      </div>

      {/* Footnote + contact line */}
      <div
        style={{
          position: "absolute",
          left: 27,
          top: 999,
          fontSize: 9,
          color: "#9aa9c0",
          whiteSpace: "nowrap",
        }}
      >
        <Bi
          en="Customer copy - sensitive identity numbers are intentionally excluded."
          ar="نسخة من الهوية الشخصية مرفقة"
          arFirst
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 27,
          top: 1028,
          width: 741,
          height: 1,
          background: C.line,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 27,
          top: 1037,
          color: C.red,
          fontSize: 17,
          fontWeight: 800,
          lineHeight: "26px",
          whiteSpace: "nowrap",
        }}
      >
        <Bi en="Call:" ar="اتصال" arFirst />
        <span style={{ margin: "0 22px" }}>|</span>
        <Bi en="WhatsApp:" ar="واتساب" arFirst />
      </div>

      {/* Footer band */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 794,
          height: 43,
          display: "flex",
        }}
      >
        <div style={{ width: 374, background: C.magenta }} />
        <div style={{ width: 203, background: C.orange }} />
        <div style={{ flex: 1, background: C.cyan }} />
      </div>
    </Page>
  );
}
