const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_YEAR = new Date().getFullYear();
const SINGAPORE_TZ = 'Asia/Singapore';

function parseOccurredAt(value) {
  const text = String(value || '').trim();
  if (!text) {
    return new Date();
  }

  if (text.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(text)) {
    return new Date(text);
  }

  return new Date(`${text}+08:00`);
}

function nowSingaporeIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

function parsePeriod(month, year) {
  const parsedMonth = month ? parseInt(month, 10) : CURRENT_MONTH;
  const parsedYear = year ? parseInt(year, 10) : CURRENT_YEAR;

  if (Number.isNaN(parsedMonth) || Number.isNaN(parsedYear)) {
    return { month: CURRENT_MONTH, year: CURRENT_YEAR };
  }

  return { month: parsedMonth, year: parsedYear };
}

function monthLabel(month, year) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-SG', {
    month: 'long',
    year: 'numeric',
  });
}

function shortMonth(month) {
  return new Date(2026, month - 1, 1).toLocaleDateString('en-SG', { month: 'short' });
}

function previousMonthLabel(month, year) {
  const date = new Date(year, month - 2, 1);
  return date.toLocaleDateString('en-SG', { month: 'short' });
}

function filterByMonth(transactions, month, year) {
  return transactions.filter((row) => {
    const date = parseOccurredAt(row.occurred_at);
    return date.getMonth() + 1 === month && date.getFullYear() === year;
  });
}

function formatDayShort(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function weekRange(referenceDate = new Date()) {
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function filterByCurrentWeek(transactions, referenceDate = new Date()) {
  const { start, end } = weekRange(referenceDate);

  return transactions.filter((row) => {
    const date = parseOccurredAt(row.occurred_at);
    return date >= start && date <= end;
  });
}

function filterByPreviousWeek(transactions, referenceDate = new Date()) {
  const currentStart = new Date(referenceDate);
  currentStart.setDate(currentStart.getDate() - 6);
  currentStart.setHours(0, 0, 0, 0);

  const previousEnd = new Date(currentStart);
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 6);
  previousStart.setHours(0, 0, 0, 0);

  return transactions.filter((row) => {
    const date = parseOccurredAt(row.occurred_at);
    return date >= previousStart && date <= previousEnd;
  });
}

function weekLabel(referenceDate = new Date()) {
  const { start, end } = weekRange(referenceDate);
  return `${formatDayShort(start)}–${formatDayShort(end)}`;
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function parseReceiptDate(dateStr) {
  const text = String(dateStr || '').trim().replace(/\s{2,}/g, ' ');
  const match = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthKey = match[2].toLowerCase().slice(0, 3);
    const year = parseInt(match[3], 10);
    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const month = months[monthKey];
    if (month) {
      const pad = (value) => String(value).padStart(2, '0');
      const hour = match[4] !== undefined ? parseInt(match[4], 10) : 12;
      const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0;
      return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return `${text.slice(0, 10)}T12:00:00`;
  }

  const fallback = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, new Date().getDate(), 12, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}T12:00:00`;
}

function listAvailablePeriods(transactions) {
  const keys = new Set();
  transactions.forEach((row) => {
    const date = parseOccurredAt(row.occurred_at);
    keys.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
  });

  keys.add(`${CURRENT_YEAR}-${CURRENT_MONTH}`);

  return Array.from(keys)
    .map((key) => {
      const [year, month] = key.split('-').map(Number);
      return { month, year, label: monthLabel(month, year) };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

function shiftMonth(month, year, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

module.exports = {
  CURRENT_MONTH,
  CURRENT_YEAR,
  SINGAPORE_TZ,
  parseOccurredAt,
  nowSingaporeIso,
  parsePeriod,
  monthLabel,
  shortMonth,
  previousMonthLabel,
  filterByMonth,
  filterByCurrentWeek,
  filterByPreviousWeek,
  weekLabel,
  daysInMonth,
  parseReceiptDate,
  listAvailablePeriods,
  shiftMonth,
  formatDayShort,
  weekRange,
};
