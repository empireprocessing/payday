import CheckoutLanguageSettings from "@/components/checkout-language-settings";

export default async function CheckoutLanguagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutLanguageSettings storeId={id} />;
}