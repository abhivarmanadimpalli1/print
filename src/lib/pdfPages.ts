export async function countPdfPages(bytes: ArrayBuffer | Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = pdf.getPageCount();
  if (pages < 1) throw new Error('The PDF has no printable pages.');
  return pages;
}
