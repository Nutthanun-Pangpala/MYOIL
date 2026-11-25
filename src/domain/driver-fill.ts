/**
 * The driver's slip while it is still on the phone (design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)").
 * Pure: the keypad, the "is this a lot?" question and the body sent to /api/driver/issues.
 */

/** a photo taken with the in-app camera: JPEG as base64, its sha256, when it was taken (ISO with offset) */
export type Shot = { data: string; sha256: string; takenAt: string };

export type DraftLine = {
  id: string;
  machineId: string | null;
  machineCode: string;
  /** as typed on the keypad: "85", "120.5" */
  liters: string;
  hourMeter: string;
  photo: Shot;
  /** the driver answered "ถูกต้อง" to the high-liters question */
  confirmedHigh: boolean;
};

export type Draft = {
  stopId: string;
  /** made once on the phone: sending the same slip twice makes one slip */
  ref: string;
  projectRefCode: string;
  /** the route's day, YYYY-MM-DD */
  date: string;
  startedAt: string;
  lines: DraftLine[];
};

export const MAX_DRAFT_LINES = 10;
export const SKIP_REASONS = ["ไม่มีเครื่องจักรต้องเติม", "หน้างานปิด หรือเข้าไม่ได้", "น้ำมันในรถไม่พอ"] as const;
export const UNSIGNED_REASONS = ["ไม่มีสโตร์หรือโฟร์แมนอยู่ที่หน้างาน", "ผู้รับไม่สะดวกเซ็นตอนนี้"] as const;

/** one key of the liters keypad: a digit, "." or "back". At most 5 digits before the point and 2 after. */
export function typeLiters(text: string, key: string): string {
  if (key === "back") return text.slice(0, -1);
  if (key === ".") return text.includes(".") ? text : (text || "0") + ".";
  if (!/^\d$/.test(key)) return text;
  const [whole, frac] = text.split(".");
  if (frac !== undefined) return frac.length < 2 ? text + key : text;
  if (whole === "0") return key;
  return whole.length < 5 ? text + key : text;
}

/** "85" → 85 · "" / "0" / "12." with nothing useful → null */
export function litersValue(text: string): number | null {
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(text)) return null;
  const n = Number(text);
  return n > 0 ? n : null;
}

/** how the request writes a number: no trailing point */
export const litersText = (text: string) => String(Number(text));

export const HIGH_FACTOR = 1.5;
/** more than 1.5× the biggest fill this machine had (unknown machine or too little history → never asks) */
export function isHighLiters(liters: number, usualMax: number | null): boolean {
  return usualMax !== null && usualMax > 0 && liters > usualMax * HIGH_FACTOR;
}

export const totalLiters = (lines: { liters: string }[]) => Math.round(lines.reduce((a, l) => a + Number(l.liters || 0), 0) * 100) / 100;

const pad = (n: number) => String(n).padStart(2, "0");
/** Bangkok wall clock of an instant: { date: "2026-11-25", time: "10:05", stamp: "2026-11-25T10:05:09+07:00" } */
export function bangkok(d: Date) {
  const t = new Date(d.getTime() + 7 * 3_600_000);
  const date = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  const time = `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  return { date, time, stamp: `${date}T${time}:${pad(t.getUTCSeconds())}+07:00` };
}

export type Signing = { receiverName: string; image: Shot } | { unsignedReason: string };

/** the JSON of POST /api/driver/issues (the server adds who the driver is) */
export function issueBody(draft: Draft, signing: Signing, now: Date) {
  const at = bangkok(now);
  const seen = new Set<string>();
  const warnings: string[] = [];
  const lines = draft.lines.map((l, i) => {
    const position = i + 1;
    const key = l.machineId ?? l.machineCode.trim().toLowerCase();
    if (seen.has(key)) warnings.push(`duplicate_machine:${position}`);
    seen.add(key);
    if (l.confirmedHigh) warnings.push(`high_liters:${position}`);
    return {
      position,
      machineId: l.machineId,
      machineCode: l.machineCode.trim(),
      liters: litersText(l.liters),
      hourMeter: l.hourMeter.trim() === "" ? null : litersText(l.hourMeter),
      photo: { mime: "image/jpeg", sha256: l.photo.sha256, takenAt: l.photo.takenAt, data: l.photo.data },
    };
  });
  return {
    ref: draft.ref,
    routeStopId: draft.stopId,
    projectRefCode: draft.projectRefCode,
    issueDate: draft.date,
    timeIn: bangkok(new Date(draft.startedAt)).time,
    timeOut: at.time,
    recordedAt: at.stamp,
    vehicleCode: null,
    lines,
    signature: "image" in signing ? { receiverName: signing.receiverName.trim(), signedAt: at.stamp, image: { mime: "image/jpeg", sha256: signing.image.sha256, takenAt: signing.image.takenAt, data: signing.image.data } } : null,
    unsignedReason: "image" in signing ? null : signing.unsignedReason.trim(),
    confirmedWarnings: warnings,
  };
}

/** which little picture stands for a machine in the driver's lists (redesign of 25 Nov 2026) */
export type MachineArtKind = "excavator" | "forklift" | "truck";

/** from the admin's type when it says so, else from the code: FL… = forklift, a plate or "รถ…" = truck, the rest = excavator */
export function machineArt(code: string, type?: string | null): MachineArtKind {
  const c = code.trim().toLowerCase();
  if (/^fl|โฟล์ค|forklift/.test(c)) return "forklift";
  if (type === "รถขุด" || /^pc\s?\d|รถขุด|แบคโฮ|แม็คโคร/.test(c)) return "excavator";
  if (type === "รถ" || /รถ|ล้อ|กระบะ|\d{2}-\d{4}/.test(c)) return "truck";
  return "excavator";
}
