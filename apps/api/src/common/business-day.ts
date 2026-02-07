/**
 * Utilitaire pour le calcul du "jour ouvrable" PSP
 * Un jour ouvrable = 6h00 Paris → 6h00 Paris le lendemain
 *
 * Utilisé pour le reset quotidien des caps de capacité PSP.
 */

const PARIS_TIMEZONE = 'Europe/Paris'
const BUSINESS_DAY_START_HOUR = 6

/**
 * Retourne le début du jour ouvrable actuel en UTC
 * - Si heure Paris < 6h → retourne hier 6h Paris (en UTC)
 * - Si heure Paris >= 6h → retourne aujourd'hui 6h Paris (en UTC)
 *
 * @param referenceDate Date de référence (défaut: maintenant)
 * @returns Date UTC correspondant à 6h00 Paris du jour ouvrable actuel
 */
export function getBusinessDayStartUTC(referenceDate?: Date): Date {
  const now = referenceDate || new Date()

  // Obtenir l'heure actuelle à Paris
  const parisFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })

  const parts = parisFormatter.formatToParts(now)
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0'

  let parisYear = parseInt(getPart('year'))
  let parisMonth = parseInt(getPart('month')) - 1 // 0-indexed
  let parisDay = parseInt(getPart('day'))
  const parisHour = parseInt(getPart('hour'))

  // Si avant 6h Paris, le jour ouvrable a commencé hier
  if (parisHour < BUSINESS_DAY_START_HOUR) {
    const yesterday = new Date(parisYear, parisMonth, parisDay - 1)
    parisYear = yesterday.getFullYear()
    parisMonth = yesterday.getMonth()
    parisDay = yesterday.getDate()
  }

  // Convertir 6h Paris en UTC (gère automatiquement DST)
  return parisTimeToUTC(parisYear, parisMonth, parisDay, BUSINESS_DAY_START_HOUR)
}

/**
 * Convertit une heure locale Paris en date UTC
 * Gère automatiquement les transitions DST (CET ↔ CEST)
 */
function parisTimeToUTC(year: number, month: number, day: number, hour: number): Date {
  // Créer une date temporaire pour déterminer l'offset Paris à cette date
  // On utilise midi pour éviter les problèmes aux frontières de DST
  const tempDate = new Date(year, month, day, 12, 0, 0)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TIMEZONE,
    timeZoneName: 'shortOffset',
  })

  const offsetPart = formatter.formatToParts(tempDate).find((p) => p.type === 'timeZoneName')?.value || 'GMT+1'

  // Parser l'offset (ex: "GMT+1" ou "GMT+2")
  const match = offsetPart.match(/GMT([+-])(\d+)/)
  const offsetHours = match ? (match[1] === '+' ? 1 : -1) * parseInt(match[2]) : 1

  // Retourner la date UTC correspondant à l'heure Paris
  // Ex: 6h Paris (GMT+1) = 5h UTC, 6h Paris (GMT+2) = 4h UTC
  return new Date(Date.UTC(year, month, day, hour - offsetHours, 0, 0))
}

/**
 * Retourne les bornes du jour ouvrable actuel
 * @returns { start: Date, end: Date } en UTC
 */
export function getBusinessDayBoundaries(referenceDate?: Date): { start: Date; end: Date } {
  const start = getBusinessDayStartUTC(referenceDate)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}
