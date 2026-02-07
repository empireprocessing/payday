'use client'

import React from 'react'
import {
  BasisTheoryProvider,
  useBasisTheory,
} from '@basis-theory/react-elements'

interface BTProviderProps {
  children: React.ReactNode
}

export function BTProvider({ children }: BTProviderProps) {
  const { bt } = useBasisTheory(
    process.env.NEXT_PUBLIC_BASIS_THEORY_PUBLIC_KEY!,
    { elements: true }
  )

  return (
    <BasisTheoryProvider bt={bt}>
      {children}
    </BasisTheoryProvider>
  )
}
