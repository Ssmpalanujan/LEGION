import { contextBridge, ipcRenderer } from 'electron'

export interface OpenResult {
  canceled: boolean
  path?: string
  dataBase64?: string
}

export interface ElectronAPI {
  platform: NodeJS.Platform
  isMac: boolean
  isWindows: boolean
  minimize: () => void
  maximize: () => void
  close: () => void
  setFullscreen: () => void
  setLanguage: (lang: string) => Promise<void>
  getSettings: () => Promise<Record<string, unknown>>
  setSetting: (key: string, value: unknown) => Promise<void>
  getRecent: () => Promise<string[]>
  clearRecent: () => Promise<string[]>
  openDialog: () => Promise<OpenResult>
  openPath: (path: string) => Promise<{ ok: boolean; path?: string; dataBase64?: string; error?: string }>
  writeFile: (path: string, dataBase64: string) => Promise<{ ok: boolean; error?: string }>
  saveDialog: (defaultName: string, format: string) => Promise<{ canceled: boolean; path?: string }>
  exportPdf: () => Promise<{ ok: boolean; path?: string; error?: string }>
  print: (preview: boolean) => Promise<{ ok: boolean }>
  pickImage: () => Promise<{ canceled: boolean; dataUrl?: string }>
  captureScreenshot: () => Promise<{ canceled: boolean; dataUrl?: string; error?: string }>
  onMenuAction: (cb: (action: string, payload?: unknown) => void) => () => void
}

const electronAPI: ElectronAPI = {
  platform: process.platform as NodeJS.Platform,
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  setFullscreen: () => ipcRenderer.send('win:fullscreen'),
  setLanguage: (lang: string) => ipcRenderer.invoke('settings:setLanguage', lang),
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getRecent: () => ipcRenderer.invoke('recent:get'),
  clearRecent: () => ipcRenderer.invoke('recent:clear'),
  openDialog: () => ipcRenderer.invoke('file:openDialog'),
  openPath: (path: string) => ipcRenderer.invoke('file:openPath', path),
  writeFile: (path: string, dataBase64: string) => ipcRenderer.invoke('file:write', path, dataBase64),
  saveDialog: (defaultName: string, format: string) => ipcRenderer.invoke('file:saveDialog', defaultName, format),
  exportPdf: () => ipcRenderer.invoke('file:exportPdf'),
  print: (preview: boolean) => ipcRenderer.invoke('file:print', preview),
  pickImage: () => ipcRenderer.invoke('file:pickImage'),
  captureScreenshot: () => ipcRenderer.invoke('image:screenshot'),
  onMenuAction: (cb) => {
    const listener = (_e: unknown, action: string, payload?: unknown) => cb(action, payload)
    ipcRenderer.on('menu:action', listener as never)
    return () => ipcRenderer.removeListener('menu:action', listener as never)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
