const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises

const isDev = process.env.NODE_ENV !== 'production'

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0d0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── Helpers ──────────────────────────────────────────────────────────────────
function walkDir(dir, base) {
  const results = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(base, full)
    if (entry.isDirectory()) {
      results.push({ type: 'folder', name: entry.name, path: full, rel, children: walkDir(full, base) })
    } else {
      results.push({ type: 'file', name: entry.name, path: full, rel, ext: path.extname(entry.name) })
    }
  }
  // Sort: folders first, then files
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return results
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

// Open an existing project (pick a folder)
ipcMain.handle('dialog:openProject', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Project Folder',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths.length) return null
  const root = filePaths[0]
  return {
    root,
    name: path.basename(root),
    tree: walkDir(root, root),
  }
})

// Create a new project
ipcMain.handle('dialog:newProject', async (_, { name, years }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose where to create the project',
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths.length) return null
  const root = path.join(filePaths[0], name)

  const dirs = []
  if (years.includes(1)) {
    dirs.push(path.join(root, 'Year1', 'Lessons'))
    dirs.push(path.join(root, 'Year1', 'PracticalWork'))
  }
  if (years.includes(2)) {
    dirs.push(path.join(root, 'Year2', 'Lessons'))
    dirs.push(path.join(root, 'Year2', 'PracticalWork'))
  }

  for (const d of dirs) fs.mkdirSync(d, { recursive: true })

  const templates = {
    1: `# Year 1 — Lessons\n\nWelcome to your first year of culinary studies.\n\n## Objectives\n\n- Master fundamental knife skills: brunoise, julienne, chiffonade\n- Understand mise en place and kitchen organisation\n- Learn the five French mother sauces: béchamel, velouté, espagnole, hollandaise, sauce tomate\n\n## Week 1\n\n### Topic: Mise en Place\n\nMise en place is the cornerstone of professional cooking...\n\n---\n\n*Use this document to record lesson notes, recipes, and observations.*\n`,
    2: `# Year 2 — Lessons\n\nWelcome to your second year of advanced culinary studies.\n\n## Objectives\n\n- Master advanced techniques: confit, sous vide, flambé\n- Develop skills in pâtisserie: pâte feuilletée, ganache, tempering chocolate\n- Explore wine pairing: terroir, assemblage, millésime\n\n## Week 1\n\n### Topic: Advanced Sauce Work\n\nBuilding on the mother sauces, we now explore demi-glace, beurre blanc, and béarnaise...\n\n---\n\n*Use this document to record lesson notes, recipes, and observations.*\n`,
  }

  if (years.includes(1)) {
    fs.writeFileSync(path.join(root, 'Year1', 'Lessons', 'Work.md'), templates[1])
    fs.writeFileSync(path.join(root, 'Year1', 'PracticalWork', 'README.md'), `# Year 1 — Practical Work\n\nUse this folder for practical session notes, photos, and assessments.\n`)
  }
  if (years.includes(2)) {
    fs.writeFileSync(path.join(root, 'Year2', 'Lessons', 'Work.md'), templates[2])
    fs.writeFileSync(path.join(root, 'Year2', 'PracticalWork', 'README.md'), `# Year 2 — Practical Work\n\nUse this folder for practical session notes, photos, and assessments.\n`)
  }

  return {
    root,
    name: path.basename(root),
    tree: walkDir(root, root),
  }
})

// Read a file
ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const content = await fsPromises.readFile(filePath, 'utf8')
    return { ok: true, content }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Write a file (used by autosave)
ipcMain.handle('fs:writeFile', async (_, { filePath, content }) => {
  try {
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
    await fsPromises.writeFile(filePath, content, 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Create a new file
ipcMain.handle('fs:createFile', async (_, { filePath, content }) => {
  try {
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
    if (!fs.existsSync(filePath)) await fsPromises.writeFile(filePath, content || '', 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Create a new folder
ipcMain.handle('fs:createFolder', async (_, folderPath) => {
  try {
    await fsPromises.mkdir(folderPath, { recursive: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Delete a file or folder
ipcMain.handle('fs:delete', async (_, filePath) => {
  try {
    await fsPromises.rm(filePath, { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Rename a file or folder
ipcMain.handle('fs:rename', async (_, { oldPath, newPath }) => {
  try {
    await fsPromises.rename(oldPath, newPath)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Refresh project tree
ipcMain.handle('fs:refreshTree', async (_, root) => {
  return { tree: walkDir(root, root) }
})

// Load a YAML/JSON data file from the app's data directory
ipcMain.handle('data:load', async (_, filename) => {
  try {
    // Look in multiple places: app data dir, user project dir, bundled
    const candidates = [
      path.join(__dirname, '../data', filename),
      path.join(app.getAppPath(), 'data', filename),
    ]
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        const raw = await fsPromises.readFile(c, 'utf8')
        return { ok: true, raw }
      }
    }
    return { ok: false, error: 'File not found: ' + filename }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})
