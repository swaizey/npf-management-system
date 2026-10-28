const assert = require("node:assert/strict");
const JSZip = require("jszip");
const {
  calculateMonthlyRepayment,
  createLoanDocument,
  resolveLoanProduct,
  validateLoanDetails
} = require("./src/Appraisal");
const { calculateKeyFacts, calculateLoanSchedule, formatScheduleDate } = require("./src/loan-calculations");
const { samplePayload } = require("./sample-data");
const { amountInWords } = require("./src/document-utils");

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

(async () => {
  try {
    assert.equal(resolveLoanProduct({ recommendedAmount: 999999 }), "Other Micro Loan");
    assert.equal(resolveLoanProduct({ recommendedAmount: 1000000 }), "Term Loan");
    assert.equal(resolveLoanProduct({ recommendedAmount: 1000000, loanProduct: "Sharp Sharp" }), "Sharp Sharp");
    assert.equal(amountInWords(1000000), "One Million Naira Only");
    assert.equal(amountInWords(1000000.5), "One Million Naira and Fifty Kobo Only");

    const sharpSharp = { gender: "Male", loanAmount: 100000, recommendedAmount: 100000, loanProduct: "Sharp Sharp", durationMonths: 12, drawdownDate: "2026-10-25" };
    assert.equal(validateLoanDetails(sharpSharp), "");
    assert.match(validateLoanDetails({ ...sharpSharp, gender: "" }), /gender/);
    assert.match(validateLoanDetails({ ...sharpSharp, drawdownDate: "2026-02-31" }), /drawdown date/);
    assert.match(validateLoanDetails({ ...sharpSharp, recommendedAmount: 99999 }), /between/);
    assert.match(validateLoanDetails({ ...sharpSharp, recommendedAmount: 1000001 }), /between/);
    assert.match(validateLoanDetails({ ...sharpSharp, durationMonths: 13 }), /between 1 and 12/);
    assert.match(validateLoanDetails({ ...sharpSharp, loanProduct: "Term Loan", durationMonths: 25 }), /between 1 and 24/);
    const sharpSchedule = calculateLoanSchedule(100000, 12, "Sharp Sharp", "2026-10-25");
    assert.equal(calculateMonthlyRepayment(100000, 12, "Sharp Sharp", "2026-10-25"), 12333.33);
    assert.equal(sharpSchedule.installments[0].interest, 4000);
    assert.equal(sharpSchedule.installments[11].interest, 4000);
    assert.equal(sharpSchedule.rateDescription, "4% flat per month (48% per annum)");
    assert.equal(calculateMonthlyRepayment(1000000, 24, "Term Loan", "2026-10-25"), 63363.01);
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
    assert.equal(repaymentSchedule.totalInterest, 781068.49);
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
    assert.equal(leapYearSchedule.installments[0].interest, 30986.3);

    const termKeyFacts = calculateKeyFacts({
      recommendedAmount: 1000000,
      durationMonths: 24,
      loanProduct: "Term Loan",
      drawdownDate: "2026-10-25"
    });
    assert.equal(termKeyFacts.interest, 520712.28);
    assert.equal(termKeyFacts.totalRepayment, 1520712.28);
    assert.equal(termKeyFacts.insurance, 15000);
    assert.equal(termKeyFacts.managementFee, 10000);
    assert.equal(termKeyFacts.managementFeeVat, 170);
    assert.equal(termKeyFacts.thirdPartyCharges, 2125);
    assert.equal(termKeyFacts.totalCharges, 27295);
    assert.equal(termKeyFacts.totalCostOfCredit, 548007.28);

    const sharpKeyFacts = calculateKeyFacts({
      recommendedAmount: 100000,
      durationMonths: 12,
      loanProduct: "Sharp Sharp",
      drawdownDate: "2026-10-25"
    });
    assert.equal(sharpKeyFacts.interest, 48000);
    assert.equal(sharpKeyFacts.managementFee, 0);
    assert.equal(sharpKeyFacts.managementFeeVat, 0);
    assert.equal(sharpKeyFacts.totalCharges, 3625);

    const buffer = await createLoanDocument(samplePayload, samplePayload.templates).toBuffer();
    console.log(`Generated document buffer size: ${buffer.length} bytes`);
    const keyFactBuffer = await createLoanDocument(samplePayload, ["keyfact"]).toBuffer();
    assert.ok(keyFactBuffer.length > 0);
    console.log(`Generated Key Facts Statement buffer size: ${keyFactBuffer.length} bytes`);
    const keyFactText = await readDocumentText(keyFactBuffer);
    assert.match(keyFactText, /The loan/);
    assert.match(keyFactText, /Total cost of consumer credit/);
    assert.match(keyFactText, /\(A\) Lender fees/);
    assert.match(keyFactText, /\(B\) Third-party fees and charges/);
    const keyFactXml = await readDocumentXml(keyFactBuffer);
    assert.equal((keyFactXml.match(/<w:tbl>/g) || []).length, 2);
    const offerLetterBuffer = await createLoanDocument(samplePayload, ["offer"]).toBuffer();
    assert.ok(offerLetterBuffer.length > 0);
    console.log(`Generated offer letter buffer size: ${offerLetterBuffer.length} bytes`);
    const offerLetterText = await readDocumentText(offerLetterBuffer);
    assert.match(offerLetterText, /OFFER LETTER FOR Term Loan/);
    assert.match(offerLetterText, /Dear Sir/);
    assert.match(offerLetterText, /One Million Naira Only/);
    assert.match(offerLetterText, /Effective Date: 24 November 2026/);
    assert.match(offerLetterText, /Expiry Date: 24 November 2028/);
    assert.match(offerLetterText, /VAT 7\.5% of Management Processing fee \(₦750\.00\)/);
    assert.match(offerLetterText, /3% Mandatory Saving Deposit \(₦30,000\.00\)/);
    assert.match(offerLetterText, /Repayment Schedule/);
    assert.match(offerLetterText, /26% per annum, calculated daily on the original principal/);
    assert.match(offerLetterText, /25 November 2026/);
    assert.match(offerLetterText, /25-NOV-2026/);
    assert.match(offerLetterText, /₦22,082\.19/);
    assert.match(offerLetterText, /Interest for each period is calculated on the original principal/);
    assert.doesNotMatch(offerLetterText, /attached repayment schedule/i);
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
    assert.match(appraisalText, /account number 00205698645/);
    assert.doesNotMatch(appraisalText, /\[object Object\]/);
    const appraisalXml = await readDocumentXml(appraisalBuffer);
    const appraisalParagraphs = appraisalXml.split("</w:p>").map((paragraph) => paragraph.replace(/<[^>]+>/g, " "));
    assert.ok(appraisalParagraphs.some((paragraph) => paragraph.includes("(1) Remittance of monthly salary through the bank.")));
    assert.ok(appraisalParagraphs.some((paragraph) => paragraph.includes("(2) Personal Guarantor")));
    const addressAppraisalBuffer = await createLoanDocument({
      ...samplePayload,
      customer: { ...samplePayload.customer, address: "12 Example Street", mss: "NPF Payroll" }
    }, ["appraisal"]).toBuffer();
    const addressAppraisalText = await readDocumentText(addressAppraisalBuffer);
    assert.match(addressAppraisalText, /CUSTOMER ADDRESS: 12 Example Street/);
    assert.match(addressAppraisalText, /serving member of NPF Payroll/);
    const allTemplatesBuffer = await createLoanDocument(samplePayload, ["appraisal", "offer", "keyfact"]).toBuffer();
    const allTemplatesXml = await readDocumentXml(allTemplatesBuffer);
    assert.equal((allTemplatesXml.match(/w:type="page"/g) || []).length, 2);
    assert.match(allTemplatesXml, /w:color w:val="000000"/);
    assert.match(allTemplatesXml, /w:bottom[^>]*w:color="000000"/);
    const circStandaloneBuffer = await createLoanDocument(samplePayload, ["appraisal", "circ", "offer", "keyfact"]).toBuffer();
    const circStandaloneXml = await readDocumentXml(circStandaloneBuffer);
    assert.equal((circStandaloneXml.match(/w:type="page"/g) || []).length, 3);
    console.log("Sample document generation successful.");
  } catch (error) {
    console.error("Sample document generation failed:", error.message || error);
    process.exitCode = 1;
  }
})();
