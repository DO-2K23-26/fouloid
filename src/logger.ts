export interface LogContext {
  agent: string;
  generation: number;
  word: string;
  parent: string;
  namespace?: string;
}

let _ctx: LogContext = { agent: "unknown", generation: 0, word: "", parent: "" };

export function setLogContext(ctx: LogContext) {
  _ctx = ctx;
}

function emit(level: "info" | "warn" | "error", fields: Record<string, unknown>) {
  const line = JSON.stringify({ ts: Date.now(), level, ..._ctx, ...fields });
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  info: (fields: Record<string, unknown>) => emit("info", fields),
  warn: (fields: Record<string, unknown>) => emit("warn", fields),
  error: (fields: Record<string, unknown>) => emit("error", fields),
};
