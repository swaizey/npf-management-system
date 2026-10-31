const { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = require("docx");
const {
  addParagraph,
  amountInWords,
  centeredTitle,
  displayDate,
  heading,
  labelValue,
  money,
  separatorLine
} = require("./document-utils");
const { calculateKeyFacts } = require("./key-fact");
const { calculateOfferLetterValues, formatScheduleDate, roundCurrency } = require("./loan-calculations");

function displayOfferDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const remainder = day % 10;
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : remainder === 1 ? "st" : remainder === 2 ? "nd" : remainder === 3 ? "rd" : "th";
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  return `${day}${suffix} ${month}, ${date.getFullYear()}`;
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

function signatoryBlock() {
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
        ? [new TextRun({ text: label, bold: true, size: 16, color: "000000" })]
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

function createOfferLetter(customer, guarantors, repayment, schedule) {
  const facts = calculateKeyFacts(customer);
  const values = calculateOfferLetterValues(customer);
  const offerDate = new Date(`${customer.documentDate}T00:00:00`);
  const applicationDate = new Date(`${customer.dateApplied}T00:00:00`);
  const female = customer.gender === "Female";
  const purpose = String(customer.purpose || "").replace(/^to\s+/i, "");
  const title = `OFFER LETTER FOR ${customer.loanProduct}`;
  const guarantorDetails = guarantors.length
    ? guarantors.map((guarantor) => `${guarantor.name} (A/C: ${guarantor.account})`).join("; ")
    : "No guarantor details provided";
  const interestRate = customer.loanProduct === "Sharp Sharp"
    ? "48% per annum (4% monthly equivalent), calculated daily on the original principal using actual days in each period."
    : "26% per annum, calculated daily on the original principal using a 365-day year, or 366 days in a leap year.";
  const variableRateText = "Changes in the prevailing market rates and conditions during the tenor of this agreement may alter the rates agreed upon by the parties. Any such changes will be effected 10 days after the Borrower has been duly notified of these changes. Note that the Bank is not obliged to disclose the basis on which the assessment was made.";
  const introduction = [
    centeredTitle(title),
    centeredTitle("OFFER LETTER"),
    addParagraph(`Date: ${displayOfferDate(offerDate)}`),
    labelValue("Customer's Name", customer.name),
    labelValue("Customer's Address", customer.address),
    addParagraph(`Dear ${female ? "Ma" : "Sir"},`),
    addParagraph(`RE: APPLICATION FOR LOAN FACILITY OF (${money(customer.loanAmount)})`, { spacing: { before: 140, after: 80 } }),
    separatorLine(),
    addParagraph(`We refer to your application dated ${displayOfferDate(applicationDate)} on the above subject matter and hereby convey our Management's approval under the following terms and conditions:`),
    labelValue("Lender", "NPF Microfinance Bank Plc"),
    labelValue("Borrower", customer.name),
    labelValue("Contact details of the Borrower", customer.address),
    labelValue("Credit/Facility type", customer.loanProduct),
    labelValue("Purpose", `To enable ${female ? "her" : "him"} to ${purpose}`),
    labelValue("Amount approved", `${money(values.approvedAmount)} (${amountInWords(values.approvedAmount)})`),
    labelValue("Collateral/Security", `Salary; Guarantor(s): ${guarantorDetails}`),
    labelValue("Tenor", `${customer.durationMonths} months`),
    labelValue("Interest rate", interestRate),
    labelValue("Effective Date", values.effectiveDate ? displayDate(values.effectiveDate) : "To be confirmed"),
    labelValue("Expiry Date", values.expiryDate ? displayDate(values.expiryDate) : "To be confirmed"),
    labelValue("Variable rate Information", variableRateText),
    heading("Fees and Commissions"),
    addParagraph(`i. Management fee 1% (${money(values.managementFee)})`),
    addParagraph(`ii. 3% Mandatory Saving Deposit (${money(values.mandatorySavings)})`),
    addParagraph(`iii. Credit Bureau Report fee ${money(facts.creditBureau)}`),
    addParagraph(`iv. VAT 7.5% of Management Processing fee (${money(values.managementFeeVat)})`),
    labelValue("Credit life Insurance Premium", `1.5% (${money(values.insurance)}) of Amount approved`),
    labelValue("Repayment", customer.loanProduct === "Sharp Sharp"
      ? `Monthly principal and interest ${money(repayment)}`
      : `Fixed monthly principal of ${money(schedule.installments[0].principal)} plus interest calculated on the original principal; first payment is due one month after drawdown on ${displayDate(schedule.firstPaymentDate)}.`)
  ];
  const repaymentSchedule = [
    centeredTitle("LOAN CALCULATION"),
    scheduleSummaryTable(customer, schedule),
    ...(customer.loanProduct === "Sharp Sharp" ? [] : [
      addParagraph("Interest for each period is calculated on the original principal: original principal × 26% × actual days in the period ÷ 365 (or ÷ 366 in a leap year). The interest amount changes with the number of days in each period; monthly principal payments remain fixed.")
    ]),
    repaymentScheduleTable(schedule),
    ...signatoryBlock()
  ];
  const terms = [
    heading("Early Liquidation terms"),
    addParagraph("All outstanding sums of the Facility (whether principal, interest or any other monies owing to the Bank) shall be repayable at any time forthwith on demand."),
    addParagraph("The Bank is at liberty to recall the facility if the project fails to comply with the Environmental and Social policy of the Bank."),
    addParagraph("The Borrower may choose to liquidate the Loan either partly or fully during the continuity of the loan facility. All such payments shall be made and accepted in line with the statutory guidelines and rules, including early liquidation charges applicable from time to time unless specifically mentioned in the schedule."),
    heading("Late repayment"),
    addParagraph("Non-payment of any instalment violates the entire facility agreement on the basis of which the facility can be called in and the Bank will be at liberty to take necessary steps to recover the outstanding loan with accruing interest."),
    addParagraph("By signing this offer letter/loan agreement and by drawing on the loan, I covenant to repay the loan as and when due. In the event that I fail to repay the loan as agreed, and the loan becomes delinquent, the Bank shall have the right to report the delinquent loan to the CBN through the Credit Risk Management System (CRMS) or by any other means and request the CBN to exercise its regulatory power to direct all banks and other financial institutions under its regulatory purview to set off my indebtedness from any money standing to my credit in any bank account and from any other financial assets they may be holding for my benefit."),
    addParagraph("In the event of any default of monthly repayment or instalment, the Bank will charge the Borrower a penalty rate in addition to the agreed interest rate."),
    addParagraph("All expenses (administrative or monitoring) relating to the documentation of this facility and recovery of same, if there be any, will be borne by the Borrower."),
    addParagraph("I covenant and warrant that the Bank shall have power to set off my indebtedness under this loan agreement from all such monies and funds standing to my credit/benefit in any and all such accounts or from any other financial assets belonging to me and in the custody of any such bank."),
    addParagraph("I hereby waive any right of confidentiality whether arising under law or statute or in any other manner whatsoever and irrevocably agree that I shall not argue to the contrary before any court of law, administrative authority or any other body acting in any judicial or quasi-judicial capacity."),
    heading("Grace Period"),
    addParagraph("a. The Borrower shall have seven (7) days grace period to pay any amount due under this Agreement within which there will be no penal charge on the late repayment. However, upon the expiration of the grace period, a default interest rate of twelve percent (12%) per annum shall apply from the due date thereof until the same is paid (\"Default Interest\")."),
    addParagraph("b. The Borrower shall have seven (7) days grace period from the date of execution to rescind the loan agreement."),
    heading("Insurance requirements (where applicable)"),
    addParagraph("i. The insurance cover required for each loan is dependent on the peculiarity of a facility or security."),
    addParagraph("ii. The Borrower shall maintain a credit life insurance policy which shall pay the outstanding loan in the event of death, critical illness or in the case of loss of job (the insurance cover will be valid for 6 months' instalment repayments) where applicable."),
    addParagraph("iii. In the case of a property used as security, the Borrower shall maintain insurance against all risks of loss to the property. The insurance shall cover building collapse, fire, flood, natural disasters and vandalism where applicable."),
    separatorLine()
  ];

  return [
    { orientation: "portrait", children: introduction },
    { orientation: "landscape", children: repaymentSchedule },
    { orientation: "portrait", children: terms }
  ];
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
