import { getDictionary, isValidLocale, type Locale } from '@/lib/translations'
import { TranslationsProvider } from '@/components/translations-provider'
import { getCheckoutInfo } from '@/lib/cart-actions'
import { headers } from 'next/headers'

export default async function CheckoutLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ checkoutId: string }>
}) {
  const { checkoutId } = await params
  
  // Récupérer le domaine depuis les headers
  const headersList = await headers()
  const domain = headersList.get('host') || undefined
  
  // Récupérer les infos du checkout
  const checkoutInfo = await getCheckoutInfo(checkoutId, domain)
  
  if (!checkoutInfo.success || !checkoutInfo.store) {
    // Fallback: utiliser les traductions par défaut pour les pages d'erreur
    const fallbackDictionary = await getDictionary('en')
    return (
      <TranslationsProvider dictionary={fallbackDictionary} locale="en">
        {children}
      </TranslationsProvider>
    )
  }
  
  // Récupérer la config du checkout
  const checkoutConfig = checkoutInfo.store.checkoutConfig as any || {}
  console.log('🔍 Checkout config:', checkoutConfig)
  console.log('🔍 Store data:', checkoutInfo.store)
  const configuredLocale = checkoutConfig.language || 'fr'
  const locale: Locale = isValidLocale(configuredLocale) ? configuredLocale : 'fr'
  console.log('🌐 Selected locale:', locale)
  
  // Charger les traductions de base
  const baseDictionary = await getDictionary(locale)
  
  // Fusionner avec les traductions personnalisées
  const customTranslations = checkoutConfig.customTranslations || {}
  const mergedDictionary = mergeDictionaries(baseDictionary, customTranslations)
  
  return (
    <TranslationsProvider dictionary={mergedDictionary} locale={locale}>
      {children}
    </TranslationsProvider>
  )
}

// Fonction pour fusionner les traductions personnalisées
function mergeDictionaries(base: any, custom: Record<string, string>): any {
  const result = { ...base }
  
  // Appliquer chaque traduction personnalisée
  for (const [key, value] of Object.entries(custom)) {
    const keys = key.split('.')
    let current = result
    
    // Naviguer jusqu'au dernier niveau
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }
    
    // Mettre à jour la valeur
    current[keys[keys.length - 1]] = value
  }
  
  return result
}