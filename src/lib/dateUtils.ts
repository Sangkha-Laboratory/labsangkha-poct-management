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
    second: '2-digit'
  });

  return `${datePart} ${timePart} น.`;
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
 * Returns current timestamp in ISO format with Bangkok timezone consideration.
 */
export const getCurrentIsoTimestamp = (): string => {
  return new Date().toISOString();
};
