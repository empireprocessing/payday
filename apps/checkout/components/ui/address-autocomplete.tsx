'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { searchAddresses, getAddressDetails } from '@/lib/actions'
import { Search, Loader2 } from 'lucide-react'

export interface AddressAutocompleteProps {
  id?: string
  label?: string
  placeholder?: string
  className?: string
  onAddressSelect?: (address: AddressDetails) => void
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  autoComplete?: string
}

export interface AddressDetails {
  formatted_address: string
  street_number: string
  route: string
  locality: string
  postal_code: string
  country: string
  administrative_area_level_1: string
}

interface AddressSuggestion {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
}

const AddressAutocomplete = React.forwardRef<HTMLInputElement, AddressAutocompleteProps>(
  ({ className, label, id, placeholder, onAddressSelect, defaultValue, value, onChange, onBlur, autoComplete, ...props }, ref) => {
    const [query, setQuery] = React.useState(value || defaultValue || '')
    const [suggestions, setSuggestions] = React.useState<AddressSuggestion[]>([])
    const [isOpen, setIsOpen] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)
    const [selectedIndex, setSelectedIndex] = React.useState(-1)
    const [isAutoFilled, setIsAutoFilled] = React.useState(false)
    
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!)

    // Synchroniser avec la valeur contrôlée
    React.useEffect(() => {
      if (value !== undefined && value !== query) {
        setQuery(value)
      }
    }, [value])

    const hasValue = Boolean(query)
    const isLabelFloating = isFocused || hasValue

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setQuery(newValue)
      onChange?.(newValue)
      setSelectedIndex(-1)

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Debounce search
      debounceRef.current = setTimeout(async () => {
        if (newValue && newValue.length >= 3 && !isAutoFilled) {
          setIsLoading(true)
          try {
            const results = await searchAddresses(newValue)
            setSuggestions(results)
            setIsOpen(results.length > 0)
          } catch (error) {
            console.error('Error searching addresses:', error)
            setSuggestions([])
            setIsOpen(false)
          } finally {
            setIsLoading(false)
          }
        } else {
          setSuggestions([])
          setIsOpen(false)
        }
      }, 300)
    }

    const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
  
      setQuery(suggestion.main_text)
      onChange?.(suggestion.main_text)
      setIsOpen(false)
      setIsLoading(true)

      try {
        const details = await getAddressDetails(suggestion.place_id)
        if (details && onAddressSelect) {
          onAddressSelect(details)
        }
      } catch (error) {
        console.error('Error getting address details:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSuggestionClick(suggestions[selectedIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          setSelectedIndex(-1)
          break
      }
    }

    const handleFocus = () => {
      setIsFocused(true)
      if (suggestions.length > 0) {
        setIsOpen(true)
      }
    }

    const handleBlur = (e: React.FocusEvent) => {
      // Delay closing to allow clicks on suggestions
      setTimeout(() => {
        if (!containerRef.current?.contains(document.activeElement)) {
          setIsFocused(false)
          setIsOpen(false)
          setSelectedIndex(-1)
          onBlur?.()
        }
      }, 150)
    }

    // Détecter l'auto-remplissage
    React.useEffect(() => {
      const checkAutoFill = () => {
        if (inputRef.current) {
          // Vérifier si l'input a été auto-rempli par le navigateur
          const isFilled = inputRef.current.matches(':-webkit-autofill') || 
                          inputRef.current.matches(':autofill')
          
          if (isFilled && !isAutoFilled) {
            setIsAutoFilled(true)
            setIsOpen(false) // Fermer les suggestions si auto-rempli
          } else if (!isFilled && isAutoFilled) {
            setIsAutoFilled(false)
          }
        }
      }

      // Vérifier périodiquement l'auto-remplissage
      const interval = setInterval(checkAutoFill, 100)
      
      // Vérifier aussi lors du focus
      const handleFocusWithCheck = () => {
        handleFocus()
        setTimeout(checkAutoFill, 50)
      }

      if (inputRef.current) {
        inputRef.current.addEventListener('focus', handleFocusWithCheck)
      }

      return () => {
        clearInterval(interval)
        if (inputRef.current) {
          inputRef.current.removeEventListener('focus', handleFocusWithCheck)
        }
      }
    }, [isAutoFilled])

    // Close dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          setSelectedIndex(-1)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={!isLabelFloating ? placeholder : ''}
            autoComplete={autoComplete}
            className={cn(
              // Base styles like FloatingInput
              "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-12 w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow,border] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-sm",
              "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0",
              "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
              // Padding for floating label
              "pt-5 pb-1.5 pl-3 pr-10",
              className
            )}
            {...props}
          />
          
          {/* Search/Loading icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </div>
          
          {/* Floating label */}
          {label && (
            <label
              htmlFor={id}
              className={cn(
                "absolute pointer-events-none",
                "transition-all duration-200 cubic-bezier(0, 0, 0.2, 1)",
                "text-gray-500 dark:text-gray-400",
                isLabelFloating
                  ? "left-3 top-2 text-xs scale-90"
                  : "left-3 top-1/2 -translate-y-1/2 text-sm",
                "origin-top-left"
              )}
            >
              {label}
            </label>
          )}
        </div>

        {/* Suggestions dropdown */}
        {isOpen && suggestions.length > 0 && !isAutoFilled && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-gray-200 bg-white shadow-lg">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-gray-50 focus:bg-gray-50",
                  index === selectedIndex && "bg-gray-50",
                  "border-b border-gray-100 last:border-b-0",
                  // Préserver les coins arrondis
                  index === 0 && "rounded-t-md",
                  index === Math.min(suggestions.length - 1, 4) && "rounded-b-md"
                )}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="w-full">
                  <div className="font-medium text-gray-900 truncate">
                    {suggestion.main_text}
                  </div>
                  {suggestion.secondary_text && (
                    <div className="text-gray-500 text-xs truncate">
                      {suggestion.secondary_text}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)

AddressAutocomplete.displayName = 'AddressAutocomplete'

export { AddressAutocomplete }