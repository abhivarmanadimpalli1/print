/**
 * Utility to generate a minimal valid PDF string for demo downloads and browser printing
 */
export function generateMinimalPdf(title: string, pages: number = 3): string {
  // A clean minimal multi-page PDF 1.4 binary structure
  const pageObjects = [];
  const pageKids = [];

  for (let i = 1; i <= pages; i++) {
    const objNum = 3 + i * 2;
    const contentObjNum = objNum + 1;
    pageKids.push(`${objNum} 0 R`);

    const textContent = `BT /F1 20 Tf 50 720 Td (${title} - Page ${i} of ${pages}) Tj /F1 12 Tf 0 -30 Td (Verified In-Shop Print Order Document) Tj 0 -20 Td (Options: Standard Document Formatting) Tj ET`;
    const streamLength = textContent.length;

    pageObjects.push(`
${objNum} 0 obj
<< /Type /Page
   /Parent 3 0 R
   /MediaBox [0 0 595 842]
   /Contents ${contentObjNum} 0 R
   /Resources << /Font << /F1 2 0 R >> >>
>>
endobj
${contentObjNum} 0 obj
<< /Length ${streamLength} >>
stream
${textContent}
endstream
endobj`);
  }

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
2 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
3 0 obj
<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${pages} >>
endobj
${pageObjects.join('\n')}
xref
0 ${4 + pages * 2}
0000000000 65535 f 
trailer
<< /Size ${4 + pages * 2} /Root 1 0 R >>
startxref
%%EOF`;

  return `data:application/pdf;base64,${btoa(pdf)}`;
}
