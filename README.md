# NPF Management System

A small Electron desktop app for preparing loan appraisal, C.I.R.C. comment sheet, offer letter, and Key Facts Statement documents as editable Word files.

## Run

Install [Node.js](https://nodejs.org/), then run these commands in this folder:

```powershell
npm install
npm start
```

Fill in the customer and guarantor details, including the customer's gender, select an appraising officer and the templates to include, and choose where to save the generated `.docx` file. The app does not store the form data after closing.

Use the **Loan calculator** link to open the standalone repayment simulator. It estimates monthly repayments and an installment-by-installment schedule from the loan amount, product, duration, and selected loan start date without requiring appraisal or customer details. The start date defaults to today, and the simulator excludes Key Facts fees and charges.

Repayments are calculated from the recommended amount, tenor and drawdown date. Term Loan and Other Micro Loan use fixed monthly principal with interest calculated daily at 26% per annum on the original loan principal, not the declining balance. Interest varies only with the actual number of days in each repayment period: periods with the same number of days have the same interest amount. Payments are due on the corresponding day of each following month; if that day does not exist, the payment falls on that month's last day and returns to the original day in later months. Sharp Sharp uses 4% flat interest per month (equivalent to 48% per annum). Review all calculations and generated terms before issuing a document.

Term Loan and Other Micro Loan are assigned from the recommended amount: ₦1,000,000.00 and above is Term Loan, and amounts below that are Other Micro Loan. Both have a maximum tenor of 24 months and a 26% per annum rate applied daily to the original principal. Sharp Sharp must be selected separately, with a recommended amount between ₦100,000.00 and ₦1,000,000.00, a 4% per month flat rate. Currency fields accept amounts with or without comma separators and display them to two decimal places.

The optional Key Facts Statement uses the recommended amount as the loan principal. It calculates actual-day interest on the original principal for Term Loan and Other Micro Loan, flat interest for Sharp Sharp, total principal-plus-interest repayment, and total cost of credit. Term Loan and Other Micro Loan include insurance at 1.5%, management fee at 1%, and VAT at 1.7% of the management fee. Sharp Sharp excludes the management fee and its VAT. Third-party charges follow the supplied Key Facts spreadsheet: Credit Bureau ₦1,000, stamp duty ₦1,000, seal ₦50, and VAT on CRC ₦75. Fees and charges are disclosed separately from principal and interest repayments.

The offer letter uses the offer date plus 30 days as its effective date and calculates expiry from the effective date and loan tenor. Its repayment schedule starts one month after drawdown and follows the original drawdown day, adjusting only in months without that day. The offer-letter management-fee VAT is 7.5% of the 1% management fee, and its mandatory savings deposit is 3% of the approved amount. These offer-letter calculations are specific to that template; the Key Facts Statement retains its separate 1.7% management-fee VAT calculation.
