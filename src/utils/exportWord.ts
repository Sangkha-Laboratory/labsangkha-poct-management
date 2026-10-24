import { Document, Packer, Paragraph, ImageRun, PageOrientation, AlignmentType } from 'docx';

export interface ExportableLabel {
  id: string;
  header: string;
  title: string;
  barcode: string;
  displayCode: string;
  subInfo1: string;
  subInfo2: string;
  showOpenDateBlank: boolean;
  copies: number;
}

/**
 * Exports printable barcode labels to a Microsoft Word (.docx) document
 * configured with exact hospital lab page setup from Word photos:
 * - ขนาดกระดาษ (Paper): กว้าง 5.5 ซม. x สูง 2.2 ซม. (3118 x 1247 twips)
 * - การวางแนว (Orientation): แนวตั้ง (Portrait)
 * - ระยะขอบ (Margins): บน 0.2 ซม., ล่าง 0.2 ซม., ซ้าย 0.2 ซม., ขวา 0.2 ซม. (113 twips)
 * - เค้าโครง (Layout): หัวกระดาษ 0.2 ซม., ท้ายกระดาษ 0.2 ซม.
 */
export async function exportLabelsToWordDocx(
  labels: ExportableLabel[],
  renderLabelToBlob: (label: ExportableLabel) => Promise<Blob | null>,
  fileName?: string
): Promise<void> {
  const sections = [];

  for (const label of labels) {
    const blob = await renderLabelToBlob(label);
    if (!blob) continue;
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const copiesCount = Math.max(1, label.copies || 1);
    for (let c = 0; c < copiesCount; c++) {
      sections.push({
        properties: {
          page: {
            size: {
              width: 3118, // 5.5 cm = 3118 twips
              height: 1247, // 2.2 cm = 1247 twips
              orientation: PageOrientation.PORTRAIT, // ตรงตามการตั้งค่าใน Word: แนวตั้ง (Portrait)
            },
            margin: {
              top: 113, // 0.2 cm = 113 twips
              bottom: 113, // 0.2 cm
              left: 113, // 0.2 cm
              right: 113, // 0.2 cm
              header: 113, // 0.2 cm (ตามแท็บเค้าโครงใน Word)
              footer: 113, // 0.2 cm (ตามแท็บเค้าโครงใน Word)
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 0,
              after: 0,
              line: 240, // 1.0 single line spacing
            },
            children: [
              new ImageRun({
                data: uint8Array,
                transformation: {
                  width: 190, // พอดีกับพื้นที่พิมพ์ 5.1 ซม. ไม่ล้นหน้า
                  height: 66, // พอดีกับพื้นที่พิมพ์ 1.8 ซม. ไม่ล้นหน้า
                },
                type: 'png',
              }),
            ],
          }),
        ],
      });
    }
  }

  if (sections.length === 0) {
    throw new Error('ไม่มีข้อมูลสติกเกอร์สำหรับสร้างไฟล์ Word');
  }

  const doc = new Document({
    sections,
  });

  const docBlob = await Packer.toBlob(doc);
  const defaultName = `barcode-stickers-55x22mm-${new Date().toISOString().slice(0, 10)}.docx`;
  const finalName = fileName || defaultName;

  const url = URL.createObjectURL(docBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
