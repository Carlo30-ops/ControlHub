export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNonEmptyString = (value: unknown): value is string => {
  return isString(value) && value.trim().length > 0;
};

/**
 * Returns a validated non‑empty string or a fallback.
 */
export const validateStringSetting = (raw: unknown, fallback: string = ''): string => {
  return isNonEmptyString(raw) ? (raw as string) : fallback;
};
