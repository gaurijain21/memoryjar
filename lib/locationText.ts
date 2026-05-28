const droppedPinPattern = /^Dropped pin\s*\(-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?\)$/i;

export function getReadableLocationName(locationName?: string | null) {
  const value = locationName?.trim();
  if (!value || droppedPinPattern.test(value)) return "";
  return value;
}
