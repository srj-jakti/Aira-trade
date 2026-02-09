export function getIstEndOfDayExpiryUtcIso(baseDate = new Date()): string {
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const istShifted = new Date(baseDate.getTime() + offsetMs);
  istShifted.setUTCHours(23, 59, 59, 999);
  const expiryUtc = new Date(istShifted.getTime() - offsetMs);
  return expiryUtc.toISOString();
}

