import { parse } from "csv-parse/sync";
import { REQUIRED_COLUMNS, type Column } from "./types.js";

/** The file as a whole is unusable (not a CSV, empty, wrong columns). Maps to HTTP 400. */
export class CsvFormatError extends Error {
  override name = "CsvFormatError";
}

export interface ParsedRow {
  line: number;
  raw: string;
  values: string[];
}

export interface ParsedCsv {
  /** Position of each required column in a row. */
  columnIndex: Record<Column, number>;
  headerLength: number;
  rows: ParsedRow[];
}

// csv-parse's typings don't model `info` + `raw`, which wrap each record like this.
type RecordWithInfo = { record: string[]; info: { lines: number }; raw: string };

export function parseCsv(text: string): ParsedCsv {
  // A CSV is text; NUL bytes mean someone uploaded a binary file (zip, xlsx, image...).
  if (text.includes("\0")) {
    throw new CsvFormatError("File looks binary (contains NUL bytes), not a CSV");
  }

  let records: RecordWithInfo[];
  try {
    records = parse(text, {
      bom: true, // Excel adds a UTF-8 BOM that would otherwise stick to the first header name
      skip_empty_lines: true,
      relax_column_count: true, // don't abort the whole file; short/long rows are rejected one by one below
      trim: true,
      info: true, // gives us source line numbers for the rejected-rows report
      raw: true,
    }) as unknown as RecordWithInfo[];
  } catch (err) {
    throw new CsvFormatError(`Could not parse CSV: ${(err as Error).message}`);
  }

  const [headerRecord, ...body] = records;
  if (!headerRecord) throw new CsvFormatError("File is empty");

  const header = headerRecord.record.map((name) => name.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new CsvFormatError(`Missing required column(s): ${missing.join(", ")}`);
  }

  const columnIndex = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<Column, number>;

  return {
    columnIndex,
    headerLength: header.length,
    rows: body.map(({ record, info, raw }) => ({ line: info.lines, raw: raw.trim(), values: record })),
  };
}
