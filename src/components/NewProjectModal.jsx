import React, { useState } from 'react'

export default function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [years, setYears] = useState([1])

  const toggleYear = (y) => {
    setYears(prev =>
      prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]
    )
  }

  const canCreate = name.trim() && years.length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Project</h2>
          <p>Name your project and select which year levels to include.</p>
        </div>

        <div className="modal-body">
          <label className="field-label">Project name</label>
          <input
            className="field-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. École de Cuisine 2025"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && canCreate && onCreate({ name: name.trim(), years })}
          />

          <label className="field-label">Year levels</label>
          <p className="field-hint">This creates the folder structure on disk:</p>

          <div className="year-grid">
            {[1, 2].map(y => (
              <div
                key={y}
                className={`year-card ${years.includes(y) ? 'selected' : ''}`}
                onClick={() => toggleYear(y)}
              >
                <div className="year-icon">{y === 1 ? '🌱' : '🌿'}</div>
                <div className="year-title">Year {y}</div>
                <div className="year-desc">
                  {y === 1 ? 'First year — fundamentals' : 'Second year — advanced techniques'}
                </div>
                <div className="year-structure">
                  <code>Year{y}/Lessons/Work.md</code>
                  <code>Year{y}/PracticalWork/</code>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-create"
            disabled={!canCreate}
            onClick={() => onCreate({ name: name.trim(), years })}
          >
            Choose folder & create ✦
          </button>
        </div>
      </div>
    </div>
  )
}
