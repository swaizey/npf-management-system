const assert = require("node:assert/strict");
const JSZip = require("jszip");
const {
  calculateMonthlyRepayment,
  calculateKeyFacts,
  createLoanDocument,
  resolveLoanProduct,
  validateLoanDetails
} = require("./src/Appraisal");
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

    const sharpSharp = { gender: "Male", loanAmount: 100000, recommendedAmount: 100000, loanProduct: "Sharp Sharp", durationMonths: 12 };
    assert.equal(validateLoanDetails(sharpSharp), "");
    assert.match(validateLoanDetails({ ...sharpSharp, gender: "" }), /gender/);
    assert.match(validateLoanDetails({ ...sharpSharp, recommendedAmount: 99999 }), /between/);
    assert.match(validateLoanDetails({ ...sharpSharp, recommendedAmount: 1000001 }), /between/);
    assert.match(validateLoanDetails({ ...sharpSharp, durationMonths: 13 }), /between 1 and 12/);
    assert.match(validateLoanDetails({ ...sharpSharp, loanProduct: "Term Loan", durationMonths: 25 }), /between 1 and 24/);
    assert.equal(calculateMonthlyRepayment(100000, 12, "Sharp Sharp"), 12333.333333333334);
    assert.equal(calculateMonthlyRepayment(1000000, 24, "Term Loan"), 63333.333333333336);

    const termKeyFacts = calculateKeyFacts({
      recommendedAmount: 1000000,
      durationMonths: 24,
      loanProduct: "Term Loan"
    });
    assert.equal(termKeyFacts.interest, 520000);
    assert.equal(termKeyFacts.totalRepayment, 1520000);
    assert.equal(termKeyFacts.insurance, 15000);
    assert.equal(termKeyFacts.managementFee, 10000);
    assert.equal(termKeyFacts.managementFeeVat, 170);
    assert.equal(termKeyFacts.thirdPartyCharges, 2125);
    assert.equal(termKeyFacts.totalCharges, 27295);
    assert.equal(termKeyFacts.totalCostOfCredit, 547295);

    const sharpKeyFacts = calculateKeyFacts({
      recommendedAmount: 100000,
      durationMonths: 12,
      loanProduct: "Sharp Sharp"
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
    assert.doesNotMatch(offerLetterText, /Repayment Schedule/);
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
