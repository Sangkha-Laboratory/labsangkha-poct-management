/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns current date string for HTML date input (YYYY-MM-DD) in Thailand Timezone.
 */
export const getThaiTodayDateOnly = (): string => {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day}`;
};

/**
 * Returns current date and time formatted for HTML datetime-local input (YYYY-MM-DDTHH:mm) in Thailand Timezone.
 */
export const getThaiNowDateTimeInput = (): string => {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
};

/**
 * Formats Date only in Thai Buddhist era (e.g. "30/08/2569").
 */
export const formatThaiDateOnly = (dateString?: string): string => {
  if (!dateString) return '-';
  const cleanStr = String(dateString).trim();

  // If it's a simple YYYY-MM-DD string, parse directly to avoid any browser timezone shift
  if (cleanStr.length === 10 && cleanStr.includes('-') && !cleanStr.includes('T')) {
    const [yearStr, monthStr, dayStr] = cleanStr.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const d = parseInt(dayStr, 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const thaiYear = y + 543;
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      return `${dd}/${mm}/${thaiYear}`;
    }
  }

  const date = new Date(cleanStr);
  if (isNaN(date.getTime())) return cleanStr;

  return date.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Formats a date string (ISO or YYYY-MM-DD or full timestamp) to Thai locale with Date and Time.
 * Example: "30/08/2569 14:30 น."
 */
export const formatToThaiDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const cleanStr = String(dateString).trim();

  // If the date string was just YYYY-MM-DD (e.g. from a date input without time)
  if (cleanStr.length === 10 && cleanStr.includes('-') && !cleanStr.includes('T')) {
    return formatThaiDateOnly(cleanStr);
  }

  const date = new Date(cleanStr);
  if (isNaN(date.getTime())) return cleanStr;

  const datePart = date.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const timePart = date.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${datePart} ${timePart} น.`;
};

/**
 * Explicitly formats Date and Time with seconds in Thai Buddhist era.
 */
export const formatThaiDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const cleanStr = String(dateString).trim();

  // If dateString is only a date (e.g. "2026-10-01" without time component)
  if (cleanStr.length === 10 && !cleanStr.includes('T') && cleanStr.includes('-')) {
    return formatThaiDateOnly(cleanStr);
  }

  const date = new Date(cleanStr);
  if (isNaN(date.getTime())) return cleanStr;

  const datePart = date.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const timePart = date.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return `${datePart} ${timePart} น.`;
};

/**
 * Normalizes a Thailand local datetime or date string for storage without UTC date shift.
 * If only YYYY-MM-DD, returns the exact YYYY-MM-DD string to preserve calendar day in PostgreSQL DATE columns.
 * If datetime YYYY-MM-DDTHH:mm, returns ISO string with explicit +07:00 offset.
 */
export const toThaiIsoString = (thaiDateTimeStr?: string): string => {
  if (!thaiDateTimeStr) {
    return getThaiTodayDateOnly();
  }
  const cleanStr = String(thaiDateTimeStr).trim();

  // If format is pure date YYYY-MM-DD, preserve it directly so DATE column won't shift to yesterday
  if (cleanStr.length === 10 && cleanStr.includes('-') && !cleanStr.includes('T')) {
    return cleanStr;
  }

  // If already contains timezone (+ or Z)
  if (cleanStr.includes('+') || cleanStr.endsWith('Z')) {
    return cleanStr;
  }

  // If format is YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  if (cleanStr.includes('T')) {
    const parts = cleanStr.split('T');
    const timePart = parts[1];
    const normalizedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
    return `${parts[0]}T${normalizedTime}+07:00`;
  }

  return cleanStr;
};

/**
 * Returns current timestamp in ISO format with Bangkok timezone offset (+07:00).
 */
export const getCurrentIsoTimestamp = (): string => {
  const now = getThaiNowDateTimeInput();
  const secs = String(new Date().getSeconds()).padStart(2, '0');
  return `${now}:${secs}+07:00`;
};
