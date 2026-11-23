/** browser only: downsize a picked image to ≤ 1280 px JPEG so it stays well under 1 MB */
export async function shrinkImage(file: File): Promise<{ mime: string; base64: string } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.8);
    return { mime: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
  } catch {
    return null;
  }
}
