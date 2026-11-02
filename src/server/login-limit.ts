const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;

type Entry = { failures: number; first: number };
const failures = new Map<string, Entry>();

function current(key: string, now: number): Entry | undefined {
  const entry = failures.get(key);
  if (entry && now - entry.first > WINDOW_MS) {
    failures.delete(key);
    return undefined;
  }
  return entry;
}

export function isLoginLocked(key: string, now = Date.now()): boolean {
  return (current(key, now)?.failures ?? 0) >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const entry = current(key, now);
  if (entry) entry.failures += 1;
  else failures.set(key, { failures: 1, first: now });
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
