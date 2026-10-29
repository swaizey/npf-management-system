const { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = require("docx");
const { addParagraph, centeredTitle, displayDate, heading, labelValue, money } = require("./document-utils");
const { calculateKeyFacts } = require("./loan-calculations");

const HEADER_FILL = "D9EEF2";
const ALTERNATE_FILL = "F1F1F1";
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "7F8C8D" };

function paragraph(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, color: "000000" })],
    spacing: { before: 30, after: 30, line: 220 },
    ...options
  });
}

function informationCell(children, width, shading) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 65, bottom: 65, left: 100, right: 100 },
    ...(shading ? { shading: { fill: shading } } : {}),
    children
  });
}

function styledTable(rows, columnWidths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER,
      insideHorizontal: TABLE_BORDER,
      insideVertical: TABLE_BORDER
    },
    rows
  });
}

function summaryItem(label, value, note = "") {
  return [
    paragraph(`${label}: ${value}`),
    ...(note ? [paragraph(note, { indent: { left: 100 } })] : [])
  ];
}

function topSummaryTable(facts) {
  const leftWidth = 5000;
  const rightWidth = 5000;
  const leftDetails = [
    ["Loan amount", money(facts.principal)],
    ["Tenor", `${facts.durationMonths} months`],
    ["Interest rate", `${facts.interestRate * 100}% (variable; may change)`],
    ["Collateral", `3% Mandatory Deposit (${money(facts.mandatorySavings)}), salary account / guarantor`]
  ];
  const rightDetails = [
    ["Total amount you will pay back", money(facts.totalRepayment)],
    ["This means you will pay back", `${money(facts.interest)} in interest for ${money(facts.principal)} borrowed`],
    ["Annual Percentage Rate (APR)", `${facts.interestRate * 100}%`],
    ["Security", `3% Mandatory Deposit, salary account / guarantor (${money(facts.mandatorySavings)})`]
  ];
  return styledTable([
    new TableRow({
      tableHeader: true,
      children: ["THE LOAN", "TOTAL COST TO CONSUMER"].map((title, index) =>
        informationCell([
          paragraph(title, {
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: title, bold: true, size: 18, color: "000000" })]
          })
        ], index === 0 ? leftWidth : rightWidth, HEADER_FILL)
      )
    }),
    ...leftDetails.map(([leftLabel, leftValue], index) => {
      const [rightLabel, rightValue] = rightDetails[index];
      const rightNote = index === 2
        ? "This reflects the total cost of credit on a yearly basis using the information at the disclosure date. It is a useful tool for comparison with similar loans."
        : "";
      return new TableRow({
        cantSplit: true,
        children: [
          informationCell(summaryItem(leftLabel, leftValue), leftWidth),
          informationCell(index === 1
            ? [paragraph(`${rightLabel} ${rightValue}.`), paragraph(rightNote, { indent: { left: 100 } })]
            : summaryItem(rightLabel, rightValue, rightNote), rightWidth)
        ]
      });
    })
  ], [leftWidth, rightWidth]);
}

function sectionHeader(text, value = "") {
  const children = value
    ? [
      informationCell([
        paragraph(text, {
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, size: 18, color: "000000" })]
        })
      ], 7200, HEADER_FILL),
      informationCell([
        paragraph(value, {
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: value, bold: true, size: 18, color: "000000" })]
        })
      ], 2800, HEADER_FILL)
    ]
    : [
      new TableCell({
        columnSpan: 2,
        width: { size: 10000, type: WidthType.DXA },
        shading: { fill: HEADER_FILL },
        margins: { top: 65, bottom: 65, left: 100, right: 100 },
        children: [paragraph(text, {
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, size: 18, color: "000000" })]
        })]
      })
    ];
  return styledTable([new TableRow({ tableHeader: true, children })], value ? [7200, 2800] : [10000]);
}

function detailRows(rows, columnWidths = [7200, 2800]) {
  return styledTable(rows.map(([label, value, note], index) => new TableRow({
    cantSplit: true,
    children: [
      informationCell([
        paragraph(label, {
          children: [new TextRun({ text: label, bold: true, size: 18, color: "000000" })]
        }),
        ...(note ? [paragraph(note, {
          children: [new TextRun({ text: note, bold: true, italics: true, size: 16, color: "000000" })]
        })] : [])
      ], columnWidths[0], index % 2 === 0 ? ALTERNATE_FILL : undefined),
      informationCell([
        paragraph(value, { alignment: AlignmentType.RIGHT })
      ], columnWidths[1], index % 2 === 0 ? ALTERNATE_FILL : undefined)
    ]
  })), columnWidths);
}

function feeCell(title, subtitle, entries, totalLabel, totalAmount, width) {
  const children = [
    paragraph(title, {
      children: [new TextRun({ text: title, bold: true, size: 18, color: "000000" })]
    }),
    paragraph(subtitle, {
      children: [new TextRun({ text: subtitle, italics: true, size: 16, color: "000000" })]
    }),
    ...entries.map(([label, amount], index) => paragraph(
      `(${index + 1}) ${label}  ${money(amount)}`
    )),
    paragraph(`${totalLabel}  ${money(totalAmount)}`, {
      spacing: { before: 180, after: 30, line: 220 },
      children: [new TextRun({ text: `${totalLabel}  ${money(totalAmount)}`, bold: true, size: 18, color: "000000" })]
    })
  ];
  return informationCell(children, width);
}

function feesAndChargesTable(facts) {
  const leftWidth = 5000;
  const rightWidth = 5000;
  const totalCell = new TableCell({
    columnSpan: 2,
    width: { size: 10000, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [paragraph(`Total Fees and charges (A+B)  ${money(facts.totalCharges)}`, {
      children: [new TextRun({ text: `Total Fees and charges (A+B)  ${money(facts.totalCharges)}`, bold: true, size: 18, color: "000000" })]
    })]
  });
  return styledTable([
    new TableRow({
      cantSplit: true,
      children: [
        feeCell("(A) Credit provider's fees", "(List all applicable lending fees)", [
          ["Management Fee", facts.managementFee]
        ], "Total (A)", facts.lenderCharges, leftWidth),
        feeCell("(B) Third party fees/charges", "(List all applicable third party fees)", [
          ["Adhesive Stamp", facts.adhesiveStamp],
          ["Stamp Duty", facts.stampDuty],
          ["Insurance Fees", facts.insurance],
          ["Credit Bureau Search", facts.creditBureau],
          ["VAT Charge", facts.managementFeeVat]
        ], "Total (B)", facts.thirdPartyCharges, rightWidth)
      ]
    }),
    new TableRow({ cantSplit: true, children: [totalCell] })
  ], [leftWidth, rightWidth]);
}

function penaltyItem(label, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "•  ", size: 18, color: "000000" }),
      new TextRun({ text: `${label}: `, bold: true, size: 18, color: "000000" }),
      new TextRun({ text, size: 18, color: "000000" })
    ],
    indent: { left: 260, hanging: 180 },
    spacing: { before: 40, after: 60, line: 240 }
  });
}

function createKeyFacts(customer) {
  const facts = calculateKeyFacts(customer);
  const disclosureDate = displayDate(customer.documentDate);

  return [
    centeredTitle("KEY FACTS STATEMENT"),
    centeredTitle("(THIS IS NOT AN OFFER OF CREDIT OR CONTRACT)"),
    addParagraph("This Key Facts Statement (KFS) summarizes key information about the loan you are interested in and can be used to compare different credit providers."),
    labelValue("DISCLOSURE DATE", disclosureDate),
    addParagraph("This is the date at which the information is correct. The final loan features may differ because of your personal financial position or a change in the information provided, including interest rates, fees and charges."),
    topSummaryTable(facts),
    addParagraph("Specific information about your loan"),
    detailRows([
      ["Loan received", money(facts.principal)],
      ["Interest rate", `${facts.interestRate * 100}%`, "(Variable interest rates may change.)"],
      ["Total interest charges (total interest you will pay)", money(facts.interest), "(Total interest may increase for variable interest rates.)"],
      ["Total fees and charges*", money(facts.totalCharges), "(Total other charges you will pay throughout the duration of the loan.)"],
      ["Total cost of credit", money(facts.totalCostOfCredit), "(This is made up of total interest and all other charges for the tenor of the loan.)"]
    ]),
    sectionHeader("Repayments", money(facts.repaymentAmount)),
    detailRows([
      ["Repayment amount (see repayment schedule)", money(facts.repaymentAmount), "Amount you will need to repay on each due date."],
      ["Date of first repayment", displayDate(facts.schedule.firstPaymentDate)],
      ["Other repayment dates", "Monthly on the corresponding day after the first repayment period; if that day does not occur in a month, payment is due on that month's last day."],
      ["Total number of repayments", `${facts.durationMonths} monthly repayments`]
    ]),
    addParagraph("*The amount required to be paid for each repayment and in total does not include fees which are dependent on events that may not occur (for example, late payment fees)."),
    addParagraph("Fees and charges comprise of:"),
    feesAndChargesTable(facts),
    new Paragraph({
      children: [new TextRun({ text: "Penalties and Additional Requirements", bold: true, underline: {}, size: 20, color: "000000" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 100 },
      keepNext: true
    }),
    penaltyItem("Late Payment", "If a payment is more than 7 days late from the due date, you will be charged 1% flat per month on the overdue amount."),
    penaltyItem("Early Liquidation of the Loan", "You may be charged a fee if you pay off your loan before maturity; the amount will depend on the terms of your contract."),
    penaltyItem("Cooling Off Period", "You may cancel your loan contract within 3 days after signing."),
    penaltyItem("Variations", "The interest rate, fees and charges disclosed here may change, including during your contract. You should receive notice of any change after your contract is entered into."),
    heading("Have a complaint or a query?"),
    addParagraph("Do not hesitate to reach out to your lender through the following contact details:"),
    labelValue("Telephone", "08152776012"),
    labelValue("Address", "NPF MFB ONITSHA BRANCH"),
    labelValue("Email", "Ccare@npfmicrofinancebank.com"),
    addParagraph("If dissatisfied with the resolution of your complaint, you can escalate it to the Consumer Protection Department of the Central Bank of Nigeria by writing to the Director, Consumer Protection Department, CBN, Abuja, or by email at cpd@cbn.go.")
  ];
}

module.exports = { calculateKeyFacts, createKeyFacts };
