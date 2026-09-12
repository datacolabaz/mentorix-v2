import { Component } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

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
          className="w-full min-h-[280px] rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-4 py-3 text-sm text-token-textMain outline-none focus:border-primary/40 resize-y placeholder:text-token-textMuted"
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
      <div className="min-h-[320px]">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          modules={MODULES}
          formats={FORMATS}
        />
      </div>
    </QuillErrorBoundary>
  )
}
