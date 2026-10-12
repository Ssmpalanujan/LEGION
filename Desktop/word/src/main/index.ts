import { app, BrowserWindow, ipcMain, shell, dialog, Menu, session, desktopCapturer, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import Store from 'electron-store'

const isDev = !app.isPackaged
const isMac = process.platform === 'darwin'

interface Settings {
  theme: 'light' | 'dark'
  zoom: number
  recentFiles: string[]
  pageSize: 'A4' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  margins: 'normal' | 'narrow' | 'wide'
  columns: number
  showRuler: boolean
  spellcheck: boolean
  customStyles: unknown[]
  autosaveSec: number
  defaultFont: string
  defaultSize: string
  language: string
  wordGoal: number
  watermark: string
  pageBorder: string
}

const store = new Store<Settings>({
  defaults: {
    theme: 'light',
    zoom: 100,
    recentFiles: [],
    pageSize: 'A4',
    orientation: 'portrait',
    margins: 'normal',
    columns: 1,
    showRuler: true,
    spellcheck: true,
    customStyles: [],
    autosaveSec: 30,
    defaultFont: 'Calibri',
    defaultSize: '11',
    language: 'en-US',
    wordGoal: 500,
    watermark: '',
    pageBorder: 'none'
  }
})

function pushRecent(filePath: string): string[] {
  const list = (store.get('recentFiles') as string[]).filter((p) => p !== filePath)
  list.unshift(filePath)
  const trimmed = list.slice(0, 10)
  store.set('recentFiles', trimmed)
  return trimmed
}

function sendAction(win: BrowserWindow | null, action: string, payload?: unknown): void {
  win?.webContents.send('menu:action', action, payload)
}

function buildMenu(mainWin: BrowserWindow): void {
  const mod = isMac ? 'Cmd' : 'Ctrl'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'WordPad Pro',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: `${mod}+N`,
          click: () => sendAction(mainWin, 'file:new')
        },
        {
          label: 'Open…',
          accelerator: `${mod}+O`,
          click: () => sendAction(mainWin, 'file:open')
        },
        {
          label: 'Save',
          accelerator: `${mod}+S`,
          click: () => sendAction(mainWin, 'file:save')
        },
        { label: 'Save As…', click: () => sendAction(mainWin, 'file:saveAs') },
        { label: 'Save with Password…', click: () => sendAction(mainWin, 'file:protected') },
        { label: 'New from Template…', click: () => sendAction(mainWin, 'file:templates') },
        { type: 'separator' as const },
        { label: 'Export as PDF…', click: () => sendAction(mainWin, 'file:exportPdf') },
        { label: 'Print…', accelerator: `${mod}+P`, click: () => sendAction(mainWin, 'file:print') },
        { label: 'Print Preview', click: () => sendAction(mainWin, 'file:printPreview') },
        ...(!isMac ? [{ type: 'separator' as const }, { role: 'quit' as const }] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: `${mod}+Z`, click: () => sendAction(mainWin, 'edit:undo') },
        { label: 'Redo', accelerator: isMac ? 'Shift+Cmd+Z' : 'Ctrl+Y', click: () => sendAction(mainWin, 'edit:redo') },
        { type: 'separator' as const },
        { label: 'Cut', accelerator: `${mod}+X`, click: () => sendAction(mainWin, 'edit:cut') },
        { label: 'Copy', accelerator: `${mod}+C`, click: () => sendAction(mainWin, 'edit:copy') },
        { label: 'Paste', accelerator: `${mod}+V`, click: () => sendAction(mainWin, 'edit:paste') },
        { label: 'Select All', accelerator: `${mod}+A`, click: () => sendAction(mainWin, 'edit:selectAll') },
        { type: 'separator' as const },
        { label: 'Find…', accelerator: `${mod}+F`, click: () => sendAction(mainWin, 'find:open') },
        { label: 'Replace…', accelerator: `${mod}+H`, click: () => sendAction(mainWin, 'find:replace') }
      ]
    },
    {
      label: 'Insert',
      submenu: [
        { label: 'Image…', click: () => sendAction(mainWin, 'insert:image') },
        { label: 'Link…', click: () => sendAction(mainWin, 'insert:link') },
        { label: 'Equation…', click: () => sendAction(mainWin, 'insert:equation') },
        { label: 'Shape…', click: () => sendAction(mainWin, 'insert:shape') },
        { label: 'Text Box', click: () => sendAction(mainWin, 'insert:textbox') },
        { label: 'Footnote', click: () => sendAction(mainWin, 'insert:footnote') },
        { label: 'Comment', click: () => sendAction(mainWin, 'insert:comment') },
        { label: 'Table of Contents', click: () => sendAction(mainWin, 'insert:toc') },
        { label: 'Mail Merge…', click: () => sendAction(mainWin, 'insert:merge') },
        { label: 'Horizontal Line', click: () => sendAction(mainWin, 'insert:hr') },
        { label: 'Page Break', click: () => sendAction(mainWin, 'insert:pageBreak') },
        { label: 'Date/Time', click: () => sendAction(mainWin, 'insert:datetime') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', click: () => sendAction(mainWin, 'view:zoomIn') },
        { label: 'Zoom Out', click: () => sendAction(mainWin, 'view:zoomOut') },
        { label: 'Toggle Theme', click: () => sendAction(mainWin, 'view:theme') },
        { label: 'Toggle Ruler', click: () => sendAction(mainWin, 'view:ruler') },
        { label: 'Navigation Pane', click: () => sendAction(mainWin, 'view:nav') },
        { label: 'Version History', click: () => sendAction(mainWin, 'view:history') },
        { label: 'Focus Mode', click: () => sendAction(mainWin, 'view:focus') },
        { label: 'Full Screen', click: () => sendAction(mainWin, 'view:fullscreen') }
      ]
    },
    {
      label: 'Review',
      submenu: [
        { label: 'Word Count…', click: () => sendAction(mainWin, 'review:wordcount') },
        { label: 'Accept All Changes', click: () => sendAction(mainWin, 'review:acceptAll') },
        { label: 'Reject All Changes', click: () => sendAction(mainWin, 'review:rejectAll') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: !isMac,
    backgroundColor: '#f3f3f3',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 12, y: 12 } : undefined,
    frame: isMac ? true : false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Spellcheck languages
  try {
    const ses = session.defaultSession
    ses.setSpellCheckerLanguages(['en-US'])
  } catch {
    /* noop */
  }

  // Webcam capture: allow camera access for the app window (dev server + file origins)
  try {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media') callback(true)
      else callback(false)
    })
  } catch {
    /* noop */
  }

  // Right-click context menu: spelling suggestions + edit commands,
  // or image actions when right-clicking a document picture
  win.webContents.on('context-menu', (_e, params) => {
    const { misspelledWord, dictionarySuggestions, editFlags } = params
    if (params.mediaType === 'image') {
      Menu.buildFromTemplate([
        { label: 'Edit Image…', click: () => win.webContents.send('menu:action', 'image:edit') },
        { label: 'Crop…', click: () => win.webContents.send('menu:action', 'image:crop') },
        { label: 'Rotate Right', click: () => win.webContents.send('menu:action', 'image:rotateR') },
        { label: 'Rotate Left', click: () => win.webContents.send('menu:action', 'image:rotateL') },
        { label: 'Flip Horizontal', click: () => win.webContents.send('menu:action', 'image:flipH') },
        { label: 'Flip Vertical', click: () => win.webContents.send('menu:action', 'image:flipV') },
        { type: 'separator' as const },
        {
          label: 'Copy Picture',
          click: () => {
            try {
              win.webContents.copyImageAt(params.x, params.y)
            } catch {
              win.webContents.copy()
            }
          }
        },
        { label: 'Save as Picture…', click: () => win.webContents.send('menu:action', 'image:save') },
        { label: 'Set as Page Background', click: () => win.webContents.send('menu:action', 'image:background') },
        { type: 'separator' as const },
        { label: 'Remove Background…', click: () => win.webContents.send('menu:action', 'image:bgremove') },
        { label: 'Extract Text (OCR)…', click: () => win.webContents.send('menu:action', 'image:ocr') }
      ]).popup({ window: win })
      return
    }
    const items: Electron.MenuItemConstructorOptions[] = []

    if (misspelledWord && (store.get('spellcheck') as boolean)) {
      for (const suggestion of dictionarySuggestions.slice(0, 5)) {
        items.push({
          label: suggestion,
          click: () => win.webContents.send('menu:action', 'spell:replace', suggestion)
        })
      }
      items.push({
        label: 'Add to dictionary',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(misspelledWord)
      })
      items.push({ type: 'separator' })
    }

    items.push(
      { label: 'Cut', enabled: editFlags.canCut, click: () => win.webContents.cut() },
      { label: 'Copy', enabled: editFlags.canCopy, click: () => win.webContents.copy() },
      { label: 'Paste', enabled: editFlags.canPaste, click: () => win.webContents.paste() },
      { type: 'separator' },
      { label: 'Select All', click: () => win.webContents.selectAll() }
    )
    Menu.buildFromTemplate(items).popup({ window: win })
  })

  buildMenu(win)
  return win
}

// ---------- IPC ----------

function registerIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.on('win:fullscreen', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w) w.setFullScreen(!w.isFullScreen())
  })

  ipcMain.handle('settings:setLanguage', (_e, lang: string) => {
    try {
      session.defaultSession.setSpellCheckerLanguages([lang || 'en-US'])
    } catch {
      /* noop */
    }
  })

  ipcMain.handle('settings:getAll', () => store.store)
  ipcMain.handle('settings:get', (_e, key: string) => store.get(key as keyof Settings))
  ipcMain.handle('settings:set', (_e, key: string, value: unknown) => {
    store.set(key as keyof Settings, value as never)
  })

  ipcMain.handle('recent:get', () => store.get('recentFiles') as string[])
  ipcMain.handle('recent:clear', () => {
    store.set('recentFiles', [])
    return []
  })

  ipcMain.handle('file:openDialog', async () => {
    const win = getWin()
    const res = await dialog.showOpenDialog(win ?? undefined as never, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['html', 'htm', 'txt', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (res.canceled || res.filePaths.length === 0) return { canceled: true }
    const filePath = res.filePaths[0]
    const buf = await readFile(filePath)
    pushRecent(filePath)
    return { canceled: false, path: filePath, dataBase64: buf.toString('base64') }
  })

  ipcMain.handle('file:openPath', async (_e, filePath: string) => {
    try {
      const buf = await readFile(filePath)
      pushRecent(filePath)
      return { ok: true, path: filePath, dataBase64: buf.toString('base64') }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'file:write',
    async (_e, filePath: string, dataBase64: string, _encoding: string) => {
      try {
        await writeFile(filePath, Buffer.from(dataBase64, 'base64'))
        pushRecent(filePath)
        return { ok: true, path: filePath }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle('file:saveDialog', async (_e, defaultName: string, format: string) => {
    const win = getWin()
    const filters =
      format === 'docx'
        ? [{ name: 'Word Document', extensions: ['docx'] }]
        : format === 'txt'
          ? [{ name: 'Plain Text', extensions: ['txt'] }]
          : format === 'html'
            ? [{ name: 'HTML', extensions: ['html'] }]
            : format === 'pdf'
              ? [{ name: 'PDF', extensions: ['pdf'] }]
              : format === 'png'
                ? [{ name: 'PNG Image', extensions: ['png'] }]
                : format === 'jpg'
                  ? [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }]
                  : format === 'webp'
                    ? [{ name: 'WebP Image', extensions: ['webp'] }]
                    : [{ name: 'All Files', extensions: ['*'] }]
    const res = await dialog.showSaveDialog(win ?? undefined as never, {
      defaultPath: defaultName,
      filters
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    return { canceled: false, path: res.filePath }
  })

  ipcMain.handle('file:exportPdf', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? getWin()
    if (!win) return { ok: false, error: 'No window' }
    const save = await dialog.showSaveDialog(win, {
      defaultPath: 'Document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (save.canceled || !save.filePath) return { ok: false, canceled: true }
    try {
      const data = await win.webContents.printToPDF({ printBackground: true })
      await writeFile(save.filePath, data)
      pushRecent(save.filePath)
      return { ok: true, path: save.filePath }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('file:print', async (e, preview: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? getWin()
    if (!win) return { ok: false }
    if (preview) {
      const html = await win.webContents.executeJavaScript(
        'document.querySelector(".a4-page")?.outerHTML ?? document.body.innerHTML'
      )
      const prev = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'Print Preview',
        autoHideMenuBar: true,
        webPreferences: { sandbox: true, contextIsolation: true }
      })
      const safe = String(html).replace(/<\/script/gi, '<\\/script')
      await prev.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<!doctype html><html><head><title>Print Preview</title><style>body{font-family:sans-serif;background:#eee;margin:0;padding:24px}button{position:fixed;top:12px;right:12px;padding:8px 16px;background:#2B579A;color:#fff;border:0;border-radius:6px;cursor:pointer}.a4-page{background:#fff;max-width:800px;margin:40px auto;padding:48px;box-shadow:0 2px 12px rgba(0,0,0,.25)}@media print{button{display:none}body{background:#fff;padding:0}.a4-page{box-shadow:none;margin:0;max-width:none}}</style></head><body><button onclick="window.print()">Print</button>${safe}</body></html>`
        )}`
      )
      return { ok: true }
    }
    win.webContents.print({ silent: false, printBackground: true }, (success, err) => {
      if (!success) console.error('print failed', err)
    })
    return { ok: true }
  })

  ipcMain.handle('file:pickImage', async () => {
    const win = getWin()
    const res = await dialog.showOpenDialog(win ?? undefined as never, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return { canceled: true }
    const buf = await readFile(res.filePaths[0])
    const ext = res.filePaths[0].split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    return { canceled: false, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
  })

  ipcMain.handle('image:screenshot', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      })
      const primary = sources.find((s) => (s as { display_id?: string }).display_id !== undefined) ?? sources[0]
      if (!primary || primary.thumbnail.isEmpty()) {
        return { canceled: true, error: 'No screen available (macOS may need Screen Recording permission).' }
      }
      return { canceled: false, dataUrl: primary.thumbnail.toDataURL() }
    } catch (err) {
      return { canceled: true, error: String(err) }
    }
  })

  // API keys are never stored in plain settings: encrypted with OS keychain when available
  const memorySecrets = new Map<string, string>()
  const secretAvailable = () => {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }
  ipcMain.handle('secrets:set', async (_e, service: string, value: string) => {
    try {
      if (secretAvailable()) {
        store.set(`secret:${service}` as never, safeStorage.encryptString(value).toString('base64') as never)
        return { ok: true, persistent: true }
      }
      memorySecrets.set(service, value)
      return { ok: true, persistent: false }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
  ipcMain.handle('secrets:get', async (_e, service: string) => {
    try {
      if (secretAvailable()) {
        const raw = store.get(`secret:${service}` as never) as unknown as string | undefined
        if (!raw) return { ok: true, value: '', persistent: true }
        return { ok: true, value: safeStorage.decryptString(Buffer.from(raw, 'base64')), persistent: true }
      }
      return { ok: true, value: memorySecrets.get(service) ?? '', persistent: false }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
  ipcMain.handle('secrets:delete', async (_e, service: string) => {
    try {
      store.delete(`secret:${service}` as never)
      memorySecrets.delete(service)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}

let mainWin: BrowserWindow | null = null

app.whenReady().then(() => {
  mainWin = createWindow()
  registerIpc(() => mainWin)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWin = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
