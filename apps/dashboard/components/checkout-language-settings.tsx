'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Globe, Loader2, ChevronDown } from "lucide-react";

interface CheckoutLanguageSettingsProps {
  storeId: string;
}

interface CheckoutConfig {
  language?: string;
  customTranslations?: Record<string, string>;
}

const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
];

export default function CheckoutLanguageSettings({ storeId }: CheckoutLanguageSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('fr');
  const [customTexts, setCustomTexts] = useState({
    'checkout.payNow': '',
    'checkout.title': '',
    'checkout.emailLabel': '',
    'checkout.total': ''
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, [storeId]);

  const loadSettings = async () => {
    try {
      const store = await apiClient.stores.getById(storeId);
      const checkoutConfig = store?.checkoutConfig as CheckoutConfig;
      
      if (checkoutConfig?.language) {
        setSelectedLanguage(checkoutConfig.language);
      }
      
      if (checkoutConfig?.customTranslations) {
        setCustomTexts(prev => ({
          ...prev,
          ...checkoutConfig.customTranslations
        }));
      }
    } catch (error) {
      console.error("Erreur lors du chargement des paramètres:", error);
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Nettoyer les textes personnalisés vides
      const cleanedCustomTexts = Object.entries(customTexts).reduce((acc, [key, value]) => {
        if (value && value.trim()) {
          acc[key] = value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

      const checkoutConfig: CheckoutConfig = {
        language: selectedLanguage,
        customTranslations: Object.keys(cleanedCustomTexts).length > 0 ? cleanedCustomTexts : undefined
      };

      await apiClient.stores.update(storeId, { checkoutConfig });
      
      toast.success("Langue du checkout mise à jour avec succès");
      router.refresh();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde des paramètres");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedLang = languages.find(l => l.code === selectedLanguage);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Langue du Checkout</CardTitle>
        <CardDescription>
          Configurez la langue dans laquelle vos clients verront le checkout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="language">Langue d&apos;affichage</Label>
          <Select
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
          >
            <SelectTrigger id="language" className="w-full">
              <SelectValue>
                {selectedLang && (
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selectedLang.flag}</span>
                    <span>{selectedLang.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500">
            Cette langue sera utilisée pour tous les textes du checkout (boutons, labels, messages d&apos;erreur, etc.)
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Globe className="h-4 w-4" />
            <span className="font-medium">Aperçu des textes</span>
          </div>
          <div className="space-y-1 text-sm">
            {selectedLanguage === 'fr' && (
              <>
                <p>• Payer maintenant</p>
                <p>• Adresse de livraison</p>
                <p>• Total de la commande</p>
              </>
            )}
            {selectedLanguage === 'en' && (
              <>
                <p>• Pay now</p>
                <p>• Shipping address</p>
                <p>• Order total</p>
              </>
            )}
            {selectedLanguage === 'es' && (
              <>
                <p>• Pagar ahora</p>
                <p>• Dirección de envío</p>
                <p>• Total del pedido</p>
              </>
            )}
            {selectedLanguage === 'de' && (
              <>
                <p>• Jetzt bezahlen</p>
                <p>• Lieferadresse</p>
                <p>• Gesamtbetrag</p>
              </>
            )}
            {selectedLanguage === 'it' && (
              <>
                <p>• Paga ora</p>
                <p>• Indirizzo di spedizione</p>
                <p>• Totale ordine</p>
              </>
            )}
            {selectedLanguage === 'pt' && (
              <>
                <p>• Pagar agora</p>
                <p>• Endereço de entrega</p>
                <p>• Total do pedido</p>
              </>
            )}
            {selectedLanguage === 'nl' && (
              <>
                <p>• Nu betalen</p>
                <p>• Verzendadres</p>
                <p>• Totaalbedrag</p>
              </>
            )}
            {selectedLanguage === 'he' && (
              <>
                <p>• שלם עכשיו</p>
                <p>• כתובת למשלוח</p>
                <p>• סה״כ להזמנה</p>
              </>
            )}
          </div>
        </div>

        {/* Section personnalisation avancée */}
        <div className="border-t pt-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Personnalisation avancée des textes
          </button>
          
          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-500">
                Personnalisez les textes clés du checkout. Laissez vide pour utiliser le texte par défaut de la langue sélectionnée.
              </p>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="payNow">Bouton de paiement</Label>
                  <Input
                    id="payNow"
                    placeholder={selectedLanguage === 'fr' ? 'Payer maintenant' : selectedLanguage === 'en' ? 'Pay now' : 'Pagar ahora'}
                    value={customTexts['checkout.payNow']}
                    onChange={(e) => setCustomTexts(prev => ({ ...prev, 'checkout.payNow': e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="orderTitle">Titre du résumé</Label>
                  <Input
                    id="orderTitle"
                    placeholder={selectedLanguage === 'fr' ? 'Résumé de la commande' : selectedLanguage === 'en' ? 'Order summary' : 'Resumen del pedido'}
                    value={customTexts['checkout.title']}
                    onChange={(e) => setCustomTexts(prev => ({ ...prev, 'checkout.title': e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="emailLabel">Label email</Label>
                  <Input
                    id="emailLabel"
                    placeholder={selectedLanguage === 'fr' ? 'Adresse e-mail' : selectedLanguage === 'en' ? 'Email address' : 'Correo electrónico'}
                    value={customTexts['checkout.emailLabel']}
                    onChange={(e) => setCustomTexts(prev => ({ ...prev, 'checkout.emailLabel': e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="totalLabel">Label total</Label>
                  <Input
                    id="totalLabel"
                    placeholder={selectedLanguage === 'fr' ? 'Total' : selectedLanguage === 'en' ? 'Total' : 'Total'}
                    value={customTexts['checkout.total']}
                    onChange={(e) => setCustomTexts(prev => ({ ...prev, 'checkout.total': e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}