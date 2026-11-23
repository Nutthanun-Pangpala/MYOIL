import { createHash } from "node:crypto";
import { MAX_IMAGE_BYTES, type ApiImage } from "@/domain/bookcare-api";

export type DecodedImage = { mime: "image/jpeg"; sha256: string; takenAt: Date | null; data: Buffer };
export type ImageResult = { ok: true; image: DecodedImage } | { ok: false; status: 400 | 413; message: string };

/** size ≤ 600 KB, a real JPEG by its first bytes, and the sha256 the phone sent matches the bytes */
export function decodeImage(img: ApiImage): ImageResult {
  const data = Buffer.from(img.data, "base64");
  if (data.length > MAX_IMAGE_BYTES) return { ok: false, status: 413, message: "รูปใหญ่เกิน 600 KB" };
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) return { ok: false, status: 400, message: "ไฟล์ไม่ใช่รูป JPEG" };
  if (createHash("sha256").update(data).digest("hex") !== img.sha256) return { ok: false, status: 400, message: "sha256 ไม่ตรงกับไฟล์รูป" };
  return { ok: true, image: { mime: "image/jpeg", sha256: img.sha256, takenAt: img.takenAt ? new Date(img.takenAt) : null, data } };
}

/** same content → same hash. Image bytes are left out (their sha256 stands for them). */
export function contentHash(value: unknown): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().filter((k) => k !== "data").map((k) => [k, strip(o[k])]));
    }
    return v;
  };
  return createHash("sha256").update(JSON.stringify(strip(value))).digest("hex");
}
