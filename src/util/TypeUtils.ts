export function isEmpty (value: any): boolean {
  if (value === null || value === undefined) {
    return true
  }
  if (value === '') {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0
  }

  return false
}
