#!/usr/bin/env bash
# One command for everything a change needs before it is called done (owner, 26 Nov 2026: "รันเทสไม่ไหว"):
#   local database up → schema pushed → unit tests → the e2e specs of what was just changed
#   (`npm run check`), or every spec (`npm run check:all`). Nothing stops at the first red test.
# Results go to .check/ (git-ignored): summary.txt (short), unit.log, e2e.log, e2e.json — the developer reads them from there.
# LOCAL DATABASE ONLY: the e2e specs wipe all fuel data. The script refuses any DATABASE_URL that is not localhost.
set -u
cd "$(dirname "$0")/.."
mkdir -p .check
rm -f .check/summary.txt .check/unit.log .check/e2e.log .check/e2e.json .check/db.log
say() { echo "$*" | tee -a .check/summary.txt; }

url="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1)"
case "$url" in
  *localhost*|*127.0.0.1*) ;;
  *) say "หยุด: DATABASE_URL ใน .env ไม่ใช่ฐานข้อมูลในเครื่อง (localhost) สคริปต์นี้ล้างข้อมูล จึงไม่รันกับฐานอื่น"; exit 2 ;;
esac

say "เริ่ม $(date '+%d/%m/%Y %H:%M')"
say "1/4 ฐานข้อมูลในเครื่อง"
{ npm run db:up && npx drizzle-kit push --force; } > .check/db.log 2>&1
if [ $? -ne 0 ]; then say "   ไม่สำเร็จ ดู .check/db.log (เปิด Docker Desktop แล้วหรือยัง)"; exit 1; fi
say "   พร้อม"

say "2/4 unit test"
npm test > .check/unit.log 2>&1
unit=$?
say "   $(grep -E '^ +Tests ' .check/unit.log | tail -1 | sed 's/^ *//')"

# which specs: "all" = every file; file names = those; nothing = only what was just changed (scripts/check-changed.txt)
if [ "${1:-}" = "all" ]; then specs=(); what="ทุกไฟล์ (ราว 10–15 นาที)"
elif [ $# -gt 0 ]; then specs=("$@"); what="$# ไฟล์ที่ระบุ"
else specs=(); while IFS= read -r f; do specs+=("$f"); done < <(grep -vE '^[[:space:]]*(#|$)' scripts/check-changed.txt); what="เฉพาะที่เพิ่งแก้ ${#specs[@]} ไฟล์ (ราว 5 นาที)"
fi
say "3/4 e2e $what ไม่ต้องทำอะไร"
PLAYWRIGHT_JSON_OUTPUT_NAME=.check/e2e.json npx playwright test --reporter=list,json ${specs[@]+"${specs[@]}"} > .check/e2e.log 2>&1
e2e=$?
say "   $(grep -E '^ +[0-9]+ (passed|failed|flaky|skipped|did not run)' .check/e2e.log | sed 's/^ *//' | tr '\n' ' ')"

say "4/4 เสร็จ $(date '+%H:%M')"
if [ $unit -eq 0 ] && [ $e2e -eq 0 ]; then say "ผลรวม: ผ่านทั้งหมด"; else say "ผลรวม: มีข้อที่ไม่ผ่าน บอกน้องแพตว่า \"รันเสร็จแล้ว\" ได้เลย ผลอยู่ใน .check/"; fi
