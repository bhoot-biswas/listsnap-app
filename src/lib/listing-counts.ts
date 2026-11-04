/**
 * The shop's listing counts as the assistant reads them. `behind` overlaps the statuses and
 * `archived` is hidden from every other count, so they sit apart from `listingsByStatus`:
 * a model adding those numbers up gets the total the seller sees on Listings.
 */
export function listingCounts(counts: Partial<Record<string, number>>) {
  const { behind = 0, archived = 0, ...listingsByStatus } = counts;
  return {
    totalListings: Object.values(listingsByStatus).reduce<number>((sum, n) => sum + (n ?? 0), 0),
    listingsByStatus,
    storeDraftsOutOfDate: behind,
    archivedListings: archived,
  };
}
