import { hasAtMostTwoDecimals } from "./money";
import { ODD_MIN_LITERS, ODD_PRICE_SHARE } from "./purchase-calc";

/**
 * Request checks for the BookCare ↔ MYOIL API (contract v1). Pure: no database, no crypto.
 * Numbers arrive as text ("120.5"); more than 2 decimals is refused, never rounded.
 */

export type ApiImage = { mime: string; sha256: string; takenAt: string | null; data: string };
export type ApiFail = { ok: false; field: string; message: string };
type Ok<T> = { ok: true; value: T };
export type Checked<T> = Ok<T> | ApiFail;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const MAX_LINES = 10;
export const MAX_IMAGE_BYTES = 600_000;

const fail = (field: string, message: string): ApiFail => ({ ok: false, field, message });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** "120.5" → 120.5 ; null when it is not a plain non-negative number with ≤ 2 decimals */
export function parseDecimal(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{1,10}(\.\d+)?$/.test(v.trim())) return null;
  const n = Number(v);
  return Number.isFinite(n) && hasAtMostTwoDecimals(n) ? n : null;
}

export function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isStamp = (s: string) => STAMP.test(s) && !Number.isNaN(Date.parse(s));

/** "10:05" → "10:05" · empty/missing → null · anything else → undefined (refuse) */
function clock(v: unknown): string | null | undefined {
  if (v == null || v === "") return null;
  return typeof v === "string" && CLOCK.test(v.trim()) ? v.trim() : undefined;
}

export function checkImage(v: unknown, field: string, needTakenAt = false): Checked<ApiImage> {
  if (!isObj(v)) return fail(field, "ต้องมีรูป");
  if (v.mime !== "image/jpeg") return fail(`${field}.mime`, "รูปต้องเป็นไฟล์ JPEG");
  if (!/^[0-9a-f]{64}$/i.test(str(v.sha256))) return fail(`${field}.sha256`, "sha256 ของรูปไม่ถูกต้อง");
  const data = str(v.data);
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return fail(`${field}.data`, "ข้อมูลรูป (base64) ไม่ถูกต้อง");
  const takenAt = v.takenAt == null ? null : str(v.takenAt);
  if (takenAt !== null && !isStamp(takenAt)) return fail(`${field}.takenAt`, "เวลาถ่ายรูปไม่ถูกต้อง");
  if (needTakenAt && takenAt === null) return fail(`${field}.takenAt`, "ต้องมีเวลาถ่ายรูป");
  return { ok: true, value: { mime: "image/jpeg", sha256: str(v.sha256).toLowerCase(), takenAt, data } };
}

// ───────────── API 1: issue ─────────────

export type IssueRequest = {
  ref: string;
  /** the route stop this slip fills (contract §9.1); null when missing → the service answers 400 no_route_stop */
  routeStopId: string | null;
  projectRefCode: string;
  issueDate: string;
  /** "HH:MM" at the site, both optional (the paper slip's เวลาเข้า / เวลาออก) */
  timeIn: string | null;
  timeOut: string | null;
  recordedAt: string | null;
  driver: { bookcareUserId: string; name: string };
  vehicleCode: string | null;
  lines: { position: number; machineId: string | null; machineCode: string; liters: number; hourMeter: number | null; photo: ApiImage }[];
  signature: { receiverName: string; signedAt: string; image: ApiImage } | null;
  unsignedReason: string | null;
  confirmedWarnings: string[];
};

export function checkIssueRequest(body: unknown): Checked<IssueRequest> {
  if (!isObj(body)) return fail("body", "คำขอต้องเป็น JSON object");
  const ref = str(body.ref);
  if (!UUID.test(ref)) return fail("ref", "ref ต้องเป็น UUID");
  const routeStopId = body.routeStopId == null || str(body.routeStopId) === "" ? null : str(body.routeStopId);
  if (routeStopId !== null && !UUID.test(routeStopId)) return fail("routeStopId", "routeStopId ต้องเป็น UUID");
  const projectRefCode = str(body.projectRefCode);
  if (!projectRefCode) return fail("projectRefCode", "ต้องมีรหัสโครงการ");
  const issueDate = str(body.issueDate);
  if (!isRealDate(issueDate)) return fail("issueDate", "วันที่ต้องเป็นรูปแบบ YYYY-MM-DD");
  const timeIn = clock(body.timeIn);
  if (timeIn === undefined) return fail("timeIn", "เวลาเข้าต้องเป็นรูปแบบ HH:MM");
  const timeOut = clock(body.timeOut);
  if (timeOut === undefined) return fail("timeOut", "เวลาออกต้องเป็นรูปแบบ HH:MM");
  const recordedAt = body.recordedAt == null ? null : str(body.recordedAt);
  if (recordedAt !== null && !isStamp(recordedAt)) return fail("recordedAt", "เวลาบันทึกไม่ถูกต้อง");
  if (!isObj(body.driver) || !str(body.driver.bookcareUserId) || !str(body.driver.name)) return fail("driver", "ต้องมีรหัสและชื่อ พขร.");
  const driver = { bookcareUserId: str(body.driver.bookcareUserId), name: str(body.driver.name) };

  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > MAX_LINES) return fail("lines", `ต้องมี 1–${MAX_LINES} บรรทัด`);
  const lines: IssueRequest["lines"] = [];
  const seen = new Set<number>();
  for (let i = 0; i < body.lines.length; i++) {
    const l = body.lines[i];
    const at = `lines[${i}]`;
    if (!isObj(l)) return fail(at, "บรรทัดไม่ถูกต้อง");
    const position = typeof l.position === "number" && Number.isInteger(l.position) && l.position >= 1 ? l.position : null;
    if (position === null || seen.has(position)) return fail(`${at}.position`, "ลำดับบรรทัดต้องเป็นเลขจำนวนเต็ม ไม่ซ้ำกัน");
    seen.add(position);
    const machineId = l.machineId == null ? null : str(l.machineId);
    if (machineId !== null && !UUID.test(machineId)) return fail(`${at}.machineId`, "machineId ต้องเป็น UUID");
    const machineCode = str(l.machineCode);
    if (!machineCode) return fail(`${at}.machineCode`, "ต้องมีชื่อ/รหัสเครื่องจักร");
    const liters = parseDecimal(l.liters);
    if (liters === null || liters <= 0) return fail(`${at}.liters`, "ลิตรต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง");
    let hourMeter: number | null = null;
    if (l.hourMeter != null && str(l.hourMeter) !== "") {
      hourMeter = parseDecimal(l.hourMeter);
      if (hourMeter === null) return fail(`${at}.hourMeter`, "ชั่วโมงเครื่องต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง");
    }
    const photo = checkImage(l.photo, `${at}.photo`);
    if (!photo.ok) return photo;
    lines.push({ position, machineId, machineCode, liters, hourMeter, photo: photo.value });
  }
  lines.sort((a, b) => a.position - b.position);

  const hasSig = body.signature != null;
  const reason = body.unsignedReason == null ? null : str(body.unsignedReason);
  if (hasSig === (reason !== null && reason !== "")) return fail("signature", "ต้องมีลายเซ็นหรือเหตุผลที่ไม่มีผู้เซ็นรับ อย่างใดอย่างหนึ่งเท่านั้น");
  let signature: IssueRequest["signature"] = null;
  if (hasSig) {
    const s = body.signature;
    if (!isObj(s)) return fail("signature", "ลายเซ็นไม่ถูกต้อง");
    const receiverName = str(s.receiverName);
    if (!receiverName) return fail("signature.receiverName", "ลายเซ็นต้องมีชื่อผู้รับคู่เสมอ");
    const signedAt = str(s.signedAt);
    if (!isStamp(signedAt)) return fail("signature.signedAt", "เวลาเซ็นไม่ถูกต้อง");
    const image = checkImage(s.image, "signature.image");
    if (!image.ok) return image;
    signature = { receiverName, signedAt, image: image.value };
  }

  const warns = body.confirmedWarnings == null ? [] : body.confirmedWarnings;
  if (!Array.isArray(warns) || warns.some((w) => typeof w !== "string" || !/^(high_liters:\d+|over_tank|duplicate_machine:\d+)$/.test(w))) {
    return fail("confirmedWarnings", "คำเตือนที่ยืนยันไม่ถูกต้อง");
  }
  const vehicleCode = body.vehicleCode == null ? null : str(body.vehicleCode) || null;
  return {
    ok: true,
    value: { ref, routeStopId, projectRefCode, issueDate, timeIn, timeOut, recordedAt, driver, vehicleCode, lines, signature, unsignedReason: signature ? null : reason, confirmedWarnings: warns as string[] },
  };
}

// ───────────── API 2: purchase ─────────────

export type PurchaseRequest = {
  ref: string;
  purchaseDate: string;
  recordedAt: string | null;
  driver: { bookcareUserId: string; name: string };
  liters: number;
  amount: number;
  billNo: string | null;
  billPhoto: ApiImage;
};

export function checkPurchaseRequest(body: unknown): Checked<PurchaseRequest> {
  if (!isObj(body)) return fail("body", "คำขอต้องเป็น JSON object");
  const ref = str(body.ref);
  if (!UUID.test(ref)) return fail("ref", "ref ต้องเป็น UUID");
  const purchaseDate = str(body.purchaseDate);
  if (!isRealDate(purchaseDate)) return fail("purchaseDate", "วันที่ต้องเป็นรูปแบบ YYYY-MM-DD");
  const recordedAt = body.recordedAt == null ? null : str(body.recordedAt);
  if (recordedAt !== null && !isStamp(recordedAt)) return fail("recordedAt", "เวลาบันทึกไม่ถูกต้อง");
  if (!isObj(body.driver) || !str(body.driver.bookcareUserId) || !str(body.driver.name)) return fail("driver", "ต้องมีรหัสและชื่อ พขร.");
  const liters = parseDecimal(body.liters);
  if (liters === null || liters <= 0) return fail("liters", "ลิตรต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง");
  const amount = parseDecimal(body.amount);
  if (amount === null || amount <= 0) return fail("amount", "ยอดเงินต้องเป็นตัวเลขมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง");
  const billPhoto = checkImage(body.billPhoto, "billPhoto");
  if (!billPhoto.ok) return billPhoto;
  return {
    ok: true,
    value: {
      ref,
      purchaseDate,
      recordedAt,
      driver: { bookcareUserId: str(body.driver.bookcareUserId), name: str(body.driver.name) },
      liters,
      amount,
      billNo: str(body.billNo) || null,
      billPhoto: billPhoto.value,
    },
  };
}

// ───────────── API 3: late signature ─────────────

export type SignatureRequest = { signatureRef: string; receiverName: string; signedAt: string; image: ApiImage };

export function checkSignatureRequest(body: unknown): Checked<SignatureRequest> {
  if (!isObj(body)) return fail("body", "คำขอต้องเป็น JSON object");
  const signatureRef = str(body.signatureRef);
  if (!UUID.test(signatureRef)) return fail("signatureRef", "signatureRef ต้องเป็น UUID");
  const receiverName = str(body.receiverName);
  if (!receiverName) return fail("receiverName", "ลายเซ็นต้องมีชื่อผู้รับคู่เสมอ");
  const signedAt = str(body.signedAt);
  if (!isStamp(signedAt)) return fail("signedAt", "เวลาเซ็นไม่ถูกต้อง");
  const image = checkImage(body.image, "image");
  if (!image.ok) return image;
  return { ok: true, value: { signatureRef, receiverName, signedAt, image: image.value } };
}

// ───────────── API 9: skip a stop of the route ─────────────

export type SkipRequest = { skipRef: string; reason: string; skippedAt: string; driver: { bookcareUserId: string; name: string } };

export function checkSkipRequest(body: unknown): Checked<SkipRequest> {
  if (!isObj(body)) return fail("body", "คำขอต้องเป็น JSON object");
  const skipRef = str(body.skipRef);
  if (!UUID.test(skipRef)) return fail("skipRef", "skipRef ต้องเป็น UUID");
  const reason = str(body.reason);
  if (!reason) return fail("reason", "ข้ามจุดต้องมีเหตุผล");
  const skippedAt = str(body.skippedAt);
  if (!isStamp(skippedAt)) return fail("skippedAt", "เวลาข้ามจุดไม่ถูกต้อง");
  const driver = isObj(body.driver) ? { bookcareUserId: str(body.driver.bookcareUserId), name: str(body.driver.name) } : { bookcareUserId: "", name: "" };
  return { ok: true, value: { skipRef, reason: reason.slice(0, 300), skippedAt, driver } };
}

// ───────────── numbers of the slip ─────────────

/** Book of a slip made on the phone: "M" + Buddhist year (2 digits) + month of the slip's date, e.g. 2026-11-23 → "M6911". A new book every month, so it never clashes with paper books (digits only). */
export const appBookNo = (issueDate: string) => `M${String(Number(issueDate.slice(0, 4)) + 543).slice(-2)}${issueDate.slice(5, 7)}`;
/** Running number inside the book, 4 digits: 1 → "0001" (the 10,000th is "10000": it never wraps) */
export const appDocNo = (n: number) => String(n).padStart(4, "0");

export type IssueFlag = "late" | "over_balance" | "was_skipped" | `new_machine:${number}`;
export type PurchaseFlag = "price_far_from_daily" | "over_capacity" | "small_purchase";

/** the same three oddities purchaseOddities() words for the office, as codes for the API (OBS-17) */
export function purchaseFlags(p: { liters: number; price: number; dailyPrice: number | null; capacity: number | null }): PurchaseFlag[] {
  const out: PurchaseFlag[] = [];
  if (p.dailyPrice !== null && p.dailyPrice > 0 && Math.abs(p.price - p.dailyPrice) / p.dailyPrice > ODD_PRICE_SHARE) out.push("price_far_from_daily");
  if (p.capacity !== null && p.liters > p.capacity) out.push("over_capacity");
  if (p.liters < ODD_MIN_LITERS) out.push("small_purchase");
  return out;
}
