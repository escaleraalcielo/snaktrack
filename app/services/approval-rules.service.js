import { identityCopy } from "../config/identity.config.js";

// Revised Snack Policy (Interoffice Memorandum, effective immediately).
// The three memo rules below are the ONLY approval logic in this file.
// Dollar amounts are named here rather than buried in the function so the
// policy is easy to change and to test.
export const SNACK_POLICY = Object.freeze({
  // "A snack may cost up to five dollars."
  standardLimitUsd: 5,
  // "On the third Thursday of the month ... your limit rises to $7.50,
  //  provided your request includes a short note."
  gratitudeLimitUsd: 7.5,
  // "Each person may have one approved snack per week."
  approvedSnacksPerWeek: 1,
});

/**
 * Decide whether a snack request may be approved under the revised memo.
 *
 * The evaluation date is injected (`asOfDate`) rather than read from the clock,
 * so the rule can be pointed at any day — including Gratitude Alignment Day —
 * without waiting for the calendar. It defaults to the request's own filing
 * date when not supplied.
 *
 * @param {object} request                 The request under review.
 * @param {object} [options]
 * @param {string} [options.asOfDate]       "YYYY-MM-DD" the policy is evaluated as of.
 * @param {object[]} [options.priorRequests] All known requests, used to enforce
 *                                           the one-approved-snack-per-week rule.
 * @returns {{ ok: boolean, status: string, message: string, code?: string, limit?: number }}
 */
export function approveSnackRequest(request, options = {}) {
  if (!request) {
    return {
      ok: false,
      code: "request-not-found",
      status: "pending",
      message: identityCopy.notices.notFound,
    };
  }

  const asOfDate = options.asOfDate || request.requestedAt;
  const priorRequests = options.priorRequests || [];

  // Rule 2 — "Each person may have one approved snack per week."
  const approvedThisWeek = priorRequests.filter(
    (other) =>
      other.id !== request.id &&
      other.requester === request.requester &&
      other.status === "approved" &&
      isSameWeek(other.requestedAt, asOfDate),
  ).length;

  if (approvedThisWeek >= SNACK_POLICY.approvedSnacksPerWeek) {
    return {
      ok: false,
      code: "weekly-limit-reached",
      status: "pending",
      message: identityCopy.notices.weeklyLimit(request),
    };
  }

  // Rules 1 & 3 — the standard $5 ceiling, raised to $7.50 only on Gratitude
  // Alignment Day and only when the request carries a note.
  const limit = getSnackLimit(asOfDate, request);
  const cost = Number(request.itemCost || 0);

  if (cost > limit) {
    return {
      ok: false,
      code: "over-snack-limit",
      status: "pending",
      message: identityCopy.notices.overLimit(request, limit),
      limit,
    };
  }

  return {
    ok: true,
    status: "approved",
    message: identityCopy.notices.success(request),
    limit,
  };
}

/**
 * The dollar limit that applies to a request on a given date. $7.50 only on
 * Gratitude Alignment Day and only when a note is present; otherwise $5.
 */
export function getSnackLimit(asOfDate, request) {
  if (isGratitudeAlignmentDay(asOfDate) && hasGratitudeNote(request)) {
    return SNACK_POLICY.gratitudeLimitUsd;
  }

  return SNACK_POLICY.standardLimitUsd;
}

/**
 * Gratitude Alignment Day is the third Thursday of the month — computed, not
 * hardcoded, since it moves every month. The Nth Thursday's date always falls
 * in a fixed 7-day band: the 1st on days 1–7, the 2nd on 8–14, the 3rd on
 * 15–21. So a Thursday whose day-of-month is 15–21 is the third Thursday.
 */
export function isGratitudeAlignmentDay(dateString) {
  const date = parseDateOnly(dateString);
  const THURSDAY = 4; // 0 = Sunday ... 4 = Thursday
  const dayOfMonth = date.getUTCDate();

  return date.getUTCDay() === THURSDAY && dayOfMonth >= 15 && dayOfMonth <= 21;
}

function hasGratitudeNote(request) {
  return typeof request.notes === "string" && request.notes.trim().length > 0;
}

// "Week" is the ISO week (Monday–Sunday) containing the given date.
function isSameWeek(dateStringA, dateStringB) {
  return isoWeekStart(dateStringA) === isoWeekStart(dateStringB);
}

function isoWeekStart(dateString) {
  const date = parseDateOnly(dateString);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysSinceMonday);

  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  return new Date(`${value}T12:00:00Z`);
}
