import fs from "fs";
import { join } from "path";
import { homedir } from "os";
import { getInitiativesRoot } from "./parser.js";

function getMissionsRoot(): string {
  const missionsPath = join(homedir(), ".claude", "missions");
  if (fs.existsSync(missionsPath)) {
    return missionsPath;
  }
  // Fall back to legacy initiatives/ path
  return getInitiativesRoot();
}

export function startWatcher(onChanged: (filePath: string) => void): void {
  const root = getMissionsRoot();
  process.stderr.write(`[workspace] Watching ${root}\n`);

  // Debounce: accumulate changed paths for 500ms then flush
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    timer = null;
    for (const p of pending) onChanged(p);
    pending.clear();
  }

  function handleChange(filename: string | null): void {
    const resolved = filename ? `${root}/${filename}` : root;
    pending.add(resolved);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, 500);
  }

  try {
    fs.watch(root, { recursive: true }, (_eventType, filename) => {
      handleChange(filename);
    });
  } catch (err) {
    process.stderr.write(`[workspace] Watcher error: ${err}\n`);
  }
}
