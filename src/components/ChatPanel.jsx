import React, { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ activeFile, fileContent, projectName, showToast }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Bonjour! I'm Chef AI, your culinary education assistant. Ask me anything about recipes, techniques, lesson plans, or let me help you write content for your courses. 👨‍🍳"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState('')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const msgsRef = useRef(null)

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages, loading])

  const quickPrompts = [
    { label: '📚 Lesson plan', prompt: 'Help me create a lesson plan for culinary students.' },
    { label: '🥣 Sauces', prompt: 'Explain the five French mother sauces with examples.' },
    { label: '🔪 Mise en place', prompt: 'Explain mise en place for first year students.' },
    { label: '📝 Assessment', prompt: 'Write a practical assessment rubric for knife skills.' },
    { label: '🎂 Pâtisserie', prompt: 'Explain the key differences between pâte brisée, sablée, and feuilletée.' },
    { label: '🍷 Wine pairing', prompt: 'What are the fundamental principles of food and wine pairing?' },
  ]

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    if (!apiKey) { setShowKeyInput(true); return }

    setInput('')
    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading('...')

    const ctx = activeFile
      ? `The teacher is currently editing the file "${activeFile.split('/').pop()}" in their project "${projectName}". File content (first 1500 chars):\n\n${(fileContent || '').substring(0, 1500)}`
      : `The teacher is working on the project "${projectName}".`

    const history = [...messages, userMsg].slice(-20) // Keep last 20 messages

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: `You are Chef AI, an expert culinary education assistant embedded in a cooking school text editor called "Mise en Place". You help teachers create lesson plans, recipes, practical assessments, and educational content. You are deeply knowledgeable about French classical cuisine, pâtisserie, boulangerie, wine and sommellerie, charcuterie, and chocolaterie. Be concise, practical, and professional. Use culinary terminology naturally. Context: ${ctx}`,
          messages: history.map(m => ({ role: m.role, content: m.content })),
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || `API error ${response.status}`)
      }

      const data = await response.json()
      const reply = data.content?.map(b => b.text || '').join('') || 'No response received.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${err.message}` }])
    } finally {
      setLoading('')
    }
  }

  const saveKey = () => {
    localStorage.setItem('anthropic_api_key', apiKey)
    setShowKeyInput(false)
    showToast('API key saved')
  }

  return (
    <aside className="chat-panel">
      <div className="chat-header">
        <div className="chat-avatar">✦</div>
        <div>
          <strong>Chef AI</strong>
          <small>Culinary assistant</small>
        </div>
        <button
          className="icon-btn"
          title="API Key"
          onClick={() => setShowKeyInput(s => !s)}
          style={{ marginLeft: 'auto' }}
        >⚙️</button>
      </div>

      {showKeyInput && (
        <div className="api-key-panel">
          <p>Enter your Anthropic API key:</p>
          <input
            type="password"
            className="field-input"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            onKeyDown={e => e.key === 'Enter' && saveKey()}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-cancel" onClick={() => setShowKeyInput(false)}>Cancel</button>
            <button className="btn-create" onClick={saveKey}>Save Key</button>
          </div>
          <p className="hint">Key is stored locally on your device only.</p>
        </div>
      )}

      <div className="chat-messages" ref={msgsRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="msg-label">{m.role === 'user' ? 'You' : 'Chef AI'}</div>
            <div className="msg-bubble">{formatMsg(m.content)}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="msg-label">Chef AI</div>
            <div className="msg-bubble thinking">
              <span className="thinking-dots">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="quick-prompts">
        {quickPrompts.map(qp => (
          <button key={qp.label} className="qp-btn" onClick={() => send(qp.prompt)}>
            {qp.label}
          </button>
        ))}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Chef AI…"
          rows={1}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          className="send-btn"
          onClick={() => send()}
          disabled={!!loading || !input.trim()}
        >
          ➤
        </button>
      </div>
    </aside>
  )
}

function formatMsg(content) {
  // Simple formatting: bold, code, line breaks
  return content.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    return (
      <span key={i}>
        {parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>
          if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="inline-code">{p.slice(1, -1)}</code>
          return p
        })}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    )
  })
}
