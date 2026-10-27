const {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} = require("docx");

const money = (amount) =>
  `₦${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function amountInWords(amount) {
  const roundedAmount = Math.round((amount + Number.EPSILON) * 100) / 100;
  let wholeAmount = Math.floor(roundedAmount);
  let kobo = Math.round((roundedAmount - wholeAmount) * 100);
  if (kobo === 100) {
    wholeAmount += 1;
    kobo = 0;
  }
  const smallNumbers = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = [
    "", "Thousand", "Million", "Billion", "Trillion", "Quadrillion",
    "Quintillion", "Sextillion", "Septillion", "Octillion", "Nonillion", "Decillion"
  ];

  function groupInWords(value) {
    if (value < 20) return smallNumbers[value];
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${smallNumbers[value % 10]}` : ""}`;
    return `${smallNumbers[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${groupInWords(value % 100)}` : ""}`;
  }

  function integerInWords(value) {
    if (value === 0) return "Zero";
    const groups = [];
    let scale = 0;
    while (value > 0) {
      const group = value % 1000;
      if (group) groups.unshift(`${groupInWords(group)}${scales[scale] ? ` ${scales[scale]}` : ""}`);
      value = Math.floor(value / 1000);
      scale += 1;
    }
    return groups.join(" ");
  }

  const naira = `${integerInWords(wholeAmount)} Naira`;
  return kobo ? `${naira} and ${integerInWords(kobo)} Kobo Only` : `${naira} Only`;
}

function displayDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addParagraph(children, options = {}) {
  const runs = Array.isArray(children)
    ? children
    : [new TextRun({ text: String(children ?? ""), size: 22, color: "000000" })];
  return new Paragraph({ children: runs, spacing: { after: 140, line: 280 }, ...options });
}

function separatorLine() {
  return new Paragraph({
    border: {
      bottom: { color: "000000", size: 12, space: 2, style: BorderStyle.SINGLE }
    },
    spacing: { before: 0, after: 220 },
    children: [new TextRun({ text: "\u00a0", size: 22, color: "000000" })]
  });
}

function ordinalDay(value) {
  const day = Number(value);
  const remainder = day % 10;
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : remainder === 1 ? "st" : remainder === 2 ? "nd" : remainder === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

function displayDocumentDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date).toUpperCase();
  return `${ordinalDay(date.getDate())} ${month}, ${date.getFullYear()}`;
}

function labelValue(label, value, boldValue = false) {
  return addParagraph([
    new TextRun({ text: `${label}: `, bold: true, size: 22, color: "000000" }),
    new TextRun({ text: String(value ?? ""), bold: boldValue, size: 22, color: "000000" })
  ], { spacing: { after: 80, line: 240 } });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 120, after: 180 },
    keepNext: true
  });
}

function centeredTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: "000000" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 250 }
  });
}

function keyValueTable(entries, columnWidth = 4700) {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: entries.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: columnWidth, type: WidthType.DXA },
          children: [addParagraph(new TextRun({ text: label, bold: true, size: 22, color: "000000" }))]
        }),
        new TableCell({
          width: { size: 10000 - columnWidth, type: WidthType.DXA },
          children: [addParagraph(new TextRun({ text: String(value ?? ""), size: 22, color: "000000" }))]
        })
      ]
    }))
  });
}

module.exports = {
  addParagraph,
  amountInWords,
  centeredTitle,
  displayDate,
  displayDocumentDate,
  heading,
  keyValueTable,
  labelValue,
  localDateValue,
  money,
  separatorLine
};
