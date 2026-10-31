(function initializeDateUtils(root) {
  function isValidISODate(value) {
    if (typeof value !== "string" || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }

  function parseDateInput(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    if (!match) return null;

    const [, dayText, monthText, yearText] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const isoDate = `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return isValidISODate(isoDate) ? isoDate : null;
  }

  function formatDateInput(isoDate) {
    if (!isValidISODate(isoDate)) return "";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  function calculateRetirementDate(enlistmentDate) {
    if (!isValidISODate(enlistmentDate)) return null;
    const [year, month, day] = enlistmentDate.split("-").map(Number);
    const retirementYear = year + 35;
    const lastDayOfMonth = new Date(Date.UTC(retirementYear, month, 0)).getUTCDate();
    const retirementDay = Math.min(day, lastDayOfMonth);
    return `${retirementYear}-${String(month).padStart(2, "0")}-${String(retirementDay).padStart(2, "0")}`;
  }

  function todayISODate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function validateDateInput(input) {
    const value = input.value.trim();
    input.setCustomValidity(
      value && !parseDateInput(value)
        ? "Enter a valid date in DD/MM/YYYY format."
        : ""
    );
    return input.validity.valid;
  }

  function attachDateInputValidation(container) {
    const updateValidity = (event) => {
      if (event.target.matches?.("[data-date-input]")) validateDateInput(event.target);
    };
    container.addEventListener("input", updateValidity);
    container.addEventListener("change", updateValidity);
    container.querySelectorAll("[data-date-input]").forEach(validateDateInput);
  }

  const dateUtils = {
    attachDateInputValidation,
    calculateRetirementDate,
    formatDateInput,
    isValidISODate,
    parseDateInput,
    todayISODate,
    validateDateInput
  };
  root.npfDateUtils = dateUtils;
  if (typeof module !== "undefined" && module.exports) module.exports = dateUtils;
})(globalThis);
