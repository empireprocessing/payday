// appearance.ts
import type { Appearance } from '@stripe/stripe-js';

export const paymentElementAppearance: Appearance = {
  theme: 'flat',
  labels: 'floating',
  variables: {
    // Couleurs exactes de vos composants
    colorText: '#000000',
    colorTextPlaceholder: 'rgb(107 114 128)', // text-gray-500
    colorBackground: 'transparent',
    colorDanger: 'rgb(239 68 68)', // red-500
    colorPrimary: '#000000',

    // Typography - exactement comme vos inputs
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSizeBase: '14px', // text-sm
    spacingUnit: '4px',

    // Bordures comme rounded-md
    borderRadius: '6px',
  },
  rules: {
    // Input - copie exacte du composant Input avec padding FloatingInput
    '.Input': {
      height: '48px', // h-12 exact
      paddingTop: '6px', // pt-5 (1.25rem = 20px)
      paddingBottom: '6px', // pb-1.5 (0.375rem = 6px) 
      paddingLeft: '12px', // px-3 (0.75rem = 12px)
      paddingRight: '12px', // px-3
      fontSize: '14px', // text-sm
      border: '1px solid oklch(0.922 0 0)', // border exact
      borderRadius: '8px', // rounded-md
      backgroundColor: 'transparent',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', // shadow-xs exact
      transition: 'color 150ms ease-in-out, box-shadow 150ms ease-in-out, border-color 150ms ease-in-out',
      outline: 'none',
      color: '#000000',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },

    // Placeholder - même couleur que FloatingLabel
    '.Input::placeholder': {
      color: 'rgb(107 114 128)', // text-gray-500 exact
      opacity: '1',
    },

    // Focus - reproduit exactement focus-visible:ring-2 focus-visible:ring-black
    '.Input:focus': {
      borderColor: 'transparent', // focus-visible:border-transparent
      outline: 'none',
      boxShadow: '0 0 0 2px #000000', // focus-visible:ring-2 focus-visible:ring-black
    },

    // États invalides - comme aria-invalid styles
    '.Input--invalid': {
      borderColor: 'rgb(239 68 68)', // border-destructive
      boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.2)', // ring-destructive/20
    },
    '.Label--invalid': {
      color: 'rgb(239 68 68)', // text-destructive
    },
    '.Error': {
      color: 'rgb(239 68 68)', // text-destructive
      fontSize: '12px',
      marginTop: '4px',
    },

    // Disabled - exactement comme disabled styles
    '.Input:disabled': {
      opacity: '0.5', // disabled:opacity-50
      cursor: 'not-allowed', // disabled:cursor-not-allowed
      pointerEvents: 'none', // disabled:pointer-events-none
    },

    // Label flottant - reproduction exacte du FloatingLabel
    '.Label': {
      position: 'absolute',
      pointerEvents: 'none',
      left: '12px', // left-3 exact (0.75rem = 12px)
      top: '8px', // top-2 quand flottant (0.5rem = 8px)
      fontSize: '12px', // text-xs quand flottant
      color: 'rgb(107 114 128)', // text-gray-500 exact
      transformOrigin: 'top left', // origin-top-left
      transform: 'scale(0.9)', // scale-90 exact
      transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)', // duration-200 avec même easing
    },

    // Label état normal (quand input vide et pas focus)
    '.Input:placeholder-shown + .Label': {
      top: '50%', // top-1/2
      transform: 'translateY(-50%) scale(1)', // -translate-y-1/2 sans scale
      fontSize: '14px', // text-sm état normal
    },

    // Label au focus (garde l'état flottant)
    '.Input:focus + .Label': {
      top: '8px', // top-2
      transform: 'scale(0.9)', // scale-90
      fontSize: '12px', // text-xs
    },

    // Tabs - style sobre
    '.Tab': { 
      borderRadius: '6px',
      padding: '8px 12px',
    },
    '.Tab:hover': { 
      backgroundColor: 'rgb(249 250 251)', // hover:bg-gray-50
    },
    '.Tab--selected': {
      borderColor: '#000000',
      borderWidth: '2px',
    },
  },
};
