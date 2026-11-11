import type { CustomCvConfig } from "../config";

/** Applies a change to the template being edited. */
export type Update = (fn: (c: CustomCvConfig) => CustomCvConfig) => void;

export interface PanelProps {
  config: CustomCvConfig;
  update: Update;
}

type ObjectKeys = {
  [K in keyof CustomCvConfig]: CustomCvConfig[K] extends object
    ? CustomCvConfig[K] extends unknown[]
      ? never
      : K
    : never;
}[keyof CustomCvConfig];

export const ALIGN_OPTIONS = [
  { value: "left" as const, label: "Left" },
  { value: "center" as const, label: "Centre" },
  { value: "right" as const, label: "Right" },
];
export const SLOT_OPTIONS = [...ALIGN_OPTIONS, { value: "hidden" as const, label: "Hide" }];

/** Merges `p` into one settings group, e.g. patch("header", { style: "band" }). */
export function patch<K extends ObjectKeys>(key: K, p: Partial<CustomCvConfig[K]>) {
  return (c: CustomCvConfig): CustomCvConfig => ({ ...c, [key]: { ...c[key], ...p } });
}
