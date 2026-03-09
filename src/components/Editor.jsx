import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  linkPlugin,
  linkDialogPlugin,
  CreateLink,
  Separator,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

// ─── Glossary tooltip ─────────────────────────────────────────────────────────
function GlossaryTooltip({ term, x, y }) {
  if (!term) return null
  const safeX = Math.min(x + 16, window.innerWidth - 300)
  const safeY = Math.min(y + 16, window.innerHeight - 140)
  return (
    <div className="glossary-tooltip" style={{ left: safeX, top: safeY }}>
      <div className="gt-word">{term.word}</div>
      <div className="gt-cat">{term.category}</div>
      <div className="gt-def">{term.definition}</div>
    </div>
  )
}

// ─── Autosuggestion dropdown ──────────────────────────────────────────────────
function AutoSuggest({ suggestions, query, position, onAccept, onDismiss }) {
  const [idx, setIdx] = useState(0)

  const filtered = useMemo(
    () =>
      suggestions
        .filter(
          s =>
            s.word.toLowerCase().startsWith(query.toLowerCase()) &&
            s.word.toLowerCase() !== query.toLowerCase()
        )
        .slice(0, 8),
    [suggestions, query]
  )

  useEffect(() => setIdx(0), [query])

  useEffect(() => {
    if (!filtered.length) return
    const handler = e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setIdx(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (filtered[idx]) onAccept(filtered[idx].word)
      } else if (e.key === 'Escape') {
        e.stopPropagation(); onDismiss()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [filtered, idx, onAccept, onDismiss])

  if (!filtered.length) return null

  return (
    <div
      className="autosuggest-popup"
      style={{ left: position.x, top: position.y + 6 }}
    >
      {filtered.map((s, i) => (
        <div
          key={s.word}
          className={`as-item ${i === idx ? 'selected' : ''}`}
          onMouseDown={e => { e.preventDefault(); onAccept(s.word) }}
          onMouseEnter={() => setIdx(i)}
        >
          <span className="as-word">{s.word}</span>
          <span className="as-cat">{s.category}</span>
        </div>
      ))}
      <div className="as-hint">Tab / ↵ to insert · Esc to dismiss</div>
    </div>
  )
}

// ─── Main Editor component ────────────────────────────────────────────────────
export default function Editor({
  openFiles,
  activeFile,
  fileData,
  onActivate,
  onUpdate,
  onSave,
  onClose,
  suggestions,
  glossary,
}) {
  const wrapRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [suggest, setSuggest] = useState(null)
  const tipTimer = useRef(null)
  const highlightRaf = useRef(null)

  // ─── Glossary maps ───────────────────────────────────────────────────────
  const glossaryMap = useMemo(() => {
    const m = {}
    glossary.forEach(e => { m[e.word.toLowerCase()] = e })
    return m
  }, [glossary])

  const sortedTerms = useMemo(
    () => glossary.map(e => e.word).sort((a, b) => b.length - a.length),
    [glossary]
  )

  // ─── Highlight culinary terms in the WYSIWYG DOM ─────────────────────────
  // We use a MutationObserver on the contenteditable. On each change we walk
  // text nodes and wrap matching terms in <span class="cm-term">.
  useEffect(() => {
    if (!sortedTerms.length) return

    const allRe = new RegExp(
      '(?<![\\w\\u00C0-\\u024F])(' +
        sortedTerms
          .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|') +
        ')(?![\\w\\u00C0-\\u024F])',
      'gi'
    )

    function doHighlight(root) {
      // Strip old highlights without breaking the DOM
      root.querySelectorAll('.cm-term').forEach(el => {
        el.replaceWith(document.createTextNode(el.textContent))
      })
      // Merge adjacent text nodes
      root.normalize()

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentElement
          if (!p) return NodeFilter.FILTER_REJECT
          if (p.closest('pre, code, .cm-term')) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })

      const nodes = []
      let n
      while ((n = walker.nextNode())) nodes.push(n)

      nodes.forEach(node => {
        const text = node.textContent
        allRe.lastIndex = 0
        if (!allRe.test(text)) return
        allRe.lastIndex = 0

        const frag = document.createDocumentFragment()
        let last = 0
        let m
        while ((m = allRe.exec(text)) !== null) {
          if (m.index > last)
            frag.appendChild(document.createTextNode(text.slice(last, m.index)))
          const span = document.createElement('span')
          span.className = 'cm-term'
          span.dataset.term = m[0].toLowerCase()
          span.textContent = m[0]
          frag.appendChild(span)
          last = m.index + m[0].length
        }
        if (last < text.length)
          frag.appendChild(document.createTextNode(text.slice(last)))

        node.parentNode.replaceChild(frag, node)
      })
    }

    function scheduleHighlight() {
      cancelAnimationFrame(highlightRaf.current)
      highlightRaf.current = requestAnimationFrame(() => {
        const ce = wrapRef.current?.querySelector('[contenteditable="true"]')
        if (ce) doHighlight(ce)
      })
    }

    // Wait a tick for MDXEditor to mount its contenteditable
    const timer = setTimeout(() => {
      const ce = wrapRef.current?.querySelector('[contenteditable="true"]')
      if (!ce) return

      const obs = new MutationObserver(scheduleHighlight)
      obs.observe(ce, { childList: true, subtree: true, characterData: true })
      scheduleHighlight()

      // cleanup stored on the element so we can tear down on file switch
      ce._highlightObserver = obs
    }, 80)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(highlightRaf.current)
      const ce = wrapRef.current?.querySelector('[contenteditable="true"]')
      ce?._highlightObserver?.disconnect()
    }
  }, [sortedTerms, activeFile])

  // ─── Tooltip on hover ────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onOver = e => {
      const t = e.target.closest('.cm-term')
      if (!t) { clearTimeout(tipTimer.current); setTooltip(null); return }
      const entry = glossaryMap[t.dataset.term]
      if (!entry) return
      clearTimeout(tipTimer.current)
      tipTimer.current = setTimeout(
        () => setTooltip({ term: entry, x: e.clientX, y: e.clientY }),
        160
      )
    }
    const onMove = e => {
      if (e.target.closest('.cm-term'))
        setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : null))
    }
    const onOut = e => {
      if (!e.target.closest('.cm-term')) {
        clearTimeout(tipTimer.current)
        setTooltip(null)
      }
    }

    el.addEventListener('mouseover', onOver)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseout', onOut)
    return () => {
      el.removeEventListener('mouseover', onOver)
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseout', onOut)
    }
  }, [glossaryMap])

  // ─── Autosuggestion: detect current word while typing ────────────────────
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onInput = () => {
      const sel = window.getSelection()
      if (!sel?.rangeCount) { setSuggest(null); return }
      const range = sel.getRangeAt(0)
      const node = range.startContainer
      if (node.nodeType !== Node.TEXT_NODE) { setSuggest(null); return }

      const text = node.textContent
      const off = range.startOffset
      // Walk back to start of word (allow unicode + hyphens + spaces for multi-word terms)
      let i = off - 1
      while (i >= 0 && /[\w\u00C0-\u024F\u1E00-\u1EFF' -]/.test(text[i])) i--
      const word = text.slice(i + 1, off).trim()

      if (word.length >= 2 && suggestions.length) {
        const rng = range.cloneRange()
        rng.collapse(true)
        const rect = rng.getBoundingClientRect()
        setSuggest({ query: word, position: { x: rect.left, y: rect.bottom } })
      } else {
        setSuggest(null)
      }
    }

    el.addEventListener('input', onInput, true)
    return () => el.removeEventListener('input', onInput, true)
  }, [activeFile, suggestions])

  // Accept a suggestion: replace the partial word the student typed
  const acceptSuggest = useCallback(word => {
    if (!word) { setSuggest(null); return }
    const sel = window.getSelection()
    if (!sel?.rangeCount) { setSuggest(null); return }

    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) { setSuggest(null); return }

    const text = node.textContent
    const off = range.startOffset
    let i = off - 1
    while (i >= 0 && /[\w\u00C0-\u024F\u1E00-\u1EFF' -]/.test(text[i])) i--
    const start = i + 1

    // Splice the replacement in
    node.textContent = text.slice(0, start) + word + text.slice(off)

    // Move cursor to end of inserted word
    const newRange = document.createRange()
    newRange.setStart(node, start + word.length)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)

    // Tell MDXEditor the DOM changed
    node.parentElement?.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: word })
    )

    setSuggest(null)
  }, [])

  // ─── Ctrl/Cmd+S ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (activeFile) onSave(activeFile)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeFile, onSave])

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (!activeFile) {
    return (
      <main className="editor-empty-state">
        <div className="empty-icon">✦</div>
        <p>Open a file from the explorer to start editing</p>
        <p className="empty-hint">Files autosave automatically · hover terms for definitions</p>
      </main>
    )
  }

  const isMarkdown = activeFile.endsWith('.md')
  const wordCount = (fileData?.content || '').trim().split(/\s+/).filter(Boolean).length

  return (
    <main className="editor-main">
      {/* ── Tabs ── */}
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
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Editor body ── */}
      <div className="editor-body" ref={wrapRef}>
        {isMarkdown ? (
          <MDXEditor
            key={activeFile}
            markdown={fileData?.content || ''}
            onChange={md => onUpdate(activeFile, md)}
            contentEditableClassName="mdx-content"
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              tablePlugin(),
              linkPlugin(),
              linkDialogPlugin(),
              markdownShortcutPlugin(),
              toolbarPlugin({
                toolbarContents: () => (
                  <div className="mdx-toolbar-inner">
                    <UndoRedo />
                    <Separator />
                    <BlockTypeSelect />
                    <Separator />
                    <BoldItalicUnderlineToggles />
                    <Separator />
                    <ListsToggle />
                    <Separator />
                    <InsertTable />
                    <InsertThematicBreak />
                    <CreateLink />
                    <div className="toolbar-spacer" />
                    <button
                      className="tb-save-btn"
                      onClick={() => onSave(activeFile)}
                      title="Save (Ctrl+S)"
                    >
                      💾 Save
                    </button>
                  </div>
                ),
              }),
            ]}
          />
        ) : (
          /* Non-.md files: plain textarea */
          <textarea
            className="plain-editor"
            value={fileData?.content || ''}
            onChange={e => onUpdate(activeFile, e.target.value)}
            spellCheck={false}
          />
        )}

        {/* Autosuggestion popup */}
        {suggest && (
          <AutoSuggest
            suggestions={suggestions}
            query={suggest.query}
            position={suggest.position}
            onAccept={acceptSuggest}
            onDismiss={() => setSuggest(null)}
          />
        )}

        {/* Glossary tooltip */}
        {tooltip && (
          <GlossaryTooltip term={tooltip.term} x={tooltip.x} y={tooltip.y} />
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="status-bar">
        <span className="status-file">{activeFile.split('/').pop()}</span>
        <span className="status-sep">·</span>
        <span>{wordCount} words</span>
        <span className="status-sep">·</span>
        {fileData?.dirty ? (
          <span style={{ color: '#c8a84b' }}>● Unsaved</span>
        ) : (
          <span style={{ color: '#4a8c5c' }}>✓ Saved</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#4a4438', fontSize: '10px' }}>
          Hover culinary terms for definitions · Tab to autocomplete
        </span>
      </div>
    </main>
  )
}
