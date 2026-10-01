/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a date string (ISO or YYYY-MM-DD or full timestamp) to Thai locale with Date and Time.
 * Example: "30/08/2569 14:30 น."
 */
export const formatToThaiDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

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

  // If the date string was just YYYY-MM-DD (e.g. from a date input without time)
  if (dateString.length === 10 && dateString.includes('-')) {
    return datePart;
  }

  return `${datePart} ${timePart} น.`;
};

/**
 * Explicitly formats Date and Time with seconds in Thai Buddhist era.
 */
export const formatThaiDateTime = (dateString?: string): string => {
  if (!dateString) return '-';

  // If dateString is only a date (e.g. "2026-10-01" without time component)
  if (dateString.length === 10 && !dateString.includes('T') && dateString.includes('-')) {
    return formatThaiDateOnly(dateString);
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

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
 * Converts a Thailand local datetime string (e.g. "2026-10-01T14:30" or Date object)
 * into a full ISO string with proper +07:00 Bangkok offset so it never shifts time or defaults to 07:00:00.
 */
export const toThaiIsoString = (thaiDateTimeStr?: string): string => {
  if (!thaiDateTimeStr) return new Date().toISOString();
  // If already contains timezone (+ or Z)
  if (thaiDateTimeStr.endsWith('Z') || thaiDateTimeStr.includes('+')) {
    const d = new Date(thaiDateTimeStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  // If format is YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  if (thaiDateTimeStr.includes('T')) {
    const parts = thaiDateTimeStr.split('T');
    const timePart = parts[1];
    const normalizedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
    const withOffset = `${parts[0]}T${normalizedTime}+07:00`;
    const d = new Date(withOffset);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  // If only date YYYY-MM-DD, attach current Bangkok time
  if (thaiDateTimeStr.length === 10 && thaiDateTimeStr.includes('-')) {
    const nowBangkok = getThaiNowDateTimeInput();
    const timePart = nowBangkok.split('T')[1] || '08:00';
    const withOffset = `${thaiDateTimeStr}T${timePart}:00+07:00`;
    const d = new Date(withOffset);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const d = new Date(thaiDateTimeStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/**
 * Formats Date only in Thai Buddhist era (e.g. "30/08/2569").
 */
export const formatThaiDateOnly = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
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
 * Returns current timestamp in ISO format with Bangkok timezone consideration.
 */
export const getCurrentIsoTimestamp = (): string => {
  return new Date().toISOString();
};
