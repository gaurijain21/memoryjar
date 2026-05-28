export function formatMemoryDate(date: string, monthStyle: "short" | "long" = "short") {
  const [year, month, day] = date.split("-").map((part) => Number(part));

  if (!year) return "";

  if (!month) return String(year);

  const value = new Date(year, month - 1, day || 1);
  return new Intl.DateTimeFormat("en", {
    month: monthStyle,
    year: "numeric",
    ...(day ? { day: "numeric" } : {}),
  }).format(value);
}
