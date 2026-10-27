const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("loanDocuments", {
  save: (payload) => ipcRenderer.invoke("documents:save", payload)
});
