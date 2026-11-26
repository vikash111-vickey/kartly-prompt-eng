import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Product } from "@/types/product";
import type { SafetyCheckResult } from "@/lib/safety/check";

export interface CachedAnswer {
  normalizedQuery: string;
  rawQuery?: string;
  searchQuery?: string;
  text: string;
  products?: Product[];
  safetyCheck?: SafetyCheckResult;
  updatedAt: number;
}

const PRIMARY_DIR = path.join(process.cwd(), ".kartly-cache");
const PRIMARY_FILE = path.join(PRIMARY_DIR, "answers.json");

const TEMP_DIR = path.join(os.tmpdir(), "kartly-cache");
const TEMP_FILE = path.join(TEMP_DIR, "answers.json");

const MAX_CACHE_ENTRIES = 50;

/**
 * Normalizes user queries for consistent cache indexing:
 * lowercase, trimmed, with collapsed whitespace.
 */
export function normalizeQuery(message: string): string {
  try {
    return message
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  } catch {
    return "";
  }
}

/**
 * Returns readable cache files in priority order:
 * 1. Primary workspace location (.kartly-cache/answers.json)
 * 2. Fallback OS temp directory (os.tmpdir()/kartly-cache/answers.json)
 */
function getReadableCacheFiles(): string[] {
  const files: string[] = [];
  try {
    if (fs.existsSync(PRIMARY_FILE)) {
      files.push(PRIMARY_FILE);
    }
  } catch {
    // Disk might be inaccessible, ignore
  }

  try {
    if (fs.existsSync(TEMP_FILE)) {
      files.push(TEMP_FILE);
    }
  } catch {
    // Temp disk error, ignore
  }

  return files;
}

/**
 * Identifies the best writable cache file location.
 * Tries the primary directory first; if non-writable (e.g. read-only container),
 * falls back to the OS temp directory.
 * If neither is writable, returns null.
 */
function getWritableCacheTarget(): { dir: string; file: string } | null {
  // Attempt 1: Primary directory
  try {
    if (!fs.existsSync(PRIMARY_DIR)) {
      fs.mkdirSync(PRIMARY_DIR, { recursive: true });
    }
    const testPath = path.join(PRIMARY_DIR, ".write-test");
    fs.writeFileSync(testPath, "ok", "utf-8");
    fs.unlinkSync(testPath);
    return { dir: PRIMARY_DIR, file: PRIMARY_FILE };
  } catch {
    // Primary directory not writable (e.g. read-only file system on serverless host)
  }

  // Attempt 2: OS Temp directory
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    const testPath = path.join(TEMP_DIR, ".write-test");
    fs.writeFileSync(testPath, "ok", "utf-8");
    fs.unlinkSync(testPath);
    return { dir: TEMP_DIR, file: TEMP_FILE };
  } catch {
    // Temp directory also not writable
  }

  // Silent no-op: no file access works
  return null;
}

function readCacheFile(filePath: string): Record<string, CachedAnswer> | null {
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Ignore read or parse failures
  }
  return null;
}

/**
 * Retrieves a cached answer for a given user query.
 * Wrapped in try/catch to ensure disk/file issues never break live responses.
 * Never exposes API keys or headers.
 */
export function getCachedAnswer(message: string): CachedAnswer | null {
  try {
    const key = normalizeQuery(message);
    if (!key) return null;

    const readableFiles = getReadableCacheFiles();
    for (const filePath of readableFiles) {
      const data = readCacheFile(filePath);
      if (data && data[key]) {
        return data[key];
      }
    }
    return null;
  } catch {
    // Never propagate errors out to caller
    return null;
  }
}

/**
 * Saves a successful answer to answers.json.
 * Keeps at most 50 entries, retaining the most recent ones.
 * Automatically falls back to the OS temp directory if project folder is read-only.
 * Silently does nothing if file access is completely unavailable.
 * Never stores API keys, headers, or internal credentials.
 */
export function saveCachedAnswer(
  message: string,
  answer: {
    text: string;
    products?: Product[];
    safetyCheck?: SafetyCheckResult;
    searchQuery?: string;
  }
): void {
  try {
    const key = normalizeQuery(message);
    if (!key || !answer.text.trim()) return;

    const target = getWritableCacheTarget();
    if (!target) {
      // Disk is completely read-only or unavailable; silently do nothing
      return;
    }

    let data: Record<string, CachedAnswer> = readCacheFile(target.file) || {};

    if (Object.keys(data).length === 0) {
      // Try reading from any readable source to preserve history
      for (const rf of getReadableCacheFiles()) {
        const fallbackData = readCacheFile(rf);
        if (fallbackData && Object.keys(fallbackData).length > 0) {
          data = fallbackData;
          break;
        }
      }
    }

    // Insert or update entry
    data[key] = {
      normalizedQuery: key,
      rawQuery: message,
      searchQuery: answer.searchQuery,
      text: answer.text,
      products: answer.products,
      safetyCheck: answer.safetyCheck,
      updatedAt: Date.now(),
    };

    // Prune entries to keep at most MAX_CACHE_ENTRIES (most recent first)
    const entries = Object.entries(data);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
      const pruned = entries.slice(0, MAX_CACHE_ENTRIES);
      data = Object.fromEntries(pruned);
    }

    fs.writeFileSync(/*turbopackIgnore: true*/ target.file, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Silently do nothing on write failure; never crash or break chat
  }
}

/**
 * Retrieves all stored cache entries.
 */
export function getAllCachedAnswers(): Record<string, CachedAnswer> {
  try {
    const readableFiles = getReadableCacheFiles();
    for (const filePath of readableFiles) {
      const data = readCacheFile(filePath);
      if (data) return data;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Clears all cached demo entries (useful for testing).
 */
export function clearDemoCache(): void {
  try {
    if (fs.existsSync(PRIMARY_FILE)) {
      try {
        fs.unlinkSync(PRIMARY_FILE);
      } catch {
        // Ignore
      }
    }
    if (fs.existsSync(TEMP_FILE)) {
      try {
        fs.unlinkSync(TEMP_FILE);
      } catch {
        // Ignore
      }
    }
  } catch {
    // Silently handle
  }
}
