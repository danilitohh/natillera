import {
  DEFAULT_CONTRIBUTION_DUE_DAY,
  MONTH_OPTIONS,
} from "@/lib/constants";

function isDateOnlyValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseStoredDate(value: string): Date {
  if (isDateOnlyValue(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseStoredDate(value));
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseStoredDate(value));
}

export function getMonthName(month: number): string {
  return MONTH_OPTIONS.find((item) => item.value === month)?.label ?? "Mes";
}

export function formatMonthYear(month: number, year: number): string {
  return `${getMonthName(month)} ${year}`;
}

export function getToday(): Date {
  return new Date();
}

export function getCurrentMonth(): number {
  return getToday().getMonth() + 1;
}

export function getCurrentYear(): number {
  return getToday().getFullYear();
}

export function getMonthStartDate(
  year: number,
  month: number,
  day = 1,
): Date {
  return new Date(year, month - 1, day);
}

export function getContributionDefaultDueDate(
  month: number,
  year: number,
): string {
  return toDateInputValue(
    new Date(year, month - 1, Math.min(DEFAULT_CONTRIBUTION_DUE_DAY, 28)),
  );
}

export function getLastDayOfMonth(month: number, year: number): Date {
  return new Date(year, month, 0);
}

export function getLastFridayOfMonth(month: number, year: number): Date {
  const cursor = getLastDayOfMonth(month, year);

  while (cursor.getDay() !== 5) {
    cursor.setDate(cursor.getDate() - 1);
  }

  return cursor;
}

export function getMonthEndDate(month: number, year: number): string {
  return toDateInputValue(getLastDayOfMonth(month, year));
}

export function addMonths(value: string, months: number): string {
  const date = parseStoredDate(value);
  return toDateInputValue(
    new Date(date.getFullYear(), date.getMonth() + months, date.getDate()),
  );
}

export function calculateDurationMonths(
  startDate: string,
  endDate: string,
): number {
  const start = parseStoredDate(startDate);
  const end = parseStoredDate(endDate);

  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

export function getDefaultSettlementDate(reference = new Date()): string {
  const year = reference.getMonth() >= 11 ? reference.getFullYear() + 1 : reference.getFullYear();
  return toDateInputValue(new Date(year, 11, 5));
}

export function isPastDue(dateValue: string, asOf = new Date()): boolean {
  return parseStoredDate(dateValue).getTime() < stripTime(asOf).getTime();
}

export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(start: string, end: string): number {
  const startDate = stripTime(parseStoredDate(start));
  const endDate = stripTime(parseStoredDate(end));
  const diff = endDate.getTime() - startDate.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isWithinDays(
  targetDate: string,
  windowInDays: number,
  asOf = new Date(),
): boolean {
  const diff = daysBetween(toDateInputValue(asOf), targetDate);
  return diff >= 0 && diff <= windowInDays;
}

export function getYearOptions(span = 3): number[] {
  const currentYear = getCurrentYear();
  const start = currentYear - 1;

  return Array.from({ length: span + 2 }, (_, index) => start + index);
}
