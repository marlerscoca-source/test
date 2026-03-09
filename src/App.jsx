import React, { useState, useEffect, useCallback, useRef } from 'react'
import { parse as parseYaml } from 'yaml'
import NewProjectModal from './components/NewProjectModal.jsx'
import FileExplorer from './components/FileExplorer.jsx'
import Editor from './components/Editor.jsx'
import ChatPanel from './components/ChatPanel.jsx'

const api = window.api

export default function App() {
  const [project, setProject] = useState(null)        // { root, name, tree }
  const [openFiles, setOpenFiles] = useState([])       // array of { path, content, dirty }
  const [activeFile, setActiveFile] = useState(null)   // path string
  const [showNewModal, setShowNewModal] = useState(false)
  const [suggestions, setSuggestions] = useState([])   // from autosuggestions.yaml
  const [glossary, setGlossary] = useState([])         // from culinary_terms.yaml
  const [toast, setToast] = useState(null)
  const autosaveTimers = useRef({})

  // ── Load data files ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      if (!api) return
      const [sug, glos] = await Promise.all([
        api.loadData('autosuggestions.yaml'),
        api.loadData('culinary_terms.yaml'),
      ])
      if (sug.ok) {
        try { setSuggestions(parseYaml(sug.raw)?.words || []) } catch {}
      }
      if (glos.ok) {
        try { setGlossary(parseYaml(glos.raw)?.terms || []) } catch {}
      }
    }
    loadData()
  }, [])

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }, [])

  // ── Open project ──────────────────────────────────────────────────────────
  const openProject = useCallback(async () => {
    const result = await api.openProject()
    if (result) {
      setProject(result)
      setOpenFiles([])
      setActiveFile(null)
      showToast(`Opened: ${result.name}`)
    }
  }, [showToast])

  // ── New project ───────────────────────────────────────────────────────────
  const createProject = useCallback(async (opts) => {
    const result = await api.newProject(opts)
    if (result) {
      setProject(result)
      setOpenFiles([])
      setActiveFile(null)
      setShowNewModal(false)
      showToast(`Created: ${result.name}`)
    }
  }, [showToast])

  // ── Refresh file tree ─────────────────────────────────────────────────────
  const refreshTree = useCallback(async () => {
    if (!project) return
    const result = await api.refreshTree(project.root)
    if (result) setProject(p => ({ ...p, tree: result.tree }))
  }, [project])

  // ── Open file ─────────────────────────────────────────────────────────────
  const openFile = useCallback(async (path) => {
    // Already open → just activate
    const existing = openFiles.find(f => f.path === path)
    if (existing) { setActiveFile(path); return }

    const result = await api.readFile(path)
    if (!result.ok) { showToast(`Error reading file: ${result.error}`, 'error'); return }

    setOpenFiles(prev => [...prev, { path, content: result.content, dirty: false }])
    setActiveFile(path)
  }, [openFiles, showToast])

  // ── Update file content + autosave ────────────────────────────────────────
  const updateContent = useCallback((path, content) => {
    setOpenFiles(prev =>
      prev.map(f => f.path === path ? { ...f, content, dirty: true } : f)
    )
    // Debounced autosave (1 second after last keystroke)
    if (autosaveTimers.current[path]) clearTimeout(autosaveTimers.current[path])
    autosaveTimers.current[path] = setTimeout(async () => {
      const result = await api.writeFile(path, content)
      if (result.ok) {
        setOpenFiles(prev =>
          prev.map(f => f.path === path ? { ...f, dirty: false } : f)
        )
      }
    }, 1000)
  }, [])

  // ── Immediate save (Ctrl+S) ───────────────────────────────────────────────
  const saveFile = useCallback(async (path) => {
    const file = openFiles.find(f => f.path === path)
    if (!file) return
    if (autosaveTimers.current[path]) clearTimeout(autosaveTimers.current[path])
    const result = await api.writeFile(path, file.content)
    if (result.ok) {
      setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, dirty: false } : f))
      showToast('Saved')
    }
  }, [openFiles, showToast])

  // ── Close tab ─────────────────────────────────────────────────────────────
  const closeTab = useCallback((path) => {
    setOpenFiles(prev => {
      const next = prev.filter(f => f.path !== path)
      if (activeFile === path) setActiveFile(next.length > 0 ? next[next.length - 1].path : null)
      return next
    })
  }, [activeFile])

  // ── Save on beforeunload (belt & suspenders) ─────────────────────────────
  useEffect(() => {
    const handler = () => {
      openFiles.filter(f => f.dirty).forEach(f => api.writeFile(f.path, f.content))
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [openFiles])

  // ── Keyboard shortcut Ctrl+S ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (activeFile) saveFile(activeFile)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeFile, saveFile])

  const activeFileData = openFiles.find(f => f.path === activeFile) || null

  // ── Render ────────────────────────────────────────────────────────────────
  if (!project) {
    return (
      <>
        <Welcome
          onNew={() => setShowNewModal(true)}
          onOpen={openProject}
        />
        {showNewModal && (
          <NewProjectModal
            onClose={() => setShowNewModal(false)}
            onCreate={createProject}
          />
        )}
      </>
    )
  }

  return (
    <div className="app-layout">
      <FileExplorer
        project={project}
        openFiles={openFiles}
        activeFile={activeFile}
        onOpenFile={openFile}
        onRefresh={refreshTree}
        onBack={() => { setProject(null); setOpenFiles([]); setActiveFile(null) }}
        showToast={showToast}
      />

      <Editor
        openFiles={openFiles}
        activeFile={activeFile}
        fileData={activeFileData}
        onActivate={setActiveFile}
        onUpdate={updateContent}
        onSave={saveFile}
        onClose={closeTab}
        suggestions={suggestions}
        glossary={glossary}
      />

      <ChatPanel
        activeFile={activeFile}
        fileContent={activeFileData?.content}
        projectName={project.name}
        showToast={showToast}
      />

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}

// ── Welcome screen ────────────────────────────────────────────────────────────
function Welcome({ onNew, onOpen }) {
  return (
    <div className="welcome">
      <div className="welcome-bg" />
      <div className="welcome-inner">
        <div className="welcome-brand">
          <div className="brand-icon">🍽️</div>
          <h1>Mise en Place</h1>
          <p className="brand-sub">Culinary School Editor</p>
        </div>
        <div className="welcome-divider" />
        <div className="welcome-actions">
          <button className="welcome-btn primary" onClick={onNew}>
            <span className="btn-icon">✦</span>
            <div>
              <strong>New Project</strong>
              <span>Create a project on disk with year templates</span>
            </div>
          </button>
          <button className="welcome-btn secondary" onClick={onOpen}>
            <span className="btn-icon">📂</span>
            <div>
              <strong>Open Project</strong>
              <span>Open an existing project folder</span>
            </div>
          </button>
        </div>
        <p className="welcome-hint">
          Files autosave automatically · Markdown rendered live · AI assistant included
        </p>
      </div>
    </div>
  )
}
