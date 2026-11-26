"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "@/components/driver/camera";
import { Choices, Notice, Screen, Sheet, Thumb, btnLine, btnRed, btnYellow, linkBtn } from "@/components/driver/flow";
import { MachineArt } from "@/components/driver/machine-art";
import { SignaturePad, type SignatureHandle } from "@/components/driver/signature-pad";
import { TruckArt } from "@/components/driver/truck-art";
import { MAX_DRAFT_LINES, SKIP_REASONS, UNSIGNED_REASONS, bangkok, isHighLiters, issueBody, litersValue, machineArt, totalLiters, typeLiters, type Draft, type DraftLine, type MachineArtKind, type Shot, type Signing, siteName } from "@/domain/driver-fill";
import { thaiLong } from "@/domain/thai-date";
import { post, sendOrKeep } from "@/lib/driver/outbox";
import { shotUrl } from "@/lib/driver/photo";
import { dropDraft, getDraft, saveDraft } from "@/lib/driver/store";

export type FlowMachine = { art: MachineArtKind; id: string; code: string; name: string | null; isRented: boolean; here: boolean; maxLiters: number | null };
type StopInfo = { id: string; position: number; code: string; name: string; /** where the site is (address / landmark) */ detail: string | null; note: string | null; skipped: boolean; skipReason: string | null };
type Dot = "here" | "pending" | "filled" | "skipped";
type Step = "plan" | "fill" | "machines" | "camera" | "review" | "liters" | "sign";
/** the machine being added (or the line being corrected) */
type Current = { editId: string | null; machineId: string | null; machineCode: string; usualMax: number | null; photo: Shot | null; liters: string; hourMeter: string };

const OTHER = "เหตุผลอื่น พิมพ์เอง";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const clock = (iso: string) => bangkok(new Date(iso)).time;
const uuid = () => crypto.randomUUID();

/**
 * Design "MYOIL — หน้าจอฝั่ง พขร. (ขั้นที่ 2)": Stop → Fill → (Machines → Camera → Review → Liters)… → Sign.
 * One page, so the steps keep working with no signal; the slip is saved on the phone after every change.
 */
export function StopFlow({ stop, dots, date, driverName, machines }: { stop: StopInfo; dots: Dot[]; date: string; driverName: string; machines: FlowMachine[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("plan");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState<Current | null>(null);
  const [big, setBig] = useState<DraftLine | null>(null);

  useEffect(() => {
    getDraft(stop.id)
      .then((d) => {
        if (d) {
          setDraft(d);
          setStep("fill");
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [stop.id]);

  const artOf = useCallback((l: { machineId: string | null; machineCode: string }) => machines.find((m) => m.id === l.machineId)?.art ?? machineArt(l.machineCode), [machines]);
  const keep = useCallback((d: Draft) => {
    setDraft(d);
    void saveDraft(d);
  }, []);

  const start = () => {
    keep(draft ?? { stopId: stop.id, ref: uuid(), projectRefCode: stop.code, date, startedAt: new Date().toISOString(), lines: [] });
    setStep("fill");
  };
  const sub = `จุดที่ ${stop.position} จาก ${dots.length}${draft ? ` เริ่ม ${clock(draft.startedAt)}` : ""}`;
  const stamp = useCallback(() => {
    const now = bangkok(new Date());
    return [`${thaiLong(now.date)} ${now.time}  ${stop.code}`, [cur?.machineCode, driverName].filter(Boolean).join("  ")];
  }, [cur?.machineCode, driverName, stop.code]);

  if (step === "plan" || !draft) return <Plan stop={stop} dots={dots} ready={ready} onStart={start} onSkipped={() => (router.push("/driver"), router.refresh())} />;

  const saveLine = (confirmedHigh: boolean) => {
    if (!cur?.photo) return;
    const line: DraftLine = { id: cur.editId ?? uuid(), machineId: cur.machineId, machineCode: cur.machineCode, liters: cur.liters, hourMeter: cur.hourMeter, photo: cur.photo, confirmedHigh };
    keep({ ...draft, lines: cur.editId ? draft.lines.map((l) => (l.id === cur.editId ? line : l)) : [...draft.lines, line] });
    setCur(null);
    setStep("fill");
  };

  if (step === "machines")
    return (
      <Machines
        code={stop.code}
        machines={machines}
        used={draft.lines}
        onBack={() => setStep("fill")}
        onPick={(m) => {
          setCur({ editId: null, machineId: m.id, machineCode: m.code, usualMax: m.maxLiters, photo: null, liters: "", hourMeter: "" });
          setStep("camera");
        }}
      />
    );

  if (cur && step === "camera")
    return (
      <Screen title="ถ่ายรูปมิเตอร์" sub={`ขั้น 2 จาก 3 ${cur.machineCode}`} step={2} dark onBack={() => setStep(cur.editId ? "liters" : "machines")}>
        <Camera
          hint="ให้ตัวเลขลิตรบนมิเตอร์อยู่ในกรอบ ถ่ายหลังเติมเครื่องนี้เสร็จ"
          stamp={stamp}
          onShot={(photo) => {
            setCur({ ...cur, photo });
            setStep("review");
          }}
        />
      </Screen>
    );

  if (cur?.photo && step === "review")
    return (
      <Screen
        title="ดูรูปที่ถ่าย"
        sub={`ขั้น 2 จาก 3 ${cur.machineCode}`}
        step={2}
        onBack={() => setStep("camera")}
        dock={
          <>
            <button type="button" className={btnLine} onClick={() => setStep("camera")}>
              ถ่ายใหม่
            </button>
            <button type="button" className={btnYellow} onClick={() => setStep("liters")}>
              ใช้รูปนี้
            </button>
          </>
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shotUrl(cur.photo)} alt={`รูปมิเตอร์ของ ${cur.machineCode}`} className="w-full rounded-[20px] bg-tank object-contain" data-testid="shot-review" />
        <p className="font-display text-[22px] font-semibold leading-[1.3]">อ่านตัวเลขลิตรในรูปออกไหม</p>
        <p className="text-[15px] text-muted">แอดมินจะใช้รูปนี้เทียบกับลิตรที่พิมพ์ วันเวลา โครงการ และชื่อ พขร. ถูกฝังในรูปแล้ว</p>
      </Screen>
    );

  if (cur?.photo && step === "liters")
    return (
      <Liters
        cur={cur}
        code={stop.code}
        onChange={setCur}
        onBack={() => (cur.editId ? (setCur(null), setStep("fill")) : setStep("review"))}
        onRetake={() => setStep("camera")}
        onSave={saveLine}
        onDelete={
          cur.editId
            ? () => {
                keep({ ...draft, lines: draft.lines.filter((l) => l.id !== cur.editId) });
                setCur(null);
                setStep("fill");
              }
            : undefined
        }
      />
    );

  if (step === "sign" && draft.lines.length > 0)
    return (
      <Sign
        draft={draft}
        stop={stop}
        artOf={artOf}
        onBack={() => setStep("fill")}
        onDone={async (signing) => {
          const r = await sendOrKeep({ ref: draft.ref, kind: "issue", url: "/api/driver/issues", body: issueBody(draft, signing, new Date()), label: stop.code, liters: totalLiters(draft.lines), stopId: stop.id });
          await dropDraft(stop.id);
          const id = r.ok ? (r.body as { issueId?: string } | null)?.issueId : undefined;
          router.push(id ? `/driver/slip/${id}` : "/driver");
          router.refresh();
        }}
      />
    );

  // ── P4 เติมเครื่องจักร ──
  const total = totalLiters(draft.lines);
  return (
    <Screen
      title={`เติมที่ ${stop.code}`}
      sub={sub}
      backHref="/driver"
      dock={
        <button type="button" className={btnYellow} disabled={draft.lines.length === 0} onClick={() => setStep("sign")}>
          เติมครบแล้ว ไปเซ็นรับ
        </button>
      }
    >
      <section className="flex items-baseline justify-between gap-[12px] rounded-[20px] bg-tank px-[18px] py-[14px] text-white" aria-label="ยอดของใบนี้">
        <span className="text-page">เติมแล้ว {draft.lines.length} เครื่อง</span>
        <span className="font-display text-[40px] font-semibold leading-[1.1] text-safety" data-testid="fill-total">
          {fmt(total)}
          <span className="text-[18px] font-normal text-page"> ลิตร</span>
        </span>
      </section>
      <ul className="flex flex-col gap-[8px]" aria-label="เครื่องที่เติมแล้ว">
        {draft.lines.map((l) => (
          <li key={l.id} className="flex min-h-[84px] items-center gap-[12px] rounded-[16px] border border-line bg-card py-[8px] pl-[10px] pr-[8px] shadow-[0_2px_0_var(--color-line)]">
            <MachineArt kind={artOf(l)} name={l.machineCode} w={72} h={64} />
            <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
              <span className="truncate font-display text-[18px] font-medium leading-[1.25]">{l.machineCode}</span>
              <span className="flex items-center gap-[8px]">
                <Thumb src={shotUrl(l.photo)} alt={`รูปมิเตอร์ของ ${l.machineCode}`} onOpen={() => setBig(l)} size={36} />
                <span className="text-[14px] text-muted">{clock(l.photo.takenAt)}</span>
              </span>
            </div>
            <span className="whitespace-nowrap font-display text-[22px] font-semibold">
              {fmt(Number(l.liters))} <span className="text-[15px] font-normal">ลิตร</span>
            </span>
            <button
              type="button"
              aria-label={`แก้ ${l.machineCode}`}
              className={`${linkBtn} min-w-[56px]`}
              onClick={() => {
                setCur({ editId: l.id, machineId: l.machineId, machineCode: l.machineCode, usualMax: machines.find((m) => m.id === l.machineId)?.maxLiters ?? null, photo: l.photo, liters: l.liters, hourMeter: l.hourMeter });
                setStep("liters");
              }}
            >
              แก้
            </button>
          </li>
        ))}
      </ul>
      {draft.lines.length < MAX_DRAFT_LINES ? (
        <button type="button" className={btnLine} onClick={() => setStep("machines")}>
          <Plus />
          เพิ่มเครื่องจักร
        </button>
      ) : (
        <Notice tone="warn">ใบหนึ่งใส่ได้ {MAX_DRAFT_LINES} เครื่อง ถ้ามีมากกว่านี้ให้เซ็นรับใบนี้ก่อน แล้วแจ้งแอดมินเพิ่มจุด</Notice>
      )}
      <p className="text-[14px] text-muted">แก้หรือลบได้จนกว่าจะเซ็นรับ ออกจากหน้านี้ได้ ใบไม่หาย</p>
      <Discard
        onYes={async () => {
          await dropDraft(stop.id);
          router.push("/driver");
        }}
      />
      <Sheet open={!!big} title={big ? `${big.machineCode} ${fmt(Number(big.liters))} ลิตร` : ""} onClose={() => setBig(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {big && <img src={shotUrl(big.photo)} alt={`รูปมิเตอร์ของ ${big.machineCode}`} className="w-full rounded-[14px]" />}
        <button type="button" className={btnLine} onClick={() => setBig(null)}>
          ปิด
        </button>
      </Sheet>
    </Screen>
  );
}

const Plus = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

function Discard({ onYes }: { onYes: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="mt-auto min-h-[56px] self-start text-repair underline" onClick={() => setOpen(true)}>
        ทิ้งใบนี้ทั้งใบ
      </button>
      <Sheet open={open} title="ทิ้งใบนี้ทั้งใบใช่ไหม" onClose={() => setOpen(false)}>
        <p>เครื่องที่ใส่ไว้และรูปมิเตอร์ของใบนี้จะถูกลบออกจากเครื่อง เอากลับมาไม่ได้</p>
        <button type="button" className={btnRed} onClick={onYes}>
          ทิ้งใบนี้
        </button>
        <button type="button" className={btnLine} onClick={() => setOpen(false)}>
          ไม่ทิ้ง กลับไปเติมต่อ
        </button>
      </Sheet>
    </>
  );
}

// ── P3 จุดเติมตามแผน + ข้ามจุด ──
function Plan({ stop, dots, ready, onStart, onSkipped }: { stop: StopInfo; dots: Dot[]; ready: boolean; onStart: () => void; onSkipped: () => void }) {
  const [ask, setAsk] = useState(false);
  const [why, setWhy] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = why === OTHER ? other.trim() : why;

  const skip = async () => {
    setBusy(true);
    setError(null);
    const r = await post(`/api/driver/stops/${stop.id}/skip`, { skipRef: uuid(), reason, skippedAt: bangkok(new Date()).stamp });
    setBusy(false);
    if (r.ok) onSkipped();
    else setError(r.offline ? "ไม่มีสัญญาณ ยังข้ามจุดไม่ได้ ย้ายไปจุดที่มีสัญญาณแล้วกดอีกครั้ง" : r.message);
  };

  return (
    <Screen
      title="จุดเติมตามแผน"
      backHref="/driver"
      dock={
        <>
          {!stop.skipped && (
            <button type="button" className={btnLine} onClick={() => setAsk(true)}>
              ข้ามจุดนี้
            </button>
          )}
          <button type="button" className={btnYellow} disabled={!ready} onClick={onStart}>
            เริ่มเติมที่จุดนี้
          </button>
        </>
      }
    >
      <section className="flex flex-1 flex-col gap-[6px] overflow-hidden rounded-[24px] bg-tank px-[20px] pt-[20px] text-white">
        <div className="flex items-center justify-between gap-[12px]">
          <span className="text-page">
            จุดที่ {stop.position} จาก {dots.length} ของวันนี้
          </span>
          <span role="img" aria-label={`จุดที่ ${stop.position} จาก ${dots.length}`} className="flex flex-wrap items-center justify-end gap-[5px]">
            {dots.map((d, i) => (
              <span key={i} className={`h-[12px] rounded-[6px] ${d === "here" ? "w-[26px] bg-safety" : d === "filled" ? "w-[12px] bg-working" : d === "skipped" ? "w-[12px] bg-idle" : "w-[12px] border-2 border-tank-text"}`} />
            ))}
          </span>
        </div>
        {/* OBS-23: a driver goes to a place, not to a code — the site's name is the big line, the code a tag, the address under it */}
        <span className="break-words font-display text-[clamp(30px,10vw,44px)] font-semibold leading-[1.15]" data-testid="stop-name">
          {siteName(stop.name, stop.code)}
        </span>
        <span className="flex flex-wrap items-center gap-[10px]">
          <span className="rounded-[10px] bg-safety px-[10px] py-[2px] font-display text-[20px] font-semibold text-ink" data-testid="stop-code">
            {stop.code}
          </span>
          {stop.detail && <span className="text-[17px] text-page">{stop.detail}</span>}
        </span>
        <div className="mt-auto flex flex-col items-end">
          <TruckArt id="stop-tank" level={0.3} width={170} />
          <span aria-hidden="true" className="mx-[-20px] h-[3px] self-stretch bg-idle" />
          <span aria-hidden="true" className="mx-[-20px] h-[16px] self-stretch bg-tank-deep" />
        </div>
      </section>
      {stop.skipped && <Notice tone="warn">จุดนี้ถูกข้ามไปแล้ว{stop.skipReason ? ` เพราะ ${stop.skipReason}` : ""} ถ้ากลับมาเติมได้ กดเริ่มเติมได้เลย</Notice>}
      {stop.note && (
        <section className="flex items-start gap-[12px] rounded-[18px] border border-line bg-card px-[16px] py-[14px] shadow-[0_3px_0_var(--color-line)]">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="shrink-0 text-earth">
            <path d="M5 4h14v12l-4 4H5z" />
            <path d="M9 9h6M9 13h3" />
          </svg>
          <div className="flex flex-col gap-[2px]">
            <span className="text-[14px] text-muted">หมายเหตุจากแอดมิน</span>
            <span className="text-[17px]">{stop.note}</span>
          </div>
        </section>
      )}
      <p className="text-[14px] text-muted">โครงการมาจากเส้นทางที่แอดมินวาง เปลี่ยนเองไม่ได้ ถ้าไม่ตรงกับหน้างาน โทรหาแอดมินสโตร์กลาง</p>

      <Sheet open={ask} title={`ข้าม ${stop.code} เพราะอะไร`} onClose={() => setAsk(false)}>
        <Choices name="skip" options={[...SKIP_REASONS, OTHER]} value={why} onChange={setWhy} />
        {why === OTHER && (
          <input aria-label="เหตุผลที่ข้าม" value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} placeholder="พิมพ์เหตุผล" className="min-h-[56px] rounded-[14px] border-2 border-idle bg-card px-[14px] text-[17px]" />
        )}
        <p className="text-[14px] text-muted">แอดมินจะเห็นจุดที่ข้ามพร้อมเหตุผล</p>
        {error && <Notice tone="bad">{error}</Notice>}
        <button type="button" className={btnYellow} disabled={!reason || busy} onClick={skip}>
          {busy ? "กำลังบันทึก" : "ข้ามจุดนี้"}
        </button>
        <button type="button" className={btnLine} onClick={() => setAsk(false)}>
          กลับไปเติมที่จุดนี้
        </button>
      </Sheet>
    </Screen>
  );
}

// ── P4 ขั้น 1 เลือกเครื่อง ──
function Machines({ code, machines, used, onBack, onPick }: { code: string; machines: FlowMachine[]; used: DraftLine[]; onBack: () => void; onPick: (m: { id: string | null; code: string; maxLiters: number | null }) => void }) {
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const usedIds = new Set(used.map((l) => l.machineId ?? l.machineCode));
  const here = machines.filter((m) => m.here);
  const key = q.trim().toLowerCase();
  const list = useMemo(() => {
    if (key) return machines.filter((m) => m.code.toLowerCase().includes(key) || (m.name ?? "").toLowerCase().includes(key));
    return here.length ? here : machines;
  }, [key, machines, here]);
  const heading = key ? `พบ ${list.length} เครื่อง` : here.length ? `เคยเติมที่ ${code}` : machines.length ? `ยังไม่เคยเติมที่ ${code} เลือกจากเครื่องทั้งหมด` : "";

  return (
    <Screen
      title="เลือกเครื่องจักร"
      sub="ขั้น 1 จาก 3 เติมให้เครื่องไหน"
      step={1}
      onBack={onBack}
      dock={
        <button type="button" className={btnLine} onClick={() => setFresh(q.trim())}>
          เครื่องใหม่ พิมพ์รหัสหรือชื่อเอง
        </button>
      }
    >
      <div className="flex h-[58px] shrink-0 items-center gap-[10px] rounded-[16px] border-2 border-earth bg-card px-[14px]">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-earth">
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4.5-4.5" />
        </svg>
        <label htmlFor="q-mach" className="sr-only">
          ค้นหารหัสหรือชื่อเครื่อง
        </label>
        <input id="q-mach" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัสหรือชื่อเครื่อง" className="h-[52px] min-w-0 flex-1 bg-transparent text-[18px] outline-none" />
      </div>
      <div className="flex flex-col gap-[8px]">
        {heading && <h2 className="font-display text-[16px] font-medium text-muted">{heading}</h2>}
        {list.slice(0, 60).map((m) => (
          <button key={m.id} type="button" onClick={() => onPick({ id: m.id, code: m.code, maxLiters: m.maxLiters })} className="flex min-h-[66px] items-center gap-[12px] rounded-[16px] border border-line bg-card px-[14px] py-[8px] text-left shadow-[0_2px_0_var(--color-line)]">
            <MachineArt kind={m.art} name={m.code} w={64} h={52} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-[19px] font-medium leading-[1.3]">
                {m.code}
                {m.isRented && " เช่า"}
              </span>
              {m.name && <span className="truncate text-[14px] text-muted">{m.name}</span>}
            </span>
            {usedIds.has(m.id) && (
              <span className="inline-flex items-center gap-[6px] whitespace-nowrap rounded-full bg-idle-soft py-[3px] pl-[10px] pr-[12px] text-[14px] font-medium text-idle-ink">
                <span aria-hidden="true" className="size-[8px] rounded-full bg-idle" />
                เติมแล้ว
              </span>
            )}
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
        {list.length === 0 && <p className="text-muted">{key ? "ไม่พบเครื่องที่ค้นหา ถ้าเป็นเครื่องใหม่ กดปุ่มด้านล่างแล้วพิมพ์ชื่อเอง" : "ยังไม่มีเครื่องจักรในรายการ กดปุ่มด้านล่างแล้วพิมพ์รหัสหรือชื่อเครื่องเอง"}</p>}
        {!key && here.length > 0 && <p className="text-[14px] text-muted">ไม่เห็นเครื่องที่ต้องการ พิมพ์ค้นหาจากเครื่องทั้งหมดได้</p>}
      </div>
      <Sheet open={fresh !== null} title="เครื่องใหม่ ชื่อหรือรหัสอะไร" onClose={() => setFresh(null)}>
        <label htmlFor="new-mach" className="text-[15px]">
          พิมพ์ตามป้ายหรือทะเบียนที่ตัวเครื่อง
        </label>
        <input id="new-mach" value={fresh ?? ""} onChange={(e) => setFresh(e.target.value)} maxLength={60} className="min-h-[58px] rounded-[16px] border-2 border-idle bg-card px-[16px] font-display text-[20px]" />
        <p className="text-[14px] text-muted">แอดมินสโตร์กลางจะตรวจชื่อเครื่องใหม่อีกครั้ง</p>
        <button type="button" className={btnYellow} disabled={!fresh?.trim()} onClick={() => onPick({ id: null, code: fresh!.trim().replace(/\s+/g, " "), maxLiters: null })}>
          ใช้ชื่อนี้ ไปถ่ายรูปมิเตอร์
        </button>
        <button type="button" className={btnLine} onClick={() => setFresh(null)}>
          กลับไปเลือกจากรายการ
        </button>
      </Sheet>
    </Screen>
  );
}

// ── P4 ขั้น 3 พิมพ์จำนวนลิตร + ถามเมื่อสูงผิดปกติ ──
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
const keyCls = "flex h-[58px] items-center justify-center rounded-[14px] border border-line bg-card font-display text-[28px] font-medium shadow-[0_3px_0_var(--color-line)] active:translate-y-[2px] active:shadow-none";

function Liters({ cur, code, onChange, onBack, onRetake, onSave, onDelete }: { cur: Current; code: string; onChange: (c: Current) => void; onBack: () => void; onRetake: () => void; onSave: (confirmedHigh: boolean) => void; onDelete?: () => void }) {
  const [ask, setAsk] = useState(false);
  const [hours, setHours] = useState(cur.hourMeter !== "");
  const value = litersValue(cur.liters);
  const hourOk = cur.hourMeter.trim() === "" || /^\d{1,7}(\.\d{1,2})?$/.test(cur.hourMeter.trim());
  const photo = cur.photo!;
  const taken = bangkok(new Date(photo.takenAt));

  return (
    <Screen
      title="พิมพ์จำนวนลิตร"
      sub={`ขั้น 3 จาก 3 ${cur.machineCode}`}
      step={3}
      onBack={onBack}
      dock={
        <button type="button" className={btnYellow} disabled={value === null || !hourOk} onClick={() => (isHighLiters(value!, cur.usualMax) ? setAsk(true) : onSave(false))}>
          บันทึกเครื่องนี้
        </button>
      }
    >
      <div className="flex items-center gap-[12px]">
        <Thumb src={shotUrl(photo)} alt={`รูปมิเตอร์ของ ${cur.machineCode}`} size={84} />
        <span className="flex flex-1 flex-col text-[15px] text-muted">
          <span className="text-ink">พิมพ์ตามตัวเลขในรูป</span>
          {thaiLong(taken.date)} {taken.time} {code}
          <button type="button" className="min-h-[44px] self-start text-earth underline" onClick={onRetake}>
            ถ่ายรูปใหม่
          </button>
        </span>
      </div>
      <div role="status" aria-label={`${cur.liters || "0"} ลิตร`} className="flex min-h-[76px] items-baseline justify-center gap-[8px] rounded-[18px] border-2 border-earth bg-card px-[16px] py-[8px]" data-testid="liters-display">
        <span className={`font-display text-[52px] font-semibold leading-none ${cur.liters ? "" : "text-idle"}`}>{cur.liters || "0"}</span>
        <span className="text-[18px] text-muted">ลิตร</span>
      </div>
      <div className="grid grid-cols-3 gap-[8px]">
        {KEYS.map((k) => (
          <button key={k} type="button" aria-label={k === "." ? "จุดทศนิยม" : k === "back" ? "ลบตัวสุดท้าย" : undefined} className={keyCls} onClick={() => onChange({ ...cur, liters: typeLiters(cur.liters, k) })}>
            {k === "back" ? (
              <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6h11v12H9l-6-6z" />
                <path d="M12 10l4 4M16 10l-4 4" />
              </svg>
            ) : (
              k
            )}
          </button>
        ))}
      </div>
      {hours ? (
        <div className="flex flex-col gap-[6px]">
          <label htmlFor="hour-meter" className="text-[15px]">
            ชั่วโมงการทำงานของเครื่อง (ไม่บังคับ)
          </label>
          <input id="hour-meter" inputMode="decimal" value={cur.hourMeter} onChange={(e) => onChange({ ...cur, hourMeter: e.target.value })} aria-invalid={!hourOk} className="min-h-[56px] rounded-[14px] border-2 border-idle bg-card px-[14px] font-display text-[20px]" />
          {!hourOk && <span className="text-[14px] text-repair-ink">ใส่เป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</span>}
        </div>
      ) : (
        <button type="button" className={`${linkBtn} self-start`} onClick={() => setHours(true)}>
          ใส่ชั่วโมงการทำงานของเครื่อง (ไม่บังคับ)
        </button>
      )}
      {onDelete && (
        <button type="button" className="min-h-[56px] self-start text-repair underline" onClick={onDelete}>
          ลบเครื่องนี้ออกจากใบ
        </button>
      )}
      <Sheet open={ask} title={`${cur.liters} ลิตร ถูกต้องไหม`} onClose={() => setAsk(false)}>
        <p>
          สูงกว่าที่ {cur.machineCode} เคยเติมมาก ครั้งก่อน ๆ ไม่เกิน {fmt(cur.usualMax ?? 0)} ลิตร ดูตัวเลขในรูปอีกครั้ง
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shotUrl(photo)} alt={`รูปมิเตอร์ของ ${cur.machineCode}`} className="max-h-[38vh] w-full rounded-[14px] object-contain" />
        <button type="button" className={btnYellow} onClick={() => setAsk(false)}>
          แก้ตัวเลข
        </button>
        <button type="button" className={btnLine} onClick={() => onSave(true)}>
          ถูกต้อง บันทึก {cur.liters} ลิตร
        </button>
      </Sheet>
    </Screen>
  );
}

// ── P5 สรุปและเซ็นรับ + ไม่มีผู้เซ็นรับ ──
function Sign({ draft, stop, artOf, onBack, onDone }: { draft: Draft; stop: StopInfo; artOf: (l: DraftLine) => MachineArtKind; onBack: () => void; onDone: (s: Signing) => Promise<void> }) {
  const pad = useRef<SignatureHandle>(null);
  const [name, setName] = useState("");
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [why, setWhy] = useState("");
  const [other, setOther] = useState("");
  const reason = why === OTHER ? other.trim() : why;
  const now = bangkok(new Date());
  const total = totalLiters(draft.lines);
  const when = `${thaiLong(draft.date)} เวลา ${bangkok(new Date(draft.startedAt)).time}–${now.time}`;

  const done = async (make: () => Promise<Signing>) => {
    setBusy(true);
    try {
      await onDone(await make());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="สรุปและเซ็นรับ"
      sub="ยื่นมือถือให้ผู้รับอ่าน"
      onBack={onBack}
      dock={
        <>
          <button
            type="button"
            className={btnYellow}
            disabled={!name.trim() || !ink || busy}
            onClick={() => done(async () => ({ receiverName: name.trim(), image: await pad.current!.toShot([`ผู้รับ ${name.trim()}`, `${thaiLong(now.date)} ${now.time}  ${draft.projectRefCode}  ${fmt(total)} ลิตร`, siteName(stop.name, stop.code)]) }))}
          >
            {busy ? "กำลังบันทึก" : "ยืนยันรับน้ำมัน"}
          </button>
          <button type="button" className="min-h-[44px] self-center text-earth underline" disabled={busy} onClick={() => setAsk(true)}>
            ไม่มีผู้เซ็นรับ
          </button>
        </>
      }
    >
      {/* OBS-23: the person who signs must be able to read which site this is */}
      <div className="flex flex-col gap-[2px]">
        <span className="break-words font-display text-[24px] font-semibold leading-[1.25]">
          {siteName(stop.name, stop.code)}
          {siteName(stop.name, stop.code) !== stop.code && <span className="ml-[8px] whitespace-nowrap rounded-[8px] bg-page px-[7px] py-[1px] align-middle text-[15px] font-medium text-earth">{draft.projectRefCode}</span>}
        </span>
        {stop.detail && <span className="text-[15px] text-muted">{stop.detail}</span>}
        <span className="text-muted">{when}</span>
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {draft.lines.map((l) => (
            <tr key={l.id} className="border-b border-line">
              <td className="py-[6px] text-[18px]">
                <span className="flex items-center gap-[10px]">
                  <MachineArt kind={artOf(l)} name={l.machineCode} w={52} h={40} />
                  {l.machineCode}
                </span>
              </td>
              <td className="whitespace-nowrap py-[7px] text-right font-display text-[20px] font-medium">{fmt(Number(l.liters))} ลิตร</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-baseline justify-between gap-[12px]">
        <span className="font-display text-[20px] font-medium">รวม {draft.lines.length} เครื่อง</span>
        <span className="font-display text-[44px] font-semibold leading-[1.05]" data-testid="sign-total">
          {fmt(total)}
          <span className="text-[20px] font-normal"> ลิตร</span>
        </span>
      </div>
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="s-name">ชื่อผู้เซ็นรับ</label>
        <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="พิมพ์ชื่อผู้รับน้ำมัน" autoComplete="off" className="h-[58px] rounded-[16px] border-2 border-earth bg-card px-[14px] text-[18px]" />
      </div>
      <div className="flex flex-1 flex-col gap-[6px]">
        <div className="flex items-center justify-between">
          <span>เซ็นด้วยนิ้วในกรอบ</span>
          <button type="button" className="min-h-[44px] px-[4px] text-earth underline" onClick={() => pad.current?.clear()}>
            ล้างลายเซ็น
          </button>
        </div>
        <SignaturePad ref={pad} onInk={setInk} />
      </div>
      <Sheet open={ask} title="ไม่มีผู้เซ็นรับ เพราะอะไร" onClose={() => setAsk(false)}>
        <Choices name="why" options={[...UNSIGNED_REASONS, OTHER]} value={why} onChange={setWhy} />
        {why === OTHER && <input aria-label="เหตุผลที่ไม่มีผู้เซ็นรับ" value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} placeholder="พิมพ์เหตุผล" className="min-h-[56px] rounded-[14px] border-2 border-idle bg-card px-[14px] text-[17px]" />}
        <p className="text-[14px] text-muted">ใบนี้จะติดป้าย ยังไม่เซ็นรับ และยังไม่ถูกเรียกเก็บ ขอลายเซ็นทีหลังได้จากหน้ารายละเอียดใบ</p>
        <button type="button" className={btnYellow} disabled={!reason || busy} onClick={() => done(async () => ({ unsignedReason: reason }))}>
          {busy ? "กำลังบันทึก" : "บันทึกแบบยังไม่เซ็นรับ"}
        </button>
        <button type="button" className={btnLine} onClick={() => setAsk(false)}>
          กลับไปให้ผู้รับเซ็น
        </button>
      </Sheet>
    </Screen>
  );
}
