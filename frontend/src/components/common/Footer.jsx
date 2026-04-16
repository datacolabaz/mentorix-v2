export default function Footer() {
  return (
    <footer className="mt-10 border-t border-indigo-500/15 bg-[#13112e]/60">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <div className="text-center sm:text-left">
            © 2026 Edupanel. Bütün hüquqlar qorunur.
          </div>
          <div className="text-center sm:text-right">
            Powered by{' '}
            <a
              href="https://datacolab.az"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white/70 hover:text-white transition-colors"
            >
              DataColab
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

