import { Document, Packer, Paragraph } from "docx";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Build a .docx containing `text` (uploads only accept PDF, Word and Excel). */
export function makeDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: [new Paragraph(text)] }],
  });
  return Packer.toBuffer(doc);
}
