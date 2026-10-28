const {
  AlignmentType,
  Document,
  PageBreak,
  Paragraph,
  Packer,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} = require("docx");
const {
  addParagraph,
  displayDate,
  displayDocumentDate,
  labelValue,
  money,
  separatorLine
} = require("./document-utils");
const {
  calculateKeyFacts,
  calculateLoanSchedule,
  calculateMonthlyRepayment
} = require("./loan-calculations");
const { createKeyFacts } = require("./key-fact");
const { createOfferLetter } = require("./offer-letter");

function resolveLoanProduct(customer) {
  if (customer.loanProduct === "Sharp Sharp") return "Sharp Sharp";
  return Number(customer.recommendedAmount) >= 1000000 ? "Term Loan" : "Other Micro Loan";
}

function validateLoanDetails(customer) {
  if (!["Male", "Female"].includes(customer.gender)) {
    return "Select the customer's gender.";
  }
  if (!Number.isFinite(Number(customer.loanAmount)) || Number(customer.loanAmount) <= 0) {
    return "Enter a valid loan amount requested.";
  }
  if (!Number.isFinite(Number(customer.recommendedAmount)) || Number(customer.recommendedAmount) <= 0) {
    return "Enter a valid recommended amount.";
  }
  const drawdownDate = new Date(`${customer.drawdownDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(customer.drawdownDate || "")
      || Number.isNaN(drawdownDate.getTime())
      || drawdownDate.toISOString().slice(0, 10) !== customer.drawdownDate) {
    return "Enter a valid drawdown date.";
  }

  const product = resolveLoanProduct(customer);
  if (product === "Sharp Sharp"
      && (customer.recommendedAmount < 100000 || customer.recommendedAmount > 1000000)) {
    return "Sharp Sharp recommended amounts must be between ₦100,000.00 and ₦1,000,000.00.";
  }
  const maximumMonths = product === "Sharp Sharp" ? 12 : 24;
  if (!Number.isInteger(customer.durationMonths)
      || customer.durationMonths < 1
      || customer.durationMonths > maximumMonths) {
    return `${product} duration must be between 1 and ${maximumMonths} months.`;
  }
  return "";
}

function guarantorTable(guarantors) {
  const headers = ["S/N", "Name", "Account number", "Office address", "BVN", "Phone", "Retirement"];
  const widths = [450, 1500, 1300, 2000, 1200, 1200, 1500];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((text, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 22, color: "000000" })],
          spacing: { before: 80, after: 80 }
        })]
      }))
    }),
    ...guarantors.map((guarantor, index) => new TableRow({
      children: [
        String(index + 1),
        guarantor.name,
        guarantor.account,
        guarantor.address,
        guarantor.bvn,
        guarantor.phone,
        displayDate(guarantor.retirementDate)
      ].map((value, cellIndex) => new TableCell({
        width: { size: widths[cellIndex], type: WidthType.DXA },
        children: [new Paragraph({ text: String(value ?? ""), spacing: { before: 80, after: 80 }, style: "Normal" })]
      }))
    }))
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows
  });
}

function createAppraisal(customer, guarantors, repayment, appraisingOfficer) {
  const keyFacts = calculateKeyFacts(customer);
  const female = customer.gender === "Female";
  const subjectPronoun = female ? "She" : "He";
  const possessivePronoun = female ? "Her" : "His";
  const accountNumber = customer.account || customer.accountNumber || "";
  return [
    labelValue("FROM", "Head of Credit", true),
    labelValue("TO", "Branch Manager", true),
    labelValue("SUBJECT", `Appraisal of ${money(customer.loanAmount)} Loan Facility for ${customer.name}`, true),
    labelValue("DATE", displayDocumentDate(customer.documentDate), true),
    separatorLine(),
    addParagraph(`${customer.name} is a current account holder with the account number ${accountNumber} and Customer ID ${customer.id}. The mandate is complete with relatively satisfactory operations. ${possessivePronoun} BVN is ${customer.bvn}; phone number: ${customer.phone}; NIN: ${customer.nin}; date of birth: ${displayDate(customer.dob)}.`),
    labelValue("CUSTOMER ADDRESS", customer.address),
    addParagraph(`${subjectPronoun} is a serving member of ${customer.mss}, was enlisted on ${displayDate(customer.enlistmentDate)} and is due for retirement on ${displayDate(customer.retirementDate)}.`),
    addParagraph(`${subjectPronoun} has approached the bank for a loan of ${money(customer.loanAmount)} for the purpose of ${customer.purpose}.`),
    addParagraph(Number(customer.loanCycle) > 1
      ? "The customer has taken previous facilities with the bank and paid them off fully without default."
      : "This is the first time the customer is applying for a loan."),
    addParagraph(`The loan if granted will run for ${customer.durationMonths} months and will be repaid through ${possessivePronoun.toLowerCase()} monthly salary of ${money(customer.salary)} which will be received directly from ${customer.mss}.`),
    addParagraph(`As part of security for the loan, ${subjectPronoun.toLowerCase()} has also brought ${guarantors.length} guarantor${guarantors.length > 1 ? "s" : ""} that operate salary current accounts with the bank, details as follows:`),
    guarantorTable(guarantors),
    addParagraph(`The anticipated income from the loan is ${money(keyFacts.interest)} apart from other charges.`),
    addParagraph("In order to boost our loan portfolio and profit, I hereby recommend the following terms and conditions for consideration and approval."),
    labelValue("LENDER", "NPF Microfinance Bank PLC"),
    labelValue("BORROWER", customer.name),
    labelValue("FACILITY", customer.loanProduct),
    labelValue("PURPOSE", customer.purpose),
    labelValue("AMOUNT RECOMMENDED", money(customer.recommendedAmount)),
    labelValue("REPAYMENT", customer.loanProduct === "Sharp Sharp"
      ? `Monthly repayment of ${money(repayment)}`
      : `Fixed monthly principal of ${money(keyFacts.schedule.installments[0].principal)} plus interest at 26% per annum; see repayment schedule`),
    labelValue("TENOR", `${customer.durationMonths} Months`),
    labelValue("EXPIRING DATE", `${customer.durationMonths} Months after drawdown`),
    labelValue("INTEREST RATE", `${customer.loanProduct === "Sharp Sharp" ? "4% flat per month (48% per annum)" : "26% per annum, calculated daily on the original principal"} (subject to review in line with changes in money market rate and bank's policy as may occur from time to time without prior notice)`),
    ...(customer.loanProduct === "Sharp Sharp" ? [] : [
      labelValue("MGT/PROCESSING FEE", `1% of loan amount: ${money(keyFacts.managementFee)}`),
      labelValue("VAT ON MANAGEMENT FEE", `1.7% of management fee: ${money(keyFacts.managementFeeVat)}`)
    ]),
    labelValue("INSURANCE FEE", "1.5% flat upfront"),
    labelValue("CREDIT BUREAU FEE", "₦1000"),
    labelValue("SECURITY", "(1) Remittance of monthly salary through the bank."),
    addParagraph("(2) Personal Guarantor"),
    ...guarantors.map((guarantor, index) => labelValue(
      `${index + 1}`,
      `${guarantor.name} AP/FN/NO: ${guarantor.forceNumber || ""}  SAL. ${money(guarantor.salary)}, Account Number: ${guarantor.account}`
    )),
    new Paragraph({
      children: [
        new TextRun({ text: "CREDIT BUREAU STATUS: ", bold: true, size: 22, color: "000000" }),
        new TextRun({ text: "SATISFACTORY CREDIT BUREAU SHOWS THE CUSTOMER HAS OUTSTANDING BALANCE OF __________________ WITH __________________ PERFORMING LOAN WILL EXPIRE __________________.", size: 22, color: "000000" })
      ],
      spacing: { before: 80, after: 80, line: 240 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "Conditions Precedent to Draw Down:", bold: true, size: 22, color: "000000" })],
      spacing: { before: 120, after: 40, line: 240 }
    }),
    addParagraph("1. Acceptance of offer letter"),
    addParagraph("2. Perfection of security"),
    addParagraph("3. 3% Mandatory savings"),
    new Paragraph({ children: [new TextRun({ text: appraisingOfficer, bold: true, size: 22, color: "000000" })], spacing: { before: 260, after: 15 } }),
    addParagraph("Signed (Appraising officer)")
  ];
}

function createLoanDocument(payload, templates) {
  const customer = { ...payload.customer, loanProduct: resolveLoanProduct(payload.customer) };
  const { guarantors } = payload;
  const validationError = validateLoanDetails(customer);
  if (validationError) throw new Error(validationError);
  const appraisingOfficer = payload.appraisingOfficer || "Adigwe Patrick";
  const repayment = calculateMonthlyRepayment(
    customer.recommendedAmount,
    customer.durationMonths,
    customer.loanProduct,
    customer.drawdownDate
  );
  const schedule = calculateLoanSchedule(
    customer.recommendedAmount,
    customer.durationMonths,
    customer.loanProduct,
    customer.drawdownDate
  );
  const children = [];

  templates.forEach((template, index) => {
    if (template === "appraisal") children.push(...createAppraisal(customer, guarantors, repayment, appraisingOfficer));
    if (template === "circ") {
      children.push(
        new Paragraph({ children: [new TextRun({ text: "C.I.R.C COMMENT SHEET", bold: true, size: 22, color: "000000" })], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 200 } }),
        labelValue("TO", "BRANCH MANAGER, ONITSHA", true),
        labelValue("FROM", "HEAD OF CREDIT, ONITSHA", true),
        labelValue("SUBJECT", `APPRAISAL OF ${money(customer.loanAmount)} LOAN FACILITY FOR ${customer.name}`, true),
        labelValue("AMT.APP:", money(customer.loanAmount), true),
        labelValue("AMT. REC.:", money(customer.recommendedAmount), true),
        labelValue("DATE:", displayDocumentDate(customer.documentDate), true),
        addParagraph("Kindly comments on the loan to enable us advise the customer accordingly.", { spacing: { before: 350, after: 700 } }),
        addParagraph("SIGN: ________________________________________")
      );
    }
    if (template === "offer") children.push(...createOfferLetter(customer, guarantors, repayment, appraisingOfficer, schedule));
    if (template === "keyfact") children.push(...createKeyFacts(customer));
    if (index < templates.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
  });

  return new Document({
    creator: "NPF Microfinance Bank Plc",
    title: `Loan documents - ${customer.name}`,
    description: "Loan appraisal, C.I.R.C. comment sheet, offer letter and Key Facts Statement",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "000000" },
          paragraph: { spacing: { line: 280, after: 140 } }
        },
        headings: {
          title: { run: { font: "Arial", size: 22, bold: true, color: "000000" }, paragraph: { spacing: { before: 160, after: 240 } } },
          heading1: { run: { font: "Arial", size: 22, bold: true, color: "000000" }, paragraph: { spacing: { before: 260, after: 140 } } },
          heading2: { run: { font: "Arial", size: 22, bold: true, color: "000000" }, paragraph: { spacing: { before: 200, after: 120 } } }
        }
      }
    },
    sections: [{ properties: { page: { margin: { top: 1000, right: 900, bottom: 1000, left: 900 } } }, children }]
  });
}

module.exports = {
  resolveLoanProduct,
  validateLoanDetails,
  calculateMonthlyRepayment,
  calculateKeyFacts,
  createLoanDocument: (payload, templates) => ({
    toBuffer: () => Packer.toBuffer(createLoanDocument(payload, templates))
  })
};
