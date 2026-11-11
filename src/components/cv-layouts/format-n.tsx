// CV Format N (Tatweer) — the template's design on a regular grid (A4).
//
// 24px page margins. The full-size photo column (24–264) and the details column
// (276–770) start and end on the same lines; detail rows share one height, so labels,
// values and underlines line up across the page.
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Ar, Page, PhotoBox, Tick, VideoButtons } from "./primitives";

const FONT = "Dubai, 'Segoe UI', Tahoma, Arial, sans-serif";
const MAROON = "#a42449";
const TEAL = "#074f6a";
const GREY = "#747474";
const BLUE = "#215e99";

const X0 = 24;
const X1 = 770;
const PHOTO_X1 = 264;
const DX0 = 276; // details column
/** Details row columns: English label | value | Arabic label. */
const COLS = [DX0, 400, 650, X1] as const;

const NAME_Y = 204;
const NAME_H = 42;
const ROWS_Y = NAME_Y + NAME_H; // 246
const ROW_H = 42;
const ROW_COUNT = 13;
const SKILLS_TITLE_Y = ROWS_Y + ROW_COUNT * ROW_H + 10; // 802
const SKILLS_Y = SKILLS_TITLE_Y + 30; // 832
const SKILL_ROW_H = 32;
const BODY_Y1 = SKILLS_Y + 3 * SKILL_ROW_H; // 928

const abs = (left: number, top: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: "absolute",
  left,
  top,
  fontFamily: FONT,
  fontWeight: 700,
  ...extra,
});

function HLine({
  x0,
  x1,
  yy,
  color = "#000",
  h = 1,
}: {
  x0: number;
  x1: number;
  yy: number;
  color?: string;
  h?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x0,
        top: yy,
        width: x1 - x0,
        height: h,
        background: color,
      }}
    />
  );
}

const ArT = ({ children }: { children: React.ReactNode }) => (
  <Ar style={{ fontFamily: FONT }}>{children}</Ar>
);

const SKILL_ROWS: Array<[[string, string, SkillKey], [string, string, SkillKey]]> = [
  [
    ["Cleaning", "التنظيف", "cleaning"],
    ["Child care", "رعاية الأطفال", "childCare"],
  ],
  [
    ["Ironing", "الكي", "ironing"],
    ["Elderly care", "رعاية المسنين", "elderCare"],
  ],
  [
    ["Washing", "الغسيل", "washing"],
    ["Cooking", "الطبخ", "cooking"],
  ],
];
/** Skills table: [EN | ✓ | AR] twice across the details column. */
const SK_X = [DX0, 372, 410, 523, 619, 657, X1];

export function FormatNCv({ d }: { d: CvData }) {
  const years =
    d.experienceYears && /^\d+(\.\d+)?$/.test(d.experienceYears.trim())
      ? `${d.experienceYears.trim()} years`
      : d.experienceYears;
  const experience = d.isFirstTime
    ? d.experienceEn || "First Time"
    : [d.experienceEn, d.experienceCountry, years].filter(Boolean).join(" · ");
  const rows: Array<[string, string, string]> = [
    ["Age:", "العمر:", d.age],
    ["Date of Birth:", "تاريخ الميلاد:", d.dob],
    ["Salary:", "الراتب:", d.salary],
    ["Profession:", "المهنة:", d.occupationEn],
    ["Experience:", "الخبرة:", experience],
    ["English language:", "اللغة الإنجليزية:", d.englishLevel],
    ["Religion:", "الديانة:", d.religionEn],
    ["Education:", "الدرجة التعليمية:", d.educationEn],
    ["Certificates:", "الشهادات:", ""],
    ["Marital status:", "الحالة الاجتماعية:", d.maritalEn],
    ["No. of kids:", "عدد الأطفال:", d.children],
    ["Weight:", "الوزن:", d.weight],
    ["Height:", "الطول:", d.height],
  ];

  // Photo column: frame from the name band to the end of the skills table.
  const inset = 8;
  const BUTTONS_H = 40;
  const frameH = BODY_Y1 - NAME_Y;
  const photoH = frameH - inset * 2 - (d.video ? BUTTONS_H + inset : 0);

  return (
    <Page style={{ fontFamily: FONT }}>
      {/* Letterhead */}
      <div
        style={abs(110, 58, {
          width: 240,
          textAlign: "center",
          color: GREY,
          fontSize: 22.7,
          lineHeight: "39px",
        })}
      >
        Tatweer Human
        <br />
        Resources Company
      </div>
      <img
        src="/cv-assets/tatweer-logo.png"
        alt=""
        style={{ position: "absolute", left: 360, top: 56, width: 73, height: 89 }}
      />
      <div
        style={abs(470, 50, {
          width: 280,
          textAlign: "center",
          color: GREY,
          fontSize: 26.7,
          lineHeight: "45px",
        })}
      >
        <ArT>
          شركة تطوير الأيدي
          <br />
          العاملة للاستقدام
        </ArT>
      </div>

      {/* Title: centred over the details column */}
      <div
        style={abs(DX0, 154, {
          width: X1 - DX0,
          display: "flex",
          justifyContent: "space-between",
          padding: "0 70px",
          boxSizing: "border-box",
          color: "#4c94d8",
          fontSize: 20,
        })}
      >
        <span style={{ borderBottom: "1px solid #4b93d7", lineHeight: "30px" }}>Recruitment</span>
        <span style={{ borderBottom: "1px solid #4b93d7", lineHeight: "30px" }}>
          <ArT>استقدام</ArT>
        </span>
      </div>

      {/* Full-size photo frame + video buttons */}
      <div
        style={{
          position: "absolute",
          left: X0,
          top: NAME_Y,
          width: PHOTO_X1 - X0,
          height: frameH,
          border: "1px solid #000",
          boxSizing: "border-box",
        }}
      >
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          style={{ position: "absolute", left: inset, top: inset, right: inset, height: photoH }}
          placeholder={
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: TEAL,
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 14.7,
              }}
            >
              FULL SIZE PHOTO
            </div>
          }
        />
        {d.video && (
          <VideoButtons
            play={d.video.play}
            download={d.video.download}
            color={MAROON}
            height={BUTTONS_H}
            style={{ position: "absolute", left: inset, right: inset, bottom: inset }}
          />
        )}
      </div>

      {/* Name band */}
      <HLine x0={DX0} x1={X1} yy={NAME_Y} />
      <div
        style={abs(DX0, NAME_Y, {
          width: X1 - DX0,
          height: NAME_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          color: "#000",
        })}
      >
        {d.fullName}
      </div>
      <HLine x0={DX0} x1={X1} yy={ROWS_Y} />

      {/* Detail rows: label | value on underline | Arabic label */}
      {rows.map(([en, ar, v], i) => {
        const top = ROWS_Y + i * ROW_H;
        const cell = (left: number, right: number, extra: React.CSSProperties) =>
          abs(left, top, {
            width: right - left,
            height: ROW_H,
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box",
            fontSize: 13.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            ...extra,
          });
        return (
          <React.Fragment key={en}>
            <div style={cell(COLS[0], COLS[1], { color: MAROON, paddingLeft: 4 })}>{en}</div>
            <div
              style={cell(COLS[1], COLS[2], {
                justifyContent: "center",
                alignItems: "flex-end",
                paddingBottom: 5,
                color: "#000",
              })}
            >
              {v}
            </div>
            <div
              style={cell(COLS[2], COLS[3], {
                justifyContent: "flex-end",
                color: MAROON,
                paddingRight: 4,
              })}
            >
              <ArT>{ar}</ArT>
            </div>
            <HLine x0={COLS[1]} x1={COLS[2]} yy={top + ROW_H - 1} color="#9a9a9a" />
          </React.Fragment>
        );
      })}
      <HLine x0={DX0} x1={X1} yy={ROWS_Y + ROW_COUNT * ROW_H} />

      {/* Skills */}
      <div
        style={abs(DX0, SKILLS_TITLE_Y, {
          width: X1 - DX0,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 70px",
          boxSizing: "border-box",
          color: MAROON,
          fontSize: 14,
        })}
      >
        <span style={{ borderBottom: `1px solid ${MAROON}`, lineHeight: "22px" }}>Skills</span>
        <span style={{ borderBottom: `1px solid ${MAROON}`, lineHeight: "22px" }}>
          <ArT>المهارات</ArT>
        </span>
      </div>
      {SKILL_ROWS.map((pair, r) => {
        const top = SKILLS_Y + r * SKILL_ROW_H;
        return (
          <React.Fragment key={r}>
            {pair.flatMap(([en, ar, key], half) =>
              [en, key, ar].map((content, c) => {
                const i = half * 3 + c;
                return (
                  <div
                    key={i}
                    style={abs(SK_X[i], top, {
                      width: SK_X[i + 1] - SK_X[i] + 1,
                      height: SKILL_ROW_H + 1,
                      boxSizing: "border-box",
                      border: "1px solid #000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: c === 1 ? "center" : c === 0 ? "flex-start" : "flex-end",
                      padding: "0 8px",
                      color: TEAL,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    })}
                  >
                    {c === 0 && content}
                    {c === 1 && d.hasSkill(key) && <Tick size={12} />}
                    {c === 2 && <ArT>{content}</ArT>}
                  </div>
                );
              }),
            )}
          </React.Fragment>
        );
      })}

      {/* Footer */}
      <HLine x0={X0} x1={X1} yy={975} color={BLUE} h={3} />
      <div
        style={abs(X0, 995, {
          width: X1 - X0,
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          color: BLUE,
          fontSize: 24,
        })}
      >
        <span>For contact</span>
        <img src="/cv-assets/tatweer-phone.jpg" alt="" style={{ width: 38, height: 33 }} />
        <span>920020006</span>
        <img src="/cv-assets/tatweer-whatsapp.jpg" alt="" style={{ width: 31, height: 32 }} />
        <ArT>للتواصل</ArT>
      </div>
    </Page>
  );
}
