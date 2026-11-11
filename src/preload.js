// The only bridge between Captionshaper's window and the computer.
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, d) => cb(d));
contextBridge.exposeInMainWorld('cs', {
  platform: process.platform,
  pathFor: (file) => webUtils.getPathForFile(file),
  fileUrl: (p) => `captionshaper://file/${encodeURIComponent(p)}`,
  getState: () => ipcRenderer.invoke('get-state'),
  setSettings: (p) => ipcRenderer.invoke('set-settings', p),
  pickVideo: () => ipcRenderer.invoke('pick-video'),
  openMedia: (f) => ipcRenderer.invoke('open-media', f),
  saveProject: (a) => ipcRenderer.invoke('save-project', a),
  models: () => ipcRenderer.invoke('models'),
  downloadModel: (id) => ipcRenderer.invoke('download-model', id),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),
  deleteModel: (id) => ipcRenderer.invoke('delete-model', id),
  transcribe: (a) => ipcRenderer.invoke('transcribe', a),
  cancelJob: (id) => ipcRenderer.invoke('cancel-job', id),
  peaks: (f) => ipcRenderer.invoke('peaks', f),
  exportText: (a) => ipcRenderer.invoke('export-text', a),
  burn: (a) => ipcRenderer.invoke('burn', a),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),
  openExternal: (u) => ipcRenderer.invoke('open-external', u),
  rendererReady: () => ipcRenderer.invoke('renderer-ready'),
  onProgress: on('job-progress'),
  onModelProgress: on('model-progress'),
  onOpenFiles: on('open-files'),
  onFullscreen: on('fullscreen'),
});
