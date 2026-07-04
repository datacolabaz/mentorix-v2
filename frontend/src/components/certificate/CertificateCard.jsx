import { buildCertificateViewModel, COLORS } from '@shared/certificateLayout.mjs'

/**
 * Shared certificate card — landing mockup and previews use the same layout as PDF output.
 * @param {object} props
 * @param {object} [props.data] raw certificate fields
 * @param {string} [props.locale='az']
 * @param {boolean} [props.showQrPlaceholder=true]
 * @param {string} [props.className]
 */
export default function CertificateCard({ data = {}, locale = 'az', showQrPlaceholder = true, className = '' }) {
  const vm = buildCertificateViewModel(data, locale)

  return (
    <div
      className={`relative rounded-xl border border-white/15 overflow-hidden shadow-2xl ${className}`}
      style={{
        background: `linear-gradient(to bottom right, ${COLORS.bgGradientFrom}, ${COLORS.bgDark}, ${COLORS.bgDeep})`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ background: `radial-gradient(circle at 20% 20%, ${COLORS.primary}, transparent 45%)` }}
        aria-hidden
      />
      <div className="relative p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold border"
            style={{ color: COLORS.primary, borderColor: `${COLORS.primary}4D`, backgroundColor: `${COLORS.primary}33` }}
          >
            M
          </div>
          <span className="text-[9px] uppercase tracking-widest text-gray-500">{vm.certLabel}</span>
        </div>

        <div className="text-center space-y-1 py-2">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: `${COLORS.primary}CC` }}>
            {vm.issuedLabel}
          </p>
          <p className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">{vm.studentName}</p>
          <p className="text-[11px] text-gray-400">{vm.courseTitle}</p>
          <p className="text-[10px] text-gray-500">{vm.completedLabel}</p>
        </div>

        <div className="flex items-end justify-between gap-3 pt-2 border-t border-white/10">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[9px] text-gray-500 uppercase">{vm.scoreLabel}</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: COLORS.primary }}>
              {vm.scorePct}
            </p>
          </div>
          {showQrPlaceholder ? (
            <div className="h-12 w-12 shrink-0 rounded-md border border-dashed border-white/20 bg-white/5 flex items-center justify-center">
              <span className="text-[8px] text-gray-500 text-center leading-tight">QR</span>
            </div>
          ) : (
            <div className="h-12 w-12 shrink-0" aria-hidden />
          )}
          <div className="space-y-0.5 text-right min-w-0">
            <p className="text-[9px] text-gray-500 uppercase">{vm.dateLabel}</p>
            <p className="text-[11px] text-gray-300 tabular-nums">{vm.dateFormatted}</p>
          </div>
        </div>

        <p className="text-[9px] text-gray-500 pt-1">{vm.instructorLine}</p>

        <div className="flex justify-center pt-1">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm"
            style={{ color: COLORS.primary, borderColor: `${COLORS.primary}59`, backgroundColor: `${COLORS.primary}1A` }}
          >
            <span aria-hidden>🔒</span> {vm.verifyLabel}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 pt-2 border-t border-white/5">
          <p className="text-[8px] text-gray-500 leading-snug max-w-[75%]">{vm.disclaimer}</p>
          <p className="text-[8px] text-gray-500 tabular-nums shrink-0 sm:text-right">{vm.certIdLine}</p>
        </div>
      </div>
    </div>
  )
}
