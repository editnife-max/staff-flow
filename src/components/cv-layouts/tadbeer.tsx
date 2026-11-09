// TADBEER CV Form — geometry measured from Word's PDF of the template (Letter page),
// with rows stretched by SY to fill A4. Values follow buildFilledDocx's TADBEER rules.
import React from "react";
import type { CvData, LevelStep, SkillKey } from "./cv-data";
import { Ar, Cell, type CellProps, Page, PhotoBox, Tick } from "./primitives";

const DARK = "#365f91";
const LIGHT = "#8db3e0";
const BLUE_TITLE = "#006fc0";
const LABEL: React.CSSProperties = {
  fontFamily: "Arial, sans-serif",
  fontWeight: 700,
  fontSize: 11.7,
};
const VALUE: React.CSSProperties = {
  fontFamily: "'Times New Roman', Times, serif",
  fontWeight: 700,
  fontSize: 13,
};
const AR: React.CSSProperties = {
  fontFamily: "Arial, Tahoma, sans-serif",
  fontWeight: 700,
  fontSize: 12.9,
};

const SY = 1.08;
const OY = 22;
const y = (v: number) => Math.round(OY + v * SY);

/** Cell on the template's measured grid (y values are pre-stretch). */
function G(p: CellProps) {
  return <Cell {...p} y0={y(p.y0)} y1={y(p.y1)} />;
}

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

const LEVEL_ROWS: Array<[LevelStep, string, number, number]> = [
  ["POOR", "لا شيء", 634, 666],
  ["LITTLE", "قليل", 666, 687],
  ["FAIR", "وسط", 687, 708],
  ["FLUENT", "ممتاز", 708, 730],
];

const SKILL_COLS: Array<[SkillKey[], string, string, number, number]> = [
  [["babySitting", "childCare"], "جليسة أطفال", "Baby Sitting", 12, 118],
  [["cleaning"], "التنظيف", "Cleaning", 118, 225],
  [["cooking"], "الطبخ", "Cooking", 225, 330],
  [["washing"], "الغسيل", "Washing", 330, 444],
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TadbeerCv({ d }: { d: CvData }) {
  const leftRows: Array<[string, string, string, number, number]> = [
    ["Nationality", "الجنسية", d.nationalityEn, 320, 342],
    ["Religion", "الديانة", d.religionEn, 342, 364],
    ["Date of Birth", "تاريخ الميلاد", d.dob, 364, 383],
    ["AGE", "العمر", d.age, 383, 399],
    ["Place Of  Birth", "مكان الميلاد", d.birthPlace, 399, 417],
    ["Living Town", "مكان السكن", d.livingTown, 417, 437],
    ["Marital Status", "الحالة الاجتماعية", d.maritalEn, 437, 455],
    ["No. Of Children", "عدد الأطفال", d.children, 455, 472],
    ["Weight", "الوزن", d.weight, 472, 495],
    ["Height", "الطول", d.height, 495, 515],
    ["Complexion", "لون البشرة", "", 515, 532],
  ];
  const passportRows: Array<[string, string, string, number, number]> = [
    ["Passport No.", "رقم الجواز", d.passportNo, 320, 342],
    ["Date Of Issue", "تاريخ الاصدار", d.passportIssue, 342, 364],
    ["Place Of  Issue", "مكان الاصدار", d.placeOfIssue, 364, 383],
    ["Date Of  EXP.", "تاريخ الانتهاء", d.passportExpiry, 383, 399],
  ];

  return (
    <Page>
      {/* Header */}
      <img
        src="/cv-assets/tadbeer-logo.png"
        alt=""
        style={{ position: "absolute", left: 41, top: y(62), width: 196, height: 66 }}
      />
      <img
        src="/cv-assets/tadbeer-flag.png"
        alt=""
        style={{ position: "absolute", left: 540, top: y(0), width: 226, height: 198 }}
      />
      <div
        style={{
          position: "absolute",
          left: 300,
          top: y(88),
          width: 160,
          textAlign: "center",
          color: BLUE_TITLE,
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "'Times New Roman', serif",
        }}
      >
        <Ar style={{ fontFamily: "'Times New Roman', Arial, serif" }}>سيرة ذاتية</Ar>
      </div>

      {/* Ref / date / destination */}
      <G x0={12} y0={150} x1={135} y1={168} />
      <G x0={135} y0={150} x1={240} y1={168} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 10.4, color: "#fff" }}>REF. NO</span>
      </G>
      <G x0={240} y0={150} x1={377} y1={168} align="center">
        <span style={VALUE}>{d.serial || "-"}</span>
      </G>
      <G x0={377} y0={150} x1={444} y1={168} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 10.4, color: "#fff" }}>DATE</span>
      </G>
      <G x0={444} y0={150} x1={560} y1={168} align="center">
        <span style={VALUE}>{today()}</span>
      </G>
      <G x0={560} y0={150} x1={629} y1={168} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 10.4, color: "#fff" }}>TO</span>
      </G>
      <G x0={629} y0={150} x1={788} y1={168} align="center">
        <span style={VALUE}>KSA</span>
      </G>
      <G x0={135} y0={168} x1={788} y1={182} />

      {/* Head photo */}
      <G x0={12} y0={168} x1={135} y1={276} pad={0}>
        <PhotoBox
          src={d.photos.photo}
          fit="cover"
          position="center top"
          style={{ width: "100%", height: "100%" }}
        />
      </G>

      {/* Post / salary / contract */}
      {(
        [
          ["Post Applied For", "الوظيفة", d.occupationEn, 182, 212, 15.6],
          ["Monthly Salary", "الراتب الشهري", d.salary, 212, 231, 15.6],
          ["Contract Period", "مدة العقد", "02 Years", 231, 276, 15.6],
        ] as const
      ).map(([en, ar, v, a, b, size]) => (
        <React.Fragment key={en}>
          <G
            x0={135}
            y0={a}
            x1={240}
            y1={b}
            bg={LIGHT}
            align="center"
            valign="top"
            style={{ paddingTop: 2 }}
          >
            <span style={LABEL}>{en}</span>
          </G>
          <G x0={240} y0={a} x1={630} y1={b} align="center" valign="top" style={{ paddingTop: 1 }}>
            <span style={{ ...VALUE, fontSize: size }}>{v}</span>
          </G>
          <G
            x0={630}
            y0={a}
            x1={788}
            y1={b}
            bg={LIGHT}
            align="right"
            valign="top"
            style={{ paddingTop: 2 }}
          >
            <ArLabel>{ar}</ArLabel>
          </G>
        </React.Fragment>
      ))}

      {/* Name */}
      <G x0={12} y0={276} x1={240} y1={301} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 12.9, color: "#fff" }}>NAME IN FULL</span>
      </G>
      <G x0={240} y0={276} x1={630} y1={301} align="center">
        <span style={{ ...LABEL, fontSize: 13.5 }}>{d.fullName}</span>
      </G>
      <G x0={630} y0={276} x1={788} y1={301} bg={DARK} align="center">
        <ArLabel size={15.6} color="#fff">
          الاسم الكامل
        </ArLabel>
      </G>

      {/* Section titles */}
      <G x0={12} y0={301} x1={441} y1={320} pad={2}>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ ...LABEL, fontSize: 15.6 }}>DETAILS OF APPLICATION</span>
          <ArLabel size={15}>بيانات صاحب العمل</ArLabel>
        </div>
      </G>
      <G x0={446} y0={301} x1={788} y1={320} pad={2}>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ ...LABEL, fontSize: 14.3 }}>PASSPORT DETAILS</span>
          <ArLabel size={15}>بيانات جواز السفر</ArLabel>
        </div>
      </G>

      {/* Application details */}
      {leftRows.map(([en, ar, v, a, b]) => (
        <React.Fragment key={en}>
          <G x0={12} y0={a} x1={118} y1={b} bg={LIGHT} pad={2}>
            <span style={LABEL}>{en}</span>
          </G>
          <G x0={118} y0={a} x1={337} y1={b} align="center">
            <span style={VALUE}>{v}</span>
          </G>
          <G x0={337} y0={a} x1={441} y1={b} bg={LIGHT} align="right" pad={2}>
            <ArLabel>{ar}</ArLabel>
          </G>
        </React.Fragment>
      ))}
      <G x0={12} y0={532} x1={118} y1={567} bg={LIGHT} pad={2}>
        <span style={LABEL}>
          Educational
          <br />
          Qualification
        </span>
      </G>
      <G x0={118} y0={532} x1={337} y1={567} align="center">
        <span style={VALUE}>{d.educationEn}</span>
      </G>
      <G x0={337} y0={532} x1={441} y1={567} bg={LIGHT} align="right" pad={2}>
        <ArLabel>الدرجة العلمية</ArLabel>
      </G>

      {/* Passport details */}
      {passportRows.map(([en, ar, v, a, b]) => (
        <React.Fragment key={en}>
          <G x0={446} y0={a} x1={541} y1={b} bg={LIGHT} pad={2}>
            <span style={{ ...LABEL, fontSize: 10.4 }}>{en}</span>
          </G>
          <G x0={541} y0={a} x1={661} y1={b} align="center">
            <span style={{ ...LABEL, fontSize: 12 }}>{v}</span>
          </G>
          <G x0={661} y0={a} x1={788} y1={b} bg={LIGHT} align="right" pad={2}>
            <ArLabel>{ar}</ArLabel>
          </G>
        </React.Fragment>
      ))}
      <G x0={446} y0={399} x1={788} y1={432} pad={3}>
        <span style={{ ...VALUE, fontSize: 12.9 }}>
          HOUSE MAID{" "}
          <span style={{ fontFamily: "Calibri, Arial, sans-serif", fontSize: 15.6 }}>MOB:</span>{" "}
          {d.phone1}
        </span>
      </G>
      <G x0={446} y0={432} x1={788} y1={881} pad={0}>
        <PhotoBox
          src={d.photos.fullPhoto}
          fit="contain"
          style={{
            position: "absolute",
            left: 11,
            top: 6,
            width: 320,
            height: y(846) - y(437),
            border: d.photos.fullPhoto ? undefined : "1px solid #000",
          }}
          placeholder={
            <span
              style={{
                position: "absolute",
                left: 6,
                top: 4,
                fontFamily: "'Times New Roman', serif",
                fontSize: 12.9,
              }}
            >
              Full size photo
            </span>
          }
        />
      </G>

      {/* Languages */}
      <G x0={12} y0={567} x1={441} y1={600} pad={12}>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ ...LABEL, fontSize: 16.8 }}>KNOWLEDGE LANGUAGES</span>
          <ArLabel size={15.6}>إجادة اللغات</ArLabel>
        </div>
      </G>
      <G x0={12} y0={600} x1={118} y1={634} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 10.4, color: "#fff" }}>ENGLISH</span>
      </G>
      <G x0={118} y0={600} x1={230} y1={634} bg={DARK} align="center">
        <ArLabel color="#fff">إنجليزي</ArLabel>
      </G>
      <G x0={230} y0={600} x1={337} y1={634} bg={DARK} align="center">
        <span style={{ ...LABEL, fontSize: 10.4, color: "#fff" }}>ARABIC</span>
      </G>
      <G x0={337} y0={600} x1={441} y1={634} bg={DARK} align="center">
        <ArLabel size={15.6} color="#fff">
          عربي
        </ArLabel>
      </G>
      {LEVEL_ROWS.map(([step, ar, a, b]) => (
        <React.Fragment key={step}>
          <G x0={12} y0={a} x1={118} y1={b} bg={LIGHT} align="center">
            <span style={{ ...LABEL, fontSize: 10.4 }}>{step}</span>
          </G>
          <G x0={118} y0={a} x1={230} y1={b} align="center">
            {d.englishStep === step && <Tick size={13} />}
          </G>
          <G x0={230} y0={a} x1={337} y1={b} align="center">
            {d.arabicStep === step && <Tick size={13} />}
          </G>
          <G x0={337} y0={a} x1={441} y1={b} bg={LIGHT} align="center">
            <ArLabel>{ar}</ArLabel>
          </G>
        </React.Fragment>
      ))}

      {/* Previous employment */}
      <G x0={12} y0={730} x1={441} y1={758} pad={10}>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ ...LABEL, fontSize: 12.9 }}>PREVIOUS EMPLOYMENT ABROAD</span>
          <ArLabel size={15.6}>الخبرة خارج البلد</ArLabel>
        </div>
      </G>
      <G x0={12} y0={758} x1={118} y1={779} bg={DARK} pad={2}>
        <span style={{ ...LABEL, fontSize: 9, color: "#fff" }}>COUNTRY</span>
      </G>
      <G x0={118} y0={758} x1={337} y1={779} align="center">
        {d.isFirstTime ? (
          <span style={{ ...VALUE, color: "#ff0000" }}>
            1<sup style={{ fontSize: 8.4 }}>ST</sup> TIME
          </span>
        ) : (
          <span style={VALUE}>{d.experienceCountry}</span>
        )}
      </G>
      <G x0={337} y0={758} x1={441} y1={779} bg={DARK} align="center">
        <ArLabel size={15.6} color="#fff">
          البلد
        </ArLabel>
      </G>
      <G x0={12} y0={779} x1={118} y1={799} bg={LIGHT} pad={2}>
        <span style={{ ...LABEL, fontSize: 10.4 }}>PERIOD</span>
      </G>
      <G x0={118} y0={779} x1={337} y1={799} align="center">
        <span style={{ ...VALUE, fontWeight: 400, fontSize: 11.7 }}>
          {d.experienceYears || "0"}
        </span>
      </G>
      <G x0={337} y0={779} x1={441} y1={799} bg={LIGHT} align="center">
        <ArLabel size={15.6}>المدة</ArLabel>
      </G>

      {/* Work experience */}
      <G x0={12} y0={799} x1={441} y1={831} pad={24}>
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ ...LABEL, fontSize: 14.3 }}>EXPERIENCE WORK</span>
          <ArLabel size={15.6}>خبرة العمل</ArLabel>
        </div>
      </G>
      <G x0={12} y0={831} x1={118} y1={861} bg={LIGHT} align="center">
        <ArLabel>الديكور</ArLabel>
      </G>
      <G x0={118} y0={831} x1={337} y1={861} bg={LIGHT} align="center">
        <ArLabel>القيادة</ArLabel>
      </G>
      <G x0={337} y0={831} x1={441} y1={861} bg={LIGHT} align="center">
        <ArLabel>الخياطة</ArLabel>
      </G>
      <G x0={12} y0={861} x1={118} y1={881} align="center">
        <span style={VALUE}>YES</span>
      </G>
      <G x0={118} y0={861} x1={337} y1={881} />
      <G x0={337} y0={861} x1={441} y1={881} align="center">
        <span style={VALUE}>YES</span>
      </G>

      {/* Skills */}
      {SKILL_COLS.map(([keys, ar, en, a, b]) => (
        <React.Fragment key={en}>
          <G
            x0={a}
            y0={881}
            x1={b}
            y1={937}
            bg={LIGHT}
            align="center"
            style={{ justifyContent: "space-between", padding: "4px 2px" }}
          >
            <ArLabel>{ar}</ArLabel>
            <span style={{ ...LABEL, fontSize: 10.4 }}>{en}</span>
          </G>
          <G x0={a} y0={937} x1={b} y1={988} align="center">
            {keys.some((k) => d.hasSkill(k)) && <Tick size={13} />}
          </G>
        </React.Fragment>
      ))}
      <G x0={444} y0={881} x1={523} y1={937} bg={LIGHT} align="center">
        <span style={LABEL}>Deduction</span>
      </G>
      <G x0={523} y0={881} x1={720} y1={937} />
      <G x0={720} y0={881} x1={788} y1={937} bg={LIGHT} align="center" pad={1}>
        <ArLabel size={12}>المبلغ المقتطع</ArLabel>
      </G>
      <G x0={444} y0={937} x1={523} y1={988} bg={LIGHT} align="center">
        <span style={LABEL}>Notes</span>
      </G>
      <G x0={523} y0={937} x1={720} y1={988} align="center">
        <span style={VALUE}>
          She is ready to for <span style={{ fontSize: 9 }}>KSA</span>
        </span>
      </G>
      <G x0={720} y0={937} x1={788} y1={988} bg={LIGHT} align="center">
        <ArLabel>ملاحظات</ArLabel>
      </G>
    </Page>
  );
}
