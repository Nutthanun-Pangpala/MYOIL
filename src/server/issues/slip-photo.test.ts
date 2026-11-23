import { describe, expect, it } from "vitest";
import { checkSlipPhoto, parseSlipPhoto } from "./slip-photo";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString("base64");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).toString("base64");

describe("parseSlipPhoto", () => {
  it("keeps a well-formed jpeg/png and drops everything else", () => {
    expect(parseSlipPhoto({ mime: "image/jpeg", base64: JPEG })).toEqual({ mime: "image/jpeg", base64: JPEG });
    expect(parseSlipPhoto({ mime: "image/gif", base64: JPEG })).toBeNull();
    expect(parseSlipPhoto({ mime: "image/png", base64: "not base64!" })).toBeNull();
    expect(parseSlipPhoto("x")).toBeNull();
    expect(parseSlipPhoto(null)).toBeNull();
  });
});

describe("checkSlipPhoto", () => {
  it("accepts bytes that match the claimed type", () => {
    expect(checkSlipPhoto({ mime: "image/jpeg", base64: JPEG }).ok).toBe(true);
    expect(checkSlipPhoto({ mime: "image/png", base64: PNG }).ok).toBe(true);
  });
  it("refuses a label that does not match the bytes", () => {
    expect(checkSlipPhoto({ mime: "image/png", base64: JPEG }).ok).toBe(false);
    expect(checkSlipPhoto({ mime: "image/jpeg", base64: Buffer.from("<script>").toString("base64") }).ok).toBe(false);
  });
  it("refuses no photo and a photo over 1 MB", () => {
    expect(checkSlipPhoto(null).ok).toBe(false);
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1_060_000)]).toString("base64");
    expect(checkSlipPhoto({ mime: "image/jpeg", base64: big }).ok).toBe(false);
  });
});
