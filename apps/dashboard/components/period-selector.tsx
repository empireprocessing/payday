"use client"

import * as React from "react"
import { Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type PeriodType = "24h" | "7d" | "30d" | "90d" | "custom"

export interface PeriodRange {
  from: Date
  to: Date
}

interface PeriodSelectorProps {
  value: PeriodType
  customRange?: PeriodRange
  onPeriodChange: (period: PeriodType) => void
  onCustomRangeChange?: (range: PeriodRange) => void
  className?: string
}

export function PeriodSelector({
  value,
  customRange,
  onPeriodChange,
  onCustomRangeChange,
  className,
}: PeriodSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = React.useState(false)
  const [fromDate, setFromDate] = React.useState<string>("")
  const [toDate, setToDate] = React.useState<string>("")

  // Initialiser les dates custom si elles existent
  React.useEffect(() => {
    if (customRange) {
      setFromDate(formatDateForInput(customRange.from))
      setToDate(formatDateForInput(customRange.to))
    }
  }, [customRange])

  // Quand on sélectionne "custom", ouvrir le popover
  React.useEffect(() => {
    if (value === "custom") {
      setIsCustomOpen(true)
    } else {
      setIsCustomOpen(false)
    }
  }, [value])

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const handleCustomDateApply = () => {
    if (fromDate && toDate) {
      const from = new Date(fromDate)
      const to = new Date(toDate)
      
      // Vérifier que les dates sont valides
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        // S'assurer que "to" est après "from"
        if (to < from) {
          // Inverser si nécessaire
          onCustomRangeChange?.({ from: to, to: from })
        } else {
          onCustomRangeChange?.({ from, to })
        }
        setIsCustomOpen(false)
      }
    }
  }

  const getDisplayValue = (): string => {
    if (value === "custom" && customRange) {
      return `${formatDateForDisplay(customRange.from)} - ${formatDateForDisplay(customRange.to)}`
    }
    switch (value) {
      case "24h":
        return "Dernières 24h"
      case "7d":
        return "7 derniers jours"
      case "30d":
        return "30 derniers jours"
      case "90d":
        return "90 derniers jours"
      default:
        return "Période personnalisée"
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value} onValueChange={(v) => onPeriodChange(v as PeriodType)}>
        <SelectTrigger className="w-[180px] glassmorphism border-primary/20">
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="24h">Dernières 24h</SelectItem>
          <SelectItem value="7d">7 derniers jours</SelectItem>
          <SelectItem value="30d">30 derniers jours</SelectItem>
          <SelectItem value="90d">90 derniers jours</SelectItem>
          <SelectItem value="custom">Période personnalisée</SelectItem>
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="glassmorphism border-primary/20"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="from-date">Du</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">Au</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleCustomDateApply}
                  disabled={!fromDate || !toDate}
                >
                  Appliquer
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
