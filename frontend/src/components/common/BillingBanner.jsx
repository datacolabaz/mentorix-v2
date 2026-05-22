import Button from './Button'
import useUiStore from '../../hooks/useUi'

function stylesByStatus(theme) {
  const light = theme !== 'dark'
  return {
    warning: {
      wrap: light
        ? 'border-amber-600/30 bg-amber-50 text-amber-950'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      title: 'Diqqət',
      ctaClass: light
        ? '!text-amber-950 !border-amber-700/30 hover:!bg-amber-100/70'
        : '',
    },
    grace: {
      wrap: light
        ? 'border-amber-600/30 bg-amber-50 text-amber-950'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
      title: 'Ödəniş gecikib',
      ctaClass: light
        ? '!text-amber-950 !border-amber-700/30 hover:!bg-amber-100/70'
        : '',
    },
    blocked: {
      wrap: light
        ? 'border-rose-600/30 bg-rose-50 text-rose-950'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      title: 'Limit',
      ctaClass: '',
    },
    expired: {
      wrap: light
        ? 'border-rose-600/30 bg-rose-50 text-rose-950'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      title: 'Abunəlik',
      ctaClass: '',
    },
    active: null,
  }
}

export default function BillingBanner({ status, banner, cta, onCta }) {
  const { theme } = useUiStore()
  const s = String(status