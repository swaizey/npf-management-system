const form = document.querySelector("#key-facts-form");
const amountInput = document.querySelector("#loan-amount");
const productInput = document.querySelector("#loan-product");
const durationInput = document.querySelector("#loan-duration");
const startDateInput = document.querySelector("#loan-start-date");
const productHint = document.querySelector("#product-hint");
const errorMessage = document.querySelector("#key-facts-error");
const results = document.querySelector("#key-facts-results");
const factsBody = document.querySelector("#key-facts-body");
const message = document.querySelector("#key-facts-message");
const saveButton = document.querySelector("#save-key-facts");
const { formatDateInput, parseDateInput, todayISODate, validateDateInput, attachDateInputValidation } = globalThis.npfDateUtils;
let currentCalculation = null;

function formatCurrency(amount) {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  return globalThis.loanCalculations.formatScheduleDate(value);
}

function updateProductRules() {
  const sharpSharp = productInput.value === "Sharp Sharp";
  durationInput.max = sharpSharp ? "12" : "24";
  productHint.textContent = sharpSharp
    ? "Sharp Sharp: 48% per annum; amount ₦100,000–₦1,000,000; maximum 12 months."
    : `${productInput.value}: interest is calculated daily on the original principal. Maximum 24 months.`;
}

function renderFacts(facts, product, drawdownDate) {
  const groups = [
    {
      title: "THE LOAN",
      rows: [
        ["Loan product", product],
        ["Loan amount", formatCurrency(facts.principal)],
        ["Tenor", `${facts.durationMonths} months`],
        ["Loan start date", formatDate(drawdownDate)],
        ["First repayment date", formatDate(facts.schedule.firstPaymentDate)],
        ["Interest rate", `${facts.interestRate * 100}% per annum`],
        ["Interest calculation", facts.rateDescription],
        ["Security", `3% mandatory savings (${formatCurrency(facts.mandatorySavings)}), salary account / guarantor`]
      ]
    },
    {
      title: "TOTAL COST TO CONSUMER",
      rows: [
        ["Total amount to repay", formatCurrency(facts.totalRepayment)],
        ["Total interest", formatCurrency(facts.interest)],
        ["Average monthly repayment", formatCurrency(facts.repaymentAmount)],
        ["Annual percentage rate (APR)", `${facts.interestRate * 100}%`],
        ["Total cost of credit", formatCurrency(facts.totalCostOfCredit)]
      ]
    },
    {
      title: "FEES AND CHARGES",
      rows: [
        ["Management fee", formatCurrency(facts.managementFee)],
        ["VAT on management fee", formatCurrency(facts.managementFeeVat)],
        ["Adhesive stamp", formatCurrency(facts.adhesiveStamp)],
        ["Stamp duty", formatCurrency(facts.stampDuty)],
        ["Insurance", formatCurrency(facts.insurance)],
        ["Credit Bureau Search", formatCurrency(facts.creditBureau)],
        ["Total credit-provider fees (A)", formatCurrency(facts.lenderCharges)],
        ["Total third-party fees (B)", formatCurrency(facts.thirdPartyCharges)],
        ["Total fees and charges (A+B)", formatCurrency(facts.totalCharges)]
      ]
    }
  ];

  factsBody.replaceChildren();
  for (const group of groups) {
    const headingRow = document.createElement("tr");
    headingRow.className = "key-facts-section-row";
    const headingCell = document.createElement("th");
    headingCell.colSpan = 2;
    headingCell.scope = "colgroup";
    headingCell.textContent = group.title;
    headingRow.append(headingCell);
    factsBody.append(headingRow);

    for (const [label, value] of group.rows) {
      const row = document.createElement("tr");
      if (label.startsWith("Total")) row.className = "key-facts-total-row";
      const labelCell = document.createElement("th");
      labelCell.scope = "row";
      labelCell.textContent = label;
      const valueCell = document.createElement("td");
      valueCell.textContent = value;
      row.append(labelCell, valueCell);
      factsBody.append(row);
    }
  }
}

amountInput.addEventListener("focus", () => {
  amountInput.value = amountInput.value.replace(/,/g, "");
});
amountInput.addEventListener("blur", () => {
  const amount = Number(amountInput.value.replace(/,/g, "").trim());
  if (amountInput.value.trim() && Number.isFinite(amount)) {
    amountInput.value = amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
});
productInput.addEventListener("change", updateProductRules);
attachDateInputValidation(form);
startDateInput.value = formatDateInput(todayISODate());
updateProductRules();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  results.hidden = true;
  currentCalculation = null;
  validateDateInput(startDateInput);
  const drawdownDate = parseDateInput(startDateInput.value);
  if (!drawdownDate) {
    startDateInput.reportValidity();
    return;
  }

  const amount = Number(amountInput.value.replace(/,/g, "").trim());
  const durationMonths = Number(durationInput.value);
  const product = productInput.value;
  if (!Number.isFinite(amount) || amount <= 0) {
    errorMessage.textContent = "Enter a valid loan amount greater than zero.";
    errorMessage.hidden = false;
    return;
  }
  if (product === "Sharp Sharp" && (amount < 100000 || amount > 1000000)) {
    errorMessage.textContent = "Sharp Sharp amounts must be between ₦100,000.00 and ₦1,000,000.00.";
    errorMessage.hidden = false;
    return;
  }
  const maximumDuration = product === "Sharp Sharp" ? 12 : 24;
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > maximumDuration) {
    errorMessage.textContent = `${product} duration must be between 1 and ${maximumDuration} months.`;
    errorMessage.hidden = false;
    return;
  }

  try {
    const facts = globalThis.loanCalculations.calculateKeyFacts({
      recommendedAmount: amount,
      durationMonths,
      loanProduct: product,
      drawdownDate
    });
    currentCalculation = { amount, product, durationMonths, drawdownDate };
    renderFacts(facts, product, drawdownDate);
    results.hidden = false;
  } catch (error) {
    errorMessage.textContent = error.message || "Could not calculate the Key Facts Statement.";
    errorMessage.hidden = false;
  }
});

document.querySelector("#print-key-facts").addEventListener("click", () => {
  window.print();
});

saveButton.addEventListener("click", async () => {
  message.hidden = true;
  message.className = "calculator-save-message";
  if (!currentCalculation) return;
  if (!globalThis.loanDocuments?.saveCalculatorDocument) {
    message.textContent = "Word document saving is available in the NPF desktop app.";
    message.classList.add("error");
    message.hidden = false;
    return;
  }

  saveButton.disabled = true;
  const originalText = saveButton.textContent;
  saveButton.textContent = "Saving document…";
  try {
    const saved = await globalThis.loanDocuments.saveCalculatorDocument({
      documentType: "key-facts",
      ...currentCalculation,
      documentDate: todayISODate()
    });
    if (saved.canceled) {
      message.textContent = "Document save canceled.";
    } else {
      message.textContent = `Word document saved to ${saved.filePath}.`;
      message.classList.add("success");
      try {
        await globalThis.loanDocuments.clearCache();
      } catch (error) {
        message.textContent += ` The application cache could not be cleared: ${error.message || "Unknown error."}`;
        message.classList.remove("success");
        message.classList.add("error");
      }
    }
  } catch (error) {
    message.textContent = error.message || "Could not save the Key Facts Statement.";
    message.classList.add("error");
  } finally {
    message.hidden = false;
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
});

document.body.classList.add("key-facts-only");
