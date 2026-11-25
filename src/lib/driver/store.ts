"use client";

import { useEffect, useState } from "react";
import type { Draft } from "@/domain/driver-fill";

/**
 * What the driver's phone keeps by itself (IndexedDB "myoil-driver"), so a slip survives a closed tab and no signal:
 *  - drafts: the slip being filled at a stop (key = stopId)
 *  - outbox: finished slips and refills waiting to reach MYOIL (key = ref)
 * Photos live inside these records as base64 JPEG (≤ ~250 KB each).
 */
export type OutItem = {
  ref: string;
  kind: "issue" | "purchase";
  url: string;
  body: unknown;
  /** what the home screen says about it */
  label: string;
  liters: number;
  stopId: string | null;
  createdAt: string;
  state: "waiting" | "failed";
  error: string | null;
};

const DB = "myoil-driver";
const EVENT = "myoil-driver-store";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("drafts", { keyPath: "stopId" });
      req.result.createObjectStore("outbox", { keyPath: "ref" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: "drafts" | "outbox", mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const changed = () => window.dispatchEvent(new Event(EVENT));

export const getDraft = (stopId: string) => run<Draft | undefined>("drafts", "readonly", (s) => s.get(stopId));
export const allDrafts = () => run<Draft[]>("drafts", "readonly", (s) => s.getAll());
export async function saveDraft(d: Draft) {
  await run("drafts", "readwrite", (s) => s.put(d));
  changed();
}
export async function dropDraft(stopId: string) {
  await run("drafts", "readwrite", (s) => s.delete(stopId));
  changed();
}

export const allOut = () => run<OutItem[]>("outbox", "readonly", (s) => s.getAll());
export async function putOut(item: OutItem) {
  await run("outbox", "readwrite", (s) => s.put(item));
  changed();
}
export async function dropOut(ref: string) {
  await run("outbox", "readwrite", (s) => s.delete(ref));
  changed();
}

export type LocalState = { ready: boolean; drafts: Draft[]; outbox: OutItem[] };

/** drafts and the outbox, re-read whenever this tab changes them */
export function useLocal(): LocalState {
  const [state, setState] = useState<LocalState>({ ready: false, drafts: [], outbox: [] });
  useEffect(() => {
    let live = true;
    const read = () =>
      Promise.all([allDrafts(), allOut()])
        .then(([drafts, outbox]) => live && setState({ ready: true, drafts, outbox }))
        .catch(() => live && setState({ ready: true, drafts: [], outbox: [] }));
    void read();
    window.addEventListener(EVENT, read);
    return () => {
      live = false;
      window.removeEventListener(EVENT, read);
    };
  }, []);
  return state;
}
