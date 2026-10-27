# NPF Management System

A small Electron desktop app for preparing loan appraisal, C.I.R.C. comment sheet, offer letter, and Key Facts Statement documents as editable Word files.

## Run

Install [Node.js](https://nodejs.org/), then run these commands in this folder:

```powershell
npm install
npm start
```

Fill in the customer and guarantor details, including the customer's gender, select an appraising officer and the templates to include, and choose where to save the generated `.docx` file. The app does not store the form data after closing.

The monthly repayment is estimated from the recommended amount and the selected product's flat interest rate when the repayment field is left blank. Review all calculations and generated terms before issuing a document.

Term Loan and Other Micro Loan are assigned from the recommended amount: ₦1,000,000.00 and above is Term Loan, and amounts below that are Other Micro Loan. Both have a maximum tenor of 24 months and a flat interest rate of 26% per annum. Sharp Sharp must be selected separately, with a recommended amount between ₦100,000.00 and ₦1,000,000.00, a maximum tenor of 12 months, and a flat interest rate of 4% per month. Currency fields accept amounts with or without comma separators and display them to two decimal places.

The optional Key Facts Statement uses the recommended amount as the loan principal. It calculates flat interest by product and tenor, the total principal-plus-interest repayment, and the total cost of credit. Term Loan and Other Micro Loan include insurance at 1.5%, management fee at 1%, and VAT at 1.7% of the management fee. Sharp Sharp excludes the management fee and its VAT. Third-party charges follow the supplied Key Facts spreadsheet: Credit Bureau ₦1,000, stamp duty ₦1,000, seal ₦50, and VAT on CRC ₦75. Fees and charges are disclosed separately from principal and interest repayments.

The offer letter uses the offer date plus 30 days as its effective date, schedules the first instalment one month after that date, and calculates expiry from the effective date and loan tenor. Its management-fee VAT is 7.5% of the 1% management fee, and its mandatory savings deposit is 3% of the approved amount. These offer-letter calculations are specific to that template; the Key Facts Statement retains its separate 1.7% management-fee VAT calculation.
