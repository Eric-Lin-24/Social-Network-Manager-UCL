/**
 * Unit tests for src/renderer/utils.js
 *
 * Run with: npm test
 *
 * All functions are pure (no DOM, no network, no AppState) so they can be
 * tested in a plain Node / Jest environment.
 */

// ---------------------------------------------------------------------------
// Import helpers under test (exported for Node via module.exports at bottom
// of utils.js, or accessed after loading the file as a module).
// ---------------------------------------------------------------------------
const {
  formatFileSize,
  truncateText,
  escapeHtml,
  escapeAttr,
  pad2,
  localDateKey,
  dateToLocalISO,
  addDays,
  startOfDay,
  endOfDay,
  debounce,
  getRelativeTime,
  formatDate,
  formatTime,
} = require('../src/renderer/utils.js');


// ============================================================
// formatFileSize
// ============================================================
describe('formatFileSize', () => {
  test('zero bytes', () => expect(formatFileSize(0)).toBe('0 B'));
  test('null / falsy returns 0 B', () => expect(formatFileSize(null)).toBe('0 B'));
  test('byte range', () => expect(formatFileSize(512)).toBe('512 B'));
  test('kilobyte range', () => expect(formatFileSize(1024)).toBe('1 KB'));
  test('megabyte range', () => expect(formatFileSize(1048576)).toBe('1 MB'));
  test('gigabyte range', () => expect(formatFileSize(1073741824)).toBe('1 GB'));
  test('1.5 KB', () => expect(formatFileSize(1536)).toBe('1.5 KB'));
});


// ============================================================
// truncateText
// ============================================================
describe('truncateText', () => {
  test('short text is unchanged', () => expect(truncateText('hi', 50)).toBe('hi'));
  test('null returns empty string', () => expect(truncateText(null)).toBe(''));
  test('text at exact limit is unchanged', () => {
    const text = 'a'.repeat(50);
    expect(truncateText(text, 50)).toBe(text);
  });
  test('text over limit is truncated with ellipsis', () => {
    const result = truncateText('a'.repeat(60), 50);
    expect(result).toBe('a'.repeat(50) + '...');
    expect(result).toHaveLength(53);
  });
  test('custom maxLength', () => {
    expect(truncateText('Hello World', 5)).toBe('Hello...');
  });
});


// ============================================================
// escapeHtml
// ============================================================
describe('escapeHtml', () => {
  test('empty / falsy returns empty string', () => expect(escapeHtml('')).toBe(''));
  test('null returns empty string', () => expect(escapeHtml(null)).toBe(''));
  test('ampersand escaped', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  test('less-than escaped', () => expect(escapeHtml('<div>')).toBe('&lt;div&gt;'));
  test('greater-than escaped', () => expect(escapeHtml('1 > 0')).toBe('1 &gt; 0'));
  test('double quote escaped', () => expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;'));
  test('single quote escaped', () => expect(escapeHtml("it's")).toBe("it&#39;s"));
  test('XSS payload escaped', () => {
    const xss = '<script>alert("xss")</script>';
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });
  test('plain text is unchanged', () => expect(escapeHtml('Hello World')).toBe('Hello World'));
});


// ============================================================
// escapeAttr
// ============================================================
describe('escapeAttr', () => {
  test('null returns empty string', () => expect(escapeAttr(null)).toBe(''));
  test('backslash is escaped', () => expect(escapeAttr('a\\b')).toBe('a\\\\b'));
  test("single quote is escaped", () => expect(escapeAttr("it's")).toBe("it\\'s"));
  test('plain text unchanged', () => expect(escapeAttr('hello')).toBe('hello'));
});


// ============================================================
// pad2
// ============================================================
describe('pad2', () => {
  test('single digit gets leading zero', () => expect(pad2(5)).toBe('05'));
  test('double digit unchanged', () => expect(pad2(12)).toBe('12'));
  test('zero pads to 00', () => expect(pad2(0)).toBe('00'));
  test('triple digit is not truncated', () => expect(pad2(100)).toBe('100'));
});


// ============================================================
// localDateKey
// ============================================================
describe('localDateKey', () => {
  test('returns YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 2, 17); // March 17 2026 (months are 0-indexed)
    expect(localDateKey(d)).toBe('2026-03-17');
  });

  test('single-digit month and day are zero-padded', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(localDateKey(d)).toBe('2026-01-05');
  });
});


// ============================================================
// dateToLocalISO
// ============================================================
describe('dateToLocalISO', () => {
  test('returns YYYY-MM-DD string', () => {
    const d = new Date(2026, 11, 31); // Dec 31
    expect(dateToLocalISO(d)).toBe('2026-12-31');
  });
});


// ============================================================
// addDays
// ============================================================
describe('addDays', () => {
  test('adds positive days', () => {
    const base = new Date(2026, 2, 17); // Mar 17
    const result = addDays(base, 5);
    expect(result.getDate()).toBe(22);
  });

  test('adds negative days (subtracts)', () => {
    const base = new Date(2026, 2, 17);
    const result = addDays(base, -7);
    expect(result.getDate()).toBe(10);
  });

  test('does not mutate original date', () => {
    const base = new Date(2026, 2, 17);
    addDays(base, 10);
    expect(base.getDate()).toBe(17);
  });

  test('crosses month boundary', () => {
    const base = new Date(2026, 0, 30); // Jan 30
    const result = addDays(base, 5);   // Feb 4
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(4);
  });
});


// ============================================================
// startOfDay / endOfDay
// ============================================================
describe('startOfDay', () => {
  test('sets time to midnight', () => {
    const d = new Date(2026, 2, 17, 15, 30, 45);
    const s = startOfDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getMilliseconds()).toBe(0);
  });

  test('does not mutate original', () => {
    const d = new Date(2026, 2, 17, 15, 30);
    startOfDay(d);
    expect(d.getHours()).toBe(15);
  });
});

describe('endOfDay', () => {
  test('sets time to 23:59:59.999', () => {
    const d = new Date(2026, 2, 17, 8, 0, 0);
    const e = endOfDay(d);
    expect(e.getHours()).toBe(23);
    expect(e.getMinutes()).toBe(59);
    expect(e.getSeconds()).toBe(59);
    expect(e.getMilliseconds()).toBe(999);
  });
});


// ============================================================
// debounce
// ============================================================
describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('function is not called immediately', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  test('function is called after wait period', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);
    debounced();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('rapid calls result in only one invocation', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);
    debounced();
    debounced();
    debounced();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('passes arguments to the wrapped function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    debounced('a', 42);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('a', 42);
  });
});


// ============================================================
// getRelativeTime
// ============================================================
describe('getRelativeTime', () => {
  test('null / empty returns empty string', () => {
    expect(getRelativeTime(null)).toBe('');
    expect(getRelativeTime('')).toBe('');
  });

  test('less than 60 seconds ago → Just now', () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    expect(getRelativeTime(recent)).toBe('Just now');
  });

  test('about 2 minutes ago', () => {
    const twoMinsAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    expect(getRelativeTime(twoMinsAgo)).toBe('2 mins ago');
  });

  test('about 1 minute ago (singular)', () => {
    const oneMinAgo = new Date(Date.now() - 65_000).toISOString();
    expect(getRelativeTime(oneMinAgo)).toBe('1 min ago');
  });

  test('about 3 hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(getRelativeTime(threeHoursAgo)).toBe('3 hours ago');
  });

  test('about 1 hour ago (singular)', () => {
    const oneHourAgo = new Date(Date.now() - 3_660_000).toISOString();
    expect(getRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  test('about 2 days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(getRelativeTime(twoDaysAgo)).toBe('2 days ago');
  });

  test('more than 7 days ago falls back to formatted date', () => {
    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const result = getRelativeTime(oldDate);
    // Should return a formatted date string, not a relative expression
    expect(result).not.toContain('ago');
    expect(result.length).toBeGreaterThan(4);
  });
});


// ============================================================
// formatDate / formatTime (smoke tests — locale-dependent output)
// ============================================================
describe('formatDate', () => {
  test('null/falsy returns "Unknown"', () => expect(formatDate(null)).toBe('Unknown'));
  test('returns non-empty string for valid ISO date', () => {
    const result = formatDate('2026-03-17T12:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('Unknown');
  });
});

describe('formatTime', () => {
  test('null/falsy returns empty string', () => expect(formatTime(null)).toBe(''));
  test('returns non-empty string for valid date', () => {
    const result = formatTime('2026-03-17T14:30:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
