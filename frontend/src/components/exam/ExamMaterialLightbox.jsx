import Modal from '../common/Modal'
import Button from '../common/Button'

export default function ExamMaterialLightbox({ open, onClose, title, src, isPdf, openInNewTabUrl }) {
  return (
    <Modal open={open} onClose={onClose} title={title || 'Material'} size="xl">
      <div className="space-y-3">
        <div className="rounded-xl border border-indigo-500/20 bg-black/40 overflow-hidden min-h-[60vh] max-h-[78vh] flex flex-col">
          {isPdf ? (
            <iframe
              title={title || 'PDF'}
              src={src || undefined}
              className="w-full flex-1 min-h-[58vh] bg-white border-0"
            />
          ) : (
            <img
              src={src || undefined}
              alt={title || ''}
              className="w-full h-full max-h-[78vh] object-contain bg-black/50"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {openInNewTabUrl ? (
            <a href={openInNewTabUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                Yeni pəncərədə aç
              </Button>
            </a>
          ) : null}
          <Button size="sm" onClick={onClose}>
            Bağla
          </Button>
        </div>
      </div>
    </Modal>
  )
}
