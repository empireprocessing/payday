import { StorePSP, Psp } from '@prisma/client'

// Type pour StorePSP avec PSP et credentials déchiffrées
export interface DecryptedStorePSP extends StorePSP {
  psp: Psp
}

export interface CreatePSPDto {
  name: string
  pspType: string
  publicKey: string
  secretKey: string
  monthlyCapacityEur?: number | null
  dailyCapacityEur?: number | null
  config?: any
}

export interface UpdatePSPCredentialsDto {
  publicKey?: string
  secretKey?: string
}

// Type pour PSP avec nombre de stores connectés et usage
export interface PSPWithStoreCount extends Psp {
  connectedStores: number
  usageBusinessDay?: number // Usage depuis 6h Paris (jour ouvrable)
  usage30d?: number
}
