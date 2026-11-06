const { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = require("docx");
const {
  amountInWords,
  centeredTitle,
  displayDate,
  money
} = require("./document-utils");
const {
  addMonths,
  calculateLoanSchedule,
  formatScheduleDate,
  roundCurrency
} = require("./loan-calculations");

function displayOfferDate(date, utc = false) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const day = utc ? date.getUTCDate() : date.getDate();
  const remainder = day % 10;
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : remainder === 1 ? "st" : remainder === 2 ? "nd" : remainder === 3 ? "rd" : "th";
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    ...(utc ? { timeZone: "UTC" } : {})
  }).format(date);
  return `${day}${suffix} ${month}, ${utc ? date.getUTCFullYear() : date.getFullYear()}`;
}

function offerTemplateParagraph(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      font: "Times New Roman",
      size: 22,
      bold: true,
      underline: options.underline ? { type: "single" } : undefined,
      color: "000000"
    })],
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { before: options.before || 0, after: options.after ?? 100, line: 250 }
  });
}

function offerTemplateTable(rows) {
  const widths = [3000, 7100];
  const noBorder = { color: "FFFFFF", size: 0, style: BorderStyle.NIL };
  const borders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideHorizontal: noBorder,
    insideVertical: noBorder
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders,
    rows: rows.map(([label, values]) => {
      const paragraphs = (Array.isArray(values) ? values : [values])
        .map((value) => offerTemplateParagraph(value, { after: 100 }));
      return new TableRow({
        children: [
          new TableCell({
            width: { size: widths[0], type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 100 },
            borders,
            children: [offerTemplateParagraph(label, { underline: true })]
          }),
          new TableCell({
            width: { size: widths[1], type: WidthType.DXA },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            borders,
            children: paragraphs
          })
        ]
      });
    })
  });
}

function createStandaloneOfferLetter(customer, guarantors) {
  const amount = Number(customer.approvedAmount);
  const product = customer.loanProduct === "Sharp Sharp"
    ? "Sharp Sharp"
    : amount >= 1000001 ? "Term Loan" : "Other Micro Loan";
  const purpose = String(customer.purpose || "").replace(/^to\s+/i, "");
  const guarantorDetails = guarantors.map((guarantor) => `${guarantor.name}  ${guarantor.account}`);
  const termLoan = product !== "Sharp Sharp";
  const managementFee = termLoan ? roundCurrency(amount * 0.01) : 0;
  const mandatorySavings = roundCurrency(amount * 0.03);
  const managementFeeVat = roundCurrency(managementFee * 0.075);
  const insurance = roundCurrency(amount * 0.015);
  const rate = product === "Sharp Sharp" ? "4%" : "26%";
  const effectiveDate = addMonths(new Date(`${customer.drawdownDate}T00:00:00Z`), 1);
  const expiryDate = addMonths(effectiveDate, customer.durationMonths);
  const schedule = calculateLoanSchedule(amount, customer.durationMonths, product, customer.drawdownDate);
  const highestRepayment = Math.max(...schedule.installments.map((installment) => installment.total));
  const variableRateText = "Changes in the prevailing market rates and conditions during the tenor of this agreement may alter the rates agreed upon by the parties. Any such changes will be effected 10 days after the Borrower has been duly notified of these changes. Note that the Bank is not obliged to disclose the basis on which the assessment was made.";
  const terms = offerTemplateTable([
    ["Early Liquidation terms:-", [
      "All outstanding sums of the Facility (whether principal, interest or any other monies owing to the Bank) shall be repayable at any time forthwith on demand.",
      "The Bank is at liberty to recall the facility if the project fails to comply with the Environmental and Social policy of the Bank.",
      "The Borrower may choose to liquidate the Loan either partly or fully during the continuity of the loan facility. All such payments shall be made and accepted in line with the statutory guidelines and rules, including early liquidation charges applicable from time to time unless specifically mentioned in the schedule."
    ]],
    ["Late repayment:-", [
      "Non-payment of any instalment violates the entire facility agreement on the basis of which the facility can be called in and the Bank will be at liberty to take necessary steps to recover the outstanding loan with accruing interest.",
      "By signing this offer letter/loan agreement and by drawing on the loan, I covenant to repay the loan as and when due. In the event that I fail to repay the loan as agreed, and the loan becomes delinquent, the Bank shall have the right to report the delinquent loan to the CBN through the Credit Risk Management System (CRMS) or by any other means and request the CBN to exercise its regulatory power to direct all banks and other financial institutions under its regulatory purview to set off my indebtedness from any money standing to my credit in any bank account and from any other financial assets they may be holding for my benefit.",
      "In the event of any default of monthly repayment or instalment, the Bank will charge the Borrower a penalty rate in addition to the agreed interest rate.",
      "All expenses (administrative or monitoring) relating to the documentation of this facility and recovery of same, if there be any, will be borne by the Borrower.",
      "I covenant and warrant that the Bank shall have power to set off my indebtedness under this loan agreement from all such monies and funds standing to my credit/benefit in any and all such accounts or from any other financial assets belonging to me and in the custody of any such bank.",
      "I hereby waive any right of confidentiality whether arising under law or statute or in any other manner whatsoever and irrevocably agree that I shall not argue to the contrary before any court of law, administrative authority or any other body acting in any judicial or quasi-judicial capacity."
    ]],
    ["Grace Period:-", [
      "a. The Borrower shall have seven (7) days grace period to pay any amount due under this Agreement within which there will be no penal charge on the late repayment. However, upon the expiration of the grace period, a default interest rate of twelve percent (12%) per annum shall apply from the due date thereof until the same is paid (\"Default Interest\").",
      "b. The Borrower shall have seven (7) days grace period from the date of execution to rescind the loan agreement."
    ]],
    ["Insurance requirements (where applicable):-", [
      "i. The insurance cover required for each loan is dependent on the peculiarity of a facility or security.",
      "ii. The Borrower shall maintain a credit life insurance policy which shall pay the outstanding loan in the event of death, critical illness or in the case of loss of job (the insurance cover will be valid for 6 months' instalment repayments) where applicable.",
      "iii. In the case of a property used as security, the Borrower shall maintain insurance against all risks of loss to the property. The insurance shall cover building collapse, fire, flood, natural disasters and vandalism where applicable."
    ]]
  ]);
  const details = offerTemplateTable([
    ["Lender:-", "NPF Microfinance Bank Plc."],
    ["Borrower:-", customer.name],
    ["Contact details of the Borrower:-", customer.address],
    ["Credit/Facility type:-", product],
    ["Purpose:-", purpose],
    ["Amount approved:-", `${money(amount)} (${amountInWords(amount)})`],
    ["Collateral/Security:-", ["Salary/Guarantor:", ...guarantorDetails]],
    ["Tenor:-", `${customer.durationMonths} Months`],
    ["Interest rate:-", `${rate} Flat per Annum (subject to review in line with the changes in the money market rate and bank policy as may occur from time to time).`],
    ["Effective Date:-", displayOfferDate(effectiveDate, true)],
    ["Expiry Date:-", displayOfferDate(expiryDate, true)],
    ["Variable rate Information:-", variableRateText],
    ...(termLoan ? [
      ["Fees and Commissions:-", `i. Management fee 1% (${money(managementFee)})`],
      ["", `ii. 3% Mandatory Saving Deposit (${money(mandatorySavings)})`],
      ["", `iii. Credit Bureau Report fee ${money(1000)}`],
      ["", `iv. VAT 7.5% of Mgt. Processing fee (${money(managementFeeVat)})`]
    ] : [["Fees and Commissions:-", `Credit Bureau Report fee ${money(1000)}`]]),
    ["Credit life Insurance Premium:-", `1.5% (${money(insurance)}) of Amount approved`],
    ["Repayment:-", `Monthly Principal and interest ${money(highestRepayment)}`]
  ]);
  const drawdownDate = new Date(`${customer.drawdownDate}T00:00:00Z`);
  const introduction = [
    offerTemplateParagraph(`OFFER LETTER FOR ${product.toUpperCase()}`, { underline: true, after: 220 }),
    offerTemplateParagraph("OFFER LETTER", { underline: true, after: 220 }),
    offerTemplateParagraph(`Date: - ${displayOfferDate(drawdownDate, true)}`),
    offerTemplateParagraph(`Customer's Name: - ${customer.name}`),
    offerTemplateParagraph(`Customer's Address: - ${customer.address}`, { after: 220 }),
    offerTemplateParagraph(`Dear ${customer.gender === "Male" ? "Sir" : "Ma"},`, { after: 220 }),
    offerTemplateParagraph(`RE: APPLICATION FOR LOAN FACILITY OF (${money(customer.loanAmount)})`, { underline: true, after: 220 }),
    offerTemplateParagraph(`We refer to your application dated on ${displayOfferDate(new Date(`${customer.dateApplied}T00:00:00Z`), true)} the above subject matter and hereby convey our Management's approval under the following terms and conditions: -`),
    details
  ];
  return [{
    orientation: "portrait",
    children: [
      ...introduction,
      terms
    ]
  }];
}

function scheduleDetail(label, value, size = 17) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size, color: "000000" }),
      new TextRun({ text: String(value ?? "N/A"), size, color: "000000" })
    ],
    spacing: { before: 20, after: 20, line: 220 }
  });
}

function scheduleSummaryTable(customer, schedule) {
  const accountNumber = customer.account || customer.accountNumber || "N/A";
  const settlementAccount = customer.settlementAccount || accountNumber;
  const accountBranch = customer.accountBranch || customer.branch || "N/A";
  const details = [
    [
      ["Account Number", accountNumber],
      ["Settlement Account", settlementAccount],
      ["First Payment Date", displayDate(schedule.firstPaymentDate)]
    ],
    [
      ["Account Title", customer.name],
      ["Account Branch", accountBranch],
      ["Loan Schedule", "Annualized"]
    ],
    [
      ["Loan Type", customer.loanProduct],
      ["Currency", customer.currency || "NGN"],
      ["Total Principal", money(schedule.principal)]
    ],
    [
      ["Loan Amount", money(schedule.principal)],
      ["Loan Term", `${schedule.durationMonths} Month(s)`],
      ["Total Interest", money(schedule.totalInterest)]
    ],
    [
      ["Start Date", displayDate(customer.drawdownDate)],
      ["Interest Rate", `${schedule.annualRate * 100}% per annum`],
      ["Total Principal + Interest", money(schedule.totalRepayment)]
    ],
    [
      ["Maturity Date", displayDate(schedule.installments[schedule.installments.length - 1].dueDate)],
      ["Repayment Type", "Equal principal and interest"],
      ["Total Number of Instalments", schedule.installments.length]
    ]
  ];
  const widths = [5300, 5300, 5300];
  const border = { style: BorderStyle.SINGLE, size: 4, color: "7F8C8D" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border
    },
    rows: details.map((row) => new TableRow({
      cantSplit: true,
      children: row.map(([label, value], index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        margins: { top: 45, bottom: 45, left: 80, right: 80 },
        children: [scheduleDetail(label, value)]
      }))
    }))
  });
}

function signatoryBlock(font = "Arial") {
  const widths = [3000, 9838, 3000];
  const noBorder = { color: "FFFFFF", size: 0, style: BorderStyle.NIL };
  const border = { color: "000000", size: 4, style: BorderStyle.SINGLE };
  const borders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideHorizontal: noBorder,
    insideVertical: noBorder
  };
  const cell = (index, label, alignment = AlignmentType.LEFT) => new TableCell({
    width: { size: widths[index], type: WidthType.DXA },
    margins: { top: 70, bottom: 0, left: 0, right: 0 },
    borders: {
      top: index === 1 ? noBorder : border,
      bottom: noBorder,
      left: noBorder,
      right: noBorder
    },
    children: [new Paragraph({
      children: label
        ? [new TextRun({ text: label, font, bold: true, size: 16, color: "000000" })]
        : [],
      alignment,
      spacing: { before: 0, after: 0, line: 200 }
    })]
  });
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders,
    rows: [new TableRow({
      cantSplit: true,
      children: [
        cell(0, "AUTHORISED SIGNATORY"),
        cell(1, ""),
        cell(2, "CUSTOMER SIGNATORY", AlignmentType.RIGHT)
      ]
    })]
  })];
}

function repaymentScheduleTable(schedule) {
  const headers = [
    "Repayment Date",
    "Principal Repayment",
    "Interest Repayment",
    "Total Repayment",
    "Pay Order",
    "Outstanding Principal",
    "Cumulative Total Repayment",
    "Cumulative Principal Repayment",
    "Cumulative Interest Repayment",
    "Interest Status",
    "Principal Status",
    "Loan Payment Status"
  ];
  const widths = [1700, 1400, 1400, 1400, 850, 1400, 1400, 1400, 1400, 950, 950, 1588];
  const border = { style: BorderStyle.SINGLE, size: 4, color: "202020" };
  const scheduleMoney = (amount) => money(amount).replace(/^₦/, "");
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  let cumulativeTotal = 0;
  const rows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((text, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        shading: { fill: "D9EEF2" },
        margins: { top: 110, bottom: 110, left: 50, right: 50 },
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 17, color: "000000" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0, line: 200 }
        })]
      }))
    }),
    ...schedule.installments.map((installment, index) => {
      cumulativePrincipal = roundCurrency(cumulativePrincipal + installment.principal);
      cumulativeInterest = roundCurrency(cumulativeInterest + installment.interest);
      cumulativeTotal = roundCurrency(cumulativeTotal + installment.total);
      const values = [
        formatScheduleDate(installment.dueDate),
        scheduleMoney(installment.principal),
        scheduleMoney(installment.interest),
        scheduleMoney(installment.total),
        schedule.installments.length - index,
        scheduleMoney(installment.outstandingPrincipal),
        scheduleMoney(cumulativeTotal),
        scheduleMoney(cumulativePrincipal),
        scheduleMoney(cumulativeInterest),
        "O",
        "O",
        "O"
      ];
      return new TableRow({
        cantSplit: true,
        children: values.map((value, cellIndex) => new TableCell({
          width: { size: widths[cellIndex], type: WidthType.DXA },
          margins: { top: 110, bottom: 110, left: 50, right: 50 },
          children: [new Paragraph({
            children: [new TextRun({ text: String(value), size: 22, color: "000000" })],
            spacing: { before: 0, after: 0, line: 240 }
          })]
        }))
      });
    }),
    new TableRow({
      children: [
        "Totals",
        scheduleMoney(schedule.principal),
        scheduleMoney(schedule.totalInterest),
        scheduleMoney(schedule.totalRepayment),
        "",
        scheduleMoney(schedule.installments[schedule.installments.length - 1].outstandingPrincipal),
        scheduleMoney(schedule.totalRepayment),
        scheduleMoney(cumulativePrincipal),
        scheduleMoney(cumulativeInterest),
        "",
        "",
        ""
      ].map((value, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        shading: { fill: "D9EEF2" },
        margins: { top: 110, bottom: 110, left: 50, right: 50 },
        children: [new Paragraph({
          children: [new TextRun({ text: value, bold: true, size: 22, color: "000000" })],
          spacing: { before: 0, after: 0, line: 240 }
        })]
      }))
    })
  ];
  return new Table({
    width: { size: widths.reduce((total, width) => total + width, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border
    },
    rows
  });
}

function createOfferLetter(customer, guarantors) {
  return createStandaloneOfferLetter({
    ...customer,
    approvedAmount: customer.approvedAmount ?? customer.recommendedAmount
  }, guarantors);
}

function createRepaymentSchedule(customer, schedule) {
  return [
    centeredTitle("LOAN REPAYMENT SCHEDULE"),
    scheduleSummaryTable(customer, schedule),
    repaymentScheduleTable(schedule),
    ...signatoryBlock()
  ];
}

module.exports = { createOfferLetter, createRepaymentSchedule };
