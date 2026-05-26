import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export const BILLING_CONFIG_QUERY_KEY = ['billingConfig']

export function useBillingConfig() {
  return useQuery({
    queryKey: BILLING_CONFIG_QUERY_KEY,
    queryFn: () => api.get('/billing/config'),
    staleTime: 60_000,
  })
}
