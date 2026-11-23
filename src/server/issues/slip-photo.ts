export type SlipPhotoInput = { mime: string; base64: string };

const MAX_BASE64 = 1_400_000; // ≈ 1 MB of image
export const MAX_BYTES = 1_050_000;

/** server actions get whatever a browser sends: keep only a well-formed {mime, base64} or null */
export function parseSlipPhoto(v: unknown): SlipPhotoInput | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const mime = typeof o.mime === "string" ? o.mime : "";
  const base64 = typeof o.base64 === "string" ? o.base64 : "";
  if (!["image/jpeg", "image/png"].includes(mime) || !base64 || base64.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) return null;
  return { mime, base64 };
}

export const PHOTO_ERROR = "รูปใบเซ็นต้องเป็นไฟล์ JPG หรือ PNG ขนาดไม่เกิน 1 MB";

/** the bytes must really be the image type claimed (never trust the browser's label) */
export function checkSlipPhoto(p: SlipPhotoInput | null): { ok: true; mime: string; data: Buffer } | { ok: false; error: string } {
  if (!p) return { ok: false, error: PHOTO_ERROR };
  const data = Buffer.from(p.base64, "base64");
  const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isPng = data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (data.length > MAX_BYTES || !((p.mime === "image/jpeg" && isJpeg) || (p.mime === "image/png" && isPng))) return { ok: false, error: PHOTO_ERROR };
  return { ok: true, mime: p.mime, data };
}
