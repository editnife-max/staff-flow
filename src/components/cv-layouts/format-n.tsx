// CV Format N (Tatweer) — geometry measured from Word's PDF of the template (A4).
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Ar, Page, PhotoBox, Tick } from "./primitives";

const FONT = "Dubai, 'Segoe UI', Tahoma, Arial, sans-serif";
const MAROON = "#a42449";
const TEAL = "#074f6a";
const GREY = "#747474";
const BLUE = "#215e99";

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
function VLine({ xx, y0, y1 }: { xx: number; y0: number; y1: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: xx,
        top: y0,
        width: 1,
        height: y1 - y0,
        background: "#000",
      }}
    />
  );
}

// [en label, ar label, value, top line, bottom line]
type Row = [React.ReactNode, React.ReactNode, string, number, number];

const SKILL_ROWS: Array<[[string, string, SkillKey], [string, string, SkillKey], number, number]> =
  [
    [
      ["Cleaning:", "التنظيف:", "cleaning"],
      ["Child care:", "رعاية الأطفال:", "childCare"],
      685,
      704,
    ],
    [["Ironing:", "الكي:", "ironing"], ["Elderly care:", "رعاية المسنين:", "elderCare"], 704, 728],
    [["Washing:", "الغسيل:", "washing"], ["Cooking:", "الطبخ:", "cooking"], 728, 747],
  ];
// Column edges of the skills table: EN label | ✓ | EN label | ✓ | ✓ | AR label | ✓ | AR label
const SK_X = [257, 361, 386, 494, 528, 559, 689, 714, 806];

export function FormatNCv({ d }: { d: CvData }) {
  const experience = d.isFirstTime
    ? d.experienceEn || "First Time"
    : [d.experienceEn, d.experienceCountry, d.experienceYears].filter(Boolean).join(" · ");
  const rows: Row[] = [
    ["Age:", "العمر:", d.age, 239, 267],
    ["Date of Birth:", "تاريخ الميلاد:", d.dob, 267, 299],
    ["Salary:", "الراتب:", d.salary, 299, 322],
    ["Profession:", "المهنة:", d.occupationEn, 322, 367],
    ["Experience:", "الخبرة:", experience, 367, 409],
    [
      <>
        English
        <br />
        language:
      </>,
      "اللغة العربية:",
      d.englishLevel,
      409,
      454,
    ],
    ["Religion:", "الديانة:", d.religionEn, 454, 477],
    [
      "Education:",
      <>
        الدرجة
        <br />
        التعليمية:
      </>,
      d.educationEn,
      477,
      523,
    ],
    ["Certificates:", "الشهادات:", "", 523, 546],
    [
      "Marital status:",
      <>
        الحالة
        <br />
        الاجتماعية:
      </>,
      d.maritalEn,
      546,
      592,
    ],
    ["No. of kids:", "عدد الأطفال:", d.children, 592, 615],
    ["Weight:", "الوزن:", d.weight, 615, 639],
    ["Height:", "الطول:", d.height, 639, 662],
  ];

  return (
    <Page style={{ fontFamily: FONT }}>
      {/* Letterhead */}
      <div
        style={abs(130, 70, {
          width: 220,
          textAlign: "center",
          color: GREY,
          fontSize: 22.7,
          lineHeight: "39px",
        })}
      >
        Tatweer Human
        <br />
        ResourcesCompany
      </div>
      <img
        src="/cv-assets/tatweer-logo.png"
        alt=""
        style={{ position: "absolute", left: 395, top: 71, width: 73, height: 89 }}
      />
      <div
        style={abs(556, 62, {
          width: 210,
          textAlign: "center",
          color: GREY,
          fontSize: 26.7,
          lineHeight: "45px",
        })}
      >
        <Ar style={{ fontFamily: FONT }}>
          شركة تطوير الأيدي
          <br />
          العاملة للاستقدام
        </Ar>
      </div>

      {/* Title */}
      <div style={abs(342, 160, { color: "#4c94d8", fontSize: 20 })}>Recruitment</div>
      <HLine x0={342} x1={448} yy={189} color="#4b93d7" />
      <div style={abs(628, 160, { color: "#4c94d8", fontSize: 20 })}>
        <Ar style={{ fontFamily: FONT }}>استقدام</Ar>
      </div>
      <HLine x0={628} x1={690} yy={189} color="#4b93d7" />

      {/* Full-size photo frame */}
      <HLine x0={0} x1={250} yy={195} />
      <VLine xx={249} y0={195} y1={658} />
      <HLine x0={0} x1={250} yy={657} />
      <div style={abs(0, 196, { width: 249, textAlign: "center", color: TEAL, fontSize: 14.7 })}>
        {d.photos.fullPhoto ? "" : "FULL SIZE PHOTO"}
      </div>
      <PhotoBox
        src={d.photos.fullPhoto}
        fit="contain"
        style={{ position: "absolute", left: 6, top: 202, width: 237, height: 449 }}
      />

      {/* Name band */}
      <HLine x0={257} x1={785} yy={199} />
      <div
        style={abs(257, 199, {
          width: 528,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          color: "#000",
        })}
      >
        {d.fullName}
      </div>
      <HLine x0={257} x1={785} yy={239} />

      {/* Detail rows: label | value on underline | Arabic label */}
      {rows.map(([en, ar, v, top, bottom], i) => (
        <React.Fragment key={i}>
          <div
            style={abs(257, top, {
              width: 100,
              height: bottom - top,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: MAROON,
              fontSize: 13.3,
              lineHeight: "23px",
            })}
          >
            {en}
          </div>
          <div
            style={abs(357, top, {
              width: 332,
              height: bottom - top,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 3,
              boxSizing: "border-box",
              color: "#000",
              fontSize: 13.3,
            })}
          >
            {v}
          </div>
          <div
            style={abs(690, top, {
              width: 95,
              height: bottom - top,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: MAROON,
              fontSize: 13.3,
              lineHeight: "23px",
            })}
          >
            <Ar style={{ fontFamily: FONT }}>{ar}</Ar>
          </div>
          {i < rows.length - 1 && <HLine x0={357} x1={689} yy={bottom} />}
        </React.Fragment>
      ))}
      <HLine x0={257} x1={785} yy={662} />

      {/* Skills */}
      <div style={abs(377, 659, { color: MAROON, fontSize: 13.3 })}>Skills</div>
      <HLine x0={377} x1={408} yy={678} color="#a32348" />
      <div style={abs(635, 659, { color: MAROON, fontSize: 13.3 })}>
        <Ar style={{ fontFamily: FONT }}>المهارات</Ar>
      </div>
      <HLine x0={635} x1={679} yy={678} color="#a32348" />
      {SKILL_ROWS.map(([a, b, top, bottom]) => {
        const cells: React.ReactNode[] = [a[0], a[2], b[0], b[2], b[2], b[1], a[2], a[1]].map(
          (c, i) => {
            const isLabel = i === 0 || i === 2 || i === 5 || i === 7;
            const content = isLabel ? (
              i >= 5 ? (
                <Ar style={{ fontFamily: FONT }}>{c as string}</Ar>
              ) : (
                c
              )
            ) : d.hasSkill(c as SkillKey) ? (
              <Tick size={11} />
            ) : null;
            return (
              <div
                key={i}
                style={abs(SK_X[i], top, {
                  width: SK_X[i + 1] - SK_X[i] + 1,
                  height: bottom - top + 1,
                  boxSizing: "border-box",
                  border: "1px solid #000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: TEAL,
                  fontSize: 10.7,
                })}
              >
                {content}
              </div>
            );
          },
        );
        return <React.Fragment key={top}>{cells}</React.Fragment>;
      })}
      <VLine xx={257} y0={747} y1={848} />

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          left: 94,
          top: 924,
          width: 606,
          height: 22,
          background: "#000",
        }}
      />
      <div style={abs(116, 1010, { color: BLUE, fontSize: 24 })}>For contact</div>
      <img
        src="/cv-assets/tatweer-phone.jpg"
        alt=""
        style={{ position: "absolute", left: 261, top: 1022, width: 38, height: 33 }}
      />
      <div style={abs(356, 1010, { color: BLUE, fontSize: 24 })}>920020006</div>
      <img
        src="/cv-assets/tatweer-whatsapp.jpg"
        alt=""
        style={{ position: "absolute", left: 530, top: 1023, width: 31, height: 32 }}
      />
      <div style={abs(606, 1010, { color: BLUE, fontSize: 24 })}>
        <Ar style={{ fontFamily: FONT }}>للتواصل</Ar>
      </div>
    </Page>
  );
}
