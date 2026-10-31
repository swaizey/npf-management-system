const calculatorForm = document.querySelector("#calculator-form");
const amountInput = document.querySelector("#loan-amount");
const productInput = document.querySelector("#loan-product");
const durationInput = document.querySelector("#loan-duration");
const startDateInput = document.querySelector("#loan-start-date");
const productHint = document.querySelector("#product-hint");
const errorMessage = document.querySelector("#calculator-error");
const results = document.querySelector("#calculator-results");
const scheduleBody = document.querySelector("#schedule-body");
const keyFactsBody = document.querySelector("#key-facts-body");
const saveMessage = document.querySelector("#calculator-save-message");
const { formatDateInput, parseDateInput, todayISODate, validateDateInput, attachDateInputValidation } = globalThis.npfDateUtils;
let currentCalculation = null;

function formatCurrency(amount) {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  return globalThis.loanCalculations.formatScheduleDate(value);
}

function updateProductRules() {
  const isSharpSharp = productInput.value === "Sharp Sharp";
  durationInput.max = isSharpSharp ? "12" : "24";
  productHint.textContent = isSharpSharp
    ? "Sharp Sharp: 48% per annum (4% monthly equivalent), calculated daily on the original principal; amount ₦100,000–₦1,000,000; maximum 12 months."
    : `${productInput.value}: interest = principal × 26% × actual days ÷ 365 (or ÷ 366 in a leap year), calculated on the original principal. Maximum 24 months.`;
}

function clearCalculatorInputs() {
  calculatorForm.querySelectorAll("input").forEach((input) => {
    input.value = "";
    if (input.matches("[data-date-input]")) input.setCustomValidity("");
  });
  durationInput.value = "";
  productInput.selectedIndex = 0;
  currentCalculation = null;
  updateProductRules();
}

function clearSchedule() {
  scheduleBody.replaceChildren();
}

function showSchedule(schedule) {
  clearSchedule();
  for (const payment of schedule.installments) {
    const row = document.createElement("tr");
    const values = [
      payment.installment,
      formatDate(payment.dueDate),
      `${payment.daysInPeriod} days`,
      formatCurrency(payment.principal),
      formatCurrency(payment.interest),
      formatCurrency(payment.total),
      formatCurrency(payment.outstandingPrincipal)
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    scheduleBody.append(row);
  }
}

function showKeyFacts(facts, product, drawdownDate) {
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

  keyFactsBody.replaceChildren();
  for (const group of groups) {
    const headingRow = document.createElement("tr");
    headingRow.className = "key-facts-section-row";
    const headingCell = document.createElement("th");
    headingCell.colSpan = 2;
    headingCell.scope = "colgroup";
    headingCell.textContent = group.title;
    headingRow.append(headingCell);
    keyFactsBody.append(headingRow);

    for (const [label, value] of group.rows) {
      const row = document.createElement("tr");
      if (label.startsWith("Total")) row.className = "key-facts-total-row";
      const labelCell = document.createElement("th");
      labelCell.scope = "row";
      labelCell.textContent = label;
      const valueCell = document.createElement("td");
      valueCell.textContent = value;
      row.append(labelCell, valueCell);
      keyFactsBody.append(row);
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
attachDateInputValidation(calculatorForm);
startDateInput.value = formatDateInput(todayISODate());
updateProductRules();

document.querySelectorAll("[data-print-target]").forEach((button) => {
  button.addEventListener("click", () => {
    document.body.classList.remove("print-repayment", "print-key-facts");
    document.body.classList.add(`print-${button.dataset.printTarget}`);
    window.print();
  });
});

document.querySelectorAll("[data-save-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    saveMessage.hidden = true;
    saveMessage.className = "calculator-save-message";
    if (!currentCalculation) {
      saveMessage.textContent = "Simulate a repayment before saving a document.";
      saveMessage.classList.add("error");
      saveMessage.hidden = false;
      return;
    }
    if (!globalThis.loanDocuments?.saveCalculatorDocument) {
      saveMessage.textContent = "Word document saving is available in the NPF desktop app.";
      saveMessage.classList.add("error");
      saveMessage.hidden = false;
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Saving document…";
    try {
      const saved = await globalThis.loanDocuments.saveCalculatorDocument({
        documentType: button.dataset.saveTarget,
        ...currentCalculation,
        documentDate: todayISODate()
      });
      if (saved.canceled) {
        saveMessage.textContent = "Document save canceled.";
      } else {
        clearCalculatorInputs();
        try {
          await globalThis.loanDocuments.clearCache();
          saveMessage.textContent = `Word document saved to ${saved.filePath}. Form data and application cache cleared.`;
          saveMessage.classList.add("success");
        } catch (error) {
          saveMessage.textContent = `Word document saved to ${saved.filePath}, but the application cache could not be cleared: ${error.message || "Unknown error."} Form data was cleared.`;
          saveMessage.classList.add("error");
        }
      }
    } catch (error) {
      saveMessage.textContent = error.message || "Could not save the Word document.";
      saveMessage.classList.add("error");
    } finally {
      saveMessage.hidden = false;
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-repayment", "print-key-facts");
});

calculatorForm.addEventListener("submit", (event) => {
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
  const duration = Number(durationInput.value);
  const product = productInput.value;
  const isSharpSharp = product === "Sharp Sharp";

  if (!Number.isFinite(amount) || amount <= 0) {
    errorMessage.textContent = "Enter a valid loan amount greater than zero.";
    errorMessage.hidden = false;
    return;
  }
  if (isSharpSharp && (amount < 100000 || amount > 1000000)) {
    errorMessage.textContent = "Sharp Sharp amounts must be between ₦100,000.00 and ₦1,000,000.00.";
    errorMessage.hidden = false;
    return;
  }
  const maximumDuration = isSharpSharp ? 12 : 24;
  if (!Number.isInteger(duration) || duration < 1 || duration > maximumDuration) {
    errorMessage.textContent = `${product} duration must be between 1 and ${maximumDuration} months.`;
    errorMessage.hidden = false;
    return;
  }

  try {
    const schedule = globalThis.loanCalculations.calculateLoanSchedule(
      amount,
      duration,
      product,
      drawdownDate
    );
    const keyFacts = globalThis.loanCalculations.calculateKeyFacts({
      recommendedAmount: amount,
      durationMonths: duration,
      loanProduct: product,
      drawdownDate
    });
    currentCalculation = {
      amount,
      product,
      durationMonths: duration,
      drawdownDate
    };
    document.querySelector("#result-title").textContent = `${product} repayment summary`;
    document.querySelector("#average-repayment").textContent = formatCurrency(schedule.averageRepayment);
    document.querySelector("#total-interest").textContent = formatCurrency(schedule.totalInterest);
    document.querySelector("#total-repayment").textContent = formatCurrency(schedule.totalRepayment);
    showSchedule(schedule);
    showKeyFacts(keyFacts, product, drawdownDate);
    results.hidden = false;
  } catch (error) {
    errorMessage.textContent = error.message || "Could not calculate the repayment schedule.";
    errorMessage.hidden = false;
  }
});
