"use client"

import * as React from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
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

// --- Mini Calendar ---

const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"]
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isInRange(day: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false
  const d = day.getTime()
  return d > from.getTime() && d < to.getTime()
}

interface MiniCalendarProps {
  selectedFrom: Date | null
  selectedTo: Date | null
  onSelect: (date: Date) => void
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
}

function MiniCalendar({ selectedFrom, selectedTo, onSelect, month, year, onMonthChange }: MiniCalendarProps) {
  const firstDayOfMonth = new Date(year, month, 1)
  let startDay = firstDayOfMonth.getDay() - 1
  if (startDay < 0) startDay = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => {
    if (month === 0) onMonthChange(11, year - 1)
    else onMonthChange(month - 1, year)
  }
  const nextMonth = () => {
    if (month === 11) onMonthChange(0, year + 1)
    else onMonthChange(month + 1, year)
  }

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const cells: React.ReactNode[] = []
  for (let i = 0; i < startDay; i++) {
    cells.push(<div key={`empty-${i}`} className="h-8 w-8" />)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const isFrom = selectedFrom && isSameDay(date, selectedFrom)
    const isTo = selectedTo && isSameDay(date, selectedTo)
    const isSelected = isFrom || isTo
    const inRange = isInRange(date, selectedFrom, selectedTo)
    const isToday = isSameDay(date, new Date())
    const isFuture = date > today

    cells.push(
      <button
        key={d}
        type="button"
        disabled={isFuture}
        onClick={() => onSelect(date)}
        className={cn(
          "h-8 w-8 rounded-md text-xs font-medium transition-all duration-150",
          "hover:bg-primary/20 hover:text-white",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          isSelected && "bg-primary text-white hover:bg-primary/90 shadow-[0_0_8px_rgba(40,89,255,0.3)]",
          inRange && !isSelected && "bg-primary/10 text-primary",
          isToday && !isSelected && "ring-1 ring-primary/40 text-primary font-semibold",
          isFuture && "text-white/15 cursor-not-allowed hover:bg-transparent",
          !isSelected && !inRange && !isToday && !isFuture && "text-white/60 hover:text-white"
        )}
      >
        {d}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-white">
          {MONTHS_FR[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_FR.map(day => (
          <div key={day} className="h-8 w-8 flex items-center justify-center text-[10px] font-medium text-white/30 uppercase">
            {day}
          </div>
        ))}
        {cells}
      </div>
    </div>
  )
}

// --- Presets ---
const PRESETS = [
  { label: "7 derniers jours", days: 7 },
  { label: "14 derniers jours", days: 14 },
  { label: "30 derniers jours", days: 30 },
  { label: "Ce mois", days: -1 },
  { label: "Mois dernier", days: -2 },
]

function getPresetRange(preset: typeof PRESETS[number]): PeriodRange {
  const now = new Date()
  if (preset.days === -1) {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
  }
  if (preset.days === -2) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: start, to: end }
  }
  const from = new Date(now)
  from.setDate(from.getDate() - preset.days)
  return { from, to: now }
}

// --- Period Selector ---

export function PeriodSelector({
  value,
  customRange,
  onPeriodChange,
  onCustomRangeChange,
  className,
}: PeriodSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = React.useState(false)
  const [selectionFrom, setSelectionFrom] = React.useState<Date | null>(null)
  const [selectionTo, setSelectionTo] = React.useState<Date | null>(null)

  const now = new Date()
  const [calMonth, setCalMonth] = React.useState(now.getMonth())
  const [calYear, setCalYear] = React.useState(now.getFullYear())

  React.useEffect(() => {
    if (customRange) {
      setSelectionFrom(customRange.from)
      setSelectionTo(customRange.to)
      setCalMonth(customRange.from.getMonth())
      setCalYear(customRange.from.getFullYear())
    }
  }, [customRange])

  React.useEffect(() => {
    if (value === "custom") {
      setIsCustomOpen(true)
    } else {
      setIsCustomOpen(false)
    }
  }, [value])

  const handleDaySelect = (date: Date) => {
    if (!selectionFrom || (selectionFrom && selectionTo)) {
      setSelectionFrom(date)
      setSelectionTo(null)
    } else {
      if (date < selectionFrom) {
        setSelectionTo(selectionFrom)
        setSelectionFrom(date)
      } else {
        setSelectionTo(date)
      }
    }
  }

  const handleApply = () => {
    if (selectionFrom && selectionTo) {
      onCustomRangeChange?.({ from: selectionFrom, to: selectionTo })
      setIsCustomOpen(false)
    }
  }

  const handlePreset = (preset: typeof PRESETS[number]) => {
    const range = getPresetRange(preset)
    setSelectionFrom(range.from)
    setSelectionTo(range.to)
    setCalMonth(range.from.getMonth())
    setCalYear(range.from.getFullYear())
  }

  const formatDateShort = (date: Date): string => {
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  }

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getDisplayValue = (): string => {
    if (value === "custom" && customRange) {
      return `${formatDateForDisplay(customRange.from)} - ${formatDateForDisplay(customRange.to)}`
    }
    switch (value) {
      case "24h": return "Dernières 24h"
      case "7d": return "7 derniers jours"
      case "30d": return "30 derniers jours"
      case "90d": return "90 derniers jours"
      default: return "Période personnalisée"
    }
  }

  const cal2Month = calMonth === 11 ? 0 : calMonth + 1
  const cal2Year = calMonth === 11 ? calYear + 1 : calYear

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
          <PopoverContent
            className="w-auto p-0 glassmorphism-strong border-primary/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            align="end"
            sideOffset={8}
          >
            <div className="flex">
              {/* Presets */}
              <div className="border-r border-white/10 p-3 space-y-0.5 min-w-[140px]">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2 px-2">Raccourcis</p>
                {PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Calendars */}
              <div className="p-4">
                <div className="flex gap-6">
                  <MiniCalendar
                    selectedFrom={selectionFrom}
                    selectedTo={selectionTo}
                    onSelect={handleDaySelect}
                    month={calMonth}
                    year={calYear}
                    onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y) }}
                  />
                  <MiniCalendar
                    selectedFrom={selectionFrom}
                    selectedTo={selectionTo}
                    onSelect={handleDaySelect}
                    month={cal2Month}
                    year={cal2Year}
                    onMonthChange={(m, y) => {
                      if (m === 0) { setCalMonth(11); setCalYear(y - 1) }
                      else { setCalMonth(m - 1); setCalYear(y) }
                    }}
                  />
                </div>

                {/* Selection summary & actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                  <div className="text-xs text-white/40">
                    {selectionFrom && selectionTo ? (
                      <>
                        <span className="text-white font-medium">{formatDateShort(selectionFrom)}</span>
                        {" — "}
                        <span className="text-white font-medium">{formatDateShort(selectionTo)}</span>
                      </>
                    ) : selectionFrom ? (
                      <>
                        <span className="text-white font-medium">{formatDateShort(selectionFrom)}</span>
                        {" — Sélectionnez la fin"}
                      </>
                    ) : (
                      "Sélectionnez une plage"
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-white/40 hover:text-white"
                      onClick={() => setIsCustomOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleApply}
                      disabled={!selectionFrom || !selectionTo}
                    >
                      Appliquer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
