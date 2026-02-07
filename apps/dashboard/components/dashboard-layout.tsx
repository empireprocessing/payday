"use client"

import React, { useState } from 'react'
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/actions"
import {
  BarChart3, Menu,
  Store,
  CreditCard,
  Banknote,
  LogOut
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const sidebarItems = [
  { icon: BarChart3, label: "Analytics", href: "/" },
  { icon: Store, label: "Boutiques", href: "/boutiques" },
  { icon: CreditCard, label: "PSP", href: "/psp" },
  { icon: Banknote, label: "Paiements", href: "/paiements" },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Arrière-plan avec cercles concentriques */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="concentric-circles">
          <div className="circle-border" style={{width: '9rem', height: '9rem'}} />
          <div className="circle-border" style={{width: '18rem', height: '18rem'}} />
          <div className="circle-border" style={{width: '27rem', height: '27rem'}} />
          <div className="circle-border" style={{width: '36rem', height: '36rem'}} />
          <div className="circle-border" style={{width: '45rem', height: '45rem'}} />
          <div className="circle-border" style={{width: '54rem', height: '54rem'}} />
          <div className="circle-border" style={{width: '63rem', height: '63rem'}} />
        </div>
        
        {/* Effets de lumière flottants */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-primary/5 rounded-full blur-2xl animate-float" style={{animationDelay: '2s'}} />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-primary/8 rounded-full blur-xl animate-float" style={{animationDelay: '4s'}} />
      </div>

      {/* Navigation flottante en haut */}
      <nav className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-4xl">
        <div className="glassmorphism-strong rounded-full px-6 py-3 glow-subtle">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
                <Image 
                  src="/contactless.png" 
                  alt="HEYPAY Logo" 
                  width={20}
                  height={20}
                  className="h-8 w-8"
                />
                <span className="text-lg font-extrabold text-foreground">HEYPAY</span>
            </div>

            {/* Navigation principale - cachée sur mobile */}
            <div className="hidden md:flex">
              <ul className="flex gap-8">
                {sidebarItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link 
                        href={item.href}
                        className={cn(
                          "text-sm transition-all duration-200 flex items-center gap-2 px-3 py-2 rounded-full",
                          isActive 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Actions droite */}
            <div className="flex gap-3 items-center">
              {/* Menu mobile */}
              <Button 
                variant="ghost" 
                size="icon"
                className="md:hidden glassmorphism rounded-full h-10 w-10"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Bouton de déconnexion */}
              <Button 
                variant="ghost" 
                size="icon"
                className="glassmorphism rounded-full h-10 w-10 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                onClick={() => logout()}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Menu mobile déroulant */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm">
            <div className="glassmorphism-strong rounded-2xl p-6 glow-subtle animate-fade-in-up">
              <div className="space-y-3">
                {sidebarItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link 
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                        isActive 
                          ? "text-primary bg-primary/10 glow-primary" 
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <main className="pt-30 px-6 pb-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </main>

      {/* Indicateur de version flottant */}
      {/* <div className="fixed bottom-6 right-6 z-30">
        <div className="glassmorphism rounded-full px-4 py-2 text-xs text-muted-foreground">
          v2.0.1
        </div>
      </div> */}
    </div>
  )
} 