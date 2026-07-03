import ExamMaterialPreview from './ExamMaterialPreview'
import { materialFileApiPath, useExamMaterialBlobs } from '../../hooks/useExamMaterialBlobs'

export default function ReviewExamFilesPanel({
  examId,
  files,
  resolveMaterialUrl,
  materialOpenInNewTabUrl,
  shouldUsePdfIframe,
}) {
  const blobById = useExamMaterialBlobs(examId, files)

  if (!files?.length) return null

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-white mb-2">İmtahan sualları</h3>
      <p className="text-xs text-gray-500 mb-3">
        Suallar bu imtahana əlavə edilmiş fayllardır. PDF və ya şəkli böyütmək üçün üzərinə toxunun.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {files.map((f) => {
          const needsProtectedFetch = Boolean(materialFileApiPath(f.url, examId))
          const blobEntry = blobById[f.id]
          const materialLoading = needsProtectedFetch && !(f.id in blobById)
          const materialFailed = needsProtectedFetch && f.id in blobById && blobEntry === null
          const mediaSrc = needsProtectedFetch
            ? blobEntry === undefined
              ? undefined
              : blobEntry === null
                ? resolveMaterialUrl(f.url)
                : blobEntry
            : resolveMaterialUrl(f.url)
          const showPdfFrame = shouldUsePdfIframe(f)
          return (
            <ExamMaterialPreview
              key={f.id || f.url}
              material={f}
              mediaSrc={mediaSrc}
              showPdfFrame={showPdfFrame}
              openInNewTabUrl={materialOpenInNewTabUrl(f.url, examId)}
              compact
              loading={materialLoading}
              failed={materialFailed}
            />
          )
        })}
      </div>
    </div>
  )
}
