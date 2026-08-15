export type Role = {
  id: string;
  name:
    | "super_admin"
    | "project_admin"
    | "municipal_technician"
    | "admin"
    | "coordinator"
    | "technician"
    | "viewer"
    | "auditor"
    | string;
  description: string | null;
  permissions: Record<string, unknown>;
};

export type Profile = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string;
  document_number: string | null;
  phone: string | null;
  default_role_id: string | null;
  active: boolean;
  is_deleted: boolean;
};

export type ProjectUser = {
  id: string;
  project_id: string;
  user_id: string;
  role_id: string;
  status: "active" | "inactive" | "retired";
  can_approve_plans?: boolean;
  can_manage_purchases?: boolean;
  can_generate_documents?: boolean;
};

export type UserMunicipalityAssignment = {
  id: string;
  project_id: string;
  user_id: string;
  municipality_id: string;
  status: "active" | "inactive" | "retired";
  is_deleted: boolean;
};

export type Project = {
  id: string;
  name: string;
  code_prefix: string;
  department: string | null;
  intervention_zone: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "closed" | "archived";
  next_family_number: number;
  is_deleted: boolean;
};

export type Department = {
  id: string;
  name: string;
};

export type Municipality = {
  id: string;
  department: string;
  department_id: string | null;
  name: string;
};

export type Village = {
  id: string;
  municipality_id: string;
  name: string;
};

export type ProjectDepartment = {
  id: string;
  project_id: string;
  department_id: string;
  is_deleted: boolean;
};

export type ProjectMunicipality = {
  id: string;
  project_id: string;
  municipality_id: string;
  is_deleted: boolean;
};

export type ProjectVillage = {
  id: string;
  project_id: string;
  village_id: string;
  is_deleted: boolean;
};

export type Family = {
  id: string;
  project_id: string;
  family_code: string;
  representative_name: string;
  document_number: string | null;
  age: number | null;
  birth_date: string | null;
  phone: string | null;
  municipality_id: string | null;
  village_id: string | null;
  observations: string | null;
  status: "active" | "inactive" | "retired";
  validation_status: "temporary" | "pending_admin_validation" | "validated" | "rejected";
  is_deleted: boolean;
};

export type Property = {
  id: string;
  family_id: string;
  property_name: string | null;
  total_area_ha: number | null;
  conservation_area_ha: number | null;
  observations: string | null;
  is_deleted: boolean;
};

export type Activity = {
  id: string;
  project_id: string | null;
  name: string;
  category: string | null;
  restoration_strategy: "restauracion_ecologica" | "rehabilitacion_ecologica" | "recuperacion_ecologica" | "no_aplica" | null;
  description: string | null;
  unit: string;
  indicator_type: string | null;
  requires_baseline: boolean;
  requires_target: boolean;
  allows_project_materials: boolean;
  allows_counterpart: boolean;
  maintenance_enabled: boolean;
  maintenance_deshierbe_required: number;
  maintenance_deshierbe_optional: number;
  maintenance_fertilization_required: number;
  maintenance_fertilization_optional: number;
  maintenance_pruning_required: number;
  maintenance_pruning_optional: number;
  maintenance_replanting_optional: number;
  active: boolean;
  is_deleted: boolean;
};

export type Material = {
  id: string;
  project_id: string | null;
  internal_code: string | null;
  name: string;
  category: string | null;
  unit: string;
  quoted_unit_price: number;
  price_updated_at: string | null;
  etec_block: string | null;
  technical_characteristics: string | null;
  vegetal_indicator_group: "colinos" | "cacao" | "frutales" | "forestales_nativos" | "otro" | null;
  active: boolean;
  observations: string | null;
  is_deleted: boolean;
};

export type CounterpartCatalog = {
  id: string;
  project_id: string | null;
  name: string;
  type: "mano_obra" | "material_propio" | "otro";
  suggested_unit: string | null;
  description: string | null;
  active: boolean;
  is_deleted: boolean;
};

export type OperationalPlan = {
  id: string;
  project_id: string;
  family_id: string;
  technician_id: string | null;
  plan_date: string;
  status:
    | "draft"
    | "ready_to_sync"
    | "synced"
    | "pending_material"
    | "pending_review"
    | "approved"
    | "returned"
    | "closed"
    | "conflict";
  version: number;
  total_project_value: number;
  total_counterpart_value: number;
  sync_status: "local" | "pending_upload" | "synced" | "error" | "conflict";
  is_deleted: boolean;
};

export type PlanActivity = {
  id: string;
  plan_id: string;
  activity_id: string;
  baseline: number | null;
  target: number | null;
  unit: string;
  observations: string | null;
  is_deleted: boolean;
};

export type PlanProjectMaterial = {
  id: string;
  plan_activity_id: string;
  material_id: string | null;
  provisional_material_id: string | null;
  quantity: number;
  unit: string;
  quoted_unit_price: number;
  quoted_total: number;
  observations: string | null;
  is_deleted: boolean;
};

export type PlanFamilyCounterpart = {
  id: string;
  plan_activity_id: string;
  contribution_type: string;
  name: string;
  quantity: number;
  unit: string;
  estimated_unit_value: number;
  estimated_total: number;
  vegetal_indicator_group: "colinos" | "cacao" | "frutales" | "forestales_nativos" | "otro" | null;
  observations: string | null;
  is_deleted: boolean;
};

export type ProvisionalMaterial = {
  id: string;
  project_id: string;
  created_by_profile_id: string | null;
  provisional_name: string;
  suggested_unit: string;
  observation: string | null;
  contribution_side: "project" | "family_counterpart";
  status: "pending" | "resolved" | "rejected";
  resolved_material_id: string | null;
  is_deleted: boolean;
};

export type ProcurementStatus =
  | "pendiente_compra"
  | "en_proceso"
  | "comprado"
  | "entregado_parcial"
  | "entregado_total"
  | "cancelado";

export type ProcurementBatch = {
  id: string;
  project_id: string;
  batch_code: string;
  purchase_number: number | null;
  name: string;
  status: ProcurementStatus;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  filter_project_id: string | null;
  filter_municipality_id: string | null;
  filter_village_id: string | null;
  filter_family_id: string | null;
  filter_activity_id: string | null;
  filter_material_id: string | null;
  subtotal: number;
  observations: string | null;
  purchase_observations: string | null;
  is_deleted: boolean;
};

export type ProcurementBatchItem = {
  id: string;
  procurement_batch_id: string;
  material_id: string | null;
  provisional_material_id: string | null;
  material_name: string;
  unit: string;
  required_quantity: number;
  purchased_quantity: number;
  unit_price: number;
  total_value: number;
  quoted_unit_price: number | null;
  quoted_total_value: number | null;
  invoice_quantity: number | null;
  purchase_unit_price: number | null;
  purchase_total_value: number | null;
  etec_block: string | null;
  technical_characteristics: string | null;
  status: ProcurementStatus;
  source_plan_material_ids: string[];
  is_deleted: boolean;
};

export type MaterialDelivery = {
  id: string;
  project_id: string;
  family_id: string;
  operational_plan_id: string;
  delivery_date: string;
  status: "entregado_parcial" | "entregado_total" | "cancelado";
  observations: string | null;
  registered_by: string | null;
  is_deleted: boolean;
};

export type MaterialDeliveryItem = {
  id: string;
  material_delivery_id: string;
  project_id: string;
  family_id: string;
  operational_plan_id: string;
  plan_activity_id: string;
  activity_id: string | null;
  plan_project_material_id: string;
  material_id: string | null;
  provisional_material_id: string | null;
  material_name: string;
  unit: string;
  approved_quantity: number;
  delivered_quantity: number;
  unit_price: number;
  total_value: number;
  observations: string | null;
  admin_override: boolean;
  override_authorized_by: string | null;
  is_deleted: boolean;
};

export type DeliveryAct = {
  id: string;
  project_id: string;
  family_id: string;
  operational_plan_id: string;
  material_delivery_id: string;
  act_number: string;
  status: "generated" | "signed" | "void";
  generated_at: string;
  generated_by: string | null;
  pdf_path: string | null;
  word_path: string | null;
  observations: string | null;
  is_deleted: boolean;
};

export type ImplementationProgressStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";

export type ImplementationProgress = {
  id: string;
  project_id: string;
  family_id: string;
  operational_plan_id: string | null;
  plan_activity_id: string | null;
  material_id: string | null;
  indicator_name: string | null;
  unit: string | null;
  target_quantity: number | null;
  delivered_quantity: number;
  implemented_quantity: number;
  status: ImplementationProgressStatus;
  observations: string | null;
  progress_date: string | null;
  is_deleted: boolean;
};

export type QuarterlyProgressType =
  | "avance"
  | "entregados"
  | "sembrados"
  | "cumplimiento_acuerdo"
  | "vegetal_entrega"
  | "vegetal_siembra";

export type QuarterlyProgress = {
  id: string;
  project_id: string;
  family_id: string;
  operational_plan_id: string | null;
  plan_activity_id: string | null;
  activity_id: string | null;
  year: number;
  quarter: number | null;
  target_quantity: number;
  progress_quantity: number;
  progress_type: QuarterlyProgressType;
  vegetal_indicator_group: "colinos" | "cacao" | "frutales" | "forestales_nativos" | null;
  observations: string | null;
  is_deleted: boolean;
};

export type MaintenanceProgressType =
  | "deshierbe"
  | "fertilizacion"
  | "poda"
  | "resiembra"
  | "abono_liquido"
  | "abono_solido";

export type MaintenanceProgress = {
  id: string;
  project_id: string;
  family_id: string;
  operational_plan_id: string | null;
  plan_activity_id: string | null;
  activity_id: string | null;
  year: number;
  quarter: number | null;
  maintenance_type: MaintenanceProgressType;
  maintenance_number: number;
  maintenance_date: string | null;
  progress_quantity: number;
  unit: string | null;
  observations: string | null;
  is_deleted: boolean;
};

// ==========================================================================
// Fase 8: Economia Familiar
// ==========================================================================
export type EconomiaCategoria = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type EconomiaProductoCatalogo = {
  id: string;
  categoria_id: string;
  codigo: string;
  nombre: string;
  es_pecuario: boolean;
  unidad_base: string;
  orden: number;
  activo: boolean;
};

export type EconomiaTipoApoyo = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type EconomiaTipoPago = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type EconomiaLugarVenta = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type EconomiaRonda = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
};

export type EconomiaEncuesta = {
  id: string;
  project_id: string;
  family_id: string;
  ronda_id: string;
  equipo_id: string | null;
  encuestador_id: string | null;
  fecha: string;
  anio: number;
  tipo_medicion: "linea_base" | "monitoreo";
  numero_monitoreo: number | null;
  cambio_num_personas: boolean | null;
  personas_ninos: number | null;
  personas_adolescentes: number | null;
  personas_jovenes: number | null;
  personas_adultos: number | null;
  personas_mayores: number | null;
  personas_total: number | null;
  recibe_apoyo_gobierno: boolean | null;
  recibe_otros_pagos: boolean | null;
  valor_jornal: number | null;
  estado: string;
  observaciones: string | null;
  server_version: number;
  revision: number;
  notas_revision: string | null;
  es_piloto: boolean;
  is_deleted: boolean;
};

export type EconomiaEncuestaApoyo = {
  id: string;
  encuesta_id: string;
  project_id: string;
  family_id: string;
  tipo_apoyo_id: string;
  valor_mensual: number | null;
  nombre_libre: string | null;
  is_deleted: boolean;
};

export type EconomiaEncuestaPago = {
  id: string;
  encuesta_id: string;
  project_id: string;
  family_id: string;
  tipo_pago_id: string;
  valor_mensual: number | null;
  is_deleted: boolean;
};

export type EconomiaEncuestaProducto = {
  id: string;
  encuesta_id: string;
  project_id: string;
  family_id: string;
  producto_id: string | null;
  nombre_otro: string | null;
  unidad: string | null;
  es_pecuario: boolean;
  temporalidad: string | null;
  cantidad_producida: number | null;
  consumo: number | null;
  vendido: number | null;
  motivo_no_venta: string | null;
  precio_unitario: number | null;
  ingreso_mensual: number | null;
  ingreso_anual: number | null;
  apoyo_act: boolean | null;
  is_deleted: boolean;
};

export type AuditLog = {
  id: string;
  project_id: string | null;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: "insert" | "update" | "delete" | string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

export type EconomiaProductoLugarVenta = {
  id: string;
  encuesta_producto_id: string;
  project_id: string;
  family_id: string;
  lugar_venta_id: string | null;
  nombre_libre: string | null;
  is_deleted: boolean;
};

export type EconomiaSyncConflicto = {
  id: string; encuesta_id: string; project_id: string; family_id: string;
  expected_version: number; current_version: number | null; estado: string;
  server_payload: Record<string, unknown> | null; client_payload: Record<string, unknown>; created_at: string;
};
