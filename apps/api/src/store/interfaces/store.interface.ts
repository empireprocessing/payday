import { DecryptedStorePSP } from '../../psp/interfaces/psp.interface'

export interface StoreWithPSPs {
  id: string
  name: string
  domain: string
  createdAt: Date
  updatedAt: Date
  psps: DecryptedStorePSP[]
}
