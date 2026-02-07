"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  MessageSquare,
  Calculator, Star,
  ArrowRight,
  Menu,
  Home,
  Phone,
  Mail, Zap,
  BarChart3, Target,
  ChevronRight
} from "lucide-react"
import { useState } from "react"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

      {/* Navigation */}
      <nav className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-4xl">
        <div className="glassmorphism-strong rounded-full px-6 py-3 glow-subtle">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 glow-primary">
                <Home className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg gradient-text">
                KAZBA<span className="text-primary">.</span>
              </span>
            </div>

            {/* Navigation principale - cachée sur mobile */}
            <div className="hidden md:flex">
              <ul className="flex gap-6">
                <li>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-all">
                    Fonctionnalités
                  </a>
                </li>
                <li>
                  <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-all">
                    Démo
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-all">
                    Tarifs
                  </a>
                </li>
              </ul>
            </div>

            {/* Actions droite */}
            <div className="flex gap-3 items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden glassmorphism"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button className="gradient-primary glow-primary transition-all duration-300 relative overflow-hidden group text-xs">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Star className="mr-2 h-4 w-4" />
                Essayer Démo
              </Button>
            </div>
          </div>
        </div>

        {/* Menu mobile */}
        {mobileMenuOpen && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-full">
            <div className="glassmorphism-strong rounded-2xl p-6 glow-subtle animate-fade-in-up">
              <div className="space-y-3">
                <a href="#features" className="block px-4 py-3 text-muted-foreground hover:text-foreground transition-all">
                  Fonctionnalités
                </a>
                <a href="#demo" className="block px-4 py-3 text-muted-foreground hover:text-foreground transition-all">
                  Démo
                </a>
                <a href="#pricing" className="block px-4 py-3 text-muted-foreground hover:text-foreground transition-all">
                  Tarifs
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Section Hero */}
      <section className="flex flex-col items-center py-40 justify-center text-center gap-8 max-w-6xl w-full mx-auto px-6 relative z-10">
        {/* Pill d'introduction */}
        <div className="p-[1.2px] flex items-center justify-center before:bg-[conic-gradient(transparent,#ffffff,transparent_30%)] relative before:absolute before:w-full before:h-full before:animate-border-rotate overflow-hidden before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:blur-[130px] before:bg-no-repeat rounded-full before:opacity-30 z-[2]">
          <div className="glassmorphism px-4 py-2 flex items-center justify-center rounded-full text-sm -translate-y-[0.3px] opacity-100">
            <span className="text-white text-opacity-80 flex items-center justify-center gap-2">
              Révolutionnez l&apos;immobilier <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <span className="absolute bottom-0 left-1/2 blur-sm -translate-x-1/2 w-1/2 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent z-[99]"></span>
        </div>

        {/* Titre principal */}
        <div>
          <h1 className="text-6xl md:text-7xl max-w-4xl max-md:text-5xl max-sm:text-4xl z-[2] relative gradient-text leading-tight">
            Estimez Vos Biens Immobiliers Instantanément
          </h1>
        </div>

        {/* Sous-titre */}
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Notre chatbot intelligent analyse vos biens immobiliers en quelques secondes et génère des leads qualifiés automatiquement
        </p>

        {/* CTA principal avec input */}
        <div className="flex gap-3 items-center p-2 rounded-full glassmorphism border-primary/20 z-[2] relative max-w-lg w-full">
          <div className="p-2 rounded-full bg-primary/20">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div className="whitespace-nowrap text-sm w-full overflow-hidden text-ellipsis px-2">
            Décrivez votre bien immobilier...
            <span className="animate-pulse [animation-duration:1s] opacity-20">│</span>
          </div>
          <Button className="gradient-primary rounded-full text-sm glow-primary transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            Estimer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Image hero avec overlay */}
        <div className="pt-20 w-full relative h-full">
          <span className="w-1/2 h-40 translate-y-36 blur-[100px] opacity-70 bg-primary absolute top-0 left-1/2 -translate-x-1/2"></span>
          <div className="absolute w-full h-80 bg-gradient-to-t to-transparent from-background top-[calc(100%-20rem)] left-0 right-0 z-[9999]"></div>
          
          {/* Mockup du chatbot */}
          <div className="relative max-w-4xl mx-auto">
            <Card className="glassmorphism glow-primary">
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Header du chat */}
                  <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Assistant KAZBA</h3>
                      <p className="text-sm text-muted-foreground">En ligne • Répond instantanément</p>
                    </div>
                    <div className="ml-auto">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>

                  {/* Messages du chat */}
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="glassmorphism rounded-2xl rounded-tl-sm p-4 max-w-md">
                        <p className="text-sm">Bonjour ! Je peux vous aider à estimer votre bien. Pouvez-vous me décrire votre propriété ?</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 justify-end">
                      <div className="bg-primary/20 rounded-2xl rounded-tr-sm p-4 max-w-md">
                        <p className="text-sm">Appartement 3 pièces, 75m², 2ème étage, Paris 11ème</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium">U</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="glassmorphism rounded-2xl rounded-tl-sm p-4 max-w-md">
                        <p className="text-sm mb-3">Parfait ! Basé sur les données du marché local, voici mon estimation :</p>
                        <div className="glassmorphism rounded-lg p-3 border border-primary/20">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">425 000€ - 465 000€</div>
                            <p className="text-xs text-muted-foreground">Estimation basée sur 15 ventes récentes</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Indicateur de frappe */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="glassmorphism rounded-2xl rounded-tl-sm p-4">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Fonctionnalités */}
      <section id="features" className="py-20 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold gradient-text">
              Pourquoi Choisir KAZBA ?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Une solution complète pour révolutionner votre approche de l&apos;estimation immobilière
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="glassmorphism glow-subtle hover:glow-primary transition-all duration-300 group">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Estimation Instantanée</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Obtenez une estimation précise en moins de 30 secondes grâce à notre IA avancée et nos données de marché en temps réel
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="glassmorphism glow-subtle hover:glow-primary transition-all duration-300 group">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Génération de Leads</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Captez automatiquement les coordonnées des prospects intéressés et qualifiez-les selon vos critères
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="glassmorphism glow-subtle hover:glow-primary transition-all duration-300 group">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Analytics Avancées</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Suivez vos performances, analysez vos conversions et optimisez votre stratégie avec des insights détaillés
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Stats */}
      <section className="py-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">98%</div>
              <p className="text-muted-foreground">Précision des estimations</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">2,500+</div>
              <p className="text-muted-foreground">Biens estimés</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">30s</div>
              <p className="text-muted-foreground">Temps d&apos;estimation moyen</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section CTA */}
      <section className="py-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="glassmorphism glow-primary border-primary/20">
            <CardContent className="p-12">
              <h2 className="text-3xl font-bold gradient-text mb-4">
                Prêt à Transformer Votre Business ?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Rejoignez les professionnels qui font confiance à KAZBA pour leurs estimations immobilières
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button className="gradient-primary glow-primary text-lg px-8 py-3 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Star className="mr-2 h-5 w-5" />
                  Commencer Gratuitement
                </Button>
                <Button variant="outline" className="glassmorphism text-lg px-8 py-3">
                  <Phone className="mr-2 h-5 w-5" />
                  Planifier une Démo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold text-lg gradient-text">
                  KAZBA<span className="text-primary">.</span>
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                L&apos;avenir de l&apos;estimation immobilière commence ici.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  contact@kazba.com
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  +33 1 23 45 67 89
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 KAZBA. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 