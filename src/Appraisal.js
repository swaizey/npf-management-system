const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  PageBreak,
  PageOrientation,
  Paragraph,
  Packer,
  SectionType,
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
  heading,
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
const { createRepaymentFooter } = require("./document-footer");
const { isValidISODate } = require("./date-utils");

function resolveLoanProduct(customer) {
  if (customer.loanProduct === "Sharp Sharp") return "Sharp Sharp";
  return Number(customer.recommendedAmount) >= 1000001 ? "Term Loan" : "Other Micro Loan";
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
  if (!isValidISODate(customer.drawdownDate)) {
    return "Enter a valid drawdown date.";
  }
  const otherDates = [
    ["date of birth", customer.dob],
    ["enlistment date", customer.enlistmentDate],
    ["retirement date", customer.retirementDate],
    ["date applied", customer.dateApplied],
    ["appraisal / offer date", customer.documentDate]
  ];
  for (const [label, date] of otherDates) {
    if (!isValidISODate(date)) return `Enter a valid ${label}.`;
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

function validateGuarantorDates(guarantors) {
  const invalidDateIndex = guarantors.findIndex(
    (guarantor) => !isValidISODate(guarantor.retirementDate)
  );
  return invalidDateIndex < 0
    ? ""
    : `Enter a valid retirement date for guarantor ${invalidDateIndex + 1}.`;
}

function guarantorTable(guarantors) {
  const headers = ["S/N", "Name", "Account number", "Office address", "BVN", "Phone", "Retirement"];
  const widths = [500, 1450, 1400, 2150, 1150, 1250, 2206];
  const border = { color: "A6B4C0", size: 4, style: BorderStyle.SINGLE };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border
  };
  const rows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((text, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        shading: { fill: "EAF0F6" },
        margins: { top: 80, bottom: 80, left: 70, right: 70 },
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 18, color: "153B36" })],
          spacing: { before: 0, after: 0 }
        })]
      }))
    }),
    ...guarantors.map((guarantor, index) => new TableRow({
      cantSplit: true,
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
        margins: { top: 70, bottom: 70, left: 70, right: 70 },
        children: [new Paragraph({
          children: [new TextRun({ text: String(value ?? ""), size: 18, color: "000000" })],
          spacing: { before: 0, after: 0 },
          style: "Normal"
        })]
      }))
    }))
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders,
    rows
  });
}

function recommendationTable(entries) {
  const noBorders = {
    top: { color: "FFFFFF", size: 0, style: BorderStyle.NIL },
    bottom: { color: "FFFFFF", size: 0, style: BorderStyle.NIL },
    left: { color: "FFFFFF", size: 0, style: BorderStyle.NIL },
    right: { color: "FFFFFF", size: 0, style: BorderStyle.NIL },
    insideHorizontal: { color: "FFFFFF", size: 0, style: BorderStyle.NIL },
    insideVertical: { color: "FFFFFF", size: 0, style: BorderStyle.NIL }
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3600, 6400],
    borders: noBorders,
    rows: entries.map(([label, value]) => new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 3600, type: WidthType.DXA },
          margins: { top: 65, bottom: 65, left: 80, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: `${label}:`, bold: true, size: 22, color: "000000" })],
            spacing: { before: 0, after: 0, line: 260 }
          })]
        }),
        new TableCell({
          width: { size: 6400, type: WidthType.DXA },
          margins: { top: 65, bottom: 65, left: 80, right: 80 },
          children: [new Paragraph({
            children: [new TextRun({ text: String(value ?? ""), size: 22, color: "000000" })],
            spacing: { before: 0, after: 0, line: 260 }
          })]
        })
      ]
    }))
  });
}

function createAppraisal(customer, guarantors, appraisingOfficer) {
  const keyFacts = calculateKeyFacts(customer);
  const highestRepayment = Math.max(...keyFacts.schedule.installments.map(({ total }) => total));
  const female = customer.gender === "Female";
  const subjectPronoun = female ? "She" : "He";
  const possessivePronoun = female ? "Her" : "His";
  const accountNumber = customer.account || customer.accountNumber || "";
  return [
    new Paragraph({
      children: [new TextRun({ text: "LOAN APPRAISAL", bold: true, size: 28, color: "153B36" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 220 },
      keepNext: true
    }),
    labelValue("FROM", "Head of Credit (Onitsha)" , true),
    labelValue("TO", "Branch Manager (Onitsha)", true),
    labelValue("SUBJECT", `Appraisal of ${money(customer.loanAmount)} Loan Facility for ${customer.name}`, true),
    labelValue("DATE", displayDocumentDate(customer.documentDate), true),
    separatorLine(),
    addParagraph(`${customer.name} is a current account holder with the account number ${accountNumber} and Customer ID ${customer.id}. The mandate is complete with relatively satisfactory operations. ${possessivePronoun} BVN is ${customer.bvn}; IPPIS: ${customer.ippis}; phone number: ${customer.phone}; NIN: ${customer.nin}; date of birth: ${displayDate(customer.dob)}.`),

    addParagraph(`${subjectPronoun} is a serving member of ${customer.address}, was enlisted on ${displayDate(customer.enlistmentDate)} and is due for retirement on ${displayDate(customer.retirementDate)}.`),
    addParagraph(`${subjectPronoun} has approached the bank for a loan of ${money(customer.loanAmount)} for the purpose of ${customer.purpose}.`),
    addParagraph(Number(customer.loanCycle) > 1
      ? "The customer has taken previous facilities with the bank and paid them off fully without default."
      : "This is the first time the customer is applying for a loan."),
    addParagraph(`The loan if granted will run for ${customer.durationMonths} months and will be repaid through ${possessivePronoun.toLowerCase()} monthly salary of ${money(customer.salary)} which will be received directly from ${customer.mss}.`),
    heading("Security and guarantors", HeadingLevel.HEADING_2),
    addParagraph(`As part of security for the loan, ${subjectPronoun.toLowerCase()} has also brought ${guarantors.length} guarantor${guarantors.length > 1 ? "s" : ""} that operate salary current accounts with the bank, details as follows:`),
    guarantorTable(guarantors),
    addParagraph(`The anticipated income from the loan is ${money(keyFacts.interest)} apart from other charges.`),
    addParagraph("In order to boost our loan portfolio and profit, I hereby recommend the following terms and conditions for consideration and approval."),
    new Paragraph({ children: [new PageBreak()] }),
    heading("Proposed terms and conditions", HeadingLevel.HEADING_2),
    recommendationTable([
      ["LENDER", "NPF Microfinance Bank PLC"],
      ["BORROWER", customer.name],
      ["FACILITY", customer.loanProduct],
      ["PURPOSE", `To enable ${female ? "her" : "him"} to ${String(customer.purpose || "").replace(/^to\s+/i, "")}`],
      ["AMOUNT RECOMMENDED", money(customer.recommendedAmount)],
      ["REPAYMENT", `Monthly repayment of ${money(highestRepayment)}`],
      ["TENOR", `${customer.durationMonths} Months`],
      ["EXPIRING DATE", `${customer.durationMonths} Months after drawdown`],
      ["INTEREST RATE", `${customer.loanProduct === "Sharp Sharp" ? "48% per annum (4% monthly equivalent), calculated daily on the original principal using actual days in each period" : "26% P.A Flat (subject to review in line with changes in money market rate and bank's policy as may occur from time to time without prior notice) "} `],
      ...(customer.loanProduct === "Sharp Sharp" ? [] : [
        ["MGT/PROCESSING FEE", `1% of loan amount: ${money(keyFacts.managementFee)}`],
        ["VAT ON MANAGEMENT FEE", `1.7% of management fee: ${money(keyFacts.managementFeeVat)}`]
      ]),
      ["INSURANCE FEE", "1.5% flat upfront"],
      ["CREDIT BUREAU FEE", "₦1000"],
      ["SECURITY", "(1) Remittance of monthly salary through the bank. (2) Personal Guarantor"],
      ...guarantors.map((guarantor, index) => [
        `GUARANTOR ${index + 1}`,
        `${guarantor.name} AP/FN/NO: ${guarantor.forceNumber || ""}  SAL. ${money(guarantor.salary)}, A/C: ${guarantor.account}`
      ])
    ]),
    heading("Credit bureau status", HeadingLevel.HEADING_2),
    new Paragraph({
      children: [
        new TextRun({ text: "SATISFACTORY CREDIT BUREAU SHOWS THE CUSTOMER HAS OUTSTANDING BALANCE OF __________________ WITH __________________ PERFORMING LOAN WILL EXPIRE ______________________________________________________________________________________________________________________________________________________________________________________________________.", size: 22, color: "000000" })
      ],
      spacing: { before: 80, after: 80, line: 240 }
    }),
    heading("Conditions precedent to draw down", HeadingLevel.HEADING_2),
    addParagraph("1. Acceptance of offer letter"),
    addParagraph("2. Perfection of security"),
    addParagraph("3. 3% Mandatory savings"),
    addParagraph("____________________"),
    new Paragraph({ children: [new TextRun({ text: appraisingOfficer, bold: true, size: 22, color: "000000" })], spacing: { before: 260, after: 15 } }),
    addParagraph("Signed (Appraising officer)")
  ];
}

function createLoanDocument(payload, templates) {
  const customer = { ...payload.customer, loanProduct: resolveLoanProduct(payload.customer) };
  const { guarantors } = payload;
  const validationError = validateLoanDetails(customer);
  if (validationError) throw new Error(validationError);
  const guarantorDateError = validateGuarantorDates(guarantors);
  if (guarantorDateError) throw new Error(guarantorDateError);
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
  const sections = [];

  templates.forEach((template) => {
    if (template === "appraisal") {
      sections.push({ orientation: PageOrientation.PORTRAIT, children: createAppraisal(customer, guarantors, appraisingOfficer) });
    }
    if (template === "circ") {
      sections.push({ orientation: PageOrientation.PORTRAIT, children: [
        new Paragraph({ children: [new TextRun({ text: "C.I.R.C COMMENT SHEET", bold: true, size: 22, color: "000000" })], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 200 } }),
        labelValue("TO", "BRANCH MANAGER, ONITSHA", true),
        labelValue("FROM", "HEAD OF CREDIT, ONITSHA", true),
        labelValue("SUBJECT", `APPRAISAL OF ${money(customer.loanAmount)} LOAN FACILITY FOR ${customer.name}`, true),
        labelValue("AMT.APP", money(customer.loanAmount), true),
        labelValue("AMT. REC.", money(customer.recommendedAmount), true),
        labelValue("DATE:", displayDocumentDate(customer.documentDate), true),
        addParagraph("Kindly comments on the loan to enable us advise the customer accordingly.", { spacing: { before: 350, after: 700 } }),
        addParagraph("SIGN: ________________________________________")
      ] });
    }
    if (template === "offer") {
      sections.push(...createOfferLetter(customer, guarantors, repayment, schedule));
    }
    if (template === "keyfact") {
      sections.push({ orientation: PageOrientation.PORTRAIT, children: createKeyFacts(customer) });
    }
  });

  return new Document({
    creator: "NPF Microfinance Bank Plc",
    title: `Loan documents - ${customer.name}`,
    description: "Loan appraisal, C.I.R.C. comment sheet, offer letter and Key Facts Statement",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "000000" },
          paragraph: { spacing: { line: 280, after: 140 }, widowControl: true }
        },
        headings: {
          title: { run: { font: "Arial", size: 28, bold: true, color: "153B36" }, paragraph: { spacing: { before: 160, after: 240 } } },
          heading1: { run: { font: "Arial", size: 24, bold: true, color: "153B36" }, paragraph: { spacing: { before: 260, after: 140 } } },
          heading2: { run: { font: "Arial", size: 22, bold: true, color: "153B36" }, paragraph: { spacing: { before: 200, after: 120 } } }
        }
      }
    },
    sections: sections.map(({ orientation, children }, index) => {
      const landscape = orientation === PageOrientation.LANDSCAPE;
      return {
        properties: {
          ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation
            },
            margin: landscape
              ? { top: 360, right: 360, bottom: 600, left: 360, footer: 180 }
              : { top: 1000, right: 900, bottom: 1000, left: 900 }
          }
        },
        ...(landscape ? { footers: { default: createRepaymentFooter() } } : {}),
        children
      };
    })
  });
}

module.exports = {
  resolveLoanProduct,
  validateLoanDetails,
  validateGuarantorDates,
  calculateMonthlyRepayment,
  calculateKeyFacts,
  createLoanDocument: (payload, templates) => ({
    toBuffer: () => Packer.toBuffer(createLoanDocument(payload, templates))
  })
};
