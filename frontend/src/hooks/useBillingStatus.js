import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'

export const BILLING_STATUS_QUERY_KEY = ['billingStatus']

export function useBillingStatus() {
  const { i18n } = useTranslation()
  const locale = i18n.language || 'az'
  return useQuery({
    queryKey: [...BILLING_STATUS_QUERY_KEY, locale],
    queryFn: async () => {
      // Backend is the source of truth; frontend only renders states.
      return await api.get('/billing/status')
    },
    placeholderData: keepPreviousData,
  })
}

