import { z } from 'zod'

// Schéma pour l'email
export const emailSchema = z
  .string()
  .min(1, 'L\'adresse email est requise')
  .email('Format d\'email invalide')

// Schéma pour le nom complet
export const fullNameSchema = z
  .string()
  .min(2, 'Le nom doit contenir au moins 2 caractères')
  .max(100, 'Le nom ne peut pas dépasser 100 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes')

// Schéma pour le téléphone (optionnel)
export const phoneSchema = z
  .string()
  .optional()
  .refine((val) => {
    if (!val) return true // Optionnel
    return /^[\+]?[0-9\s\-\(\)]{8,20}$/.test(val)
  }, 'Format de téléphone invalide')

// Schéma pour l'adresse
export const addressSchema = z
  .string()
  .min(5, 'L\'adresse doit contenir au moins 5 caractères')
  .max(200, 'L\'adresse ne peut pas dépasser 200 caractères')

// Schéma pour la ligne 2 d'adresse (optionnel)
export const addressLine2Schema = z
  .string()
  .optional()
  .refine((val) => {
    if (!val) return true // Optionnel
    return val.length <= 100
  }, 'La ligne 2 ne peut pas dépasser 100 caractères')

// Schéma pour la ville
export const citySchema = z
  .string()
  .min(2, 'La ville doit contenir au moins 2 caractères')
  .max(100, 'La ville ne peut pas dépasser 100 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'La ville ne peut contenir que des lettres, espaces, tirets et apostrophes')

// Schéma pour le code postal
export const postalCodeSchema = z
  .string()
  .min(3, 'Le code postal doit contenir au moins 3 caractères')
  .max(10, 'Le code postal ne peut pas dépasser 10 caractères')
  .regex(/^[0-9A-Za-z\s\-]+$/, 'Le code postal ne peut contenir que des chiffres, lettres, espaces et tirets')

// Schéma pour le pays
export const countrySchema = z
  .string()
  .min(2, 'Le pays est requis')
  .max(3, 'Le code pays ne peut pas dépasser 3 caractères')

// Schéma pour la région/état
export const stateSchema = z
  .string()
  .min(2, 'La région doit contenir au moins 2 caractères')
  .max(100, 'La région ne peut pas dépasser 100 caractères')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'La région ne peut contenir que des lettres, espaces, tirets et apostrophes')

// Schéma complet pour les données client
export const customerDataSchema = z.object({
  email: emailSchema,
  name: fullNameSchema,
  phone: phoneSchema,
})

// Schéma complet pour les données d'adresse
export const addressDataSchema = z.object({
  fullAddress: addressSchema,
  line2: addressLine2Schema,
  city: citySchema,
  postalCode: postalCodeSchema,
  country: countrySchema,
  state: stateSchema,
})

// Schéma complet pour le formulaire de checkout
export const checkoutFormSchema = z.object({
  customer: customerDataSchema,
  address: addressDataSchema,
})

// Types TypeScript dérivés des schémas
export type CustomerData = z.infer<typeof customerDataSchema>
export type AddressData = z.infer<typeof addressDataSchema>
export type CheckoutFormData = z.infer<typeof checkoutFormSchema>

// Fonction utilitaire pour valider un champ individuel
export const validateField = <T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } => {
  const result = schema.safeParse(value)
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, error: result.error.issues[0]?.message || 'Validation échouée' }
  }
}
