import { describe, expect, it } from "vitest";
import { listingCounts } from "./listing-counts";

describe("listingCounts", () => {
  // one in_store listing that is also behind was added up as two
  it("keeps out-of-date drafts and archived listings out of the total", () => {
    expect(listingCounts({ needs_review: 2, ready: 1, in_store: 1, behind: 1, archived: 3 })).toEqual({
      totalListings: 4,
      listingsByStatus: { needs_review: 2, ready: 1, in_store: 1 },
      storeDraftsOutOfDate: 1,
      archivedListings: 3,
    });
  });

  it("reads an empty shop as zero", () => {
    expect(listingCounts({})).toEqual({
      totalListings: 0,
      listingsByStatus: {},
      storeDraftsOutOfDate: 0,
      archivedListings: 0,
    });
  });
});
