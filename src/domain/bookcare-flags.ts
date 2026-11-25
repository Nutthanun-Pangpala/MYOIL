/** Thai wording for the flags of a phone slip (what the office reads while checking). Unknown codes are shown as they are. */
export function flagLabel(code: string): string {
  const [name, n] = code.split(":");
  const line = n ? `บรรทัด ${n}: ` : "";
  switch (name) {
    case "late":
      return "ส่งมาหลังรอบเคลมของวันที่ในใบปิดแล้ว จึงใส่ไว้ในรอบถัดไปที่เปิดอยู่";
    case "over_balance":
      return "ยอดคงเหลือในรถติดลบเมื่อรวมใบนี้ ตรวจว่าบันทึกซื้อน้ำมันเข้าครบหรือยัง";
    case "new_machine":
      return `${line}ชื่อเครื่องจักรที่ พขร. พิมพ์เอง ยังไม่อยู่ในทะเบียน`;
    case "was_skipped":
      return "จุดนี้ในเส้นทางถูกกดข้ามไปก่อน แล้ว พขร. กลับมาเติมทีหลัง";
    case "high_liters":
      return `${line}ลิตรสูงกว่าที่เคยเติมมาก พขร. กดยืนยันแล้ว`;
    case "over_tank":
      return "ลิตรรวมมากกว่าน้ำมันในรถ พขร. กดยืนยันแล้ว";
    case "duplicate_machine":
      return `${line}เครื่องจักรซ้ำกับอีกบรรทัดในใบเดียวกัน พขร. กดยืนยันแล้ว`;
    case "price_far_from_daily":
      return "ราคาต่อลิตรต่างจากบิลซื้อก่อนหน้าเกิน 20%";
    case "over_capacity":
      return "ซื้อมากกว่าความจุถัง";
    case "small_purchase":
      return "ซื้อน้อยกว่า 100 ลิตร";
    case "dated_ahead":
      return "วันที่ในใบอยู่หลังวันที่ส่งถึง MYOIL นาฬิกามือถืออาจผิด ตรวจวันที่กับ พขร. แล้วแก้วันที่ในใบก่อนกดตรวจแล้ว";
    default:
      return code;
  }
}

/**
 * OBS-25: a slip dated after the Bangkok day it reached MYOIL can't be right (no fill happens in the future); mostly the
 * phone's clock is ahead. Not refused and not stored: added while the office checks, so they fix the date with the driver.
 */
export function withDateFlags(flags: string[], issueDate: string, receivedAt: string | null): string[] {
  if (!receivedAt) return flags;
  const arrivedOn = new Date(receivedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return issueDate > arrivedOn ? [...flags, "dated_ahead"] : flags;
}
