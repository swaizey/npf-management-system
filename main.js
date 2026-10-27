const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { createLoanDocument, resolveLoanProduct, validateLoanDetails } = require("./src/Appraisal");

app.setName("NPF Management System");

function createWindow() {
  const window = new BrowserWindow({
    title: "NPF Management System",
    icon: path.join(__dirname, "src", "logo.png"),
    width: 1180,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#f4f6f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("documents:save", async (_event, payload) => {
  if (!payload || !payload.customer || !Array.isArray(payload.guarantors) || !Array.isArray(payload.templates)) {
    throw new Error("The document details are incomplete.");
  }

  const customer = { ...payload.customer, loanProduct: resolveLoanProduct(payload.customer) };
  const validationError = validateLoanDetails(customer);
  if (validationError) throw new Error(validationError);

  const templates = payload.templates.filter((template) =>
    ["appraisal", "circ", "offer", "keyfact"].includes(template)
  );
  if (templates.length === 0) {
    throw new Error("Select at least one document to generate.");
  }

  const { filePath, canceled } = await dialog.showSaveDialog({
    title: "Save loan documents",
    defaultPath: "Loan Documents.docx",
    filters: [{ name: "Word document", extensions: ["docx"] }]
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const document = createLoanDocument({ ...payload, customer }, templates);
  const buffer = await document.toBuffer();
  await require("node:fs/promises").writeFile(filePath, buffer);
  return { canceled: false, filePath };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
