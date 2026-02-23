const BASE_URL =
  process.env.NEXT_PUBLIC_FIX_API_URL ?? "http://localhost:8081";

// ── Request types ─────────────────────────────────────────────────────────────

export interface SendRequest {
  msg_type: string;
  fields: Record<string, string>;
}

export interface ParseRequest {
  raw_message: string;
}

export interface ValidateRequest {
  message: Record<string, string>;
  version: string;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface SentMessage {
  session_id: string;
  msg_type: string;
  sequence_number: number;
  fix_message: string;
  fields: Record<string, string>;
  sent_at_ms: number;
}

export interface ParsedField {
  tag: number;
  name: string;
  value: string;
}

export interface ParseResponse {
  msg_type: string;
  fields: ParsedField[];
  field_count: number;
  raw_length: number;
}

export interface FixSession {
  session_id: string;
  sender_comp_id: string;
  target_comp_id: string;
  fix_version: string;
  state: string;
  msg_seq_num: number;
  connected_at: number;
}

export interface SessionsResponse {
  sessions: FixSession[];
  count: number;
}

export interface ValidationError {
  field: string;
  tag: number;
  message: string;
}

export interface ValidateResponse {
  valid: boolean;
  version: string;
  msg_type: string;
  errors: ValidationError[];
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  return res.json() as Promise<T>;
}

// ── FixClient ─────────────────────────────────────────────────────────────────

export const fixClient = {
  /**
   * Send a FIX message. Returns the sent message with assigned sequence number.
   */
  async send(req: SendRequest): Promise<SentMessage> {
    return request<SentMessage>("POST", "/api/v1/fix/send", req);
  },

  /**
   * Parse a raw FIX wire message into structured fields.
   */
  async parse(req: ParseRequest): Promise<ParseResponse> {
    return request<ParseResponse>("POST", "/api/v1/fix/parse", req);
  },

  /**
   * Retrieve all active FIX sessions with their current state.
   */
  async sessions(): Promise<SessionsResponse> {
    return request<SessionsResponse>("GET", "/api/v1/fix/sessions");
  },

  /**
   * Validate a FIX message map against required field rules for the given version.
   */
  async validate(req: ValidateRequest): Promise<ValidateResponse> {
    return request<ValidateResponse>("POST", "/api/v1/fix/validate", req);
  },
};
