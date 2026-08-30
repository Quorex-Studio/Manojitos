/**
 * getNextCutoffDates — Calculate the next 15/30 cutoff dates from a given date.
 * Rules:
 * - If today is before the 15th, next cutoff is the 15th of this month
 * - If today is the 15th-29th, next cutoff is the 30th of this month
 * - If today is the 30th or 31st, next cutoff is the 15th of next month
 * - Returns an array of upcoming cutoff dates
 */

export function getNextCutoffDate(from: Date = new Date()): Date {
  const day = from.getDate();
  const month = from.getMonth();
  const year = from.getFullYear();

  if (day < 15) {
    return new Date(year, month, 15);
  } else if (day < 30) {
    // Check if month has 30+ days
    const lastDay = new Date(year, month + 1, 0).getDate();
    if (lastDay >= 30) {
      return new Date(year, month, 30);
    } else {
      // February or month with <30 days — use last day or next month's 15
      return new Date(year, month + 1, 15);
    }
  } else {
    // day >= 30
    return new Date(year, month + 1, 15);
  }
}

export function getNextTwoCutoffDates(from: Date = new Date()): [Date, Date] {
  const first = getNextCutoffDate(from);
  const second = getNextCutoffDate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1));
  return [first, second];
}

export function getNextThreeCutoffDates(from: Date = new Date()): [Date, Date, Date] {
  const first = getNextCutoffDate(from);
  const second = getNextCutoffDate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1));
  const third = getNextCutoffDate(new Date(second.getFullYear(), second.getMonth(), second.getDate() + 1));
  return [first, second, third];
}

export function formatCutoffDate(d: Date): string {
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}
