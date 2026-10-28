/** decodeURIComponent that returns the raw value instead of throwing on a malformed % sequence. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
