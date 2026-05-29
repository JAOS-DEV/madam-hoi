function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/**
 * Removes undefined values and non-finite numbers from nested objects before Firestore writes.
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return undefined as T;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue === undefined) {
      continue;
    }
    const sanitized = sanitizeForFirestore(nestedValue);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result as T;
}

export function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
