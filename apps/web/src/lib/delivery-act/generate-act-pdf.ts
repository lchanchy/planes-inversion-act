import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import type { DeliveryActInput, DeliveryActItem, DeliveryActLogo } from "./types";

// Verde institucional (ForestPdf "1f4d35") usado en las actas de la web.
const FOREST = rgb(0x1f / 255, 0x4d / 255, 0x35 / 255);
const BLACK = rgb(0.07, 0.07, 0.07);
const LINE_GRAY = rgb(0.72, 0.78, 0.72);

const PAGE_WIDTH = 595.28; // A4 vertical (puntos)
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DEFAULT_INTRO =
  "De acuerdo con la planificacion predial realizada, donde se identificaron los requerimientos para el establecimiento de las iniciativas de restauracion ecologica que permiten el mejoramiento del predio y el bienestar de la familia, a continuacion, se hace entrega de materiales e insumos concertados entre la familia y el equipo tecnico del proyecto, para dar cumplimiento a las actividades y metas priorizadas en la planificacion predial.";
const DEFAULT_FINAL =
  "La familia recibe a conformidad los materiales e insumos relacionados y se compromete a darles el uso previsto en la planificacion predial.";

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  /** cursor medido desde el tope de la pagina (top-down); se convierte a coordenadas pdf-lib al dibujar */
  top: number;
};

function toY(top: number) {
  return PAGE_HEIGHT - top;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.top = MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.top + needed > PAGE_HEIGHT - MARGIN) newPage(ctx);
}

function drawText(ctx: Ctx, text: string, x: number, size: number, bold = false, color = BLACK) {
  ctx.page.drawText(text, { x, y: toY(ctx.top) - size, size, font: bold ? ctx.bold : ctx.font, color });
}

function textWidth(ctx: Ctx, text: string, size: number, bold = false) {
  return (bold ? ctx.bold : ctx.font).widthOfTextAtSize(text, size);
}

function drawCentered(ctx: Ctx, text: string, x: number, width: number, size: number, bold = false, color = BLACK) {
  const w = textWidth(ctx, text, size, bold);
  drawText(ctx, text, x + Math.max(0, (width - w) / 2), size, bold, color);
}

function wrapLines(ctx: Ctx, text: string, width: number, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(ctx, next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(ctx: Ctx, text: string, size: number) {
  for (const line of wrapLines(ctx, text, CONTENT_WIDTH, size)) {
    ensureSpace(ctx, size + 4);
    drawText(ctx, line, MARGIN, size);
    ctx.top += size + 4;
  }
}

function drawImageFromDataUrl(dataUrl: string): { bytes: Uint8Array; kind: "png" | "jpg" } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const base64 = dataUrl.slice(comma + 1);
  const kind: "png" | "jpg" = dataUrl.startsWith("data:image/png") ? "png" : "jpg";
  try {
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    return { bytes, kind };
  } catch {
    return null;
  }
}

async function embed(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const decoded = drawImageFromDataUrl(dataUrl);
  if (!decoded) return null;
  try {
    return decoded.kind === "png" ? await doc.embedPng(decoded.bytes) : await doc.embedJpg(decoded.bytes);
  } catch {
    return null;
  }
}

function isBottom(position: DeliveryActLogo["position"]) {
  return position.startsWith("bottom-");
}

async function drawTopLogos(ctx: Ctx, logos: DeliveryActLogo[]) {
  const top = logos.filter((logo) => !isBottom(logo.position));
  if (top.length === 0) return;
  let maxHeight = 0;
  // izquierda / centro / derecha
  for (const logo of top) {
    const image = await embed(ctx.doc, logo.dataUrl);
    if (!image) continue;
    const width = Math.min(120, Math.max(40, logo.size));
    const scale = width / image.width;
    const height = image.height * scale;
    maxHeight = Math.max(maxHeight, height);
    let x = MARGIN;
    if (logo.position === "center") x = (PAGE_WIDTH - width) / 2;
    else if (logo.position === "right") x = PAGE_WIDTH - MARGIN - width;
    ctx.page.drawImage(image, { x, y: toY(ctx.top) - height, width, height });
  }
  ctx.top += maxHeight + 10;
}

async function drawBottomLogos(ctx: Ctx, logos: DeliveryActLogo[]) {
  const bottom = logos.filter((logo) => isBottom(logo.position));
  if (bottom.length === 0) return;
  for (const logo of bottom) {
    const image = await embed(ctx.doc, logo.dataUrl);
    if (!image) continue;
    const width = Math.min(160, Math.max(50, logo.size));
    const scale = width / image.width;
    const height = image.height * scale;
    let x = MARGIN;
    if (logo.position === "bottom-center") x = (PAGE_WIDTH - width) / 2;
    else if (logo.position === "bottom-right") x = PAGE_WIDTH - MARGIN - width;
    ctx.page.drawImage(image, { x, y: MARGIN * 0.4, width, height });
  }
}

function drawMeta(ctx: Ctx, rows: [string, string][]) {
  const size = 9;
  const rowHeight = 18;
  for (const [label, value] of rows) {
    ensureSpace(ctx, rowHeight);
    drawText(ctx, `${label}: `, MARGIN, size, true);
    const labelWidth = textWidth(ctx, `${label}: `, size, true);
    drawText(ctx, value, MARGIN + labelWidth, size);
    // Linea separadora DEBAJO del texto (antes se dibujaba encima y cruzaba las letras).
    const lineTop = ctx.top + size + 4;
    ctx.page.drawLine({
      start: { x: MARGIN, y: toY(lineTop) },
      end: { x: PAGE_WIDTH - MARGIN, y: toY(lineTop) },
      thickness: 0.5,
      color: rgb(0.87, 0.87, 0.87)
    });
    ctx.top += rowHeight;
  }
}

function fittedSize(ctx: Ctx, text: string, width: number, base: number, min = 5) {
  let size = base;
  while (size > min && textWidth(ctx, text, size) > width - 4) size -= 0.5;
  return size;
}

function drawItemsTable(ctx: Ctx, items: DeliveryActItem[]) {
  const widths = [30, CONTENT_WIDTH - 30 - 80 - 80, 80, 80];
  const headers = ["#", "Descripcion del articulo", "Unidad", "Cantidad"];
  const rowHeight = 18;
  const drawRow = (cells: string[], header: boolean) => {
    ensureSpace(ctx, rowHeight + 2);
    let x = MARGIN;
    for (const [index, cell] of cells.entries()) {
      const w = widths[index];
      if (header) ctx.page.drawRectangle({ x, y: toY(ctx.top + rowHeight), width: w, height: rowHeight, color: rgb(0.95, 0.965, 0.945) });
      ctx.page.drawRectangle({ x, y: toY(ctx.top + rowHeight), width: w, height: rowHeight, borderColor: LINE_GRAY, borderWidth: 0.5 });
      const size = fittedSize(ctx, cell, w, 8);
      const cw = textWidth(ctx, cell, size, header);
      ctx.page.drawText(cell, { x: x + Math.max(2, (w - cw) / 2), y: toY(ctx.top + rowHeight) + 5, size, font: header ? ctx.bold : ctx.font, color: BLACK });
      x += w;
    }
    ctx.top += rowHeight;
  };
  drawRow(headers, true);
  items.forEach((item, index) => {
    drawRow([String(index + 1), item.materialName, item.unit, formatNumber(item.deliveredQuantity)], false);
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

async function drawSignatures(ctx: Ctx, input: DeliveryActInput) {
  ctx.top += 40;
  ensureSpace(ctx, 120);
  const sigWidth = 200;
  const leftX = MARGIN;
  const rightX = PAGE_WIDTH - MARGIN - sigWidth;

  // Firmas dibujadas (si existen), encima de la linea
  const placeSignature = async (dataUrl: string | null | undefined, x: number) => {
    if (!dataUrl) return;
    const image = await embed(ctx.doc, dataUrl);
    if (!image) return;
    const width = Math.min(sigWidth, 140);
    const scale = width / image.width;
    const height = Math.min(50, image.height * scale);
    ctx.page.drawImage(image, { x: x + (sigWidth - width) / 2, y: toY(ctx.top) - height, width, height });
  };
  await placeSignature(input.familySignatureDataUrl, leftX);
  await placeSignature(input.technicianSignatureDataUrl, rightX);
  ctx.top += 52;

  ctx.page.drawLine({ start: { x: leftX, y: toY(ctx.top) }, end: { x: leftX + sigWidth, y: toY(ctx.top) }, thickness: 0.8, color: BLACK });
  ctx.page.drawLine({ start: { x: rightX, y: toY(ctx.top) }, end: { x: rightX + sigWidth, y: toY(ctx.top) }, thickness: 0.8, color: BLACK });
  ctx.top += 12;
  drawCentered(ctx, "Representante familia", leftX, sigWidth, 9, true);
  drawCentered(ctx, "Tecnico proyecto", rightX, sigWidth, 9, true);
  ctx.top += 14;
  drawCentered(ctx, `Nombre: ${input.representativeName || "________________"}`, leftX, sigWidth, 8);
  drawCentered(ctx, `Nombre: ${input.technicianName || "________________"}`, rightX, sigWidth, 8);
  ctx.top += 12;
  drawCentered(ctx, `Cedula: ${input.familyDocument || "________________"}`, leftX, sigWidth, 8);
  drawCentered(ctx, `Cedula: ${input.technicianDocument || "________________"}`, rightX, sigWidth, 8);
}

export async function generateDeliveryActPdf(input: DeliveryActInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), font, bold, top: MARGIN };

  await drawTopLogos(ctx, input.logos);

  drawText(ctx, "ACTA DE ENTREGA DE INSUMOS Y MATERIALES", MARGIN, 15, true, FOREST);
  ctx.top += 32;

  drawMeta(ctx, [
    ["Entrega No.", input.actNumber],
    ["Representante familia", input.representativeName || "N/A"],
    ["Proyecto", input.projectName || "N/A"],
    ["Departamento", input.department || "N/A"],
    ["Municipio", input.municipality || "N/A"],
    ["Vereda", input.village || "N/A"],
    ["Codigo predial / familia", input.familyCode || "N/A"],
    ["Fecha de entrega", input.deliveryDate]
  ]);
  ctx.page.drawLine({ start: { x: MARGIN, y: toY(ctx.top + 4) }, end: { x: PAGE_WIDTH - MARGIN, y: toY(ctx.top + 4) }, thickness: 2, color: FOREST });
  ctx.top += 18;

  drawParagraph(ctx, input.introText?.trim() || DEFAULT_INTRO, 9);
  ctx.top += 8;
  drawItemsTable(ctx, input.items);
  ctx.top += 12;
  drawParagraph(ctx, input.finalText?.trim() || DEFAULT_FINAL, 9);

  await drawSignatures(ctx, input);
  await drawBottomLogos(ctx, input.logos);

  return doc.save();
}
