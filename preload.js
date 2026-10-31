const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("loanDocuments", {
  save: (payload) => ipcRenderer.invoke("documents:save", payload),
  clearCache: () => ipcRenderer.invoke("documents:clear-cache"),
  saveCalculatorDocument: (payload) => ipcRenderer.invoke("calculator-document:save", payload)
});
