import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const storePath = resolve("data/store.json");

const defaultState = {
  coupons: [],
  transactions: [],
  metrics: {
    totalCouponsIssued: 0,
    totalCouponsRedeemed: 0,
    totalCouponsExpired: 0,
    platformFeesCollected: 0,
    merchantReleases: 0,
    supplierReleases: 0,
    courierReleases: 0
  }
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

async function ensureStoreFile() {
  await mkdir(dirname(storePath), { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(cloneDefaultState(), null, 2), "utf8");
  }
}

export async function readStore() {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw);
}

export async function writeStore(state) {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(state, null, 2), "utf8");
}

export async function resetStore() {
  const state = cloneDefaultState();
  await writeStore(state);
  return state;
}
