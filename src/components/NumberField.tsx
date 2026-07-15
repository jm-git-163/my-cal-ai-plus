import { useEffect, useState, type ChangeEvent, type FocusEvent } from 'react'

interface NumberFieldProps {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Allow one decimal place (e.g. weight kg). */
  decimals?: number
  className?: string
  id?: string
  disabled?: boolean
}

/**
 * Controlled number input that keeps a string draft while typing,
 * so clearing / decimals / intermediate values are not forced to 0.
 */
export function NumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  decimals = 0,
  className,
  id,
  disabled,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => formatNumber(value, decimals))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(formatNumber(value, decimals))
  }, [value, decimals, focused])

  function commit(raw: string) {
    const parsed = parseLooseNumber(raw)
    if (parsed === null) {
      setDraft(formatNumber(value, decimals))
      return
    }
    let next = parsed
    if (typeof min === 'number') next = Math.max(min, next)
    if (typeof max === 'number') next = Math.min(max, next)
    if (decimals >= 0) {
      const factor = 10 ** decimals
      next = Math.round(next * factor) / factor
    }
    onValueChange(next)
    setDraft(formatNumber(next, decimals))
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (!isAllowedDraft(raw, decimals)) return
    setDraft(raw)
    const parsed = parseLooseNumber(raw)
    if (parsed !== null) onValueChange(parsed)
  }

  function onBlur(e: FocusEvent<HTMLInputElement>) {
    setFocused(false)
    commit(e.target.value)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      pattern={decimals > 0 ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
      autoComplete="off"
      disabled={disabled}
      value={draft}
      step={step}
      min={min}
      max={max}
      onFocus={() => setFocused(true)}
      onChange={onChange}
      onBlur={onBlur}
      className={className}
    />
  )
}

function formatNumber(value: number, decimals: number) {
  if (!Number.isFinite(value)) return ''
  if (decimals <= 0) return String(Math.round(value))
  const fixed = value.toFixed(decimals)
  return fixed.replace(/\.?0+$/, '') || '0'
}

function parseLooseNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '' || trimmed === '.' || trimmed === '-' || trimmed === '-.') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function isAllowedDraft(raw: string, decimals: number) {
  if (raw === '') return true
  if (decimals > 0) {
    return /^-?\d*[.,]?\d*$/.test(raw)
  }
  return /^-?\d*$/.test(raw)
}
