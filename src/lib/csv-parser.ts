/**
 * Simple CSV parser that handles quoted fields with commas
 */

export interface CsvParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Sanitize a CSV cell value to prevent formula injection.
 * Strips leading characters that spreadsheet apps interpret as formulas.
 */
function sanitizeCsvValue(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Parse CSV text into structured rows
 */
export function parseCsv(text: string): CsvParseResult {
  // Limit total input size to 5MB to prevent DoS
  if (text.length > 5 * 1024 * 1024) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 1) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
  );

  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      const raw = values[index]?.trim() || "";
      row[header] = sanitizeCsvValue(raw);
    });

    // Skip completely empty rows
    if (Object.values(row).some((v) => v !== "")) {
      rows.push(row);
    }
  }

  return { headers, rows, totalRows: rows.length };
}

/**
 * Map common CSV column names to subscriber field names
 */
export const CSV_COLUMN_MAP: Record<string, string> = {
  name: "name",
  full_name: "name",
  subscriber_name: "name",
  customer_name: "name",
  phone: "phone",
  mobile: "phone",
  phone_number: "phone",
  mobile_number: "phone",
  email: "email",
  email_address: "email",
  username: "username",
  user_name: "username",
  user: "username",
  password: "password",
  pass: "password",
  connection_type: "connectionType",
  connection: "connectionType",
  type: "connectionType",
  subscriber_type: "subscriberType",
  mac_address: "macAddress",
  mac: "macAddress",
  static_ip: "staticIp",
  ip: "staticIp",
  ip_address: "staticIp",
  address: "address",
  plan: "planId",
  plan_name: "planId",
  plan_id: "planId",
  status: "status",
  notes: "notes",
  alternate_phone: "alternatePhone",
  alt_phone: "alternatePhone",
  expiry_date: "expiryDate",
  expiry: "expiryDate",
  installation_date: "installationDate",
};

/**
 * Auto-detect column mappings from CSV headers
 */
export function autoDetectColumnMapping(
  csvHeaders: string[]
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (CSV_COLUMN_MAP[normalized]) {
      mapping[header] = CSV_COLUMN_MAP[normalized];
    }
  }

  return mapping;
}
