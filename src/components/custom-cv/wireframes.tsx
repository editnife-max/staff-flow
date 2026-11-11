// Schematic previews of the body structures for the layout picker (structure only).
import type { Structure } from "./config";

const BOX = "#e2e8f0";
const LINE = "#cbd5e1";

function Lines({
  x,
  y,
  w,
  n,
  gap = 5,
}: {
  x: number;
  y: number;
  w: number;
  n: number;
  gap?: number;
}) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i % 3 === 2 ? w * 0.65 : w}
          height={1.6}
          rx={0.8}
          fill={LINE}
        />
      ))}
    </>
  );
}

function Section({
  x,
  y,
  w,
  rows,
  color,
}: {
  x: number;
  y: number;
  w: number;
  rows: number;
  color: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={w} height={4} rx={1} fill={color} />
      <Lines x={x + 1} y={y + 7} w={w - 2} n={rows} gap={4.2} />
    </>
  );
}

export function StructureWireframe({
  structure,
  photoSide,
  color,
  width = 110,
}: {
  structure: Structure;
  photoSide: "left" | "right";
  color: string;
  width?: number;
}) {
  const flip = photoSide === "right" ? "translate(120 0) scale(-1 1)" : undefined;
  return (
    <svg
      viewBox="0 0 120 170"
      width={width}
      height={(width * 170) / 120}
      role="img"
      aria-label={`${structure} structure`}
      style={{ display: "block" }}
    >
      <rect width={120} height={170} fill="#ffffff" />
      <g transform={flip}>
        {structure === "sidebar" && (
          <>
            <rect x={0} y={0} width={38} height={170} fill={color} />
            <rect x={6} y={8} width={26} height={34} rx={2} fill="#ffffff" opacity={0.9} />
            <rect x={6} y={48} width={26} height={3} rx={1} fill="#ffffff" opacity={0.85} />
            <Lines x={6} y={55} w={26} n={4} />
            <rect x={6} y={78} width={26} height={3} rx={1} fill="#ffffff" opacity={0.85} />
            <Lines x={6} y={85} w={26} n={6} />
            <rect x={44} y={8} width={70} height={14} rx={2} fill={BOX} />
            <rect x={44} y={26} width={70} height={7} rx={1.5} fill={color} opacity={0.85} />
            <Section x={44} y={38} w={70} rows={7} color={color} />
            <Section x={44} y={76} w={70} rows={4} color={color} />
            <Section x={44} y={100} w={70} rows={5} color={color} />
            <rect x={44} y={158} width={70} height={1.2} fill={color} />
          </>
        )}
        {structure === "photo-column" && (
          <>
            <rect x={6} y={6} width={108} height={16} rx={2} fill={color} />
            <rect x={6} y={26} width={108} height={7} rx={1.5} fill={color} opacity={0.55} />
            <rect x={6} y={37} width={34} height={44} rx={2} fill={BOX} />
            <Section x={6} y={85} w={34} rows={4} color={color} />
            <Section x={6} y={108} w={34} rows={3} color={color} />
            <Section x={45} y={37} w={69} rows={8} color={color} />
            <Section x={45} y={79} w={69} rows={4} color={color} />
            <Section x={45} y={103} w={69} rows={3} color={color} />
            <Section x={45} y={122} w={69} rows={6} color={color} />
            <rect x={6} y={158} width={108} height={1.2} fill={color} />
          </>
        )}
        {structure === "single" && (
          <>
            <rect x={6} y={6} width={108} height={14} rx={2} fill={color} />
            <rect x={6} y={24} width={30} height={38} rx={2} fill={BOX} />
            <Section x={41} y={24} w={73} rows={4} color={color} />
            <Section x={41} y={46} w={73} rows={3} color={color} />
            <Section x={6} y={68} w={108} rows={6} color={color} />
            <Section x={6} y={100} w={108} rows={4} color={color} />
            <Section x={6} y={124} w={108} rows={5} color={color} />
            <rect x={6} y={158} width={108} height={1.2} fill={color} />
          </>
        )}
        {structure === "two-column" && (
          <>
            <rect x={6} y={6} width={108} height={14} rx={2} fill={color} />
            <rect x={6} y={24} width={108} height={7} rx={1.5} fill={color} opacity={0.55} />
            <rect x={16} y={35} width={32} height={42} rx={2} fill={BOX} />
            <Section x={6} y={82} w={51} rows={8} color={color} />
            <Section x={6} y={124} w={51} rows={4} color={color} />
            <Section x={63} y={35} w={51} rows={5} color={color} />
            <Section x={63} y={65} w={51} rows={6} color={color} />
            <Section x={63} y={100} w={51} rows={4} color={color} />
            <Section x={63} y={124} w={51} rows={5} color={color} />
            <rect x={6} y={158} width={108} height={1.2} fill={color} />
          </>
        )}
        {structure === "hero" && (
          <>
            <rect x={6} y={6} width={108} height={10} rx={1} fill={BOX} />
            <rect x={6} y={20} width={108} height={46} rx={2} fill={color} />
            <rect x={11} y={25} width={26} height={34} rx={1.5} fill="#ffffff" opacity={0.9} />
            <rect x={40} y={25} width={14} height={18} rx={1} fill="#ffffff" opacity={0.75} />
            <rect x={58} y={26} width={50} height={3} rx={1} fill="#ffffff" opacity={0.9} />
            <Lines x={58} y={33} w={50} n={5} />
            <Section x={6} y={72} w={51} rows={7} color={color} />
            <Section x={6} y={110} w={51} rows={6} color={color} />
            <Section x={63} y={72} w={51} rows={5} color={color} />
            <Section x={63} y={100} w={51} rows={4} color={color} />
            <Section x={63} y={124} w={51} rows={5} color={color} />
            <rect x={6} y={158} width={108} height={1.2} fill={color} />
          </>
        )}
        {structure === "flow" && (
          <>
            <rect x={6} y={6} width={108} height={12} rx={2} fill={color} />
            <rect x={6} y={22} width={108} height={9} rx={1.5} fill={color} opacity={0.55} />
            <rect x={8} y={23} width={6} height={7} rx={1} fill="#ffffff" />
            <rect x={6} y={35} width={28} height={36} rx={2} fill={BOX} />
            <Section x={39} y={35} w={75} rows={3} color={color} />
            <Section x={39} y={54} w={75} rows={3} color={color} />
            <Section x={6} y={77} w={51} rows={7} color={color} />
            <Section x={6} y={115} w={51} rows={6} color={color} />
            <Section x={63} y={77} w={51} rows={5} color={color} />
            <Section x={63} y={105} w={51} rows={4} color={color} />
            <Section x={63} y={129} w={51} rows={4} color={color} />
            <rect x={6} y={158} width={108} height={1.2} fill={color} />
          </>
        )}
      </g>
    </svg>
  );
}
