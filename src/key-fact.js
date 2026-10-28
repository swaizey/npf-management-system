const { BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = require("docx");
const { addParagraph, centeredTitle, displayDate, heading, labelValue, money } = require("./document-utils");
const { calculateKeyFacts } = require("./loan-calculations");

function informationBox(title, entries) {
  const border = { style: BorderStyle.SINGLE, size: 8, color: "9BA9A4" };
  return new TableCell({
    width: { size: 5000, type: WidthType.DXA },
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border
    },
    margins: { top: 140, bottom: 140, left: 180, right: 180 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 24, color: "153B36" })],
        spacing: { before: 0, after: 140 },
        keepNext: true
      }),
      ...entries
    ]
  });
}

function sideBySideBoxes(leftBox, rightBox) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5000, 5000],
    rows: [new TableRow({ children: [leftBox, rightBox] })]
  });
}

function createKeyFacts(customer) {
  const facts = calculateKeyFacts(customer);
  const disclosureDate = displayDate(customer.documentDate);

  return [
    centeredTitle("KEY FACTS STATEMENT"),
    addParagraph("This statement summarizes the key information and costs of the loan for comparison purposes."),
    labelValue("DISCLOSURE DATE", disclosureDate),
    sideBySideBoxes(
      informationBox("The loan", [
        labelValue("Loan amount", money(facts.principal)),
        labelValue("Tenor", `${facts.durationMonths} months`),
        labelValue("Interest rate", facts.rateDescription)
      ]),
      informationBox("Total cost of consumer credit", [
        labelValue("Total interest charges", money(facts.interest)),
        labelValue("Total amount to be repaid (principal + interest)", money(facts.totalRepayment)),
        labelValue("Average repayment amount", `${money(facts.repaymentAmount)} over ${facts.durationMonths} monthly instalments`),
        labelValue("Total fees and charges (A + B)", money(facts.totalCharges)),
        labelValue("Total cost of credit (interest + all charges)", money(facts.totalCostOfCredit))
      ])
    ),
    heading("Fees and charges"),
    sideBySideBoxes(
      informationBox("(A) Lender fees", [
        labelValue("Insurance (1.5% of loan amount)", money(facts.insurance)),
        ...(customer.loanProduct === "Sharp Sharp" ? [] : [
          labelValue("Management fee (1% of loan amount)", money(facts.managementFee)),
          labelValue("VAT on management fee (1.7% of management fee)", money(facts.managementFeeVat))
        ]),
        labelValue("Total lender fees (A)", money(facts.lenderCharges))
      ]),
      informationBox("(B) Third-party fees and charges", [
        labelValue("Credit Bureau", money(facts.creditBureau)),
        labelValue("Stamp duty", money(facts.stampDuty)),
        labelValue("Seal", money(facts.seal)),
        labelValue("VAT on CRC", money(facts.vatOnCrc)),
        labelValue("Total third-party fees (B)", money(facts.thirdPartyCharges)),
        labelValue("Total fees and charges (A + B)", money(facts.totalCharges))
      ])
    ),
    addParagraph("Fees and charges are shown separately from the total repayment of principal and interest.")
  ];
}

module.exports = { calculateKeyFacts, createKeyFacts };
