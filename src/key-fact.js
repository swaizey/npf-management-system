const { addParagraph, centeredTitle, displayDate, heading, labelValue, money } = require("./document-utils");

function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function calculateKeyFacts(customer) {
  const principal = Number(customer.recommendedAmount);
  const durationMonths = Number(customer.durationMonths);
  const sharpSharp = customer.loanProduct === "Sharp Sharp";
  const interestRate = sharpSharp ? 0.04 : 0.26 / 12;
  const interest = roundCurrency(principal * interestRate * durationMonths);
  const totalRepayment = roundCurrency(principal + interest);
  const insurance = roundCurrency(principal * 0.015);
  const managementFee = sharpSharp ? 0 : roundCurrency(principal * 0.01);
  const managementFeeVat = roundCurrency(managementFee * 0.017);
  const creditBureau = 1000;
  const stampDuty = 1000;
  const seal = 50;
  const vatOnCrc = 75;
  const lenderCharges = roundCurrency(insurance + managementFee + managementFeeVat);
  const thirdPartyCharges = roundCurrency(creditBureau + stampDuty + seal + vatOnCrc);
  const totalCharges = roundCurrency(lenderCharges + thirdPartyCharges);

  return {
    principal,
    durationMonths,
    interestRate,
    rateDescription: sharpSharp ? "4% per month" : "26% per annum",
    interest,
    totalRepayment,
    repaymentAmount: roundCurrency(totalRepayment / durationMonths),
    insurance,
    managementFee,
    managementFeeVat,
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

function createKeyFacts(customer) {
  const facts = calculateKeyFacts(customer);
  const disclosureDate = displayDate(customer.documentDate);

  return [
    centeredTitle("KEY FACTS STATEMENT"),
    addParagraph("This statement summarizes the key information and costs of the loan for comparison purposes."),
    labelValue("DISCLOSURE DATE", disclosureDate),
    heading("The loan"),
    labelValue("Loan amount", money(facts.principal)),
    labelValue("Tenor", `${facts.durationMonths} months`),
    labelValue("Interest rate", facts.rateDescription + " flat"),
    heading("Total cost of consumer credit"),
    labelValue("Total interest charges", money(facts.interest)),
    labelValue("Total amount to be repaid (principal + interest)", money(facts.totalRepayment)),
    labelValue("Repayment amount", `${money(facts.repaymentAmount)} monthly for ${facts.durationMonths} months`),
    labelValue("Total fees and charges (A + B)", money(facts.totalCharges)),
    labelValue("Total cost of credit (interest + all charges)", money(facts.totalCostOfCredit)),
    heading("Fees and charges"),
    addParagraph("(A) Lender fees"),
    labelValue("Insurance (1.5% of loan amount)", money(facts.insurance)),
    ...(customer.loanProduct === "Sharp Sharp" ? [] : [
      labelValue("Management fee (1% of loan amount)", money(facts.managementFee)),
      labelValue("VAT on management fee (1.7% of management fee)", money(facts.managementFeeVat))
    ]),
    labelValue("Total lender fees (A)", money(facts.lenderCharges)),
    addParagraph("(B) Third-party fees and charges"),
    labelValue("Credit Bureau", money(facts.creditBureau)),
    labelValue("Stamp duty", money(facts.stampDuty)),
    labelValue("Seal", money(facts.seal)),
    labelValue("VAT on CRC", money(facts.vatOnCrc)),
    labelValue("Total third-party fees (B)", money(facts.thirdPartyCharges)),
    labelValue("Total fees and charges (A + B)", money(facts.totalCharges)),
    addParagraph("Fees and charges are shown separately from the total repayment of principal and interest.")
  ];
}

module.exports = { calculateKeyFacts, createKeyFacts };
