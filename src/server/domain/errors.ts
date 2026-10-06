export type ErrorCode =
  | "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND"
  | "INVALID_TRANSITION" | "NOT_EDITABLE" | "BUDGET_EXCEEDED"
  | "MISSING_PROPOSAL" | "DEADLINE_PASSED" | "PAYMENT_EXCEEDS_BALANCE"
  | "INVALID_STATE" | "EMAIL_FAILED" | "CONFLICT";

const HTTP: Record<ErrorCode, number> = {
  VALIDATION: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  INVALID_TRANSITION: 409, NOT_EDITABLE: 409, INVALID_STATE: 409, CONFLICT: 409,
  BUDGET_EXCEEDED: 422, MISSING_PROPOSAL: 422, DEADLINE_PASSED: 422,
  PAYMENT_EXCEEDS_BALANCE: 422, EMAIL_FAILED: 502,
};

export class DomainError extends Error {
  status: number;
  constructor(public code: ErrorCode, message: string, public details?: unknown) {
    super(message);
    this.status = HTTP[code];
  }
}
