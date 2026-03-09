const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Project
  openProject: () => ipcRenderer.invoke('dialog:openProject'),
  newProject: (opts) => ipcRenderer.invoke('dialog:newProject', opts),

  // File system
  readFile: (p) => ipcRenderer.invoke('fs:readFile', p),
  writeFile: (p, content) => ipcRenderer.invoke('fs:writeFile', { filePath: p, content }),
  createFile: (p, content) => ipcRenderer.invoke('fs:createFile', { filePath: p, content }),
  createFolder: (p) => ipcRenderer.invoke('fs:createFolder', p),
  deleteItem: (p) => ipcRenderer.invoke('fs:delete', p),
  renameItem: (oldPath, newPath) => ipcRenderer.invoke('fs:rename', { oldPath, newPath }),
  refreshTree: (root) => ipcRenderer.invoke('fs:refreshTree', root),

  // Data files
  loadData: (filename) => ipcRenderer.invoke('data:load', filename),
})
