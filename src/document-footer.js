const fs = require("node:fs");
const path = require("node:path");
const { AlignmentType, Footer, ImageRun, Paragraph } = require("docx");

const thumbnail = fs.readFileSync(path.join(__dirname, "thumbnail.png"));

function createRepaymentFooter() {
  return new Footer({
    children: [new Paragraph({
      children: [new ImageRun({
        data: thumbnail,
        transformation: { width: 100, height: 33 },
        altText: {
          name: "thumbnail.png",
          description: "NPF Microfinance Bank logo"
        },
        type: "png"
      })],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 0 }
    })]
  });
}

module.exports = { createRepaymentFooter };
