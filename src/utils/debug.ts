const APP_LABEL = "DomeLab";
const sessionStartMs = nowMs();
const MAX_LOG_ENTRIES = 600;
let nextLogId = 1;
const logEntries: DebugLogEntry[] = [];
const listeners = new Set<() => void>();

const isBrowserRuntime = (): boolean => typeof window !== "undefined";

export interface DebugLogEntry {
  id: number;
  timestampIso: string;
  elapsedMs: number;
  elapsedLabel: string;
  level: "debug" | "warn" | "error";
  scope: string;
  message: string;
  data?: Record<string, unknown>;
  line: string;
}

export const getDebugLogEntries = (): DebugLogEntry[] => [...logEntries];

export const subscribeDebugLogs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const clearDebugLogs = () => {
  logEntries.length = 0;
  notifyListeners();
};

export const formatDebugLogEntries = (entries: DebugLogEntry[] = logEntries): string =>
  entries
    .map((entry) =>
      entry.data && Object.keys(entry.data).length > 0
        ? `${entry.line} ${serializeData(entry.data)}`
        : entry.line
    )
    .join("\n");

export const debugLog = (scope: string, message: string, data?: Record<string, unknown>) => {
  emitLog("debug", scope, message, data);
};

export const debugWarn = (scope: string, message: string, data?: Record<string, unknown>) => {
  emitLog("warn", scope, message, data);
};

export const debugError = (scope: string, message: string, data?: Record<string, unknown>) => {
  emitLog("error", scope, message, data);
};

export const measureSync = <T>(
  scope: string,
  operation: string,
  run: () => T,
  context?: Record<string, unknown>
): T => {
  const startedAt = nowMs();
  debugLog(scope, `${operation}:start`, context);
  try {
    const result = run();
    debugLog(scope, `${operation}:done`, { ...context, durationMs: roundMs(nowMs() - startedAt) });
    return result;
  } catch (error) {
    debugError(scope, `${operation}:error`, {
      ...context,
      durationMs: roundMs(nowMs() - startedAt),
      error: errorSummary(error)
    });
    throw error;
  }
};

export const measureAsync = async <T>(
  scope: string,
  operation: string,
  run: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> => {
  const startedAt = nowMs();
  debugLog(scope, `${operation}:start`, context);
  try {
    const result = await run();
    debugLog(scope, `${operation}:done`, { ...context, durationMs: roundMs(nowMs() - startedAt) });
    return result;
  } catch (error) {
    debugError(scope, `${operation}:error`, {
      ...context,
      durationMs: roundMs(nowMs() - startedAt),
      error: errorSummary(error)
    });
    throw error;
  }
};

export const installGlobalDebugLogging = () => {
  if (!isBrowserRuntime()) return;

  debugLog("app", "startup", {
    href: window.location.href,
    userAgent: navigator.userAgent
  });

  window.addEventListener("error", (event) => {
    debugError("window", "uncaught-error", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    debugError("window", "unhandled-rejection", {
      reason: errorSummary(event.reason)
    });
  });

  if (!("PerformanceObserver" in window)) return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;

  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      debugWarn("perf", "long-task", {
        name: entry.name || "longtask",
        startTimeMs: roundMs(entry.startTime),
        durationMs: roundMs(entry.duration)
      });
    });
  });

  observer.observe({ entryTypes: ["longtask"] });
};

function emitLog(
  level: "debug" | "warn" | "error",
  scope: string,
  message: string,
  data?: Record<string, unknown>
) {
  if (!isBrowserRuntime()) return;

  const timestampIso = new Date().toISOString();
  const elapsedMs = roundMs(nowMs() - sessionStartMs);
  const elapsed = formatElapsed(elapsedMs);
  const prefix = `[${timestampIso}] [${APP_LABEL}] [+${elapsed}] [${scope}] ${message}`;
  const entry: DebugLogEntry = {
    id: nextLogId,
    timestampIso,
    elapsedMs,
    elapsedLabel: elapsed,
    level,
    scope,
    message,
    data,
    line: prefix
  };
  nextLogId += 1;
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES);
  }
  notifyListeners();

  const consoleMethod =
    level === "warn" ? console.warn : level === "error" ? console.error : console.debug;

  if (data && Object.keys(data).length > 0) {
    consoleMethod(prefix, data);
    return;
  }
  consoleMethod(prefix);
}

function nowMs(): number {
  if (typeof performance !== "undefined") return performance.now();
  return Date.now();
}

function roundMs(value: number): number {
  return Number(value.toFixed(2));
}

function formatElapsed(valueMs: number): string {
  return `${(valueMs / 1000).toFixed(3)}s`;
}

function errorSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function serializeData(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}
