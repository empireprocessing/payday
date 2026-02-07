import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
}

const FloatingLabelSelect = React.forwardRef<HTMLSelectElement, FloatingSelectProps>(
  ({ className, label, id, children, ...props }, ref) => {
    const [value, setValue] = React.useState(props.value || props.defaultValue || '');
    const [isFocused, setIsFocused] = React.useState(false);
    
    // Sync with external changes
    React.useEffect(() => {
      if (props.value !== undefined) {
        setValue(props.value);
      }
    }, [props.value]);
    
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setValue(e.target.value);
      props.onChange?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    const hasValue = Boolean(value) || Boolean(props.value);
    const isLabelFloating = isFocused || hasValue;

    return (
      <div className="relative">
        <select
          ref={ref}
          id={id}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            // Padding comme FloatingInput : plus en haut pour le label, équilibré sur les côtés
            "pt-5 pb-1.5 px-3 pr-10", // pr-10 pour faire place à l'icône
            "flex h-12 w-full min-w-0 rounded-md border border-input bg-transparent",
            "text-sm appearance-none cursor-pointer",
            "shadow-xs transition-[color,box-shadow,border] outline-none",
            "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className
          )}
          {...props}
        >
          <option value="" disabled hidden></option>
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
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

FloatingLabelSelect.displayName = 'FloatingLabelSelect';

// Keep backward compatibility
const FloatingSelect = FloatingLabelSelect;

export { FloatingSelect, FloatingLabelSelect }