'use client'

import Link from 'next/link'
import { useTranslations } from '@/components/translations-provider'

export default function NotFoundClient() {
  const { t } = useTranslations()
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <div className="mb-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('errors.404')}</h1>
          <h2 className="text-xl font-semibold text-gray-700">{t('errors.cartNotFound')}</h2>
        </div>
        <p className="text-gray-600 mb-6">
          {t('errors.cartNotFoundMessage')}
        </p>
        <Link 
          href="/" 
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('errors.returnToHome')}
        </Link>
      </div>
    </div>
  )
}