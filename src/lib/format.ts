export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${Math.round(amount).toLocaleString()}`
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export function effortColor(effort: 'Low' | 'Medium' | 'High'): string {
  return effort === 'Low' ? '#34d399' : effort === 'Medium' ? '#fbbf24' : '#fb7185'
}

export function tierColor(tier: 1 | 2 | 3): string {
  return tier === 1 ? '#34d399' : tier === 2 ? '#60a5fa' : '#f59e0b'
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function randomSlug(): string {
  // 10-char URL-safe slug
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
}
