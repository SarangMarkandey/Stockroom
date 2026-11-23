"use client";

import { useSyncExternalStore } from "react";
import type { Inventory } from "./inventory";
import { seed } from "./seed";

const storageKey = "stockroom.inventory.v1";
let rawSnapshot: string | null | undefined;
let snapshot = seed;
const listeners = new Set<() => void>();

function getSnapshot() {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return snapshot;
  }
  if (raw !== rawSnapshot) {
    rawSnapshot = raw;
    try {
      const data: Inventory | null = raw ? JSON.parse(raw) : null;
      snapshot = data && Array.isArray(data.godowns) && Array.isArray(data.products)
        && Array.isArray(data.orders) && Array.isArray(data.movements) && Array.isArray(data.transfers)
        ? data : seed;
    } catch {
      snapshot = seed;
    }
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === storageKey) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useInventory() {
  return useSyncExternalStore(subscribe, getSnapshot, () => seed);
}

export async function updateInventory(update: (state: Inventory) => Inventory) {
  const commit = () => {
    const current = getSnapshot();
    const next = update(current);
    if (next === current) return next;
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(storageKey, raw);
    } catch {
      throw new Error("Stockroom couldn’t save changes in this browser. Check that local storage is available and try again.");
    }
    rawSnapshot = raw;
    snapshot = next;
    listeners.forEach((listener) => listener());
    return next;
  };
  return navigator.locks ? navigator.locks.request(storageKey, commit) : commit();
}
