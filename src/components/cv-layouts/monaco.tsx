// Monaco Sample CV — geometry measured from Word's PDF of the template (A4).
// Values follow buildFilledDocx's Monaco rules.
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Ar, Cell, Page, PhotoBox, Tick } from "./primitives";

const GREEN = "#9bba58";
const EN: React.CSSProperties = {
  fontFamily: "Cambria, Georgia, 'Times New Roman', serif",
  fontWeight: 700,
  fontSize: 14.7,
};
const AR: React.CSSProperties = {
  fontFamily: "'Times New Roman', Arial, serif",
  fontWeight: 700,
  fontSize: 14.7,
};

const ArL = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <Ar style={{ ...AR, color }}>{children}</Ar>
);

function Band({
  x0,
  x1,
  y0,
  y1,
  en,
  ar,
  arLeft,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  en: string;
  ar?: string;
  arLeft?: number;
}) {
  return (
    <Cell x0={x0} y0={y0} x1={x1} y1={y1} bg={GREEN} pad={6} style={{ border: "none" }}>
      <span style={{ ...EN, color: "#ffffff" }}>{en}</span>
      {ar && (
        <span style={{ position: "absolute", left: arLeft, top: 2 }}>
          <ArL color="#ffffff">{ar}</ArL>
        </span>
      )}
    </Cell>
  );
}

const SKILLS: Array<[string, string, SkillKey[], number, number]> = [
  ["Arab Cooking:", "الطبخ", ["cooking", "arabCooking"], 882, 904],
  ["Cleaning:", "التنظيف", ["cleaning"], 904, 925],
  ["Washing:", "الغسيل", ["washing"], 925, 946],
  ["Baby Sitting:", "تربية الاطفال", ["babySitting"], 946, 967],
  ["Ironing:", "كي الملابس", ["ironing"], 967, 987],
];

export function MonacoCv({ d }: { d: CvData }) {
  const employment: Array<[string, string, string, number, number]> = [
    ["Position Applied:", "House Maid", "الوظيفة", 238, 259],
    ["Monthly Salary:", d.salary, "الراتب الشهري", 259, 280],
    ["Contract Period:", "2 YEARS", "مدة العقد", 280, 301],
  ];
  const applicant: Array<[string, string, string, number, number]> = [
    ["Nationality:", d.nationalityEn || "Ethiopia", "الجنسية", 375, 397],
    ["Religion:", d.religionEn, "الديانة", 397, 417],
    ["Age:", d.age, "العمر", 417, 439],
    ["Date of Birth:", d.dob, "تاريخ الميلاد", 439, 460],
    ["Place of Birth:", d.birthPlace, "مكان الميلاد", 460, 481],
    ["Permanent Address:", d.livingTown, "العنوان", 481, 504],
    ["Marital Status:", d.maritalEn, "الحالة الاجتماعية", 504, 525],
    ["Name of Spouse:", "", "", 525, 546],
    ["No. of Children:", d.children, "عدد الاطفال", 546, 567],
  ];
  const expRows: Array<[number, number]> = [
    [752, 773],
    [773, 795],
    [795, 816],
    [816, 838],
    [838, 859],
  ];

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
        style={{ position: "absolute", left: 103, top: 40, width: 600, height: 80 }}
      />

      {/* Head photo */}
      <Cell x0={58} y0={160} x1={220} y1={328} pad={0}>
        <PhotoBox
          src={d.photos.photo}
          fit="cover"
          position="center top"
          style={{ width: "100%", height: "100%" }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 63,
                top: 4,
                fontFamily: "Calibri, Arial, sans-serif",
                fontSize: 14.7,
              }}
            >
              photo
            </span>
          }
        />
      </Cell>

      {/* Agency / contact */}
      <Cell x0={250} y0={154} x1={351} y1={194} pad={6}>
        <span style={EN}>
          AGENCY
          <br />
          /AGENT
        </span>
      </Cell>
      <Cell x0={351} y0={154} x1={477} y1={194} />
      <Cell x0={477} y0={154} x1={589} y1={194} pad={6} valign="top" style={{ paddingTop: 2 }}>
        <span style={EN}>Contact No.:</span>
      </Cell>
      <Cell x0={589} y0={154} x1={745} y1={194} pad={6} valign="top" style={{ paddingTop: 2 }}>
        {d.phone1 ? (
          <span style={{ ...EN, fontSize: 13 }}>{d.phone1}</span>
        ) : (
          <span style={{ ...EN, background: "#ffff00" }}>+</span>
        )}
      </Cell>

      {/* Employment details */}
      <Band x0={250} x1={745} y0={194} y1={216} en="Employment Details" />
      <Cell x0={250} y0={216} x1={400} y1={238} pad={6}>
        <span style={EN}>Full Name:</span>
      </Cell>
      <Cell x0={400} y0={216} x1={745} y1={238} pad={6}>
        <span style={EN}>{d.fullName}</span>
      </Cell>
      {employment.map(([en, v, ar, a, b]) => (
        <React.Fragment key={en}>
          <Cell x0={250} y0={a} x1={400} y1={b} pad={6}>
            <span style={EN}>{en}</span>
          </Cell>
          <Cell x0={400} y0={a} x1={589} y1={b} pad={6}>
            <span style={EN}>{v}</span>
          </Cell>
          <Cell x0={589} y0={a} x1={745} y1={b} align="right" pad={6}>
            <ArL>{ar}</ArL>
          </Cell>
        </React.Fragment>
      ))}
      {(
        [
          ["Passport No.:", d.passportNo, "Date of Issue:", d.passportIssue, 303, 324],
          ["Place of Issue:", d.placeOfIssue, "Date of Expiry:", d.passportExpiry, 324, 346],
        ] as const
      ).map(([l1, v1, l2, v2, a, b]) => (
        <React.Fragment key={l1}>
          <Cell x0={250} y0={a} x1={351} y1={b} pad={6}>
            <span style={{ ...EN, fontSize: 13.3 }}>{l1}</span>
          </Cell>
          <Cell x0={351} y0={a} x1={477} y1={b} pad={6}>
            <span style={{ ...EN, fontSize: 13.3 }}>{v1}</span>
          </Cell>
          <Cell x0={477} y0={a} x1={589} y1={b} pad={6}>
            <span style={{ ...EN, fontSize: 13.3 }}>{l2}</span>
          </Cell>
          <Cell x0={589} y0={a} x1={745} y1={b} pad={6}>
            <span style={{ ...EN, fontSize: 13.3 }}>{v2}</span>
          </Cell>
        </React.Fragment>
      ))}

      {/* Applicant information */}
      <Band
        x0={49}
        x1={755}
        y0={355}
        y1={375}
        en="Applicant Information"
        ar="بيانات مقدم الطلب"
        arLeft={584}
      />
      {applicant.map(([en, v, ar, a, b]) => (
        <React.Fragment key={en}>
          <Cell x0={49} y0={a} x1={260} y1={b} pad={6}>
            <span style={EN}>{en}</span>
          </Cell>
          <Cell x0={260} y0={a} x1={526} y1={b} pad={6}>
            <span style={EN}>{v}</span>
          </Cell>
          <Cell x0={526} y0={a} x1={755} y1={b} align="right" pad={6}>
            <ArL>{ar}</ArL>
          </Cell>
        </React.Fragment>
      ))}

      {/* Education */}
      <Band x0={49} x1={500} y0={571} y1={592} en="Education" ar="المستوى التعليمي" arLeft={322} />
      <Cell x0={49} y0={592} x1={265} y1={619} pad={6}>
        <span style={{ ...EN, fontSize: 12, lineHeight: "12.5px" }}>
          EDUCATIONAL
          <br />
          QUALIFICATION
        </span>
      </Cell>
      <Cell x0={265} y0={592} x1={500} y1={619} pad={6}>
        <span style={EN}>{d.educationEn}</span>
      </Cell>

      {/* Language literacy */}
      <Band x0={49} x1={500} y0={619} y1={640} en="Language Literacy" />
      {(
        [
          ["", 49, 216],
          ["Speak", 216, 302],
          ["Write", 302, 415],
          ["Read", 415, 500],
        ] as const
      ).map(([t, a, b]) => (
        <Cell key={a} x0={a} y0={640} x1={b} y1={661} align="center">
          <span style={EN}>{t}</span>
        </Cell>
      ))}
      {(
        [
          ["ARABIC", "العربية", d.arabicLevel, 661, 683],
          ["ENGLISH", "الإنجليزية", d.englishLevel, 683, 704],
        ] as const
      ).map(([en, ar, lvl, a, b]) => (
        <React.Fragment key={en}>
          <Cell x0={49} y0={a} x1={216} y1={b} pad={6}>
            <span style={{ whiteSpace: "nowrap" }}>
              <span style={EN}>{en}</span>
              <ArL>{ar}</ArL>
            </span>
          </Cell>
          <Cell x0={216} y0={a} x1={302} y1={b} align="center">
            <span style={{ ...EN, fontSize: 13 }}>{lvl}</span>
          </Cell>
          <Cell x0={302} y0={a} x1={415} y1={b} />
          <Cell x0={415} y0={a} x1={500} y1={b} />
        </React.Fragment>
      ))}

      {/* Previous employment */}
      <Band
        x0={49}
        x1={504}
        y0={709}
        y1={730}
        en="Previous Employment Abroad"
        ar="خبرة خارج البلاد"
        arLeft={330}
      />
      {(
        [
          ["COUNTRY", "دولة", 49, 204],
          ["POSITION", "موضع", 204, 360],
          ["YEAR", "سنة", 360, 504],
        ] as const
      ).map(([en, ar, a, b]) => (
        <Cell key={en} x0={a} y0={730} x1={b} y1={752} pad={14}>
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
            <span style={EN}>{en}</span>
            <Ar style={{ ...AR, fontFamily: "Arial, sans-serif" }}>{ar}</Ar>
          </div>
        </Cell>
      ))}
      {expRows.map(([a, b], row) => (
        <React.Fragment key={a}>
          {(
            [
              [49, 204],
              [204, 360],
              [360, 504],
            ] as const
          ).map(([l, r], col) => (
            <Cell key={l} x0={l} y0={a} x1={r} y1={b} pad={6}>
              {row === 0 && !d.isFirstTime && (
                <span style={EN}>
                  {[d.experienceCountry, "House Maid", d.experienceYears][col]}
                </span>
              )}
            </Cell>
          ))}
        </React.Fragment>
      ))}

      {/* Skills */}
      <Band
        x0={49}
        x1={500}
        y0={862}
        y1={882}
        en="Skills and Experience"
        ar="خبرة العمل"
        arLeft={358}
      />
      {SKILLS.map(([en, ar, keys, a, b]) => (
        <React.Fragment key={en}>
          <Cell x0={49} y0={a} x1={180} y1={b} pad={6}>
            <span style={EN}>{en}</span>
          </Cell>
          <Cell x0={180} y0={a} x1={341} y1={b} align="center">
            {keys.some((k) => d.hasSkill(k)) && <Tick size={13} />}
          </Cell>
          <Cell x0={341} y0={a} x1={500} y1={b} align="right" pad={6}>
            <ArL>{ar}</ArL>
          </Cell>
        </React.Fragment>
      ))}
      <Cell x0={49} y0={987} x1={180} y1={1007} />
      <Cell x0={180} y0={987} x1={341} y1={1007} />
      <Cell x0={341} y0={987} x1={500} y1={1007} />

      {/* Full-size photo, height & weight */}
      <Cell x0={503} y0={589} x1={742} y1={969} pad={0}>
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          style={{ position: "absolute", left: 4, top: 4, right: 4, bottom: 4 }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 19,
                top: 0,
                fontFamily: "'Times New Roman', serif",
                fontSize: 16,
              }}
            >
              FULL SIZE PHOTO
            </span>
          }
        />
      </Cell>
      <Cell x0={504} y0={980} x1={628} y1={1002} pad={8} style={{ borderColor: "#4471c4" }}>
        <span style={EN}>Height: {d.height}</span>
      </Cell>
      <Cell x0={628} y0={980} x1={752} y1={1002} pad={8} style={{ borderColor: "#4471c4" }}>
        <span style={EN}>Weight: {d.weight}</span>
      </Cell>

      {/* Remarks */}
      <Cell x0={42} y0={1008} x1={770} y1={1090} valign="top" pad={10} style={{ paddingTop: 4 }}>
        <span style={EN}>REMARKS:</span>
        <span style={{ ...EN, fontWeight: 400, fontSize: 13, marginTop: 2 }}>{d.remark}</span>
      </Cell>
    </Page>
  );
}
