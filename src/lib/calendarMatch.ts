import type { PortfolioTag } from '@/hooks/useAuth'
import type { CalendarCompany } from '@/types/calendar'

/**
 * Normalize a company/tag name for exact matching.
 * Rules (v1): lowercase, trim, remove quotes, remove legal forms ПАО/АО.
 * No fuzzy/substring matching.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/["«»''`]/g, '')
    .replace(/(^|\s)(пао|ао)(\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match calendar companies against user portfolio tags.
 * Returns a Set of matched company tickers.
 *
 * Rules (in order):
 *   1. Exact ticker match: tag_id.toUpperCase() === company.ticker
 *   2. Exact normalized name match: normalized tag_name === normalized company.name
 */
export function matchPortfolio(
  companies: CalendarCompany[],
  portfolio: PortfolioTag[]
): Set<string> {
  const matched = new Set<string>()

  for (const company of companies) {
    const normalizedCompanyName = normalizeName(company.name)
    const ticker = company.ticker.toUpperCase()

    for (const tag of portfolio) {
      if (tag.tag_id.toUpperCase() === ticker) {
        matched.add(ticker)
        break
      }

      if (normalizeName(tag.tag_name) === normalizedCompanyName) {
        matched.add(ticker)
        break
      }
    }
  }

  return matched
}
