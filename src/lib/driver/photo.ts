"use client";

import { bangkok, type Shot } from "@/domain/driver-fill";

/** photos must fit MYOIL's request size (10 lines in one request ≤ 4 MB), so each JPEG is kept under this */
export const PHOTO_BYTES = 240_000;
const LONG_EDGE = 1024;

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const toBytes = (canvas: HTMLCanvasElement, q: number) =>
  new Promise<Uint8Array>((resolve, reject) => canvas.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a))) : reject(new Error("no image"))), "image/jpeg", q));

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** JPEG of a canvas, quality lowered until it fits */
export async function encode(canvas: HTMLCanvasElement, at: Date, limit = PHOTO_BYTES): Promise<Shot> {
  let bytes = await toBytes(canvas, 0.72);
  for (const q of [0.6, 0.5, 0.4, 0.3]) {
    if (bytes.length <= limit) break;
    bytes = await toBytes(canvas, q);
  }
  return { data: base64(bytes), sha256: await sha256(bytes), takenAt: bangkok(at).stamp };
}

/**
 * The frame of the live camera as evidence: scaled to 1024 px on the long edge, with the lines of `stamp`
 * (day and time · project · driver) burnt into the bottom so the picture says what it is on its own.
 */
export async function capture(video: HTMLVideoElement, stamp: string[], at: Date): Promise<Shot> {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const k = Math.min(1, LONG_EDGE / Math.max(vw, vh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vw * k);
  canvas.height = Math.round(vh * k);
  const g = canvas.getContext("2d")!;
  g.drawImage(video, 0, 0, canvas.width, canvas.height);
  const size = Math.max(14, Math.round(canvas.width / 34));
  const band = size * 1.5 * stamp.length + size * 0.6;
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(0, canvas.height - band, canvas.width, band);
  g.fillStyle = "#ffffff";
  g.font = `600 ${size}px "IBM Plex Sans Thai", Tahoma, sans-serif`;
  g.textBaseline = "top";
  stamp.forEach((line, i) => g.fillText(line, size * 0.6, canvas.height - band + size * 0.4 + i * size * 1.5));
  return encode(canvas, at);
}

export const shotUrl = (s: Shot) => `data:image/jpeg;base64,${s.data}`;
