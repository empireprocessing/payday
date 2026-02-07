'use server'

// Import des nouvelles actions de l'API interne
import { getStoreByPayDomain as getStoreByPayDomainInternal } from './internal-api-actions'

// Re-export pour compatibilité
export type StoreDomainResponse = {
  success: boolean
  domain?: string
  storeId?: string
  error?: string
}

export async function getStoreDomainByPayDomain(payDomain: string): Promise<StoreDomainResponse> {
  return getStoreByPayDomainInternal(payDomain)
}
