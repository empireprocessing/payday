"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Key, ArrowRight } from "lucide-react"
import { useState } from "react"
import { authenticateWithToken } from "@/lib/actions"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const [showToken, setShowToken] = useState(false)
  const [token, setToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await authenticateWithToken(token)
      if (result.success) {
        // Rediriger vers le dashboard après connexion réussie
        router.push("/")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'authentification")
    } finally {
      setIsLoading(false)
    }
  }

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

      <div className="flex items-center justify-center min-h-screen p-6 relative z-10">
        <div className="relative w-full max-w-lg">
          {/* Logo et titre */}
          <div className="text-center mb-12">
            <div>
              <h1 className="text-4xl md:text-4xl font-bold gradient-text mb-4 leading-tight">
                Accès sécurisé
              </h1>
            </div>
          </div>

          {/* Formulaire de connexion */}
          <Card className="glassmorphism glow-primary border-primary/20">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-semibold gradient-text">
                Authentification
              </CardTitle>
              <p className="text-muted-foreground">
                Saisissez votre token d&apos;accès pour accéder au dashboard
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Champ Token */}
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-sm font-medium text-white">
                    Token d&apos;accès
                  </Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="token"
                      type={showToken ? "text" : "password"}
                      placeholder="••••••••••••••••"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="pl-10 pr-10 glassmorphism border-white/20 bg-white/5 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/25"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                      disabled={isLoading}
                    >
                      {showToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Message d'erreur */}
                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                    {error}
                  </div>
                )}

                {/* Bouton de connexion */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full gradient-primary glow-primary font-semibold py-3 rounded-xl transition-all duration-300 group relative overflow-hidden disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <span>{isLoading ? "Connexion..." : "Se connecter"}</span>
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>

              {/* Informations */}
              <div className="text-center mt-6">
                <p className="text-xs text-muted-foreground">
                  Contactez l&apos;administrateur pour obtenir votre token d&apos;accès
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
