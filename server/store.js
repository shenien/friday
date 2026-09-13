import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function readJson(fileName, fallback) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  if (!existsSync(filePath)) {
    await writeFile(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function writeJson(fileName, data) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  await writeFile(filePath, JSON.stringify(data, null, 2));
}
