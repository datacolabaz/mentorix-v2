import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../constants/subscriptionPlans'

export const SUBSCRIPTION_PLANS_QUERY_KEY = ['subscriptionPlansPublic']

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: SUBSCRIPTION_PLANS_QUERY_KEY,
    queryFn: async () => {
      const d = await api.get('/public/subscription-plans')
      const plans = Array.isArray(d?.plans) ? d.plans : []
      return plans.length ? plans : DEFAULT_SUBSCRIPTION_PLANS
    },
    placeholderData: keepPreviousData,
  })
}

