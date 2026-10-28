const { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = require("docx");
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
const { calculateOfferLetterValues, formatScheduleDate } = require("./loan-calculations");

function displayOfferDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const remainder = day % 10;
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : remainder === 1 ? "st" : remainder === 2 ? "nd" : remainder === 3 ? "rd" : "th";
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  return `${day}${suffix} ${month}, ${date.getFullYear()}`;
}

function repaymentScheduleTable(schedule) {
  const headers = ["Payment", "Due date", "Opening balance", "Principal", "Interest", "Total payment", "Closing balance"];
  const widths = [500, 1400, 1600, 1300, 1300, 1500, 1700];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((text, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 16, color: "000000" })],
          spacing: { before: 50, after: 50 }
        })]
      }))
    }),
    ...schedule.installments.map((installment) => new TableRow({
      children: [
        String(installment.installment),
        formatScheduleDate(installment.dueDate),
        money(installment.openingPrincipal),
        money(installment.principal),
        money(installment.interest),
        money(installment.total),
        money(installment.outstandingPrincipal)
      ].map((value, index) => new TableCell({
        width: { size: widths[index], type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text: value, size: 16, color: "000000" })],
          spacing: { before: 40, after: 40 }
        })]
      }))
    }))
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows
  });
}

function createOfferLetter(customer, guarantors, repayment, appraisingOfficer, schedule) {
  const facts = calculateKeyFacts(customer);
  const values = calculateOfferLetterValues(customer);
  const offerDate = new Date(`${customer.documentDate}T00:00:00`);
  const applicationDate = new Date(`${customer.dateApplied}T00:00:00`);
  const female = customer.gender === "Female";
  const purpose = String(customer.purpose || "").replace(/^to\s+/i, "");
  const title = `OFFER LETTER FOR ${customer.loanProduct}`;
  const guarantorDetails = guarantors.length
    ? guarantors.map((guarantor) => `${guarantor.name} (Account Number: ${guarantor.account})`).join("; ")
    : "No guarantor details provided";
  const interestRate = customer.loanProduct === "Sharp Sharp"
    ? "4% Flat per Month (48% per annum; subject to review in line with changes in the money market rate and bank policy as may occur from time to time)."
    : "26% per annum, calculated daily on the original principal using the actual days in each repayment period (subject to review in line with the changes in the money market rate and bank policy as may occur from time to time).";
  const variableRateText = "Changes in the prevailing market rates and conditions during the tenor of this agreement may alter the rates agreed upon by the parties. Any such changes will be effected 10 days after the Borrower has been duly notified of these changes. Note that the Bank is not obliged to disclose the basis on which the assessment was made.";
  const content = [
    centeredTitle(title),
    centeredTitle("OFFER LETTER"),
    addParagraph(`Date: ${displayOfferDate(offerDate)}`),
    labelValue("Customer's Name", customer.name),
    labelValue("Customer's Address", customer.address),
    addParagraph(`Dear ${female ? "Ma" : "Sir"},`),
    addParagraph(`RE: APPLICATION FOR LOAN FACILITY OF (${money(customer.loanAmount)})`, { spacing: { before: 140, after: 160 } }),
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
      : `Fixed monthly principal of ${money(schedule.installments[0].principal)} plus interest calculated on the original principal; first payment is due one month after drawdown on ${displayDate(schedule.firstPaymentDate)}.`),
    heading("Repayment Schedule"),
    ...(customer.loanProduct === "Sharp Sharp" ? [] : [
      addParagraph("Interest for each period is calculated on the original principal: original principal × 26% × actual days in the period ÷ 365. The interest amount changes with the number of days in each period; monthly principal payments remain fixed.")
    ]),
    repaymentScheduleTable(schedule),
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
    separatorLine(),

  ];

  return content;
}

module.exports = { createOfferLetter };
