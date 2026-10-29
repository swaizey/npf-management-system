# NPF Management System

A small Electron desktop app for preparing loan appraisal, C.I.R.C. comment sheet, offer letter, and Key Facts Statement documents as editable Word files.

## Run

Install [Node.js](https://nodejs.org/), then run these commands in this folder:

```powershell
npm install
npm start
```

## Build a Windows installer

Install the dependencies and build the NSIS installer:

```powershell
npm install
npm run dist
```

The installable Windows setup executable is written to the `release` folder. Run it to install the app for testing.

Fill in the customer and guarantor details, including the customer's gender, select an appraising officer and the templates to include, and choose where to save the generated `.docx` file. The app does not store the form data after closing.

Use the **Loan calculator** link to open the standalone repayment simulator. It estimates monthly repayments and an installment-by-installment schedule from the loan amount, product, duration, and selected loan start date without requiring appraisal or customer details. The start date defaults to today, and the simulator excludes Key Facts fees and charges.

Repayments are calculated from the recommended amount, tenor and drawdown date. Term Loan and Other Micro Loan use fixed monthly principal. For each period, interest is `I = P × R × D ÷ Y`, where `P` is the original loan principal, `R` is 26%, `D` is the actual number of days in that period, and `Y` is 365 (366 in a leap year); interest is not calculated on the declining balance. Periods crossing calendar years accrue interest using the corresponding year's denominator for each portion. Sharp Sharp uses a 48% annual rate (equivalent to 4% per month), calculated daily on the original principal using actual days in each repayment period and a 365-day year. Interest therefore varies with the number of days in each period. Payments are due on the corresponding day of each following month; if that day does not exist, the payment falls on that month's last day and returns to the original day in later months. Review all calculations and generated terms before issuing a document.

Term Loan and Other Micro Loan are assigned from the recommended amount: ₦1,000,000.00 and above is Term Loan, and amounts below that are Other Micro Loan. Both have a maximum tenor of 24 months and a 26% per annum rate applied daily to the original principal using a 365-day year, or 366 days in a leap year. Sharp Sharp must be selected separately, with a recommended amount between ₦100,000.00 and ₦1,000,000.00, a 48% per annum rate (4% monthly equivalent) applied daily to the original principal using actual days and a 365-day year. Currency fields accept amounts with or without comma separators and display them to two decimal places.

The optional Key Facts Statement uses the recommended amount as the loan principal. It calculates actual-day interest on the original principal for all loan products, total principal-plus-interest repayment, and total cost of credit. Key Facts fee sections show the 1% management fee under credit-provider fees and adhesive stamp (₦1,000), stamp duty (₦50), insurance (1.5%), Credit Bureau Search (₦1,000), and VAT charge (7.5% of the management fee) under third-party fees. Sharp Sharp excludes the management fee and its related VAT. Fees and charges are disclosed separately from principal and interest repayments.

The offer letter uses the offer date plus 30 days as its effective date and calculates expiry from the effective date and loan tenor. Its repayment schedule is provided on an A4 landscape page and includes the loan details, installment-level principal and interest, cumulative totals, outstanding balance, and payment status columns. The schedule starts one month after drawdown and follows the original drawdown day, adjusting only in months without that day. The offer-letter management-fee VAT is 7.5% of the 1% management fee, and its mandatory savings deposit is 3% of the approved amount. These offer-letter date and savings calculations are specific to that template; the Key Facts Statement presents its 7.5% VAT charge under third-party fees.
