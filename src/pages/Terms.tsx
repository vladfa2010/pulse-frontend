import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import termsRaw from '../assets/terms-of-use.md?raw'
import { renderMarkdown, stripTableOfContents } from '../lib/markdownDoc'

export default function Terms() {
  const blocks = renderMarkdown(stripTableOfContents(termsRaw))

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Условия использования</h1>
        </div>

        <div className="space-y-4 text-text-secondary leading-relaxed">{blocks}</div>
      </div>
    </div>
  )
}
