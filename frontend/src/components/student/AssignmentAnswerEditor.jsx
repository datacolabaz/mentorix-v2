import { lazy, Suspense } from 'react'
import 'react-quill/dist/quill.snow.css'

const ReactQuill = lazy(() => import('react-quill'))

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
}

const FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'list',
  'blockquote',
  'code-block',
  'link',
]

export default function AssignmentAnswerEditor({ value, onChange, readOnly = false }) {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500 py-8 text-center">Redaktor yüklənir…</p>}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        modules={MODULES}
        formats={FORMATS}
      />
    </Suspense>
  )
}
