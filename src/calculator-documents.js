const { Document, PageOrientation, Packer } = require("docx");
const { createKeyFacts } = require("./key-fact");
const { createRepaymentSchedule } = require("./offer-letter");
const { calculateLoanSchedule } = require("./loan-calculations");
const { createRepaymentFooter } = require("./document-footer");

const DOCUMENT_STYLES = {
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
};

function createCalculatorDocument(payload) {
  const product = payload.product;
  const durationMonths = Number(payload.durationMonths);
  const amount = Number(payload.amount);
  const customer = {
    name: "Loan Calculator",
    recommendedAmount: amount,
    durationMonths,
    loanProduct: product,
    drawdownDate: payload.drawdownDate,
    documentDate: payload.documentDate
  };
  const schedule = calculateLoanSchedule(amount, durationMonths, product, payload.drawdownDate);
  const isRepayment = payload.documentType === "repayment";
  if (!isRepayment && payload.documentType !== "key-facts") {
    throw new Error("Choose a repayment schedule or Key Facts Statement to save.");
  }

  const orientation = isRepayment ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT;
  const pageSize = { width: 11906, height: 16838, orientation };
  const children = isRepayment
    ? createRepaymentSchedule(customer, schedule)
    : createKeyFacts(customer);
  const document = new Document({
    creator: "NPF Microfinance Bank Plc",
    title: isRepayment ? "Loan Repayment Schedule" : "Key Facts Statement",
    description: "Loan calculator document",
    styles: DOCUMENT_STYLES,
    sections: [{
      ...(isRepayment ? { footers: { default: createRepaymentFooter() } } : {}),
      properties: {
        page: {
          size: pageSize,
          margin: isRepayment
            ? { top: 360, right: 360, bottom: 600, left: 360, footer: 180 }
            : { top: 1000, right: 900, bottom: 1000, left: 900 }
        }
      },
      children
    }]
  });
  return { toBuffer: () => Packer.toBuffer(document) };
}

module.exports = { createCalculatorDocument };
