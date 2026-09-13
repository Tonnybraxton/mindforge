export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function requireValue<T>(value: T | undefined | null, status: number, code: string, message: string): T {
  if (value === undefined || value === null) throw new ApiError(status, code, message);
  return value;
}
