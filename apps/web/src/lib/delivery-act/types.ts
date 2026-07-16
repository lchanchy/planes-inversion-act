// Datos planos para generar el acta de entrega en servidor (sin tipos de navegador).
// Fase 1 del plan: generación del PDF firmado en Vercel con pdf-lib.

export type DeliveryActLogoPosition =
  | "left" | "center" | "right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type DeliveryActLogo = {
  /** data URI base64 (image/jpeg o image/png) */
  dataUrl: string;
  position: DeliveryActLogoPosition;
  /** ancho aproximado en puntos */
  size: number;
};

export type DeliveryActItem = {
  materialName: string;
  unit: string;
  deliveredQuantity: number;
};

export type DeliveryActInput = {
  actNumber: string;
  representativeName: string;
  projectName: string;
  department: string;
  municipality: string;
  village: string;
  familyCode: string;
  deliveryDate: string;
  introText: string;
  finalText: string;
  items: DeliveryActItem[];
  technicianName: string;
  familyDocument: string;
  technicianDocument: string;
  logos: DeliveryActLogo[];
  /** firma dibujada, data URI PNG base64 */
  familySignatureDataUrl?: string | null;
  technicianSignatureDataUrl?: string | null;
};
