type LogContext = Record<string, string | number | boolean | null>;

function write(level: "info" | "warn" | "error", message: string, context: LogContext = {}) {
  const entry = {
    level,
    message,
    correlationId: context.correlationId ?? null,
    timestamp: new Date().toISOString(),
  };

  if (level === "error") console.error(JSON.stringify({ ...entry, context }));
  else if (level === "warn") console.warn(JSON.stringify({ ...entry, context }));
  else console.info(JSON.stringify({ ...entry, context }));
}

export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
