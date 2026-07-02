export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'app',
  'inbox',
  'login',
  'register',
  's',
  'vault',
]);

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/;

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidHandle(value: string): boolean {
  const handle = normalizeHandle(value);
  return HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.has(handle);
}

export function handleValidationMessage(value: string): string | null {
  const handle = normalizeHandle(value);

  if (handle.length < 3) {
    return 'Handle must be at least 3 characters.';
  }

  if (RESERVED_HANDLES.has(handle)) {
    return 'This handle is reserved.';
  }

  if (!HANDLE_PATTERN.test(handle)) {
    return 'Use lowercase letters, numbers, hyphens, or underscores.';
  }

  return null;
}
