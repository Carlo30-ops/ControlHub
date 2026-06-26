import React from 'react';
/** Record of field errors used by the PDF Tools UI. */
export type ErrorMap = Record<string, string>;
/** Set an error message for a specific field. */
export declare const setError: (setter: React.Dispatch<React.SetStateAction<ErrorMap>>, field: string, msg: string) => void;
/** Remove the error entry for a specific field. */
export declare const clearError: (setter: React.Dispatch<React.SetStateAction<ErrorMap>>, field: string) => void;
/** Validate that a value is not empty. Returns true if valid, otherwise sets an error. */
export declare const validateNotEmpty: (setter: React.Dispatch<React.SetStateAction<ErrorMap>>, field: string, value: any, label: string) => boolean;
/** Basic sanitization for user‑provided strings. Trims whitespace and strips angle brackets to mitigate HTML injection. */
export declare const sanitizeInput: (input: string) => string;
