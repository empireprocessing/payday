import * as crypto from 'crypto'

// Clé de chiffrement principale (doit être en variable d'environnement)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-me-in-production'

if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('ENCRYPTION_KEY must be set in production')
}

// Dériver une clé de 32 bytes à partir de la clé principale
function deriveKey(): Uint8Array {
  return crypto.scryptSync(ENCRYPTION_KEY, 'heypay-salt', 32)
}

export interface AesCipher {
  iv: Uint8Array
  text: Uint8Array
}

/**
 * Chiffre une chaîne de caractères avec AES-256-GCM (Node.js seulement)
 */
export function encrypt(message: string): string {
  try {
    const key = deriveKey()
    const iv = crypto.randomBytes(12) // 12 bytes pour GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    
    const encrypted = cipher.update(message, 'utf8')
    cipher.final()
    const tag = cipher.getAuthTag()
    
    // Concaténer encrypted + tag pour compatibilité
    const text = new Uint8Array(Buffer.concat([encrypted, tag]))
    
    // Retourner sous format : iv:encryptedWithTag
    return [
      Buffer.from(iv).toString('hex'),
      Buffer.from(text).toString('hex')
    ].join(':')
  } catch (error) {
    console.error('Erreur lors du chiffrement:', error)
    throw new Error('Impossible de chiffrer les données')
  }
}

/**
 * Déchiffre une chaîne de caractères (Node.js seulement)
 */
export function decrypt(encryptedData: string): string {
  try {
    const [ivHex, textHex] = encryptedData.split(':')
    
    if (!ivHex || !textHex) {
      throw new Error('Format de données chiffrées invalide')
    }
    
    const key = deriveKey()
    const iv = Buffer.from(ivHex, 'hex')
    const text = Buffer.from(textHex, 'hex')
    
    // Séparer les données chiffrées du tag d'authentification
    const tagStart = text.length - 16 // Le tag fait 16 bytes
    const encrypted = text.slice(0, tagStart)
    const tag = text.slice(tagStart)
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
  } catch (error) {
    console.error('Erreur lors du déchiffrement:', error)
    throw new Error('Impossible de déchiffrer les données')
  }
}

/**
 * Chiffre les credentials d'un PSP
 */
export function encryptPSPCredentials(credentials: {
  publicKey: string
  secretKey: string
}) {
  return {
    publicKey: encrypt(credentials.publicKey),
    secretKey: encrypt(credentials.secretKey),
  }
}

/**
 * Déchiffre les credentials d'un PSP
 */
export function decryptPSPCredentials(encryptedCredentials: {
  publicKey: string
  secretKey: string
}) {
  return {
    publicKey: decrypt(encryptedCredentials.publicKey),
    secretKey: decrypt(encryptedCredentials.secretKey),
  }
}

/**
 * Utilitaire pour tester le chiffrement/déchiffrement
 */
export function testEncryption() {
  const testData = 'sk_test_51234567890abcdef'
  console.log('🔒 Test de chiffrement:')
  console.log('Original:', testData)
  
  const encrypted = encrypt(testData)
  console.log('Chiffré:', encrypted)
  
  const decrypted = decrypt(encrypted)
  console.log('Déchiffré:', decrypted)
  
  const isValid = testData === decrypted
  console.log('✅ Test:', isValid ? 'RÉUSSI' : 'ÉCHOUÉ')
  
  return isValid
}
