const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/

export const toLocalDateIso = (date: Date) => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const localMidnight = new Date(year, month, day)
  return localMidnight.toISOString()
}

export const fromLocalDateIso = (value: string) => {
  const match = YMD_RE.exec(value)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    return new Date(year, month, day)
  }
  return new Date(value)
}
