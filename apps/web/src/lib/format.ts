type FormatOptions = {
  maxFrac?: number
  minFrac?: number
}

export type NumberDisplayContext = 'price' | 'qty' | 'money' | 'pnl' | 'percent'

const addGrouping = (value: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export const formatNum = (
  value: string | number | undefined,
  options: FormatOptions = {},
) => {
  if (value === undefined || value === null) return '-'
  const raw = String(value).trim()
  if (!raw) return '-'
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return raw

  const { maxFrac = 8, minFrac = 0 } = options
  const sign = raw.startsWith('-') ? '-' : ''
  const numeric = sign ? raw.slice(1) : raw
  const [intPart, fracPart = ''] = numeric.split('.')
  const grouped = addGrouping(intPart.replace(/^0+(?=\d)/, ''))
  const nextFrac = maxFrac >= 0 ? fracPart.slice(0, maxFrac) : fracPart

  let trimmedFrac = nextFrac
  while (trimmedFrac.length > minFrac && trimmedFrac.endsWith('0')) {
    trimmedFrac = trimmedFrac.slice(0, -1)
  }

  if (trimmedFrac.length === 0 && minFrac === 0) {
    return `${sign}${grouped || '0'}`
  }

  const padded =
    trimmedFrac.length < minFrac
      ? trimmedFrac.padEnd(minFrac, '0')
      : trimmedFrac
  return `${sign}${grouped || '0'}.${padded}`
}

export const formatMoneyLike = (value?: string | number) =>
  formatNum(value, { maxFrac: 2 })

export const formatMoneySmart = (value?: string | number) => {
  if (value === undefined || value === null) return '-'
  const raw = Number(value)
  if (Number.isNaN(raw)) {
    return formatMoneyLike(value)
  }
  const abs = Math.abs(raw)
  return formatNum(value, { maxFrac: abs >= 1000 ? 0 : 2 })
}

const getAbs = (value?: string | number) => {
  if (value === undefined || value === null) return null
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return null
  return Math.abs(numeric)
}

export const formatMoneyDisplay = (value?: string | number) => {
  const abs = getAbs(value)
  if (abs === null) return formatNum(value, { maxFrac: 2 })
  if (abs >= 1000) return formatNum(value, { maxFrac: 0 })
  if (abs >= 1) return formatNum(value, { maxFrac: 2 })
  return formatNum(value, { maxFrac: 4 })
}

export const formatPriceDisplay = (value?: string | number) => {
  const abs = getAbs(value)
  if (abs === null) return formatNum(value, { maxFrac: 2 })
  if (abs >= 1000) return formatNum(value, { maxFrac: 0 })
  if (abs >= 1) return formatNum(value, { maxFrac: 2 })
  if (abs >= 0.01) return formatNum(value, { maxFrac: 4 })
  if (abs >= 0.0001) return formatNum(value, { maxFrac: 6 })
  return formatNum(value, { maxFrac: 8 })
}

export const formatQtyDisplay = (value?: string | number) => {
  const abs = getAbs(value)
  if (abs === null) return formatNum(value, { maxFrac: 6 })
  if (abs >= 1) return formatNum(value, { maxFrac: 4 })
  if (abs >= 0.01) return formatNum(value, { maxFrac: 6 })
  return formatNum(value, { maxFrac: 8 })
}

export const formatNumberDisplay = (
  value: string | number | undefined,
  ctx: NumberDisplayContext,
) => {
  switch (ctx) {
    case 'price':
      return formatPriceDisplay(value)
    case 'qty':
      return formatQtyDisplay(value)
    case 'money':
    case 'pnl':
      return formatMoneyDisplay(value)
    case 'percent':
      return formatNum(value, { maxFrac: 2 })
    default:
      return formatNum(value, { maxFrac: 4 })
  }
}

export const formatInputValue = (
  value: string | number | undefined,
  ctx: NumberDisplayContext,
) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.trim()
  const maxFrac = ctx === 'price' || ctx === 'qty' ? 4 : 2
  return formatNum(value, { maxFrac })
}

export const formatQty = (value?: string | number) =>
  formatNum(value, { maxFrac: 8 })

export const formatPrice = (value?: string | number) =>
  formatNum(value, { maxFrac: 4 })
