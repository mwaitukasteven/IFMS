/**
 * MoneyInput
 *
 * A drop-in replacement for a money <input>. Shows thousands separators
 * (commas) as the user types — e.g. typing "10000000.50" turns into
 * "10,000,000.50" on screen — but reports the unformatted value back to
 * the parent's `onChange` so the form state stays clean. The backend
 * also accepts comma-separated input (CommaDecimalField), so even if a
 * comma slips through, the API will not reject it.
 *
 * Props:
 *   - value: string  (raw decimal, e.g. "10000000.50" or "")
 *   - onChange: (rawString) => void
 *   - ...rest: spread onto the underlying <input> (className, placeholder, required, etc.)
 *
 * We deliberately use type="text" with inputMode="decimal" instead of
 * type="number" because type="number" blocks commas at the browser level
 * — there is no way to show the user a formatted "10,000,000" inside one.
 */
import { useState, useEffect } from 'react'

/** Format a raw numeric string with commas in the integer part. */
function formatWithCommas(raw) {
  if (raw == null || raw === '') return ''
  // Split off a decimal portion if present so we only group the integer side.
  const [intPart, decPart] = String(raw).split('.')
  // Add a comma every 3 digits from the right of the integer part.
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped
}

/** Strip everything that isn't a digit or a decimal point. */
function stripFormatting(display) {
  // Remove commas, whitespace, and any other stray characters. Keep digits
  // and the first decimal point only — if the user pastes "1.2.3" we drop
  // the second dot rather than letting the form go invalid.
  let cleaned = String(display).replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    // Keep everything up to and including the first dot, then strip dots
    // out of the remainder.
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  return cleaned
}

export default function MoneyInput({ value, onChange, ...rest }) {
  // We keep a local display value so commas can be inserted as the user
  // types without round-tripping through the parent's state every key.
  const [display, setDisplay] = useState(() => formatWithCommas(value))

  // If the parent updates `value` externally (e.g. loading an existing
  // asset for edit), re-sync the display.
  useEffect(() => {
    setDisplay(formatWithCommas(value))
  }, [value])

  function handleChange(e) {
    const raw = stripFormatting(e.target.value)
    setDisplay(formatWithCommas(raw))
    // Hand the parent the unformatted decimal string so the JSON sent to
    // the backend stays a clean number ("10000000.50"). The backend would
    // also accept "10,000,000.50" thanks to CommaDecimalField — this is
    // just belt-and-braces.
    onChange(raw)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      {...rest}
    />
  )
}
