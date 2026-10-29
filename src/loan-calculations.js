function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatScheduleDate(value) {
  let year;
  let month;
  let day;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (Number.isNaN(Date.prototype.getTime.call(value))) return "";
    year = value.getFullYear();
    month = value.getMonth() + 1;
    day = value.getDate();
  } else {
    const isoDate = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoDate) {
      year = Number(isoDate[1]);
      month = Number(isoDate[2]);
      day = Number(isoDate[3]);
    } else {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      year = date.getFullYear();
      month = date.getMonth() + 1;
      day = date.getDate();
    }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  const monthName = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1];
  return `${String(day).padStart(2, "0")}-${monthName}-${year}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date, months) {
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function calculateInterest(principal, annualRate, startDate, endDate, useLeapYearDenominator) {
  if (!useLeapYearDenominator) {
    const days = Math.round((endDate - startDate) / 86400000);
    return roundCurrency(principal * annualRate * days / 365);
  }

  let interest = 0;
  let periodStart = new Date(startDate);
  while (periodStart < endDate) {
    const year = periodStart.getUTCFullYear();
    const nextYear = new Date(Date.UTC(year + 1, 0, 1));
    const periodEnd = endDate < nextYear ? endDate : nextYear;
    const days = Math.round((periodEnd - periodStart) / 86400000);
    const yearDays = new Date(Date.UTC(year + 1, 0, 1)) - new Date(Date.UTC(year, 0, 1)) === 366 * 86400000
      ? 366
      : 365;
    interest += principal * annualRate * days / yearDays;
    periodStart = periodEnd;
  }
  return roundCurrency(interest);
}

function calculateOfferLetterValues(customer) {
  const principal = Number(customer.recommendedAmount);
  const documentDate = parseDate(customer.documentDate);
  const effectiveDate = documentDate ? addDays(documentDate, 30) : null;
  const expiryDate = effectiveDate ? addMonths(effectiveDate, Number(customer.durationMonths)) : null;
  const managementFee = roundCurrency(principal * 0.01);
  return {
    approvedAmount: principal,
    effectiveDate: effectiveDate ? formatDate(effectiveDate) : null,
    expiryDate: expiryDate ? formatDate(expiryDate) : null,
    managementFee,
    managementFeeVat: roundCurrency(managementFee * 0.075),
    mandatorySavings: roundCurrency(principal * 0.03),
    insurance: roundCurrency(principal * 0.015)
  };
}

function calculateLoanSchedule(principalValue, durationMonthsValue, product, drawdownDate) {
  const principal = roundCurrency(Number(principalValue));
  const durationMonths = Number(durationMonthsValue);
  const drawdown = parseDate(drawdownDate);
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("Loan principal must be greater than zero.");
  }
  if (!Number.isInteger(durationMonths) || durationMonths < 1) {
    throw new Error("Loan duration must be at least one month.");
  }
  if (!drawdown) {
    throw new Error("Enter a valid drawdown date to calculate the repayment schedule.");
  }

  const sharpSharp = product === "Sharp Sharp";
  const annualRate = sharpSharp ? 0.48 : 0.26;
  const fixedPrincipal = roundCurrency(principal / durationMonths);
  let outstandingPrincipal = principal;
  let previousDate = drawdown;
  const installments = [];

  for (let index = 0; index < durationMonths; index += 1) {
    const dueDate = addMonths(drawdown, index + 1);
    const daysInPeriod = Math.round((dueDate - previousDate) / 86400000);
    const principalPayment = index === durationMonths - 1
      ? outstandingPrincipal
      : Math.min(fixedPrincipal, outstandingPrincipal);
    const openingPrincipal = outstandingPrincipal;
    const interestPayment = calculateInterest(principal, annualRate, previousDate, dueDate, !sharpSharp);
    const totalPayment = roundCurrency(principalPayment + interestPayment);
    outstandingPrincipal = roundCurrency(outstandingPrincipal - principalPayment);
    installments.push({
      installment: index + 1,
      dueDate: formatDate(dueDate),
      daysInPeriod,
      openingPrincipal,
      principal: principalPayment,
      interest: interestPayment,
      total: totalPayment,
      outstandingPrincipal
    });
    previousDate = dueDate;
  }

  const totalInterest = roundCurrency(installments.reduce((total, item) => total + item.interest, 0));
  const totalRepayment = roundCurrency(installments.reduce((total, item) => total + item.total, 0));
  return {
    principal,
    durationMonths,
    annualRate: sharpSharp ? 0.48 : 0.26,
    rateDescription: sharpSharp
      ? "48% per annum (4% monthly equivalent), calculated daily on the original principal"
      : "26% per annum on the original principal (principal × 26% × actual days ÷ 365, or ÷ 366 in a leap year)",
    firstPaymentDate: installments[0].dueDate,
    installments,
    totalInterest,
    totalRepayment,
    averageRepayment: roundCurrency(totalRepayment / durationMonths)
  };
}

function calculateMonthlyRepayment(amount, durationMonths, product, drawdownDate) {
  return calculateLoanSchedule(amount, durationMonths, product, drawdownDate).averageRepayment;
}

function calculateKeyFacts(customer) {
  const principal = Number(customer.recommendedAmount);
  const durationMonths = Number(customer.durationMonths);
  const schedule = calculateLoanSchedule(
    principal,
    durationMonths,
    customer.loanProduct,
    customer.drawdownDate
  );
  const sharpSharp = customer.loanProduct === "Sharp Sharp";
  const interest = schedule.totalInterest;
  const totalRepayment = schedule.totalRepayment;
  const insurance = roundCurrency(principal * 0.015);
  const mandatorySavings = roundCurrency(principal * 0.03);
  const managementFee = sharpSharp ? 0 : roundCurrency(principal * 0.01);
  const managementFeeVat = roundCurrency(managementFee * 0.075);
  const adhesiveStamp = 1000;
  const creditBureau = 1000;
  const stampDuty = 50;
  const seal = 0;
  const vatOnCrc = 0;
  const lenderCharges = managementFee;
  const thirdPartyCharges = roundCurrency(adhesiveStamp + stampDuty + insurance + creditBureau + managementFeeVat);
  const totalCharges = roundCurrency(lenderCharges + thirdPartyCharges);

  return {
    principal,
    durationMonths,
    interestRate: schedule.annualRate,
    rateDescription: schedule.rateDescription,
    interest,
    totalRepayment,
    repaymentAmount: schedule.averageRepayment,
    schedule,
    insurance,
    mandatorySavings,
    managementFee,
    managementFeeVat,
    adhesiveStamp,
    creditBureau,
    stampDuty,
    seal,
    vatOnCrc,
    lenderCharges,
    thirdPartyCharges,
    totalCharges,
    totalCostOfCredit: roundCurrency(interest + totalCharges)
  };
}

const loanCalculations = {
  calculateKeyFacts,
  calculateLoanSchedule,
  calculateMonthlyRepayment,
  calculateOfferLetterValues,
  formatScheduleDate,
  roundCurrency
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = loanCalculations;
} else {
  globalThis.loanCalculations = loanCalculations;
}
