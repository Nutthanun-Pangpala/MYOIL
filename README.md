# MYOIL

Webapp สมุดบัญชีน้ำมันของสโตร์กลาง U WORK 999 (ยาร์ดลำลูกกา) — ขั้นที่ 1: ฝั่งออฟฟิศ

## เริ่มต้น
```bash
cp .env.example .env     # แล้วแก้ SESSION_SECRET
npm install
npm run setup            # Postgres (docker :5434) + สร้างตาราง + ข้อมูลตัวอย่าง
npm run dev              # http://localhost:3000   (เช็ก DB: /api/health)
```
บัญชีตัวอย่างหลัง seed (รหัสผ่านทุกบัญชี `myoil1234`):
`store@myoil.local` · `viewer@myoil.local` · `exec@myoil.local` · `admin@myoil.local`

## โครงสร้าง
อ่านที่ `CLAUDE.md` — layer, กติกาที่ทำให้ตัวเลขเพี้ยน และคำถามที่ยังรอเจ้าของโปรเจกต์
