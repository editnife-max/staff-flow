// JAWA CV Format — geometry measured from Word's PDF of the template (612×828pt page),
// rows stretched by SY to fill A4. Values follow buildFilledDocx's Jawa rules.
import React from "react";
import type { CvData, SkillKey } from "./cv-data";
import { Ar, Cell, type CellProps, Page, PhotoBox, Tick } from "./primitives";

const GREY = "#e8e8e8";
const HEAD: React.CSSProperties = {
  fontFamily: "Tahoma, Arial, sans-serif",
  fontWeight: 700,
  fontSize: 15.6,
};
const LABEL: React.CSSProperties = { fontFamily: "Verdana, Arial, sans-serif", fontSize: 15.6 };
const VALUE: React.CSSProperties = {
  fontFamily: "'Times New Roman', Times, serif",
  fontWeight: 700,
  fontSize: 15.6,
};
const AR: React.CSSProperties = {
  fontFamily: "'Times New Roman', Arial, serif",
  fontWeight: 700,
  fontSize: 13.4,
};

const SY = 1.04;
const OY = 8;
const y = (v: number) => Math.round(OY + v * SY);

function G(p: CellProps) {
  return <Cell {...p} y0={y(p.y0)} y1={y(p.y1)} />;
}

const ArL = ({ children }: { children: React.ReactNode }) => <Ar style={AR}>{children}</Ar>;

const SKILL_ROWS: Array<
  [[string, string, SkillKey | null], [string, string, SkillKey | null], number, number]
> = [
  [["Ironing", "كي الملابس", "ironing"], ["Baby Sitting", "جليسة اطفال", "babySitting"], 748, 773],
  [["Cooking", "الطبخ", "cooking"], ["Children Care", "رعاية الاطفال", "childCare"], 773, 796],
  [
    ["Arabic Cooking", "الطبخ العربي", "arabCooking"],
    ["Tutoring", "التدريس", "tutoring"],
    796,
    819,
  ],
  [["Sewing", "الخياطة", "sewing"], ["Cleaning", "التنظيف", "cleaning"], 819, 842],
  [["Computer", "الكمبيوتر", "computer"], ["Washing", "الغسيل", "washing"], 842, 865],
];

export function JawaCv({ d }: { d: CvData }) {
  const details: Array<[string, React.ReactNode, string, number, number]> = [
    ["Contract Period", <span style={VALUE}>2 YEARS</span>, "مدة العقد", 245, 268],
    [
      "Passport No.",
      <span style={{ ...VALUE, fontWeight: 400 }}>{d.passportNo}</span>,
      "رقم الجواز",
      268,
      291,
    ],
  ];
  const app: Array<[React.ReactNode, string, string, number, number]> = [
    ["Nationality", d.nationalityEn.toUpperCase(), "الجنسية", 331, 354],
    ["Adress", d.livingTown, "العنوان", 354, 378],
    [
      <>
        Date of Birth &amp;
        <br />
        Age
      </>,
      "",
      "العمر وتاريخ الميلاد",
      378,
      418,
    ],
    ["Place of Birth", d.birthPlace, "مكان الميلاد", 418, 441],
    ["Marital Status", d.maritalEn, "الحالة الاجتماعية", 441, 465],
    ["No. of Children", d.children, "عدد الاطفال", 465, 488],
  ];
  const lang: Array<[string, string, string, number, number]> = [
    ["English", d.englishLevel, "اللغة الانجليزية", 511, 536],
    ["Arabic", d.arabicLevel, "اللغة العربية", 536, 559],
    ["Education", d.educationEn, "التعليم", 559, 583],
  ];
  const ageText = d.age ? `${d.age} years` : "";

  return (
    <Page>
      {/* Header: phone numbers + logo */}
      <img
        src="/cv-assets/jawa-phone.png"
        alt=""
        style={{ position: "absolute", left: 56, top: y(55), width: 31, height: 31 }}
      />
      <img
        src="/cv-assets/jawa-whatsapp.png"
        alt=""
        style={{ position: "absolute", left: 55, top: y(97), width: 36, height: 36 }}
      />
      {[58, 101].map((top) => (
        <div
          key={top}
          style={{
            position: "absolute",
            left: 99,
            top: y(top) - 2,
            color: "#996633",
            fontFamily: "Ebrima, 'Segoe UI', Arial, sans-serif",
            fontWeight: 700,
            fontSize: 19.5,
          }}
        >
          +966 55132 7872
        </div>
      ))}
      <img
        src="/cv-assets/jawa-logo.png"
        alt=""
        style={{ position: "absolute", left: 274, top: y(45), width: 458, height: 81 }}
      />

      {/* Identity rows */}
      <G x0={49} y0={148} x1={183} y1={168} bg={GREY} align="center">
        <span style={HEAD}>Reg no:</span>
      </G>
      <G x0={183} y0={148} x1={746} y1={168} align="center">
        <span style={{ ...VALUE, fontSize: 14.3 }}>{d.serial}</span>
      </G>
      <G x0={49} y0={168} x1={183} y1={189} bg={GREY} align="center">
        <span style={HEAD}>Name :</span>
      </G>
      <G x0={183} y0={168} x1={521} y1={189} align="center">
        <span style={{ ...VALUE, fontSize: 14.3 }}>{d.fullName}</span>
      </G>
      <G x0={521} y0={168} x1={628} y1={189} bg={GREY} align="center">
        <span style={HEAD}>Contact no :</span>
      </G>
      <G x0={628} y0={168} x1={746} y1={189} align="center">
        <span style={{ ...VALUE, fontSize: 12.5 }}>{d.phone1}</span>
      </G>

      {(
        [
          ["Religion", 49, 183],
          ["Height", 183, 271],
          ["Weight", 271, 364],
          ["Position Applied", 364, 521],
        ] as const
      ).map(([t, a, b]) => (
        <G key={t} x0={a} y0={189} x1={b} y1={221} bg={GREY} align="center">
          <span style={HEAD}>{t}</span>
        </G>
      ))}
      <G x0={521} y0={189} x1={628} y1={221} align="center">
        <span style={HEAD}>Housemaid</span>
      </G>
      <G x0={628} y0={189} x1={746} y1={221} align="center">
        <span style={HEAD}>DH</span>
      </G>

      <G x0={49} y0={221} x1={183} y1={245} align="center">
        <span style={{ ...VALUE, fontWeight: 400 }}>{d.isMuslim ? "MUSLIM" : "NON-MUSLIM"}</span>
      </G>
      <G x0={183} y0={221} x1={271} y1={245} align="center">
        <span style={{ ...VALUE, fontWeight: 400 }}>{d.height || "-"}</span>
      </G>
      <G x0={271} y0={221} x1={364} y1={245} align="center">
        <span style={{ ...VALUE, fontWeight: 400 }}>{d.weight || "-"}</span>
      </G>
      <G x0={364} y0={221} x1={521} y1={245} pad={6}>
        <span style={LABEL}>Monthly Salary</span>
      </G>
      <G x0={521} y0={221} x1={628} y1={245} align="center">
        <span style={{ ...VALUE, fontSize: 18.2 }}>{d.salary}</span>
      </G>
      <G x0={628} y0={221} x1={746} y1={245} align="center">
        <ArL>الراتب الشهري</ArL>
      </G>

      {/* Full-size photo */}
      <G x0={49} y0={245} x1={364} y1={727} pad={0}>
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          style={{ position: "absolute", left: 6, top: 6, right: 6, bottom: 6 }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                fontFamily: "'Times New Roman', serif",
                fontSize: 15.6,
              }}
            >
              FULL SIZE PHOTO
            </span>
          }
        />
      </G>

      {/* Contract / passport */}
      {details.map(([en, v, ar, a, b]) => (
        <React.Fragment key={en}>
          <G x0={364} y0={a} x1={521} y1={b} pad={6}>
            <span style={LABEL}>{en}</span>
          </G>
          <G x0={521} y0={a} x1={628} y1={b} align="center">
            {v}
          </G>
          <G x0={628} y0={a} x1={746} y1={b} align="center">
            <ArL>{ar}</ArL>
          </G>
        </React.Fragment>
      ))}

      {/* Details of application */}
      <G x0={364} y0={291} x1={746} y1={331} bg={GREY} align="center">
        <span style={{ ...HEAD, fontSize: 14.6 }}>Details of Application</span>
      </G>
      {app.map(([en, v, ar, a, b], i) => (
        <React.Fragment key={i}>
          <G x0={364} y0={a} x1={521} y1={b} pad={6}>
            <span style={LABEL}>{en}</span>
          </G>
          <G x0={521} y0={a} x1={628} y1={b} align="center">
            {i === 2 ? (
              <span style={{ ...VALUE, fontSize: 12.9 }}>
                {d.dob}
                <br />
                {ageText}
              </span>
            ) : (
              <span style={{ ...VALUE, fontSize: i === 0 ? 15.6 : 12.9 }}>{v}</span>
            )}
          </G>
          <G x0={628} y0={a} x1={746} y1={b} align="center">
            <ArL>{ar}</ArL>
          </G>
        </React.Fragment>
      ))}

      {/* Language & education */}
      <G x0={364} y0={488} x1={628} y1={511} bg={GREY} pad={6}>
        <span style={HEAD}>Language &amp; Education</span>
      </G>
      <G x0={628} y0={488} x1={746} y1={511} bg={GREY} />
      {lang.map(([en, v, ar, a, b]) => (
        <React.Fragment key={en}>
          <G x0={364} y0={a} x1={521} y1={b} pad={6}>
            <span style={LABEL}>{en}</span>
          </G>
          <G x0={521} y0={a} x1={628} y1={b} align="center">
            <span style={{ ...VALUE, fontSize: 12.9 }}>{v}</span>
          </G>
          <G x0={628} y0={a} x1={746} y1={b} align="center">
            <ArL>{ar}</ArL>
          </G>
        </React.Fragment>
      ))}

      {/* Previous employment */}
      <G x0={364} y0={583} x1={628} y1={607} bg={GREY} pad={6}>
        <span style={HEAD}>Previous Employment Abroad</span>
      </G>
      <G x0={628} y0={583} x1={746} y1={607} bg={GREY} align="center">
        <ArL>الخبرات السابقة</ArL>
      </G>
      {(
        [
          ["Period", "الفترة", 364, 521],
          ["Position", "الوظيفة", 521, 628],
          ["City, County", "البلد المدينة", 628, 746],
        ] as const
      ).map(([en, ar, a, b]) => (
        <React.Fragment key={en}>
          <G x0={a} y0={607} x1={b} y1={630} align="center">
            <span style={LABEL}>{en}</span>
          </G>
          <G x0={a} y0={630} x1={b} y1={654} align="center">
            <ArL>{ar}</ArL>
          </G>
        </React.Fragment>
      ))}
      {(
        [
          [654, 677],
          [677, 701],
          [701, 727],
        ] as const
      ).map(([a, b], row) => (
        <React.Fragment key={a}>
          {(
            [
              [364, 521],
              [521, 628],
              [628, 746],
            ] as const
          ).map(([l, r], col) => (
            <G key={l} x0={l} y0={a} x1={r} y1={b} align="center">
              {row === 0 && !d.isFirstTime && (
                <span style={{ ...VALUE, fontSize: 12.9 }}>
                  {[d.experienceYears, "House Maid", d.experienceCountry][col]}
                </span>
              )}
            </G>
          ))}
        </React.Fragment>
      ))}

      {/* Skills & experience */}
      <G x0={49} y0={727} x1={521} y1={748} bg={GREY} align="center">
        <span style={{ ...HEAD, fontSize: 14.3 }}>Skills &amp; Experience</span>
      </G>
      <G x0={521} y0={727} x1={746} y1={748} bg={GREY} />
      {SKILL_ROWS.map(([left, right, a, b]) => (
        <React.Fragment key={a}>
          {(
            [
              [left, 49, 183, 271, 364],
              [right, 364, 521, 628, 746],
            ] as const
          ).map(([[en, ar, key], x0, x1, x2, x3]) => (
            <React.Fragment key={en}>
              <G x0={x0} y0={a} x1={x1} y1={b} pad={6}>
                <span style={LABEL}>{en}</span>
              </G>
              <G x0={x1} y0={a} x1={x2} y1={b} align="center">
                {key && d.hasSkill(key) && <Tick size={13} />}
              </G>
              <G x0={x2} y0={a} x1={x3} y1={b} align="center">
                <ArL>{ar}</ArL>
              </G>
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
      <G x0={49} y0={865} x1={183} y1={889} pad={6}>
        <span style={LABEL}>Other Skills</span>
      </G>
      <G x0={183} y0={865} x1={628} y1={889} />
      <G x0={628} y0={865} x1={746} y1={889} align="center">
        <ArL>المهارات الاخرى</ArL>
      </G>

      {/* Footer */}
      <img
        src="/cv-assets/jawa-footer.png"
        alt=""
        style={{ position: "absolute", left: 48, top: y(940), width: 692, height: 49 }}
      />
    </Page>
  );
}
