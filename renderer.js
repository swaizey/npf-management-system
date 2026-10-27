const form = document.querySelector("#loan-form");
const guarantorList = document.querySelector("#guarantors");
const message = document.querySelector("#form-message");
const generateButton = document.querySelector("#generate-button");
let guarantorCount = 0;

function addGuarantor() {
  guarantorCount += 1;
  const card = document.createElement("div");
  card.className = "guarantor-card";
  card.innerHTML = `
    <div class="guarantor-heading">
      <span>Guarantor ${guarantorCount}</span>
      ${guarantorCount > 1 ? '<button class="remove-guarantor" type="button">Remove</button>' : ""}
    </div>
    <div class="guarantor-grid">
      <label class="field"><span>Full name *</span><input name="guarantorName" required /></label>
      <label class="field"><span>Account number *</span><input name="guarantorAccount" required /></label>
      <label class="field"><span>BVN *</span><input name="guarantorBvn" required inputmode="numeric" /></label>
      <label class="field"><span>Phone number *</span><input name="guarantorPhone" required type="tel" /></label>
      <label class="field"><span>Retirement date *</span><input name="guarantorRetirementDate" required type="date" /></label>
      <label class="field"><span>Monthly salary (₦) *</span><input name="guarantorSalary" required type="text" inputmode="decimal" data-currency placeholder="e.g. 955,655.00" /></label>
      <label class="field"><span>AP / Force number *</span><input name="guarantorForceNumber" required /></label>
      <label class="field"><span>Office address *</span><input name="guarantorAddress" required /></label>
    </div>`;

  card.querySelector(".remove-guarantor")?.addEventListener("click", () => {
    card.remove();
    updateGuarantorHeadings();
  });
  guarantorList.append(card);
  updateGuarantorHeadings();
}

function updateGuarantorHeadings() {
  [...guarantorList.children].forEach((card, index) => {
    card.querySelector(".guarantor-heading span").textContent = `Guarantor ${index + 1}`;
    const removeButton = card.querySelector(".remove-guarantor");
    if (index === 0 && removeButton) removeButton.remove();
    if (index > 0 && !removeButton) {
      const button = document.createElement("button");
      button.className = "remove-guarantor";
      button.type = "button";
      button.textContent = "Remove";
      button.addEventListener("click", () => {
        card.remove();
        updateGuarantorHeadings();
      });
      card.querySelector(".guarantor-heading").append(button);
    }
  });
}

function fieldValue(name) {
  return form.elements.namedItem(name).value.trim();
}

function amountValue(name) {
  const value = fieldValue(name).replace(/,/g, "");
  return value === "" ? null : Number(value);
}

function selectedLoanProduct(recommendedAmount) {
  if (fieldValue("loanProduct") === "Sharp Sharp") return "Sharp Sharp";
  return recommendedAmount >= 1000000 ? "Term Loan" : "Other Micro Loan";
}

function updateLoanRules() {
  const product = selectedLoanProduct(amountValue("recommendedAmount") || 0);
  const duration = form.elements.namedItem("durationMonths");
  duration.max = product === "Sharp Sharp" ? "12" : "24";
  document.querySelector("#product-category").textContent = product === "Sharp Sharp"
    ? "Sharp Sharp: ₦100,000–₦1,000,000; maximum 12 months."
    : `${product}: maximum 24 months.`;
}

function validateLoanRules(customer) {
  const invalidCurrency = [...form.querySelectorAll("[data-currency]")].some((input) => {
    if (!input.value.trim() && !input.required) return false;
    const amount = Number(input.value.replace(/,/g, "").trim());
    return !Number.isFinite(amount) || amount < 0;
  });
  if (invalidCurrency) return "Enter valid non-negative amounts in all currency fields.";
  if (!["Male", "Female"].includes(customer.gender)) {
    return "Select the customer's gender.";
  }
  if (!Number.isFinite(customer.loanAmount) || customer.loanAmount <= 0) {
    return "Enter a valid loan amount requested.";
  }
  if (!Number.isFinite(customer.recommendedAmount) || customer.recommendedAmount <= 0) {
    return "Enter a valid recommended amount.";
  }
  if (customer.loanProduct === "Sharp Sharp"
      && (customer.recommendedAmount < 100000 || customer.recommendedAmount > 1000000)) {
    return "Sharp Sharp recommended amounts must be between ₦100,000.00 and ₦1,000,000.00.";
  }
  const maximumMonths = customer.loanProduct === "Sharp Sharp" ? 12 : 24;
  if (!Number.isInteger(customer.durationMonths) || customer.durationMonths < 1 || customer.durationMonths > maximumMonths) {
    return `${customer.loanProduct} duration must be between 1 and ${maximumMonths} months.`;
  }
  if (customer.repayment !== null && (!Number.isFinite(customer.repayment) || customer.repayment <= 0)) {
    return "Monthly repayment must be greater than zero, or leave it blank to estimate.";
  }
  return "";
}

function formatCurrencyInput(input) {
  const amount = Number(input.value.replace(/,/g, "").trim());
  if (input.value.trim() && Number.isFinite(amount)) {
    input.value = amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

function collectPayload() {
  const customer = {
    name: fieldValue("customerName"),
    gender: fieldValue("customerGender"),
    phone: fieldValue("customerPhone"),
    bvn: fieldValue("customerBvn"),
    nin: fieldValue("customerNin"),
    forceNumber: fieldValue("customerForceNumber"),
    dob: fieldValue("customerDob"),
    enlistmentDate: fieldValue("enlistmentDate"),
    retirementDate: fieldValue("customerRetirementDate"),
    salary: amountValue("customerSalary"),
    account: fieldValue("customerAccount"),
    id: fieldValue("customerId"),
    address: fieldValue("customerAddress"),
    loanAmount: amountValue("loanAmount"),
    recommendedAmount: amountValue("recommendedAmount"),
    loanRecommended: fieldValue("loanRecommended"),
    loanProduct: selectedLoanProduct(amountValue("recommendedAmount") || 0),
    purpose: fieldValue("purpose"),
    durationMonths: Number(fieldValue("durationMonths")),
    loanCycle: Number(fieldValue("loanCycle")),
    mss: fieldValue("mss"),
    dateApplied: fieldValue("dateApplied"),
    documentDate: fieldValue("documentDate"),
    drawdownDate: fieldValue("drawdownDate"),
    appraisingOfficer: fieldValue("appraisingOfficer"),
    repayment: amountValue("repayment")
  };

  const guarantorCards = [...guarantorList.querySelectorAll(".guarantor-card")];
  const guarantors = guarantorCards.map((card) => {
    const value = (name) => card.querySelector(`[name="${name}"]`).value.trim();
    return {
      name: value("guarantorName"),
      account: value("guarantorAccount"),
      bvn: value("guarantorBvn"),
      phone: value("guarantorPhone"),
      retirementDate: value("guarantorRetirementDate"),
      salary: Number(value("guarantorSalary").replace(/,/g, "")),
      forceNumber: value("guarantorForceNumber"),
      address: value("guarantorAddress")
    };
  });

  const templates = [...form.querySelectorAll('input[name="templates"]:checked')].map((input) => input.value);
  return { customer, guarantors, templates };
}

document.querySelector("#add-guarantor").addEventListener("click", addGuarantor);
form.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-currency]")) event.target.value = event.target.value.replace(/,/g, "");
});
form.addEventListener("focusout", (event) => {
  if (event.target.matches("[data-currency]")) formatCurrencyInput(event.target);
});
form.elements.namedItem("recommendedAmount").addEventListener("input", updateLoanRules);
form.elements.namedItem("loanProduct").addEventListener("change", updateLoanRules);
document.querySelector("#select-all").addEventListener("click", () => {
  form.querySelectorAll('input[name="templates"]').forEach((input) => { input.checked = true; });
});
form.elements.namedItem("dateApplied").valueAsDate = new Date();
form.elements.namedItem("documentDate").valueAsDate = new Date();
form.elements.namedItem("drawdownDate").valueAsDate = new Date();
addGuarantor();
updateLoanRules();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "form-message";
  message.textContent = "";
  const payload = collectPayload();
  const validationError = validateLoanRules(payload.customer);
  if (validationError) {
    message.classList.add("error");
    message.textContent = validationError;
    return;
  }
  if (!form.reportValidity()) return;
  if (payload.templates.length === 0) {
    message.classList.add("error");
    message.textContent = "Select at least one document template.";
    return;
  }

  generateButton.disabled = true;
  generateButton.querySelector("span").textContent = "Preparing document…";
  try {
    const result = await window.loanDocuments.save(payload);
    if (result.canceled) {
      message.textContent = "Export canceled.";
    } else {
      message.classList.add("success");
      message.textContent = `Word document saved to ${result.filePath}`;
    }
  } catch (error) {
    message.classList.add("error");
    message.textContent = error.message || "Could not create the Word document.";
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span").textContent = "Generate Word document";
  }
});
