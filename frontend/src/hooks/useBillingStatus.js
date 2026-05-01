import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export const BILLING_STATUS_QUERY_KEY = ['billingStatus']

export function useBillingStatus() {
  return useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: async () => {
      // Backend is the source of truth; frontend only renders states.
      return await api.get('/billing/status')
    },
    placeholderData: keepPreviousData,
  })
}

