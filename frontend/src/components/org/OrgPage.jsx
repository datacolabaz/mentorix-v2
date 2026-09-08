import { useTranslation } from 'react-i18next'
import Card from '../common/Card'

export default function OrgPage({ title, description, actions, children, dense = false }) {
  return (
    <div className={`p-4 sm:p-6 min-w-0 w-full ${dense ? 'max-w-7xl' : 'max-w-7xl'} mx-auto space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-token-textMuted text-sm mt-1 max-w-2xl leading-relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function OrgPanel({ title, children, className = '' }) {
  return (
    <Card className={`border border-white/10 overflow-hidden ${className}`}>
      {title ? (
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-token-textMuted">{title}</h2>
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </Card>
  )
}

export function OrgEmpty({ children }) {
  return (
    <p className="text-sm text-token-textMuted leading-relaxed">{children}</p>
  )
}

export function OrgTable({ columns, rows, rowKey = 'id', empty }) {
  const { t } = useTranslation()
  if (!rows?.length) {
    return empty || <OrgEmpty>{t('org.common.noData')}</OrgEmpty>
  }
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-token-textMuted">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-semibold whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} className="border-b border-white/5 hover:bg-white/[0.03]">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2.5 align-top text-token-textMain">
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
