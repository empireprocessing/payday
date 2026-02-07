import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, id, value: propValue, defaultValue, onChange, onFocus, onBlur, ...props }, ref) => {
    const [value, setValue] = React.useState(propValue || defaultValue || '');
    const [isFocused, setIsFocused] = React.useState(false);
    
    // Sync with external changes
    React.useEffect(() => {
      if (propValue !== undefined) {
        setValue(propValue);
      }
    }, [propValue]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      onChange?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const hasValue = Boolean(value) || Boolean(propValue);
    const isLabelFloating = isFocused || hasValue;

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            // Padding comme Shopify : plus en haut pour le label, équilibré sur les côtés
            "pt-5 pb-1.5 px-3",
            className
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={id}
            className={cn(
              // Base positioning
              "absolute pointer-events-none",
              "transition-all duration-200 cubic-bezier(0, 0, 0.2, 1)",
              // Couleur toujours grise
              "text-gray-500 dark:text-gray-400",
              // Floating state avec une taille de texte raisonnable et alignement avec le texte
              isLabelFloating
                ? "left-3 top-2 text-xs scale-90"
                : "left-3 top-1/2 -translate-y-1/2 text-sm",
              // Transform origin pour animation fluide
              "origin-top-left"
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';

// Keep backward compatibility
const FloatingInput = FloatingLabelInput;
const FloatingLabel = ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label {...props}>{children}</label>
);

export { FloatingInput, FloatingLabel, FloatingLabelInput };