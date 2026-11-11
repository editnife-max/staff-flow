// Scaled live preview of a Custom CV page, with an overflow check.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CvData } from "@/components/cv-layouts/cv-data";
import { PAGE_H, PAGE_W } from "@/components/cv-layouts/primitives";
import type { CustomCvConfig } from "./config";
import { loadCustomCvFont } from "./export";
import { CustomCv, ZONE_ATTR } from "./renderer";

export function CustomCvPreview({
  config,
  data,
  width,
  onOverflow,
}: {
  config: CustomCvConfig;
  data: CvData;
  width: number;
  /** Called with true when any content area runs past its space on the page. */
  onOverflow?: (overflowing: boolean) => void;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [fontReady, setFontReady] = useState(0);
  const scale = width / PAGE_W;

  useEffect(() => {
    let alive = true;
    void loadCustomCvFont(config).then(() => alive && setFontReady((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [config.theme.font]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure after every render: layout can change with any setting or font load.
  useLayoutEffect(() => {
    if (!onOverflow || !pageRef.current) return;
    const zones = pageRef.current.querySelectorAll<HTMLElement>(`[${ZONE_ATTR}]`);
    onOverflow(Array.from(zones).some((z) => z.scrollHeight > z.clientHeight + 2));
  });

  return (
    <div
      className="overflow-hidden bg-white shadow-md ring-1 ring-border"
      style={{ width, height: PAGE_H * scale }}
      data-font-ready={fontReady}
    >
      <div
        ref={pageRef}
        style={{
          width: PAGE_W,
          height: PAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <CustomCv d={data} config={config} />
      </div>
    </div>
  );
}
