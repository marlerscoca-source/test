import React, { useState, useCallback } from 'react'

const api = window.api

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'md') return '📝'
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼'
  if (['pdf'].includes(ext)) return '📕'
  if (['yaml','yml'].includes(ext)) return '⚙️'
  return '📄'
}

function TreeNode({ node, depth = 0, activeFile, onOpen, onRefresh, showToast, projectRoot }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name)
  const [showCtx, setShowCtx] = useState(false)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })

  const handleCtx = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxPos({ x: e.clientX, y: e.clientY })
    setShowCtx(true)
  }

  const handleRename = async () => {
    if (!newName.trim() || newName === node.name) { setRenaming(false); return }
    const dir = node.path.substring(0, node.path.lastIndexOf('/'))
    const newPath = dir + '/' + newName.trim()
    await api.renameItem(node.path, newPath)
    setRenaming(false)
    onRefresh()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return
    await api.deleteItem(node.path)
    onRefresh()
  }

  const handleNewFile = async () => {
    const name = prompt('New file name (e.g. Notes.md):')
    if (!name) return
    const p = node.type === 'folder' ? node.path + '/' + name : node.path.substring(0, node.path.lastIndexOf('/')) + '/' + name
    await api.createFile(p, `# ${name.replace(/\.[^.]+$/, '')}\n\n`)
    onRefresh()
    if (name.endsWith('.md') || name.endsWith('.txt')) onOpen(p)
  }

  const handleNewFolder = async () => {
    const name = prompt('New folder name:')
    if (!name) return
    const p = node.type === 'folder' ? node.path + '/' + name : node.path.substring(0, node.path.lastIndexOf('/')) + '/' + name
    await api.createFolder(p)
    onRefresh()
  }

  const isEditable = node.type === 'file' && (node.name.endsWith('.md') || node.name.endsWith('.txt') || node.name.endsWith('.yaml') || node.name.endsWith('.yml'))

  return (
    <div className="tree-node">
      {showCtx && (
        <>
          <div className="ctx-backdrop" onClick={() => setShowCtx(false)} />
          <div className="ctx-menu" style={{ left: ctxPos.x, top: ctxPos.y }}>
            {isEditable && <div className="ctx-item" onClick={() => { onOpen(node.path); setShowCtx(false) }}>📝 Open</div>}
            {node.type === 'folder' && <div className="ctx-item" onClick={() => { handleNewFile(); setShowCtx(false) }}>+ New File</div>}
            {node.type === 'folder' && <div className="ctx-item" onClick={() => { handleNewFolder(); setShowCtx(false) }}>📁 New Folder</div>}
            <div className="ctx-sep" />
            <div className="ctx-item" onClick={() => { setRenaming(true); setShowCtx(false) }}>✏️ Rename</div>
            <div className="ctx-item danger" onClick={() => { handleDelete(); setShowCtx(false) }}>🗑 Delete</div>
          </div>
        </>
      )}

      <div
        className={`tree-row ${node.type === 'file' && activeFile === node.path ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        onClick={() => {
          if (node.type === 'folder') setExpanded(e => !e)
          else if (isEditable) onOpen(node.path)
        }}
        onContextMenu={handleCtx}
      >
        {node.type === 'folder' && (
          <span className={`folder-arrow ${expanded ? 'open' : ''}`}>▶</span>
        )}
        <span className="node-icon">
          {node.type === 'folder' ? (expanded ? '📂' : '📁') : getFileIcon(node.name)}
        </span>

        {renaming ? (
          <input
            className="rename-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="node-name">{node.name}</span>
        )}

        {node.type === 'file' && activeFile === node.path && (
          <span className="active-dot" />
        )}
      </div>

      {node.type === 'folder' && expanded && node.children?.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          onOpen={onOpen}
          onRefresh={onRefresh}
          showToast={showToast}
          projectRoot={projectRoot}
        />
      ))}
    </div>
  )
}

export default function FileExplorer({ project, openFiles, activeFile, onOpenFile, onRefresh, onBack, showToast }) {
  const [search, setSearch] = useState('')

  const handleNewFile = async () => {
    const name = prompt('New file name (e.g. Notes.md):')
    if (!name) return
    const p = project.root + '/' + name
    await api.createFile(p, `# ${name.replace(/\.[^.]+$/, '')}\n\n`)
    onRefresh()
  }

  return (
    <aside className="file-explorer">
      <div className="explorer-header">
        <div className="explorer-title">
          <button className="back-btn" onClick={onBack} title="Close project">‹</button>
          <span className="project-name" title={project.root}>{project.name}</span>
        </div>
        <div className="explorer-actions">
          <button className="icon-btn" title="New file" onClick={handleNewFile}>+</button>
          <button className="icon-btn" title="Refresh" onClick={onRefresh}>↺</button>
        </div>
      </div>

      <div className="explorer-search">
        <input
          className="search-input"
          placeholder="Filter files…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="explorer-tree">
        {project.tree
          .filter(node => !search || JSON.stringify(node).toLowerCase().includes(search.toLowerCase()))
          .map(node => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              onOpen={onOpenFile}
              onRefresh={onRefresh}
              showToast={showToast}
              projectRoot={project.root}
            />
          ))}
      </div>

      <div className="explorer-footer">
        <span>{openFiles.length} open · {openFiles.filter(f => f.dirty).length} unsaved</span>
      </div>
    </aside>
  )
}
