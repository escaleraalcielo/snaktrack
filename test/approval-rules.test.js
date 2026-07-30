import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  approveSnackRequest,
  getSnackLimit,
  isGratitudeAlignmentDay,
  SNACK_POLICY,
} from "../app/services/approval-rules.service.js";

// A non-Gratitude weekday used as the default "any ordinary day".
const ORDINARY_DAY = "2026-05-19"; // Tuesday, not a third Thursday

// Independent third-Thursday computation for the tests. It deliberately does NOT
// reuse the rule's own logic (which keys off the 15th–21st band): it walks the
// month day by day and returns the 3rd Thursday, so a drift in the rule's
// computation is actually caught instead of being confirmed by a shared bug.
// Named for the human idea so the Gratitude tests document themselves and keep
// working as the calendar moves.
function thirdThursday(year, monthIndex) {
  const THURSDAY = 4; // 0 = Sunday ... 4 = Thursday
  let thursdays = 0;

  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));

    if (date.getUTCMonth() !== monthIndex) break; // rolled into next month

    if (date.getUTCDay() === THURSDAY) {
      thursdays += 1;
      if (thursdays === 3) return date.toISOString().slice(0, 10);
    }
  }

  throw new Error(`No third Thursday found for ${year}-${monthIndex + 1}`);
}

function makeRequest(overrides = {}) {
  return {
    id: "REQ-TEST",
    requester: "Pat",
    department: "Testing",
    snack: "Test snack",
    itemCost: 4,
    status: "pending",
    requestedAt: ORDINARY_DAY,
    notes: "",
    ...overrides,
  };
}

const money = (value) => `$${value.toFixed(2)}`;

describe("the $5 snack cap", () => {
  it(`rejects a snack priced above the ${money(SNACK_POLICY.standardLimitUsd)} limit`, () => {
    const overCap = SNACK_POLICY.standardLimitUsd + 1; // $6
    const request = makeRequest({ itemCost: overCap });

    const result = approveSnackRequest(request, { asOfDate: ORDINARY_DAY });

    assert.equal(
      result.ok,
      false,
      `A ${money(overCap)} snack is over the ${money(SNACK_POLICY.standardLimitUsd)} cap and must be rejected, but it was approved.`,
    );
  });

  it(`approves a snack priced exactly at the ${money(SNACK_POLICY.standardLimitUsd)} limit`, () => {
    const request = makeRequest({ itemCost: SNACK_POLICY.standardLimitUsd });

    const result = approveSnackRequest(request, { asOfDate: ORDINARY_DAY });

    assert.equal(
      result.ok,
      true,
      `A snack priced exactly at the ${money(SNACK_POLICY.standardLimitUsd)} cap should be approved, but it was rejected.`,
    );
  });
});

describe("Gratitude Alignment Day is the computed third Thursday", () => {
  // Span the full band the 3rd Thursday can land on (the 15th through the 21st),
  // plus a future year, so the test never rots as the calendar moves.
  const months = [
    { year: 2026, monthIndex: 0 }, // Jan 2026 -> 3rd Thu is the 15th (earliest possible)
    { year: 2026, monthIndex: 1 }, // Feb 2026
    { year: 2026, monthIndex: 4 }, // May 2026 -> 3rd Thu is the 21st (latest possible)
    { year: 2026, monthIndex: 6 }, // Jul 2026
    { year: 2027, monthIndex: 10 }, // Nov 2027 (future-proofing)
  ];

  for (const { year, monthIndex } of months) {
    const gad = thirdThursday(year, monthIndex);

    it(`treats ${gad} as Gratitude Alignment Day`, () => {
      assert.equal(
        isGratitudeAlignmentDay(gad),
        true,
        `${gad} is the third Thursday of ${year}-${monthIndex + 1} and should be Gratitude Alignment Day, but the rule said it was not.`,
      );
    });

    it(`treats the surrounding Thursdays in ${year}-${monthIndex + 1} as ordinary days`, () => {
      const secondThursday = shiftDays(gad, -7);
      const fourthThursday = shiftDays(gad, 7);

      assert.equal(
        isGratitudeAlignmentDay(secondThursday),
        false,
        `${secondThursday} is the second Thursday and must NOT be Gratitude Alignment Day.`,
      );
      assert.equal(
        isGratitudeAlignmentDay(fourthThursday),
        false,
        `${fourthThursday} is the fourth Thursday and must NOT be Gratitude Alignment Day.`,
      );
    });

    it(`does not treat the day before or after ${gad} as Gratitude Alignment Day`, () => {
      assert.equal(isGratitudeAlignmentDay(shiftDays(gad, -1)), false);
      assert.equal(isGratitudeAlignmentDay(shiftDays(gad, 1)), false);
    });
  }
});

describe("the Gratitude Alignment Day uplift is a full conjunction", () => {
  const GAD = thirdThursday(2026, 4); // 2026-05-21
  const upliftPrice = 7; // within the $7.50 uplift but above the ordinary $5 cap
  const realNote = "I love how my teammates jump in to help each other.";

  it("approves only when the day, the price, AND a real note all line up", () => {
    const result = approveSnackRequest(
      makeRequest({ itemCost: upliftPrice, notes: realNote, requestedAt: GAD }),
      { asOfDate: GAD },
    );

    assert.equal(
      result.ok,
      true,
      `On Gratitude Alignment Day a ${money(upliftPrice)} snack with a genuine note should be approved under the ${money(SNACK_POLICY.gratitudeLimitUsd)} uplift, but it was rejected.`,
    );
  });

  it("rejects the same request on any other day (wrong day breaks the gate)", () => {
    const result = approveSnackRequest(
      makeRequest({ itemCost: upliftPrice, notes: realNote, requestedAt: ORDINARY_DAY }),
      { asOfDate: ORDINARY_DAY },
    );

    assert.equal(
      result.ok,
      false,
      `A ${money(upliftPrice)} snack is over the ordinary ${money(SNACK_POLICY.standardLimitUsd)} cap on a non-Gratitude day and must be rejected, note or not.`,
    );
  });

  it(`rejects a price above the ${money(SNACK_POLICY.gratitudeLimitUsd)} uplift even on Gratitude Alignment Day (price breaks the gate)`, () => {
    const overUplift = SNACK_POLICY.gratitudeLimitUsd + 0.5; // $8.00
    const result = approveSnackRequest(
      makeRequest({ itemCost: overUplift, notes: realNote, requestedAt: GAD }),
      { asOfDate: GAD },
    );

    assert.equal(
      result.ok,
      false,
      `${money(overUplift)} is above even the ${money(SNACK_POLICY.gratitudeLimitUsd)} Gratitude uplift and must be rejected.`,
    );
  });

  it("rejects the uplift price when the note is missing (no note breaks the gate)", () => {
    const result = approveSnackRequest(
      makeRequest({ itemCost: upliftPrice, notes: "", requestedAt: GAD }),
      { asOfDate: GAD },
    );

    assert.equal(
      result.ok,
      false,
      `Without a note the limit stays at ${money(SNACK_POLICY.standardLimitUsd)}, so a ${money(upliftPrice)} snack must be rejected even on Gratitude Alignment Day.`,
    );
  });

  it("rejects the uplift price when the note is only whitespace (note must actually exist)", () => {
    // This suite protects the note check that was actually built: a note must be
    // present and non-blank. It intentionally does NOT assert note *plausibility*,
    // because that gate was never implemented.
    const result = approveSnackRequest(
      makeRequest({ itemCost: upliftPrice, notes: "   \n  ", requestedAt: GAD }),
      { asOfDate: GAD },
    );

    assert.equal(
      result.ok,
      false,
      `A blank note should not unlock the ${money(SNACK_POLICY.gratitudeLimitUsd)} uplift, but the ${money(upliftPrice)} snack was approved.`,
    );
  });

  it(`reports the ${money(SNACK_POLICY.gratitudeLimitUsd)} limit via getSnackLimit only with the day and a note`, () => {
    assert.equal(getSnackLimit(GAD, { notes: realNote }), SNACK_POLICY.gratitudeLimitUsd);
    assert.equal(getSnackLimit(GAD, { notes: "" }), SNACK_POLICY.standardLimitUsd);
    assert.equal(getSnackLimit(ORDINARY_DAY, { notes: realNote }), SNACK_POLICY.standardLimitUsd);
  });
});

describe("one approved snack per person per week", () => {
  const priorApproved = (requestedAt) => ({
    id: "REQ-PRIOR",
    requester: "Pat",
    itemCost: 4,
    status: "approved",
    requestedAt,
  });

  it("rejects a second snack in the same week for the same person", () => {
    const request = makeRequest({ itemCost: 4, requestedAt: ORDINARY_DAY });
    const result = approveSnackRequest(request, {
      asOfDate: ORDINARY_DAY,
      priorRequests: [priorApproved("2026-05-18")], // same ISO week (Mon) as ORDINARY_DAY (Tue)
    });

    assert.equal(
      result.ok,
      false,
      "Pat already has an approved snack this week, so a second one must be rejected.",
    );
  });

  it("allows a snack when the person's prior approval was in a different week", () => {
    const request = makeRequest({ itemCost: 4, requestedAt: ORDINARY_DAY });
    const result = approveSnackRequest(request, {
      asOfDate: ORDINARY_DAY,
      priorRequests: [priorApproved("2026-05-11")], // previous ISO week
    });

    assert.equal(result.ok, true, "A snack in a fresh week should be approved.");
  });

  it("does not count another person's approval against this requester", () => {
    const request = makeRequest({ itemCost: 4, requestedAt: ORDINARY_DAY });
    const result = approveSnackRequest(request, {
      asOfDate: ORDINARY_DAY,
      priorRequests: [{ ...priorApproved("2026-05-18"), requester: "Sam" }],
    });

    assert.equal(result.ok, true, "Sam's approved snack must not block Pat's request.");
  });
});

// Shift an ISO date string by a number of days, staying in UTC.
function shiftDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
