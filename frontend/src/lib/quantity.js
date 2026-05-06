/** @param {string} raw */
export function parsePositiveWhole(raw) {
  const x = parseInt(String(raw).trim(), 10)
  if (Number.isNaN(x) || x < 1) return null
  return x
}
