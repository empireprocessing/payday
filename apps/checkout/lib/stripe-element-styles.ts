// stripe-element-styles.ts
import type { StripeElementStyle, StripeElementClasses } from '@stripe/stripe-js';

export const elementStyles: StripeElementStyle = {
  base: {
    // Couleurs exactes de vos composants
    color: '#000000',
    backgroundColor: 'transparent',
    
    // Typography - exactement comme vos inputs
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: '14px', // text-sm
    fontWeight: '400',
    fontSmoothing: 'antialiased',
    
    // Pas de placeholder - on utilise les labels flottants
    '::placeholder': {
      color: 'transparent',
    },
    
    // Autofill styles
    ':-webkit-autofill': {
      color: '#000000',
    },
  },
  
  // État invalide - comme aria-invalid styles
  invalid: {
    color: 'rgb(239 68 68)', // text-destructive
    iconColor: 'rgb(239 68 68)', // icon color pour les erreurs
    
    '::placeholder': {
      color: 'transparent', // pas de placeholder même en erreur
    },
  },
  
  // État complet (input valide et rempli)
  complete: {
    color: '#000000',
    iconColor: 'rgb(34 197 94)', // text-green-500 pour indiquer la validité
  },
  
  // État vide
  empty: {
    color: '#000000',
    
    '::placeholder': {
      color: 'transparent', // pas de placeholder
    },
  },
};

export const elementClasses: StripeElementClasses = {
  focus: 'focused',
  empty: 'empty',
  invalid: 'invalid',
  complete: 'complete',
};
