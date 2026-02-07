import ThankYouClient from './thank-you-client';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{
    checkoutId: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  
  return {
    title: `Confirmation de commande`,
    description: 'Votre commande a été confirmée avec succès. Merci pour votre achat !',
  };
}

export default async function ThankYouPage({ params }: PageProps) {
  const { checkoutId } = await params;

  return (
    <ThankYouClient checkoutId={checkoutId} />
  )
}
