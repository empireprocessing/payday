"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { Store } from "@/lib/types"

interface StoreMultiSelectProps {
  stores: Store[]
  selectedStoreIds: string[]
  onSelectionChange: (storeIds: string[]) => void
  placeholder?: string
  className?: string
}

export function StoreMultiSelect({
  stores,
  selectedStoreIds,
  onSelectionChange,
  placeholder = "Sélectionner des boutiques...",
  className,
}: StoreMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedStores = stores.filter(store => selectedStoreIds.includes(store.id))

  const handleUnselect = (storeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectionChange(selectedStoreIds.filter(id => id !== storeId))
  }

  const handleSelect = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      onSelectionChange(selectedStoreIds.filter(id => id !== storeId))
    } else {
      onSelectionChange([...selectedStoreIds, storeId])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-9 h-auto glassmorphism border-primary/20",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedStoreIds.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedStores.map(store => (
                <Badge
                  key={store.id}
                  variant="secondary"
                  className="mr-1 mb-1"
                >
                  {store.name}
                  <span
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center"
                    role="button"
                    tabIndex={0}
                    aria-label={`Supprimer ${store.name}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleUnselect(store.id, e as any)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => handleUnselect(store.id, e)}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher une boutique..." />
          <CommandList>
            <CommandEmpty>Aucune boutique trouvée.</CommandEmpty>
            <CommandGroup>
              {stores.map((store) => {
                const isSelected = selectedStoreIds.includes(store.id)
                return (
                  <CommandItem
                    key={store.id}
                    onSelect={() => handleSelect(store.id)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span>{store.name}</span>
                        {store.runner && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">{store.runner}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{store.domain}</span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
