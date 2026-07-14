const GBP_FORMAT = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

/** Format a number as GBP (e.g. £12.50). Returns em dash for invalid values. */
export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return GBP_FORMAT.format(Number(n))
}
