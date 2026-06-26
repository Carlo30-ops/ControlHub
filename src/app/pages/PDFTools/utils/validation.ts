import React from 'react';

/** Record of field errors used by the PDF Tools UI. */
export type ErrorMap = Record<string, string>;

/** Set an error message for a specific field. */
export const setError = (
  setter: React.Dispatch<React.SetStateAction<ErrorMap>>,
  field: string,
  msg: string
) => {
  setter(prev => ({ ...prev, [field]: msg }));
};

/** Remove the error entry for a specific field. */
export const clearError = (
  setter: React.Dispatch<React.SetStateAction<ErrorMap>>,
  field: string
) => {
  setter(prev => {
    const { [field]: _, ...rest } = prev;
    return rest;
  });
};

/** Validate that a value is not empty. Returns true if valid, otherwise sets an error. */
export const validateNotEmpty = (
  setter: React.Dispatch<React.SetStateAction<ErrorMap>>,
  field: string,
  value: any,
  label: string
) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    setError(setter, field, `${label} no puede estar vacío`);
    return false;
  }
  clearError(setter, field);
  return true;
};

/** Basic sanitization for user‑provided strings. Trims whitespace and strips angle brackets to mitigate HTML injection. */
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};
