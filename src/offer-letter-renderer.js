const form = document.querySelector("#offer-letter-form");
const guarantorList = document.querySelector("#guarantors");
const message = document.querySelector("#form-message");
const generateButton = document.querySelector("#generate-button");
const generateButtonLabel = generateButton.querySelector("span").textContent;
const { formatDateInput, parseDateInput, todayISODate, attachDateInputValidation } = globalThis.npfDateUtils;

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

function addGuarantor() {
  const card = document.createElement("div");
  card.className = "guarantor-card";
  card.innerHTML = `
    <div class="guarantor-heading"><span></span></div>
    <div class="guarantor-grid">
      <label class="field"><span>Full name *</span><input name="guarantorName" required /></label>
      <label class="field"><span>Account number *</span><input name="guarantorAccount" required /></label>
    </div>`;
  guarantorList.append(card);
  updateGuarantorHeadings();
}

function formatCurrencyInput(input) {
  const amount = Number(input.value.replace(/,/g, "").trim());
  if (input.value.trim() && Number.isFinite(amount)) {
    input.value = amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

document.querySelector("#add-guarantor").addEventListener("click", addGuarantor);
form.addEventListener("focusin", (event) => {
  if (event.target.matches("[data-currency]")) event.target.value = event.target.value.replace(/,/g, "");
});
form.addEventListener("focusout", (event) => {
  if (event.target.matches("[data-currency]")) formatCurrencyInput(event.target);
});
attachDateInputValidation(form);
form.elements.namedItem("drawdownDate").value = formatDateInput(todayISODate());
form.elements.namedItem("dateApplied").value = formatDateInput(todayISODate());
form.elements.namedItem("loanProduct").addEventListener("change", () => {
  form.elements.namedItem("durationMonths").max =
    form.elements.namedItem("loanProduct").value === "Sharp Sharp" ? "12" : "24";
});
addGuarantor();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "form-message";
  message.textContent = "";
  const amount = Number(form.elements.namedItem("approvedAmount").value.replace(/,/g, "").trim());
  const loanAmount = Number(form.elements.namedItem("loanAmount").value.replace(/,/g, "").trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    message.classList.add("error");
    message.textContent = "Enter a valid approved loan amount greater than zero.";
    return;
  }
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
    message.classList.add("error");
    message.textContent = "Enter a valid loan amount applied for.";
    return;
  }
  if (!form.reportValidity()) return;

  const customer = {
    name: form.elements.namedItem("customerName").value.trim(),
    address: form.elements.namedItem("customerAddress").value.trim(),
    gender: form.elements.namedItem("customerGender").value,
    purpose: form.elements.namedItem("purpose").value.trim(),
    loanAmount,
    approvedAmount: amount,
    loanProduct: form.elements.namedItem("loanProduct").value,
    durationMonths: Number(form.elements.namedItem("durationMonths").value),
    dateApplied: parseDateInput(form.elements.namedItem("dateApplied").value),
    drawdownDate: parseDateInput(form.elements.namedItem("drawdownDate").value)
  };
  const guarantors = [...guarantorList.querySelectorAll(".guarantor-card")].map((card) => ({
    name: card.querySelector('[name="guarantorName"]').value.trim(),
    account: card.querySelector('[name="guarantorAccount"]').value.trim()
  }));

  generateButton.disabled = true;
  generateButton.querySelector("span").textContent = "Preparing document…";
  try {
    const result = await window.loanDocuments.saveOfferLetter({ customer, guarantors });
    if (result.canceled) {
      message.textContent = "Export canceled.";
    } else {
      form.reset();
      guarantorList.replaceChildren();
      addGuarantor();
      form.elements.namedItem("drawdownDate").value = formatDateInput(todayISODate());
      form.elements.namedItem("dateApplied").value = formatDateInput(todayISODate());
      form.elements.namedItem("durationMonths").value = "24";
      form.elements.namedItem("durationMonths").max = "24";
      form.elements.namedItem("loanProduct").value = "amount-based";
      try {
        await window.loanDocuments.clearCache();
        message.classList.add("success");
        message.textContent = `Offer letter saved to ${result.filePath}. Form data and application cache cleared.`;
      } catch (error) {
        message.classList.add("error");
        message.textContent = `Offer letter saved to ${result.filePath}, but the application cache could not be cleared: ${error.message || "Unknown error."} Form data was cleared.`;
      }
    }
  } catch (error) {
    message.classList.add("error");
    message.textContent = error.message || "Could not create the offer letter.";
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span").textContent = generateButtonLabel;
  }
});
