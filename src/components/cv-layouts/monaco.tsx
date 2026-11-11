// Monaco Sample CV — the template's design on a regular grid (A4).
// Values follow buildFilledDocx's Monaco rules.
//
// Every table shares the same outer edges (49–745). Below the applicant table the page
// splits into a left column of tables (49–497) and the full-size photo column (509–745),
// which ends level with the skills table.
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Ar, Cell, Page, PhotoBox, Tick, VideoButtons } from "./primitives";

const GREEN = "#9bba58";
const EN: React.CSSProperties = {
  fontFamily: "Cambria, Georgia, 'Times New Roman', serif",
  fontWeight: 700,
  fontSize: 14,
};
const AR: React.CSSProperties = {
  fontFamily: "'Times New Roman', Arial, serif",
  fontWeight: 700,
  fontSize: 14.5,
};

const X0 = 49;
const X1 = 745;
const ROW = 22;

const ArL = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <Ar style={{ ...AR, color }}>{children}</Ar>
);

/** Green section band: English left, Arabic right. */
function Band({
  x0,
  x1,
  y0,
  en,
  ar,
}: {
  x0: number;
  x1: number;
  y0: number;
  en: string;
  ar?: string;
}) {
  return (
    <Cell x0={x0} y0={y0} x1={x1} y1={y0 + ROW} bg={GREEN} pad={8} style={{ border: "none" }}>
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ ...EN, color: "#ffffff" }}>{en}</span>
        {ar && <ArL color="#ffffff">{ar}</ArL>}
      </div>
    </Cell>
  );
}

const SKILLS: Array<[string, string, SkillKey[]]> = [
  ["Arab Cooking:", "الطبخ", ["cooking", "arabCooking"]],
  ["Cleaning:", "التنظيف", ["cleaning"]],
  ["Washing:", "الغسيل", ["washing"]],
  ["Baby Sitting:", "تربية الاطفال", ["babySitting"]],
  ["Ironing:", "كي الملابس", ["ironing"]],
];

// Vertical plan.
const TOP_Y = 136;
const APP_Y = TOP_Y + 30 + ROW * 7 + 14; // 334
const LOWER_Y = APP_Y + ROW * 10 + 14; // 568
const LANG_Y = LOWER_Y + ROW + 24; // 614
const EMP_Y = LANG_Y + ROW * 4 + 14; // 716
const SKILL_Y = EMP_Y + ROW * 7 + 14; // 884
const LOWER_Y1 = SKILL_Y + ROW * 6; // 1016
const REMARKS_Y = LOWER_Y1 + 14; // 1030

// Column edges.
const LEFT_X1 = 497;
const PHOTO_X0 = 509;
const RIGHT_X0 = 237; // right of the head photo

export function MonacoCv({ d }: { d: CvData }) {
  const employment: Array<[string, string, string]> = [
    ["Position Applied:", "House Maid", "الوظيفة"],
    ["Monthly Salary:", d.salary, "الراتب الشهري"],
    ["Contract Period:", "2 YEARS", "مدة العقد"],
  ];
  const applicant: Array<[string, string, string]> = [
    ["Nationality:", d.nationalityEn || "Ethiopia", "الجنسية"],
    ["Religion:", d.religionEn, "الديانة"],
    ["Age:", d.age, "العمر"],
    ["Date of Birth:", d.dob, "تاريخ الميلاد"],
    ["Place of Birth:", d.birthPlace, "مكان الميلاد"],
    ["Permanent Address:", d.livingTown, "العنوان"],
    ["Marital Status:", d.maritalEn, "الحالة الاجتماعية"],
    ["Name of Spouse:", "", ""],
    ["No. of Children:", d.children, "عدد الاطفال"],
  ];
  const quad = [RIGHT_X0, 360, 477, 589, X1] as const;
  const empCols = [X0, 198, 348, LEFT_X1] as const;

  // Right column below the applicant table: photo, video buttons, height & weight.
  const HW_H = 26;
  const BUTTONS_H = 40;
  const hwY = LOWER_Y1 - HW_H;
  const buttonsY = hwY - 8 - BUTTONS_H;
  const photoY1 = d.video ? buttonsY - 8 : hwY - 8;

  return (
    <Page>
      {/* Page border + letterhead */}
      <div
        style={{
          position: "absolute",
          left: 33,
          top: 32,
          width: 729,
          height: 1059,
          border: "1px solid #000",
          boxSizing: "border-box",
        }}
      />
      <img
        src="/cv-assets/monaco-header.jpg"
        alt=""
        style={{ position: "absolute", left: 97, top: 42, width: 600, height: 80 }}
      />

      {/* Head photo, as tall as the block beside it */}
      <Cell x0={X0} y0={TOP_Y} x1={225} y1={TOP_Y + 30 + ROW * 7} pad={0}>
        <PhotoBox
          src={d.photos.photo}
          fit="cover"
          position="center top"
          style={{ width: "100%", height: "100%" }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 6,
                textAlign: "center",
                fontFamily: "Calibri, Arial, sans-serif",
                fontSize: 14,
              }}
            >
              photo
            </span>
          }
        />
      </Cell>

      {/* Agency / contact */}
      <Cell x0={quad[0]} y0={TOP_Y} x1={quad[1]} y1={TOP_Y + 30} pad={6}>
        <span style={{ ...EN, fontSize: 12.5, whiteSpace: "nowrap" }}>AGENCY / AGENT</span>
      </Cell>
      <Cell x0={quad[1]} y0={TOP_Y} x1={quad[2]} y1={TOP_Y + 30} />
      <Cell x0={quad[2]} y0={TOP_Y} x1={quad[3]} y1={TOP_Y + 30} pad={6}>
        <span style={EN}>Contact No.:</span>
      </Cell>
      <Cell x0={quad[3]} y0={TOP_Y} x1={quad[4]} y1={TOP_Y + 30} pad={6}>
        <span style={{ ...EN, fontSize: 13 }}>{d.phone1}</span>
      </Cell>

      {/* Employment details */}
      <Band x0={RIGHT_X0} x1={X1} y0={TOP_Y + 30} en="Employment Details" />
      <Cell x0={RIGHT_X0} y0={TOP_Y + 30 + ROW} x1={400} y1={TOP_Y + 30 + ROW * 2} pad={6}>
        <span style={EN}>Full Name:</span>
      </Cell>
      <Cell x0={400} y0={TOP_Y + 30 + ROW} x1={X1} y1={TOP_Y + 30 + ROW * 2} pad={6}>
        <span style={EN}>{d.fullName}</span>
      </Cell>
      {employment.map(([en, v, ar], i) => {
        const a = TOP_Y + 30 + ROW * (2 + i);
        return (
          <React.Fragment key={en}>
            <Cell x0={RIGHT_X0} y0={a} x1={400} y1={a + ROW} pad={6}>
              <span style={EN}>{en}</span>
            </Cell>
            <Cell x0={400} y0={a} x1={589} y1={a + ROW} pad={6}>
              <span style={EN}>{v}</span>
            </Cell>
            <Cell x0={589} y0={a} x1={X1} y1={a + ROW} align="right" pad={6}>
              <ArL>{ar}</ArL>
            </Cell>
          </React.Fragment>
        );
      })}
      {(
        [
          ["Passport No.:", d.passportNo, "Date of Issue:", d.passportIssue],
          ["Place of Issue:", d.placeOfIssue, "Date of Expiry:", d.passportExpiry],
        ] as const
      ).map((cells, i) => {
        const a = TOP_Y + 30 + ROW * (5 + i);
        return (
          <React.Fragment key={cells[0]}>
            {cells.map((t, c) => (
              <Cell key={c} x0={quad[c]} y0={a} x1={quad[c + 1]} y1={a + ROW} pad={6}>
                <span style={{ ...EN, fontSize: 13 }}>{t}</span>
              </Cell>
            ))}
          </React.Fragment>
        );
      })}

      {/* Applicant information */}
      <Band x0={X0} x1={X1} y0={APP_Y} en="Applicant Information" ar="بيانات مقدم الطلب" />
      {applicant.map(([en, v, ar], i) => {
        const a = APP_Y + ROW * (1 + i);
        return (
          <React.Fragment key={en}>
            <Cell x0={X0} y0={a} x1={260} y1={a + ROW} pad={6}>
              <span style={EN}>{en}</span>
            </Cell>
            <Cell x0={260} y0={a} x1={526} y1={a + ROW} pad={6}>
              <span style={EN}>{v}</span>
            </Cell>
            <Cell x0={526} y0={a} x1={X1} y1={a + ROW} align="right" pad={6}>
              <ArL>{ar}</ArL>
            </Cell>
          </React.Fragment>
        );
      })}

      {/* Education */}
      <Band x0={X0} x1={LEFT_X1} y0={LOWER_Y} en="Education" ar="المستوى التعليمي" />
      <Cell x0={X0} y0={LOWER_Y + ROW} x1={265} y1={LANG_Y} pad={6}>
        <span style={{ ...EN, fontSize: 12.5 }}>Educational Qualification</span>
      </Cell>
      <Cell x0={265} y0={LOWER_Y + ROW} x1={LEFT_X1} y1={LANG_Y} pad={6}>
        <span style={EN}>{d.educationEn}</span>
      </Cell>

      {/* Language literacy */}
      <Band x0={X0} x1={LEFT_X1} y0={LANG_Y} en="Language Literacy" ar="إجادة اللغات" />
      {(
        [
          ["", X0, 216],
          ["Speak", 216, 310],
          ["Write", 310, 404],
          ["Read", 404, LEFT_X1],
        ] as const
      ).map(([t, a, b]) => (
        <Cell key={a} x0={a} y0={LANG_Y + ROW} x1={b} y1={LANG_Y + ROW * 2} align="center">
          <span style={EN}>{t}</span>
        </Cell>
      ))}
      {(
        [
          ["ARABIC", "العربية", d.arabicLevel],
          ["ENGLISH", "الإنجليزية", d.englishLevel],
        ] as const
      ).map(([en, ar, lvl], i) => {
        const a = LANG_Y + ROW * (2 + i);
        return (
          <React.Fragment key={en}>
            <Cell x0={X0} y0={a} x1={216} y1={a + ROW} pad={6}>
              <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
                <span style={EN}>{en}</span>
                <ArL>{ar}</ArL>
              </div>
            </Cell>
            <Cell x0={216} y0={a} x1={310} y1={a + ROW} align="center">
              <span style={{ ...EN, fontSize: 13 }}>{lvl}</span>
            </Cell>
            <Cell x0={310} y0={a} x1={404} y1={a + ROW} />
            <Cell x0={404} y0={a} x1={LEFT_X1} y1={a + ROW} />
          </React.Fragment>
        );
      })}

      {/* Previous employment */}
      <Band x0={X0} x1={LEFT_X1} y0={EMP_Y} en="Previous Employment Abroad" ar="خبرة خارج البلاد" />
      {(
        [
          ["COUNTRY", "دولة"],
          ["POSITION", "موضع"],
          ["YEAR", "سنة"],
        ] as const
      ).map(([en, ar], c) => (
        <Cell
          key={en}
          x0={empCols[c]}
          y0={EMP_Y + ROW}
          x1={empCols[c + 1]}
          y1={EMP_Y + ROW * 2}
          pad={8}
        >
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
            <span style={{ ...EN, fontSize: 13 }}>{en}</span>
            <Ar style={{ ...AR, fontSize: 13.5, fontFamily: "Arial, sans-serif" }}>{ar}</Ar>
          </div>
        </Cell>
      ))}
      {[0, 1, 2, 3, 4].map((row) => {
        const a = EMP_Y + ROW * (2 + row);
        return (
          <React.Fragment key={row}>
            {[0, 1, 2].map((c) => (
              <Cell key={c} x0={empCols[c]} y0={a} x1={empCols[c + 1]} y1={a + ROW} pad={8}>
                {row === 0 && !d.isFirstTime && (
                  <span style={{ ...EN, fontSize: 13 }}>
                    {[d.experienceCountry, "House Maid", d.experienceYears][c]}
                  </span>
                )}
              </Cell>
            ))}
          </React.Fragment>
        );
      })}

      {/* Skills */}
      <Band x0={X0} x1={LEFT_X1} y0={SKILL_Y} en="Skills and Experience" ar="خبرة العمل" />
      {SKILLS.map(([en, ar, keys], i) => {
        const a = SKILL_Y + ROW * (1 + i);
        return (
          <React.Fragment key={en}>
            <Cell x0={X0} y0={a} x1={185} y1={a + ROW} pad={6}>
              <span style={EN}>{en}</span>
            </Cell>
            <Cell x0={185} y0={a} x1={341} y1={a + ROW} align="center">
              {keys.some((k) => d.hasSkill(k)) && <Tick size={13} />}
            </Cell>
            <Cell x0={341} y0={a} x1={LEFT_X1} y1={a + ROW} align="right" pad={6}>
              <ArL>{ar}</ArL>
            </Cell>
          </React.Fragment>
        );
      })}

      {/* Full-size photo, video buttons, height & weight */}
      <Cell x0={PHOTO_X0} y0={LOWER_Y} x1={X1} y1={photoY1} pad={0}>
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          style={{ position: "absolute", left: 4, top: 4, right: 4, bottom: 4 }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 6,
                textAlign: "center",
                fontFamily: "'Times New Roman', serif",
                fontSize: 15,
              }}
            >
              FULL SIZE PHOTO
            </span>
          }
        />
      </Cell>
      {d.video && (
        <VideoButtons
          play={d.video.play}
          download={d.video.download}
          color="#5f7f2a"
          height={BUTTONS_H}
          style={{ position: "absolute", left: PHOTO_X0, top: buttonsY, width: X1 - PHOTO_X0 + 1 }}
        />
      )}
      <Cell x0={PHOTO_X0} y0={hwY} x1={627} y1={LOWER_Y1} pad={8}>
        <span style={{ ...EN, fontSize: 13 }}>Height: {d.height}</span>
      </Cell>
      <Cell x0={627} y0={hwY} x1={X1} y1={LOWER_Y1} pad={8}>
        <span style={{ ...EN, fontSize: 13 }}>Weight: {d.weight}</span>
      </Cell>

      {/* Remarks */}
      <Cell
        x0={X0}
        y0={REMARKS_Y}
        x1={X1}
        y1={1078}
        valign="top"
        pad={10}
        style={{ paddingTop: 6 }}
      >
        <span style={EN}>REMARKS:</span>
        <span style={{ ...EN, fontWeight: 400, fontSize: 13, marginTop: 2 }}>{d.remark}</span>
      </Cell>
    </Page>
  );
}
