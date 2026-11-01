const assert = require("node:assert/strict");
const JSZip = require("jszip");
const {
  calculateMonthlyRepayment,
  createLoanDocument,
  resolveLoanProduct,
  validateGuarantorDates,
  validateLoanDetails
} = require("./src/Appraisal");
const { calculateKeyFacts, calculateLoanSchedule, formatScheduleDate } = require("./src/loan-calculations");
const { createCalculatorDocument } = require("./src/calculator-documents");
const {
  formatDateInput,
  isValidISODate,
  calculateRetirementDate,
  parseDateInput,
  validateDateInput
} = require("./src/date-utils");
const { samplePayload } = require("./sample-data");
const { amountInWords, money } = require("./src/document-utils");

async function readDocumentText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

async function readDocumentXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml").async("string");
}

function findTableXml(xml, text) {
  return (xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [])
    .find((table) => table.includes(text));
}

(async () => {
  try {
    assert.equal(resolveLoanProduct({ recommendedAmount: 999999 }), "Other Micro Loan");
    assert.equal(resolveLoanProduct({ recommendedAmount: 1000000 }), "Other Micro Loan");
    assert.equal(resolveLoanProduct({ recommendedAmount: 1000001 }), "Term Loan");
    assert.equal(resolveLoanProduct({ recommendedAmount: 1000000.99 }), "Other Micro Loan");
    assert.equal(resolveLoanProduct({ recommendedAmount: 1000000, loanProduct: "Sharp Sharp" }), "Sharp Sharp");
    assert.equal(amountInWords(1000000), "One Million Naira Only");
    assert.equal(amountInWords(1000000.5), "One Million Naira and Fifty Kobo Only");
    assert.equal(parseDateInput("22/4/2025"), "2025-04-22");
    assert.equal(parseDateInput("1/13/2025"), null);
    assert.equal(parseDateInput("31/04/2025"), null);
    assert.equal(parseDateInput("29/02/2024"), "2024-02-29");
    assert.equal(parseDateInput("29/02/2025"), null);
    assert.equal(formatDateInput("2025-04-22"), "22/04/2025");
    assert.equal(isValidISODate("2025-13-01"), false);
    assert.equal(calculateRetirementDate("2000-04-22"), "2035-04-22");
    assert.equal(calculateRetirementDate("1996-02-29"), "2031-02-28");
    assert.equal(calculateRetirementDate("invalid"), null);
    let dateInputMessage = "";
    const dateInput = {
      value: "1/13/2025",
      validity: { valid: false },
      setCustomValidity(message) {
        dateInputMessage = message;
        this.validity.valid = !message;
      }
    };
    assert.equal(validateDateInput(dateInput), false);
    assert.match(dateInputMessage, /DD\/MM\/YYYY/);
    dateInput.value = "22/4/2025";
    assert.equal(validateDateInput(dateInput), true);

    const sharpSharp = {
      ...samplePayload.customer,
      gender: "Male",
      loanAmount: 100000,
      recommendedAmount: 100000,
      loanProduct: "Sharp Sharp",
      durationMonths: 12,
      dob: "1980-01-01",
      enlistmentDate: "2000-01-01",
      retirementDate: "2030-01-01",
      dateApplied: "2026-10-20",
      documentDate: "2026-10-25",
      drawdownDate: "2026-10-25"
    };
    assert.equal(validateLoanDetails(sharpSharp), "");
    assert.equal(validateLoanDetails(samplePayload.customer), "");
    assert.match(validateLoanDetails({ ...sharpSharp, gender: "" }), /gender/);
    assert.match(validateLoanDetails({ ...sharpSharp, name: "Ada\u0001Nwosu" }), /control characters/);
    assert.match(validateLoanDetails({ ...sharpSharp, phone: "script>alert" }), /phone number/);
    assert.match(validateLoanDetails({ ...sharpSharp, bvn: "not-a-bvn" }), /11-digit/);
    assert.match(validateLoanDetails({ ...sharpSharp, salary: "190000" }), /salary/);
    assert.match(validateLoanDetails({ ...sharpSharp, drawdownDate: "2026-02-31" }), /drawdown date/);
    assert.match(validateLoanDetails({ ...sharpSharp, documentDate: "2026-13-01" }), /appraisal \/ offer date/);
    assert.equal(validateGuarantorDates(samplePayload.guarantors), "");
    assert.match(validateGuarantorDates([{ ...samplePayload.guarantors[0], retirementDate: "2025-13-01" }]), /guarantor 1/);
    assert.match(validateGuarantorDates([{ ...samplePayload.guarantors[0], address: "Office\u0000address" }]), /control characters/);
    assert.match(validateGuarantorDates([]), /between 1 and 50/);
    assert.throws(
      () => createLoanDocument({
        ...samplePayload,
        customer: { ...samplePayload.customer, appraisingOfficer: "Unknown Officer" }
      }, ["appraisal"]).toBuffer(),
      /valid appraising officer/
    );
    assert.throws(
      () => createLoanDocument(samplePayload, ["unexpected"]).toBuffer(),
      /valid document/
    );
    assert.match(validateLoanDetails({ ...sharpSharp, recommendedAmount: 99999 }), /between/);
    assert.match(validateLoanDetails({ ...sharpSharp, recommendedAmount: 1000001 }), /between/);
    assert.match(validateLoanDetails({ ...sharpSharp, durationMonths: 13 }), /between 1 and 12/);
    assert.match(validateLoanDetails({ ...sharpSharp, loanProduct: "Term Loan", durationMonths: 25 }), /between 1 and 24/);
    const sharpSchedule = calculateLoanSchedule(100000, 12, "Sharp Sharp", "2026-10-25");
    assert.equal(calculateMonthlyRepayment(100000, 12, "Sharp Sharp", "2026-10-25"), 12333.33);
    assert.equal(sharpSchedule.installments[0].interest, 4076.71);
    assert.equal(sharpSchedule.installments[0].daysInPeriod, 31);
    assert.equal(sharpSchedule.installments[1].interest, 3945.21);
    assert.equal(sharpSchedule.installments[1].daysInPeriod, 30);
    assert.equal(sharpSchedule.installments[11].interest, 3945.21);
    assert.equal(sharpSchedule.totalInterest, 48000);
    assert.equal(sharpSchedule.rateDescription, "48% per annum (4% monthly equivalent), calculated daily on the original principal");
    const sharpCalendarDays = calculateLoanSchedule(1000000, 12, "Sharp Sharp", "2025-01-31");
    assert.deepEqual(sharpCalendarDays.installments.slice(0, 3).map(({ daysInPeriod, interest }) => [daysInPeriod, interest]), [
      [28, 36821.92],
      [31, 40767.12],
      [30, 39452.05]
    ]);
    assert.equal(calculateMonthlyRepayment(1000000, 24, "Term Loan", "2026-10-25"), 63338.85);
    for (const product of ["Term Loan", "Other Micro Loan"]) {
      const schedule = calculateLoanSchedule(2500000, 24, product, "2025-01-31");
      assert.equal(schedule.annualRate, 0.26);
      assert.deepEqual(schedule.installments.slice(0, 3).map(({ daysInPeriod, interest }) => [daysInPeriod, interest]), [
        [28, 49863.01],
        [31, 55205.48],
        [30, 53424.66]
      ]);
    }
    assert.equal(formatScheduleDate("2026-11-28"), "28-NOV-2026");
    assert.equal(formatScheduleDate(new Date(2026, 10, 28, 1)), "28-NOV-2026");
    const crossRealmDate = require("node:vm").runInNewContext("new Date(2026, 10, 28, 1)");
    assert.equal(formatScheduleDate(crossRealmDate), "28-NOV-2026");
    assert.equal(formatScheduleDate("Sat Nov 28 2026 01:00:00 GMT+0100 (West Africa Time)"), "28-NOV-2026");

    const repaymentSchedule = calculateLoanSchedule(1500000, 24, "Term Loan", "2026-10-22");
    assert.deepEqual(repaymentSchedule.installments.slice(0, 2).map((payment) => ({
      dueDate: payment.dueDate,
      daysInPeriod: payment.daysInPeriod,
      openingPrincipal: payment.openingPrincipal,
      principal: payment.principal,
      interest: payment.interest,
      total: payment.total
    })), [
      { dueDate: "2026-11-22", daysInPeriod: 31, openingPrincipal: 1500000, principal: 62500, interest: 33123.29, total: 95623.29 },
      { dueDate: "2026-12-22", daysInPeriod: 30, openingPrincipal: 1437500, principal: 62500, interest: 32054.79, total: 94554.79 }
    ]);
    assert.equal(repaymentSchedule.totalInterest, 780207.28);
    assert.equal(repaymentSchedule.installments[23].outstandingPrincipal, 0);

    const monthEndSchedule = calculateLoanSchedule(1500000, 5, "Term Loan", "2025-01-31");
    assert.deepEqual(monthEndSchedule.installments.map((payment) => ({
      dueDate: payment.dueDate,
      daysInPeriod: payment.daysInPeriod,
      openingPrincipal: payment.openingPrincipal,
      interest: payment.interest,
      total: payment.total
    })), [
      { dueDate: "2025-02-28", daysInPeriod: 28, openingPrincipal: 1500000, interest: 29917.81, total: 329917.81 },
      { dueDate: "2025-03-31", daysInPeriod: 31, openingPrincipal: 1200000, interest: 33123.29, total: 333123.29 },
      { dueDate: "2025-04-30", daysInPeriod: 30, openingPrincipal: 900000, interest: 32054.79, total: 332054.79 },
      { dueDate: "2025-05-31", daysInPeriod: 31, openingPrincipal: 600000, interest: 33123.29, total: 333123.29 },
      { dueDate: "2025-06-30", daysInPeriod: 30, openingPrincipal: 300000, interest: 32054.79, total: 332054.79 }
    ]);
    assert.equal(monthEndSchedule.installments[1].interest, monthEndSchedule.installments[3].interest);
    assert.equal(monthEndSchedule.installments[2].interest, monthEndSchedule.installments[4].interest);

    const leapYearSchedule = calculateLoanSchedule(1500000, 2, "Term Loan", "2024-01-31");
    assert.deepEqual(leapYearSchedule.installments.map((payment) => [payment.dueDate, payment.daysInPeriod]), [
      ["2024-02-29", 29],
      ["2024-03-31", 31]
    ]);
    assert.equal(leapYearSchedule.installments[0].interest, 30901.64);
    assert.equal(leapYearSchedule.installments[1].interest, 33032.79);

    const nonLeapInterest = calculateLoanSchedule(1500000, 1, "Other Micro Loan", "2025-01-01");
    assert.deepEqual(nonLeapInterest.installments.map(({ daysInPeriod, interest }) => [daysInPeriod, interest]), [
      [31, 33123.29]
    ]);

    const leapYearInterest = calculateLoanSchedule(1500000, 1, "Other Micro Loan", "2024-01-31");
    assert.deepEqual(leapYearInterest.installments.map(({ daysInPeriod, interest }) => [daysInPeriod, interest]), [
      [29, 30901.64]
    ]);

    const crossYearInterest = calculateLoanSchedule(1500000, 1, "Term Loan", "2023-12-15");
    assert.deepEqual(crossYearInterest.installments.map(({ daysInPeriod, interest }) => [daysInPeriod, interest]), [
      [31, 33082.42]
    ]);

    const termKeyFacts = calculateKeyFacts({
      recommendedAmount: 1000000,
      durationMonths: 24,
      loanProduct: "Term Loan",
      drawdownDate: "2026-10-25"
    });
    assert.equal(termKeyFacts.interest, 520132.34);
    assert.equal(termKeyFacts.totalRepayment, 1520132.34);
    assert.equal(termKeyFacts.mandatorySavings, 30000);
    assert.equal(termKeyFacts.insurance, 15000);
    assert.equal(termKeyFacts.managementFee, 10000);
    assert.equal(termKeyFacts.managementFeeVat, 750);
    assert.equal(termKeyFacts.adhesiveStamp, 1000);
    assert.equal(termKeyFacts.thirdPartyCharges, 17800);
    assert.equal(termKeyFacts.totalCharges, 27800);
    assert.equal(termKeyFacts.totalCostOfCredit, 547932.34);

    const calculatorDocumentPayload = {
      amount: 1000000,
      product: "Term Loan",
      durationMonths: 2,
      drawdownDate: "2026-10-25",
      documentDate: "2026-10-29"
    };
    const calculatorRepaymentBuffer = await createCalculatorDocument({
      ...calculatorDocumentPayload,
      documentType: "repayment"
    }).toBuffer();
    const calculatorRepaymentText = await readDocumentText(calculatorRepaymentBuffer);
    const calculatorRepaymentXml = await readDocumentXml(calculatorRepaymentBuffer);
    assert.match(calculatorRepaymentText, /LOAN REPAYMENT SCHEDULE/);
    assert.doesNotMatch(calculatorRepaymentText, /Days in Period/);
    assert.doesNotMatch(calculatorRepaymentText, /Interest is calculated on the original principal at 26% per annum using actual days in each repayment period/);
    assert.match(calculatorRepaymentText, /Total Interest/);
    assert.match(calculatorRepaymentText, /25-NOV-2026/);
    assert.match(calculatorRepaymentXml, /w:orient="landscape"/);
    assert.match(calculatorRepaymentXml, /w:fill="D9EEF2"/);
    assert.match(calculatorRepaymentXml, /<w:footerReference w:type="default" r:id="rId\d+"\/>/);
    const calculatorRepaymentZip = await JSZip.loadAsync(calculatorRepaymentBuffer);
    const repaymentFooterPath = Object.keys(calculatorRepaymentZip.files)
      .find((filePath) => /^word\/footer\d+\.xml$/.test(filePath));
    assert.ok(repaymentFooterPath);
    const repaymentFooterXml = await calculatorRepaymentZip.file(repaymentFooterPath).async("string");
    assert.match(repaymentFooterXml, /<wp:extent cx="952500" cy="314325"\/>/);
    assert.match(repaymentFooterXml, /descr="NPF Microfinance Bank logo"/);
    const repaymentFooterRelsPath = repaymentFooterPath.replace(/^word\//, "word/_rels/") + ".rels";
    const repaymentFooterRelsXml = await calculatorRepaymentZip.file(repaymentFooterRelsPath).async("string");
    const thumbnailPath = repaymentFooterRelsXml.match(/Target="media\/([^"]+)"/);
    assert.ok(thumbnailPath);
    assert.ok(calculatorRepaymentZip.file(`word/media/${thumbnailPath[1]}`));
    const repaymentTableXml = findTableXml(calculatorRepaymentXml, "Repayment Date");
    assert.ok(repaymentTableXml);
    assert.doesNotMatch(repaymentTableXml, /₦/);
    assert.doesNotMatch(repaymentTableXml, /Days in Period/);
    assert.match(repaymentTableXml, /<w:tblGrid><w:gridCol w:w="1700"\/><w:gridCol w:w="1400"\/><w:gridCol w:w="1400"\/><w:gridCol w:w="1400"\/><w:gridCol w:w="850"\/>[\s\S]*?<w:gridCol w:w="950"\/><w:gridCol w:w="950"\/>/);
    assert.ok((repaymentTableXml.match(/<w:sz w:val="17"\/>/g) || []).length >= 12);
    assert.ok((repaymentTableXml.match(/<w:sz w:val="22"\/>/g) || []).length > 12);
    assert.match(repaymentTableXml, /<w:top w:type="dxa" w:w="110"\/>/);
    assert.equal((repaymentTableXml.match(/<w:tblHeader\b/g) || []).length, 1);
    assert.doesNotMatch(repaymentTableXml, /AUTHORISED SIGNATORY/);
    const signatoryTableXml = findTableXml(calculatorRepaymentXml, "AUTHORISED SIGNATORY");
    assert.ok(signatoryTableXml);
    assert.match(signatoryTableXml, /<w:tblGrid><w:gridCol w:w="3000"\/><w:gridCol w:w="9838"\/><w:gridCol w:w="3000"\/><\/w:tblGrid>/);
    assert.match(calculatorRepaymentText, /AUTHORISED SIGNATORY\s+CUSTOMER SIGNATORY/);
    assert.equal((signatoryTableXml.match(/<w:top\b[^>]*w:val="single"/g) || []).length, 2);

    const calculatorKeyFactsBuffer = await createCalculatorDocument({
      ...calculatorDocumentPayload,
      documentType: "key-facts"
    }).toBuffer();
    const calculatorKeyFactsText = await readDocumentText(calculatorKeyFactsBuffer);
    const calculatorKeyFactsXml = await readDocumentXml(calculatorKeyFactsBuffer);
    assert.match(calculatorKeyFactsText, /KEY FACTS STATEMENT/);
    assert.match(calculatorKeyFactsText, /Repayments/);
    assert.match(calculatorKeyFactsText, /Fees and charges comprise of/);
    assert.match(calculatorKeyFactsXml, /w:orient="portrait"/);
    assert.match(calculatorKeyFactsXml, /w:fill="D9EEF2"/);
    assert.doesNotMatch(calculatorKeyFactsXml, /<w:footerReference/);

    const sharpKeyFacts = calculateKeyFacts({
      recommendedAmount: 100000,
      durationMonths: 12,
      loanProduct: "Sharp Sharp",
      drawdownDate: "2026-10-25"
    });
    assert.equal(sharpKeyFacts.interest, 48000);
    assert.equal(sharpKeyFacts.managementFee, 0);
    assert.equal(sharpKeyFacts.managementFeeVat, 0);
    assert.equal(sharpKeyFacts.totalCharges, 3550);

    const buffer = await createLoanDocument(samplePayload, samplePayload.templates).toBuffer();
    console.log(`Generated document buffer size: ${buffer.length} bytes`);
    const keyFactBuffer = await createLoanDocument(samplePayload, ["keyfact"]).toBuffer();
    assert.ok(keyFactBuffer.length > 0);
    console.log(`Generated Key Facts Statement buffer size: ${keyFactBuffer.length} bytes`);
    const keyFactText = await readDocumentText(keyFactBuffer);
    const sampleKeyFacts = calculateKeyFacts({
      ...samplePayload.customer,
      loanProduct: resolveLoanProduct(samplePayload.customer)
    });
    assert.match(keyFactText, /THIS IS NOT AN OFFER OF CREDIT OR CONTRACT/);
    assert.match(keyFactText, /This Key Facts Statement \(KFS\) summarizes key information/);
    assert.match(keyFactText, /DISCLOSURE DATE/);
    assert.match(keyFactText, /The final loan features may differ because of your personal financial position/);
    assert.match(keyFactText, /TOTAL COST TO CONSUMER/);
    assert.ok(keyFactText.includes(`Total amount you will pay back: ${money(sampleKeyFacts.totalRepayment)}`));
    assert.ok(keyFactText.includes(`This means you will pay back ${money(sampleKeyFacts.interest)} in interest for ${money(sampleKeyFacts.principal)} borrowed.`));
    assert.match(keyFactText, /Annual Percentage Rate \(APR\): 26%/);
    assert.match(keyFactText, /useful tool for comparison with similar loans/);
    assert.ok(keyFactText.includes(`3% Mandatory Deposit (${money(sampleKeyFacts.mandatorySavings)})`));
    assert.match(keyFactText, /Specific information about your loan/);
    assert.ok(keyFactText.includes(`Loan received ${money(sampleKeyFacts.principal)}`));
    assert.ok(keyFactText.includes("Total interest charges (total interest you will pay)"));
    assert.ok(keyFactText.includes(`(Total interest may increase for variable interest rates.) ${money(sampleKeyFacts.interest)}`));
    assert.ok(keyFactText.includes("Total fees and charges*"));
    assert.ok(keyFactText.includes(`(Total other charges you will pay throughout the duration of the loan.) ${money(sampleKeyFacts.totalCharges)}`));
    assert.ok(keyFactText.includes("Total cost of credit"));
    assert.ok(keyFactText.includes(`Total cost of credit (This is made up of total interest and all other charges for the tenor of the loan.) ${money(sampleKeyFacts.totalCostOfCredit)}`));
    assert.ok(keyFactText.includes(`Date of first repayment ${require("./src/document-utils").displayDate(sampleKeyFacts.schedule.firstPaymentDate)}`));
    assert.match(keyFactText, /Total number of repayments 24 monthly repayments/);
    assert.match(keyFactText, /\(A\) Credit provider's fees/);
    assert.match(keyFactText, /\(B\) Third party fees\/charges/);
    assert.ok(keyFactText.includes(`Total (A) ${money(sampleKeyFacts.lenderCharges)}`));
    assert.ok(keyFactText.includes(`Total (B) ${money(sampleKeyFacts.thirdPartyCharges)}`));
    assert.ok(keyFactText.includes(`Total Fees and charges (A+B) ${money(sampleKeyFacts.totalCharges)}`));
    assert.match(keyFactText, /Adhesive Stamp/);
    assert.match(keyFactText, /Stamp Duty/);
    assert.match(keyFactText, /Insurance Fees/);
    assert.match(keyFactText, /Credit Bureau Search/);
    assert.match(keyFactText, /VAT Charge/);
    assert.match(keyFactText, /Penalties and Additional Requirements/);
    assert.match(keyFactText, /•\s+Late Payment:/);
    assert.match(keyFactText, /•\s+Early Liquidation of the Loan:/);
    assert.match(keyFactText, /•\s+Cooling Off Period:/);
    assert.match(keyFactText, /•\s+Variations:/);
    assert.match(keyFactText, /charged 1% flat per month on the overdue amount/);
    assert.match(keyFactText, /You may cancel your loan contract within 3 days after signing/);
    assert.match(keyFactText, /08152776012/);
    assert.match(keyFactText, /Ccare@npfmicrofinancebank\.com/);
    assert.match(keyFactText, /cpd@cbn\.go/);
    assert.ok(keyFactText.indexOf("Specific information about your loan") < keyFactText.indexOf("Fees and charges"));
    assert.ok(keyFactText.indexOf("(B) Third party fees/charges") < keyFactText.indexOf("Penalties and Additional Requirements"));
    const keyFactXml = await readDocumentXml(keyFactBuffer);
    assert.equal((keyFactXml.match(/<w:tbl>/g) || []).length, 5);
    assert.match(keyFactXml, /w:fill="D9EEF2"/);
    assert.match(keyFactXml, /w:fill="F1F1F1"/);
    assert.match(keyFactXml, /w:u w:val="single"/);
    const offerLetterBuffer = await createLoanDocument(samplePayload, ["offer"]).toBuffer();
    assert.ok(offerLetterBuffer.length > 0);
    console.log(`Generated offer letter buffer size: ${offerLetterBuffer.length} bytes`);
    const offerLetterText = await readDocumentText(offerLetterBuffer);
    const offerLetterXml = await readDocumentXml(offerLetterBuffer);
    assert.equal((offerLetterXml.match(/<w:footerReference w:type="default"/g) || []).length, 1);
    assert.match(offerLetterXml, /w:footer="180"/);
    assert.match(offerLetterText, /OFFER LETTER FOR Other Micro Loan/);
    assert.match(offerLetterText, /Dear Sir/);
    assert.match(offerLetterText, /One Million Naira Only/);
    assert.match(offerLetterText, /Effective Date: 24 November 2026/);
    assert.match(offerLetterText, /Expiry Date: 24 November 2028/);
    assert.match(offerLetterText, /VAT 7\.5% of Management Processing fee \(₦750\.00\)/);
    assert.match(offerLetterText, /3% Mandatory Saving Deposit \(₦30,000\.00\)/);
    assert.match(offerLetterText, /LOAN CALCULATION/);
    assert.match(offerLetterText, /Account Number: 00205698645/);
    assert.match(offerLetterText, /Settlement Account: 00205698645/);
    assert.match(offerLetterText, /First Payment Date: 25 November 2026/);
    assert.match(offerLetterText, /Account Title: Ken Obi/);
    assert.match(offerLetterText, /Total Number of Instalments: 24/);
    assert.match(offerLetterText, /Cumulative Principal Repayment/);
    assert.match(offerLetterText, /Cumulative Interest Repayment/);
    assert.doesNotMatch(offerLetterText, /Days in Period/);
    assert.match(offerLetterText, /Interest Status/);
    assert.match(offerLetterText, /Principal Status/);
    assert.match(offerLetterText, /Loan Payment Status/);
    const offerSchedule = calculateLoanSchedule(
      samplePayload.customer.recommendedAmount,
      samplePayload.customer.durationMonths,
      resolveLoanProduct(samplePayload.customer),
      samplePayload.customer.drawdownDate
    );
    assert.ok(offerLetterText.includes(money(offerSchedule.installments[0].total).replace(/^₦/, "")));
    assert.ok(offerLetterText.includes(money(offerSchedule.totalInterest)));
    assert.ok(offerLetterText.includes(money(offerSchedule.totalRepayment)));
    assert.match(offerLetterText, /Loan Payment Status/);
    assert.match(offerLetterText, /26% per annum, calculated daily on the original principal/);
    assert.match(offerLetterText, /25 November 2026/);
    assert.match(offerLetterText, /25-NOV-2026/);
    assert.match(offerLetterText, /22,082\.19/);
    assert.match(offerLetterText, /Interest for each period is calculated on the original principal/);
    assert.doesNotMatch(offerLetterText, /attached repayment schedule/i);
    assert.match(offerLetterXml, /w:orient="landscape"/);
    assert.match(offerLetterXml, /w:w="16838" w:h="11906" w:orient="landscape"/);
    assert.match(offerLetterXml, /w:w="15838"/);
    assert.equal((offerLetterXml.match(/w:orient="landscape"/g) || []).length, 1);
    assert.equal((offerLetterXml.match(/w:orient="portrait"/g) || []).length, 2);
    assert.match(offerLetterXml, /w:bottom[^>]*w:color="000000"/);
    const femalePayload = {
      ...samplePayload,
      customer: { ...samplePayload.customer, gender: "Female" }
    };
    const femaleOfferLetterBuffer = await createLoanDocument(femalePayload, ["offer"]).toBuffer();
    const femaleOfferLetterText = await readDocumentText(femaleOfferLetterBuffer);
    assert.match(femaleOfferLetterText, /Dear Ma/);
    assert.match(femaleOfferLetterText, /To enable her to complete building project/);
    const femaleAppraisalBuffer = await createLoanDocument(femalePayload, ["appraisal"]).toBuffer();
    const femaleAppraisalText = await readDocumentText(femaleAppraisalBuffer);
    assert.match(femaleAppraisalText, /Her BVN is/);
    assert.match(femaleAppraisalText, /She is a serving member/);
    assert.match(femaleAppraisalText, /She has approached the bank/);
    assert.match(femaleAppraisalText, /her monthly salary/);
    const appraisalBuffer = await createLoanDocument(samplePayload, ["appraisal"]).toBuffer();
    const appraisalText = await readDocumentText(appraisalBuffer);
    assert.match(appraisalText, /LOAN APPRAISAL/);
    assert.match(appraisalText, /Proposed terms and conditions/);
    assert.doesNotMatch(appraisalText, /Customer and facility background/);
    const appraisalSchedule = calculateLoanSchedule(
      samplePayload.customer.recommendedAmount,
      samplePayload.customer.durationMonths,
      resolveLoanProduct(samplePayload.customer),
      samplePayload.customer.drawdownDate
    );
    const highestRepayment = Math.max(...appraisalSchedule.installments.map(({ total }) => total));
    assert.ok(appraisalText.includes(`REPAYMENT: Monthly repayment of ${money(highestRepayment)}`));
    assert.match(appraisalText, /account number 00205698645/);
    assert.doesNotMatch(appraisalText, /\[object Object\]/);
    const appraisalXml = await readDocumentXml(appraisalBuffer);
    assert.match(appraisalXml, /w:fill="EAF0F6"/);
    assert.match(appraisalXml, /w:insideH/);
    assert.equal((appraisalXml.match(/w:type="page"/g) || []).length, 1);
    assert.match(appraisalXml, /w:w="3600"/);
    const injectionPayload = {
      ...samplePayload,
      customer: { ...samplePayload.customer, name: "<script>alert(1)</script>" }
    };
    const injectionXml = await readDocumentXml(
      await createLoanDocument(injectionPayload, ["appraisal"]).toBuffer()
    );
    assert.match(injectionXml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(injectionXml, /<script>alert\(1\)<\/script>/);
    const appraisalParagraphs = appraisalXml.split("</w:p>").map((paragraph) => paragraph.replace(/<[^>]+>/g, " "));
    assert.ok(appraisalParagraphs.some((paragraph) => paragraph.includes("(1) Remittance of monthly salary through the bank.")));
    assert.ok(appraisalParagraphs.some((paragraph) => paragraph.includes("(2) Personal Guarantor")));
    const addressAppraisalBuffer = await createLoanDocument({
      ...samplePayload,
      customer: { ...samplePayload.customer, address: "12 Example Street", mss: "NPF Payroll" }
    }, ["appraisal"]).toBuffer();
    const addressAppraisalText = await readDocumentText(addressAppraisalBuffer);
    assert.match(addressAppraisalText, /serving member of 12 Example Street/);
    assert.match(addressAppraisalText, /received directly from NPF Payroll/);
    const allTemplatesBuffer = await createLoanDocument(samplePayload, ["appraisal", "offer", "keyfact"]).toBuffer();
    const allTemplatesXml = await readDocumentXml(allTemplatesBuffer);
    assert.equal((allTemplatesXml.match(/w:type="page"/g) || []).length, 1);
    assert.match(allTemplatesXml, /w:orient="landscape"/);
    assert.match(allTemplatesXml, /w:color w:val="000000"/);
    assert.match(allTemplatesXml, /w:bottom[^>]*w:color="000000"/);
    const circStandaloneBuffer = await createLoanDocument(samplePayload, ["appraisal", "circ", "offer", "keyfact"]).toBuffer();
    const circStandaloneXml = await readDocumentXml(circStandaloneBuffer);
    assert.equal((circStandaloneXml.match(/w:type="page"/g) || []).length, 1);
    assert.match(circStandaloneXml, /w:orient="landscape"/);
    console.log("Sample document generation successful.");
  } catch (error) {
    console.error("Sample document generation failed:", error.message || error);
    process.exitCode = 1;
  }
})();
