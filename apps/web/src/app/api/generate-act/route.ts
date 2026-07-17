import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { generateDeliveryActPdf } from "@/lib/delivery-act/generate-act-pdf";
import type { DeliveryActInput, DeliveryActLogo } from "@/lib/delivery-act/types";

// pdf-lib y Buffer requieren el runtime Node (no Edge).
export const runtime = "nodejs";

// Fase 1/3: genera el acta firmada de una entrega y la guarda en Supabase Storage (bucket "actas").
// La subida a SharePoint (Fase 5) se conecta despues, aislada, cuando TI entregue el registro de Azure.
export async function POST(request: Request) {
  let deliveryId: string;
  try {
    const body = await request.json();
    // Acepta { deliveryId } (llamada directa) o el payload de un Database Webhook de Supabase ({ record: { id } }).
    deliveryId = String(body?.deliveryId ?? body?.record?.id ?? "");
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido; se espera { deliveryId } o un webhook de Supabase." }, { status: 400 });
  }
  if (!deliveryId) return NextResponse.json({ error: "Falta deliveryId." }, { status: 400 });

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  // Entrega + items
  const { data: delivery, error: deliveryError } = await supabase
    .from("material_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .single();
  if (deliveryError || !delivery) {
    return NextResponse.json({ error: `Entrega no encontrada: ${deliveryError?.message ?? deliveryId}` }, { status: 404 });
  }

  // Solo se genera acta firmada para entregas capturadas en campo (con firmas).
  // Las entregas registradas desde la web usan su propio flujo de actas.
  if (!delivery.family_signature && !delivery.technician_signature) {
    return NextResponse.json({ ok: true, skipped: "La entrega no tiene firmas; no se genera acta firmada." });
  }

  const { data: items } = await supabase
    .from("material_delivery_items")
    .select("material_name, unit, delivered_quantity")
    .eq("material_delivery_id", deliveryId)
    .eq("is_deleted", false);

  // Familia, proyecto, territorio, tecnico
  const { data: family } = await supabase.from("families").select("*").eq("id", delivery.family_id).single();
  const { data: project } = await supabase.from("projects").select("name").eq("id", delivery.project_id).single();
  const municipality = family?.municipality_id
    ? (await supabase.from("municipalities").select("name, department").eq("id", family.municipality_id).single()).data
    : null;
  const village = family?.village_id
    ? (await supabase.from("villages").select("name").eq("id", family.village_id).single()).data
    : null;
  const technician = delivery.registered_by
    ? (await supabase.from("users_profiles").select("full_name, document_number").eq("id", delivery.registered_by).single()).data
    : null;

  // Logos del proyecto (Fase 0.1)
  const { data: logoRows } = await supabase
    .from("project_logos")
    .select("data_url, position, size")
    .eq("project_id", delivery.project_id)
    .eq("is_deleted", false);
  const logos: DeliveryActLogo[] = (logoRows ?? []).map((row) => ({
    dataUrl: row.data_url as string,
    position: row.position as DeliveryActLogo["position"],
    size: Number(row.size)
  }));

  // Acta: reutiliza la existente o crea una nueva con numero derivado
  const { data: existingAct } = await supabase
    .from("delivery_acts")
    .select("id, act_number")
    .eq("material_delivery_id", deliveryId)
    .eq("is_deleted", false)
    .maybeSingle();
  const actNumber = existingAct?.act_number ?? `Entrega ${family?.family_code ?? ""}`.trim();

  const input: DeliveryActInput = {
    actNumber,
    representativeName: family?.representative_name ?? "N/A",
    projectName: project?.name ?? "N/A",
    department: municipality?.department ?? "N/A",
    municipality: municipality?.name ?? "N/A",
    village: village?.name ?? "N/A",
    familyCode: family?.family_code ?? "N/A",
    deliveryDate: delivery.delivery_date ?? "",
    introText: "",
    finalText: "",
    items: (items ?? []).map((item) => ({
      materialName: item.material_name as string,
      unit: item.unit as string,
      deliveredQuantity: Number(item.delivered_quantity)
    })),
    technicianName: technician?.full_name ?? "",
    familyDocument: family?.document_number ?? "",
    technicianDocument: technician?.document_number ?? "",
    logos,
    familySignatureDataUrl: delivery.family_signature ?? null,
    technicianSignatureDataUrl: delivery.technician_signature ?? null
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateDeliveryActPdf(input);
  } catch (error) {
    return NextResponse.json({ error: `No fue posible generar el PDF: ${(error as Error).message}` }, { status: 500 });
  }

  const storagePath = `${delivery.project_id}/${deliveryId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("actas")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: `No fue posible guardar el acta: ${uploadError.message}` }, { status: 500 });
  }

  // Registrar/actualizar la ruta del PDF en el acta
  if (existingAct?.id) {
    await supabase.from("delivery_acts").update({ pdf_path: storagePath }).eq("id", existingAct.id);
  } else {
    await supabase.from("delivery_acts").insert({
      project_id: delivery.project_id,
      family_id: delivery.family_id,
      operational_plan_id: delivery.operational_plan_id,
      material_delivery_id: deliveryId,
      act_number: actNumber,
      status: "generated",
      pdf_path: storagePath
    });
  }

  // TODO Fase 5: uploadToSharePoint(pdfBytes, `${project}/${municipio}/${vereda}/...`) cuando TI entregue Azure.

  return NextResponse.json({ ok: true, path: storagePath });
}
