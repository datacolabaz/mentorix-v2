import { Component, lazy, Suspense } from 'react'

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

class QuillErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(err) {
    console.error('[AssignmentAnswerEditor]', err)
  }

  render() {
    if (this.state.failed) {
      return (
        <textarea
          className="w-full min-h-[280px] rounded-xl border border-indigo-500/20 bg-[#13112e] px-4 py-3 text-sm text-gray-100 outline-none focus:border-blue-500 resize-y"
          value={this.props.value || ''}
          onChange={(e) => this.props.onChange?.(e.target.value)}
          readOnly={this.props.readOnly}
          placeholder="Cavabınızı yazın…"
        />
      )
    }
    return this.props.children
  }
}

export default function AssignmentAnswerEditor({ value, onChange, readOnly = false }) {
  return (
    <QuillErrorBoundary value={value} onChange={onChange} readOnly={readOnly}>
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
    </QuillErrorBoundary>
  )
}
