function redactDiagnosticString(value) {
  return String(value)
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|mssql):\/\/[^\s"'<>]+/gi,
      "[REDACTED_CONNECTION_STRING]"
    )
    .replace(
      /(\b(?:password|passwd|pwd|token|secret|api[_-]?key|client[_-]?secret|authorization)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^&\s"'<>;,]+)/gi,
      "$1[REDACTED]"
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

function getErrorDetails(error, seen = new WeakSet()) {
  if (!error || typeof error !== "object") {
    return error == null ? undefined : { message: redactDiagnosticString(error) };
  }
  if (seen.has(error)) return { message: "[Circular]" };
  seen.add(error);

  const details = {};
  for (const key of ["name", "code", "message"]) {
    if (error[key] !== undefined && error[key] !== null) {
      details[key] =
        key === "message" ? redactDiagnosticString(error[key]) : error[key];
    }
  }
  if (error.cause !== undefined && error.cause !== null) {
    details.cause = getErrorDetails(error.cause, seen);
  }
  return details;
}

export async function runDatabaseOperation(operation, query) {
  try {
    return await query();
  } catch (error) {
    console.error("Prisma operation failed:", {
      operation,
      error: getErrorDetails(error),
    });
    throw error;
  }
}
