const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const {
  createLoanDocument,
  resolveLoanProduct,
  validateGuarantorDates,
  validateLoanDetails
} = require("./src/Appraisal");
const { createCalculatorDocument } = require("./src/calculator-documents");

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
  const guarantorDateError = validateGuarantorDates(payload.guarantors);
  if (guarantorDateError) throw new Error(guarantorDateError);

  const templates = payload.templates.filter((template) =>
    ["appraisal", "circ", "offer", "keyfact"].includes(template)
  );
  if (templates.length === 0) {
    throw new Error("Select at least one document to generate.");
  }

  const safeCustomerName = String(customer.name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim()
    .replace(/[. ]+$/g, "");
  const defaultFileName = `${safeCustomerName || "Loan Documents"} - Loan Documents.docx`;
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: "Save loan documents",
    defaultPath: defaultFileName,
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

ipcMain.handle("documents:clear-cache", async (event) => {
  await event.sender.session.clearCache();
  return { cleared: true };
});

ipcMain.handle("calculator-document:save", async (event, payload) => {
  if (!payload || !["repayment", "key-facts"].includes(payload.documentType)) {
    throw new Error("Choose a repayment schedule or Key Facts Statement to save.");
  }
  if (!["Term Loan", "Other Micro Loan", "Sharp Sharp"].includes(payload.product)) {
    throw new Error("Choose a valid loan product.");
  }

  const amount = Number(payload.amount);
  const durationMonths = Number(payload.durationMonths);
  const maximumDuration = payload.product === "Sharp Sharp" ? 12 : 24;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid loan amount greater than zero.");
  }
  if (payload.product === "Sharp Sharp" && (amount < 100000 || amount > 1000000)) {
    throw new Error("Sharp Sharp amounts must be between ₦100,000.00 and ₦1,000,000.00.");
  }
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > maximumDuration) {
    throw new Error(`${payload.product} duration must be between 1 and ${maximumDuration} months.`);
  }

  const customer = {
    ...payload,
    amount,
    durationMonths,
    documentDate: payload.documentDate,
    drawdownDate: payload.drawdownDate
  };
  const calculatorDocument = createCalculatorDocument(customer);
  const isRepayment = payload.documentType === "repayment";
  const defaultFileName = isRepayment ? "Loan Repayment Schedule.docx" : "Key Facts Statement.docx";
  const { filePath, canceled } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: isRepayment ? "Save loan repayment schedule" : "Save Key Facts Statement",
    defaultPath: defaultFileName,
    filters: [{ name: "Word document", extensions: ["docx"] }]
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }
  const buffer = await calculatorDocument.toBuffer();
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
