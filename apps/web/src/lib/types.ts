export type Role = {
  id: string;
  name: "admin" | "coordinator" | "technician" | "viewer" | "auditor" | string;
  description: string | null;
  permissions: Record<string, unknown>;
};

export type Profile = {
  id: string;
  auth_user_id: string;
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
  phone: string | null;
  municipality_id: string | null;
  village_id: string | null;
  observations: string | null;
  status: "active" | "inactive" | "retired";
  validation_status: "temporary" | "pending_admin_validation" | "validated" | "rejected";
  is_deleted: boolean;
};

export type Activity = {
  id: string;
  project_id: string | null;
  name: string;
  category: string | null;
  description: string | null;
  unit: string;
  indicator_type: string | null;
  requires_baseline: boolean;
  requires_target: boolean;
  allows_project_materials: boolean;
  allows_counterpart: boolean;
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
