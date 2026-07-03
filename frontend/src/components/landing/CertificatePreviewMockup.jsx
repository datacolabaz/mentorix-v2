/** Sertifikat mockup — landing/kataloq üçün vizual nümunə */
export default function CertificatePreviewMockup({ className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-3 rounded-2xl bg-primary/20 blur-2xl opacity-60" aria-hidden />
      <div className="relative rounded-xl border border-white/15 bg-gradient-to-br from-[#1a1740] via-[#13112e] to-[#0b0b0b] p-4 sm:p-5 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_20%_20%,#00E676,transparent_45%)]" aria-hidden />
        <div className="relative space-y-3 blur-[0.3px]">
          <div className="flex items-start justify-between gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
              M
            </div>
            <span className="text-[9px] uppercase tracking-widest text-gray-500">Mentorix Certificate</span>
          </div>
          <div className="text-center space-y-1 py-2">
            <p className="text-[10px] uppercase tracking-wider text-primary/80">Sertifikat verilir</p>
            <p className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">Sənin Adın</p>
            <p className="text-[11px] text-gray-400">Data Analytics Professional Certification</p>
          </div>
          <div className="flex items-end justify-between gap-3 pt-2 border-t border-white/10">
            <div className="space-y-0.5">
              <p className="text-[9px] text-gray-500 uppercase">Bal</p>
              <p className="text-sm font-semibold text-primary tabular-nums">87%</p>
            </div>
            <div className="h-12 w-12 rounded-md border border-dashed border-white/20 bg-white/5 flex items-center justify-center">
              <span className="text-[8px] text-gray-500 text-center leading-tight">QR</span>
            </div>
            <div className="space-y-0.5 text-right">
              <p className="text-[9px] text-gray-500 uppercase">Tarix</p>
              <p className="text-[11px] text-gray-300 tabular-nums">2026</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary backdrop-blur-sm">
            <span aria-hidden>🔒</span> QR kodu ilə doğrulanır
          </span>
        </div>
      </div>
    </div>
  )
}
