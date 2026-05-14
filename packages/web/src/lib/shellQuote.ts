/**
 * POSIX shell single-quote escape.
 * 'foo'bar' -> "'foo'\''bar'"
 * Always returns a string wrapped in single quotes (so the empty string becomes "''").
 */
export function shellQuote(input: string): string {
  return `'${input.replace(/'/g, "'\\''")}'`;
}
