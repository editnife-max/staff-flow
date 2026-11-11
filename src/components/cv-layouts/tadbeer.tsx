// TADBEER CV Form — the template's design on a regular grid. Values follow
// buildFilledDocx's TADBEER rules.
//
// Two tables share every edge: the left one (14–436) and the right one (442–780).
// Rows are uniform per section and the bottom of the page is filled, so nothing floats.
import React from "react";
import type { CvData, LevelStep, SkillKey } from "./cv-data";
import { Ar, Cell, Page, PhotoBox, Tick, VideoButtons } from "./primitives";

const DARK = "#365f91";
const LIGHT = "#8db3e0";
const BLUE_TITLE = "#006fc0";
const LABEL: React.CSSProperties = {
  fontFamily: "Arial, sans-serif",
  fontWeight: 700,
  fontSize: 11.5,
};
const VALUE: React.CSSProperties = {
  fontFamily: "'Times New Roman', Times, serif",
  fontWeight: 700,
  fontSize: 13.5,
};
const AR: React.CSSProperties = {
  fontFamily: "Arial, Tahoma, sans-serif",
  fontWeight: 700,
  fontSize: 12.9,
};

// ── Grid ──────────────────────────────────────────────────────────────────────
const X0 = 14;
const X1 = 780;
/** Left table: label | value | Arabic label. */
const L = [X0, 120, 330, 436] as const;
/** Right table: label | value | Arabic label. */
const R = [442, 540, 660, X1] as const;
/** Top block, right of the ID photo: label | value | Arabic label. */
const PHOTO_X1 = 135;
const T = [PHOTO_X1, 240, 630, X1] as const;

const TOP = 126;
const REF_H = 28;
const POST_H = 42;
const NAME_Y = TOP + REF_H + 3 * POST_H; // 280
const TITLES_Y = NAME_Y + 30; // 310
const ROWS_Y = TITLES_Y + 28; // 338
const ROW_H = 27;
const LANG_Y = ROWS_Y + 12 * ROW_H; // 662
const LEVEL_H = 25;
const EMP_Y = LANG_Y + 30 + 28 + 4 * LEVEL_H; // 820
const WORK_Y = EMP_Y + 30 + 2 * 26; // 902
const SKILLS_Y = WORK_Y + 30 + 26 + 26; // 984
const SKILL_HEAD_H = 56;
const SKILLS_Y1 = SKILLS_Y + SKILL_HEAD_H + 44; // 1084
const FULL_PHOTO_Y = ROWS_Y + 4 * ROW_H; // 446

function ArLabel({
  children,
  size = 12.9,
  color,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
}) {
  return <Ar style={{ ...AR, fontSize: size, color }}>{children}</Ar>;
}

/** Section title row: English left, Arabic right. */
function Title({
  x0,
  x1,
  y0,
  y1,
  en,
  ar,
  size = 14,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  en: string;
  ar: string;
  size?: number;
}) {
  return (
    <Cell x0={x0} y0={y0} x1={x1} y1={y1} pad={8}>
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ ...LABEL, fontSize: size }}>{en}</span>
        <ArLabel size={size + 0.5}>{ar}</ArLabel>
      </div>
    </Cell>
  );
}

/** label | value | Arabic label across the given column edges. */
function Row({
  cols,
  y0,
  y1,
  en,
  ar,
  children,
  labelSize,
}: {
  cols: readonly [number, number, number, number];
  y0: number;
  y1: number;
  en: React.ReactNode;
  ar: string;
  children?: React.ReactNode;
  labelSize?: number;
}) {
  return (
    <>
      <Cell x0={cols[0]} y0={y0} x1={cols[1]} y1={y1} bg={LIGHT} pad={6}>
        <span style={{ ...LABEL, fontSize: labelSize ?? LABEL.fontSize }}>{en}</span>
      </Cell>
      <Cell x0={cols[1]} y0={y0} x1={cols[2]} y1={y1} align="center">
        {children}
      </Cell>
      <Cell x0={cols[2]} y0={y0} x1={cols[3]} y1={y1} bg={LIGHT} align="right" pad={6}>
        <ArLabel>{ar}</ArLabel>
      </Cell>
    </>
  );
}

const LEVEL_ROWS: Array<[LevelStep, string]> = [
  ["POOR", "لا شيء"],
  ["LITTLE", "قليل"],
  ["FAIR", "وسط"],
  ["FLUENT", "ممتاز"],
];

const SKILL_COLS: Array<[SkillKey[], string, string]> = [
  [["babySitting", "childCare"], "جليسة أطفال", "Baby Sitting"],
  [["cleaning"], "التنظيف", "Cleaning"],
  [["cooking"], "الطبخ", "Cooking"],
  [["washing"], "الغسيل", "Washing"],
];
/** Skill columns split the left table into four equal parts. */
const SKILL_X = [L[0], 120, 225, 330, L[3]];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TadbeerCv({ d }: { d: CvData }) {
  const leftRows: Array<[string, string, string]> = [
    ["Nationality", "الجنسية", d.nationalityEn],
    ["Religion", "الديانة", d.religionEn],
    ["Date of Birth", "تاريخ الميلاد", d.dob],
    ["Age", "العمر", d.age],
    ["Place of Birth", "مكان الميلاد", d.birthPlace],
    ["Living Town", "مكان السكن", d.livingTown],
    ["Marital Status", "الحالة الاجتماعية", d.maritalEn],
    ["No. of Children", "عدد الأطفال", d.children],
    ["Weight", "الوزن", d.weight],
    ["Height", "الطول", d.height],
    ["Complexion", "لون البشرة", ""],
    ["Education", "الدرجة العلمية", d.educationEn],
  ];
  const passportRows: Array<[string, string, string]> = [
    ["Passport No.", "رقم الجواز", d.passportNo],
    ["Date of Issue", "تاريخ الاصدار", d.passportIssue],
    ["Place of Issue", "مكان الاصدار", d.placeOfIssue],
    ["Date of Expiry", "تاريخ الانتهاء", d.passportExpiry],
  ];
  const postRows: Array<[string, string, string]> = [
    ["Post Applied For", "الوظيفة", d.occupationEn],
    ["Monthly Salary", "الراتب الشهري", d.salary],
    ["Contract Period", "مدة العقد", "02 Years"],
  ];

  // Full-size photo panel spans the passport rows' bottom to the work-experience end.
  const panel = { x0: R[0], y0: FULL_PHOTO_Y, x1: R[3], y1: SKILLS_Y };
  const inset = 9;
  const BUTTONS_H = 40;
  const photoH = panel.y1 - panel.y0 - inset * 2 - (d.video ? BUTTONS_H + inset : 0);

  return (
    <Page>
      {/* Header */}
      <img
        src="/cv-assets/tadbeer-logo.png"
        alt=""
        style={{ position: "absolute", left: 30, top: 32, width: 186, height: 63 }}
      />
      <div
        style={{
          position: "absolute",
          left: 237,
          top: 44,
          width: 320,
          textAlign: "center",
          color: BLUE_TITLE,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        <Ar style={{ fontFamily: "'Times New Roman', Arial, serif" }}>سيرة ذاتية</Ar>
      </div>
      <img
        src="/cv-assets/tadbeer-flag.png"
        alt=""
        style={{ position: "absolute", left: 650, top: 8, width: 124, height: 109 }}
      />

      {/* ID photo: fills the top-left block down to the name row */}
      <Cell x0={X0} y0={TOP} x1={PHOTO_X1} y1={NAME_Y} pad={0}>
        <PhotoBox
          src={d.photos.photo}
          fit="cover"
          position="center top"
          style={{ width: "100%", height: "100%" }}
        />
      </Cell>

      {/* Ref / date / destination */}
      {(
        [
          ["REF. NO", d.serial || "-", PHOTO_X1, 240, 377],
          ["DATE", today(), 377, 444, 560],
          ["TO", "KSA", 560, 629, X1],
        ] as const
      ).map(([label, value, a, b, c]) => (
        <React.Fragment key={label}>
          <Cell x0={a} y0={TOP} x1={b} y1={TOP + REF_H} bg={DARK} align="center">
            <span style={{ ...LABEL, fontSize: 10.5, color: "#fff" }}>{label}</span>
          </Cell>
          <Cell x0={b} y0={TOP} x1={c} y1={TOP + REF_H} align="center">
            <span style={VALUE}>{value}</span>
          </Cell>
        </React.Fragment>
      ))}

      {/* Post / salary / contract */}
      {postRows.map(([en, ar, v], i) => {
        const y0 = TOP + REF_H + i * POST_H;
        return (
          <Row key={en} cols={T} y0={y0} y1={y0 + POST_H} en={en} ar={ar}>
            <span style={{ ...VALUE, fontSize: 16 }}>{v}</span>
          </Row>
        );
      })}

      {/* Name */}
      <Cell x0={X0} y0={NAME_Y} x1={T[1]} y1={TITLES_Y} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 13, color: "#fff" }}>NAME IN FULL</span>
      </Cell>
      <Cell x0={T[1]} y0={NAME_Y} x1={T[2]} y1={TITLES_Y} align="center">
        <span style={{ ...LABEL, fontSize: 14 }}>{d.fullName}</span>
      </Cell>
      <Cell x0={T[2]} y0={NAME_Y} x1={X1} y1={TITLES_Y} bg={DARK} align="center">
        <ArLabel size={15.5} color="#fff">
          الاسم الكامل
        </ArLabel>
      </Cell>

      {/* Section titles */}
      <Title
        x0={L[0]}
        x1={L[3]}
        y0={TITLES_Y}
        y1={ROWS_Y}
        en="DETAILS OF APPLICATION"
        ar="بيانات صاحب العمل"
      />
      <Title
        x0={R[0]}
        x1={R[3]}
        y0={TITLES_Y}
        y1={ROWS_Y}
        en="PASSPORT DETAILS"
        ar="بيانات جواز السفر"
      />

      {/* Application details */}
      {leftRows.map(([en, ar, v], i) => (
        <Row
          key={en}
          cols={L}
          y0={ROWS_Y + i * ROW_H}
          y1={ROWS_Y + (i + 1) * ROW_H}
          en={en}
          ar={ar}
        >
          <span style={VALUE}>{v}</span>
        </Row>
      ))}

      {/* Passport details */}
      {passportRows.map(([en, ar, v], i) => (
        <Row
          key={en}
          cols={R}
          y0={ROWS_Y + i * ROW_H}
          y1={ROWS_Y + (i + 1) * ROW_H}
          en={en}
          ar={ar}
          labelSize={10.5}
        >
          <span style={{ ...LABEL, fontSize: 12.5 }}>{v}</span>
        </Row>
      ))}

      {/* Full-size photo + video buttons */}
      <Cell x0={panel.x0} y0={panel.y0} x1={panel.x1} y1={panel.y1} pad={0}>
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          style={{
            position: "absolute",
            left: inset,
            top: inset,
            right: inset,
            height: photoH,
            border: d.photos.fullPhoto ? undefined : "1px solid #000",
          }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 6,
                top: 4,
                fontFamily: "'Times New Roman', serif",
                fontSize: 13,
              }}
            >
              Full size photo
            </span>
          }
        />
        {d.video && (
          <VideoButtons
            play={d.video.play}
            download={d.video.download}
            color={DARK}
            height={BUTTONS_H}
            style={{ position: "absolute", left: inset, right: inset, bottom: inset }}
          />
        )}
      </Cell>

      {/* Languages */}
      <Title
        x0={L[0]}
        x1={L[3]}
        y0={LANG_Y}
        y1={LANG_Y + 30}
        en="KNOWLEDGE LANGUAGES"
        ar="إجادة اللغات"
        size={15}
      />
      {(
        [
          [<span style={{ ...LABEL, fontSize: 10.5, color: "#fff" }}>ENGLISH</span>, L[0], L[1]],
          [<ArLabel color="#fff">إنجليزي</ArLabel>, L[1], 225],
          [<span style={{ ...LABEL, fontSize: 10.5, color: "#fff" }}>ARABIC</span>, 225, L[2]],
          [
            <ArLabel size={15} color="#fff">
              عربي
            </ArLabel>,
            L[2],
            L[3],
          ],
        ] as const
      ).map(([content, a, b]) => (
        <Cell key={a} x0={a} y0={LANG_Y + 30} x1={b} y1={LANG_Y + 58} bg={DARK} align="center">
          {content}
        </Cell>
      ))}
      {LEVEL_ROWS.map(([step, ar], i) => {
        const y0 = LANG_Y + 58 + i * LEVEL_H;
        const y1 = y0 + LEVEL_H;
        return (
          <React.Fragment key={step}>
            <Cell x0={L[0]} y0={y0} x1={L[1]} y1={y1} bg={LIGHT} align="center">
              <span style={{ ...LABEL, fontSize: 10.5 }}>{step}</span>
            </Cell>
            <Cell x0={L[1]} y0={y0} x1={225} y1={y1} align="center">
              {d.englishStep === step && <Tick size={13} />}
            </Cell>
            <Cell x0={225} y0={y0} x1={L[2]} y1={y1} align="center">
              {d.arabicStep === step && <Tick size={13} />}
            </Cell>
            <Cell x0={L[2]} y0={y0} x1={L[3]} y1={y1} bg={LIGHT} align="center">
              <ArLabel>{ar}</ArLabel>
            </Cell>
          </React.Fragment>
        );
      })}

      {/* Previous employment */}
      <Title
        x0={L[0]}
        x1={L[3]}
        y0={EMP_Y}
        y1={EMP_Y + 30}
        en="PREVIOUS EMPLOYMENT ABROAD"
        ar="الخبرة خارج البلد"
        size={13}
      />
      <Cell x0={L[0]} y0={EMP_Y + 30} x1={L[1]} y1={EMP_Y + 56} bg={DARK} pad={6}>
        <span style={{ ...LABEL, fontSize: 10.5, color: "#fff" }}>COUNTRY</span>
      </Cell>
      <Cell x0={L[1]} y0={EMP_Y + 30} x1={L[2]} y1={EMP_Y + 56} align="center">
        {d.isFirstTime ? (
          <span style={{ ...VALUE, color: "#ff0000" }}>
            1<sup style={{ fontSize: 8.4 }}>ST</sup> TIME
          </span>
        ) : (
          <span style={VALUE}>{d.experienceCountry}</span>
        )}
      </Cell>
      <Cell x0={L[2]} y0={EMP_Y + 30} x1={L[3]} y1={EMP_Y + 56} bg={DARK} align="right" pad={6}>
        <ArLabel size={14} color="#fff">
          البلد
        </ArLabel>
      </Cell>
      <Row cols={L} y0={EMP_Y + 56} y1={EMP_Y + 82} en="PERIOD" ar="المدة" labelSize={10.5}>
        <span style={VALUE}>{d.experienceYears || "0"}</span>
      </Row>

      {/* Work experience */}
      <Title
        x0={L[0]}
        x1={L[3]}
        y0={WORK_Y}
        y1={WORK_Y + 30}
        en="EXPERIENCE WORK"
        ar="خبرة العمل"
      />
      {(
        [
          ["الديكور", "YES", L[0], L[1]],
          ["القيادة", "", L[1], L[2]],
          ["الخياطة", "YES", L[2], L[3]],
        ] as const
      ).map(([ar, v, a, b]) => (
        <React.Fragment key={ar}>
          <Cell x0={a} y0={WORK_Y + 30} x1={b} y1={WORK_Y + 56} bg={LIGHT} align="center">
            <ArLabel>{ar}</ArLabel>
          </Cell>
          <Cell x0={a} y0={WORK_Y + 56} x1={b} y1={SKILLS_Y} align="center">
            {v && <span style={VALUE}>{v}</span>}
          </Cell>
        </React.Fragment>
      ))}

      {/* Skills */}
      {SKILL_COLS.map(([keys, ar, en], i) => (
        <React.Fragment key={en}>
          <Cell
            x0={SKILL_X[i]}
            y0={SKILLS_Y}
            x1={SKILL_X[i + 1]}
            y1={SKILLS_Y + SKILL_HEAD_H}
            bg={LIGHT}
            align="center"
            style={{ justifyContent: "space-evenly" }}
          >
            <ArLabel>{ar}</ArLabel>
            <span style={{ ...LABEL, fontSize: 10.5 }}>{en}</span>
          </Cell>
          <Cell
            x0={SKILL_X[i]}
            y0={SKILLS_Y + SKILL_HEAD_H}
            x1={SKILL_X[i + 1]}
            y1={SKILLS_Y1}
            align="center"
          >
            {keys.some((k) => d.hasSkill(k)) && <Tick size={13} />}
          </Cell>
        </React.Fragment>
      ))}

      {/* Deduction / notes */}
      {(
        [
          ["Deduction", "", "المبلغ المقتطع", SKILLS_Y, SKILLS_Y + SKILL_HEAD_H],
          [
            "Notes",
            <span style={VALUE}>She is ready for KSA</span>,
            "ملاحظات",
            SKILLS_Y + SKILL_HEAD_H,
            SKILLS_Y1,
          ],
        ] as const
      ).map(([en, v, ar, a, b]) => (
        <React.Fragment key={en}>
          <Cell x0={R[0]} y0={a} x1={R[1]} y1={b} bg={LIGHT} align="center">
            <span style={LABEL}>{en}</span>
          </Cell>
          <Cell x0={R[1]} y0={a} x1={700} y1={b} align="center">
            {v}
          </Cell>
          <Cell x0={700} y0={a} x1={R[3]} y1={b} bg={LIGHT} align="center" pad={2}>
            <ArLabel size={12}>{ar}</ArLabel>
          </Cell>
        </React.Fragment>
      ))}
    </Page>
  );
}
