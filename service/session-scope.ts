import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/**
 * The tracker call does not carry the OpenChamber session directory. The
 * service learns it from the latest top-level session event and keeps the last
 * one in its own data folder across idle stops.
 */
const dataDir = process.env.OPENCHAMBER_SERVICE_DATA_DIR?.trim() || null;
const file = dataDir ? join(dataDir, 'session-scope.json') : null;
let latest: string | null = null;

export const latestSessionDirectory = (): string | null => latest;

export const rememberSessionDirectory = (directory: string): void => {
  if (!directory || !isAbsolute(directory) || directory.includes('\0')) return;
  latest = directory;
  if (!file) return;
  try {
    mkdirSync(dataDir!, { recursive: true });
    writeFileSync(file, JSON.stringify({ directory }));
  } catch (error) {
    console.error(
      `[youtrack] could not save the session folder: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

if (file) {
  try {
    const stored: { directory?: unknown } = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof stored.directory === 'string' && isAbsolute(stored.directory)) {
      latest = stored.directory;
    }
  } catch {
    // No stored scope yet, or the file is unreadable.
  }
}
