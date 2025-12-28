type FormatOptions = {
  maxFrac?: number
  minFrac?: number
}

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

export const formatQty = (value?: string | number) =>
  formatNum(value, { maxFrac: 8 })

export const formatPrice = (value?: string | number) =>
  formatNum(value, { maxFrac: 4 })
