/* @vitest-environment node */

import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  getSafeFileName,
  UploadValidationError,
  validateDocumentBytes,
} from "@/lib/materials/files";
import { extractDocumentText } from "@/lib/materials/extract";
import { DocumentProcessingError } from "@/lib/materials/types";

const encoder = new TextEncoder();

function createPdf(text: string) {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
  const stream = `BT /F1 14 Tf 50 700 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const crossReferenceOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

async function createDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Photosynthesis</w:t></w:r></w:p>
    <w:p><w:r><w:t>Plants convert light energy into chemical energy.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Chlorophyll absorbs light in the leaves.</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

describe("learning material upload validation", () => {
  it("accepts only files whose extension, MIME type, and signature agree", () => {
    expect(
      validateDocumentBytes(
        "notes.pdf",
        "application/pdf",
        createPdf("Conservation of energy"),
      ).fileType,
    ).toBe("pdf");
    expect(() =>
      validateDocumentBytes(
        "notes.pdf",
        "application/pdf",
        encoder.encode("not a PDF"),
      ),
    ).toThrow(UploadValidationError);
    expect(() =>
      validateDocumentBytes("notes.exe", "application/octet-stream", encoder.encode("x")),
    ).toThrow(/PDF, DOCX, or TXT/);
  });

  it("removes path components and unsafe characters from display names", () => {
    expect(getSafeFileName(encodeURIComponent("C:\\private\\notes.txt"))).toBe(
      "notes.txt",
    );
    expect(() => getSafeFileName("%")).toThrow(UploadValidationError);
  });
});

describe("real document text extraction", () => {
  it("extracts readable text from a valid PDF and keeps its page reference", async () => {
    const sections = await extractDocumentText(
      "pdf",
      createPdf("Kinetic energy depends on mass and velocity."),
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].pageOrLocation).toBe("Page 1");
    expect(sections[0].text).toContain("Kinetic energy depends on mass and velocity");
  });

  it("extracts headings and paragraphs from a real DOCX archive", async () => {
    const sections = await extractDocumentText("docx", await createDocx());

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Photosynthesis");
    expect(sections[0].text).toContain("Plants convert light energy into chemical energy");
    expect(sections[0].pageOrLocation).toBe("Photosynthesis");
  });

  it("preserves TXT paragraph locations and rejects blank or corrupted documents", async () => {
    const sections = await extractDocumentText(
      "txt",
      encoder.encode("Cell theory\n\nAll living things are made of cells."),
    );
    expect(sections).toHaveLength(2);
    expect(sections[1].pageOrLocation).toBe("Paragraph 2");

    await expect(extractDocumentText("txt", encoder.encode(" \n\n "))).rejects.toMatchObject({
      code: "empty_document",
    });
    await expect(
      extractDocumentText("pdf", encoder.encode("%PDF- corrupted")),
    ).rejects.toBeInstanceOf(DocumentProcessingError);
    await expect(
      extractDocumentText("docx", encoder.encode("PK\u0003\u0004broken archive")),
    ).rejects.toBeInstanceOf(DocumentProcessingError);
  });
});
