module.exports = {
  samplePayload: {
    customer: {
      name: "Ken Obi",
      gender: "Male",
      phone: "08012345678",
      bvn: "22265482316",
      nin: "12345678901",
      forceNumber: "AP-56984236",
      dob: "1978-09-07",
      enlistmentDate: "2000-01-01",
      retirementDate: "2026-10-31",
      salary: 190000,
      account: "00205698645",
      id: "ID-001",
      address: "NPF Nkpo Anambra",
      loanAmount: 1000000,
      recommendedAmount: 1000000,
      loanRecommended: "Yes",
      loanProduct: "Other Micro Loan",
      purpose: "To complete building project",
      durationMonths: 24,
      loanCycle: 1,
      mss: "NPF",
      dateApplied: "2026-10-23",
      documentDate: "2026-10-25",
      drawdownDate: "2026-10-25"
    },
    guarantors: [
      {
        name: "Ikenna Christopher",
        account: "00205698645",
        bvn: "22265482316",
        phone: "08034458264",
        retirementDate: "2026-10-31",
        salary: 190000,
        forceNumber: "56984236",
        address: "NPF Nkpo Anambra"
      }
    ],
    templates: ["appraisal", "circ", "offer"]
  }
};
