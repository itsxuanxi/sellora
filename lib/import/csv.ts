/**
 * CSV reading shared by every importer.
 *
 * Lifted out of the signal importer when deal import arrived, because two
 * copies of a line splitter is two places for the same quoted-comma bug to be
 * fixed once. Pure, so the parsing rules are testable without a file upload.
 */

/** Splits one line, honouring quoted fields and doubled quotes inside them. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Splits a file into lines.
 *
 * Handles CRLF, a UTF-8 BOM and a trailing newline — the three things an
 * export from Excel reliably contains and that otherwise show up as a
 * mysterious failure on row 1 or a phantom empty row at the end.
 */
export function csvLines(text: string): string[] {
  return text
    .replace(/^﻿/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "");
}

export interface RowError {
  /** 1-based line number in the file as the user sees it, header included. */
  row: number;
  column?: string;
  message: string;
}

/**
 * Resolves a header row against a set of known columns and their aliases.
 *
 * Agencies export from HubSpot, Pipedrive, a spreadsheet someone maintains by
 * hand, or all three, and the column is called `Deal Name`, `dealname` or
 * `Opportunity`. Refusing anything but one exact spelling turns a two-minute
 * import into a support conversation, so aliases are matched case- and
 * punctuation-insensitively.
 */
export function mapHeaders(
  header: string[],
  aliases: Record<string, readonly string[]>
): Record<string, number> {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, "");
  const seen = header.map(normalize);
  const out: Record<string, number> = {};

  for (const [field, names] of Object.entries(aliases)) {
    for (const name of names) {
      const index = seen.indexOf(normalize(name));
      if (index !== -1) {
        out[field] = index;
        break;
      }
    }
  }
  return out;
}
