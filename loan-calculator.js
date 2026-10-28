const calculatorForm = document.querySelector("#calculator-form");
const amountInput = document.querySelector("#loan-amount");
const productInput = document.querySelector("#loan-product");
const durationInput = document.querySelector("#loan-duration");
const startDateInput = document.querySelector("#loan-start-date");
const productHint = document.querySelector("#product-hint");
const errorMessage = document.querySelector("#calculator-error");
const results = document.querySelector("#calculator-results");
const scheduleBody = document.querySelector("#schedule-body");

function formatCurrency(amount) {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  return globalThis.loanCalculations.formatScheduleDate(value);
}

function todayAsDateInput() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function updateProductRules() {
  const isSharpSharp = productInput.value === "Sharp Sharp";
  durationInput.max = isSharpSharp ? "12" : "24";
  productHint.textContent = isSharpSharp
    ? "Sharp Sharp: 4% flat per month; amount ₦100,000–₦1,000,000; maximum 12 months."
    : `${productInput.value}: 26% per annum on the original principal; interest varies by days in each period. Maximum 24 months.`;
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
startDateInput.value = todayAsDateInput();
updateProductRules();

calculatorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  results.hidden = true;

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
      startDateInput.value
    );
    document.querySelector("#result-title").textContent = `${product} repayment summary`;
    document.querySelector("#average-repayment").textContent = formatCurrency(schedule.averageRepayment);
    document.querySelector("#total-interest").textContent = formatCurrency(schedule.totalInterest);
    document.querySelector("#total-repayment").textContent = formatCurrency(schedule.totalRepayment);
    showSchedule(schedule);
    results.hidden = false;
  } catch (error) {
    errorMessage.textContent = error.message || "Could not calculate the repayment schedule.";
    errorMessage.hidden = false;
  }
});
