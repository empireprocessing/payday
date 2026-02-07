'use client'

import { useRef, useCallback } from 'react'
import {
    trackCustomerInfoProgress,
    trackCustomerInfoEntered,
    trackPaymentInfoStarted,
    trackPaymentInfoCompleted,
    trackPayButtonClicked,
    trackPaymentAttempted,
    trackPaymentSuccessful,
    trackPaymentFailed
} from './checkout-tracking-actions'

interface UseCheckoutTrackingProps {
  checkoutId: string
}

export function useCheckoutTracking({ checkoutId }: UseCheckoutTrackingProps) {
  // Utiliser des refs pour éviter les doublons d'événements
  const trackedEvents = useRef<Set<string>>(new Set())
  const hasTrackedCustomerInfoStarted = useRef(false)

  const trackEvent = useCallback((eventName: string, trackingFunction: () => Promise<void>) => {
    const eventKey = `${checkoutId}-${eventName}`
    
    if (trackedEvents.current.has(eventKey)) {
      return // Événement déjà tracké
    }

    trackedEvents.current.add(eventKey)
    trackingFunction()
  }, [checkoutId])

  // checkout-initiated est tracké côté API, pas côté client

  const trackCustomerInfoProgressEvent = useCallback((metadata?: Record<string, unknown>) => {
    // Pour customer-info-progress, permettre les mises à jour (pas de protection contre les doublons)
    trackCustomerInfoProgress(checkoutId, metadata)
  }, [checkoutId])

  const trackCustomerInfoEnteredEvent = useCallback((metadata?: Record<string, unknown>) => {
    trackEvent('customer-info-entered', () => trackCustomerInfoEntered(checkoutId, metadata))
  }, [trackEvent, checkoutId])

  const trackPaymentInfoStartedEvent = useCallback((metadata?: Record<string, unknown>) => {
    // Pour payment-info-started, permettre les mises à jour (pas de protection contre les doublons)
    trackPaymentInfoStarted(checkoutId, metadata)
  }, [checkoutId])

  const trackPaymentInfoCompletedEvent = useCallback((metadata?: Record<string, unknown>) => {
    trackEvent('payment-info-completed', () => trackPaymentInfoCompleted(checkoutId, metadata))
  }, [trackEvent, checkoutId])

  const trackPayButtonClickedEvent = useCallback((metadata?: Record<string, unknown>) => {
    trackEvent('pay-button-clicked', () => trackPayButtonClicked(checkoutId, metadata))
  }, [trackEvent, checkoutId])

  const trackPaymentAttemptedEvent = useCallback((metadata?: Record<string, unknown>) => {
    trackEvent('payment-attempted', () => trackPaymentAttempted(checkoutId, metadata))
  }, [trackEvent, checkoutId])

  const trackPaymentSuccessfulEvent = useCallback((metadata?: Record<string, unknown>) => {
    trackEvent('payment-successful', () => trackPaymentSuccessful(checkoutId, metadata))
  }, [trackEvent, checkoutId])

  const trackPaymentFailedEvent = useCallback((metadata?: Record<string, unknown>) => {
    trackEvent('payment-failed', () => trackPaymentFailed(checkoutId, metadata))
  }, [trackEvent, checkoutId])

  return {
    trackCustomerInfoProgress: trackCustomerInfoProgressEvent,
    trackCustomerInfoEntered: trackCustomerInfoEnteredEvent,
    trackPaymentInfoStarted: trackPaymentInfoStartedEvent,
    trackPaymentInfoCompleted: trackPaymentInfoCompletedEvent,
    trackPayButtonClicked: trackPayButtonClickedEvent,
    trackPaymentAttempted: trackPaymentAttemptedEvent,
    trackPaymentSuccessful: trackPaymentSuccessfulEvent,
    trackPaymentFailed: trackPaymentFailedEvent,
  }
}
