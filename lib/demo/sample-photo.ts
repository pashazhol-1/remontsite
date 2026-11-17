export function createSampleReceiptFile() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560">
    <rect width="100%" height="100%" fill="#f6f4ef"/>
    <rect x="24" y="24" width="372" height="512" fill="#ffffff" stroke="#d6d3cd"/>
    <text x="210" y="80" text-anchor="middle" font-size="22" font-family="Arial" fill="#1c1917">Пример чека</text>
    <text x="210" y="112" text-anchor="middle" font-size="14" font-family="Arial" fill="#78716c">для проверки отправки</text>
    <text x="48" y="180" font-size="16" font-family="Arial" fill="#44403c">Материалы</text>
    <text x="370" y="180" text-anchor="end" font-size="16" font-family="Arial" fill="#44403c">...</text>
  </svg>`;
  return new File([svg], "primer-cheka.svg", { type: "image/svg+xml" });
}
