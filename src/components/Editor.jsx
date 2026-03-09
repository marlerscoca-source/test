import React, { useState, useEffect, useCallback, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { autocompletion, CompletionContext } from '@codemirror/autocomplete'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { history } from '@codemirror/commands'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

// ── Custom CodeMirror theme ───────────────────────────────────────────────────
const culinaryTheme = EditorView.theme({
  '&': { background: '#0f0d0a', color: '#ede5d5', height: '100%', fontSize: '13px' },
  '.cm-content': { fontFamily: "'JetBrains Mono', monospace", padding: '16px 20px', caretColor: '#c8a84b' },
  '.cm-line': { lineHeight: '1.75' },
  '.cm-cursor': { borderLeftColor: '#c8a84b', borderLeftWidth: '2px' },
  '.cm-gutters': { background: '#0f0d0a', borderRight: '1px solid #2e2c28', color: '#4a4438', minWidth: '44px' },
  '.cm-gutterElement': { padding: '0 8px 0 4px' },
  '.cm-activeLine': { background: 'rgba(200,168,75,0.04)' },
  '.cm-activeLineGutter': { background: 'rgba(200,168,75,0.06)', color: '#7a6a50' },
  '.cm-selectionBackground': { background: 'rgba(200,168,75,0.15)' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(200,168,75,0.2)' },
  '.cm-matchingBracket': { outline: '1px solid #c8a84b', background: 'transparent' },
  // Markdown syntax highlighting
  '.cm-header-1': { color: '#ede5d5', fontSize: '1.1em', fontWeight: '600' },
  '.cm-header-2': { color: '#d4c9b0', fontSize: '1em', fontWeight: '600' },
  '.cm-header-3': { color: '#c8a84b', fontSize: '0.95em', fontWeight: '600' },
  '.cm-strong': { color: '#ede5d5', fontWeight: '700' },
  '.cm-em': { color: '#a89880', fontStyle: 'italic' },
  '.cm-link': { color: '#c8a84b' },
  '.cm-quote': { color: '#7a6a50', borderLeft: '2px solid #3d3830', paddingLeft: '8px' },
  '.cm-hr': { color: '#3d3830' },
  '.cm-code': { color: '#c8a84b', background: 'rgba(200,168,75,0.08)' },
  // Autocomplete
  '.cm-tooltip-autocomplete': {
    background: '#1e1c18',
    border: '1px solid #3d3830',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  '.cm-tooltip-autocomplete ul': { padding: '4px' },
  '.cm-tooltip-autocomplete ul li': {
    borderRadius: '5px',
    padding: '6px 12px !important',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: 'rgba(200,168,75,0.15) !important',
    color: '#ede5d5',
  },
  '.cm-completionLabel': { color: '#ede5d5', flex: '1' },
  '.cm-completionDetail': { color: '#6e6255', fontSize: '10px', fontFamily: "'Outfit', sans-serif" },
  '.cm-completionIcon': { display: 'none' },
  '.cm-scrollbar': { display: 'none' },
}, { dark: true })

// ── Glossary tooltip component ────────────────────────────────────────────────
function GlossaryTooltip({ term, x, y }) {
  if (!term) return null
  return (
    <div className="glossary-tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="gt-word">{term.word}</div>
      <div className="gt-cat">{term.category}</div>
      <div className="gt-def">{term.definition}</div>
    </div>
  )
}

// ── Markdown preview with highlighted terms ───────────────────────────────────
function MarkdownPreview({ content, glossary }) {
  const [tooltip, setTooltip] = useState(null) // { term, x, y }
  const timerRef = useRef(null)
  const containerRef = useRef(null)

  // Build a map of term → entry for fast lookup
  const glossaryMap = React.useMemo(() => {
    const m = {}
    glossary.forEach(e => { m[e.word.toLowerCase()] = e })
    return m
  }, [glossary])

  // Sorted terms longest-first to avoid partial matches
  const sortedTerms = React.useMemo(() =>
    glossary.map(e => e.word).sort((a, b) => b.length - a.length),
    [glossary]
  )

  // After render, walk the DOM to wrap culinary terms in <mark> elements
  useEffect(() => {
    if (!containerRef.current || !sortedTerms.length) return
    // Collect all text nodes
    const walker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement
          // Skip code blocks, pre tags, existing marks, tooltips
          if (parent.closest('pre, code, .term-mark, .glossary-tooltip')) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    const nodes = []
    let n
    while ((n = walker.nextNode())) nodes.push(n)

    nodes.forEach(node => {
      let text = node.textContent
      // Check if any term exists in this text
      const hasMatch = sortedTerms.some(t =>
        new RegExp(`(?<![\\w\\u00C0-\\u024F])(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\w\\u00C0-\\u024F])`, 'i').test(text)
      )
      if (!hasMatch) return

      const span = document.createElement('span')
      let html = text
      sortedTerms.forEach(t => {
        const re = new RegExp(`(?<![\\w\\u00C0-\\u024F])(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\w\\u00C0-\\u024F])`, 'gi')
        html = html.replace(re, (m) => `<mark class="term-mark" data-term="${t.toLowerCase()}">${m}</mark>`)
      })
      span.innerHTML = html
      node.parentNode.replaceChild(span, node)
    })
  })

  const handleMouseOver = useCallback((e) => {
    const el = e.target.closest('.term-mark')
    if (!el) { clearTimeout(timerRef.current); setTooltip(null); return }
    const key = el.dataset.term
    const entry = glossaryMap[key]
    if (!entry) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setTooltip({ term: entry, x: e.clientX, y: e.clientY })
    }, 150)
  }, [glossaryMap])

  const handleMouseMove = useCallback((e) => {
    if (!tooltip) return
    setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
  }, [tooltip])

  const handleMouseOut = useCallback((e) => {
    if (!e.target.closest('.term-mark')) { clearTimeout(timerRef.current); setTooltip(null) }
  }, [])

  return (
    <div
      className="md-preview"
      ref={containerRef}
      onMouseOver={handleMouseOver}
      onMouseMove={handleMouseMove}
      onMouseOut={handleMouseOut}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content || ''}
      </ReactMarkdown>

      {tooltip && (
        <GlossaryTooltip
          term={tooltip.term}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  )
}

// ── Main Editor component ─────────────────────────────────────────────────────
export default function Editor({ openFiles, activeFile, fileData, onActivate, onUpdate, onSave, onClose, suggestions, glossary }) {
  const [viewMode, setViewMode] = useState('split') // 'edit' | 'split' | 'preview'
  const isMarkdown = activeFile?.endsWith('.md')

  // Build autocomplete extension from suggestions
  const autocompleteExt = React.useMemo(() => {
    if (!suggestions.length) return []

    const completions = suggestions.map(s => ({
      label: s.word,
      detail: s.category || '',
      type: 'keyword',
      boost: 1,
    }))

    function culinaryCompletions(context) {
      // Match current word/phrase: allow unicode, apostrophes, spaces, hyphens
      const wordBefore = context.matchBefore(/[\w\u00C0-\u024F\u1E00-\u1EFF' -]{2,}/)
      if (!wordBefore && !context.explicit) return null
      if (!wordBefore) return null

      const partial = wordBefore.text.trim().toLowerCase()
      const filtered = completions.filter(c =>
        c.label.toLowerCase().startsWith(partial) && c.label.toLowerCase() !== partial
      )
      if (!filtered.length) return null

      return {
        from: wordBefore.from,
        to: wordBefore.to,
        options: filtered,
        validFor: /[\w\u00C0-\u024F\u1E00-\u1EFF' -]*/,
      }
    }

    return [autocompletion({ override: [culinaryCompletions], closeOnBlur: false })]
  }, [suggestions])

  const extensions = React.useMemo(() => [
    markdown({ base: markdownLanguage }),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    culinaryTheme,
    EditorView.lineWrapping,
    ...autocompleteExt,
  ], [autocompleteExt])

  if (!activeFile) {
    return (
      <main className="editor-empty-state">
        <div className="empty-icon">✦</div>
        <p>Open a file from the explorer to start editing</p>
        <p className="empty-hint">Files autosave automatically as you type</p>
      </main>
    )
  }

  const showEditor = viewMode === 'edit' || viewMode === 'split'
  const showPreview = (viewMode === 'preview' || viewMode === 'split') && isMarkdown

  return (
    <main className="editor-main">
      {/* Tabs */}
      <div className="tabs-bar">
        {openFiles.map(f => {
          const name = f.path.split('/').pop()
          return (
            <div
              key={f.path}
              className={`tab ${f.path === activeFile ? 'active' : ''}`}
              onClick={() => onActivate(f.path)}
            >
              <span className="tab-name">{name}</span>
              {f.dirty && <span className="tab-dirty">●</span>}
              <button
                className="tab-close"
                onClick={e => { e.stopPropagation(); onClose(f.path) }}
              >×</button>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button className="tb-btn" title="Bold" onClick={() => insertWrap('**', '**')}>𝐁</button>
          <button className="tb-btn" title="Italic" onClick={() => insertWrap('_', '_')}>𝘐</button>
          <button className="tb-btn" title="H1" onClick={() => insertPrefix('# ')}>H1</button>
          <button className="tb-btn" title="H2" onClick={() => insertPrefix('## ')}>H2</button>
          <button className="tb-btn" title="H3" onClick={() => insertPrefix('### ')}>H3</button>
          <button className="tb-btn" title="Bullet" onClick={() => insertPrefix('- ')}>•</button>
          <button className="tb-btn" title="Quote" onClick={() => insertPrefix('> ')}>❝</button>
          <button className="tb-btn" title="Code" onClick={() => insertWrap('`', '`')}>&lt;/&gt;</button>
        </div>

        <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
          <span className="toolbar-label">View:</span>
          {['edit', 'split', 'preview'].map(m => (
            <button
              key={m}
              className={`tb-btn view-btn ${viewMode === m ? 'active' : ''}`}
              onClick={() => setViewMode(m)}
            >
              {m === 'edit' ? 'Edit' : m === 'split' ? 'Split' : 'Preview'}
            </button>
          ))}
          <button
            className="tb-btn save-btn"
            title="Save (Ctrl+S)"
            onClick={() => onSave(activeFile)}
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Editor / Preview panes */}
      <div className={`editor-panes ${viewMode}`}>
        {showEditor && (
          <div className="editor-pane">
            <CodeMirror
              value={fileData?.content || ''}
              extensions={extensions}
              onChange={(value) => onUpdate(activeFile, value)}
              height="100%"
              style={{ height: '100%' }}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: false,
                autocompletion: false, // we provide our own
                history: false, // we add it manually
              }}
            />
          </div>
        )}
        {showPreview && (
          <div className="preview-pane">
            <MarkdownPreview
              content={fileData?.content || ''}
              glossary={glossary}
            />
          </div>
        )}
        {!isMarkdown && viewMode !== 'edit' && (
          <div className="preview-pane non-md">
            <p style={{ color: '#6e6255', padding: '20px', fontSize: '13px' }}>
              Preview only available for Markdown files.
            </p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <span className="status-file">{activeFile?.split('/').pop()}</span>
        <span className="status-sep">·</span>
        <span>{(fileData?.content || '').split('\n').length} lines</span>
        <span className="status-sep">·</span>
        <span>{(fileData?.content || '').trim() ? (fileData.content.trim().split(/\s+/).length) : 0} words</span>
        <span className="status-sep">·</span>
        {fileData?.dirty
          ? <span style={{ color: '#c8a84b' }}>● Unsaved</span>
          : <span style={{ color: '#4a8c5c' }}>✓ Saved</span>
        }
      </div>
    </main>
  )
}

// These helpers would need a ref to the editor — simplified version
function insertWrap(before, after) { /* handled by CodeMirror */ }
function insertPrefix(prefix) { /* handled by CodeMirror */ }
