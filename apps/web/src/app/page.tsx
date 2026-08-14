"use client";

import { useEffect, useMemo, useState, useCallback, createContext, useContext, Fragment } from "react";
import {
  AlignmentType,
  BorderStyle,
  Document as WordDocument,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from "docx";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type {
  Activity,
  CounterpartCatalog,
  DeliveryAct,
  Department,
  Family,
  ImplementationProgress,
  ImplementationProgressStatus,
  Material,
  MaterialDelivery,
  MaterialDeliveryItem,
  MaintenanceProgress,
  MaintenanceProgressType,
  Municipality,
  OperationalPlan,
  PlanActivity,
  PlanFamilyCounterpart,
  PlanProjectMaterial,
  Profile,
  Property,
  ProcurementBatch,
  ProcurementBatchItem,
  ProcurementStatus,
  Project,
  ProjectDepartment,
  ProjectMunicipality,
  ProjectUser,
  ProjectVillage,
  ProvisionalMaterial,
  QuarterlyProgress,
  QuarterlyProgressType,
  Role,
  UserMunicipalityAssignment,
  Village,
  EconomiaProductoCatalogo,
  EconomiaTipoApoyo,
  EconomiaTipoPago,
  EconomiaRonda,
  EconomiaEncuesta,
  EconomiaEncuestaApoyo,
  EconomiaEncuestaPago,
  EconomiaEncuestaProducto
} from "@/lib/types";

type ViewKey =
  | "dashboard"
  | "projects"
  | "profiles"
  | "families"
  | "activities"
  | "materials"
  | "counterparts"
  | "plans"
  | "phase5_consolidated"
  | "phase5_etec"
  | "phase5_indicators"
  | "phase5_maintenance"
  | "phase5_acts"
  | "phase8_economia";
type Phase5Tab = "consolidated" | "etec" | "indicators" | "maintenance" | "acts";
type Notice = { type: "info" | "error"; message: string } | null;
type ProjectLogoPosition = "left" | "center" | "right" | "bottom-left" | "bottom-center" | "bottom-right";
type ProjectLogoConfig = { id: string; dataUrl: string; position: ProjectLogoPosition; name: string; size: number };
type Phase5SchemaStatus = { ready: boolean; message: string | null };
type RestorationStrategy = NonNullable<Activity["restoration_strategy"]>;

const PHASE5_MISSING_MIGRATIONS_MESSAGE = "Faltan migraciones de Fase 5 en Supabase. Aplique las migraciones antes de usar este modulo.";
const ETEC_DEFAULT_BLOCKS = ["Ferreteria", "Abonos y Fertilizantes", "Material vegetal", "Otros"];
const COUNTERPART_TYPES: { value: CounterpartCatalog["type"]; label: string }[] = [
  { value: "mano_obra", label: "Mano de obra" },
  { value: "material_propio", label: "Materiales propios" },
  { value: "otro", label: "Otros aportes" }
];
const COUNTERPART_UNITS = ["jornal", "unidad", "kg", "bulto", "metro", "rollo", "paquete", "planta", "arbol", "ha", "hora", "dia"];
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrador",
  admin: "Administrador",
  project_admin: "Administrador de proyecto",
  coordinator: "Coordinador",
  technician: "Técnico",
  municipal_technician: "Técnico municipal",
  auditor: "Auditor"
};

const RESTORATION_STRATEGIES: { value: RestorationStrategy; label: string }[] = [
  { value: "restauracion_ecologica", label: "Restauracion ecologica" },
  { value: "rehabilitacion_ecologica", label: "Rehabilitacion ecologica" },
  { value: "recuperacion_ecologica", label: "Recuperacion ecologica" },
  { value: "no_aplica", label: "No aplica" }
];

const emptyProject = {
  name: "",
  code_prefix: "",
  department: "",
  intervention_zone: "",
  start_date: "",
  end_date: "",
  status: "active"
};

const emptyProfile = {
  auth_user_id: "",
  email: "",
  temporary_password: "",
  project_id: "",
  municipality_ids: [] as string[],
  full_name: "",
  document_number: "",
  phone: "",
  default_role_id: "",
  active: true
};

const emptyFamily = {
  project_id: "",
  family_code: "",
  representative_name: "",
  document_number: "",
  age: "",
  birth_date: "",
  phone: "",
  municipality_id: "",
  village_id: "",
  observations: "",
  status: "active",
  validation_status: "validated"
};

const DefaultDeliveryActIntroText = "De acuerdo con la planificacion predial realizada, donde se identificaron los requerimientos para el establecimiento de las iniciativas de restauracion ecologica que permiten el mejoramiento del predio y el bienestar de la familia, a continuacion, se hace entrega de materiales e insumos concertados entre la familia y el equipo tecnico del proyecto, para dar cumplimiento a las actividades y metas priorizadas en la planificacion predial.";
const DefaultDeliveryActFinalText = "Para constancia de la entrega de los materiales e insumos acordados en el plan predial y descritos en el anterior cuadro, firman las siguientes personas:";

const emptyActivity = {
  project_id: "",
  name: "",
  category: "",
  restoration_strategy: "no_aplica" as RestorationStrategy,
  description: "",
  unit: "",
  indicator_type: "physical",
  requires_baseline: false,
  requires_target: true,
  allows_project_materials: true,
  allows_counterpart: true,
  maintenance_enabled: true,
  maintenance_deshierbe_required: 1,
  maintenance_deshierbe_optional: 0,
  maintenance_fertilization_required: 1,
  maintenance_fertilization_optional: 0,
  maintenance_pruning_required: 1,
  maintenance_pruning_optional: 0,
  maintenance_replanting_optional: 0,
  active: true
};

const emptyMaterial = {
  project_id: "",
  internal_code: "",
  name: "",
  category: "",
  unit: "",
  quoted_unit_price: "",
  price_updated_at: "",
  etec_block: "",
  technical_characteristics: "",
  vegetal_indicator_group: "",
  observations: "",
  active: true
};

const emptyCounterpartCatalog = {
  project_id: "",
  name: "",
  type: "mano_obra" as CounterpartCatalog["type"],
  suggested_unit: "",
  description: "",
  active: true
};



export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoadingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return (
      <main className="login-page">
        <section className="login-box">
          <h1>Configuracion requerida</h1>
          <p>Define las variables de Supabase para iniciar la web administrativa.</p>
          <div className="alert error">
            Faltan `NEXT_PUBLIC_SUPABASE_URL` y/o `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </div>
        </section></main>
    );
  }

  if (loadingSession) {
    return (
      <main className="login-page">
        <section className="login-box">Cargando sesion...</section>
      </main>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <AdminApp session={session} />;
}

function useUnsavedChangesWarning(hasUnsaved: boolean) {
  useEffect(() => {
    if (!hasUnsaved) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsaved]);
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);

    if (isResetMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setNotice({ type: "error", message: error.message });
      } else {
        setNotice({ type: "info", message: "Correo de recuperacion enviado. Revisa tu bandeja de entrada." });
        setIsResetMode(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setNotice({ type: "error", message: error.message });
      } else {
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }
      }
    }
    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-box">
        <img src="/ACT_SQ_ENG_BLACK.png" alt="The Amazon Conservation Team" style={{ display: 'block', margin: '0 auto 16px', maxWidth: '200px' }} />
        <h1>Herramienta de seguimiento de proyectos de restauración y medios de vida</h1>
        <p>Ingreso para administradores, coordinadores, tecnicos, visores y auditores.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Correo
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          {!isResetMode && (
            <label>
              Contrasena
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
              />
            </label>
          )}
          {!isResetMode && (
            <label className="checkbox" style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "normal" }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Recordar mi correo
            </label>
          )}
          <button disabled={loading}>{loading ? "Procesando..." : (isResetMode ? "Enviar correo de recuperacion" : "Ingresar")}</button>
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button
              type="button"
              className="secondary"
              style={{ border: "none", background: "none", padding: 0, textDecoration: "underline", color: "var(--primary)" }}
              onClick={() => { setIsResetMode(!isResetMode); setNotice(null); }}
            >
              {isResetMode ? "Volver a iniciar sesion" : "¿Olvidaste tu contrasena?"}
            </button>
          </div>
          <AlertNotice notice={notice} onClose={() => setNotice(null)} />
        </form>
      </section>
    </main>
  );
}

function AdminApp({ session }: { session: Session }) {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]);
  const [userMunicipalityAssignments, setUserMunicipalityAssignments] = useState<UserMunicipalityAssignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [counterpartCatalog, setCounterpartCatalog] = useState<CounterpartCatalog[]>([]);
  const [plans, setPlans] = useState<OperationalPlan[]>([]);
  const [planActivities, setPlanActivities] = useState<PlanActivity[]>([]);
  const [planMaterials, setPlanMaterials] = useState<PlanProjectMaterial[]>([]);
  const [planCounterparts, setPlanCounterparts] = useState<PlanFamilyCounterpart[]>([]);
  const [provisionalMaterials, setProvisionalMaterials] = useState<ProvisionalMaterial[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [projectDepartments, setProjectDepartments] = useState<ProjectDepartment[]>([]);
  const [projectMunicipalities, setProjectMunicipalities] = useState<ProjectMunicipality[]>([]);
  const [projectVillages, setProjectVillages] = useState<ProjectVillage[]>([]);
  const [procurementBatches, setProcurementBatches] = useState<ProcurementBatch[]>([]);
  const [procurementBatchItems, setProcurementBatchItems] = useState<ProcurementBatchItem[]>([]);
  const [materialDeliveries, setMaterialDeliveries] = useState<MaterialDelivery[]>([]);
  const [materialDeliveryItems, setMaterialDeliveryItems] = useState<MaterialDeliveryItem[]>([]);
  const [deliveryActs, setDeliveryActs] = useState<DeliveryAct[]>([]);
  const [implementationProgress, setImplementationProgress] = useState<ImplementationProgress[]>([]);
  const [quarterlyProgress, setQuarterlyProgress] = useState<QuarterlyProgress[]>([]);
  const [maintenanceProgress, setMaintenanceProgress] = useState<MaintenanceProgress[]>([]);
  const [phase5SchemaStatus, setPhase5SchemaStatus] = useState<Phase5SchemaStatus>({ ready: true, message: null });
  const [maintenanceSchemaStatus, setMaintenanceSchemaStatus] = useState<Phase5SchemaStatus>({ ready: true, message: null });

  const roleNames = useMemo(() => {
    const roleById = new Map(roles.map((role) => [role.id, role.name]));
    const names = new Set<string>();
    if (profile?.default_role_id) {
      const defaultRole = roleById.get(profile.default_role_id);
      if (defaultRole) names.add(defaultRole);
    }
    for (const membership of projectUsers) {
      const roleName = roleById.get(membership.role_id);
      if (roleName) names.add(roleName);
    }
    return names;
  }, [profile, projectUsers, roles]);

  const canWrite = roleNames.has("super_admin") || roleNames.has("admin") || roleNames.has("project_admin") || roleNames.has("coordinator");
  useEffect(() => {
    if (roleNames.has("super_admin")) document.body.classList.add("is-super-admin");
    else document.body.classList.remove("is-super-admin");
    // Borrado de planes operativos habilitado para admin y super_admin.
    if (roleNames.has("super_admin") || roleNames.has("admin")) document.body.classList.add("can-delete-plans");
    else document.body.classList.remove("can-delete-plans");
  }, [roleNames]);

  const canManageProfiles = roleNames.has("super_admin") || roleNames.has("admin") || roleNames.has("project_admin");

  async function loadAll() {
    setLoading(true);
    setNotice(null);
    try {
      const [
        rolesResult,
        profileResult,
        membershipsResult,
        userMunicipalityAssignmentsResult,
        projectsResult,
        profilesResult,
        familiesResult,
        propertiesResult,
        activitiesResult,
        materialsResult,
        counterpartCatalogResult,
        plansResult,
        planActivitiesResult,
        planMaterialsResult,
        planCounterpartsResult,
        provisionalMaterialsResult,
        departmentsResult,
        municipalitiesResult,
        villagesResult,
        projectDepartmentsResult,
        projectMunicipalitiesResult,
        projectVillagesResult,
        procurementBatchesResult,
        procurementBatchItemsResult,
        materialDeliveriesResult,
        materialDeliveryItemsResult,
        deliveryActsResult,
        implementationProgressResult,
        quarterlyProgressResult,
        maintenanceProgressResult
      ] = await Promise.all([
        supabase.from("roles").select("id,name,description,permissions").order("name"),
        supabase.from("users_profiles").select("*").eq("auth_user_id", session.user.id).maybeSingle(),
        supabase.from("project_users").select("*").order("created_at", { ascending: false }),
        supabase.from("user_municipality_assignments").select("*").eq("is_deleted", false),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("users_profiles").select("*").order("full_name"),
        supabase.from("families").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("properties").select("*").eq("is_deleted", false),
        supabase.from("activity_catalog").select("*").order("name"),
        supabase.from("material_catalog").select("*").order("name"),
        supabase.from("counterpart_catalog").select("*").order("name"),
        supabase.from("operational_plans").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("plan_activities").select("*").eq("is_deleted", false),
        supabase.from("plan_project_materials").select("*").eq("is_deleted", false),
        supabase.from("plan_family_counterparts").select("*").eq("is_deleted", false),
        supabase.from("provisional_materials").select("*").eq("is_deleted", false),
        supabase.from("departments").select("*").order("name"),
        supabase.from("municipalities").select("*").order("name"),
        supabase.from("villages").select("*").order("name"),
        supabase.from("project_departments").select("*").eq("is_deleted", false),
        supabase.from("project_municipalities").select("*").eq("is_deleted", false),
        supabase.from("project_villages").select("*").eq("is_deleted", false),
        supabase.from("procurement_batches").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("procurement_batch_items").select("*").eq("is_deleted", false),
        supabase.from("material_deliveries").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("material_delivery_items").select("*").eq("is_deleted", false),
        supabase.from("delivery_acts").select("*").eq("is_deleted", false).order("generated_at", { ascending: false }),
        supabase.from("implementation_progress").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("quarterly_progress").select("*").eq("is_deleted", false),
        supabase.from("maintenance_progress").select("*").eq("is_deleted", false)
      ]);

      const error = [
        rolesResult.error,
        profileResult.error,
        membershipsResult.error,
        userMunicipalityAssignmentsResult.error && !isMissingTableError(userMunicipalityAssignmentsResult.error) ? userMunicipalityAssignmentsResult.error : null,
        projectsResult.error,
        profilesResult.error,
        familiesResult.error,
        propertiesResult.error,
        activitiesResult.error,
        materialsResult.error,
        counterpartCatalogResult.error,
        plansResult.error,
        planActivitiesResult.error,
        planMaterialsResult.error,
        planCounterpartsResult.error,
        provisionalMaterialsResult.error,
        departmentsResult.error,
        municipalitiesResult.error,
        villagesResult.error,
        projectDepartmentsResult.error,
        projectMunicipalitiesResult.error,
        projectVillagesResult.error
      ].find(Boolean);

      if (error) throw error;

      const phase5Results = [
        { table: "procurement_batches", error: procurementBatchesResult.error },
        { table: "procurement_batch_items", error: procurementBatchItemsResult.error },
        { table: "material_deliveries", error: materialDeliveriesResult.error },
        { table: "material_delivery_items", error: materialDeliveryItemsResult.error },
        { table: "delivery_acts", error: deliveryActsResult.error },
        { table: "implementation_progress", error: implementationProgressResult.error },
        { table: "quarterly_progress", error: quarterlyProgressResult.error }
      ];
      const missingTables = phase5Results
        .filter((result) => result.error && isMissingTableError(result.error))
        .map((result) => result.table);
      const phase5Error = phase5Results.find((result) => result.error);

      if (missingTables.length > 0) {
        setPhase5SchemaStatus({
          ready: false,
          message: `${PHASE5_MISSING_MIGRATIONS_MESSAGE} Tablas faltantes: ${missingTables.join(", ")}.`
        });
      } else if (phase5Error?.error) {
        setPhase5SchemaStatus({
          ready: false,
          message: `No fue posible consultar tablas de Fase 5: ${getErrorMessage(phase5Error.error)}`
        });
      } else {
        setPhase5SchemaStatus({ ready: true, message: null });
      }

      if (maintenanceProgressResult.error && isMissingTableError(maintenanceProgressResult.error)) {
        setMaintenanceSchemaStatus({
          ready: false,
          message: "Falta la migracion de Herramienta de Mantenimiento en Supabase. Aplique 20260622190000_phase7_maintenance_tool.sql antes de usar esta seccion."
        });
      } else if (maintenanceProgressResult.error) {
        setMaintenanceSchemaStatus({
          ready: false,
          message: `No fue posible consultar mantenimiento: ${getErrorMessage(maintenanceProgressResult.error)}`
        });
      } else {
        setMaintenanceSchemaStatus({ ready: true, message: null });
      }

      setRoles((rolesResult.data ?? []) as Role[]);
      setProfile((profileResult.data as Profile | null) ?? null);
      setProjectUsers((membershipsResult.data ?? []) as ProjectUser[]);
      setUserMunicipalityAssignments(userMunicipalityAssignmentsResult.error ? [] : (userMunicipalityAssignmentsResult.data ?? []) as UserMunicipalityAssignment[]);
      setProjects((projectsResult.data ?? []) as Project[]);
      setProfiles((profilesResult.data ?? []) as Profile[]);
      setFamilies((familiesResult.data ?? []) as Family[]);
      setProperties((propertiesResult.data ?? []) as Property[]);
      setActivities((activitiesResult.data ?? []) as Activity[]);
      setMaterials((materialsResult.data ?? []) as Material[]);
      setCounterpartCatalog((counterpartCatalogResult.data ?? []) as CounterpartCatalog[]);
      setPlans((plansResult.data ?? []) as OperationalPlan[]);
      setPlanActivities((planActivitiesResult.data ?? []) as PlanActivity[]);
      setPlanMaterials((planMaterialsResult.data ?? []) as PlanProjectMaterial[]);
      setPlanCounterparts((planCounterpartsResult.data ?? []) as PlanFamilyCounterpart[]);
      setProvisionalMaterials((provisionalMaterialsResult.data ?? []) as ProvisionalMaterial[]);
      setDepartments((departmentsResult.data ?? []) as Department[]);
      setMunicipalities((municipalitiesResult.data ?? []) as Municipality[]);
      setVillages((villagesResult.data ?? []) as Village[]);
      setProjectDepartments((projectDepartmentsResult.data ?? []) as ProjectDepartment[]);
      setProjectMunicipalities((projectMunicipalitiesResult.data ?? []) as ProjectMunicipality[]);
      setProjectVillages((projectVillagesResult.data ?? []) as ProjectVillage[]);
      setProcurementBatches((procurementBatchesResult.data ?? []) as ProcurementBatch[]);
      setProcurementBatchItems((procurementBatchItemsResult.data ?? []) as ProcurementBatchItem[]);
      setMaterialDeliveries((materialDeliveriesResult.data ?? []) as MaterialDelivery[]);
      setMaterialDeliveryItems((materialDeliveryItemsResult.data ?? []) as MaterialDeliveryItem[]);
      setDeliveryActs((deliveryActsResult.data ?? []) as DeliveryAct[]);
      setImplementationProgress((implementationProgressResult.data ?? []) as ImplementationProgress[]);
      setQuarterlyProgress((quarterlyProgressResult.data ?? []) as QuarterlyProgress[]);
      setMaintenanceProgress(maintenanceProgressResult.error ? [] : (maintenanceProgressResult.data ?? []) as MaintenanceProgress[]);
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  const [globalProjectId, setGlobalProjectId] = useState("");
  useEffect(() => {
    const stored = window.localStorage.getItem("global_project_filter");
    if (stored) setGlobalProjectId(stored);
  }, []);
  function changeGlobalProject(value: string) {
    setGlobalProjectId(value);
    window.localStorage.setItem("global_project_filter", value);
  }

  // Filtro global de proyecto: se filtra una sola vez aqui y todas las secciones reciben datos ya acotados
  const scoped = useMemo(() => {
    if (!globalProjectId || !projects.some((project) => project.id === globalProjectId)) {
      return {
        projects, families, properties, activities, materials, plans, planActivities, planMaterials,
        planCounterparts, provisionalMaterials, procurementBatches, procurementBatchItems,
        materialDeliveries, materialDeliveryItems, deliveryActs, implementationProgress,
        quarterlyProgress, maintenanceProgress
      };
    }
    const scopedFamilies = families.filter((item) => item.project_id === globalProjectId);
    const familyIds = new Set(scopedFamilies.map((item) => item.id));
    const scopedPlans = plans.filter((item) => item.project_id === globalProjectId);
    const planIds = new Set(scopedPlans.map((item) => item.id));
    const scopedPlanActivities = planActivities.filter((item) => planIds.has(item.plan_id));
    const planActivityIds = new Set(scopedPlanActivities.map((item) => item.id));
    const scopedBatches = procurementBatches.filter((item) => item.project_id === globalProjectId);
    const batchIds = new Set(scopedBatches.map((item) => item.id));
    const scopedDeliveries = materialDeliveries.filter((item) => item.project_id === globalProjectId);
    const deliveryIds = new Set(scopedDeliveries.map((item) => item.id));
    return {
      projects: projects.filter((item) => item.id === globalProjectId),
      families: scopedFamilies,
      properties: properties.filter((item) => familyIds.has(item.family_id)),
      // Los catalogos son datos de referencia: no se filtran para no romper los cruces
      // cuando el catalogo quedo registrado bajo otro proyecto
      activities,
      materials,
      plans: scopedPlans,
      planActivities: scopedPlanActivities,
      planMaterials: planMaterials.filter((item) => planActivityIds.has(item.plan_activity_id)),
      planCounterparts: planCounterparts.filter((item) => planActivityIds.has(item.plan_activity_id)),
      provisionalMaterials: provisionalMaterials.filter((item) => item.project_id === globalProjectId),
      procurementBatches: scopedBatches,
      procurementBatchItems: procurementBatchItems.filter((item) => batchIds.has(item.procurement_batch_id)),
      materialDeliveries: scopedDeliveries,
      materialDeliveryItems: materialDeliveryItems.filter((item) => deliveryIds.has(item.material_delivery_id)),
      deliveryActs: deliveryActs.filter((item) => item.project_id === globalProjectId),
      implementationProgress: implementationProgress.filter((item) => item.project_id === globalProjectId),
      quarterlyProgress: quarterlyProgress.filter((item) => item.project_id === globalProjectId),
      maintenanceProgress: maintenanceProgress.filter((item) => item.project_id === globalProjectId)
    };
  }, [globalProjectId, projects, families, properties, activities, materials, plans, planActivities, planMaterials, planCounterparts, provisionalMaterials, procurementBatches, procurementBatchItems, materialDeliveries, materialDeliveryItems, deliveryActs, implementationProgress, quarterlyProgress, maintenanceProgress]);

  const views: { key: ViewKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "projects", label: "Proyectos" },
    { key: "profiles", label: "Usuarios" },
    { key: "families", label: "Familias" },
    { key: "activities", label: "Actividades" },
    { key: "materials", label: "Materiales" },
    { key: "counterparts", label: "Contrapartidas" },
    { key: "plans", label: "Planes Operativos" },
    { key: "phase5_consolidated", label: "Consolidado de materiales" },
    { key: "phase5_etec", label: "ETEC" },
    { key: "phase5_indicators", label: "Herramienta de indicadores" },
    { key: "phase5_maintenance", label: "Herramienta de mantenimiento" },
    { key: "phase5_acts", label: "Actas de entrega" },
    { key: "phase8_economia", label: "Economía Familiar" }
  ];
  const selectedPhase5Tab = phase5TabFromView(view);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ background: 'rgba(255,255,255,0.85)', padding: '8px', borderRadius: '8px', margin: '0 auto 24px', width: 'fit-content' }}>
          <img src="/ACT_SQ_ENG_BLACK.png" alt="The Amazon Conservation Team" style={{ display: 'block', maxWidth: '100px', height: 'auto' }} />
        </div>
        <nav className="nav-list">
          {views.map((item) => (
            <button
              className={`nav-button ${view === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => setView(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-user">
            <strong>{profile?.full_name ?? session.user.email}</strong>
            <div className="muted">
              {[...roleNames].map((name) => ROLE_LABELS[name] ?? name).join(", ") || "Sin perfil/rol asignado"}
            </div>
          </div>
          <div className="topbar-title">
            Herramienta de seguimiento de proyectos de restauración y medios de vida
          </div>
          <label className={`topbar-project ${globalProjectId ? "active" : ""}`}>
            Proyecto
            <select value={globalProjectId} onChange={(event) => changeGlobalProject(event.target.value)}>
              <option value="">Todos los proyectos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="secondary" onClick={loadAll} type="button" disabled={loading}>
              {loading ? "Cargando..." : "Actualizar"}
            </button>
            <button className="secondary" onClick={signOut} type="button">
              Salir
            </button>
          </div>
        </header>
        
          <section className="content">
          <AlertNotice notice={notice} onClose={() => setNotice(null)} />
          {!profile ? (
            <div className="alert info">
              No existe perfil para este usuario. Un administrador debe crear un registro en usuarios/perfiles.
            </div>
          ) : null}
          {view === "dashboard" ? (
            <Dashboard
              projects={scoped.projects}
              profiles={profiles}
              families={scoped.families}
              properties={scoped.properties}
              municipalities={municipalities}
              villages={villages}
              activities={scoped.activities}
              materials={scoped.materials}
              plans={scoped.plans}
              planActivities={scoped.planActivities}
              planMaterials={scoped.planMaterials}
              quarterlyProgress={scoped.quarterlyProgress}
              maintenanceProgress={scoped.maintenanceProgress}
            />
          ) : null}
          {view === "projects" ? (
            <ProjectsCrud
              projects={projects}
              canWrite={canWrite}
              currentProfile={profile}
              adminRoleId={roles.find((role) => role.name === "admin")?.id ?? null}
              departments={departments}
              municipalities={municipalities}
              villages={villages}
              projectDepartments={projectDepartments}
              projectMunicipalities={projectMunicipalities}
              projectVillages={projectVillages}
              onChange={loadAll}
            />
          ) : null}
          {view === "profiles" ? (
            <ProfilesCrud
              profiles={profiles}
              roles={roles}
              projects={projects}
              projectUsers={projectUsers}
              municipalities={municipalities}
              projectMunicipalities={projectMunicipalities}
              userMunicipalityAssignments={userMunicipalityAssignments}
              canWrite={canManageProfiles}
              onChange={loadAll}
            />
          ) : null}
          {view === "families" ? (
            <FamiliesCrud
              families={scoped.families}
              properties={scoped.properties}
              projects={scoped.projects}
              projectMunicipalities={projectMunicipalities}
              projectVillages={projectVillages}
              municipalities={municipalities}
              villages={villages}
              departments={departments}
              canWrite={canWrite}
              onChange={loadAll}
            />
          ) : null}
          {view === "activities" ? (
            <ActivitiesCrud activities={activities} projects={projects} canWrite={canWrite} onChange={loadAll} />
          ) : null}
          {view === "materials" ? (
            <MaterialsCrud materials={materials} projects={projects} canWrite={canWrite} onChange={loadAll} />
          ) : null}
          {view === "counterparts" ? (
            <CounterpartCatalogCrud items={counterpartCatalog} projects={projects} canWrite={canWrite} onChange={loadAll} />
          ) : null}
          {view === "plans" ? (
            <PlansAdmin
              plans={scoped.plans}
              projects={scoped.projects}
              families={scoped.families}
              municipalities={municipalities}
              villages={villages}
              activities={scoped.activities}
              materials={scoped.materials}
              planActivities={scoped.planActivities}
              planMaterials={scoped.planMaterials}
              planCounterparts={scoped.planCounterparts}
              provisionalMaterials={scoped.provisionalMaterials}
              canReview={canWrite}
              canManageLogos={roleNames.has("admin") || roleNames.has("super_admin") || roleNames.has("project_admin") || roleNames.has("coordinator")}
              currentProfile={profile}
              onChange={loadAll}
            />
          ) : null}
          {selectedPhase5Tab ? (
            <ProcurementDeliveriesActs
              initialTab={selectedPhase5Tab}
              projects={scoped.projects}
              families={scoped.families}
              properties={scoped.properties}
              municipalities={municipalities}
              villages={villages}
              activities={scoped.activities}
              materials={scoped.materials}
              plans={scoped.plans}
              planActivities={scoped.planActivities}
              planMaterials={scoped.planMaterials}
              provisionalMaterials={scoped.provisionalMaterials}
              procurementBatches={scoped.procurementBatches}
              procurementBatchItems={scoped.procurementBatchItems}
              materialDeliveries={scoped.materialDeliveries}
              materialDeliveryItems={scoped.materialDeliveryItems}
              deliveryActs={scoped.deliveryActs}
              implementationProgress={scoped.implementationProgress}
              quarterlyProgress={scoped.quarterlyProgress}
              maintenanceProgress={scoped.maintenanceProgress}
              phase5SchemaStatus={phase5SchemaStatus}
              maintenanceSchemaStatus={maintenanceSchemaStatus}
              currentProfile={profile}
              canManageProcurement={canWrite}
              canAdminOverride={roleNames.has("admin")}
              canGenerateActs={canWrite}
              canEditImplementation={canWrite || roleNames.has("technician")}
              onChange={loadAll}
            />
          ) : null}
          {view === "phase8_economia" ? (
            <EconomiaAnalytics
              projects={scoped.projects}
              families={scoped.families}
              municipalities={municipalities}
              villages={villages}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Dashboard({
  projects,
  profiles,
  families,
  properties,
  municipalities,
  villages,
  activities,
  materials,
  plans,
  planActivities,
  planMaterials,
  quarterlyProgress,
  maintenanceProgress
}: {
  projects: Project[];
  profiles: Profile[];
  families: Family[];
  properties: Property[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  quarterlyProgress: QuarterlyProgress[];
  maintenanceProgress: MaintenanceProgress[];
}) {
  const currentYear = new Date().getFullYear();
  const [dashboardYear, setDashboardYear] = useState(currentYear);
  const [dashboardQuarters, setDashboardQuarters] = useState<number[]>([1, 2, 3, 4]);

  const indicatorGroups = buildDashboardChartGroups({
    activities, materials, plans, planActivities, planMaterials, quarterlyProgress,
    year: dashboardYear,
    quarters: dashboardQuarters
  });
  const maintenanceMatrix = buildMaintenanceMatrix({
    projects, families, properties, municipalities, villages, activities, plans, planActivities, planMaterials, maintenanceProgress,
    filters: { project_id: "", municipality_id: "", village_id: "", family_id: "", activity_id: "", material_id: "" },
    year: dashboardYear,
    visibleQuarters: dashboardQuarters
  });
  const maintenanceSummary = buildDashboardMaintenanceSummary(maintenanceMatrix, dashboardQuarters);
  const organicSummary = buildDashboardOrganicSummary(maintenanceMatrix, dashboardQuarters);
  const maintenanceTaskLabel = (task: MaintenanceTaskColumn) => `${MAINTENANCE_TASK_LABELS[task.type]} ${task.number}`;
  const maintenanceTaskCount = (row: DashboardMaintenanceSummaryRow, task: MaintenanceTaskColumn) =>
    row.taskCounts[`${task.type}|${task.number}`];

  const maintenanceChartGroup: DashboardChartGroup = {
    key: "mantenimiento",
    title: "Mantenimiento por actividad (familias)",
    sheetName: "Mantenimiento",
    categoryHeader: "Indicador",
    categories: maintenanceSummary.rows.map((row) => `${row.activityName} (${row.unit})`),
    series: [
      { name: "Familias", values: maintenanceSummary.rows.map((row) => row.familyCount) },
      { name: "Ciclo completo", values: maintenanceSummary.rows.map((row) => row.familiesComplete) },
      { name: "Sin cierre de ciclo", values: maintenanceSummary.rows.map((row) => row.familiesIncomplete) }
    ],
    extraColumns: [
      { name: "Area total mantenimiento", values: maintenanceSummary.rows.map((row) => row.areaTotal) },
      { name: "Ciclo completo (area)", values: maintenanceSummary.rows.map((row) => row.areaComplete) },
      { name: "Sin cierre (area)", values: maintenanceSummary.rows.map((row) => row.areaIncomplete) },
      ...maintenanceSummary.taskColumns.map((task) => ({
        name: maintenanceTaskLabel(task),
        values: maintenanceSummary.rows.map((row) => maintenanceTaskCount(row, task) ?? "N/A")
      }))
    ],
    totalsRow: [
      "TOTAL",
      maintenanceSummary.totals.familyCount,
      maintenanceSummary.totals.familiesComplete,
      maintenanceSummary.totals.familiesIncomplete,
      maintenanceSummary.totals.areaTotal,
      maintenanceSummary.totals.areaComplete,
      maintenanceSummary.totals.areaIncomplete,
      ...maintenanceSummary.taskColumns.map((task) => maintenanceSummary.totals.taskCounts[`${task.type}|${task.number}`] ?? 0)
    ]
  };
  const organicChartGroup: DashboardChartGroup = {
    key: "abonos",
    title: "Produccion de abonos organicos",
    sheetName: "Abonos organicos",
    categoryHeader: "Abono",
    categories: ["Abono solido (kg)", "Abono liquido (litros)"],
    series: [
      { name: "Familias", values: [organicSummary.solidFamilies, organicSummary.liquidFamilies] },
      { name: "Cantidad producida", values: [organicSummary.solidQuantity, organicSummary.liquidQuantity] }
    ]
  };
  const exportGroups = [...indicatorGroups, maintenanceChartGroup, organicChartGroup];
  const hasChartData = exportGroups.some((group) => group.categories.length > 0);

  return (
    <section className="section">
      <div className="toolbar">
        <h2>Dashboard</h2>
        <button className="secondary" disabled={!hasChartData} type="button" onClick={() => void exportDashboardChartsExcel(exportGroups)}>
          Exportar dashboard Excel
        </button>
      </div>
      <div className="summary-grid">
        <Metric label="Proyectos" value={projects.length} />
        <Metric label="Usuarios" value={profiles.length} />
        <Metric label="Familias" value={families.length} />
        <Metric label="Actividades" value={activities.length} />
        <Metric label="Materiales" value={materials.length} />
      </div>
      <div className="panel grid compact-panel">
        <label className="span-2">
          Año
          <input type="number" min="2020" max="2100" value={dashboardYear} onChange={(event) => setDashboardYear(Number(event.target.value || currentYear))} />
        </label>
        <div className="span-6">
          <span className="control-label">Trimestres</span>
          <QuarterSelector selected={dashboardQuarters} onChange={setDashboardQuarters} />
        </div>
        <p className="span-12 muted">
          Las metas son totales de los planes aprobados; los avances, entregas, siembras, mantenimientos y abonos corresponden al año y trimestres seleccionados.
        </p>
      </div>
      {indicatorGroups.map((group) => (
        <div className="panel" key={group.key}>
          <h3>{group.title}</h3>
          {group.categories.length === 0 ? (
            <p className="muted">Sin actividades o indicadores para esta categoria.</p>
          ) : (
            <DashboardBarChart categories={group.categories} series={group.series} />
          )}
        </div>
      ))}
      <div className="panel table-panel">
        <h3>Mantenimiento por actividad</h3>
        {maintenanceSummary.rows.length === 0 ? (
          <p className="muted">Sin actividades de mantenimiento para el año seleccionado.</p>
        ) : (
          <DataTable
            embedded
            headers={[
              "Indicador",
              "# de Familias",
              "Area total mantenimiento",
              "Ciclo completo",
              "Sin cierre de ciclo completo",
              ...maintenanceSummary.taskColumns.map(maintenanceTaskLabel)
            ]}
            emptyMessage=""
            rows={[
              ...maintenanceSummary.rows.map((row) => [
                `${row.activityName} (${row.unit})`,
                row.familyCount,
                formatNumber(row.areaTotal),
                formatNumber(row.areaComplete),
                formatNumber(row.areaIncomplete),
                ...maintenanceSummary.taskColumns.map((task) => {
                  const count = maintenanceTaskCount(row, task);
                  return count === null ? "N/A" : count;
                })
              ] as React.ReactNode[]),
              [
                <strong key="label">TOTAL</strong>,
                <strong key="fam">{maintenanceSummary.totals.familyCount}</strong>,
                <strong key="area">{formatNumber(maintenanceSummary.totals.areaTotal)}</strong>,
                <strong key="complete">{formatNumber(maintenanceSummary.totals.areaComplete)}</strong>,
                <strong key="incomplete">{formatNumber(maintenanceSummary.totals.areaIncomplete)}</strong>,
                ...maintenanceSummary.taskColumns.map((task) => (
                  <strong key={`${task.type}-${task.number}`}>{maintenanceSummary.totals.taskCounts[`${task.type}|${task.number}`] ?? 0}</strong>
                ))
              ] as React.ReactNode[]
            ]}
          />
        )}
      </div>
      <div className="panel">
        <h3>Mantenimiento por actividad (familias)</h3>
        {maintenanceSummary.rows.length === 0 ? (
          <p className="muted">Sin actividades de mantenimiento para el año seleccionado.</p>
        ) : (
          <DashboardBarChart categories={maintenanceChartGroup.categories} series={maintenanceChartGroup.series} />
        )}
      </div>
      <div className="panel">
        <h3>Produccion de abonos organicos</h3>
        <DashboardBarChart categories={organicChartGroup.categories} series={organicChartGroup.series} />
      </div>
    </section>
  );
}

const DASHBOARD_CHART_COLORS = ["#4472c4", "#ed7d31", "#a5a5a5"];

type DashboardChartSeriesDef = { name: string; values: number[] };

type DashboardChartGroup = {
  key: string;
  title: string;
  sheetName: string;
  categoryHeader: string;
  categories: string[];
  series: DashboardChartSeriesDef[];
  extraColumns?: { name: string; values: (number | string)[] }[];
  totalsRow?: (number | string)[];
};

type DashboardMaintenanceSummaryRow = {
  key: string;
  activityName: string;
  unit: string;
  familyCount: number;
  areaTotal: number;
  areaComplete: number;
  areaIncomplete: number;
  familiesComplete: number;
  familiesIncomplete: number;
  taskCounts: Record<string, number | null>;
};

function buildDashboardMaintenanceSummary(matrix: MaintenanceMatrix, quarters: number[]) {
  const dateInQuarters = (date: string | null | undefined) => {
    if (!date) return false;
    const month = Number(date.slice(5, 7));
    if (!Number.isFinite(month) || month < 1 || month > 12) return false;
    return quarters.includes(Math.ceil(month / 3));
  };
  const taskKey = (task: MaintenanceTaskColumn) => `${task.type}|${task.number}`;
  const typeOrder: MaintenanceTaskType[] = ["deshierbe", "fertilizacion", "poda", "resiembra"];
  const unionMap = new Map<string, MaintenanceTaskColumn>();
  for (const group of matrix.groups) {
    for (const task of group.tasks) {
      if (!unionMap.has(taskKey(task))) unionMap.set(taskKey(task), task);
    }
  }
  const taskColumns = Array.from(unionMap.values()).sort((left, right) =>
    typeOrder.indexOf(left.type) - typeOrder.indexOf(right.type) || left.number - right.number
  );

  const rows: DashboardMaintenanceSummaryRow[] = matrix.groups.map((group) => {
    const groupTaskKeys = new Set(group.tasks.map(taskKey));
    const taskCounts: Record<string, number | null> = {};
    for (const task of taskColumns) taskCounts[taskKey(task)] = groupTaskKeys.has(taskKey(task)) ? 0 : null;
    let familyCount = 0;
    let areaTotal = 0;
    let areaComplete = 0;
    let familiesComplete = 0;
    const requiredTasks = group.tasks.filter((task) => task.required);
    for (const row of matrix.rows) {
      const cell = row.activities[group.key];
      if (!cell) continue;
      familyCount += 1;
      areaTotal += cell.targetQuantity;
      let complete = requiredTasks.length > 0;
      for (const task of group.tasks) {
        const progress = cell.progress[maintenanceProgressKey(task.type, task.number, null)];
        const done = dateInQuarters(progress?.maintenance_date);
        if (done) taskCounts[taskKey(task)] = (taskCounts[taskKey(task)] ?? 0) + 1;
        if (task.required && !done) complete = false;
      }
      if (complete) {
        familiesComplete += 1;
        areaComplete += cell.targetQuantity;
      }
    }
    return {
      key: group.key,
      activityName: group.activityName,
      unit: group.unit,
      familyCount,
      areaTotal,
      areaComplete,
      areaIncomplete: areaTotal - areaComplete,
      familiesComplete,
      familiesIncomplete: familyCount - familiesComplete,
      taskCounts
    };
  });

  const totals = {
    familyCount: rows.reduce((sum, row) => sum + row.familyCount, 0),
    areaTotal: rows.reduce((sum, row) => sum + row.areaTotal, 0),
    areaComplete: rows.reduce((sum, row) => sum + row.areaComplete, 0),
    areaIncomplete: rows.reduce((sum, row) => sum + row.areaIncomplete, 0),
    familiesComplete: rows.reduce((sum, row) => sum + row.familiesComplete, 0),
    familiesIncomplete: rows.reduce((sum, row) => sum + row.familiesIncomplete, 0),
    taskCounts: Object.fromEntries(taskColumns.map((task) => [
      taskKey(task),
      rows.reduce((sum, row) => sum + (row.taskCounts[taskKey(task)] ?? 0), 0)
    ]))
  };
  return { taskColumns, rows, totals };
}

function buildDashboardOrganicSummary(matrix: MaintenanceMatrix, quarters: number[]) {
  let solidFamilies = 0;
  let solidQuantity = 0;
  let liquidFamilies = 0;
  let liquidQuantity = 0;
  for (const row of matrix.rows) {
    const solid = maintenanceOrganicAccumulated(row, "abono_solido", quarters);
    const liquid = maintenanceOrganicAccumulated(row, "abono_liquido", quarters);
    if (solid > 0) {
      solidFamilies += 1;
      solidQuantity += solid;
    }
    if (liquid > 0) {
      liquidFamilies += 1;
      liquidQuantity += liquid;
    }
  }
  return { solidFamilies, solidQuantity, liquidFamilies, liquidQuantity };
}

function buildDashboardChartGroups(data: {
  activities: Activity[];
  materials: Material[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  quarterlyProgress: QuarterlyProgress[];
  year: number;
  quarters: number[];
}): DashboardChartGroup[] {
  const groups: DashboardChartGroup[] = [];

  const materialById = new Map(data.materials.map((item) => [item.id, item]));
  const approvedPlanIds = new Set(
    data.plans.filter((plan) => !plan.is_deleted && isApprovedPlanStatus(plan.status)).map((plan) => plan.id)
  );
  const approvedPlanActivityIds = new Set(
    data.planActivities.filter((item) => !item.is_deleted && approvedPlanIds.has(item.plan_id)).map((item) => item.id)
  );
  const vegetalTotals = new Map<VegetalIndicatorGroup, { meta: number; entregado: number; sembrado: number }>();
  const vegetalEntry = (group: VegetalIndicatorGroup) => {
    const entry = vegetalTotals.get(group) ?? { meta: 0, entregado: 0, sembrado: 0 };
    vegetalTotals.set(group, entry);
    return entry;
  };
  for (const planMaterial of data.planMaterials) {
    if (planMaterial.is_deleted || !planMaterial.material_id) continue;
    if (!approvedPlanActivityIds.has(planMaterial.plan_activity_id)) continue;
    const group = materialById.get(planMaterial.material_id)?.vegetal_indicator_group;
    if (!isTrackableVegetalGroup(group)) continue;
    vegetalEntry(group).meta += Number(planMaterial.quantity ?? 0);
  }
  for (const progress of data.quarterlyProgress) {
    if (progress.is_deleted || progress.year !== data.year) continue;
    if (progress.quarter != null && !data.quarters.includes(progress.quarter)) continue;
    if (progress.progress_type !== "vegetal_entrega" && progress.progress_type !== "vegetal_siembra") continue;
    const group = progress.vegetal_indicator_group;
    if (!isTrackableVegetalGroup(group)) continue;
    if (progress.progress_type === "vegetal_entrega") vegetalEntry(group).entregado += Number(progress.progress_quantity ?? 0);
    else vegetalEntry(group).sembrado += Number(progress.progress_quantity ?? 0);
  }
  const vegetalRows = VEGETAL_INDICATOR_GROUPS.filter((group) => vegetalTotals.has(group.key));
  groups.push({
    key: "vegetal",
    title: "Material vegetal",
    sheetName: "Material vegetal",
    categoryHeader: "Indicador",
    categories: vegetalRows.map((group) => `${group.label} (${group.unit})`),
    series: [
      { name: "Meta", values: vegetalRows.map((group) => vegetalTotals.get(group.key)?.meta ?? 0) },
      { name: "Entregado", values: vegetalRows.map((group) => vegetalTotals.get(group.key)?.entregado ?? 0) },
      { name: "Sembrado", values: vegetalRows.map((group) => vegetalTotals.get(group.key)?.sembrado ?? 0) }
    ]
  });

  const summaryRows = buildRestorationStrategySummary({ ...data, progressYear: data.year, progressQuarters: data.quarters });
  for (const strategy of RESTORATION_STRATEGIES) {
    const rows = summaryRows.filter((row) => row.strategy === strategy.value);
    groups.push({
      key: strategy.value,
      title: strategy.label,
      sheetName: strategy.label,
      categoryHeader: "Actividad",
      categories: rows.map((row) => `${row.activityName} (${row.unit})`),
      series: [
        { name: "Meta", values: rows.map((row) => row.targetTotal) },
        { name: "Implementado", values: rows.map((row) => row.advanceTotal) }
      ]
    });
  }
  return groups;
}

function wrapChartLabel(label: string, maxChars = 16): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function DashboardBarChart({ categories, series }: { categories: string[]; series: DashboardChartSeriesDef[] }) {
  const topPad = 22;
  const chartHeight = 220;
  const labelHeight = 48;
  const barWidth = 30;
  const groupWidth = Math.max(120, series.length * (barWidth + 6) + 40);
  const width = categories.length * groupWidth + 20;
  const height = topPad + chartHeight + labelHeight;
  const maxValue = Math.max(1, ...series.flatMap((serie) => serie.values));
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={height} role="img">
        {categories.map((category, catIndex) => {
          const groupX = 10 + catIndex * groupWidth;
          const barsWidth = series.length * (barWidth + 6) - 6;
          const startX = groupX + (groupWidth - barsWidth) / 2;
          return (
            <g key={category}>
              {series.map((serie, serieIndex) => {
                const value = serie.values[catIndex] ?? 0;
                const barHeight = Math.round(value / maxValue * chartHeight);
                const x = startX + serieIndex * (barWidth + 6);
                const y = topPad + chartHeight - barHeight;
                return (
                  <g key={serie.name}>
                    <rect x={x} y={y} width={barWidth} height={barHeight} fill={DASHBOARD_CHART_COLORS[serieIndex] ?? "#999999"} />
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="bold">{formatNumber(value)}</text>
                  </g>
                );
              })}
              {wrapChartLabel(category).map((line, lineIndex) => (
                <text key={lineIndex} x={groupX + groupWidth / 2} y={topPad + chartHeight + 14 + lineIndex * 12} textAnchor="middle" fontSize="10">{line}</text>
              ))}
            </g>
          );
        })}
        <line x1={0} y1={topPad + chartHeight} x2={width} y2={topPad + chartHeight} stroke="#c5cec7" />
      </svg>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        {series.map((serie, index) => (
          <span key={serie.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, background: DASHBOARD_CHART_COLORS[index] ?? "#999999", display: "inline-block" }} />
            {serie.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function buildRestorationStrategySummary(data: {
  activities: Activity[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  quarterlyProgress: QuarterlyProgress[];
  progressYear?: number;
  progressQuarters?: number[];
}) {
  const activityById = new Map(data.activities.map((activity) => [activity.id, activity]));
  const approvedPlanById = new Map(
    data.plans
      .filter((plan) => !plan.is_deleted && isApprovedPlanStatus(plan.status))
      .map((plan) => [plan.id, plan])
  );
  const advanceByPlanActivity = new Map<string, number>();
  for (const progress of data.quarterlyProgress) {
    if (progress.is_deleted || progress.progress_type !== "avance" || !progress.plan_activity_id) continue;
    if (data.progressYear !== undefined && progress.year !== data.progressYear) continue;
    if (data.progressQuarters && progress.quarter != null && !data.progressQuarters.includes(progress.quarter)) continue;
    advanceByPlanActivity.set(
      progress.plan_activity_id,
      (advanceByPlanActivity.get(progress.plan_activity_id) ?? 0) + Number(progress.progress_quantity ?? 0)
    );
  }

  const rows = new Map<string, {
    key: string;
    strategy: RestorationStrategy;
    activityName: string;
    unit: string;
    targetTotal: number;
    advanceTotal: number;
    familyIds: Set<string>;
    planIds: Set<string>;
  }>();

  for (const planActivity of data.planActivities.filter((item) => !item.is_deleted)) {
    const plan = approvedPlanById.get(planActivity.plan_id);
    if (!plan) continue;
    const activity = activityById.get(planActivity.activity_id);
    if (!activity || activity.is_deleted || isAgreementActivity(activity.name)) continue;
    const strategy = normalizeRestorationStrategy(activity.restoration_strategy);
    const unit = activity.unit || planActivity.unit || "ha";
    const key = `${strategy}-${activity.id}-${normalizeHeader(unit)}`;
    const row = rows.get(key) ?? {
      key,
      strategy,
      activityName: activity.name,
      unit,
      targetTotal: 0,
      advanceTotal: 0,
      familyIds: new Set<string>(),
      planIds: new Set<string>()
    };
    row.targetTotal += Number(planActivity.target ?? 0);
    row.advanceTotal += advanceByPlanActivity.get(planActivity.id) ?? 0;
    row.familyIds.add(plan.family_id);
    row.planIds.add(plan.id);
    rows.set(key, row);
  }

  const summaryRows = Array.from(rows.values()).map((row) => ({
    key: row.key,
    strategy: row.strategy,
    activityName: row.activityName,
    unit: row.unit,
    targetTotal: row.targetTotal,
    advanceTotal: row.advanceTotal,
    progressPercent: row.targetTotal > 0 ? row.advanceTotal / row.targetTotal * 100 : 0,
    familyCount: row.familyIds.size,
    planCount: row.planIds.size
  })).sort((left, right) =>
    restorationStrategyLabel(left.strategy).localeCompare(restorationStrategyLabel(right.strategy))
    || left.activityName.localeCompare(right.activityName)
  );

  return summaryRows;
}

async function exportDashboardChartsExcel(groups: DashboardChartGroup[]) {
  const included = groups.filter((group) => group.categories.length > 0);
  if (included.length === 0) return;
  const ExcelJS = await import("exceljs");
  const JSZip = (await import("jszip")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();
  for (const group of included) {
    const sheet = workbook.addWorksheet(group.sheetName);
    sheet.addRow([
      group.categoryHeader,
      ...group.series.map((serie) => serie.name),
      ...(group.extraColumns ?? []).map((column) => column.name)
    ]);
    group.categories.forEach((category, index) => {
      sheet.addRow([
        category,
        ...group.series.map((serie) => serie.values[index] ?? 0),
        ...(group.extraColumns ?? []).map((column) => column.values[index] ?? "")
      ]);
    });
    if (group.totalsRow) {
      const totalRow = sheet.addRow(group.totalsRow);
      totalRow.font = { bold: true };
    }
    stylePlainWorksheetHeader(sheet);
    sheet.getColumn(1).width = 46;
    const dataColumns = group.series.length + (group.extraColumns?.length ?? 0);
    for (let index = 0; index < dataColumns; index += 1) {
      sheet.getColumn(index + 2).width = 16;
    }
  }
  // ExcelJS no genera graficas nativas: se inyectan las partes OOXML (chart + drawing) al zip del xlsx
  const baseBuffer = await workbook.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(baseBuffer);
  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  let overrides = "";
  for (const [index, group] of included.entries()) {
    const n = index + 1;
    overrides += `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
      + `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
    zip.file(`xl/charts/chart${n}.xml`, dashboardChartXml(group));
    zip.file(`xl/drawings/drawing${n}.xml`, dashboardDrawingXml(1 + group.series.length + (group.extraColumns?.length ?? 0) + 1));
    zip.file(
      `xl/drawings/_rels/drawing${n}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/></Relationships>`
    );
    const sheetPath = `xl/worksheets/sheet${n}.xml`;
    const sheetXml = await zip.file(sheetPath)!.async("string");
    zip.file(sheetPath, sheetXml.replace("</worksheet>", `<drawing r:id="rIdChart"/></worksheet>`));
    const relsPath = `xl/worksheets/_rels/sheet${n}.xml.rels`;
    const relsFile = zip.file(relsPath);
    const drawingRel = `<Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/>`;
    if (relsFile) {
      const existing = await relsFile.async("string");
      zip.file(relsPath, existing.replace("</Relationships>", `${drawingRel}</Relationships>`));
    } else {
      zip.file(
        relsPath,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel}</Relationships>`
      );
    }
  }
  zip.file("[Content_Types].xml", contentTypes.replace("</Types>", `${overrides}</Types>`));
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  saveBlob(blob, "dashboard-indicadores.xlsx");
}

function dashboardChartXml(group: DashboardChartGroup) {
  const sheetRef = group.sheetName.replaceAll("'", "''");
  const catCount = group.categories.length;
  const catPts = group.categories.map((category, index) => `<c:pt idx="${index}"><c:v>${escapeHtml(category)}</c:v></c:pt>`).join("");
  const series = group.series.map((serie, index) => {
    const col = String.fromCharCode(66 + index);
    const valPts = serie.values.map((value, valueIndex) => `<c:pt idx="${valueIndex}"><c:v>${value}</c:v></c:pt>`).join("");
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>`
      + `<c:tx><c:strRef><c:f>'${sheetRef}'!$${col}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeHtml(serie.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`
      + `<c:cat><c:strRef><c:f>'${sheetRef}'!$A$2:$A$${catCount + 1}</c:f><c:strCache><c:ptCount val="${catCount}"/>${catPts}</c:strCache></c:strRef></c:cat>`
      + `<c:val><c:numRef><c:f>'${sheetRef}'!$${col}$2:$${col}$${catCount + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${catCount}"/>${valPts}</c:numCache></c:numRef></c:val>`
      + `</c:ser>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeHtml(group.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    + `<c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}`
    + `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
    + `<c:gapWidth val="150"/><c:axId val="100000001"/><c:axId val="100000002"/></c:barChart>`
    + `<c:catAx><c:axId val="100000001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="100000002"/></c:catAx>`
    + `<c:valAx><c:axId val="100000002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:crossAx val="100000001"/></c:valAx>`
    + `</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

function dashboardDrawingXml(fromCol = 6) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
    + `<xdr:twoCellAnchor><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${fromCol + 11}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>26</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Grafica dashboard"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
    + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
    + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>`
    + `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
}

function normalizeRestorationStrategy(value: string | null | undefined): RestorationStrategy {
  const normalized = normalizeHeader(value ?? "");
  if (normalized === "restauracion_ecologica" || normalized === "restauracion") return "restauracion_ecologica";
  if (normalized === "rehabilitacion_ecologica" || normalized === "rehabilitacion") return "rehabilitacion_ecologica";
  if (normalized === "recuperacion_ecologica" || normalized === "recuperacion") return "recuperacion_ecologica";
  return "no_aplica";
}

function restorationStrategyLabel(value: string | null | undefined) {
  const strategy = normalizeRestorationStrategy(value);
  return RESTORATION_STRATEGIES.find((item) => item.value === strategy)?.label ?? "No aplica";
}

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map(normalizeHeader) ?? [];
  return rows.map((values) =>
    headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index]?.trim() ?? "";
      return acc;
    }, {})
  );
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function csvValue(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value;
  }
  return "";
}

function csvBool(value: string, fallback = false) {
  if (!value) return fallback;
  return ["si", "sí", "true", "1", "activo", "activa"].includes(normalizeHeader(value));
}

function normalizeCounterpartType(value: string): CounterpartCatalog["type"] | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (normalized === "mano_obra" || normalized.includes("mano")) return "mano_obra";
  if (normalized === "material_propio" || normalized.includes("material")) return "material_propio";
  if (normalized === "otro" || normalized.includes("aporte")) return "otro";
  return null;
}

function counterpartTypeLabel(value: CounterpartCatalog["type"]) {
  return COUNTERPART_TYPES.find((item) => item.value === value)?.label ?? value;
}

function excelCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("result" in record) return excelCellText(record.result);
    if ("text" in record) return excelCellText(record.text);
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => excelCellText((part as Record<string, unknown>).text)).join("").trim();
    }
  }
  return String(value).trim();
}

function materialExcelValue(row: { getCell: (columnNumber: number) => { value: unknown } }, headerByName: Map<string, number>, keys: string[]) {
  for (const key of keys) {
    const columnNumber = headerByName.get(normalizeHeader(key));
    if (!columnNumber) continue;
    const value = excelCellText(row.getCell(columnNumber).value);
    if (value) return value;
  }
  return "";
}

function excelHeaderMap(sheet: { getRow: (rowNumber: number) => { eachCell: (callback: (cell: { value: unknown }, columnNumber: number) => void) => void } }) {
  const headerByName = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizeHeader(excelCellText(cell.value));
    if (header) headerByName.set(header, columnNumber);
  });
  return headerByName;
}

function excelRowHasValue(row: { values: unknown }) {
  return row.values instanceof Array && row.values.some((value, index) => index > 0 && excelCellText(value).trim() !== "");
}

function applyExcelDropdown(
  workbook: {
    getWorksheet: (name: string) => ({ name: string; state?: string; getCell: (row: number, column: number) => { value?: unknown } } | undefined);
    addWorksheet: (name: string) => { name: string; state?: string; getCell: (row: number, column: number) => { value?: unknown } };
  },
  sheet: { getColumn: (key: string) => { number?: number }; getCell: (row: number, column: number) => { dataValidation?: object }; rowCount?: number },
  columnKey: string,
  values: string[],
  allowBlank = false,
  listKey = columnKey
) {
  const columnNumber = sheet.getColumn(columnKey).number;
  if (!columnNumber) return;
  const listSheetName = excelListSheetName(listKey);
  const listSheet = workbook.getWorksheet(listSheetName) ?? workbook.addWorksheet(listSheetName);
  listSheet.state = "veryHidden";
  values.forEach((value, index) => {
    listSheet.getCell(index + 1, 1).value = value;
  });
  const escapedSheetName = listSheet.name.replaceAll("'", "''");
  const formulaRange = `'${escapedSheetName}'!$A$1:$A$${values.length}`;
  const lastRow = Math.max(sheet.rowCount ?? 1, 1000);
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    sheet.getCell(rowNumber, columnNumber).dataValidation = {
      type: "list",
      allowBlank,
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Valor no valido",
      error: "Seleccione un valor de la lista.",
      formulae: [formulaRange]
    };
  }
}

function excelListSheetName(listKey: string) {
  const normalized = normalizeHeader(listKey || "lista").replaceAll("_", "");
  return `_lista_${normalized}`.slice(0, 31);
}

function parseExcelNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;
  const decimalComma = cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".");
  const normalized = decimalComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseExcelNonNegativeInteger(value: string): number | null {
  const parsed = parseExcelNumber(value);
  if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) return null;
  return parsed;
}

function parseExcelBoolean(value: string): boolean | null {
  const normalized = normalizeHeader(value);
  if (["si", "s", "true", "1", "activo", "activa"].includes(normalized)) return true;
  if (["no", "n", "false", "0", "inactivo", "inactiva"].includes(normalized)) return false;
  return null;
}

function sameText(left: string | null | undefined, right: string) {
  return normalizeHeader(left ?? "") === normalizeHeader(right);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

async function saveProjectTerritories(
  projectId: string,
  values: {
    departmentIds: string[];
    municipalityIds: string[];
    villageIds: string[];
  }
) {
  const deleteDepartments = await supabase.from("project_departments").delete().eq("project_id", projectId);
  if (deleteDepartments.error) return deleteDepartments.error.message;
  const deleteMunicipalities = await supabase.from("project_municipalities").delete().eq("project_id", projectId);
  if (deleteMunicipalities.error) return deleteMunicipalities.error.message;
  const deleteVillages = await supabase.from("project_villages").delete().eq("project_id", projectId);
  if (deleteVillages.error) return deleteVillages.error.message;

  if (values.departmentIds.length > 0) {
    const { error } = await supabase.from("project_departments").insert(
      values.departmentIds.map((departmentId) => ({
        project_id: projectId,
        department_id: departmentId
      }))
    );
    if (error) return error.message;
  }

  if (values.municipalityIds.length > 0) {
    const { error } = await supabase.from("project_municipalities").insert(
      values.municipalityIds.map((municipalityId) => ({
        project_id: projectId,
        municipality_id: municipalityId
      }))
    );
    if (error) return error.message;
  }

  if (values.villageIds.length > 0) {
    const { error } = await supabase.from("project_villages").insert(
      values.villageIds.map((villageId) => ({
        project_id: projectId,
        village_id: villageId
      }))
    );
    if (error) return error.message;
  }

  return null;
}

function normalizeProjectStatus(value: string): Project["status"] | null {
  const normalized = normalizeHeader(value);
  if (!normalized || normalized === "active" || normalized === "activo") return "active";
  if (normalized === "closed" || normalized === "cerrado") return "closed";
  if (normalized === "archived" || normalized === "archivado") return "archived";
  return null;
}

function parseExcelDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function splitExcelList(value: string) {
  return value
    .split(/[;,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveProjectTerritoryFromExcel({
  departmentText,
  municipalityText,
  villageText,
  departments,
  municipalities,
  villages,
  rowNumber,
  errors
}: {
  departmentText: string;
  municipalityText: string;
  villageText: string;
  departments: Department[];
  municipalities: Municipality[];
  villages: Village[];
  rowNumber: number;
  errors: string[];
}) {
  const departmentIds = new Set<string>();
  const municipalityIds = new Set<string>();
  const villageIds = new Set<string>();
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality]));

  for (const departmentName of splitExcelList(departmentText)) {
    const matches = departments.filter((department) => sameText(department.name, departmentName));
    if (matches.length === 0) {
      errors.push(`Fila ${rowNumber}: departamento "${departmentName}" no existe.`);
    } else {
      matches.forEach((department) => departmentIds.add(department.id));
    }
  }

  function resolveMunicipality(municipalityName: string) {
    const matches = municipalities.filter((municipality) =>
      sameText(municipality.name, municipalityName)
      && (departmentIds.size === 0 || (municipality.department_id && departmentIds.has(municipality.department_id)))
    );
    if (matches.length === 0) {
      errors.push(`Fila ${rowNumber}: municipio "${municipalityName}" no existe o no corresponde al departamento indicado.`);
      return null;
    }
    if (matches.length > 1) {
      errors.push(`Fila ${rowNumber}: municipio "${municipalityName}" es ambiguo. Incluya el departamento correspondiente.`);
      return null;
    }
    const municipality = matches[0];
    municipalityIds.add(municipality.id);
    if (municipality.department_id) departmentIds.add(municipality.department_id);
    return municipality;
  }

  for (const municipalityName of splitExcelList(municipalityText)) {
    resolveMunicipality(municipalityName);
  }

  for (const token of splitExcelList(villageText)) {
    const [maybeMunicipality, ...villageParts] = token.split(":").map((part) => part.trim()).filter(Boolean);
    const hasMunicipalityPrefix = villageParts.length > 0;
    const villageName = hasMunicipalityPrefix ? villageParts.join(":").trim() : maybeMunicipality;
    const municipalityName = hasMunicipalityPrefix ? maybeMunicipality : "";
    let candidateMunicipalityIds = new Set(municipalityIds);
    if (municipalityName) {
      const municipality = resolveMunicipality(municipalityName);
      candidateMunicipalityIds = municipality ? new Set([municipality.id]) : new Set();
    }
    const matches = villages.filter((village) =>
      sameText(village.name, villageName)
      && (candidateMunicipalityIds.size === 0 || candidateMunicipalityIds.has(village.municipality_id))
    );
    if (matches.length === 0) {
      errors.push(`Fila ${rowNumber}: vereda "${token}" no existe o no corresponde a los municipios indicados.`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`Fila ${rowNumber}: vereda "${token}" es ambigua. Use el formato Municipio: Vereda.`);
      continue;
    }
    const village = matches[0];
    villageIds.add(village.id);
    municipalityIds.add(village.municipality_id);
    const municipality = municipalityById.get(village.municipality_id);
    if (municipality?.department_id) departmentIds.add(municipality.department_id);
  }

  for (const municipalityId of municipalityIds) {
    const municipality = municipalityById.get(municipalityId);
    if (municipality?.department_id && !departmentById.has(municipality.department_id)) {
      errors.push(`Fila ${rowNumber}: el departamento del municipio "${municipality.name}" no existe.`);
    }
  }

  return {
    departmentIds: Array.from(departmentIds),
    municipalityIds: Array.from(municipalityIds),
    villageIds: Array.from(villageIds)
  };
}

function userRoleLabel(roleName: string) {
  const labels: Record<string, string> = {
    super_admin: "Administrador general",
    project_admin: "Administrador por proyecto",
    municipal_technician: "Tecnico municipal",
    admin: "Administrador",
    coordinator: "Coordinador",
    technician: "Tecnico",
    viewer: "Visor",
    auditor: "Auditor"
  };
  return labels[roleName] ?? roleName;
}

function resolveProfileMunicipalitiesFromExcel({
  projectId,
  municipalityNames,
  municipalities,
  projectMunicipalities,
  rowNumber,
  errors
}: {
  projectId: string;
  municipalityNames: string[];
  municipalities: Municipality[];
  projectMunicipalities: ProjectMunicipality[];
  rowNumber: number;
  errors: string[];
}) {
  const ids: string[] = [];
  for (const municipalityName of municipalityNames) {
    const matches = municipalities.filter((municipality) =>
      sameText(municipality.name, municipalityName)
      && (!projectId || projectMunicipalities.some((item) => item.project_id === projectId && item.municipality_id === municipality.id))
    );
    if (matches.length === 0) {
      errors.push(`Fila ${rowNumber}: municipio "${municipalityName}" no existe o no pertenece al proyecto indicado.`);
      continue;
    }
    if (matches.length > 1) {
      errors.push(`Fila ${rowNumber}: municipio "${municipalityName}" es ambiguo. Revise el proyecto o el catalogo territorial.`);
      continue;
    }
    ids.push(matches[0].id);
  }
  return Array.from(new Set(ids));
}

function resolveFamilyMunicipalityForImport({
  projectId,
  municipalityName,
  municipalities,
  villages,
  projectMunicipalities,
  projectVillages,
  rowNumber,
  errors
}: {
  projectId: string;
  municipalityName: string;
  municipalities: Municipality[];
  villages: Village[];
  projectMunicipalities: ProjectMunicipality[];
  projectVillages: ProjectVillage[];
  rowNumber: number;
  errors: string[];
}) {
  const normalizedName = normalizeHeader(municipalityName);
  const projectMunicipalityIds = new Set(
    projectMunicipalities
      .filter((item) => item.project_id === projectId)
      .map((item) => item.municipality_id)
  );
  const projectVillageIds = new Set(
    projectVillages
      .filter((item) => item.project_id === projectId)
      .map((item) => item.village_id)
  );
  const projectVillageMunicipalityIds = new Set(
    villages
      .filter((village) => projectVillageIds.has(village.id))
      .map((village) => village.municipality_id)
  );
  const allowedMunicipalityIds = new Set([...projectMunicipalityIds, ...projectVillageMunicipalityIds]);
  const matches = municipalities
    .filter((municipality) => normalizeHeader(municipality.name) === normalizedName)
    .filter((municipality) => allowedMunicipalityIds.size === 0 || allowedMunicipalityIds.has(municipality.id));

  if (matches.length === 0) {
    errors.push(
      allowedMunicipalityIds.size > 0
        ? `Fila ${rowNumber}: municipio "${municipalityName}" no existe o no esta asociado al proyecto indicado.`
        : `Fila ${rowNumber}: municipio "${municipalityName}" no existe.`
    );
    return undefined;
  }
  if (matches.length > 1) {
    errors.push(`Fila ${rowNumber}: municipio "${municipalityName}" es ambiguo. Revise el territorio asociado al proyecto.`);
    return undefined;
  }
  return matches[0];
}

function resolveFamilyVillageForImport({
  projectId,
  municipality,
  villageName,
  villages,
  projectVillages,
  rowNumber,
  errors
}: {
  projectId: string;
  municipality: Municipality | undefined;
  villageName: string;
  villages: Village[];
  projectVillages: ProjectVillage[];
  rowNumber: number;
  errors: string[];
}) {
  if (!municipality) return undefined;
  const normalizedName = normalizeHeader(villageName);
  const projectVillageIds = new Set(
    projectVillages
      .filter((item) => item.project_id === projectId)
      .map((item) => item.village_id)
  );
  const matches = villages
    .filter((village) => village.municipality_id === municipality.id && normalizeHeader(village.name) === normalizedName)
    .filter((village) => projectVillageIds.size === 0 || projectVillageIds.has(village.id));

  if (matches.length === 0) {
    errors.push(
      projectVillageIds.size > 0
        ? `Fila ${rowNumber}: vereda "${villageName}" no existe para "${municipality.name}" o no esta asociada al proyecto indicado.`
        : `Fila ${rowNumber}: vereda "${villageName}" no existe para el municipio "${municipality.name}".`
    );
    return undefined;
  }
  if (matches.length > 1) {
    errors.push(`Fila ${rowNumber}: vereda "${villageName}" es ambigua para el municipio "${municipality.name}".`);
    return undefined;
  }
  return matches[0];
}

function ProjectsCrud({
  projects,
  canWrite,
  currentProfile,
  adminRoleId,
  departments,
  municipalities,
  villages,
  projectDepartments,
  projectMunicipalities,
  projectVillages,
  onChange
}: {
  projects: Project[];
  canWrite: boolean;
  currentProfile: Profile | null;
  adminRoleId: string | null;
  departments: Department[];
  municipalities: Municipality[];
  villages: Village[];
  projectDepartments: ProjectDepartment[];
  projectMunicipalities: ProjectMunicipality[];
  projectVillages: ProjectVillage[];
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyProject);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedMunicipalityIds, setSelectedMunicipalityIds] = useState<string[]>([]);
  const [selectedVillageIds, setSelectedVillageIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const selectedDepartmentNames = getSelectedLabels(
    departments.map((department) => ({ value: department.id, label: department.name })),
    selectedDepartmentIds
  );

  const allowedMunicipalities = municipalities.filter(
    (municipality) =>
      selectedDepartmentIds.length === 0 ||
      (municipality.department_id && selectedDepartmentIds.includes(municipality.department_id))
  );
  const allowedVillages = villages.filter((village) => {
    if (selectedMunicipalityIds.length === 0) return true;
    return selectedMunicipalityIds.includes(village.municipality_id);
  });

  function edit(project: Project) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      code_prefix: project.code_prefix,
      department: project.department ?? "",
      intervention_zone: project.intervention_zone ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      status: project.status
    });
    setSelectedDepartmentIds(
      projectDepartments
        .filter((item) => item.project_id === project.id)
        .map((item) => item.department_id)
    );
    setSelectedMunicipalityIds(
      projectMunicipalities
        .filter((item) => item.project_id === project.id)
        .map((item) => item.municipality_id)
    );
    setSelectedVillageIds(
      projectVillages
        .filter((item) => item.project_id === project.id)
        .map((item) => item.village_id)
    );
  }

  function projectDepartmentNames(projectId: string) {
    const ids = projectDepartments
      .filter((item) => item.project_id === projectId)
      .map((item) => item.department_id);
    return getSelectedLabels(
      departments.map((department) => ({ value: department.id, label: department.name })),
      ids
    );
  }

  function projectMunicipalityNames(projectId: string) {
    const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality.name]));
    return projectMunicipalities
      .filter((item) => item.project_id === projectId)
      .map((item) => municipalityById.get(item.municipality_id))
      .filter((name): name is string => Boolean(name))
      .sort((left, right) => left.localeCompare(right));
  }

  function projectVillageNames(projectId: string) {
    const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality.name]));
    return projectVillages
      .filter((item) => item.project_id === projectId)
      .map((item) => {
        const village = villages.find((candidate) => candidate.id === item.village_id);
        if (!village) return "";
        const municipalityName = municipalityById.get(village.municipality_id);
        return municipalityName ? `${municipalityName}: ${village.name}` : village.name;
      })
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    const payload = {
      ...form,
      department: selectedDepartmentNames.join(", ") || form.department || null,
      end_date: form.end_date || null,
      start_date: form.start_date || null
    };
    const result = editingId
      ? await supabase.from("projects").update(payload).eq("id", editingId)
      : await supabase.from("projects").insert(payload).select("id").single();
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    const savedProjectId = editingId || result.data?.id;
    if (!editingId && savedProjectId && currentProfile && adminRoleId) {
      const membership = await supabase.from("project_users").insert({
        project_id: savedProjectId,
        user_id: currentProfile.id,
        role_id: adminRoleId,
        can_approve_plans: true,
        can_manage_purchases: true,
        can_generate_documents: true
      });
      if (membership.error) {
        setNotice({
          type: "error",
          message: `Proyecto creado, pero no se pudo asignar el usuario al proyecto: ${membership.error.message}`
        });
        await onChange();
        return;
      }
    }
    if (savedProjectId) {
      const territoryError = await saveProjectTerritories(savedProjectId, {
        departmentIds: selectedDepartmentIds,
        municipalityIds: selectedMunicipalityIds,
        villageIds: selectedVillageIds
      });
      if (territoryError) {
        setNotice({ type: "error", message: territoryError });
        await onChange();
        return;
      }
    }
    setForm(emptyProject);
    setSelectedDepartmentIds([]);
    setSelectedMunicipalityIds([]);
    setSelectedVillageIds([]);
    setEditingId(null);
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("projects").update({ is_deleted: true, status: "archived" }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  async function downloadProjectsExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Proyectos");
    sheet.columns = [
      { header: "id", key: "id", width: 38, hidden: true },
      { header: "nombre_proyecto", key: "name", width: 42 },
      { header: "prefijo", key: "code_prefix", width: 16 },
      { header: "zona", key: "intervention_zone", width: 28 },
      { header: "fecha_inicio", key: "start_date", width: 16 },
      { header: "fecha_fin", key: "end_date", width: 16 },
      { header: "estado", key: "status", width: 14 },
      { header: "departamentos", key: "departments", width: 36 },
      { header: "municipios", key: "municipalities", width: 46 },
      { header: "veredas", key: "villages", width: 60 }
    ];
    for (const project of projects.filter((item) => !item.is_deleted)) {
      sheet.addRow({
        id: project.id,
        name: project.name,
        code_prefix: project.code_prefix,
        intervention_zone: project.intervention_zone ?? "",
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
        status: project.status,
        departments: projectDepartmentNames(project.id).join("; "),
        municipalities: projectMunicipalityNames(project.id).join("; "),
        villages: projectVillageNames(project.id).join("; ")
      });
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEEB" } };
    sheet.getColumn("start_date").numFmt = "yyyy-mm-dd";
    sheet.getColumn("end_date").numFmt = "yyyy-mm-dd";
    applyExcelDropdown(workbook, sheet, "status", ["active", "closed", "archived"], false, "estado_proyecto");
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }), "proyectos.xlsx");
  }

  async function importProjectsExcel(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet("Proyectos") ?? workbook.worksheets[0];
    if (!sheet) {
      setNotice({ type: "error", message: "El archivo no contiene una hoja de proyectos." });
      return;
    }
    const headerByName = excelHeaderMap(sheet);
    const existingById = new Map(projects.map((project) => [project.id, project]));
    const existingByName = new Map(projects.filter((project) => !project.is_deleted).map((project) => [normalizeHeader(project.name), project]));
    const existingByPrefix = new Map(projects.filter((project) => !project.is_deleted).map((project) => [normalizeHeader(project.code_prefix), project]));
    const seenNames = new Map<string, number>();
    const seenPrefixes = new Map<string, number>();
    const errors: string[] = [];
    const operations: Array<{
      type: "update" | "insert";
      id?: string;
      payload: Partial<Project>;
      territory: { departmentIds: string[]; municipalityIds: string[]; villageIds: string[] } | null;
    }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!excelRowHasValue(row)) continue;
      const id = materialExcelValue(row, headerByName, ["id"]);
      const name = materialExcelValue(row, headerByName, ["nombre_proyecto", "nombre proyecto", "nombre"]);
      const codePrefix = materialExcelValue(row, headerByName, ["prefijo", "codigo", "codigo proyecto"]);
      const status = normalizeProjectStatus(materialExcelValue(row, headerByName, ["estado"]) || "active");
      const startDate = parseExcelDateInput(materialExcelValue(row, headerByName, ["fecha_inicio", "inicio"]));
      const endDate = parseExcelDateInput(materialExcelValue(row, headerByName, ["fecha_fin", "fin"]));
      const zone = materialExcelValue(row, headerByName, ["zona", "zona_intervencion", "zona intervencion"]);
      const departmentText = materialExcelValue(row, headerByName, ["departamentos", "departamento"]);
      const municipalityText = materialExcelValue(row, headerByName, ["municipios", "municipio"]);
      const villageText = materialExcelValue(row, headerByName, ["veredas", "vereda"]);

      if (id && !existingById.has(id)) errors.push(`Fila ${rowNumber}: el id de proyecto no existe.`);
      if (!name) errors.push(`Fila ${rowNumber}: nombre_proyecto es obligatorio.`);
      if (!codePrefix) errors.push(`Fila ${rowNumber}: prefijo es obligatorio.`);
      if (!status) errors.push(`Fila ${rowNumber}: estado debe ser active, closed o archived.`);
      if (startDate === null) errors.push(`Fila ${rowNumber}: fecha_inicio no es valida.`);
      if (endDate === null) errors.push(`Fila ${rowNumber}: fecha_fin no es valida.`);
      if (startDate && endDate && endDate < startDate) errors.push(`Fila ${rowNumber}: fecha_fin no puede ser menor que fecha_inicio.`);

      const normalizedName = normalizeHeader(name);
      const normalizedPrefix = normalizeHeader(codePrefix);
      const duplicateName = existingByName.get(normalizedName);
      const duplicatePrefix = existingByPrefix.get(normalizedPrefix);
      if (seenNames.has(normalizedName)) errors.push(`Fila ${rowNumber}: nombre_proyecto duplicado con fila ${seenNames.get(normalizedName)}.`);
      if (seenPrefixes.has(normalizedPrefix)) errors.push(`Fila ${rowNumber}: prefijo duplicado con fila ${seenPrefixes.get(normalizedPrefix)}.`);
      if (normalizedName) seenNames.set(normalizedName, rowNumber);
      if (normalizedPrefix) seenPrefixes.set(normalizedPrefix, rowNumber);
      if (duplicateName && duplicateName.id !== id) errors.push(`Fila ${rowNumber}: ya existe otro proyecto con ese nombre.`);
      if (duplicatePrefix && duplicatePrefix.id !== id) errors.push(`Fila ${rowNumber}: ya existe otro proyecto con ese prefijo.`);

      const hasTerritoryColumns = Boolean(departmentText || municipalityText || villageText);
      const territory = hasTerritoryColumns
        ? resolveProjectTerritoryFromExcel({
          departmentText,
          municipalityText,
          villageText,
          departments,
          municipalities,
          villages,
          rowNumber,
          errors
        })
        : null;

      if (!name || !codePrefix || !status || startDate === null || endDate === null || (id && !existingById.has(id)) || (duplicateName && duplicateName.id !== id) || (duplicatePrefix && duplicatePrefix.id !== id)) continue;
      operations.push({
        type: id ? "update" : "insert",
        id: id || undefined,
        payload: {
          name,
          code_prefix: codePrefix,
          intervention_zone: zone || null,
          department: territory ? getSelectedLabels(departments.map((department) => ({ value: department.id, label: department.name })), territory.departmentIds).join(", ") || null : undefined,
          start_date: startDate || null,
          end_date: endDate || null,
          status
        },
        territory
      });
    }

    if (errors.length > 0) {
      setNotice({ type: "error", message: `No se aplicaron cambios. ${errors.slice(0, 8).join(" ")}` });
      return;
    }

    let updated = 0;
    let created = 0;
    for (const operation of operations) {
      const result = operation.type === "update"
        ? await supabase.from("projects").update(operation.payload).eq("id", operation.id)
        : await supabase.from("projects").insert(operation.payload).select("id").single();
      if (result.error) {
        setNotice({ type: "error", message: `Error al guardar proyectos: ${result.error.message}` });
        return;
      }
      const savedProjectId = operation.type === "update" ? operation.id : result.data?.id;
      if (operation.type === "insert" && savedProjectId && currentProfile && adminRoleId) {
        const membership = await supabase.from("project_users").insert({
          project_id: savedProjectId,
          user_id: currentProfile.id,
          role_id: adminRoleId,
          can_approve_plans: true,
          can_manage_purchases: true,
          can_generate_documents: true
        });
        if (membership.error) {
          setNotice({ type: "error", message: `Proyecto creado, pero no se pudo asignar el usuario: ${membership.error.message}` });
          await onChange();
          return;
        }
      }
      if (savedProjectId && operation.territory) {
        const territoryError = await saveProjectTerritories(savedProjectId, operation.territory);
        if (territoryError) {
          setNotice({ type: "error", message: territoryError });
          await onChange();
          return;
        }
      }
      if (operation.type === "update") updated += 1;
      else created += 1;
    }
    setNotice({ type: "info", message: `Actualizacion masiva finalizada. Actualizados: ${updated}. Creados: ${created}.` });
    await onChange();
  }

  return (
    <CrudSection title="Proyectos" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Actualizacion masiva desde Excel</strong></div>
        <p className="span-12 muted">Descargue el listado, edite datos del proyecto, municipios o veredas, y suba el mismo archivo actualizado. Use veredas como Municipio: Vereda para evitar ambiguedades.</p>
        <div className="span-4 form-actions">
          <button className="secondary" type="button" onClick={() => void downloadProjectsExcel()}>Descargar listado proyectos</button>
        </div>
        <label className="span-8">
          Archivo Excel actualizado
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!canWrite}
            onChange={(event) => {
              void importProjectsExcel(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <form className="panel grid" onSubmit={save}>
        <TextInput label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <TextInput
          label="Prefijo"
          value={form.code_prefix}
          onChange={(code_prefix) => setForm({ ...form, code_prefix })}
          required
        />
        <TextInput
          label="Zona"
          value={form.intervention_zone}
          onChange={(intervention_zone) => setForm({ ...form, intervention_zone })}
        />
        <TextInput label="Inicio" type="date" value={form.start_date} onChange={(start_date) => setForm({ ...form, start_date })} />
        <TextInput label="Fin" type="date" value={form.end_date} onChange={(end_date) => setForm({ ...form, end_date })} />
        <label className="span-3">
          Estado
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">Activo</option>
            <option value="closed">Cerrado</option>
            <option value="archived">Archivado</option>
          </select>
        </label>
        <ChipMultiSelect
          className="span-12"
          label="Departamentos de intervencion"
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
          value={selectedDepartmentIds}
          onChange={(next) => {
            setSelectedDepartmentIds(next);
            const nextMunicipalityIds = selectedMunicipalityIds.filter((id) => {
                const municipality = municipalities.find((item) => item.id === id);
                return municipality?.department_id ? next.includes(municipality.department_id) : true;
              });
            setSelectedMunicipalityIds(nextMunicipalityIds);
            setSelectedVillageIds((current) =>
              current.filter((id) => {
                const village = villages.find((item) => item.id === id);
                return village ? nextMunicipalityIds.includes(village.municipality_id) : true;
              })
            );
          }}
        />
        <ChipMultiSelect
          className="span-12"
          label="Municipios de intervencion"
          options={allowedMunicipalities.map((municipality) => ({ value: municipality.id, label: municipality.name }))}
          value={selectedMunicipalityIds}
          onChange={(next) => {
            setSelectedMunicipalityIds(next);
            setSelectedVillageIds((current) =>
              current.filter((id) => {
                const village = villages.find((item) => item.id === id);
                return village ? next.includes(village.municipality_id) : true;
              })
            );
          }}
        />
        <ChipMultiSelect
          className="span-12"
          label="Veredas de intervencion"
          options={allowedVillages.map((village) => ({ value: village.id, label: village.name }))}
          value={selectedVillageIds}
          onChange={setSelectedVillageIds}
        />
        <div className="span-12 form-actions">
          <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? (
            <button className="secondary" type="button" onClick={() => {
              setEditingId(null);
              setForm(emptyProject);
              setSelectedDepartmentIds([]);
              setSelectedMunicipalityIds([]);
              setSelectedVillageIds([]);
            }}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      <DataTable
        headers={["Nombre", "Prefijo", "Departamentos", "Estado", "Acciones"]}
        rows={projects.map((project) => {
          const departmentNames = projectDepartmentNames(project.id);
          return [
            project.name,
            project.code_prefix,
            departmentNames.length > 0 ? (
              <ChipList key="departments" labels={departmentNames} />
            ) : (
              project.department ?? ""
            ),
            <span className="badge" key="status">{project.status}</span>,
            <Actions key="actions" canWrite={canWrite} onEdit={() => edit(project)} onDelete={() => remove(project.id)} />
          ];
        })}
      />
    </CrudSection>
  );
}

function ProfilesCrud({
  profiles,
  roles,
  projects,
  projectUsers,
  municipalities,
  projectMunicipalities,
  userMunicipalityAssignments,
  canWrite,
  onChange
}: {
  profiles: Profile[];
  roles: Role[];
  projects: Project[];
  projectUsers: ProjectUser[];
  municipalities: Municipality[];
  projectMunicipalities: ProjectMunicipality[];
  userMunicipalityAssignments: UserMunicipalityAssignment[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const roleName = (id?: string | null) => roles.find((role) => role.id === id)?.name ?? "";
  const roleLabel = (id?: string | null) => userRoleLabel(roleName(id));
  const selectedRoleName = roleName(form.default_role_id);
  const roleRequiresProject = ["project_admin", "municipal_technician", "admin", "coordinator", "technician"].includes(selectedRoleName);
  const roleRequiresMunicipality = selectedRoleName === "municipal_technician" || selectedRoleName === "technician";
  const municipalityOptions = municipalities.filter((municipality) =>
    !form.project_id || projectMunicipalities.some((item) => item.project_id === form.project_id && item.municipality_id === municipality.id)
  );

  function edit(profile: Profile) {
    const membership = projectUsers.find((item) => item.user_id === profile.id && item.status === "active");
    const municipalityIds = userMunicipalityAssignments
      .filter((item) => item.user_id === profile.id && (!membership?.project_id || item.project_id === membership.project_id))
      .map((item) => item.municipality_id);
    setEditingId(profile.id);
    setForm({
      auth_user_id: profile.auth_user_id ?? "",
      email: profile.email ?? "",
      temporary_password: "",
      project_id: membership?.project_id ?? "",
      municipality_ids: municipalityIds,
      full_name: profile.full_name,
      document_number: profile.document_number ?? "",
      phone: profile.phone ?? "",
      default_role_id: membership?.role_id ?? profile.default_role_id ?? "",
      active: profile.active
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    if (!form.email.trim()) {
      setNotice({ type: "error", message: "El correo autorizado es obligatorio." });
      return;
    }
    if (roleRequiresProject && !form.project_id) {
      setNotice({ type: "error", message: "Este rol requiere seleccionar un proyecto." });
      return;
    }
    if (roleRequiresMunicipality && form.municipality_ids.length === 0) {
      setNotice({ type: "error", message: "El tecnico municipal debe tener al menos un municipio asignado." });
      return;
    }
    const payload = {
      auth_user_id: form.auth_user_id || null,
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name,
      document_number: form.document_number || null,
      phone: form.phone || null,
      default_role_id: form.default_role_id || null,
      active: form.active
    };
    const result = editingId
      ? await supabase.from("users_profiles").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("users_profiles").insert(payload).select("id").single();
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    const savedProfileId = editingId || result.data?.id;
    if (savedProfileId && form.project_id && form.default_role_id) {
      const membershipPayload = {
        project_id: form.project_id,
        user_id: savedProfileId,
        role_id: form.default_role_id,
        status: "active",
        can_approve_plans: selectedRoleName === "project_admin" || selectedRoleName === "admin" || selectedRoleName === "coordinator",
        can_manage_purchases: selectedRoleName === "project_admin" || selectedRoleName === "admin" || selectedRoleName === "coordinator",
        can_generate_documents: true
      };
      const membership = await supabase.from("project_users").upsert(membershipPayload, { onConflict: "project_id,user_id" });
      if (membership.error) {
        setNotice({ type: "error", message: `Perfil guardado, pero no se pudo asignar el proyecto: ${membership.error.message}` });
        await onChange();
        return;
      }
    }
    if (savedProfileId) {
      const clearAssignments = await supabase
        .from("user_municipality_assignments")
        .update({ is_deleted: true, status: "inactive" })
        .eq("user_id", savedProfileId);
      if (clearAssignments.error && !isMissingTableError(clearAssignments.error)) {
        setNotice({ type: "error", message: `Perfil guardado, pero no se pudieron limpiar municipios: ${clearAssignments.error.message}` });
        await onChange();
        return;
      }
      if (form.project_id && form.municipality_ids.length > 0) {
        const municipalityResult = await supabase.from("user_municipality_assignments").upsert(
          form.municipality_ids.map((municipalityId) => ({
            project_id: form.project_id,
            user_id: savedProfileId,
            municipality_id: municipalityId,
            status: "active",
            is_deleted: false
          })),
          { onConflict: "project_id,user_id,municipality_id" }
        );
        if (municipalityResult.error) {
          setNotice({ type: "error", message: `Perfil guardado, pero no se pudieron asignar municipios: ${municipalityResult.error.message}` });
          await onChange();
          return;
        }
      }
    }
    setForm(emptyProfile);
    setEditingId(null);
    setNotice({
      type: "info",
      message: form.temporary_password
        ? "Usuario guardado. Cree o actualice la cuenta en Supabase Auth con el correo autorizado y la contrasena temporal indicada; la contrasena no se almaceno en la base."
        : "Usuario guardado."
    });
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("users_profiles").update({ is_deleted: true, active: false }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  async function downloadProfilesExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Usuarios");
    sheet.columns = [
      { header: "id", key: "id", width: 38, hidden: true },
      { header: "auth_user_id", key: "auth_user_id", width: 38, hidden: true },
      { header: "default_role_id", key: "default_role_id", width: 38, hidden: true },
      { header: "correo_autorizado", key: "email", width: 34 },
      { header: "contrasena_temporal", key: "temporary_password", width: 24 },
      { header: "nombre_completo", key: "full_name", width: 34 },
      { header: "documento", key: "document_number", width: 18 },
      { header: "telefono", key: "phone", width: 18 },
      { header: "rol", key: "role_name", width: 18 },
      { header: "proyecto", key: "project_name", width: 36 },
      { header: "municipios", key: "municipalities", width: 48 },
      { header: "activo", key: "active", width: 12 }
    ];
    for (const profile of profiles.filter((item) => !item.is_deleted)) {
      const membership = projectUsers.find((item) => item.user_id === profile.id && item.status === "active");
      const project = membership ? projects.find((item) => item.id === membership.project_id) : undefined;
      const municipalityNames = userMunicipalityAssignments
        .filter((item) => item.user_id === profile.id && (!membership?.project_id || item.project_id === membership.project_id))
        .map((item) => municipalities.find((municipality) => municipality.id === item.municipality_id)?.name)
        .filter((name): name is string => Boolean(name))
        .sort((left, right) => left.localeCompare(right));
      sheet.addRow({
        id: profile.id,
        auth_user_id: profile.auth_user_id ?? "",
        default_role_id: profile.default_role_id ?? "",
        email: profile.email ?? "",
        temporary_password: "",
        full_name: profile.full_name,
        document_number: profile.document_number ?? "",
        phone: profile.phone ?? "",
        role_name: roleName(membership?.role_id ?? profile.default_role_id),
        project_name: project?.name ?? "",
        municipalities: municipalityNames.join("; "),
        active: profile.active ? "SI" : "NO"
      });
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEEB" } };
    applyExcelDropdown(workbook, sheet, "active", ["SI", "NO"], false, "si_no");
    applyExcelDropdown(workbook, sheet, "role_name", roles.map((role) => role.name), false, "roles_usuario");
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }), "usuarios-perfiles.xlsx");
  }

  async function importProfilesExcel(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet("Usuarios") ?? workbook.worksheets[0];
    if (!sheet) {
      setNotice({ type: "error", message: "El archivo no contiene una hoja de usuarios." });
      return;
    }
    const headerByName = excelHeaderMap(sheet);
    const existingById = new Map(profiles.map((profile) => [profile.id, profile]));
    const existingByEmail = new Map(profiles.filter((profile) => profile.email).map((profile) => [normalizeHeader(profile.email ?? ""), profile]));
    const roleByName = new Map(roles.map((role) => [normalizeHeader(role.name), role.id]));
    const projectByName = new Map(projects.map((project) => [normalizeHeader(project.name), project]));
    const errors: string[] = [];
    const operations: Array<{
      type: "update" | "insert";
      id?: string;
      payload: Partial<Profile>;
      projectId: string;
      municipalityIds: string[];
      roleId: string;
      temporaryPassword: string;
    }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!excelRowHasValue(row)) continue;
      const id = materialExcelValue(row, headerByName, ["id"]);
      const authUserId = materialExcelValue(row, headerByName, ["auth_user_id"]);
      const email = materialExcelValue(row, headerByName, ["correo_autorizado", "correo", "email"]).trim().toLowerCase();
      const temporaryPassword = materialExcelValue(row, headerByName, ["contrasena_temporal", "contraseña_temporal", "password"]);
      const fullName = materialExcelValue(row, headerByName, ["nombre_completo", "nombre", "full_name"]);
      const roleId = materialExcelValue(row, headerByName, ["default_role_id"])
        || roleByName.get(normalizeHeader(materialExcelValue(row, headerByName, ["rol"]))) || "";
      const role = roleName(roleId);
      const projectName = materialExcelValue(row, headerByName, ["proyecto", "project"]);
      const projectId = projectName ? projectByName.get(normalizeHeader(projectName))?.id ?? "" : "";
      const municipalityNames = splitExcelList(materialExcelValue(row, headerByName, ["municipios", "municipio"]));
      const municipalityIds = resolveProfileMunicipalitiesFromExcel({
        projectId,
        municipalityNames,
        municipalities,
        projectMunicipalities,
        rowNumber,
        errors
      });
      const active = parseExcelBoolean(materialExcelValue(row, headerByName, ["activo", "estado"]) || "SI");
      if (id && !existingById.has(id)) errors.push(`Fila ${rowNumber}: el id de usuario no existe.`);
      if (!email) errors.push(`Fila ${rowNumber}: correo_autorizado es obligatorio.`);
      if (!fullName) errors.push(`Fila ${rowNumber}: nombre_completo es obligatorio.`);
      if (active === null) errors.push(`Fila ${rowNumber}: activo debe ser SI o NO.`);
      if (materialExcelValue(row, headerByName, ["rol"]) && !roleId) errors.push(`Fila ${rowNumber}: el rol no existe.`);
      const duplicateEmail = existingByEmail.get(normalizeHeader(email));
      if (duplicateEmail && duplicateEmail.id !== id) errors.push(`Fila ${rowNumber}: ya existe otro usuario con ese correo.`);
      if (["project_admin", "municipal_technician", "admin", "coordinator", "technician"].includes(role) && !projectId) errors.push(`Fila ${rowNumber}: el rol requiere proyecto valido.`);
      if ((role === "municipal_technician" || role === "technician") && municipalityIds.length === 0) errors.push(`Fila ${rowNumber}: el tecnico municipal requiere al menos un municipio.`);
      if (!fullName || !email || active === null || (id && !existingById.has(id)) || (materialExcelValue(row, headerByName, ["rol"]) && !roleId) || (duplicateEmail && duplicateEmail.id !== id)) continue;
      operations.push({
        type: id ? "update" : "insert",
        id: id || undefined,
        payload: {
          auth_user_id: authUserId || existingById.get(id)?.auth_user_id || null,
          email,
          full_name: fullName,
          document_number: materialExcelValue(row, headerByName, ["documento", "document_number"]) || null,
          phone: materialExcelValue(row, headerByName, ["telefono", "phone"]) || null,
          default_role_id: roleId || null,
          active
        },
        projectId,
        municipalityIds,
        roleId,
        temporaryPassword
      });
    }
    if (errors.length > 0) {
      setNotice({ type: "error", message: `No se aplicaron cambios. ${errors.slice(0, 6).join(" ")}` });
      return;
    }
    let updated = 0;
    let created = 0;
    for (const operation of operations) {
      const result = operation.type === "update"
        ? await supabase.from("users_profiles").update(operation.payload).eq("id", operation.id).select("id").single()
        : await supabase.from("users_profiles").insert(operation.payload).select("id").single();
      if (result.error) {
        setNotice({ type: "error", message: `Error al guardar usuarios: ${result.error.message}` });
        return;
      }
      const savedProfileId = operation.type === "update" ? operation.id : result.data?.id;
      if (savedProfileId && operation.projectId && operation.roleId) {
        const membership = await supabase.from("project_users").upsert({
          project_id: operation.projectId,
          user_id: savedProfileId,
          role_id: operation.roleId,
          status: "active",
          can_approve_plans: ["project_admin", "admin", "coordinator"].includes(roleName(operation.roleId)),
          can_manage_purchases: ["project_admin", "admin", "coordinator"].includes(roleName(operation.roleId)),
          can_generate_documents: true
        }, { onConflict: "project_id,user_id" });
        if (membership.error) {
          setNotice({ type: "error", message: `Perfil guardado, pero fallo proyecto: ${membership.error.message}` });
          await onChange();
          return;
        }
      }
      if (savedProfileId) {
        const clearAssignments = await supabase.from("user_municipality_assignments").update({ is_deleted: true, status: "inactive" }).eq("user_id", savedProfileId);
        if (clearAssignments.error && !isMissingTableError(clearAssignments.error)) {
          setNotice({ type: "error", message: `Perfil guardado, pero fallo limpieza de municipios: ${clearAssignments.error.message}` });
          await onChange();
          return;
        }
        if (operation.projectId && operation.municipalityIds.length > 0) {
          const municipalityResult = await supabase.from("user_municipality_assignments").upsert(
            operation.municipalityIds.map((municipalityId) => ({
              project_id: operation.projectId,
              user_id: savedProfileId,
              municipality_id: municipalityId,
              status: "active",
              is_deleted: false
            })),
            { onConflict: "project_id,user_id,municipality_id" }
          );
          if (municipalityResult.error) {
            setNotice({ type: "error", message: `Perfil guardado, pero fallo municipios: ${municipalityResult.error.message}` });
            await onChange();
            return;
          }
        }
      }
      if (operation.type === "update") updated += 1;
      else created += 1;
    }
    const passwords = operations.filter((operation) => operation.temporaryPassword).length;
    setNotice({ type: "info", message: `Actualizacion masiva finalizada. Actualizados: ${updated}. Creados: ${created}. Contrasenas temporales en archivo: ${passwords}; no fueron almacenadas.` });
    await onChange();
  }

  return (
    <CrudSection title="Usuarios / perfiles" canWrite={canWrite} notice={notice}>
      <div className="alert info">
        El correo autorizado queda en el perfil. La contrasena temporal solo sirve para crear la cuenta en Supabase Auth y no se almacena en la base de datos.
      </div>
      <div className="panel grid">
        <div className="span-12"><strong>Actualizacion masiva desde Excel</strong></div>
        <p className="span-12 muted">Descargue el listado, edite perfiles, rol, proyecto y municipios. Las contrasenas temporales del archivo no se guardan.</p>
        <div className="span-4 form-actions">
          <button className="secondary" type="button" onClick={() => void downloadProfilesExcel()}>Descargar listado usuarios</button>
        </div>
        <label className="span-8">
          Archivo Excel actualizado
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!canWrite}
            onChange={(event) => {
              void importProfilesExcel(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <form className="panel grid" onSubmit={save}>
        <TextInput
          label="Cuenta Auth Supabase (opcional)"
          value={form.auth_user_id}
          onChange={(auth_user_id) => setForm({ ...form, auth_user_id })}
          type="password"
        />
        <TextInput
          label="Correo autorizado"
          value={form.email}
          onChange={(email) => setForm({ ...form, email })}
          type="email"
          required
        />
        <TextInput
          label="Contrasena temporal"
          value={form.temporary_password}
          onChange={(temporary_password) => setForm({ ...form, temporary_password })}
          type="password"
        />
        <TextInput
          label="Nombre"
          value={form.full_name}
          onChange={(full_name) => setForm({ ...form, full_name })}
          required
        />
        <TextInput
          label="Documento"
          value={form.document_number}
          onChange={(document_number) => setForm({ ...form, document_number })}
        />
        <TextInput label="Telefono" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        <label className="span-4">
          Rol
          <select value={form.default_role_id} onChange={(event) => setForm({ ...form, default_role_id: event.target.value, project_id: "", municipality_ids: [] })}>
            <option value="">Sin rol</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{userRoleLabel(role.name)}</option>
            ))}
          </select>
        </label>
        {roleRequiresProject ? (
          <label className="span-4">
            Proyecto
            <select value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value, municipality_ids: [] })}>
              <option value="">Seleccione</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        ) : null}
        {roleRequiresMunicipality ? (
          <ChipMultiSelect
            className="span-12"
            label="Municipios asignados"
            options={municipalityOptions.map((municipality) => ({ value: municipality.id, label: municipality.name }))}
            value={form.municipality_ids}
            onChange={(municipality_ids) => setForm({ ...form, municipality_ids })}
          />
        ) : null}
        <label className="span-3">
          Activo
          <select value={String(form.active)} onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}>
            <option value="true">Si</option>
            <option value="false">No</option>
          </select>
        </label>
        <div className="span-12 form-actions">
          <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? (
            <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyProfile); }}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      <DataTable
        headers={["Nombre", "Correo", "Rol", "Proyecto", "Municipios", "Activo", "Acciones"]}
        emptyMessage="No hay perfiles registrados."
        rows={profiles.map((item) => {
          const membership = projectUsers.find((membershipItem) => membershipItem.user_id === item.id && membershipItem.status === "active");
          const project = membership ? projects.find((projectItem) => projectItem.id === membership.project_id) : undefined;
          const municipalityNames = userMunicipalityAssignments
            .filter((assignment) => assignment.user_id === item.id && (!membership?.project_id || assignment.project_id === membership.project_id))
            .map((assignment) => municipalities.find((municipality) => municipality.id === assignment.municipality_id)?.name)
            .filter((name): name is string => Boolean(name));
          return [
            item.full_name,
            item.email ?? "",
            roleLabel(membership?.role_id ?? item.default_role_id),
            project?.name ?? "",
            municipalityNames.length > 0 ? <ChipList key="municipalities" labels={municipalityNames} /> : "",
            item.active ? "Si" : "No",
            <Actions key="actions" canWrite={canWrite} onEdit={() => edit(item)} onDelete={() => remove(item.id)} />
          ];
        })}
      />
    </CrudSection>
  );
}

function FamiliesCrud({
  families,
  properties,
  projects,
  projectMunicipalities,
  projectVillages,
  municipalities,
  villages,
  departments,
  canWrite,
  onChange
}: {
  families: Family[];
  properties: Property[];
  projects: Project[];
  projectMunicipalities: ProjectMunicipality[];
  projectVillages: ProjectVillage[];
  municipalities: Municipality[];
  villages: Village[];
  departments: Department[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyFamily);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [importProjectId, setImportProjectId] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterMunicipalityId, setFilterMunicipalityId] = useState("");
  const [filterVillageId, setFilterVillageId] = useState("");

  const allowedMunicipalityIds = projectMunicipalities
    .filter((item) => item.project_id === form.project_id)
    .map((item) => item.municipality_id);
  const scopedMunicipalities =
    form.project_id && allowedMunicipalityIds.length > 0
      ? municipalities.filter((municipality) => allowedMunicipalityIds.includes(municipality.id))
      : municipalities;
  const allowedVillageIds = projectVillages
    .filter((item) => item.project_id === form.project_id)
    .map((item) => item.village_id);
  const scopedVillages = villages.filter((village) => {
    if (form.municipality_id && village.municipality_id !== form.municipality_id) return false;
    if (form.project_id && allowedVillageIds.length > 0) return allowedVillageIds.includes(village.id);
    return true;
  });

  const filteredFamilies = families.filter((family) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = family.representative_name?.toLowerCase().includes(q) ?? false;
      const matchesDoc = family.document_number?.toLowerCase().includes(q) ?? false;
      const matchesCode = family.family_code?.toLowerCase().includes(q) ?? false;
      if (!matchesName && !matchesDoc && !matchesCode) return false;
    }
    if (filterMunicipalityId && family.municipality_id !== filterMunicipalityId) return false;
    if (filterVillageId && family.village_id !== filterVillageId) return false;
    if (filterDepartmentId) {
      const mun = municipalities.find(m => m.id === family.municipality_id);
      if (mun?.department_id !== filterDepartmentId) return false;
    }
    return true;
  });

  function edit(family: Family) {
    setEditingId(family.id);
    setForm({
      project_id: family.project_id,
      family_code: family.family_code,
      representative_name: family.representative_name,
      document_number: family.document_number ?? "",
      age: family.age?.toString() ?? "",
      birth_date: family.birth_date ?? "",
      phone: family.phone ?? "",
      municipality_id: family.municipality_id ?? "",
      village_id: family.village_id ?? "",
      observations: family.observations ?? "",
      status: family.status,
      validation_status: family.validation_status
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    let familyCode = form.family_code.trim();
    if (!editingId && !familyCode) {
      if (!form.project_id) {
        setNotice({ type: "error", message: "Seleccione un proyecto para generar el codigo familiar." });
        return;
      }
      const generatedCode = await generateNextFamilyCode(form.project_id);
      if (!generatedCode) return;
      familyCode = generatedCode;
    }
    const payload = {
      ...form,
      family_code: editingId ? form.family_code : familyCode,
      age: form.age ? Number(form.age) : null,
      birth_date: form.birth_date || null,
      document_number: form.document_number || null,
      phone: form.phone || null,
      municipality_id: form.municipality_id || null,
      village_id: form.village_id || null,
      observations: form.observations || null
    };
    const result = editingId
      ? await supabase.from("families").update(payload).eq("id", editingId)
      : await supabase.from("families").insert(payload);
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setEditingId(null);
    setForm(emptyFamily);
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("families").update({ is_deleted: true, status: "inactive" }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  async function generateNextFamilyCode(projectId: string, reservedCodes = new Set<string>()) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data, error } = await supabase.rpc("generate_family_code", { p_project_id: projectId });
      if (error || !data) {
        setNotice({ type: "error", message: `No fue posible generar el codigo familiar: ${error?.message ?? "sin respuesta de Supabase"}` });
        return "";
      }
      const code = String(data);
      const key = `${projectId}-${normalizeHeader(code)}`;
      const exists = families.some((family) => !family.is_deleted && family.project_id === projectId && sameText(family.family_code, code));
      if (!exists && !reservedCodes.has(key)) {
        reservedCodes.add(key);
        return code;
      }
    }
    setNotice({ type: "error", message: "No fue posible generar un codigo familiar unico. Revise el consecutivo del proyecto." });
    return "";
  }

  async function importFamilies(file: File | null) {
    if (!canWrite || !file || !importProjectId) return;
    setNotice(null);
    const rows = parseCsv(await file.text());
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const familyCode = csvValue(row, ["codigo familiar", "codigo predial", "family_code"]);
      const representativeName = csvValue(row, ["representante", "nombre representante", "nombre del representante"]);
      const documentNumber = csvValue(row, ["documento", "cedula", "cédula"]);
      if (!familyCode || !representativeName) {
        skipped += 1;
        continue;
      }
      const duplicated = families.some((family) =>
        family.project_id === importProjectId &&
        (sameText(family.family_code, familyCode) ||
          (documentNumber && sameText(family.document_number, documentNumber)))
      );
      if (duplicated) {
        skipped += 1;
        continue;
      }
      const municipalityName = csvValue(row, ["municipio"]);
      const villageName = csvValue(row, ["vereda"]);
      const municipality = municipalities.find((item) => sameText(item.name, municipalityName));
      const village = villages.find((item) =>
        sameText(item.name, villageName) && (!municipality || item.municipality_id === municipality.id)
      );
      const { data, error } = await supabase
        .from("families")
        .insert({
          project_id: importProjectId,
          family_code: familyCode,
          representative_name: representativeName,
          document_number: documentNumber || null,
          birth_date: csvValue(row, ["fecha nacimiento", "fecha de nacimiento", "birth_date"]) || null,
          phone: csvValue(row, ["telefono", "teléfono"]) || null,
          municipality_id: municipality?.id ?? null,
          village_id: village?.id ?? null,
          status: "active",
          validation_status: "validated"
        })
        .select("id")
        .single();
      if (error) {
        skipped += 1;
        continue;
      }
      const propertyName = csvValue(row, ["predio", "nombre predio", "nombre del predio"]);
      const totalArea = csvValue(row, ["area predio", "área predio", "area del predio"]);
      if (propertyName || totalArea) {
        await supabase.from("properties").upsert({
          family_id: data.id,
          property_name: propertyName || null,
          total_area_ha: totalArea ? Number(totalArea) : null
        });
      }
      created += 1;
    }
    setNotice({ type: "info", message: `Importacion finalizada. Creadas: ${created}. Omitidas: ${skipped}.` });
    await onChange();
  }

  async function downloadFamiliesExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Familias");
    sheet.columns = [
      { header: "id", key: "id", width: 38, hidden: true },
      { header: "project_id", key: "project_id", width: 38, hidden: true },
      { header: "property_id", key: "property_id", width: 38, hidden: true },
      { header: "proyecto", key: "project_name", width: 34 },
      { header: "codigo_familia", key: "family_code", width: 18 },
      { header: "representante", key: "representative_name", width: 30 },
      { header: "documento", key: "document_number", width: 18 },
      { header: "fecha_nacimiento", key: "birth_date", width: 18 },
      { header: "edad", key: "age", width: 10 },
      { header: "telefono", key: "phone", width: 18 },
      { header: "municipio", key: "municipality_name", width: 22 },
      { header: "vereda", key: "village_name", width: 22 },
      { header: "predio", key: "property_name", width: 28 },
      { header: "area_predio", key: "total_area_ha", width: 14 },
      { header: "observaciones", key: "observations", width: 34 },
      { header: "activo", key: "active", width: 12 }
    ];
    const projectById = new Map(projects.map((project) => [project.id, project.name]));
    const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality.name]));
    const villageById = new Map(villages.map((village) => [village.id, village.name]));
    const propertyByFamily = new Map(properties.filter((property) => !property.is_deleted).map((property) => [property.family_id, property]));
    for (const family of families.filter((item) => !item.is_deleted)) {
      const property = propertyByFamily.get(family.id);
      sheet.addRow({
        id: family.id,
        project_id: family.project_id,
        property_id: property?.id ?? "",
        project_name: projectById.get(family.project_id) ?? "",
        family_code: family.family_code,
        representative_name: family.representative_name,
        document_number: family.document_number ?? "",
        birth_date: family.birth_date ?? "",
        age: family.age ?? "",
        phone: family.phone ?? "",
        municipality_name: family.municipality_id ? municipalityById.get(family.municipality_id) ?? "" : "",
        village_name: family.village_id ? villageById.get(family.village_id) ?? "" : "",
        property_name: property?.property_name ?? "",
        total_area_ha: property?.total_area_ha ?? "",
        observations: family.observations ?? "",
        active: family.status === "active" ? "SI" : "NO"
      });
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEEB" } };
    applyExcelDropdown(workbook, sheet, "active", ["SI", "NO"], false, "si_no");
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }), "familias.xlsx");
  }

  async function importFamiliesExcel(file: File | null) {
    if (!canWrite || !file) return;
    setNotice({ type: "info", message: "Procesando archivo, por favor espere..." });
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet("Familias") ?? workbook.worksheets[0];
    if (!sheet) {
      setNotice({ type: "error", message: "El archivo no contiene una hoja de familias." });
      return;
    }
    const headerByName = excelHeaderMap(sheet);
    const projectByName = new Map(projects.map((project) => [normalizeHeader(project.name), project.id]));
    const existingById = new Map(families.map((family) => [family.id, family]));
    const existingByProjectCode = new Map(families.filter((family) => !family.is_deleted).map((family) => [`${family.project_id}-${normalizeHeader(family.family_code)}`, family]));
    const existingByProjectDocument = new Map(families.filter((family) => !family.is_deleted && family.document_number).map((family) => [`${family.project_id}-${normalizeHeader(family.document_number ?? "")}`, family]));
    const propertyByFamily = new Map(properties.filter((property) => !property.is_deleted).map((property) => [property.family_id, property]));
    const errors: string[] = [];
    const operations: Array<{
      type: "update" | "insert";
      id?: string;
      generateFamilyCode?: boolean;
      projectId: string;
      propertyId?: string;
      propertyPayload?: Partial<Property>;
      payload: Partial<Family>;
    }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!excelRowHasValue(row)) continue;
      const id = materialExcelValue(row, headerByName, ["id"]);
      const projectId = materialExcelValue(row, headerByName, ["project_id"]) || projectByName.get(normalizeHeader(materialExcelValue(row, headerByName, ["proyecto"]))) || "";
      const familyCode = materialExcelValue(row, headerByName, ["codigo_familia", "codigo familiar", "codigo predial"]);
      const representativeName = materialExcelValue(row, headerByName, ["representante", "nombre representante"]);
      const documentNumber = materialExcelValue(row, headerByName, ["documento", "cedula"]);
      const municipalityName = materialExcelValue(row, headerByName, ["municipio"]);
      const villageName = materialExcelValue(row, headerByName, ["vereda"]);
      const municipality = municipalityName ? resolveFamilyMunicipalityForImport({
        projectId,
        municipalityName,
        municipalities,
        villages,
        projectMunicipalities,
        projectVillages,
        rowNumber,
        errors
      }) : undefined;
      const village = villageName ? resolveFamilyVillageForImport({
        projectId,
        municipality,
        villageName,
        villages,
        projectVillages,
        rowNumber,
        errors
      }) : undefined;
      const active = parseExcelBoolean(materialExcelValue(row, headerByName, ["activo", "estado"]) || "SI");
      const areaValue = materialExcelValue(row, headerByName, ["area_predio", "area predio"]);
      const totalArea = parseExcelNumber(areaValue || "0");
      if (id && !existingById.has(id)) errors.push(`Fila ${rowNumber}: el id de familia no existe.`);
      if (!projectId) errors.push(`Fila ${rowNumber}: proyecto es obligatorio o no existe.`);
      if (!representativeName) errors.push(`Fila ${rowNumber}: representante es obligatorio.`);
      if (active === null) errors.push(`Fila ${rowNumber}: activo debe ser SI o NO.`);
      if (totalArea === null) errors.push(`Fila ${rowNumber}: area_predio debe ser numerica.`);
      const duplicateCode = familyCode ? existingByProjectCode.get(`${projectId}-${normalizeHeader(familyCode)}`) : undefined;
      if (!id && duplicateCode) errors.push(`Fila ${rowNumber}: ya existe una familia con ese codigo en el proyecto.`);
      const duplicateDocument = documentNumber ? existingByProjectDocument.get(`${projectId}-${normalizeHeader(documentNumber)}`) : undefined;
      if (!id && duplicateDocument) errors.push(`Fila ${rowNumber}: ya existe una familia con ese documento en el proyecto.`);
      if (!projectId || !representativeName || active === null || totalArea === null || (id && !existingById.has(id)) || (!id && (duplicateCode || duplicateDocument)) || (municipalityName && !municipality) || (villageName && !village)) continue;
      const currentFamily = existingById.get(id);
      const propertyName = materialExcelValue(row, headerByName, ["predio", "nombre predio"]);
      operations.push({
        type: id ? "update" : "insert",
        id: id || undefined,
        generateFamilyCode: !id && !familyCode,
        projectId,
        propertyId: materialExcelValue(row, headerByName, ["property_id"]) || (id ? propertyByFamily.get(id)?.id : undefined),
        payload: {
          project_id: projectId,
          family_code: familyCode || currentFamily?.family_code,
          representative_name: representativeName,
          document_number: documentNumber || null,
          birth_date: materialExcelValue(row, headerByName, ["fecha_nacimiento", "fecha nacimiento"]) || null,
          age: parseExcelNumber(materialExcelValue(row, headerByName, ["edad"])) ?? null,
          phone: materialExcelValue(row, headerByName, ["telefono"]) || null,
          municipality_id: municipality?.id ?? null,
          village_id: village?.id ?? null,
          observations: materialExcelValue(row, headerByName, ["observaciones"]) || null,
          status: active ? "active" : "inactive",
          validation_status: currentFamily?.validation_status ?? "validated"
        },
        propertyPayload: propertyName || areaValue ? {
          property_name: propertyName || null,
          total_area_ha: totalArea
        } : undefined
      });
    }
    if (errors.length > 0) {
      setNotice({ type: "error", message: `No se aplicaron cambios. ${errors.slice(0, 6).join(" ")}` });
      return;
    }
    let updated = 0;
    let created = 0;
    const generatedCodes = new Set<string>();
    const updateOperations = operations.filter((operation) => operation.type === "update");
    const insertOperations = operations.filter((operation) => operation.type === "insert");
    for (const operation of updateOperations) {
      const result = await supabase.from("families").update(operation.payload).eq("id", operation.id);
      if (result.error) {
        setNotice({ type: "error", message: `Error al guardar familias: ${result.error.message}` });
        return;
      }
      const familyId = operation.id;
      if (familyId && operation.propertyPayload) {
        const propertyResult = operation.propertyId
          ? await supabase.from("properties").update(operation.propertyPayload).eq("id", operation.propertyId)
          : await supabase.from("properties").insert({ ...operation.propertyPayload, family_id: familyId });
        if (propertyResult.error) {
          setNotice({ type: "error", message: `Familia guardada, pero no se pudo guardar predio: ${propertyResult.error.message}` });
          return;
        }
      }
      updated += 1;
    }
    for (const operation of insertOperations) {
      if (operation.type === "insert" && operation.generateFamilyCode) {
        const generatedCode = await generateNextFamilyCode(operation.projectId, generatedCodes);
        if (!generatedCode) return;
        operation.payload.family_code = generatedCode;
      }
    }
    if (insertOperations.length > 0) {
      const insertResult = await supabase
        .from("families")
        .insert(insertOperations.map((operation) => operation.payload))
        .select("id,family_code");
      if (insertResult.error) {
        setNotice({ type: "error", message: `No se crearon familias. Supabase rechazo el lote: ${insertResult.error.message}` });
        return;
      }
      const insertedFamilies = (insertResult.data ?? []) as Array<{ id: string; family_code: string | null }>;
      const familyIdByCode = new Map(insertedFamilies.map((family) => [normalizeHeader(family.family_code ?? ""), family.id]));
      const propertyRows = insertOperations
        .map((operation) => {
          const familyCode = operation.payload.family_code ? normalizeHeader(String(operation.payload.family_code)) : "";
          const familyId = familyIdByCode.get(familyCode);
          return familyId && operation.propertyPayload ? { ...operation.propertyPayload, family_id: familyId } : null;
        })
        .filter((property): property is Partial<Property> & { family_id: string } => Boolean(property));
      if (propertyRows.length > 0) {
        const propertyResult = await supabase.from("properties").insert(propertyRows);
        if (propertyResult.error) {
          setNotice({ type: "error", message: `Familias creadas, pero no se pudo guardar predios: ${propertyResult.error.message}` });
          return;
        }
      }
      created = insertOperations.length;
    }
    setNotice({ type: "info", message: `Actualizacion masiva finalizada. Actualizadas: ${updated}. Creadas: ${created}.` });
    await onChange();
    } catch (error: any) {
      console.error(error);
      setNotice({ type: "error", message: `Error inesperado procesando el archivo: ${error?.message || "Archivo invalido o bloqueado"}` });
    }
  }

  return (
    <CrudSection title="Familias" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Actualizacion masiva desde Excel</strong></div>
        <p className="span-12 muted">Descargue el listado, edite familias, municipio, vereda, predio o area y suba el mismo archivo actualizado.</p>
        <div className="span-4 form-actions">
          <button className="secondary" type="button" onClick={() => void downloadFamiliesExcel()}>Descargar listado familias</button>
        </div>
        <label className="span-8">
          Archivo Excel actualizado
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!canWrite}
            onChange={(event) => {
              void importFamiliesExcel(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <details className="panel" open={Boolean(editingId)}>
        <summary><strong>{editingId ? "Editar familia" : "Nueva familia"}</strong></summary>
        <form className="grid mt-4" onSubmit={save}>
          <SelectProject
            projects={projects}
            value={form.project_id}
            onChange={(project_id) =>
              setForm({ ...form, project_id, municipality_id: "", village_id: "" })
            }
          />
          <TextInput
            label="Codigo familiar (opcional)"
            value={form.family_code}
            onChange={(family_code) => setForm({ ...form, family_code })}
          />
          <TextInput
            label="Representante"
            value={form.representative_name}
            onChange={(representative_name) => setForm({ ...form, representative_name })}
            required
          />
          <TextInput
            label="Documento"
            value={form.document_number}
            onChange={(document_number) => setForm({ ...form, document_number })}
          />
          <TextInput label="Edad" type="number" value={form.age} onChange={(age) => setForm({ ...form, age })} />
          <TextInput label="Fecha de nacimiento" type="date" value={form.birth_date} onChange={(birth_date) => setForm({ ...form, birth_date })} />
          <TextInput label="Telefono" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <label className="span-4">
            Municipio
            <select value={form.municipality_id} onChange={(event) => setForm({ ...form, municipality_id: event.target.value })}>
              <option value="">Sin municipio</option>
              {scopedMunicipalities.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>{municipality.name}</option>
              ))}
            </select>
          </label>
          <label className="span-4">
            Vereda
            <select value={form.village_id} onChange={(event) => setForm({ ...form, village_id: event.target.value })}>
              <option value="">Sin vereda</option>
              {scopedVillages.map((village) => (
                <option key={village.id} value={village.id}>{village.name}</option>
              ))}
            </select>
          </label>
          <TextInput
            className="span-12"
            label="Observaciones"
            value={form.observations}
            onChange={(observations) => setForm({ ...form, observations })}
          />
          <div className="span-12 form-actions">
            <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
            {editingId ? (
              <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyFamily); }}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </details>

      <div className="panel grid">
        <div className="span-12"><strong>Buscar y filtrar familias</strong></div>
        <TextInput
          className="span-3"
          label="Buscar por nombre, documento o codigo"
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <label className="span-3">
          Departamento
          <select value={filterDepartmentId} onChange={(e) => { setFilterDepartmentId(e.target.value); setFilterMunicipalityId(""); setFilterVillageId(""); }}>
            <option value="">Todos</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="span-3">
          Municipio
          <select value={filterMunicipalityId} onChange={(e) => { setFilterMunicipalityId(e.target.value); setFilterVillageId(""); }}>
            <option value="">Todos</option>
            {municipalities.filter(m => !filterDepartmentId || m.department_id === filterDepartmentId).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="span-3">
          Vereda
          <select value={filterVillageId} onChange={(e) => setFilterVillageId(e.target.value)}>
            <option value="">Todas</option>
            {villages.filter(v => !filterMunicipalityId || v.municipality_id === filterMunicipalityId).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        headers={["Codigo", "Representante", "Documento", "Edad", "Estado", "Acciones"]}
        rows={filteredFamilies.map((family) => [
          family.family_code,
          family.representative_name,
          family.document_number ?? "",
          family.birth_date ? String(calculateAge(family.birth_date, new Date().getFullYear())) : family.age ?? "",
          <span className="badge" key="status">{family.status}</span>,
          <Actions key="actions" canWrite={canWrite} onEdit={() => edit(family)} onDelete={() => remove(family.id)} />
        ])}
      />
    </CrudSection>
  );
}

function ActivitiesCrud({
  activities,
  projects,
  canWrite,
  onChange
}: {
  activities: Activity[];
  projects: Project[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyActivity);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [importProjectId, setImportProjectId] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");

  const filteredActivities = activities.filter((activity) => {
    if (activity.is_deleted) return false;
    if (searchQuery && !activity.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStrategy && activity.restoration_strategy !== filterStrategy) return false;
    return true;
  });

  function edit(activity: Activity) {
    setEditingId(activity.id);
    setForm({
      project_id: activity.project_id ?? "",
      name: activity.name,
      category: "",
      restoration_strategy: normalizeRestorationStrategy(activity.restoration_strategy),
      description: activity.description ?? "",
      unit: activity.unit,
      indicator_type: activity.indicator_type ?? "physical",
      requires_baseline: activity.requires_baseline,
      requires_target: activity.requires_target,
      allows_project_materials: activity.allows_project_materials,
      allows_counterpart: activity.allows_counterpart,
      maintenance_enabled: activity.maintenance_enabled ?? true,
      maintenance_deshierbe_required: Number(activity.maintenance_deshierbe_required ?? 1),
      maintenance_deshierbe_optional: Number(activity.maintenance_deshierbe_optional ?? 0),
      maintenance_fertilization_required: Number(activity.maintenance_fertilization_required ?? 1),
      maintenance_fertilization_optional: Number(activity.maintenance_fertilization_optional ?? 0),
      maintenance_pruning_required: Number(activity.maintenance_pruning_required ?? 1),
      maintenance_pruning_optional: Number(activity.maintenance_pruning_optional ?? 0),
      maintenance_replanting_optional: Number(activity.maintenance_replanting_optional ?? 0),
      active: activity.active
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    const payload = {
      ...form,
      project_id: form.project_id || null,
      category: null,
      restoration_strategy: normalizeRestorationStrategy(form.restoration_strategy),
      description: form.description || null,
      indicator_type: form.indicator_type || null
    };
    let result = editingId
      ? await supabase.from("activity_catalog").update(payload).eq("id", editingId)
      : await supabase.from("activity_catalog").insert(payload);
    if (result.error && (isMissingActivityStrategyColumnError(result.error) || isMissingActivityMaintenanceColumnError(result.error))) {
      const {
        restoration_strategy,
        maintenance_enabled,
        maintenance_deshierbe_required,
        maintenance_deshierbe_optional,
        maintenance_fertilization_required,
          maintenance_fertilization_optional,
          maintenance_pruning_required,
          maintenance_pruning_optional,
          maintenance_replanting_optional,
          ...fallbackPayload
        } = payload;
      result = editingId
        ? await supabase.from("activity_catalog").update(fallbackPayload).eq("id", editingId)
        : await supabase.from("activity_catalog").insert(fallbackPayload);
      if (!result.error) {
        setNotice({
          type: "info",
          message: "Actividad guardada sin columnas nuevas porque Supabase aun no refresco la migracion. Aplique la migracion y ejecute notify pgrst, 'reload schema';."
        });
      }
    }
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setEditingId(null);
    setForm(emptyActivity);
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("activity_catalog").update({ is_deleted: true, active: false }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  async function importActivities(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const rows = parseCsv(await file.text());
    let created = 0;
    let skipped = 0;
    const payload = rows.flatMap((row) => {
      const name = csvValue(row, ["nombre", "actividad", "nombre actividad"]);
      const unit = csvValue(row, ["unidad", "unidad de medida"]);
      if (!name || !unit) {
        skipped += 1;
        return [];
      }
      const duplicate = activities.some((activity) =>
        (activity.project_id ?? "") === importProjectId && sameText(activity.name, name)
      );
      if (duplicate) {
        skipped += 1;
        return [];
      }
      created += 1;
      return [{
        project_id: importProjectId || null,
        name,
        restoration_strategy: normalizeRestorationStrategy(csvValue(row, ["estrategia", "estrategia restauracion", "estrategia restauración"])),
        category: csvValue(row, ["categoria", "categoría"]) || null,
        unit,
        requires_baseline: csvBool(csvValue(row, ["requiere linea base", "linea base"]), false),
        requires_target: csvBool(csvValue(row, ["requiere meta", "meta"]), true),
        active: csvBool(csvValue(row, ["activo", "estado"]), true),
        allows_project_materials: true,
        allows_counterpart: true,
        maintenance_enabled: true,
        maintenance_deshierbe_required: 1,
        maintenance_deshierbe_optional: 0,
        maintenance_fertilization_required: 1,
        maintenance_fertilization_optional: 0,
        maintenance_pruning_required: 1,
        maintenance_pruning_optional: 0,
        maintenance_replanting_optional: 0,
        indicator_type: "physical"
      }];
    });
    if (payload.length > 0) {
      let result = await supabase.from("activity_catalog").insert(payload);
      if (result.error && (isMissingActivityStrategyColumnError(result.error) || isMissingActivityMaintenanceColumnError(result.error))) {
        const fallbackPayload = payload.map(({
          restoration_strategy,
          maintenance_enabled,
          maintenance_deshierbe_required,
          maintenance_deshierbe_optional,
          maintenance_fertilization_required,
          maintenance_fertilization_optional,
          maintenance_pruning_required,
          maintenance_pruning_optional,
          maintenance_replanting_optional,
          ...row
        }) => row);
        result = await supabase.from("activity_catalog").insert(fallbackPayload);
        if (!result.error) {
          setNotice({
            type: "info",
            message: "Actividades importadas sin columnas nuevas porque Supabase aun no refresco la migracion. Aplique la migracion y ejecute notify pgrst, 'reload schema';."
          });
        }
      }
      if (result.error) {
        setNotice({ type: "error", message: result.error.message });
        return;
      }
    }
    setNotice({ type: "info", message: `Importacion finalizada. Creadas: ${created}. Omitidas: ${skipped}.` });
    await onChange();
  }

  async function downloadActivitiesExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Actividades");
    sheet.columns = [
      { header: "id", key: "id", width: 38, hidden: true },
      { header: "project_id", key: "project_id", width: 38, hidden: true },
      { header: "proyecto", key: "project_name", width: 34 },
      { header: "nombre_actividad", key: "name", width: 34 },
      { header: "estrategia", key: "restoration_strategy", width: 28 },
      { header: "unidad", key: "unit", width: 16 },
      { header: "indicador", key: "indicator_type", width: 18 },
      { header: "requiere_linea_base", key: "requires_baseline", width: 20 },
      { header: "requiere_meta", key: "requires_target", width: 16 },
      { header: "materiales_proyecto", key: "allows_project_materials", width: 20 },
      { header: "contrapartida", key: "allows_counterpart", width: 16 },
      { header: "mantenimiento_aplica", key: "maintenance_enabled", width: 22 },
      { header: "deshierbes_obligatorios", key: "maintenance_deshierbe_required", width: 24 },
      { header: "deshierbes_opcionales", key: "maintenance_deshierbe_optional", width: 22 },
      { header: "fertilizaciones_obligatorias", key: "maintenance_fertilization_required", width: 28 },
      { header: "fertilizaciones_opcionales", key: "maintenance_fertilization_optional", width: 26 },
      { header: "podas_obligatorias", key: "maintenance_pruning_required", width: 22 },
      { header: "podas_opcionales", key: "maintenance_pruning_optional", width: 20 },
      { header: "resiembras_opcionales", key: "maintenance_replanting_optional", width: 23 },
      { header: "descripcion", key: "description", width: 48 },
      { header: "activo", key: "active", width: 12 }
    ];
    const projectById = new Map(projects.map((project) => [project.id, project.name]));
    for (const activity of activities.filter((item) => !item.is_deleted)) {
      sheet.addRow({
        id: activity.id,
        project_id: activity.project_id ?? "",
        project_name: activity.project_id ? projectById.get(activity.project_id) ?? "" : "",
        name: activity.name,
        restoration_strategy: normalizeRestorationStrategy(activity.restoration_strategy),
        unit: activity.unit,
        indicator_type: activity.indicator_type ?? "physical",
        requires_baseline: activity.requires_baseline ? "SI" : "NO",
        requires_target: activity.requires_target ? "SI" : "NO",
        allows_project_materials: activity.allows_project_materials ? "SI" : "NO",
        allows_counterpart: activity.allows_counterpart ? "SI" : "NO",
        maintenance_enabled: (activity.maintenance_enabled ?? true) ? "SI" : "NO",
        maintenance_deshierbe_required: Number(activity.maintenance_deshierbe_required ?? 1),
        maintenance_deshierbe_optional: Number(activity.maintenance_deshierbe_optional ?? 0),
        maintenance_fertilization_required: Number(activity.maintenance_fertilization_required ?? 1),
        maintenance_fertilization_optional: Number(activity.maintenance_fertilization_optional ?? 0),
        maintenance_pruning_required: Number(activity.maintenance_pruning_required ?? 1),
        maintenance_pruning_optional: Number(activity.maintenance_pruning_optional ?? 0),
        maintenance_replanting_optional: Number(activity.maintenance_replanting_optional ?? 0),
        description: activity.description ?? "",
        active: activity.active ? "SI" : "NO"
      });
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEEB" } };
    for (const key of ["requires_baseline", "requires_target", "allows_project_materials", "allows_counterpart", "maintenance_enabled", "active"]) {
      applyExcelDropdown(workbook, sheet, key, ["SI", "NO"], false, "si_no");
    }
    applyExcelDropdown(workbook, sheet, "restoration_strategy", ["restauracion_ecologica", "rehabilitacion_ecologica", "recuperacion_ecologica", "no_aplica"], false, "estrategia");
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }), "actividades.xlsx");
  }

  async function importActivitiesExcel(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet("Actividades") ?? workbook.worksheets[0];
    if (!sheet) {
      setNotice({ type: "error", message: "El archivo no contiene una hoja de actividades." });
      return;
    }
    const headerByName = excelHeaderMap(sheet);
    const projectByName = new Map(projects.map((project) => [normalizeHeader(project.name), project.id]));
    const existingById = new Map(activities.map((activity) => [activity.id, activity]));
    const existingByProjectName = new Map(activities.filter((activity) => !activity.is_deleted).map((activity) => [`${activity.project_id ?? ""}-${normalizeHeader(activity.name)}`, activity]));
    const errors: string[] = [];
    const operations: Array<{ type: "update" | "insert"; id?: string; payload: Partial<Activity> }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!excelRowHasValue(row)) continue;
      const id = materialExcelValue(row, headerByName, ["id"]);
      const projectId = materialExcelValue(row, headerByName, ["project_id"]) || projectByName.get(normalizeHeader(materialExcelValue(row, headerByName, ["proyecto"]))) || "";
      const name = materialExcelValue(row, headerByName, ["nombre_actividad", "nombre actividad", "nombre", "actividad"]);
      const unit = materialExcelValue(row, headerByName, ["unidad", "unidad de medida"]);
      const strategy = normalizeRestorationStrategy(materialExcelValue(row, headerByName, ["estrategia"]));
      const requiresBaseline = parseExcelBoolean(materialExcelValue(row, headerByName, ["requiere_linea_base", "requiere linea base", "linea base"]) || "NO");
      const requiresTarget = parseExcelBoolean(materialExcelValue(row, headerByName, ["requiere_meta", "requiere meta", "meta"]) || "SI");
      const allowsProjectMaterials = parseExcelBoolean(materialExcelValue(row, headerByName, ["materiales_proyecto", "materiales proyecto"]) || "SI");
      const allowsCounterpart = parseExcelBoolean(materialExcelValue(row, headerByName, ["contrapartida"]) || "SI");
      const maintenanceEnabled = parseExcelBoolean(materialExcelValue(row, headerByName, ["mantenimiento_aplica", "mantenimiento aplica"]) || "SI");
      const maintenanceDeshierbeRequired = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["deshierbes_obligatorios", "deshierbes obligatorios"]) || "1");
      const maintenanceDeshierbeOptional = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["deshierbes_opcionales", "deshierbes opcionales"]) || "0");
      const maintenanceFertilizationRequired = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["fertilizaciones_obligatorias", "fertilizaciones obligatorias"]) || "1");
      const maintenanceFertilizationOptional = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["fertilizaciones_opcionales", "fertilizaciones opcionales"]) || "0");
      const maintenancePruningRequired = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["podas_obligatorias", "podas obligatorias"]) || "1");
      const maintenancePruningOptional = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["podas_opcionales", "podas opcionales"]) || "0");
      const maintenanceReplantingOptional = parseExcelNonNegativeInteger(materialExcelValue(row, headerByName, ["resiembras_opcionales", "resiembras opcionales"]) || "0");
      const active = parseExcelBoolean(materialExcelValue(row, headerByName, ["activo", "estado"]) || "SI");
      if (id && !existingById.has(id)) errors.push(`Fila ${rowNumber}: el id de actividad no existe.`);
      if (!name) errors.push(`Fila ${rowNumber}: nombre_actividad es obligatorio.`);
      if (!unit) errors.push(`Fila ${rowNumber}: unidad es obligatoria.`);
      if (requiresBaseline === null || requiresTarget === null || allowsProjectMaterials === null || allowsCounterpart === null || maintenanceEnabled === null || active === null) errors.push(`Fila ${rowNumber}: los campos SI/NO deben contener SI o NO.`);
      if ([maintenanceDeshierbeRequired, maintenanceDeshierbeOptional, maintenanceFertilizationRequired, maintenanceFertilizationOptional, maintenancePruningRequired, maintenancePruningOptional, maintenanceReplantingOptional].some((value) => value === null)) {
        errors.push(`Fila ${rowNumber}: los campos de mantenimiento deben ser enteros mayores o iguales a cero.`);
      }
      const duplicate = existingByProjectName.get(`${projectId}-${normalizeHeader(name)}`);
      if (!id && duplicate) errors.push(`Fila ${rowNumber}: ya existe una actividad con ese nombre en el proyecto.`);
      if (!name || !unit || active === null || requiresBaseline === null || requiresTarget === null || allowsProjectMaterials === null || allowsCounterpart === null || maintenanceEnabled === null || maintenanceDeshierbeRequired === null || maintenanceDeshierbeOptional === null || maintenanceFertilizationRequired === null || maintenanceFertilizationOptional === null || maintenancePruningRequired === null || maintenancePruningOptional === null || maintenanceReplantingOptional === null || (id && !existingById.has(id)) || (!id && duplicate)) continue;
      operations.push({
        type: id ? "update" : "insert",
        id: id || undefined,
        payload: {
          project_id: projectId || null,
          name,
          category: null,
          restoration_strategy: strategy,
          unit,
          indicator_type: materialExcelValue(row, headerByName, ["indicador"]) || "physical",
          requires_baseline: requiresBaseline,
          requires_target: requiresTarget,
          allows_project_materials: allowsProjectMaterials,
          allows_counterpart: allowsCounterpart,
          maintenance_enabled: maintenanceEnabled,
          maintenance_deshierbe_required: maintenanceDeshierbeRequired,
          maintenance_deshierbe_optional: maintenanceDeshierbeOptional,
          maintenance_fertilization_required: maintenanceFertilizationRequired,
          maintenance_fertilization_optional: maintenanceFertilizationOptional,
          maintenance_pruning_required: maintenancePruningRequired,
          maintenance_pruning_optional: maintenancePruningOptional,
          maintenance_replanting_optional: maintenanceReplantingOptional,
          description: materialExcelValue(row, headerByName, ["descripcion", "descripcion"]) || null,
          active
        }
      });
    }
    if (errors.length > 0) {
      setNotice({ type: "error", message: `No se aplicaron cambios. ${errors.slice(0, 6).join(" ")}` });
      return;
    }
    let updated = 0;
    let created = 0;
    for (const operation of operations) {
      let result = operation.type === "update"
        ? await supabase.from("activity_catalog").update(operation.payload).eq("id", operation.id)
        : await supabase.from("activity_catalog").insert(operation.payload);
      if (result.error && (isMissingActivityStrategyColumnError(result.error) || isMissingActivityMaintenanceColumnError(result.error))) {
        const {
          restoration_strategy,
          maintenance_enabled,
          maintenance_deshierbe_required,
          maintenance_deshierbe_optional,
          maintenance_fertilization_required,
          maintenance_fertilization_optional,
          maintenance_pruning_required,
          maintenance_pruning_optional,
          maintenance_replanting_optional,
          ...fallbackPayload
        } = operation.payload;
        result = operation.type === "update"
          ? await supabase.from("activity_catalog").update(fallbackPayload).eq("id", operation.id)
          : await supabase.from("activity_catalog").insert(fallbackPayload);
      }
      if (result.error) {
        setNotice({ type: "error", message: `Error al guardar actividades: ${result.error.message}` });
        return;
      }
      if (operation.type === "update") updated += 1;
      else created += 1;
    }
    setNotice({ type: "info", message: `Actualizacion masiva finalizada. Actualizadas: ${updated}. Creadas: ${created}.` });
    await onChange();
  }

  return (
    <CrudSection title="Catalogo de actividades" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Actualizacion masiva desde Excel</strong></div>
        <p className="span-12 muted">Descargue el listado, edite actividades, estrategia, unidad o estado y suba el mismo archivo actualizado.</p>
        <div className="span-4 form-actions">
          <button className="secondary" type="button" onClick={() => void downloadActivitiesExcel()}>Descargar listado actividades</button>
        </div>
        <label className="span-8">
          Archivo Excel actualizado
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!canWrite}
            onChange={(event) => {
              void importActivitiesExcel(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <details className="panel" open={Boolean(editingId)}>
        <summary><strong>{editingId ? "Editar actividad" : "Nueva actividad"}</strong></summary>
        <form className="grid mt-4" onSubmit={save}>
        <SelectProject projects={projects} value={form.project_id} onChange={(project_id) => setForm({ ...form, project_id })} />
        <TextInput label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <label className="span-4">
          Estrategia
          <select
            value={form.restoration_strategy}
            onChange={(event) => setForm({ ...form, restoration_strategy: normalizeRestorationStrategy(event.target.value) })}
          >
            {RESTORATION_STRATEGIES.map((strategy) => (
              <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
            ))}
          </select>
        </label>
        <TextInput label="Unidad" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} required />
        <TextInput
          label="Indicador"
          value={form.indicator_type}
          onChange={(indicator_type) => setForm({ ...form, indicator_type })}
        />
        <TextInput
          className="span-12"
          label="Descripcion"
          value={form.description}
          onChange={(description) => setForm({ ...form, description })}
        />
        <Toggle label="Linea base" value={form.requires_baseline} onChange={(requires_baseline) => setForm({ ...form, requires_baseline })} />
        <Toggle label="Meta" value={form.requires_target} onChange={(requires_target) => setForm({ ...form, requires_target })} />
        <Toggle
          label="Materiales proyecto"
          value={form.allows_project_materials}
          onChange={(allows_project_materials) => setForm({ ...form, allows_project_materials })}
        />
        <Toggle
          label="Contrapartida"
          value={form.allows_counterpart}
          onChange={(allows_counterpart) => setForm({ ...form, allows_counterpart })}
        />
        <Toggle
          label="Mantenimiento"
          value={form.maintenance_enabled}
          onChange={(maintenance_enabled) => setForm({ ...form, maintenance_enabled })}
        />
        <label className="span-3">
          Deshierbes obligatorios
          <input min="0" step="1" type="number" value={form.maintenance_deshierbe_required} onChange={(event) => setForm({ ...form, maintenance_deshierbe_required: Number(event.target.value || 0) })} />
        </label>
        <label className="span-3">
          Deshierbes opcionales
          <input min="0" step="1" type="number" value={form.maintenance_deshierbe_optional} onChange={(event) => setForm({ ...form, maintenance_deshierbe_optional: Number(event.target.value || 0) })} />
        </label>
        <label className="span-3">
          Fertilizaciones obligatorias
          <input min="0" step="1" type="number" value={form.maintenance_fertilization_required} onChange={(event) => setForm({ ...form, maintenance_fertilization_required: Number(event.target.value || 0) })} />
        </label>
        <label className="span-3">
          Fertilizaciones opcionales
          <input min="0" step="1" type="number" value={form.maintenance_fertilization_optional} onChange={(event) => setForm({ ...form, maintenance_fertilization_optional: Number(event.target.value || 0) })} />
        </label>
        <label className="span-3">
          Podas obligatorias
          <input min="0" step="1" type="number" value={form.maintenance_pruning_required} onChange={(event) => setForm({ ...form, maintenance_pruning_required: Number(event.target.value || 0) })} />
        </label>
        <label className="span-3">
          Podas opcionales
          <input min="0" step="1" type="number" value={form.maintenance_pruning_optional} onChange={(event) => setForm({ ...form, maintenance_pruning_optional: Number(event.target.value || 0) })} />
        </label>
        <label className="span-3">
          Resiembras opcionales
          <input min="0" step="1" type="number" value={form.maintenance_replanting_optional} onChange={(event) => setForm({ ...form, maintenance_replanting_optional: Number(event.target.value || 0) })} />
        </label>
        <div className="span-12 form-actions">
          <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? (
            <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyActivity); }}>
              Cancelar
            </button>
          ) : null}
        </div>
        </form>
      </details>

      <div className="panel grid">
        <div className="span-12"><strong>Buscar y filtrar actividades</strong></div>
        <TextInput
          className="span-6"
          label="Buscar por nombre"
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <label className="span-6">
          Estrategia
          <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)}>
            <option value="">Todas</option>
            {RESTORATION_STRATEGIES.map((strategy) => (
              <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        headers={["Nombre", "Estrategia", "Unidad", "Activo", "Acciones"]}
        rows={filteredActivities.map((activity) => [
          activity.name,
          restorationStrategyLabel(activity.restoration_strategy),
          activity.unit,
          activity.active ? "Si" : "No",
          <Actions key="actions" canWrite={canWrite} onEdit={() => edit(activity)} onDelete={() => remove(activity.id)} />
        ])}
      />
    </CrudSection>
  );
}

function MaterialsCrud({
  materials,
  projects,
  canWrite,
  onChange
}: {
  materials: Material[];
  projects: Project[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyMaterial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [importProjectId, setImportProjectId] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterEtecBlock, setFilterEtecBlock] = useState("");

  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const filteredMaterials = materials.filter((material) => {
    if (material.is_deleted) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = material.name.toLowerCase().includes(q);
      const matchesCode = material.internal_code?.toLowerCase().includes(q) ?? false;
      if (!matchesName && !matchesCode) return false;
    }
    if (filterEtecBlock && material.etec_block !== filterEtecBlock) return false;
    return true;
  });

  const totalItems = filteredMaterials.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (normalizedPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalItems);
  const visibleMaterials = filteredMaterials.slice(pageStart, pageEnd);

  function edit(material: Material) {
    setEditingId(material.id);
    setForm({
      project_id: material.project_id ?? "",
      internal_code: material.internal_code ?? "",
      name: material.name,
      category: "",
      unit: material.unit,
      quoted_unit_price: material.quoted_unit_price.toString(),
      price_updated_at: material.price_updated_at ?? "",
      etec_block: material.etec_block ?? "",
      technical_characteristics: material.technical_characteristics ?? "",
      vegetal_indicator_group: material.vegetal_indicator_group ?? "",
      observations: material.observations ?? "",
      active: material.active
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    const payload = {
      ...form,
      project_id: form.project_id || null,
      internal_code: form.internal_code || null,
      category: null,
      quoted_unit_price: Number(form.quoted_unit_price || 0),
      price_updated_at: form.price_updated_at || null,
      etec_block: form.etec_block || null,
      technical_characteristics: form.technical_characteristics || null,
      vegetal_indicator_group: form.vegetal_indicator_group || null,
      observations: form.observations || null
    };
    const result = editingId
      ? await supabase.from("material_catalog").update(payload).eq("id", editingId)
      : await supabase.from("material_catalog").insert(payload);
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setEditingId(null);
    setForm(emptyMaterial);
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("material_catalog").update({ is_deleted: true, active: false }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  async function importMaterials(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const rows = parseCsv(await file.text());
    let created = 0;
    let skipped = 0;
    const payload = rows.flatMap((row) => {
      const name = csvValue(row, ["nombre", "material", "nombre material"]);
      const unit = csvValue(row, ["unidad", "unidad de medida"]);
      if (!name || !unit) {
        skipped += 1;
        return [];
      }
      const duplicate = materials.some((material) =>
        (material.project_id ?? "") === importProjectId &&
        sameText(material.name, name) &&
        sameText(material.unit, unit)
      );
      if (duplicate) {
        skipped += 1;
        return [];
      }
      const rawEtecBlock = csvValue(row, ["bloque etec", "bloque", "etec"]);
      const rawVegetalGroup = csvValue(row, ["grupo vegetal", "indicador vegetal", "grupo indicador vegetal", "material vegetal"]);
      created += 1;
      return [{
        project_id: importProjectId || null,
        internal_code: csvValue(row, ["codigo", "codigo interno"]) || null,
        name,
        category: null,
        unit,
        quoted_unit_price: Number(csvValue(row, ["valor unitario", "precio", "precio cotizado"]) || 0),
        etec_block: rawEtecBlock ? normalizeEtecBlock(rawEtecBlock) : "Otros",
        technical_characteristics: csvValue(row, ["caracteristicas", "caracteristicas tecnicas", "caracteristicas técnicas", "especificaciones"]) || null,
        vegetal_indicator_group: normalizeVegetalIndicatorGroup(rawVegetalGroup),
        active: csvBool(csvValue(row, ["activo", "estado"]), true)
      }];
    });
    if (payload.length > 0) {
      const { error } = await supabase.from("material_catalog").insert(payload);
      if (error) {
        setNotice({ type: "error", message: error.message });
        return;
      }
    }
    setNotice({ type: "info", message: `Importacion finalizada. Creados: ${created}. Omitidos: ${skipped}.` });
    await onChange();
  }

  async function downloadMaterialsExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Materiales");
    sheet.columns = [
      { header: "id", key: "id", width: 38, hidden: true },
      { header: "project_id", key: "project_id", width: 38, hidden: true },
      { header: "proyecto", key: "project_name", width: 34 },
      { header: "codigo_interno", key: "internal_code", width: 18 },
      { header: "nombre_material", key: "name", width: 34 },
      { header: "unidad", key: "unit", width: 16 },
      { header: "valor_unitario_cotizado", key: "quoted_unit_price", width: 22 },
      { header: "bloque_etec", key: "etec_block", width: 22 },
      { header: "caracteristicas_tecnicas", key: "technical_characteristics", width: 54 },
      { header: "grupo_vegetal_indicadores", key: "vegetal_indicator_group", width: 28 },
      { header: "observaciones", key: "observations", width: 34 },
      { header: "activo", key: "active", width: 12 }
    ];
    const projectById = new Map(projects.map((project) => [project.id, project.name]));
    for (const material of materials.filter((item) => !item.is_deleted)) {
      sheet.addRow({
        id: material.id,
        project_id: material.project_id ?? "",
        project_name: material.project_id ? projectById.get(material.project_id) ?? "" : "",
        internal_code: material.internal_code ?? "",
        name: material.name,
        unit: material.unit,
        quoted_unit_price: Number(material.quoted_unit_price ?? 0),
        etec_block: material.etec_block ?? "Otros",
        technical_characteristics: material.technical_characteristics ?? "",
        vegetal_indicator_group: material.vegetal_indicator_group ?? "",
        observations: material.observations ?? "",
        active: material.active ? "SI" : "NO"
      });
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEEB" } };
    sheet.getColumn("quoted_unit_price").numFmt = "$ #,##0.00";
    sheet.getColumn("technical_characteristics").alignment = { wrapText: true, vertical: "top" };
    sheet.getColumn("observations").alignment = { wrapText: true, vertical: "top" };
    applyExcelDropdown(workbook, sheet, "active", ["SI", "NO"], false, "si_no");
    applyExcelDropdown(workbook, sheet, "etec_block", ETEC_DEFAULT_BLOCKS, false, "bloque_etec");
    applyExcelDropdown(workbook, sheet, "vegetal_indicator_group", ["colinos", "cacao", "frutales", "forestales_nativos", "otro"], true, "grupo_vegetal");
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }), "materiales-catalogo.xlsx");
  }

  async function importMaterialsExcel(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet("Materiales") ?? workbook.worksheets[0];
    if (!sheet) {
      setNotice({ type: "error", message: "El archivo no contiene una hoja de materiales." });
      return;
    }

    const headerByName = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, columnNumber) => {
      const header = normalizeHeader(excelCellText(cell.value));
      if (header) headerByName.set(header, columnNumber);
    });

    const existingById = new Map(materials.map((material) => [material.id, material]));
    const projectByName = new Map(projects.map((project) => [normalizeHeader(project.name), project.id]));
    const existingByProjectName = new Map(
      materials
        .filter((material) => !material.is_deleted)
        .map((material) => [`${material.project_id ?? ""}-${normalizeHeader(material.name)}`, material])
    );
    const pendingNewKeys = new Set<string>();
    const errors: string[] = [];
    const operations: Array<{
      type: "update" | "insert";
      id?: string;
      payload: {
        project_id: string | null;
        internal_code: string | null;
        name: string;
        category: string | null;
        unit: string;
        quoted_unit_price: number;
        etec_block: string | null;
        technical_characteristics: string | null;
        vegetal_indicator_group: ReturnType<typeof normalizeVegetalIndicatorGroup>;
        observations: string | null;
        active: boolean;
      };
    }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const rowHasValue = row.values instanceof Array && row.values.some((value, index) => index > 0 && excelCellText(value).trim() !== "");
      if (!rowHasValue) continue;

      const id = materialExcelValue(row, headerByName, ["id"]);
      const hiddenProjectId = materialExcelValue(row, headerByName, ["project_id"]);
      const projectName = materialExcelValue(row, headerByName, ["proyecto", "project"]);
      const projectId = hiddenProjectId || (projectName ? projectByName.get(normalizeHeader(projectName)) ?? "" : "");
      const name = materialExcelValue(row, headerByName, ["nombre_material", "nombre material", "nombre", "material"]);
      const unit = materialExcelValue(row, headerByName, ["unidad", "unidad de medida"]);
      const rawPrice = materialExcelValue(row, headerByName, ["valor_unitario_cotizado", "valor unitario cotizado", "valor unitario", "precio", "precio cotizado"]);
      const rawActive = materialExcelValue(row, headerByName, ["activo", "estado"]) || "SI";
      const rawEtecBlock = materialExcelValue(row, headerByName, ["bloque_etec", "bloque etec", "bloque"]);
      const rawVegetalGroup = materialExcelValue(row, headerByName, ["grupo_vegetal_indicadores", "grupo vegetal", "indicador vegetal", "material vegetal"]);

      if (projectName && !projectId) errors.push(`Fila ${rowNumber}: el proyecto "${projectName}" no existe.`);
      if (!name) errors.push(`Fila ${rowNumber}: nombre_material es obligatorio.`);
      if (!unit) errors.push(`Fila ${rowNumber}: unidad es obligatoria.`);
      const quotedUnitPrice = parseExcelNumber(rawPrice || "0");
      if (quotedUnitPrice === null) errors.push(`Fila ${rowNumber}: valor_unitario_cotizado debe ser numerico.`);
      const active = parseExcelBoolean(rawActive);
      if (active === null) errors.push(`Fila ${rowNumber}: activo debe ser SI o NO.`);
      const etecBlock = rawEtecBlock ? normalizeEtecBlock(rawEtecBlock) : null;
      if (rawEtecBlock && !ETEC_DEFAULT_BLOCKS.some((block) => normalizeHeader(block) === normalizeHeader(rawEtecBlock))) {
        errors.push(`Fila ${rowNumber}: bloque_etec no es valido.`);
      }
      const vegetalGroup = normalizeVegetalIndicatorGroup(rawVegetalGroup);
      if (rawVegetalGroup && !vegetalGroup && normalizeHeader(rawVegetalGroup) !== "no_aplica") {
        errors.push(`Fila ${rowNumber}: grupo_vegetal_indicadores no es valido.`);
      }
      if (id && !existingById.has(id)) errors.push(`Fila ${rowNumber}: el id no existe en el catalogo actual.`);
      const duplicateKey = `${projectId || ""}-${normalizeHeader(name)}`;
      const existingDuplicate = existingByProjectName.get(duplicateKey);
      if (!id && existingDuplicate) {
        errors.push(`Fila ${rowNumber}: ya existe el material "${name}" en ese proyecto. Conserve la columna id para actualizarlo.`);
      }
      if (!id && pendingNewKeys.has(duplicateKey)) {
        errors.push(`Fila ${rowNumber}: material duplicado dentro del archivo.`);
      }
      pendingNewKeys.add(duplicateKey);

      if (!name || !unit || quotedUnitPrice === null || active === null || (rawEtecBlock && !etecBlock) || (projectName && !projectId) || (id && !existingById.has(id)) || (!id && existingDuplicate)) {
        continue;
      }

      operations.push({
        type: id ? "update" : "insert",
        id: id || undefined,
        payload: {
          project_id: projectId || null,
          internal_code: materialExcelValue(row, headerByName, ["codigo_interno", "codigo interno", "codigo"]) || null,
          name,
          category: null,
          unit,
          quoted_unit_price: quotedUnitPrice,
          etec_block: etecBlock,
          technical_characteristics: materialExcelValue(row, headerByName, ["caracteristicas_tecnicas", "caracteristicas tecnicas", "caracteristicas", "especificaciones"]) || null,
          vegetal_indicator_group: vegetalGroup,
          observations: materialExcelValue(row, headerByName, ["observaciones", "observacion"]) || null,
          active
        }
      });
    }

    if (errors.length > 0) {
      setNotice({ type: "error", message: `No se aplicaron cambios. ${errors.slice(0, 6).join(" ")}` });
      return;
    }
    if (operations.length === 0) {
      setNotice({ type: "info", message: "No se encontraron filas validas para actualizar." });
      return;
    }

    let updated = 0;
    let created = 0;
    for (const operation of operations) {
      const result = operation.type === "update"
        ? await supabase.from("material_catalog").update(operation.payload).eq("id", operation.id)
        : await supabase.from("material_catalog").insert(operation.payload);
      if (result.error) {
        setNotice({ type: "error", message: `Error al guardar materiales: ${result.error.message}` });
        return;
      }
      if (operation.type === "update") updated += 1;
      else created += 1;
    }
    setNotice({ type: "info", message: `Actualizacion masiva finalizada. Actualizados: ${updated}. Creados: ${created}.` });
    await onChange();
  }

  return (
    <CrudSection title="Catalogo de materiales" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Actualizacion masiva desde Excel</strong></div>
        <p className="span-12 muted">
          Descargue el listado, edite valores en Excel y suba el mismo archivo. Las columnas ocultas id y project_id permiten actualizar sin duplicar materiales.
        </p>
        <div className="span-4 form-actions">
          <button className="secondary" type="button" onClick={() => void downloadMaterialsExcel()}>
            Descargar listado materiales
          </button>
        </div>
        <label className="span-8">
          Archivo Excel actualizado
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!canWrite}
            onChange={(event) => {
              void importMaterialsExcel(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <details className="panel" open={Boolean(editingId)}>
        <summary><strong>{editingId ? "Editar material" : "Nuevo material"}</strong></summary>
        <form className="grid mt-4" onSubmit={save}>
        <SelectProject projects={projects} value={form.project_id} onChange={(project_id) => setForm({ ...form, project_id })} />
        <TextInput label="Codigo interno" value={form.internal_code} onChange={(internal_code) => setForm({ ...form, internal_code })} />
        <TextInput label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <TextInput label="Unidad" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} required />
        <label className="span-4">
          Bloque ETEC
          <select value={form.etec_block} onChange={(event) => setForm({ ...form, etec_block: event.target.value })}>
            <option value="">Seleccione</option>
            {ETEC_DEFAULT_BLOCKS.map((block) => <option key={block} value={block}>{block}</option>)}
          </select>
        </label>
        <label className="span-4">
          Grupo vegetal indicadores
          <select value={form.vegetal_indicator_group} onChange={(event) => setForm({ ...form, vegetal_indicator_group: event.target.value })}>
            <option value="">No aplica</option>
            <option value="colinos">Colinos (platano y pina)</option>
            <option value="cacao">Cacao</option>
            <option value="frutales">Frutales</option>
            <option value="forestales_nativos">Forestales nativos</option>
            <option value="otro">Otro vegetal sin indicador</option>
          </select>
        </label>
        <TextInput
          label="Precio cotizado"
          type="number"
          value={form.quoted_unit_price}
          onChange={(quoted_unit_price) => setForm({ ...form, quoted_unit_price })}
        />
        <TextInput
          label="Fecha precio"
          type="date"
          value={form.price_updated_at}
          onChange={(price_updated_at) => setForm({ ...form, price_updated_at })}
        />
        <label className="span-12">
          Caracteristicas tecnicas ETEC
          <textarea value={form.technical_characteristics} onChange={(event) => setForm({ ...form, technical_characteristics: event.target.value })} rows={3} />
        </label>
        <TextInput
          className="span-12"
          label="Observaciones"
          value={form.observations}
          onChange={(observations) => setForm({ ...form, observations })}
        />
        <div className="span-12 form-actions">
          <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? (
            <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyMaterial); }}>
              Cancelar
            </button>
          ) : null}
        </div>
        </form>
      </details>

      <div className="panel grid">
        <div className="span-12"><strong>Buscar y filtrar materiales</strong></div>
        <TextInput
          className="span-6"
          label="Buscar por nombre o codigo"
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <label className="span-6">
          Bloque ETEC
          <select value={filterEtecBlock} onChange={(e) => setFilterEtecBlock(e.target.value)}>
            <option value="">Todos</option>
            {ETEC_DEFAULT_BLOCKS.map((block) => <option key={block} value={block}>{block}</option>)}
          </select>
        </label>
      </div>

      <div className="panel grid">
        <div className="span-12 tracking-pagination">
          <label>
            Materiales por pagina
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
          <span>
            Mostrando {totalItems > 0 ? pageStart + 1 : 0}-{pageEnd} de {totalItems} materiales
          </span>
          <button className="secondary" disabled={normalizedPage <= 1} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
          <button className="secondary" disabled={normalizedPage >= totalPages} type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</button>
        </div>
      </div>

      <DataTable
        headers={["Nombre", "Unidad", "Grupo vegetal", "Bloque ETEC", "Caracteristicas", "Precio", "Acciones"]}
        rows={visibleMaterials.map((material) => [
          material.name,
          material.unit,
          vegetalIndicatorGroupLabel(material.vegetal_indicator_group),
          material.etec_block ?? "Otros",
          material.technical_characteristics ?? "",
          formatMoney(material.quoted_unit_price),
          <Actions key="actions" canWrite={canWrite} onEdit={() => edit(material)} onDelete={() => remove(material.id)} />
        ])}
      />
    </CrudSection>
  );
}

function CounterpartCatalogCrud({
  items,
  projects,
  canWrite,
  onChange
}: {
  items: CounterpartCatalog[];
  projects: Project[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyCounterpartCatalog);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [importProjectId, setImportProjectId] = useState("");

  function edit(item: CounterpartCatalog) {
    setEditingId(item.id);
    setForm({
      project_id: item.project_id ?? "",
      name: item.name,
      type: item.type,
      suggested_unit: item.suggested_unit ?? "",
      description: item.description ?? "",
      active: item.active
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    const payload = {
      ...form,
      project_id: form.project_id || null,
      suggested_unit: form.suggested_unit || null,
      description: form.description || null
    };
    const result = editingId
      ? await supabase.from("counterpart_catalog").update(payload).eq("id", editingId)
      : await supabase.from("counterpart_catalog").insert(payload);
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setEditingId(null);
    setForm(emptyCounterpartCatalog);
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("counterpart_catalog").update({ is_deleted: true, active: false }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  async function importCounterparts(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const rows = parseCsv(await file.text());
    let created = 0;
    let skipped = 0;
    const payload = rows.flatMap((row) => {
      const name = csvValue(row, ["nombre", "descripcion", "descripción", "aporte"]);
      const suggestedUnit = csvValue(row, ["unidad", "unidad sugerida"]);
      const rawType = normalizeHeader(csvValue(row, ["tipo", "tipo aporte"]));
      const contributionType: CounterpartCatalog["type"] =
        rawType.includes("material") ? "material_propio" : rawType.includes("otro") ? "otro" : "mano_obra";
      if (!name || !suggestedUnit) {
        skipped += 1;
        return [];
      }
      const duplicate = items.some((item) =>
        (item.project_id ?? "") === importProjectId &&
        sameText(item.name, name) &&
        item.type === contributionType &&
        sameText(item.suggested_unit, suggestedUnit)
      );
      if (duplicate) {
        skipped += 1;
        return [];
      }
      created += 1;
      return [{
        project_id: importProjectId || null,
        name,
        type: contributionType,
        suggested_unit: suggestedUnit,
        description: csvValue(row, ["observacion", "observación", "descripcion", "descripción"]) || null,
        active: csvBool(csvValue(row, ["activo", "estado"]), true)
      }];
    });
    if (payload.length > 0) {
      const { error } = await supabase.from("counterpart_catalog").insert(payload);
      if (error) {
        setNotice({ type: "error", message: error.message });
        return;
      }
    }
    setNotice({ type: "info", message: `Importacion finalizada. Creados: ${created}. Omitidos: ${skipped}.` });
    await onChange();
  }

  async function downloadCounterpartsExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Contrapartidas");
    sheet.columns = [
      { header: "id", key: "id", width: 38, hidden: true },
      { header: "project_id", key: "project_id", width: 38, hidden: true },
      { header: "proyecto", key: "project_name", width: 34 },
      { header: "nombre_aporte", key: "name", width: 34 },
      { header: "tipo", key: "type", width: 20 },
      { header: "unidad", key: "suggested_unit", width: 18 },
      { header: "descripcion", key: "description", width: 44 },
      { header: "activo", key: "active", width: 12 }
    ];
    const projectById = new Map(projects.map((project) => [project.id, project.name]));
    for (const item of items.filter((counterpart) => !counterpart.is_deleted)) {
      sheet.addRow({
        id: item.id,
        project_id: item.project_id ?? "",
        project_name: item.project_id ? projectById.get(item.project_id) ?? "" : "",
        name: item.name,
        type: item.type,
        suggested_unit: item.suggested_unit ?? "",
        description: item.description ?? "",
        active: item.active ? "SI" : "NO"
      });
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEEB" } };
    sheet.getColumn("description").alignment = { wrapText: true, vertical: "top" };
    applyExcelDropdown(workbook, sheet, "type", COUNTERPART_TYPES.map((item) => item.value), false, "tipo_contrapartida");
    applyExcelDropdown(workbook, sheet, "suggested_unit", COUNTERPART_UNITS, false, "unidad_contrapartida");
    applyExcelDropdown(workbook, sheet, "active", ["SI", "NO"], false, "si_no");
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }), "contrapartidas-catalogo.xlsx");
  }

  async function importCounterpartsExcel(file: File | null) {
    if (!canWrite || !file) return;
    setNotice(null);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet("Contrapartidas") ?? workbook.worksheets[0];
    if (!sheet) {
      setNotice({ type: "error", message: "El archivo no contiene una hoja de contrapartidas." });
      return;
    }

    const headerByName = excelHeaderMap(sheet);
    const existingById = new Map(items.map((item) => [item.id, item]));
    const projectByName = new Map(projects.map((project) => [normalizeHeader(project.name), project.id]));
    const existingByKey = new Map(
      items
        .filter((item) => !item.is_deleted)
        .map((item) => [`${item.project_id ?? ""}-${normalizeHeader(item.name)}-${item.type}-${normalizeHeader(item.suggested_unit ?? "")}`, item])
    );
    const pendingNewKeys = new Set<string>();
    const errors: string[] = [];
    const operations: Array<{
      type: "update" | "insert";
      id?: string;
      payload: {
        project_id: string | null;
        name: string;
        type: CounterpartCatalog["type"];
        suggested_unit: string | null;
        description: string | null;
        active: boolean;
      };
    }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!excelRowHasValue(row)) continue;

      const id = materialExcelValue(row, headerByName, ["id"]);
      const hiddenProjectId = materialExcelValue(row, headerByName, ["project_id"]);
      const projectName = materialExcelValue(row, headerByName, ["proyecto", "project"]);
      const projectId = hiddenProjectId || (projectName ? projectByName.get(normalizeHeader(projectName)) ?? "" : "");
      const name = materialExcelValue(row, headerByName, ["nombre_aporte", "nombre aporte", "aporte", "nombre"]);
      const rawType = materialExcelValue(row, headerByName, ["tipo", "tipo aporte"]) || "mano_obra";
      const counterpartType = normalizeCounterpartType(rawType);
      const suggestedUnit = materialExcelValue(row, headerByName, ["unidad", "unidad sugerida", "suggested_unit"]);
      const description = materialExcelValue(row, headerByName, ["descripcion", "descripción", "observaciones", "observacion"]);
      const active = parseExcelBoolean(materialExcelValue(row, headerByName, ["activo", "estado"]) || "SI");

      if (projectName && !projectId) errors.push(`Fila ${rowNumber}: el proyecto "${projectName}" no existe.`);
      if (!name) errors.push(`Fila ${rowNumber}: nombre_aporte es obligatorio.`);
      if (!counterpartType) errors.push(`Fila ${rowNumber}: tipo debe ser mano_obra, material_propio u otro.`);
      if (!suggestedUnit) errors.push(`Fila ${rowNumber}: unidad es obligatoria.`);
      if (active === null) errors.push(`Fila ${rowNumber}: activo debe ser SI o NO.`);
      if (id && !existingById.has(id)) errors.push(`Fila ${rowNumber}: el id no existe en el catalogo actual.`);

      const duplicateKey = `${projectId || ""}-${normalizeHeader(name)}-${counterpartType ?? ""}-${normalizeHeader(suggestedUnit)}`;
      const existingDuplicate = existingByKey.get(duplicateKey);
      if (existingDuplicate && existingDuplicate.id !== id) {
        errors.push(`Fila ${rowNumber}: ya existe la contrapartida "${name}" con ese tipo y unidad.`);
      }
      if (!id && pendingNewKeys.has(duplicateKey)) {
        errors.push(`Fila ${rowNumber}: contrapartida duplicada dentro del archivo.`);
      }
      pendingNewKeys.add(duplicateKey);

      if (!name || !counterpartType || !suggestedUnit || active === null || (projectName && !projectId) || (id && !existingById.has(id)) || (existingDuplicate && existingDuplicate.id !== id)) {
        continue;
      }

      operations.push({
        type: id ? "update" : "insert",
        id: id || undefined,
        payload: {
          project_id: projectId || null,
          name,
          type: counterpartType,
          suggested_unit: suggestedUnit,
          description: description || null,
          active
        }
      });
    }

    if (errors.length > 0) {
      setNotice({ type: "error", message: `No se aplicaron cambios. ${errors.slice(0, 6).join(" ")}` });
      return;
    }
    if (operations.length === 0) {
      setNotice({ type: "info", message: "No se encontraron filas validas para actualizar." });
      return;
    }

    let updated = 0;
    let created = 0;
    for (const operation of operations) {
      const result = operation.type === "update"
        ? await supabase.from("counterpart_catalog").update(operation.payload).eq("id", operation.id)
        : await supabase.from("counterpart_catalog").insert(operation.payload);
      if (result.error) {
        setNotice({ type: "error", message: `Error al guardar contrapartidas: ${result.error.message}` });
        return;
      }
      if (operation.type === "update") updated += 1;
      else created += 1;
    }
    setNotice({ type: "info", message: `Actualizacion masiva finalizada. Actualizados: ${updated}. Creados: ${created}.` });
    await onChange();
  }

  const unitOptions = Array.from(new Set([
    ...COUNTERPART_UNITS,
    ...(form.suggested_unit && !COUNTERPART_UNITS.includes(form.suggested_unit) ? [form.suggested_unit] : [])
  ]));

  return (
    <CrudSection title="Catalogo de contrapartidas familiares" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Actualizacion masiva desde Excel</strong></div>
        <p className="span-12 muted">
          Descargue el listado, edite valores en Excel y suba el mismo archivo. Las columnas ocultas id y project_id permiten actualizar sin duplicar contrapartidas.
        </p>
        <div className="span-4 form-actions">
          <button className="secondary" type="button" onClick={() => void downloadCounterpartsExcel()}>
            Descargar listado contrapartidas
          </button>
        </div>
        <label className="span-8">
          Archivo Excel actualizado
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!canWrite}
            onChange={(event) => {
              void importCounterpartsExcel(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
      <form className="panel grid" onSubmit={save}>
        <SelectProject projects={projects} value={form.project_id} onChange={(project_id) => setForm({ ...form, project_id })} />
        <TextInput label="Aporte" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <label className="span-4">
          Tipo
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as CounterpartCatalog["type"] })}
          >
            {COUNTERPART_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="span-4">
          Unidad sugerida
          <select required value={form.suggested_unit} onChange={(event) => setForm({ ...form, suggested_unit: event.target.value })}>
            <option value="">Seleccione</option>
            {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>
        <TextInput className="span-8" label="Descripcion" value={form.description} onChange={(description) => setForm({ ...form, description })} />
        <Toggle label="Activo" value={form.active} onChange={(active) => setForm({ ...form, active })} />
        <div className="span-12 form-actions">
          <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? (
            <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyCounterpartCatalog); }}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      <DataTable
        headers={["Aporte", "Tipo", "Unidad", "Activo", "Acciones"]}
        rows={items.map((item) => [
          item.name,
          counterpartTypeLabel(item.type),
          item.suggested_unit ?? "",
          item.active ? "Si" : "No",
          <Actions key="actions" canWrite={canWrite} onEdit={() => edit(item)} onDelete={() => remove(item.id)} />
        ])}
      />
    </CrudSection>
  );
}

function PlansAdmin({
  plans,
  projects,
  families,
  municipalities,
  villages,
  activities,
  materials,
  planActivities,
  planMaterials,
  planCounterparts,
  provisionalMaterials,
  canReview,
  canManageLogos,
  currentProfile,
  onChange
}: {
  plans: OperationalPlan[];
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  planCounterparts: PlanFamilyCounterpart[];
  provisionalMaterials: ProvisionalMaterial[];
  canReview: boolean;
  canManageLogos: boolean;
  currentProfile: Profile | null;
  onChange: () => Promise<void>;
}) {
  const [filters, setFilters] = useState({
    projectId: "",
    familyId: "",
    municipalityId: "",
    villageId: "",
    status: ""
  });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [notice, setNotice] = useState<Notice>(null);
  const [manualPlan, setManualPlan] = useState({ project_id: "", family_id: "" });
  const [projectLogos, setProjectLogos] = useState<Record<string, ProjectLogoConfig[]>>({});
  const [logoProjectId, setLogoProjectId] = useState(projects[0]?.id ?? "");
  const [logoPosition, setLogoPosition] = useState<ProjectLogoPosition>("right");
  const [logoSize, setLogoSize] = useState("140");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const refreshProjectLogos = useCallback(async () => {
    setProjectLogos(await loadProjectLogos());
  }, []);
  useEffect(() => {
    void refreshProjectLogos();
  }, [refreshProjectLogos]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const filteredPlans = plans.filter((plan) => {
    const family = families.find((item) => item.id === plan.family_id);
    if (filters.projectId && plan.project_id !== filters.projectId) return false;
    if (filters.familyId && plan.family_id !== filters.familyId) return false;
    if (filters.status && plan.status !== filters.status) return false;
    if (filters.municipalityId && family?.municipality_id !== filters.municipalityId) return false;
    if (filters.villageId && family?.village_id !== filters.villageId) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const code = family?.family_code?.toLowerCase() || "";
      const rep = family?.representative_name?.toLowerCase() || "";
      if (!code.includes(q) && !rep.includes(q)) return false;
    }

    return true;
  });

  const totalItems = filteredPlans.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (normalizedPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalItems);
  const visiblePlans = filteredPlans.slice(pageStart, pageEnd);

  const selectedPlanActivities = selectedPlan
    ? planActivities.filter((activity) => activity.plan_id === selectedPlan.id)
    : [];
  const exportContext = {
    projects,
    families,
    municipalities,
    villages,
    activities,
    materials,
    planActivities,
    planMaterials,
    planCounterparts,
    provisionalMaterials,
    projectLogos
  };

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !logoProjectId) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setNotice({ type: "error", message: "El logo debe ser JPG o PNG." });
      return;
    }
    if (file.size > 1024 * 1024) {
      setNotice({ type: "error", message: "El logo no debe superar 1 MB." });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const { error } = await supabase.from("project_logos").insert({
      project_id: logoProjectId,
      data_url: dataUrl,
      position: logoPosition,
      name: file.name,
      size: clampLogoSize(Number(logoSize))
    });
    if (error) {
      setNotice({ type: "error", message: `No fue posible guardar el logo: ${error.message}` });
      return;
    }
    await refreshProjectLogos();
    setNotice({ type: "info", message: "Logo agregado para el proyecto seleccionado." });
    event.target.value = "";
  }

  async function removeLogo(logoId: string) {
    const { error } = await supabase.from("project_logos").update({ is_deleted: true }).eq("id", logoId);
    if (error) {
      setNotice({ type: "error", message: `No fue posible retirar el logo: ${error.message}` });
      return;
    }
    await refreshProjectLogos();
    setNotice({ type: "info", message: "Logo retirado." });
  }

  async function updateLogo(logoId: string, updates: Partial<ProjectLogoConfig>) {
    const payload: Record<string, unknown> = {};
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.size !== undefined) payload.size = clampLogoSize(updates.size);
    if (updates.name !== undefined) payload.name = updates.name;
    if (Object.keys(payload).length === 0) return;
    // Actualiza la vista de inmediato y en su sitio (no recarga la lista): asi el +/- es
    // instantaneo y el foco no salta a otro logo. La escritura va en segundo plano.
    setProjectLogos((prev) => {
      const next: Record<string, ProjectLogoConfig[]> = {};
      for (const [projectId, logos] of Object.entries(prev)) {
        next[projectId] = logos.map((logo) =>
          logo.id === logoId ? { ...logo, ...updates, size: updates.size !== undefined ? clampLogoSize(updates.size) : logo.size } : logo
        );
      }
      return next;
    });
    const { error } = await supabase.from("project_logos").update(payload).eq("id", logoId);
    if (error) {
      setNotice({ type: "error", message: `No fue posible actualizar el logo: ${error.message}` });
      await refreshProjectLogos(); // revertir a lo del servidor si fallo
    }
  }

  async function createManualPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!canReview || !currentProfile) return;
    setNotice(null);
    const { data, error } = await supabase
      .from("operational_plans")
      .insert({
        project_id: manualPlan.project_id,
        family_id: manualPlan.family_id,
        technician_id: currentProfile.id,
        status: "draft",
        sync_status: "synced"
      })
      .select("id")
      .single();
    if (error) {
      setNotice({ type: "error", message: error.message });
      return;
    }
    setManualPlan({ project_id: "", family_id: "" });
    setSelectedPlanId(data.id);
    await onChange();
  }

  async function updatePlanStatus(plan: OperationalPlan, status: OperationalPlan["status"]) {
    if (!canReview) return;
    setNotice(null);
    if (status === "approved") {
      const validation = validatePlanForApproval(plan, {
        activities,
        planActivities,
        planMaterials,
        provisionalMaterials
      });
      if (validation.length > 0) {
        setNotice({ type: "error", message: validation.join(" ") });
        return;
      }
    }
    const { error } = await supabase.from("operational_plans").update({ status }).eq("id", plan.id);
    if (error) {
      setNotice({ type: "error", message: error.message });
      return;
    }
    await onChange();
  }

  
  async function deleteOperationalPlan(planId: string) {
    if (!document.body.classList.contains("can-delete-plans")) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar este plan operativo? Esta acción no se puede deshacer.")) return;
    setNotice(null);
    const { error } = await supabase.from("operational_plans").update({ is_deleted: true, status: "draft" }).eq("id", planId);
    if (error) {
      setNotice({ type: "error", message: error.message });
      return;
    }
    if (selectedPlanId === planId) setSelectedPlanId(null);
    await onChange();
  }

  async function resolveProvisionalMaterial(provisionalId: string, officialMaterialId: string) {
    if (!canReview || !officialMaterialId) return;
    setNotice(null);
    const official = materials.find((material) => material.id === officialMaterialId);
    const provisionalResult = await supabase
      .from("provisional_materials")
      .update({ status: "resolved", resolved_material_id: officialMaterialId })
      .eq("id", provisionalId);
    if (provisionalResult.error) {
      setNotice({ type: "error", message: provisionalResult.error.message });
      return;
    }
    const materialResult = await supabase
      .from("plan_project_materials")
      .update({
        material_id: officialMaterialId,
        provisional_material_id: null,
        unit: official?.unit ?? undefined,
        quoted_unit_price: official?.quoted_unit_price ?? undefined
      })
      .eq("provisional_material_id", provisionalId);
    if (materialResult.error) {
      setNotice({ type: "error", message: materialResult.error.message });
      return;
    }
    await onChange();
  }

  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>Planes Operativos</h2>
          <p className="muted">
            La web revisa, aprueba y corrige. La captura principal en campo sera Android offline-first.
          </p>
        </div>
        <span className="badge">{canReview ? "Revision habilitada" : "Solo lectura"}</span>
      </div>
      <AlertNotice notice={notice} onClose={() => setNotice(null)} />
      <form className="panel grid" onSubmit={createManualPlan}>
        <div className="span-12">
          <strong>Crear plan manual de contingencia</strong>
        </div>
        <SelectProject
          projects={projects}
          value={manualPlan.project_id}
          onChange={(project_id) => setManualPlan({ project_id, family_id: "" })}
        />
        <label className="span-4">
          Familia
          <select
            value={manualPlan.family_id}
            onChange={(event) => setManualPlan({ ...manualPlan, family_id: event.target.value })}
            required
          >
            <option value="">Seleccione</option>
            {families
              .filter((family) => !manualPlan.project_id || family.project_id === manualPlan.project_id)
              .map((family) => (
                <option key={family.id} value={family.id}>
                  {family.family_code} - {family.representative_name}
                </option>
              ))}
          </select>
        </label>
        <div className="span-4 form-actions">
          <button disabled={!canReview || !manualPlan.project_id || !manualPlan.family_id}>Crear borrador</button>
        </div>
      </form>
      <div className="panel grid">
        <SelectProject
          projects={projects}
          value={filters.projectId}
          onChange={(projectId) => setFilters({ ...filters, projectId, familyId: "" })}
        />
        <label className="span-3">
          Familia
          <select value={filters.familyId} onChange={(event) => setFilters({ ...filters, familyId: event.target.value })}>
            <option value="">Todas</option>
            {families
              .filter((family) => !filters.projectId || family.project_id === filters.projectId)
              .map((family) => (
                <option key={family.id} value={family.id}>{family.family_code}</option>
              ))}
          </select>
        </label>
        <label className="span-3">
          Municipio
          <select value={filters.municipalityId} onChange={(event) => setFilters({ ...filters, municipalityId: event.target.value })}>
            <option value="">Todos</option>
            {municipalities.map((municipality) => (
              <option key={municipality.id} value={municipality.id}>{municipality.name}</option>
            ))}
          </select>
        </label>
        <label className="span-3">
          Vereda
          <select value={filters.villageId} onChange={(event) => setFilters({ ...filters, villageId: event.target.value })}>
            <option value="">Todas</option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>{village.name}</option>
            ))}
          </select>
        </label>
        <label className="span-3">
          Estado
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Todos</option>
            {["draft", "pending_review", "approved", "returned", "closed"].map((status) => (
              <option key={status} value={status}>{planStatusLabel(status)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel grid">
        <div className="span-12">
          <strong>Logos para exportación</strong>
          <p className="muted">Puedes configurar múltiples logos (ej. izquierdo y derecho). Sube un archivo para agregarlo a la lista de logos del proyecto. Puedes subir el primer logo, y luego repetir el paso para subir el segundo.</p>
        </div>
        <label className="span-4">
          Proyecto
          <select value={logoProjectId} onChange={(event) => setLogoProjectId(event.target.value)}>
            <option value="">Seleccione</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="span-4">
          Añadir un logo (JPG/PNG)
          <input disabled={!canManageLogos || !logoProjectId} type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} />
          <div style={{ fontSize: "0.8em", marginTop: "4px", color: "var(--primary)" }}>Selecciona un archivo para agregarlo</div>
        </label>
        <label className="span-2">
          Ubicacion
          <select value={logoPosition} onChange={(event) => setLogoPosition(event.target.value as ProjectLogoPosition)}>
            <option value="left">Superior izquierda</option>
            <option value="center">Superior centro</option>
            <option value="right">Superior derecha</option>
            <option value="bottom-left">Inferior izquierda</option>
            <option value="bottom-center">Inferior centro</option>
            <option value="bottom-right">Inferior derecha</option>
          </select>
        </label>
        <label className="span-2">
          Ancho doc.
          <LogoSizeInput
            value={clampLogoSize(Number(logoSize))}
            disabled={!canManageLogos}
            onCommit={(size) => setLogoSize(String(size))}
          />
        </label>
        {logoProjectId && (projectLogos[logoProjectId] ?? []).length > 0 ? (
          <div className="span-12 logo-list">
            {(projectLogos[logoProjectId] ?? []).map((logo) => (
              <div className="logo-item" key={logo.id}>
                <img src={logo.dataUrl} alt={logo.name} style={{ width: `${logo.size}px` }} />
                <span className="logo-name">{logo.name}</span>
                <label>
                  Ubicacion
                  <select
                    disabled={!canManageLogos}
                    value={logo.position}
                    onChange={(event) => updateLogo(logo.id, { position: event.target.value as ProjectLogoPosition })}
                  >
                    <option value="left">Superior izquierda</option>
                    <option value="center">Superior centro</option>
                    <option value="right">Superior derecha</option>
                    <option value="bottom-left">Inferior izquierda</option>
                    <option value="bottom-center">Inferior centro</option>
                    <option value="bottom-right">Inferior derecha</option>
                  </select>
                </label>
                <label>
                  Ancho doc.
                  <LogoSizeInput
                    value={logo.size}
                    disabled={!canManageLogos}
                    onCommit={(size) => updateLogo(logo.id, { size })}
                  />
                </label>
                <button className="secondary" type="button" disabled={!canManageLogos} onClick={() => removeLogo(logo.id)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="panel toolbar">
        <div>
          <strong>Exportacion masiva</strong>
          <p className="muted">Exporta los planes visibles segun filtros: proyecto, familia, municipio, vereda o estado.</p>
        </div>
        <div className="form-actions">
          <button
            className="secondary"
            type="button"
            disabled={filteredPlans.length === 0 || isExporting}
            onClick={async () => {
              setIsExporting(true);
              try { await exportPlansAsPdf(filteredPlans, exportContext); } finally { setIsExporting(false); }
            }}
          >
            {isExporting ? "Generando PDF..." : "Exportar PDF (Filtros)"}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={filteredPlans.length === 0 || isExporting}
            onClick={async () => {
              setIsExporting(true);
              try { await exportPlansAsWord(filteredPlans, exportContext); } finally { setIsExporting(false); }
            }}
          >
            {isExporting ? "Generando Word..." : "Exportar Word (Filtros)"}
          </button>
        </div>
      </div>
      <div className="panel grid">
        <label className="span-4">
          Buscar por Familia
          <input
            type="text"
            placeholder="Código o nombre..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </label>
        <div className="span-8 tracking-pagination" style={{ alignSelf: "end" }}>
          <label>
            Planes por página
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
          <span>
            Mostrando {totalItems > 0 ? pageStart + 1 : 0}-{pageEnd} de {totalItems} planes
          </span>
          <button className="secondary" disabled={normalizedPage <= 1} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
          <button className="secondary" disabled={normalizedPage >= totalPages} type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</button>
        </div>
      </div>
      <div className="grid">
        <div className="plan-list-column">
          <DataTable
            headers={["Codigo", "Familia", "Municipio", "Vereda", "Estado", "Acciones"]}
            rows={visiblePlans.map((plan) => {
              const family = families.find((item) => item.id === plan.family_id);
              const municipality = municipalities.find((item) => item.id === family?.municipality_id);
              const village = villages.find((item) => item.id === family?.village_id);
              return [
                <button className="secondary" key="open" type="button" onClick={() => setSelectedPlanId(plan.id)}>
                  v{plan.version}
                </button>,
                family ? `${family.family_code} - ${family.representative_name}` : "Sin familia",
                municipality?.name ?? "",
                village?.name ?? "",
                <span className="badge" key="status">{planStatusLabel(plan.status)}</span>,
                <button className="danger plan-deleter-only" key="delete" type="button" onClick={() => void deleteOperationalPlan(plan.id)}>Eliminar</button>
              ];
            })}
          />
        </div>
        <div className="plan-detail-column">
          {selectedPlan ? (
            <PlanDetail
              plan={selectedPlan}
              families={families}
              activities={activities}
              materials={materials}
              planActivities={selectedPlanActivities}
              allPlans={plans}
              allPlanActivities={planActivities}
              planMaterials={planMaterials}
              planCounterparts={planCounterparts}
              provisionalMaterials={provisionalMaterials}
              projects={projects}
              municipalities={municipalities}
              villages={villages}
              projectLogos={projectLogos}
              canReview={canReview}
              onApprove={() => updatePlanStatus(selectedPlan, "approved")}
              onReturn={() => updatePlanStatus(selectedPlan, "returned")}
              onClose={() => updatePlanStatus(selectedPlan, "closed")}
              onMoveToReview={() => updatePlanStatus(selectedPlan, "pending_review")}
              onResolveMaterial={resolveProvisionalMaterial}
              onChange={onChange}
            />
          ) : (
            <div className="panel muted">Seleccione un plan para revisar el detalle.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlanDetail({
  plan,
  families,
  activities,
  materials,
  planActivities,
  allPlans,
  allPlanActivities,
  planMaterials,
  planCounterparts,
  provisionalMaterials,
  projects,
  municipalities,
  villages,
  projectLogos,
  canReview,
  onApprove,
  onReturn,
  onClose,
  onMoveToReview,
  onResolveMaterial,
  onChange
}: {
  plan: OperationalPlan;
  families: Family[];
  activities: Activity[];
  materials: Material[];
  planActivities: PlanActivity[];
  allPlans: OperationalPlan[];
  allPlanActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  planCounterparts: PlanFamilyCounterpart[];
  provisionalMaterials: ProvisionalMaterial[];
  projects: Project[];
  municipalities: Municipality[];
  villages: Village[];
  projectLogos: Record<string, ProjectLogoConfig[]>;
  canReview: boolean;
  onApprove: () => void;
  onReturn: () => void;
  onClose: () => void;
  onMoveToReview: () => void;
  onResolveMaterial: (provisionalId: string, officialMaterialId: string) => Promise<void>;
  onChange: () => Promise<void>;
}) {
  const family = families.find((item) => item.id === plan.family_id);
  const validation = validatePlanForApproval(plan, { activities, planActivities, planMaterials, provisionalMaterials });
  const canEditStatus = canReview && !["approved", "closed"].includes(plan.status);
  const canEditPlan = canReview && plan.status !== "closed";
  const [planNotice, setPlanNotice] = useState<Notice>(null);
  const [activityForm, setActivityForm] = useState({ id: "", activity_id: "", baseline: "", target: "", observations: "" });
  const [materialForm, setMaterialForm] = useState({ id: "", plan_activity_id: "", material_id: "", quantity: "", observations: "" });
  // Reasignacion de un material a otra familia (mueve el item cambiando su actividad).
  const [reassign, setReassign] = useState<{ item: PlanProjectMaterial; targetFamilyId: string; targetActivityId: string } | null>(null);

  async function confirmReassign() {
    if (!reassign || !reassign.targetActivityId) return;
    if (!confirmPlanMutation("Reasignar un material a otra familia")) return;
    const item = reassign.item;
    // Si la familia destino ya tiene el mismo material (en cualquiera de sus actividades), se
    // suman las cantidades en esa fila en vez de dejar dos filas repetidas.
    let existing: { id: string; quantity: number } | null = null;
    if (item.material_id) {
      const targetPlanIds = new Set(allPlans.filter((p) => p.family_id === reassign.targetFamilyId && !p.is_deleted).map((p) => p.id));
      const targetActivityIds = allPlanActivities.filter((pa) => targetPlanIds.has(pa.plan_id) && !pa.is_deleted).map((pa) => pa.id);
      if (targetActivityIds.length > 0) {
        const { data } = await supabase
          .from("plan_project_materials")
          .select("id, quantity")
          .in("plan_activity_id", targetActivityIds)
          .eq("material_id", item.material_id)
          .eq("is_deleted", false)
          .neq("id", item.id)
          .limit(1);
        existing = data?.[0] ?? null;
      }
    }
    let error: { message: string } | null = null;
    if (existing) {
      // Fusion: sumar al material existente y eliminar (soft) el que se movio.
      const merged = Number(existing.quantity) + Number(item.quantity);
      ({ error } = await supabase.from("plan_project_materials").update({ quantity: merged }).eq("id", existing.id));
      if (!error) {
        ({ error } = await supabase.from("plan_project_materials").update({ is_deleted: true }).eq("id", item.id));
      }
    } else {
      // Sin coincidencia: solo se mueve la fila a la actividad destino.
      ({ error } = await supabase.from("plan_project_materials").update({ plan_activity_id: reassign.targetActivityId }).eq("id", item.id));
    }
    if (error) {
      setPlanNotice({ type: "error", message: `No fue posible reasignar: ${error.message}` });
      return;
    }
    setReassign(null);
    setPlanNotice({ type: "info", message: "Material reasignado a la otra familia. Compras e indicadores se actualizan solos." });
    await onChange();
  }
  const [counterpartForm, setCounterpartForm] = useState({
    id: "",
    plan_activity_id: "",
    contribution_type: "material_propio",
    name: "",
    quantity: "",
    unit: "",
    estimated_unit_value: "",
    vegetal_indicator_group: "",
    observations: ""
  });
  const exportContext = {
    projects,
    families,
    municipalities,
    villages,
    activities,
    materials,
    planActivities,
    planMaterials,
    planCounterparts,
    provisionalMaterials,
    projectLogos
  };

  function confirmPlanMutation(action: string) {
    if (plan.status !== "approved") return true;
    return confirmManualChange(`Este plan ya esta aprobado. ${action} puede cambiar consolidados, ETEC e indicadores. Desea continuar?`);
  }

  function clearPlanForms() {
    setActivityForm({ id: "", activity_id: "", baseline: "", target: "", observations: "" });
    setMaterialForm({ id: "", plan_activity_id: "", material_id: "", quantity: "", observations: "" });
    setCounterpartForm({
      id: "",
      plan_activity_id: "",
      contribution_type: "material_propio",
      name: "",
      quantity: "",
      unit: "",
      estimated_unit_value: "",
      vegetal_indicator_group: "",
      observations: ""
    });
  }

  async function savePlanActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!canEditPlan || !activityForm.activity_id || !confirmPlanMutation("Modificar actividades")) return;
    const activity = activities.find((item) => item.id === activityForm.activity_id);
    if (!activity) return;
    setPlanNotice(null);
    const payload = {
      plan_id: plan.id,
      activity_id: activity.id,
      baseline: activityForm.baseline === "" ? null : Number(activityForm.baseline),
      target: activityForm.target === "" ? null : Number(activityForm.target),
      unit: activity.unit,
      observations: activityForm.observations || null
    };
    const result = activityForm.id
      ? await supabase.from("plan_activities").update(payload).eq("id", activityForm.id)
      : await supabase.from("plan_activities").insert(payload);
    if (result.error) {
      setPlanNotice({ type: "error", message: result.error.message });
      return;
    }
    setPlanNotice({ type: "info", message: "Actividad del plan guardada." });
    clearPlanForms();
    await onChange();
  }

  async function deletePlanActivity(planActivity: PlanActivity) {
    if (!canEditPlan || !confirmPlanMutation("Eliminar una actividad")) return;
    const { error } = await supabase.from("plan_activities").update({ is_deleted: true }).eq("id", planActivity.id);
    if (error) setPlanNotice({ type: "error", message: error.message });
    else {
      setPlanNotice({ type: "info", message: "Actividad eliminada del plan." });
      await onChange();
    }
  }

  async function savePlanMaterial(event: React.FormEvent) {
    event.preventDefault();
    if (!canEditPlan || !materialForm.plan_activity_id || !materialForm.material_id || !confirmPlanMutation("Modificar materiales del proyecto")) return;
    const material = materials.find((item) => item.id === materialForm.material_id);
    const quantity = Number(materialForm.quantity);
    if (!material || !Number.isFinite(quantity) || quantity <= 0) {
      setPlanNotice({ type: "error", message: "Seleccione material y cantidad valida." });
      return;
    }
    const payload = {
      plan_activity_id: materialForm.plan_activity_id,
      material_id: material.id,
      provisional_material_id: null,
      quantity,
      unit: material.unit,
      quoted_unit_price: material.quoted_unit_price,
      observations: materialForm.observations || null
    };
    const result = materialForm.id
      ? await supabase.from("plan_project_materials").update(payload).eq("id", materialForm.id)
      : await supabase.from("plan_project_materials").insert(payload);
    if (result.error) {
      setPlanNotice({ type: "error", message: result.error.message });
      return;
    }
    setPlanNotice({ type: "info", message: "Material del proyecto guardado." });
    clearPlanForms();
    await onChange();
  }

  async function deletePlanMaterial(item: PlanProjectMaterial) {
    if (!canEditPlan || !confirmPlanMutation("Eliminar un material del proyecto")) return;
    const { error } = await supabase.from("plan_project_materials").update({ is_deleted: true }).eq("id", item.id);
    if (error) setPlanNotice({ type: "error", message: error.message });
    else {
      setPlanNotice({ type: "info", message: "Material eliminado del plan." });
      await onChange();
    }
  }

  async function savePlanCounterpart(event: React.FormEvent) {
    event.preventDefault();
    if (!canEditPlan || !counterpartForm.plan_activity_id || !counterpartForm.name.trim() || !confirmPlanMutation("Modificar contrapartida familiar")) return;
    const quantity = Number(counterpartForm.quantity);
    const estimatedUnitValue = Number(counterpartForm.estimated_unit_value || 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(estimatedUnitValue) || estimatedUnitValue < 0) {
      setPlanNotice({ type: "error", message: "La contrapartida requiere cantidad valida y valor no negativo." });
      return;
    }
    const payload = {
      plan_activity_id: counterpartForm.plan_activity_id,
      contribution_type: counterpartForm.contribution_type,
      name: counterpartForm.name.trim(),
      quantity,
      unit: counterpartForm.unit.trim() || "unidad",
      estimated_unit_value: estimatedUnitValue,
      vegetal_indicator_group: counterpartForm.vegetal_indicator_group || null,
      observations: counterpartForm.observations || null
    };
    const result = counterpartForm.id
      ? await supabase.from("plan_family_counterparts").update(payload).eq("id", counterpartForm.id)
      : await supabase.from("plan_family_counterparts").insert(payload);
    if (result.error) {
      if (isMissingCounterpartVegetalColumnError(result.error)) {
        const fallbackPayload = {
          plan_activity_id: payload.plan_activity_id,
          contribution_type: payload.contribution_type,
          name: payload.name,
          quantity: payload.quantity,
          unit: payload.unit,
          estimated_unit_value: payload.estimated_unit_value,
          observations: payload.observations
        };
        if (counterpartForm.vegetal_indicator_group) {
          fallbackPayload.name = `${payload.name} (${vegetalIndicatorGroupLabel(counterpartForm.vegetal_indicator_group)})`;
          fallbackPayload.observations = [
            `Grupo vegetal de contrapartida: ${vegetalIndicatorGroupLabel(counterpartForm.vegetal_indicator_group)}.`,
            counterpartForm.observations || ""
          ].filter(Boolean).join(" ");
        }
        const fallbackResult = counterpartForm.id
          ? await supabase.from("plan_family_counterparts").update(fallbackPayload).eq("id", counterpartForm.id)
          : await supabase.from("plan_family_counterparts").insert(fallbackPayload);
        if (fallbackResult.error) {
          setPlanNotice({ type: "error", message: fallbackResult.error.message });
          return;
        }
        setPlanNotice({
          type: "info",
          message: "Contrapartida vegetal guardada en observaciones porque Supabase aun no refresco la columna nueva. Ejecute notify pgrst, 'reload schema'; para guardarla como campo estructurado."
        });
        clearPlanForms();
        await onChange();
        return;
      }
      setPlanNotice({ type: "error", message: result.error.message });
      return;
    }
    setPlanNotice({ type: "info", message: "Contrapartida familiar guardada." });
    clearPlanForms();
    await onChange();
  }

  async function deletePlanCounterpart(item: PlanFamilyCounterpart) {
    if (!canEditPlan || !confirmPlanMutation("Eliminar una contrapartida familiar")) return;
    const { error } = await supabase.from("plan_family_counterparts").update({ is_deleted: true }).eq("id", item.id);
    if (error) setPlanNotice({ type: "error", message: error.message });
    else {
      setPlanNotice({ type: "info", message: "Contrapartida eliminada del plan." });
      await onChange();
    }
  }

  return (
    <div className="panel section">
      <div className="toolbar">
        <div>
          <h3>{family?.family_code ?? "Plan"} - {family?.representative_name ?? ""}</h3>
          <div className="muted">Estado: {planStatusLabel(plan.status)} | Sync: {plan.sync_status}</div>
        </div>
      </div>
      {validation.length > 0 ? (
        <div className="alert error">{validation.join(" ")}</div>
      ) : (
        <div className="alert info">Plan listo para aprobacion administrativa.</div>
      )}
      <div className="form-actions">
        <button className="secondary" type="button" onClick={() => void exportPlansAsPdf([plan], exportContext)}>
          Exportar PDF
        </button>
        <button className="secondary" type="button" onClick={() => void exportPlansAsWord([plan], exportContext)}>
          Exportar Word
        </button>
        <button disabled={!canEditStatus} onClick={onMoveToReview} type="button">Enviar a revision</button>
        <button disabled={!canReview || validation.length > 0 || plan.status === "approved" || plan.status === "closed"} onClick={onApprove} type="button">
          Aprobar
        </button>
        <button className="secondary" disabled={!canReview || plan.status === "closed"} onClick={onReturn} type="button">Devolver</button>
        <button className="danger" disabled={!canReview || plan.status !== "approved"} onClick={onClose} type="button">Cerrar</button>
      </div>
      {planNotice ? <div className={`alert ${planNotice.type}`}>{planNotice.message}</div> : null}
      <details className="collapsible-panel" open={plan.status !== "approved"}>
        <summary>Editar plan operativo desde web</summary>
        <div className="grid compact-panel">
          <form className="span-12 grid compact-panel plan-editor-form" onSubmit={savePlanActivity}>
            <div className="span-12"><strong>Actividad</strong></div>
            <label className="span-6">
              Actividad
              <select disabled={!canEditPlan} required value={activityForm.activity_id} onChange={(event) => setActivityForm({ ...activityForm, activity_id: event.target.value })}>
                <option value="">Seleccione</option>
                {activities.filter((a) => !a.is_deleted).map((activity) => <option key={activity.id} value={activity.id}>{activity.name} ({activity.unit})</option>)}
              </select>
            </label>
            <label className="span-3">
              Linea base
              <input disabled={!canEditPlan} type="number" step="0.01" value={activityForm.baseline} onChange={(event) => setActivityForm({ ...activityForm, baseline: event.target.value })} />
            </label>
            <label className="span-3">
              Meta
              <input disabled={!canEditPlan} type="number" step="0.01" value={activityForm.target} onChange={(event) => setActivityForm({ ...activityForm, target: event.target.value })} />
            </label>
            <label className="span-8">
              Observaciones
              <input disabled={!canEditPlan} value={activityForm.observations} onChange={(event) => setActivityForm({ ...activityForm, observations: event.target.value })} />
            </label>
            <div className="span-4 form-actions">
              <button disabled={!canEditPlan || !activityForm.activity_id}>{activityForm.id ? "Actualizar" : "Agregar"}</button>
            </div>
          </form>
          <form className="span-12 grid compact-panel plan-editor-form" onSubmit={savePlanMaterial}>
            <div className="span-12"><strong>Material del proyecto</strong></div>
            <label className="span-6">
              Actividad del plan
              <select disabled={!canEditPlan} required value={materialForm.plan_activity_id} onChange={(event) => setMaterialForm({ ...materialForm, plan_activity_id: event.target.value })}>
                <option value="">Seleccione</option>
                {planActivities.map((item) => {
                  const activity = activities.find((catalog) => catalog.id === item.activity_id);
                  return <option key={item.id} value={item.id}>{activity?.name ?? "Actividad"}</option>;
                })}
              </select>
            </label>
            <label className="span-4">
              Material
              <select disabled={!canEditPlan} required value={materialForm.material_id} onChange={(event) => setMaterialForm({ ...materialForm, material_id: event.target.value })}>
                <option value="">Seleccione</option>
                {materials.filter((m) => !m.is_deleted).map((material) => <option key={material.id} value={material.id}>{material.name} ({material.unit})</option>)}
              </select>
            </label>
            <label className="span-3">
              Cantidad
              <input disabled={!canEditPlan} required type="number" step="0.01" value={materialForm.quantity} onChange={(event) => setMaterialForm({ ...materialForm, quantity: event.target.value })} />
            </label>
            <label className="span-3">
              Obs.
              <input disabled={!canEditPlan} value={materialForm.observations} onChange={(event) => setMaterialForm({ ...materialForm, observations: event.target.value })} />
            </label>
            <div className="span-12 form-actions">
              <button disabled={!canEditPlan || !materialForm.plan_activity_id || !materialForm.material_id}>{materialForm.id ? "Actualizar" : "Agregar"}</button>
            </div>
          </form>
          <form className="span-12 grid compact-panel plan-editor-form" onSubmit={savePlanCounterpart}>
            <div className="span-12"><strong>Contrapartida familiar</strong></div>
            <label className="span-6">
              Actividad del plan
              <select disabled={!canEditPlan} required value={counterpartForm.plan_activity_id} onChange={(event) => setCounterpartForm({ ...counterpartForm, plan_activity_id: event.target.value })}>
                <option value="">Seleccione</option>
                {planActivities.map((item) => {
                  const activity = activities.find((catalog) => catalog.id === item.activity_id);
                  return <option key={item.id} value={item.id}>{activity?.name ?? "Actividad"}</option>;
                })}
              </select>
            </label>
            <label className="span-3">
              Tipo
              <select disabled={!canEditPlan} value={counterpartForm.contribution_type} onChange={(event) => setCounterpartForm({ ...counterpartForm, contribution_type: event.target.value })}>
                <option value="mano_obra">Mano de obra</option>
                <option value="material_propio">Material propio</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label className="span-6">
              Aporte / especie
              <input disabled={!canEditPlan} required value={counterpartForm.name} onChange={(event) => setCounterpartForm({ ...counterpartForm, name: event.target.value })} />
            </label>
            <label className="span-3">
              Grupo vegetal
              <select disabled={!canEditPlan} value={counterpartForm.vegetal_indicator_group} onChange={(event) => setCounterpartForm({ ...counterpartForm, vegetal_indicator_group: event.target.value })}>
                <option value="">No aplica</option>
                <option value="colinos">Colinos (platano y pina)</option>
                <option value="cacao">Cacao</option>
                <option value="frutales">Frutales</option>
                <option value="forestales_nativos">Forestales nativos</option>
                <option value="otro">Otro vegetal</option>
              </select>
            </label>
            <label className="span-3">
              Cant.
              <input disabled={!canEditPlan} required type="number" step="0.01" value={counterpartForm.quantity} onChange={(event) => setCounterpartForm({ ...counterpartForm, quantity: event.target.value })} />
            </label>
            <label className="span-3">
              Unidad
              <input disabled={!canEditPlan} value={counterpartForm.unit} onChange={(event) => setCounterpartForm({ ...counterpartForm, unit: event.target.value })} />
            </label>
            <label className="span-3">
              Valor unitario
              <input disabled={!canEditPlan} type="number" step="0.01" value={counterpartForm.estimated_unit_value} onChange={(event) => setCounterpartForm({ ...counterpartForm, estimated_unit_value: event.target.value })} />
            </label>
            <label className="span-9">
              Observaciones
              <input disabled={!canEditPlan} value={counterpartForm.observations} onChange={(event) => setCounterpartForm({ ...counterpartForm, observations: event.target.value })} />
            </label>
            <div className="span-3 form-actions">
              <button disabled={!canEditPlan || !counterpartForm.plan_activity_id || !counterpartForm.name}>{counterpartForm.id ? "Actualizar" : "Agregar"}</button>
            </div>
          </form>
        </div>
      </details>
      {planActivities.length === 0 ? (
        <div className="muted">Este plan aun no tiene actividades. La captura principal llegara desde Android.</div>
      ) : (
        planActivities.map((planActivity) => {
          const catalogActivity = activities.find((activity) => activity.id === planActivity.activity_id);
          const materialsForActivity = planMaterials.filter((item) => item.plan_activity_id === planActivity.id);
          const counterpartsForActivity = planCounterparts.filter((item) => item.plan_activity_id === planActivity.id);
          return (
            <div className="panel" key={planActivity.id}>
              <h4>{catalogActivity?.name ?? "Actividad"}</h4>
              <p className="muted">
                Unidad: {planActivity.unit} | Linea base: {planActivity.baseline ?? "N/A"} | Meta: {planActivity.target ?? "N/A"}
              </p>
              <div className="form-actions">
                <button
                  className="secondary"
                  disabled={!canEditPlan}
                  type="button"
                  onClick={() => setActivityForm({
                    id: planActivity.id,
                    activity_id: planActivity.activity_id,
                    baseline: planActivity.baseline?.toString() ?? "",
                    target: planActivity.target?.toString() ?? "",
                    observations: planActivity.observations ?? ""
                  })}
                >
                  Editar actividad
                </button>
                <button className="danger" disabled={!canEditPlan} type="button" onClick={() => void deletePlanActivity(planActivity)}>
                  Eliminar actividad
                </button>
              </div>
              <h5>Materiales del proyecto</h5>
              <DataTable
                headers={["Material", "Cantidad", "Unidad", "Valor cotizado", "Resolver", "Acciones"]}
                rows={materialsForActivity.map((item) => {
                  const official = materials.find((material) => material.id === item.material_id);
                  const provisional = provisionalMaterials.find((material) => material.id === item.provisional_material_id);
                  return [
                    official?.name ?? provisional?.provisional_name ?? "Sin material",
                    item.quantity,
                    item.unit,
                    formatMoney(item.quoted_total),
                    provisional && provisional.status === "pending" ? (
                      <select
                        key="resolve"
                        onChange={(event) => onResolveMaterial(provisional.id, event.target.value)}
                        value=""
                      >
                        <option value="">Material oficial...</option>
                        {materials.filter((m) => !m.is_deleted).map((material) => (
                          <option key={material.id} value={material.id}>{material.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge" key="ok">OK</span>
                    ),
                    <div className="table-actions" key="actions">
                      <button
                        className="secondary"
                        disabled={!canEditPlan || !item.material_id}
                        type="button"
                        onClick={() => setMaterialForm({
                          id: item.id,
                          plan_activity_id: item.plan_activity_id,
                          material_id: item.material_id ?? "",
                          quantity: item.quantity.toString(),
                          observations: item.observations ?? ""
                        })}
                      >
                        Editar
                      </button>
                      <button
                        className="secondary"
                        disabled={!canEditPlan || !item.material_id}
                        type="button"
                        onClick={() => setReassign({ item, targetFamilyId: "", targetActivityId: "" })}
                      >
                        Reasignar
                      </button>
                      <button className="danger super-admin-only" disabled={!canEditPlan} type="button" onClick={() => void deletePlanMaterial(item)}>Eliminar</button>
                    </div>
                  ];
                })}
              />
              <h5>Contrapartida familiar</h5>
              <DataTable
                headers={["Aporte", "Grupo vegetal", "Cantidad", "Unidad", "Valor estimado", "Acciones"]}
                rows={counterpartsForActivity.map((item) => [
                  item.name,
                  vegetalIndicatorGroupLabel(item.vegetal_indicator_group),
                  item.quantity,
                  item.unit,
                  formatMoney(item.estimated_total),
                  <div className="table-actions" key="actions">
                    <button
                      className="secondary"
                      disabled={!canEditPlan}
                      type="button"
                      onClick={() => setCounterpartForm({
                        id: item.id,
                        plan_activity_id: item.plan_activity_id,
                        contribution_type: item.contribution_type,
                        name: item.name,
                        quantity: item.quantity.toString(),
                        unit: item.unit,
                        estimated_unit_value: item.estimated_unit_value.toString(),
                        vegetal_indicator_group: item.vegetal_indicator_group ?? "",
                        observations: item.observations ?? ""
                      })}
                    >
                      Editar
                    </button>
                    <button className="danger super-admin-only" disabled={!canEditPlan} type="button" onClick={() => void deletePlanCounterpart(item)}>Eliminar</button>
                  </div>
                ])}
              />
            </div>
          );
        })
      )}
      {reassign ? (() => {
        const targetFamilies = families.filter((f) => f.project_id === plan.project_id && f.id !== plan.family_id && !f.is_deleted);
        const targetPlanIds = new Set(allPlans.filter((p) => p.family_id === reassign.targetFamilyId && !p.is_deleted).map((p) => p.id));
        const targetActivities = allPlanActivities.filter((pa) => targetPlanIds.has(pa.plan_id) && !pa.is_deleted);
        const materialName = materials.find((m) => m.id === reassign.item.material_id)?.name ?? "Material";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="panel grid" style={{ maxWidth: 520, width: "100%", background: "var(--panel-bg, #ffffff)" }}>
              <div className="span-12"><strong>Reasignar material a otra familia</strong></div>
              <p className="span-12 muted">
                Se mueve <strong>{materialName}</strong> ({formatNumber(reassign.item.quantity)} {reassign.item.unit}) de esta familia a la que elijas. Compras e indicadores se actualizan solos.
              </p>
              <label className="span-12">
                Familia destino
                <select value={reassign.targetFamilyId} onChange={(e) => setReassign({ ...reassign, targetFamilyId: e.target.value, targetActivityId: "" })}>
                  <option value="">Seleccione</option>
                  {targetFamilies.map((f) => <option key={f.id} value={f.id}>{f.family_code} - {f.representative_name}</option>)}
                </select>
              </label>
              {reassign.targetFamilyId ? (
                targetActivities.length > 0 ? (
                  <label className="span-12">
                    Actividad de esa familia (a donde va el material)
                    <select value={reassign.targetActivityId} onChange={(e) => setReassign({ ...reassign, targetActivityId: e.target.value })}>
                      <option value="">Seleccione</option>
                      {targetActivities.map((pa) => (
                        <option key={pa.id} value={pa.id}>{activities.find((a) => a.id === pa.activity_id)?.name ?? "Actividad"}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="span-12 muted">Esa familia no tiene actividades en su plan. Elige otra o crea la actividad primero.</p>
                )
              ) : null}
              <div className="span-12 form-actions">
                <button type="button" disabled={!reassign.targetActivityId} onClick={() => void confirmReassign()}>Reasignar</button>
                <button className="secondary" type="button" onClick={() => setReassign(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}

function validatePlanForApproval(
  plan: OperationalPlan,
  data: {
    activities: Activity[];
    planActivities: PlanActivity[];
    planMaterials: PlanProjectMaterial[];
    provisionalMaterials: ProvisionalMaterial[];
  }
) {
  const errors: string[] = [];
  const activitiesForPlan = data.planActivities.filter((activity) => activity.plan_id === plan.id);
  if (activitiesForPlan.length === 0) errors.push("El plan debe tener al menos una actividad.");
  for (const planActivity of activitiesForPlan) {
    const catalogActivity = data.activities.find((activity) => activity.id === planActivity.activity_id);
    if (catalogActivity?.requires_baseline && planActivity.baseline === null) {
      errors.push(`Falta linea base en ${catalogActivity.name}.`);
    }
    if (catalogActivity?.requires_target && planActivity.target === null) {
      errors.push(`Falta meta en ${catalogActivity.name}.`);
    }
    if ((planActivity.baseline ?? 0) < 0 || (planActivity.target ?? 0) < 0) {
      errors.push(`Hay valores negativos en ${catalogActivity?.name ?? "actividad"}.`);
    }
  }
  const materialRows = data.planMaterials.filter((material) =>
    activitiesForPlan.some((activity) => activity.id === material.plan_activity_id)
  );
  for (const material of materialRows) {
    if (material.quantity <= 0 || !material.unit) {
      errors.push("Hay materiales con cantidad o unidad invalida.");
      break;
    }
    if (material.quoted_unit_price < 0 || material.quoted_total < 0) {
      errors.push("Hay materiales con valores negativos.");
      break;
    }
    const provisional = data.provisionalMaterials.find((item) => item.id === material.provisional_material_id);
    if (provisional?.status === "pending") {
      errors.push("Existen materiales provisionales pendientes por resolver.");
      break;
    }
  }
  return errors;
}

function phase5TabFromView(view: ViewKey): Phase5Tab | null {
  if (view === "phase5_consolidated") return "consolidated";
  if (view === "phase5_etec") return "etec";
  if (view === "phase5_indicators") return "indicators";
  if (view === "phase5_maintenance") return "maintenance";
  if (view === "phase5_acts") return "acts";
  return null;
}

function phase5TabTitle(tab: Phase5Tab) {
  const titles: Record<Phase5Tab, string> = {
    consolidated: "Consolidado de materiales",
    etec: "ETEC",
    indicators: "Herramienta de indicadores",
    maintenance: "Herramienta de mantenimiento",
    acts: "Actas de entrega"
  };
  return titles[tab];
}

type EtecViewMode = "municipality" | "village";
type VegetalIndicatorGroup = "colinos" | "cacao" | "frutales" | "forestales_nativos";
type VegetalQuarterlyType = Extract<QuarterlyProgressType, "vegetal_entrega" | "vegetal_siembra">;

const VEGETAL_INDICATOR_GROUPS: Array<{ key: VegetalIndicatorGroup; label: string; unit: string }> = [
  { key: "colinos", label: "Colinos (platano y pina)", unit: "unidad" },
  { key: "cacao", label: "Cacao", unit: "unidad" },
  { key: "frutales", label: "Frutales", unit: "unidad" },
  { key: "forestales_nativos", label: "Forestales nativos", unit: "unidad" }
];

type ProcurementFilters = {
  project_id: string;
  municipality_id: string;
  village_id: string;
  family_id: string;
  activity_id: string;
  material_id: string;
};

type PurchaseFilters = {
  purchaseNumber: string;
  invoiceNumber: string;
  supplierName: string;
};

type ApprovedMaterialNeed = {
  id: string;
  project_id: string;
  projectName: string;
  municipality_id: string | null;
  municipalityName: string;
  village_id: string | null;
  villageName: string;
  family_id: string;
  familyCode: string;
  familyName: string;
  documentNumber: string;
  operational_plan_id: string;
  plan_activity_id: string;
  activity_id: string | null;
  activityName: string;
  plan_project_material_id: string;
  material_id: string | null;
  provisional_material_id: string | null;
  materialName: string;
  unit: string;
  approvedQuantity: number;
  deliveredQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
  totalValue: number;
};

type ConsolidatedMaterialNeed = {
  key: string;
  project_id: string;
  projectName: string;
  material_id: string | null;
  provisional_material_id: string | null;
  materialName: string;
  unit: string;
  requiredQuantity: number;
  deliveredQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
  totalValue: number;
  sourcePlanMaterialIds: string[];
};

type ConsolidatedMatrixFamily = {
  id: string;
  label: string;
};

type ConsolidatedMatrixRow = {
  key: string;
  project_id: string;
  projectName: string;
  material_id: string | null;
  provisional_material_id: string | null;
  materialName: string;
  unit: string;
  unitPrice: number;
  total: number;
  totalValue: number;
  sourcePlanMaterialIds: string[];
  purchaseBatch?: ProcurementBatch;
  purchaseItem?: ProcurementBatchItem;
  families: string[];
};

type ConsolidatedMatrix = {
  rows: ConsolidatedMatrixRow[];
};

type ConsolidatedPurchaseDraft = {
  invoiced_value: string;
  purchase_number: string;
  invoice_number: string;
  supplier_name: string;
};

type EtecDraft = {
  block: string;
  characteristics: string;
};

type EtecRow = {
  key: string;
  project_id: string;
  material_id: string | null;
  provisional_material_id: string | null;
  materialName: string;
  unit: string;
  block: string;
  characteristics: string;
  total: number;
  unitPrice: number;
  totalValue: number;
  territoryQuantities: Record<string, number>;
  sourcePlanMaterialIds: string[];
  material?: Material;
};

type EtecMatrix = {
  mode: EtecViewMode;
  territories: string[];
  rows: EtecRow[];
};

type PurchaseFamilyReportRow = {
  projectName: string;
  purchaseNumber: number | null;
  purchaseLabel: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  familyCode: string;
  familyName: string;
  municipalityName: string;
  villageName: string;
  activityName: string;
  materialName: string;
  unit: string;
  approvedQuantity: number;
  deliveredQuantity: number;
  quotedUnitPrice: number;
  quotedTotalValue: number;
  purchaseUnitPrice: number;
  purchaseTotalValue: number;
  differenceValue: number;
};

type IndicatorRow = {
  key: string;
  project_id: string;
  municipality_id: string | null;
  village_id: string | null;
  family_id: string;
  operational_plan_id: string;
  plan_activity_id: string;
  activity_id: string | null;
  plan_project_material_id: string;
  material_id: string | null;
  provisional_material_id: string | null;
  familyCode: string;
  familyName: string;
  municipalityName: string;
  villageName: string;
  hectares: string;
  activityName: string;
  materialName: string;
  unit: string;
  targetQuantity: number;
  deliveredQuantity: number;
  implementedQuantity: number;
  progressPercentage: number;
  status: ImplementationProgressStatus;
  observations: string;
  progress?: ImplementationProgress;
};

type IndicatorConsolidatedRow = {
  key: string;
  municipalityName: string;
  villageName: string;
  activityName: string;
  status: ImplementationProgressStatus;
  targetQuantity: number;
  deliveredQuantity: number;
  implementedQuantity: number;
  progressPercentage: number;
};

type TrackingProgressType = Extract<QuarterlyProgressType, "avance" | "entregados" | "sembrados">;

type TrackingActivityGroup = {
  key: string;
  activity_id: string;
  activityName: string;
  unit: string;
  progressTypes: TrackingProgressType[];
};

type TrackingVegetalGroup = {
  key: VegetalIndicatorGroup;
  label: string;
  unit: string;
};

type TrackingActivityCell = {
  operational_plan_id: string;
  plan_activity_id: string;
  activity_id: string;
  baselineQuantity: string | null;
  targetQuantity: number;
  unit: string;
  values: Partial<Record<TrackingProgressType, Partial<Record<number, QuarterlyProgress>>>>;
};

type TrackingVegetalCell = {
  targetQuantity: number;
  unit: string;
  values: Partial<Record<VegetalQuarterlyType, Partial<Record<number, QuarterlyProgress>>>>;
};

type TrackingFamilyRow = {
  key: string;
  project_id: string;
  family_id: string;
  property_id?: string;
  familyCode: string;
  familyName: string;
  documentNumber: string;
  ageYears: string;
  municipality_id: string | null;
  municipalityName: string;
  village_id: string | null;
  villageName: string;
  hectares: string;
  hectaresValue: string;
  activities: Record<string, TrackingActivityCell>;
  vegetalIndicators: Partial<Record<VegetalIndicatorGroup, TrackingVegetalCell>>;
  agreement?: QuarterlyProgress;
};

type TrackingMatrix = {
  year: number;
  visibleQuarters: number[];
  groups: TrackingActivityGroup[];
  vegetalGroups: TrackingVegetalGroup[];
  rows: TrackingFamilyRow[];
};

type MaintenanceTaskType = Extract<MaintenanceProgressType, "deshierbe" | "fertilizacion" | "poda" | "resiembra">;
type MaintenanceOrganicType = Extract<MaintenanceProgressType, "abono_liquido" | "abono_solido">;

type MaintenanceTaskColumn = {
  type: MaintenanceTaskType;
  number: number;
  label: string;
  required: boolean;
};

type MaintenanceActivityGroup = {
  key: string;
  activity_id: string;
  activityName: string;
  unit: string;
  tasks: MaintenanceTaskColumn[];
};

type MaintenanceActivityCell = {
  operational_plan_id: string;
  plan_activity_id: string;
  activity_id: string;
  baselineQuantity: string | null;
  targetQuantity: number;
  unit: string;
  progress: Record<string, MaintenanceProgress | undefined>;
};

type MaintenanceFamilyRow = {
  key: string;
  project_id: string;
  family_id: string;
  familyCode: string;
  familyName: string;
  documentNumber: string;
  ageYears: string;
  municipality_id: string | null;
  municipalityName: string;
  village_id: string | null;
  villageName: string;
  hectares: string;
  activities: Record<string, MaintenanceActivityCell>;
  organicProgress: Partial<Record<MaintenanceOrganicType, Partial<Record<number, MaintenanceProgress>>>>;
};

type MaintenanceMatrix = {
  year: number;
  visibleQuarters: number[];
  groups: MaintenanceActivityGroup[];
  rows: MaintenanceFamilyRow[];
};

type DeliveryActContext = {
  act: DeliveryAct;
  delivery: MaterialDelivery;
  items: MaterialDeliveryItem[];
  project?: Project;
  family?: Family;
  municipality?: Municipality;
  village?: Village;
  plan?: OperationalPlan;
  technician?: Profile | null;
  activityById: Map<string, Activity>;
  projectLogos: Record<string, ProjectLogoConfig[]>;
  introText?: string;
  finalText?: string;
  technicianName?: string;
  technicianDocument?: string;
};

type DeliveryActExportRecord = {
  key: string;
  project: Project;
  family: Family;
  municipality?: Municipality;
  village?: Village;
  plan?: OperationalPlan;
  items: MaterialDeliveryItem[];
  sourceLabel: string;
  deliveryDate: string;
  actNumber: string;
};

function ProcurementDeliveriesActs({
  initialTab,
  projects,
  families,
  properties,
  municipalities,
  villages,
  activities,
  materials,
  plans,
  planActivities,
  planMaterials,
  provisionalMaterials,
  procurementBatches,
  procurementBatchItems,
  materialDeliveries,
  materialDeliveryItems,
  deliveryActs,
  implementationProgress,
  quarterlyProgress,
  maintenanceProgress,
  phase5SchemaStatus,
  maintenanceSchemaStatus,
  currentProfile,
  canManageProcurement,
  canAdminOverride,
  canGenerateActs,
  canEditImplementation,
  onChange
}: {
  initialTab: Phase5Tab;
  projects: Project[];
  families: Family[];
  properties: Property[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  provisionalMaterials: ProvisionalMaterial[];
  procurementBatches: ProcurementBatch[];
  procurementBatchItems: ProcurementBatchItem[];
  materialDeliveries: MaterialDelivery[];
  materialDeliveryItems: MaterialDeliveryItem[];
  deliveryActs: DeliveryAct[];
  implementationProgress: ImplementationProgress[];
  quarterlyProgress: QuarterlyProgress[];
  maintenanceProgress: MaintenanceProgress[];
  phase5SchemaStatus: Phase5SchemaStatus;
  maintenanceSchemaStatus: Phase5SchemaStatus;
  currentProfile: Profile | null;
  canManageProcurement: boolean;
  canAdminOverride: boolean;
  canGenerateActs: boolean;
  canEditImplementation: boolean;
  onChange: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<Phase5Tab>(initialTab);
  const [filters, setFilters] = useState<ProcurementFilters>({
    project_id: "",
    municipality_id: "",
    village_id: "",
    family_id: "",
    activity_id: "",
    material_id: ""
  });
  const [notice, setNotice] = useState<Notice>(null);
  const [consolidatedPurchaseDrafts, setConsolidatedPurchaseDrafts] = useState<Record<string, ConsolidatedPurchaseDraft>>({});
  const [purchaseFilters, setPurchaseFilters] = useState<PurchaseFilters>({ purchaseNumber: "", invoiceNumber: "", supplierName: "" });
  const [detailFamilyFilter, setDetailFamilyFilter] = useState("");
  const [detailPurchaseFilter, setDetailPurchaseFilter] = useState("");
  const [etecViewMode, setEtecViewMode] = useState<EtecViewMode>("municipality");
  const [etecBlockFilter, setEtecBlockFilter] = useState("");
  const [customEtecBlocks, setCustomEtecBlocks] = useState<string[]>([]);
  const [newEtecBlock, setNewEtecBlock] = useState("");
  const [etecDrafts, setEtecDrafts] = useState<Record<string, EtecDraft>>({});
  const [etecPage, setEtecPage] = useState(1);
  const [etecPageSize, setEtecPageSize] = useState(50);
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const [deliveryQuantity, setDeliveryQuantity] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryObservation, setDeliveryObservation] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);
  const [actDeliveryDate, setActDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [actNumberPrefix, setActNumberPrefix] = useState("Entrega");
  const [actIntroText, setActIntroText] = useState(DefaultDeliveryActIntroText);
  const [actFinalText, setActFinalText] = useState(DefaultDeliveryActFinalText);
  const [actTechnicianName, setActTechnicianName] = useState(currentProfile?.full_name ?? "");
  const [actTechnicianDocument, setActTechnicianDocument] = useState(currentProfile?.document_number ?? "");
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState("");
  const [implementedQuantity, setImplementedQuantity] = useState("");
  const [indicatorStatus, setIndicatorStatus] = useState<ImplementationProgressStatus>("pending");
  const [indicatorObservation, setIndicatorObservation] = useState("");
  const [indicatorDate, setIndicatorDate] = useState(new Date().toISOString().slice(0, 10));
  const [trackingYear, setTrackingYear] = useState(new Date().getFullYear());
  const [visibleTrackingQuarters, setVisibleTrackingQuarters] = useState<number[]>([1, 2, 3, 4]);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({});
  useUnsavedChangesWarning(Object.keys(trackingDrafts).length > 0);
  const [trackingPage, setTrackingPage] = useState(1);
  const [trackingPageSize, setTrackingPageSize] = useState(50);
  const [maintenanceYear, setMaintenanceYear] = useState(new Date().getFullYear());
  const [visibleMaintenanceQuarters, setVisibleMaintenanceQuarters] = useState<number[]>([1, 2, 3, 4]);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [maintenancePageSize, setMaintenancePageSize] = useState(50);
  const [saving, setSaving] = useState(false);
  const [approvedNeedsFromDb, setApprovedNeedsFromDb] = useState<ApprovedMaterialNeed[] | null>(null);
  const [loadingApprovedNeeds, setLoadingApprovedNeeds] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let active = true;
    async function loadApprovedMaterialNeeds() {
      setLoadingApprovedNeeds(true);
      try {
        const needs = await fetchApprovedMaterialNeeds({
          projects,
          families,
          municipalities,
          villages,
          activities,
          materials,
          provisionalMaterials
        });
        // La consulta va directo a la BD: acotar al alcance de proyectos recibido (filtro global)
        const projectIds = new Set(projects.map((project) => project.id));
        if (active) setApprovedNeedsFromDb(needs.filter((need) => projectIds.has(need.project_id)));
      } catch (error) {
        if (active) setNotice({ type: "error", message: `No fue posible consultar materiales aprobados: ${getErrorMessage(error)}` });
      } finally {
        if (active) setLoadingApprovedNeeds(false);
      }
    }
    void loadApprovedMaterialNeeds();
    return () => {
      active = false;
    };
  }, [projects, families, municipalities, villages, activities, materials, provisionalMaterials]);

  const approvedNeedsFromState = useMemo(() => buildApprovedMaterialNeeds({
    projects,
    families,
    municipalities,
    villages,
    activities,
    materials,
    plans,
    planActivities,
    planMaterials,
    provisionalMaterials,
    materialDeliveryItems
  }), [projects, families, municipalities, villages, activities, materials, plans, planActivities, planMaterials, provisionalMaterials, materialDeliveryItems]);
  const approvedNeeds = approvedNeedsFromDb && approvedNeedsFromDb.length > 0 ? approvedNeedsFromDb : approvedNeedsFromState;

  const filteredNeeds = useMemo(() => filterApprovedNeeds(approvedNeeds, filters), [approvedNeeds, filters]);
  const visibleProcurementBatches = useMemo(() => filterProcurementBatches(procurementBatches, filters), [procurementBatches, filters]);
  const consolidatedMatrix = useMemo(() => buildConsolidatedMatrix(filteredNeeds, visibleProcurementBatches, procurementBatchItems), [filteredNeeds, visibleProcurementBatches, procurementBatchItems]);
  const consolidatedRows = useMemo(() => filterConsolidatedRowsByPurchase(consolidatedMatrix.rows, purchaseFilters), [consolidatedMatrix.rows, purchaseFilters]);
  const purchaseFamilyReportRows = useMemo(() => filterPurchaseFamilyReportRows(buildPurchaseFamilyReportRows({
    batches: visibleProcurementBatches,
    items: procurementBatchItems,
    needs: filteredNeeds,
    deliveryItems: materialDeliveryItems
  }), purchaseFilters), [visibleProcurementBatches, procurementBatchItems, filteredNeeds, materialDeliveryItems, purchaseFilters]);
  const deliveredByFamilyReport = useMemo(() => {
    const groups = new Map<string, { familyLabel: string; rows: PurchaseFamilyReportRow[]; totalValue: number }>();
    for (const row of purchaseFamilyReportRows) {
      if (row.deliveredQuantity <= 0) continue;
      const key = `${row.familyCode}-${row.familyName}`;
      const group = groups.get(key) ?? { familyLabel: `${row.familyCode} - ${row.familyName}`, rows: [], totalValue: 0 };
      group.rows.push(row);
      group.totalValue += row.deliveredQuantity * (row.purchaseUnitPrice || row.quotedUnitPrice);
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort((left, right) => left.familyLabel.localeCompare(right.familyLabel));
  }, [purchaseFamilyReportRows]);
  const etecMatrix = useMemo(() => buildEtecMatrix(filteredNeeds, materials, etecDrafts, etecViewMode, etecBlockFilter), [filteredNeeds, materials, etecDrafts, etecViewMode, etecBlockFilter]);
  const etecBlocks = useMemo(() => buildEtecBlockOptions(materials, etecMatrix.rows, customEtecBlocks), [materials, etecMatrix.rows, customEtecBlocks]);
  const etecTotalPages = Math.max(1, Math.ceil(etecMatrix.rows.length / etecPageSize));
  const normalizedEtecPage = Math.min(etecPage, etecTotalPages);
  const etecPageStart = etecMatrix.rows.length === 0 ? 0 : (normalizedEtecPage - 1) * etecPageSize + 1;
  const etecVisibleRows = etecMatrix.rows.slice((normalizedEtecPage - 1) * etecPageSize, normalizedEtecPage * etecPageSize);
  const etecPageEnd = etecPageStart === 0 ? 0 : etecPageStart + etecVisibleRows.length - 1;
  const detailFamilyOptions = useMemo(() => buildDetailFamilyOptions(filteredNeeds), [filteredNeeds]);
  const detailPurchaseOptions = useMemo(() => buildDetailPurchaseOptions(visibleProcurementBatches), [visibleProcurementBatches]);
  const detailNeeds = useMemo(() => filterConsolidatedDetailNeeds({
    needs: filteredNeeds,
    batches: visibleProcurementBatches,
    items: procurementBatchItems,
    familyId: detailFamilyFilter,
    purchaseFilters: { ...purchaseFilters, purchaseNumber: detailPurchaseFilter || purchaseFilters.purchaseNumber }
  }), [filteredNeeds, visibleProcurementBatches, procurementBatchItems, detailFamilyFilter, detailPurchaseFilter, purchaseFilters]);
  const allIndicatorRows = useMemo(() => buildIndicatorRows(approvedNeeds, implementationProgress), [approvedNeeds, implementationProgress]);
  const indicatorRows = useMemo(() => filterIndicatorRows(allIndicatorRows, filters), [allIndicatorRows, filters]);
  const indicatorConsolidated = useMemo(() => consolidateIndicatorRows(indicatorRows), [indicatorRows]);
  const trackingMatrix = useMemo(() => buildTrackingMatrix({
    projects,
    families,
    properties,
    municipalities,
    villages,
    activities,
    materials,
    plans,
    planActivities,
    planMaterials,
    quarterlyProgress,
    filters,
    year: trackingYear,
    visibleQuarters: visibleTrackingQuarters
  }), [projects, families, properties, municipalities, villages, activities, materials, plans, planActivities, planMaterials, quarterlyProgress, filters, trackingYear, visibleTrackingQuarters]);
  const trackingTotalPages = Math.max(1, Math.ceil(trackingMatrix.rows.length / trackingPageSize));
  const normalizedTrackingPage = Math.min(trackingPage, trackingTotalPages);
  const trackingPageStart = trackingMatrix.rows.length === 0 ? 0 : (normalizedTrackingPage - 1) * trackingPageSize + 1;
  const trackingVisibleRows = trackingMatrix.rows.slice((normalizedTrackingPage - 1) * trackingPageSize, normalizedTrackingPage * trackingPageSize);
  const trackingPageEnd = trackingPageStart === 0 ? 0 : trackingPageStart + trackingVisibleRows.length - 1;
  const trackingVisibleMatrix = useMemo(() => ({
    ...trackingMatrix,
    rows: trackingVisibleRows
  }), [trackingMatrix, trackingVisibleRows]);
  const maintenanceMatrix = useMemo(() => buildMaintenanceMatrix({
    projects,
    families,
    properties,
    municipalities,
    villages,
    activities,
    plans,
    planActivities,
    planMaterials,
    maintenanceProgress,
    filters,
    year: maintenanceYear,
    visibleQuarters: visibleMaintenanceQuarters
  }), [projects, families, properties, municipalities, villages, activities, plans, planActivities, planMaterials, maintenanceProgress, filters, maintenanceYear, visibleMaintenanceQuarters]);
  const maintenanceTotalPages = Math.max(1, Math.ceil(maintenanceMatrix.rows.length / maintenancePageSize));
  const normalizedMaintenancePage = Math.min(maintenancePage, maintenanceTotalPages);
  const maintenancePageStart = maintenanceMatrix.rows.length === 0 ? 0 : (normalizedMaintenancePage - 1) * maintenancePageSize + 1;
  const maintenanceVisibleRows = maintenanceMatrix.rows.slice((normalizedMaintenancePage - 1) * maintenancePageSize, normalizedMaintenancePage * maintenancePageSize);
  const maintenancePageEnd = maintenancePageStart === 0 ? 0 : maintenancePageStart + maintenanceVisibleRows.length - 1;
  const maintenanceVisibleMatrix = useMemo(() => ({
    ...maintenanceMatrix,
    rows: maintenanceVisibleRows
  }), [maintenanceMatrix, maintenanceVisibleRows]);
  const selectedNeed = approvedNeeds.find((need) => need.id === selectedNeedId) ?? null;
  const selectedIndicator = indicatorRows.find((row) => row.key === selectedIndicatorKey) ?? null;
  const phase5Blocked = !phase5SchemaStatus.ready;
  const maintenanceBlocked = !maintenanceSchemaStatus.ready;

  const visibleDeliveries = materialDeliveries.filter((delivery) =>
    (!filters.project_id || delivery.project_id === filters.project_id)
    && (!filters.family_id || delivery.family_id === filters.family_id)
  );

  const deliveriesWithItems = visibleDeliveries.filter((delivery) =>
    materialDeliveryItems.some((item) => item.material_delivery_id === delivery.id)
  );
  const actExportRecords = useMemo(() => buildDeliveryActExportRecords({
    filteredNeeds,
    materialDeliveries,
    materialDeliveryItems,
    projects,
    families,
    municipalities,
    villages,
    plans,
    filters,
    deliveryDate: actDeliveryDate,
    actNumberPrefix
  }), [filteredNeeds, materialDeliveries, materialDeliveryItems, projects, families, municipalities, villages, plans, filters, actDeliveryDate, actNumberPrefix]);

  useEffect(() => {
    if (!selectedIndicator) {
      setImplementedQuantity("");
      setIndicatorStatus("pending");
      setIndicatorObservation("");
      return;
    }
    setImplementedQuantity(String(selectedIndicator.implementedQuantity || ""));
    setIndicatorStatus(selectedIndicator.status);
    setIndicatorObservation(selectedIndicator.observations);
  }, [selectedIndicator]);

  useEffect(() => {
    setConsolidatedPurchaseDrafts(Object.fromEntries(consolidatedMatrix.rows.map((row) => [
      row.key,
      consolidatedPurchaseDraftFromRow(row)
    ])));
  }, [consolidatedMatrix.rows]);

  useEffect(() => {
    const savedDrafts = loadLocalEtecDrafts(filters.project_id || "all");
    if (Object.keys(savedDrafts).length > 0) {
      setEtecDrafts((current) => ({ ...current, ...savedDrafts }));
    }
  }, [filters.project_id]);

  useEffect(() => {
    setEtecPage(1);
  }, [filters, etecViewMode, etecBlockFilter, etecPageSize]);

  useEffect(() => {
    setTrackingPage(1);
  }, [filters, trackingYear, visibleTrackingQuarters, trackingPageSize]);

  useEffect(() => {
    setMaintenancePage(1);
  }, [filters, maintenanceYear, visibleMaintenanceQuarters, maintenancePageSize]);

  useEffect(() => {
    setEtecDrafts((current) => {
      const next = { ...current };
      for (const row of buildEtecMatrix(filteredNeeds, materials, {}, etecViewMode, "").rows) {
        if (!next[row.key]) {
          next[row.key] = { block: row.block, characteristics: row.characteristics };
        }
      }
      return next;
    });
  }, [filteredNeeds, materials, etecViewMode]);

  function updateFilter(key: keyof ProcurementFilters, value: string) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "project_id") {
        next.municipality_id = "";
        next.village_id = "";
        next.family_id = "";
        next.activity_id = "";
        next.material_id = "";
      }
      if (key === "municipality_id") {
        next.village_id = "";
        next.family_id = "";
      }
      if (key === "village_id") next.family_id = "";
      return next;
    });
  }

  function updateConsolidatedPurchaseDraft(rowKey: string, key: keyof ConsolidatedPurchaseDraft, value: string) {
    setConsolidatedPurchaseDrafts((current) => ({
      ...current,
      [rowKey]: {
        ...(current[rowKey] ?? { invoiced_value: "", purchase_number: "", invoice_number: "", supplier_name: "" }),
        [key]: value
      }
    }));
  }

  function confirmConsolidatedPurchaseDraftChange(
    event: React.FocusEvent<HTMLInputElement>,
    row: ConsolidatedMatrixRow,
    key: keyof ConsolidatedPurchaseDraft,
    label: string
  ) {
    const previous = (consolidatedPurchaseDrafts[row.key] ?? consolidatedPurchaseDraftFromRow(row))[key];
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (confirmManualChange(`Va a cambiar "${label}" para "${row.materialName}" de "${previous || "vacio"}" a "${next || "vacio"}". ¿Desea aplicar este cambio?`)) {
      updateConsolidatedPurchaseDraft(row.key, key, next);
    } else {
      event.currentTarget.value = previous;
      setNotice({ type: "info", message: "Cambio cancelado. La casilla volvio al valor anterior." });
    }
  }

  function updateEtecDraft(rowKey: string, key: keyof EtecDraft, value: string) {
    setEtecDrafts((current) => ({
      ...current,
      [rowKey]: {
        ...(current[rowKey] ?? { block: "", characteristics: "" }),
        [key]: value
      }
    }));
  }

  function addCustomEtecBlock() {
    const block = normalizeEtecBlock(newEtecBlock);
    if (!block) return;
    setCustomEtecBlocks((current) => current.some((item) => sameText(item, block)) ? current : [...current, block]);
    setEtecBlockFilter(block);
    setNewEtecBlock("");
    setNotice({ type: "info", message: `Bloque ETEC "${block}" creado. Ahora puede asignarlo en la tabla.` });
  }

  async function saveConsolidatedPurchaseData() {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (maintenanceBlocked) {
      setNotice({ type: "error", message: maintenanceSchemaStatus.message ?? "Falta la migracion de Herramienta de Mantenimiento en Supabase." });
      return;
    }
    if (!canManageProcurement) {
      setNotice({ type: "error", message: "No tiene permisos para registrar compras." });
      return;
    }
    if (consolidatedRows.length === 0) {
      setNotice({ type: "error", message: "No hay materiales aprobados para guardar datos de compra." });
      return;
    }
    const rowsToSave = consolidatedRows.filter((row) => {
      const draft = consolidatedPurchaseDrafts[row.key] ?? consolidatedPurchaseDraftFromRow(row);
      return draft.invoiced_value.trim() !== ""
        || draft.purchase_number.trim() !== ""
        || draft.invoice_number.trim() !== ""
        || draft.supplier_name.trim() !== ""
        || Boolean(row.purchaseItem);
    });
    if (rowsToSave.length === 0) {
      setNotice({ type: "info", message: "No hay datos de compra para guardar." });
      return;
    }
    setSaving(true);
    try {
      let savedRows = 0;
      for (const row of rowsToSave) {
        const draft = consolidatedPurchaseDrafts[row.key] ?? consolidatedPurchaseDraftFromRow(row);
        const invoicedUnitValue = Number(draft.invoiced_value || 0);
        const purchaseNumber = Number(draft.purchase_number || row.purchaseBatch?.purchase_number || 0);
        if (!Number.isFinite(invoicedUnitValue) || invoicedUnitValue < 0) {
          throw new Error(`El valor unitario facturado de ${row.materialName} debe ser cero o mayor.`);
        }
        if (!Number.isInteger(purchaseNumber) || purchaseNumber <= 0) {
          throw new Error(`Digite un numero de compra valido para ${row.materialName}.`);
        }
        const batch = row.purchaseBatch ?? await findOrCreateProcurementBatchForRow({
          row,
          purchaseNumber,
          invoiceNumber: draft.invoice_number,
          supplierName: draft.supplier_name,
          filters,
          batches: procurementBatches
        });
        const batchUpdate = await supabase
          .from("procurement_batches")
          .update({
            purchase_number: purchaseNumber,
            supplier_name: draft.supplier_name.trim() || null,
            invoice_number: draft.invoice_number.trim() || null,
            status: invoicedUnitValue > 0 ? "comprado" : "pendiente_compra",
            subtotal: row.totalValue
          })
          .eq("id", batch.id);
        if (batchUpdate.error) throw batchUpdate.error;

        const purchaseTotalValue = invoicedUnitValue * row.total;
        const itemPayload = {
          procurement_batch_id: batch.id,
          material_id: row.material_id,
          provisional_material_id: row.provisional_material_id,
          material_name: row.materialName,
          unit: row.unit,
          required_quantity: row.total,
          purchased_quantity: row.total,
          unit_price: row.unitPrice,
          quoted_unit_price: row.unitPrice,
          quoted_total_value: row.totalValue,
          invoice_quantity: row.total,
          purchase_unit_price: invoicedUnitValue,
          purchase_total_value: purchaseTotalValue,
          status: invoicedUnitValue > 0 ? "comprado" : "pendiente_compra",
          source_plan_material_ids: row.sourcePlanMaterialIds
        };
        const itemResult = row.purchaseItem
          ? await supabase.from("procurement_batch_items").update(itemPayload).eq("id", row.purchaseItem.id)
          : await supabase.from("procurement_batch_items").insert(itemPayload);
        if (itemResult.error) throw itemResult.error;
        savedRows += 1;
      }
      if (savedRows === 0) {
        setNotice({ type: "info", message: "No hay datos de compra para guardar." });
      } else {
        setNotice({ type: "info", message: `Datos de compra guardados para ${savedRows} material(es).` });
        await onChange();
      }
    } catch (error) {
      if (isMissingEtecColumnError(error)) {
        saveLocalEtecDrafts(filters.project_id || "all", etecDrafts);
        setNotice({
          type: "info",
          message: "Ajustes ETEC guardados localmente. Para guardarlos en Supabase aplique la migracion 20260620100000_phase7_etec_material_specs.sql y recargue el schema."
        });
        return;
      }
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function saveEtecDrafts() {
    setNotice(null);
    if (!canManageProcurement) {
      setNotice({ type: "error", message: "No tiene permisos para actualizar ETEC." });
      return;
    }
    if (etecMatrix.rows.length === 0) {
      setNotice({ type: "error", message: "No hay materiales aprobados para actualizar ETEC." });
      return;
    }
    setSaving(true);
    try {
      let updated = 0;
      for (const row of etecMatrix.rows) {
        if (!row.material_id) continue;
        const draft = etecDrafts[row.key] ?? { block: row.block, characteristics: row.characteristics };
        const rawBlock = draft.block.trim();
        const payload = {
          etec_block: rawBlock ? normalizeEtecBlock(rawBlock) : defaultEtecBlockForCategory(row.material?.category),
          technical_characteristics: draft.characteristics.trim() || null
        };
        const { error } = await supabase.from("material_catalog").update(payload).eq("id", row.material_id);
        if (error) throw error;
        updated += 1;
      }
      setNotice({ type: "info", message: `ETEC actualizado para ${updated} material(es).` });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function createPurchaseFromEtec() {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (!canManageProcurement) {
      setNotice({ type: "error", message: "No tiene permisos para crear compras." });
      return;
    }
    if (!filters.project_id) {
      setNotice({ type: "error", message: "Seleccione un proyecto para crear una compra desde ETEC." });
      return;
    }
    if (etecMatrix.rows.length === 0) {
      setNotice({ type: "error", message: "No hay materiales ETEC para crear compra." });
      return;
    }
    setSaving(true);
    try {
      const purchaseNumber = nextProcurementPurchaseNumber(procurementBatches, filters.project_id);
      const batchCode = `ETEC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`;
      const subtotal = etecMatrix.rows.reduce((sum, row) => sum + row.totalValue, 0);
      const { data: batch, error: batchError } = await supabase
        .from("procurement_batches")
        .insert({
          project_id: filters.project_id,
          batch_code: batchCode,
          purchase_number: purchaseNumber,
          name: `Compra ${purchaseNumber} - ETEC`,
          status: "pendiente_compra",
          filter_project_id: filters.project_id,
          filter_municipality_id: filters.municipality_id || null,
          filter_village_id: filters.village_id || null,
          filter_family_id: filters.family_id || null,
          filter_activity_id: filters.activity_id || null,
          filter_material_id: filters.material_id || null,
          subtotal,
          observations: `Compra creada desde ETEC (${etecViewMode === "municipality" ? "por municipio" : "por vereda"}).`
        })
        .select()
        .single();
      if (batchError) throw batchError;

      const items = etecMatrix.rows.map((row) => ({
        procurement_batch_id: batch.id,
        material_id: row.material_id,
        provisional_material_id: row.provisional_material_id,
        material_name: row.materialName,
        unit: row.unit,
        required_quantity: row.total,
        purchased_quantity: row.total,
        unit_price: row.unitPrice,
        quoted_unit_price: row.unitPrice,
        quoted_total_value: row.totalValue,
        invoice_quantity: null,
        purchase_unit_price: null,
        purchase_total_value: null,
        etec_block: row.block,
        technical_characteristics: row.characteristics || null,
        status: "pendiente_compra",
        source_plan_material_ids: row.sourcePlanMaterialIds
      }));
      let createdWithoutEtecColumns = false;
      const { error: itemsError } = await supabase.from("procurement_batch_items").insert(items);
      if (itemsError) {
        if (!isMissingEtecColumnError(itemsError)) throw itemsError;
        createdWithoutEtecColumns = true;
        const fallbackItems = items.map(({ etec_block: _etecBlock, technical_characteristics: _technicalCharacteristics, ...item }) => item);
        const { error: fallbackError } = await supabase.from("procurement_batch_items").insert(fallbackItems);
        if (fallbackError) throw fallbackError;
      }
      setNotice({
        type: createdWithoutEtecColumns ? "info" : "info",
        message: createdWithoutEtecColumns
          ? `Compra ${purchaseNumber} creada desde ETEC con ${items.length} item(s). Falta aplicar la migracion ETEC para guardar bloque y caracteristicas en la compra.`
          : `Compra ${purchaseNumber} creada desde ETEC con ${items.length} item(s).`
      });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function findOrCreateProcurementBatchForRow(data: {
    row: ConsolidatedMatrixRow;
    purchaseNumber: number;
    invoiceNumber: string;
    supplierName: string;
    filters: ProcurementFilters;
    batches: ProcurementBatch[];
  }) {
    const existing = data.batches.find((batch) =>
      batch.project_id === data.row.project_id
      && Number(batch.purchase_number) === data.purchaseNumber
      && (batch.invoice_number ?? "") === data.invoiceNumber.trim()
      && (batch.supplier_name ?? "") === data.supplierName.trim()
    );
    if (existing) return existing;

    const batchCode = `COMP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`;
    const { data: batch, error } = await supabase
      .from("procurement_batches")
      .insert({
        project_id: data.row.project_id,
        batch_code: batchCode,
        purchase_number: data.purchaseNumber,
        name: `Compra ${data.purchaseNumber}`,
        status: "pendiente_compra",
        supplier_name: data.supplierName.trim() || null,
        invoice_number: data.invoiceNumber.trim() || null,
        filter_project_id: data.filters.project_id || data.row.project_id,
        filter_municipality_id: data.filters.municipality_id || null,
        filter_village_id: data.filters.village_id || null,
        filter_family_id: data.filters.family_id || null,
        filter_activity_id: data.filters.activity_id || null,
        filter_material_id: data.filters.material_id || data.row.material_id,
        subtotal: data.row.totalValue
      })
      .select()
      .single();
    if (error) throw error;
    return batch as ProcurementBatch;
  }

  async function registerDelivery() {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (!canManageProcurement) {
      setNotice({ type: "error", message: "No tiene permisos para registrar entregas." });
      return;
    }
    if (!selectedNeed) {
      setNotice({ type: "error", message: "Seleccione un material aprobado pendiente de entrega." });
      return;
    }
    const quantity = Number(deliveryQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setNotice({ type: "error", message: "La cantidad entregada debe ser mayor que cero." });
      return;
    }
    if (quantity > selectedNeed.pendingQuantity && (!adminOverride || !canAdminOverride)) {
      setNotice({ type: "error", message: "La cantidad supera el saldo aprobado. Requiere autorizacion administrativa." });
      return;
    }
    const familyNeeds = approvedNeeds.filter((need) =>
      need.project_id === selectedNeed.project_id
      && need.family_id === selectedNeed.family_id
      && need.operational_plan_id === selectedNeed.operational_plan_id
    );
    const status = familyNeeds.every((need) => {
      const pending = need.id === selectedNeed.id ? need.pendingQuantity - quantity : need.pendingQuantity;
      return pending <= 0.0001;
    }) ? "entregado_total" : "entregado_parcial";

    setSaving(true);
    try {
      const { data: delivery, error: deliveryError } = await supabase
        .from("material_deliveries")
        .insert({
          project_id: selectedNeed.project_id,
          family_id: selectedNeed.family_id,
          operational_plan_id: selectedNeed.operational_plan_id,
          delivery_date: deliveryDate,
          status,
          observations: deliveryObservation.trim() || null,
          registered_by: currentProfile?.id ?? null
        })
        .select()
        .single();
      if (deliveryError) throw deliveryError;

      const { error: itemError } = await supabase.from("material_delivery_items").insert({
        material_delivery_id: delivery.id,
        project_id: selectedNeed.project_id,
        family_id: selectedNeed.family_id,
        operational_plan_id: selectedNeed.operational_plan_id,
        plan_activity_id: selectedNeed.plan_activity_id,
        activity_id: selectedNeed.activity_id,
        plan_project_material_id: selectedNeed.plan_project_material_id,
        material_id: selectedNeed.material_id,
        provisional_material_id: selectedNeed.provisional_material_id,
        material_name: selectedNeed.materialName,
        unit: selectedNeed.unit,
        approved_quantity: selectedNeed.approvedQuantity,
        delivered_quantity: quantity,
        unit_price: selectedNeed.unitPrice,
        observations: deliveryObservation.trim() || null,
        admin_override: quantity > selectedNeed.pendingQuantity,
        override_authorized_by: quantity > selectedNeed.pendingQuantity ? currentProfile?.id ?? null : null
      });
      if (itemError) throw itemError;
      setDeliveryQuantity("");
      setDeliveryObservation("");
      setAdminOverride(false);
      setNotice({ type: "info", message: status === "entregado_total" ? "Entrega total registrada." : "Entrega parcial registrada." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function saveImplementationProgress() {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (!selectedIndicator) {
      setNotice({ type: "error", message: "Seleccione una fila de la herramienta de indicadores." });
      return;
    }
    if (!canEditImplementation) {
      setNotice({ type: "error", message: "No tiene permisos para editar avances de implementacion." });
      return;
    }
    const implemented = Number(implementedQuantity || 0);
    if (!Number.isFinite(implemented) || implemented < 0) {
      setNotice({ type: "error", message: "La cantidad implementada debe ser cero o mayor." });
      return;
    }
    if (!confirmManualChange(`Va a guardar un avance de implementacion para "${selectedIndicator.materialName || selectedIndicator.activityName}" con valor ${formatNumber(implemented)} ${selectedIndicator.unit}. ¿Desea continuar?`)) {
      setNotice({ type: "info", message: "Cambio cancelado. No se guardo el avance." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        project_id: selectedIndicator.project_id,
        family_id: selectedIndicator.family_id,
        operational_plan_id: selectedIndicator.operational_plan_id,
        plan_activity_id: selectedIndicator.plan_activity_id,
        material_id: selectedIndicator.material_id,
        indicator_name: selectedIndicator.materialName || selectedIndicator.activityName,
        unit: selectedIndicator.unit,
        target_quantity: selectedIndicator.targetQuantity,
        delivered_quantity: selectedIndicator.deliveredQuantity,
        implemented_quantity: implemented,
        status: indicatorStatus,
        observations: indicatorObservation.trim() || null,
        progress_date: indicatorDate || null
      };
      const existingProgress = selectedIndicator.progress ?? await findExistingImplementationProgress(selectedIndicator);
      const result = existingProgress
        ? await supabase.from("implementation_progress").update(payload).eq("id", existingProgress.id)
        : await supabase.from("implementation_progress").insert(payload);
      if (result.error) throw result.error;
      setNotice({ type: "info", message: "Avance de implementacion guardado." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  function updateTrackingDraft(key: string, value: string) {
    setTrackingDrafts((current) => ({ ...current, [key]: value }));
  }

  async function saveTrackingHectares(row: TrackingFamilyRow, rawValue: string) {
    setNotice(null);
    if (!canEditImplementation) {
      setNotice({ type: "error", message: "No tiene permisos para editar hectareas del predio." });
      return;
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) {
      setNotice({ type: "error", message: "Las hectareas del predio deben ser un valor numerico mayor o igual a cero." });
      throw new Error("Valor de hectareas no valido.");
    }
    setSaving(true);
    try {
      const result = row.property_id
        ? await supabase.from("properties").update({ total_area_ha: value }).eq("id", row.property_id)
        : await supabase.from("properties").insert({
          family_id: row.family_id,
          property_name: null,
          total_area_ha: value,
          conservation_area_ha: null,
          observations: null
        });
      if (result.error) throw result.error;
      setNotice({ type: "info", message: "Hectareas del predio actualizadas." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function saveTrackingTarget(planActivityId: string, rawValue: string) {
    setNotice(null);
    if (!canEditImplementation) {
      setNotice({ type: "error", message: "No tiene permisos para editar la meta." });
      return;
    }
    const value = rawValue.trim() === "" ? null : Number(rawValue);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setNotice({ type: "error", message: "La meta debe ser un valor numerico mayor o igual a cero." });
      throw new Error("Valor de meta no valido.");
    }
    setSaving(true);
    try {
      const result = await supabase.from("plan_activities").update({ target: value !== null ? String(value) : null }).eq("id", planActivityId);
      if (result.error) throw result.error;
      setNotice({ type: "info", message: "Meta actualizada." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function saveTrackingMatrix() {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (!canEditImplementation) {
      setNotice({ type: "error", message: "No tiene permisos para editar avances de seguimiento." });
      return;
    }
    const entries = Object.entries(trackingDrafts).filter(([, value]) => value.trim() !== "");
    if (entries.length === 0) {
      setNotice({ type: "info", message: "No hay cambios de seguimiento para guardar." });
      return;
    }
    setSaving(true);
    try {
      const agreementPayloads = new Map<string, Partial<QuarterlyProgress> & {
        project_id: string;
        family_id: string;
        year: number;
        progress_type: "cumplimiento_acuerdo";
      }>();
      for (const [key, rawValue] of entries) {
        const parsed = parseTrackingDraftKey(key);
        const quantity = Number(rawValue);
        if (!Number.isFinite(quantity) || quantity < 0) {
          throw new Error("Los avances de seguimiento deben ser valores numericos mayores o iguales a cero.");
        }
        const row = trackingMatrix.rows.find((item) => item.family_id === parsed.familyId);
        if (!row) continue;
        if (parsed.kind === "activity") {
          const cell = row.activities[parsed.groupKey];
          if (!cell || !parsed.quarter || !parsed.progressType) continue;
          await upsertQuarterlyProgress({
            project_id: row.project_id,
            family_id: row.family_id,
            operational_plan_id: cell.operational_plan_id,
            plan_activity_id: cell.plan_activity_id,
            activity_id: cell.activity_id,
            year: trackingYear,
            quarter: parsed.quarter,
            target_quantity: cell.targetQuantity,
            progress_quantity: quantity,
            progress_type: parsed.progressType
          });
        } else if (parsed.kind === "vegetal") {
          const cell = row.vegetalIndicators[parsed.vegetalGroup];
          if (!cell || !parsed.quarter || !parsed.progressType) continue;
          await upsertQuarterlyProgress({
            project_id: row.project_id,
            family_id: row.family_id,
            operational_plan_id: null,
            plan_activity_id: null,
            activity_id: null,
            year: trackingYear,
            quarter: parsed.quarter,
            target_quantity: cell.targetQuantity,
            progress_quantity: quantity,
            progress_type: parsed.progressType,
            vegetal_indicator_group: parsed.vegetalGroup
          });
        } else {
          const existing = agreementPayloads.get(row.family_id) ?? {
            project_id: row.project_id,
            family_id: row.family_id,
            year: trackingYear,
            progress_type: "cumplimiento_acuerdo",
            target_quantity: row.agreement?.target_quantity ?? 100,
            progress_quantity: row.agreement?.progress_quantity ?? 0
          };
          if (parsed.field === "meta") existing.target_quantity = quantity;
          if (parsed.field === "percent") existing.progress_quantity = quantity;
          agreementPayloads.set(row.family_id, existing);
        }
      }
      for (const payload of agreementPayloads.values()) {
        await upsertQuarterlyProgress({
          project_id: payload.project_id,
          family_id: payload.family_id,
          operational_plan_id: null,
          plan_activity_id: null,
          activity_id: null,
          year: payload.year,
          quarter: null,
          target_quantity: Number(payload.target_quantity ?? 100),
          progress_quantity: Number(payload.progress_quantity ?? 0),
          progress_type: "cumplimiento_acuerdo"
        });
      }
      setTrackingDrafts({});
      setNotice({ type: "info", message: "Seguimiento trimestral guardado." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function saveMaintenanceCell(payload: {
    row: MaintenanceFamilyRow;
    group: MaintenanceActivityGroup;
    cell: MaintenanceActivityCell;
    maintenanceType: MaintenanceProgressType;
    maintenanceNumber: number;
    quarter: number | null;
    value: string;
  }) {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (!canEditImplementation) {
      setNotice({ type: "error", message: "No tiene permisos para editar mantenimiento." });
      return;
    }
    const isOrganic = payload.maintenanceType === "abono_liquido" || payload.maintenanceType === "abono_solido";
    const trimmed = payload.value.trim();
    if (isOrganic && trimmed !== "") {
      const numericValue = Number(trimmed);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        setNotice({ type: "error", message: "El avance de abonos debe ser un valor numerico mayor o igual a cero." });
        throw new Error("Valor de abono no valido.");
      }
    }
    setSaving(true);
    try {
      await upsertMaintenanceProgress({
        project_id: payload.row.project_id,
        family_id: payload.row.family_id,
        operational_plan_id: payload.cell.operational_plan_id,
        plan_activity_id: payload.cell.plan_activity_id,
        activity_id: payload.cell.activity_id,
        year: maintenanceYear,
        quarter: payload.quarter,
        maintenance_type: payload.maintenanceType,
        maintenance_number: payload.maintenanceNumber,
        maintenance_date: isOrganic ? null : trimmed || null,
        progress_quantity: isOrganic ? Number(trimmed || 0) : 0,
        unit: maintenanceProgressUnit(payload.maintenanceType),
        observations: null
      });
      setNotice({ type: "info", message: "Mantenimiento actualizado." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function saveMaintenanceOrganicCell(payload: {
    row: MaintenanceFamilyRow;
    maintenanceType: MaintenanceOrganicType;
    quarter: number;
    value: string;
  }) {
    setNotice(null);
    if (phase5Blocked) {
      setNotice({ type: "error", message: phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE });
      return;
    }
    if (maintenanceBlocked) {
      setNotice({ type: "error", message: maintenanceSchemaStatus.message ?? "Falta la migracion de Herramienta de Mantenimiento en Supabase." });
      return;
    }
    if (!canEditImplementation) {
      setNotice({ type: "error", message: "No tiene permisos para editar abonos organicos." });
      return;
    }
    const numericValue = Number(payload.value.trim() || 0);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setNotice({ type: "error", message: "El valor de abonos debe ser numerico mayor o igual a cero." });
      throw new Error("Valor de abonos no valido.");
    }
    setSaving(true);
    try {
      await upsertMaintenanceProgress({
        project_id: payload.row.project_id,
        family_id: payload.row.family_id,
        operational_plan_id: null,
        plan_activity_id: null,
        activity_id: null,
        year: maintenanceYear,
        quarter: payload.quarter,
        maintenance_type: payload.maintenanceType,
        maintenance_number: 1,
        maintenance_date: null,
        progress_quantity: numericValue,
        unit: maintenanceProgressUnit(payload.maintenanceType),
        observations: null
      });
      setNotice({ type: "info", message: "Abonos organicos actualizados." });
      await onChange();
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function ensureDeliveryAct(delivery: MaterialDelivery) {
    if (phase5Blocked) throw new Error(phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE);
    const items = materialDeliveryItems.filter((item) => item.material_delivery_id === delivery.id);
    if (items.length === 0) throw new Error("No se puede generar acta sin entrega registrada con items.");
    const existing = deliveryActs.find((act) => act.material_delivery_id === delivery.id && !act.is_deleted);
    if (existing) return existing;
    if (!canGenerateActs) throw new Error("No tiene permisos para generar actas.");
    const actNumber = `Entrega ${deliverySequenceForFamilyDelivery(delivery, materialDeliveries, materialDeliveryItems)}`;
    const { data, error } = await supabase
      .from("delivery_acts")
      .insert({
        project_id: delivery.project_id,
        family_id: delivery.family_id,
        operational_plan_id: delivery.operational_plan_id,
        material_delivery_id: delivery.id,
        act_number: actNumber,
        status: "generated",
        generated_by: currentProfile?.id ?? null,
        observations: delivery.observations
      })
      .select()
      .single();
    if (error) throw error;
    await onChange();
    return data as DeliveryAct;
  }

  async function exportDeliveryAct(delivery: MaterialDelivery, format: "pdf" | "word") {
    setNotice(null);
    setSaving(true);
    try {
      const act = await ensureDeliveryAct(delivery);
      const context = buildDeliveryActContext({
        act,
        delivery,
        projects,
        families,
        municipalities,
        villages,
        plans,
        activities,
        materialDeliveryItems,
        technician: currentProfile,
        projectLogos: await loadProjectLogos()
      });
      context.introText = actIntroText;
      context.finalText = actFinalText;
      context.technicianName = actTechnicianName;
      context.technicianDocument = actTechnicianDocument;
      if (format === "pdf") {
        const bytes = await buildDeliveryActPdf(context);
        saveBlob(new Blob([bytes], { type: "application/pdf" }), `${sanitizeFileName(act.act_number)}.pdf`);
      } else {
        const blob = await buildDeliveryActDocx(context);
        saveBlob(blob, `${sanitizeFileName(act.act_number)}.docx`);
      }
      setNotice({ type: "info", message: `Acta ${format === "pdf" ? "PDF" : "Word"} generada.` });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function exportFilteredDeliveryActs(format: "pdf" | "word" | "excel") {
    setNotice(null);
    if (!canGenerateActs) {
      setNotice({ type: "error", message: "No tiene permisos para generar actas." });
      return;
    }
    if (actExportRecords.length === 0) {
      setNotice({ type: "error", message: "No hay familias con materiales para exportar actas." });
      return;
    }
    setSaving(true);
    try {
      if (format === "excel") {
        const blob = await buildDeliveryActsExcel(actExportRecords, actTechnicianName);
        saveBlob(blob, `actas-entrega-${actDeliveryDate}.xlsx`);
      } else {
        const logos = await loadProjectLogos();
        const contexts = actExportRecords.map((record) => buildDeliveryActContextFromRecord({
          record,
          activities,
          technician: currentProfile,
          projectLogos: logos,
          introText: actIntroText,
          finalText: actFinalText,
          technicianName: actTechnicianName,
          technicianDocument: actTechnicianDocument
        }));
        if (format === "pdf") {
          const bytes = await buildDeliveryActsPdf(contexts);
          saveBlob(new Blob([bytes], { type: "application/pdf" }), `actas-entrega-${actDeliveryDate}.pdf`);
        } else {
          const blob = await buildDeliveryActsDocx(contexts);
          saveBlob(blob, `actas-entrega-${actDeliveryDate}.docx`);
        }
      }
      setNotice({ type: "info", message: `Actas ${format === "pdf" ? "PDF" : format === "word" ? "Word" : "Excel"} generadas.` });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }



  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>{phase5TabTitle(activeTab)}</h2>
          <div className="muted">Consolidado, seguimiento de implementacion y actas desde planes operativos aprobados.</div>
        </div>
        <span className="badge">{canManageProcurement ? "Operacion habilitada" : "Solo lectura"}</span>
      </div>
      <AlertNotice notice={notice} onClose={() => setNotice(null)} />
      <Phase5Filters
        filters={filters}
        projects={projects}
        families={families}
        municipalities={municipalities}
        villages={villages}
        activities={activities}
        materials={materials}
        onChange={updateFilter}
      />
      {phase5Blocked ? (
        <div className="alert error">{phase5SchemaStatus.message ?? PHASE5_MISSING_MIGRATIONS_MESSAGE}</div>
      ) : null}
      {!phase5Blocked && activeTab === "maintenance" && maintenanceBlocked ? (
        <div className="alert error">{maintenanceSchemaStatus.message ?? "Falta la migracion de Herramienta de Mantenimiento en Supabase."}</div>
      ) : null}

      {!phase5Blocked && activeTab === "consolidated" ? (
        <div className="section compact-section">
          {loadingApprovedNeeds ? <div className="alert info">Consultando materiales aprobados...</div> : null}
          <div className="panel grid compact-panel">
            <label className="span-3">
              Numero compra
              <select value={purchaseFilters.purchaseNumber} onChange={(event) => setPurchaseFilters((current) => ({ ...current, purchaseNumber: event.target.value }))}>
                <option value="">Todas</option>
                {detailPurchaseOptions.map((purchaseNumber) => (
                  <option key={purchaseNumber} value={String(purchaseNumber)}>Compra {purchaseNumber}</option>
                ))}
              </select>
            </label>
            <label className="span-3">
              Numero factura
              <input value={purchaseFilters.invoiceNumber} onChange={(event) => setPurchaseFilters((current) => ({ ...current, invoiceNumber: event.target.value }))} placeholder="Filtrar factura" />
            </label>
            <label className="span-3">
              Proveedor
              <input value={purchaseFilters.supplierName} onChange={(event) => setPurchaseFilters((current) => ({ ...current, supplierName: event.target.value }))} placeholder="Filtrar proveedor" />
            </label>
            <div className="span-3 form-actions">
              <button className="secondary" type="button" onClick={() => setPurchaseFilters({ purchaseNumber: "", invoiceNumber: "", supplierName: "" })}>
                Limpiar filtros compra
              </button>
            </div>
          </div>
          <DataTable
            headers={[
              "Descripcion producto",
              "Unidad",
              "Valor unitario cotizado",
              "Total cantidad",
              "Valor total cotizado",
              "Valor unitario facturado",
              "Valor total facturado",
              "Numero compra",
              "Numero factura",
              "Proveedor"
            ]}
            emptyMessage={filters.project_id ? "No hay planes aprobados con materiales para los filtros seleccionados." : "Seleccione un proyecto o deje Todos para consultar materiales aprobados."}
            rows={consolidatedRows.map((row) => {
              const draft = consolidatedPurchaseDrafts[row.key] ?? consolidatedPurchaseDraftFromRow(row);
              const invoicedUnitValue = Number(draft.invoiced_value || 0);
              return [
                row.materialName,
                row.unit,
                formatExportMoney(row.unitPrice),
                <strong key="total">{formatNumber(row.total)} {row.unit}</strong>,
                <strong key="total-value">{formatExportMoney(row.totalValue)}</strong>,
                <input key="invoiced" type="number" min="0" step="0.01" defaultValue={draft.invoiced_value} onBlur={(event) => confirmConsolidatedPurchaseDraftChange(event, row, "invoiced_value", "Valor unitario facturado")} />,
                <strong key="invoiced-total">{formatExportMoney(invoicedUnitValue * row.total)}</strong>,
                <input key="purchase" type="number" min="1" step="1" defaultValue={draft.purchase_number} onBlur={(event) => confirmConsolidatedPurchaseDraftChange(event, row, "purchase_number", "Numero compra")} />,
                <input key="invoice" defaultValue={draft.invoice_number} onBlur={(event) => confirmConsolidatedPurchaseDraftChange(event, row, "invoice_number", "Numero factura")} />,
                <input key="supplier" defaultValue={draft.supplier_name} onBlur={(event) => confirmConsolidatedPurchaseDraftChange(event, row, "supplier_name", "Proveedor")} />
              ];
            })}
          />
          <div className="form-actions">
            <button disabled={!canManageProcurement || saving || consolidatedRows.length === 0} type="button" onClick={() => void saveConsolidatedPurchaseData()}>
              Guardar datos de compra
            </button>
            <button className="secondary" disabled={consolidatedRows.length === 0} type="button" onClick={() => void exportConsolidatedExcel({ rows: consolidatedRows }, filteredNeeds)}>
              Exportar consolidado Excel
            </button>
            <button className="secondary" disabled={purchaseFamilyReportRows.length === 0} type="button" onClick={() => void exportPurchasesByFamilyExcel(purchaseFamilyReportRows)}>
              Exportar compras por familia Excel
            </button>
          </div>
          <details className="collapsible-panel">
            <summary>Detalle por familia y material ({detailNeeds.length})</summary>
            <div className="grid compact-panel detail-filter-panel">
              <label className="span-6">
                Filtrar familia
                <select value={detailFamilyFilter} onChange={(event) => setDetailFamilyFilter(event.target.value)}>
                  <option value="">Todas</option>
                  {detailFamilyOptions.map((family) => (
                    <option key={family.id} value={family.id}>{family.label}</option>
                  ))}
                </select>
              </label>
              <label className="span-3">
                Filtrar numero compra
                <select value={detailPurchaseFilter} onChange={(event) => setDetailPurchaseFilter(event.target.value)}>
                  <option value="">Todas</option>
                  {detailPurchaseOptions.map((purchaseNumber) => (
                    <option key={purchaseNumber} value={String(purchaseNumber)}>Compra {purchaseNumber}</option>
                  ))}
                </select>
              </label>
            </div>
            <DataTable
              embedded
              headers={["Proyecto", "Municipio", "Vereda", "Familia", "Actividad", "Material", "Aprobado", "Pendiente"]}
              emptyMessage="No hay materiales aprobados para los filtros seleccionados."
              rows={detailNeeds.map((need) => [
                need.projectName,
                need.municipalityName,
                need.villageName,
                `${need.familyCode} - ${need.familyName}`,
                need.activityName,
                need.materialName,
                `${formatNumber(need.approvedQuantity)} ${need.unit}`,
                `${formatNumber(need.pendingQuantity)} ${need.unit}`
              ])}
            />
          </details>
          <details className="collapsible-panel">
            <summary>Materiales entregados por familia ({deliveredByFamilyReport.reduce((sum, group) => sum + group.rows.length, 0)})</summary>
            <div className="muted">Incluye todas las compras y todos los planes del proyecto. Use el filtro Familia del panel superior para consultar una sola familia.</div>
            <div className="form-actions">
              <button className="secondary" disabled={deliveredByFamilyReport.length === 0} type="button" onClick={() => void exportDeliveredByFamilyExcel(deliveredByFamilyReport.flatMap((group) => group.rows))}>
                Exportar entregado por familia Excel
              </button>
            </div>
            <DataTable
              embedded
              headers={["Familia", "Compra", "Factura", "Proveedor", "Actividad", "Material", "Cantidad", "Unidad", "Vlr. unitario", "Vlr. total"]}
              emptyMessage="No hay materiales entregados para los filtros seleccionados."
              rows={[
                ...deliveredByFamilyReport.flatMap((group) => [
                  ...group.rows.map((row) => {
                    const unitPrice = row.purchaseUnitPrice || row.quotedUnitPrice;
                    return [
                      `${row.familyCode} - ${row.familyName}`,
                      row.purchaseLabel,
                      row.invoiceNumber,
                      row.supplierName,
                      row.activityName,
                      row.materialName,
                      formatNumber(row.deliveredQuantity),
                      row.unit,
                      formatExportMoney(unitPrice),
                      formatExportMoney(row.deliveredQuantity * unitPrice)
                    ] as React.ReactNode[];
                  }),
                  [
                    <strong key="label">Total {group.familyLabel}</strong>,
                    "", "", "", "", "",
                    <strong key="count">{formatNumber(group.rows.length)} items</strong>,
                    "", "",
                    <strong key="value">{formatExportMoney(group.totalValue)}</strong>
                  ] as React.ReactNode[]
                ]),
                ...(deliveredByFamilyReport.length > 1
                  ? [[
                      <strong key="label">Total general</strong>,
                      "", "", "", "", "",
                      <strong key="count">{formatNumber(deliveredByFamilyReport.reduce((sum, group) => sum + group.rows.length, 0))} items</strong>,
                      "", "",
                      <strong key="value">{formatExportMoney(deliveredByFamilyReport.reduce((sum, group) => sum + group.totalValue, 0))}</strong>
                    ] as React.ReactNode[]]
                  : [])
              ]}
            />
          </details>
        </div>
      ) : null}

      {!phase5Blocked && activeTab === "etec" ? (
        <div className="section compact-section">
          {loadingApprovedNeeds ? <div className="alert info">Consultando materiales aprobados...</div> : null}
          <div className="panel grid compact-panel">
            <label className="span-3">
              Vista ETEC
              <select value={etecViewMode} onChange={(event) => setEtecViewMode(event.target.value as EtecViewMode)}>
                <option value="municipality">Por municipio</option>
                <option value="village">Por vereda</option>
              </select>
            </label>
            <label className="span-3">
              Bloque
              <select value={etecBlockFilter} onChange={(event) => setEtecBlockFilter(event.target.value)}>
                <option value="">Todos</option>
                {etecBlocks.map((block) => <option key={block} value={block}>{block}</option>)}
              </select>
            </label>
            <label className="span-3">
              Crear otro bloque
              <input value={newEtecBlock} onChange={(event) => setNewEtecBlock(event.target.value)} placeholder="Ej. Herramientas menores" />
            </label>
            <div className="span-3 form-actions">
              <button className="secondary" disabled={!newEtecBlock.trim()} type="button" onClick={addCustomEtecBlock}>
                Crear bloque
              </button>
            </div>
            <div className="span-12 form-actions">
              <button disabled={!canManageProcurement || saving || etecMatrix.rows.length === 0} type="button" onClick={() => void saveEtecDrafts()}>
                Guardar ajustes ETEC
              </button>
              <button className="secondary" disabled={etecMatrix.rows.length === 0} type="button" onClick={() => void exportEtecExcel(etecMatrix)}>
                Exportar ETEC Excel
              </button>
              <button className="secondary" disabled={!canManageProcurement || saving || !filters.project_id || etecMatrix.rows.length === 0} type="button" onClick={() => void createPurchaseFromEtec()}>
                Crear compra desde ETEC
              </button>
            </div>
            {!filters.project_id ? (
              <div className="span-12 alert info">Seleccione un proyecto para crear compra desde ETEC. Puede consultar ETEC con Todos, pero la compra requiere un proyecto.</div>
            ) : null}
            <div className="span-12 muted">
              Items ETEC: {etecMatrix.rows.length}. Mostrando {etecPageStart}-{etecPageEnd}. Exportar y crear compra usan todos los items filtrados.
            </div>
            <div className="span-12 etec-pagination">
              <label>
                Filas por pagina
                <select value={etecPageSize} onChange={(event) => setEtecPageSize(Number(event.target.value))}>
                  {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <button className="secondary" disabled={normalizedEtecPage <= 1} type="button" onClick={() => setEtecPage((page) => Math.max(1, page - 1))}>
                Anterior
              </button>
              <span>Pagina {normalizedEtecPage} de {etecTotalPages}</span>
              <button className="secondary" disabled={normalizedEtecPage >= etecTotalPages} type="button" onClick={() => setEtecPage((page) => Math.min(etecTotalPages, page + 1))}>
                Siguiente
              </button>
            </div>
          </div>
          <div className="panel table-panel wide-table etec-table-panel">
            <table className="etec-table">
              <colgroup>
                <col className="etec-col-item" />
                <col className="etec-col-element" />
                <col className="etec-col-unit" />
                <col className="etec-col-block" />
                <col className="etec-col-characteristics" />
                {etecMatrix.territories.map((territory) => <col className="etec-col-territory" key={territory} />)}
                <col className="etec-col-total" />
              </colgroup>
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>Elemento</th>
                  <th>Unidad</th>
                  <th>Bloque</th>
                  <th>Caracteristicas</th>
                  {etecMatrix.territories.map((territory) => <th key={territory}>{territory}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {etecMatrix.rows.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={6 + etecMatrix.territories.length}>No hay planes aprobados con materiales para los filtros seleccionados.</td>
                  </tr>
                ) : etecVisibleRows.map((row, index) => {
                  const draft = etecDrafts[row.key] ?? { block: row.block, characteristics: row.characteristics };
                  return (
                    <tr key={row.key}>
                      <td>{etecPageStart + index}</td>
                      <td>{row.materialName}</td>
                      <td>{row.unit}</td>
                      <td>
                        <select value={draft.block} onChange={(event) => updateEtecDraft(row.key, "block", event.target.value)}>
                          {etecBlocks.map((block) => <option key={block} value={block}>{block}</option>)}
                        </select>
                      </td>
                      <td>
                        <textarea className="compact-textarea" value={draft.characteristics} onChange={(event) => updateEtecDraft(row.key, "characteristics", event.target.value)} rows={2} />
                      </td>
                      {etecMatrix.territories.map((territory) => (
                        <td className="number-cell" key={`${row.key}-${territory}`}>{formatNumber(row.territoryQuantities[territory] ?? 0)}</td>
                      ))}
                      <td className="number-cell"><strong>{formatNumber(row.total)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details className="collapsible-panel">
            <summary>Detalle base ETEC por familia, plan y actividad ({filteredNeeds.length})</summary>
            <DataTable
              embedded
              headers={["Proyecto", "Municipio", "Vereda", "Familia", "Plan operativo", "Actividad", "Material", "Cantidad"]}
              emptyMessage="No hay detalle ETEC para los filtros seleccionados."
              rows={filteredNeeds.map((need) => [
                need.projectName,
                need.municipalityName,
                need.villageName,
                `${need.familyCode} - ${need.familyName}`,
                deliveryPlanLabel(plans.find((plan) => plan.id === need.operational_plan_id)),
                need.activityName,
                need.materialName,
                `${formatNumber(need.approvedQuantity)} ${need.unit}`
              ])}
            />
          </details>
        </div>
      ) : null}

      {!phase5Blocked && activeTab === "indicators" ? (
        <div className="section tracking-section">
          <div className="summary-grid compact-summary">
            <Metric label="Familias seguimiento" value={trackingMatrix.rows.length} />
            <Metric label="Actividades aprobadas" value={trackingMatrix.groups.length} />
            <Metric label="Año seguimiento" value={trackingYear} />
            <Metric label="Trimestres visibles" value={visibleTrackingQuarters.length} />
          </div>
          <div className="panel grid compact-tracking-controls">
            <label className="span-2">
              Año de seguimiento
              <input type="number" min="2020" max="2100" value={trackingYear} onChange={(event) => setTrackingYear(Number(event.target.value || new Date().getFullYear()))} />
            </label>
            <div className="span-6">
              <span className="control-label">Trimestres visibles</span>
              <QuarterSelector selected={visibleTrackingQuarters} onChange={setVisibleTrackingQuarters} />
            </div>
            <div className="span-12 tracking-pagination">
              <label>
                Familias por pagina
                <select value={trackingPageSize} onChange={(event) => setTrackingPageSize(Number(event.target.value))}>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
              <span>
                Mostrando {trackingPageStart}-{trackingPageEnd} de {trackingMatrix.rows.length} familias
              </span>
              <button className="secondary" disabled={normalizedTrackingPage <= 1} type="button" onClick={() => setTrackingPage((page) => Math.max(1, page - 1))}>Anterior</button>
              <button className="secondary" disabled={normalizedTrackingPage >= trackingTotalPages} type="button" onClick={() => setTrackingPage((page) => Math.min(trackingTotalPages, page + 1))}>Siguiente</button>
            </div>
            <div className="span-12 form-actions">
              <button disabled={!canEditImplementation || saving || Object.keys(trackingDrafts).length === 0} type="button" onClick={() => void saveTrackingMatrix()}>
                Guardar avances {Object.keys(trackingDrafts).length > 0 ? `(${Object.keys(trackingDrafts).length})` : ""}
              </button>
              <button className="secondary" disabled={trackingMatrix.rows.length === 0} type="button" onClick={() => void exportTrackingMatrixExcel(trackingMatrix)}>
                Exportar vista Excel
              </button>
            </div>
            <p className="span-12 muted">
              Seleccione un año y los trimestres que desea visualizar. La matriz muestra actividades de planes operativos aprobados. Los avances se guardan por familia, actividad, año y trimestre.
            </p>
          </div>
          <TrackingMatrixTable
            matrix={trackingVisibleMatrix}
            drafts={trackingDrafts}
            canEdit={canEditImplementation}
            onChange={updateTrackingDraft}
            onHectaresChange={saveTrackingHectares}
            onTargetChange={saveTrackingTarget}
          />
          <div className="alert info">
            La matriz toma metas desde planes operativos aprobados. Los avances, entregados, sembrados y cumplimiento se guardan por familia, actividad, trimestre y año.
          </div>
        </div>
      ) : null}

      {!phase5Blocked && !maintenanceBlocked && activeTab === "maintenance" ? (
        <div className="section tracking-section">
          <div className="summary-grid compact-summary">
            <Metric label="Familias mantenimiento" value={maintenanceMatrix.rows.length} />
            <Metric label="Actividades mantenimiento" value={maintenanceMatrix.groups.length} />
            <Metric label="Año mantenimiento" value={maintenanceYear} />
            <Metric label="Trimestres visibles" value={visibleMaintenanceQuarters.length} />
          </div>
          <div className="panel grid compact-tracking-controls">
            <label className="span-2">
              Año de mantenimiento
              <input type="number" min="2020" max="2100" value={maintenanceYear} onChange={(event) => setMaintenanceYear(Number(event.target.value || new Date().getFullYear()))} />
            </label>
            <div className="span-6">
              <span className="control-label">Trimestres visibles para abonos</span>
              <QuarterSelector selected={visibleMaintenanceQuarters} onChange={setVisibleMaintenanceQuarters} />
            </div>
            <div className="span-12 tracking-pagination">
              <label>
                Familias por pagina
                <select value={maintenancePageSize} onChange={(event) => setMaintenancePageSize(Number(event.target.value))}>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
              <span>
                Mostrando {maintenancePageStart}-{maintenancePageEnd} de {maintenanceMatrix.rows.length} familias
              </span>
              <button className="secondary" disabled={normalizedMaintenancePage <= 1} type="button" onClick={() => setMaintenancePage((page) => Math.max(1, page - 1))}>Anterior</button>
              <button className="secondary" disabled={normalizedMaintenancePage >= maintenanceTotalPages} type="button" onClick={() => setMaintenancePage((page) => Math.min(maintenanceTotalPages, page + 1))}>Siguiente</button>
            </div>
            <div className="span-12 form-actions">
              <button className="secondary" disabled={maintenanceMatrix.rows.length === 0} type="button" onClick={() => void exportMaintenanceMatrixExcel(maintenanceMatrix)}>
                Exportar mantenimiento Excel
              </button>
            </div>
          </div>
          <MaintenanceMatrixTable
            matrix={maintenanceVisibleMatrix}
            canEdit={canEditImplementation && !saving}
            onSave={saveMaintenanceCell}
            onSaveOrganic={saveMaintenanceOrganicCell}
            onTargetChange={saveTrackingTarget}
          />
          <div className="alert info">
            La matriz toma actividades desde planes operativos aprobados. Las fechas y avances de abonos se guardan por familia, actividad y año.
          </div>
        </div>
      ) : null}

      {!phase5Blocked && activeTab === "acts" ? (
        <div className="section compact-section">
          <div className="panel grid compact-panel">
            <label className="span-3">
              Fecha de entrega
              <input type="date" value={actDeliveryDate} onChange={(event) => setActDeliveryDate(event.target.value)} />
            </label>
            <label className="span-3">
              Texto base de entrega
              <input value={actNumberPrefix} onChange={(event) => setActNumberPrefix(event.target.value)} />
            </label>
            <label className="span-3">
              Nombre tecnico
              <input value={actTechnicianName} onChange={(event) => setActTechnicianName(event.target.value)} />
            </label>
            <label className="span-3">
              Cedula tecnico
              <input value={actTechnicianDocument} onChange={(event) => setActTechnicianDocument(event.target.value)} />
            </label>
            <label className="span-12">
              Texto introductorio del acta
              <textarea value={actIntroText} onChange={(event) => setActIntroText(event.target.value)} rows={4} />
            </label>
            <label className="span-12">
              Texto final del acta
              <textarea value={actFinalText} onChange={(event) => setActFinalText(event.target.value)} rows={2} />
            </label>
          </div>
          <DataTable
            headers={["Familia", "Plan operativo", "Municipio", "Vereda", "Entrega No.", "Fecha", "Fuente", "Materiales"]}
            emptyMessage="No hay familias con materiales para los filtros seleccionados."
            rows={actExportRecords.map((record) => [
              `${record.family.family_code} - ${record.family.representative_name}`,
              deliveryPlanLabel(record.plan),
              record.municipality?.name ?? "",
              record.village?.name ?? "",
              record.actNumber,
              record.deliveryDate,
              record.sourceLabel,
              String(record.items.length)
            ])}
          />
          <div className="form-actions">
            <button disabled={saving || !canGenerateActs || actExportRecords.length === 0} type="button" onClick={() => void exportFilteredDeliveryActs("pdf")}>{saving ? "Generando..." : "Exportar PDF"}</button>
            <button className="secondary" disabled={saving || !canGenerateActs || actExportRecords.length === 0} type="button" onClick={() => void exportFilteredDeliveryActs("word")}>{saving ? "Generando..." : "Exportar Word"}</button>
            <button className="secondary" disabled={saving || actExportRecords.length === 0} type="button" onClick={() => void exportFilteredDeliveryActs("excel")}>{saving ? "Generando..." : "Exportar Excel"}</button>
          </div>
          <details className="collapsible-panel">
            <summary>Registrar entrega manual</summary>
            <div className="grid compact-panel">
              <label className="span-6">
                Material aprobado pendiente
                <select value={selectedNeedId} onChange={(event) => setSelectedNeedId(event.target.value)}>
                  <option value="">Seleccione</option>
                  {filteredNeeds.filter((need) => need.pendingQuantity > 0 || canAdminOverride).map((need) => (
                    <option key={need.id} value={need.id}>
                      {need.familyCode} - {need.materialName} - pendiente {formatNumber(need.pendingQuantity)} {need.unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Fecha entrega
                <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
              </label>
              <label className="span-2">
                Cantidad
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={deliveryQuantity}
                  onChange={(event) => setDeliveryQuantity(event.target.value)}
                />
              </label>
              <label className="checkbox span-2">
                <input type="checkbox" checked={adminOverride} onChange={(event) => setAdminOverride(event.target.checked)} />
                Autorizar sobreentrega
              </label>
              <label className="span-12">
                Observaciones
                <textarea value={deliveryObservation} onChange={(event) => setDeliveryObservation(event.target.value)} rows={2} />
              </label>
              {selectedNeed ? (
                <div className="span-12 alert info">
                  Aprobado: {formatNumber(selectedNeed.approvedQuantity)} {selectedNeed.unit}. Entregado: {formatNumber(selectedNeed.deliveredQuantity)}. Saldo: {formatNumber(selectedNeed.pendingQuantity)}.
                </div>
              ) : null}
              <div className="span-12 form-actions">
                <button disabled={saving || !canManageProcurement || !selectedNeed} type="button" onClick={() => void registerDelivery()}>
                  Registrar entrega
                </button>
              </div>
            </div>
          </details>
          <details className="collapsible-panel">
            <summary>Actas registradas</summary>
            <DataTable
              embedded
              headers={["Fecha", "Familia", "Estado entrega", "Acta", "Exportar"]}
              emptyMessage="No hay entregas registradas para los filtros seleccionados."
              rows={materialDeliveries
                .filter((delivery) => {
                  if (filters.project_id && delivery.project_id !== filters.project_id) return false;
                  if (filters.family_id && delivery.family_id !== filters.family_id) return false;
                  return true;
                })
                .map((delivery) => {
                  const family = families.find((item) => item.id === delivery.family_id);
                  const act = deliveryActs.find((item) => item.material_delivery_id === delivery.id && !item.is_deleted);
                  return [
                    delivery.delivery_date,
                    family ? `${family.family_code} - ${family.representative_name}` : "",
                    delivery.status,
                    act?.act_number ?? "Pendiente",
                    <div className="table-actions" key={delivery.id}>
                      <button className="secondary" type="button" disabled={!canGenerateActs || saving} onClick={() => void exportDeliveryAct(delivery, "pdf")}>{saving ? "Generando..." : "PDF"}</button>
                      <button className="secondary" type="button" disabled={!canGenerateActs || saving} onClick={() => void exportDeliveryAct(delivery, "word")}>{saving ? "Generando..." : "Word"}</button>
                    </div>
                  ];
                })}
            />
          </details>
        </div>
      ) : null}
    </section>
  );
}

function TrackingMatrixTable({
  matrix,
  drafts,
  canEdit,
  onChange,
  onHectaresChange,
  onTargetChange
}: {
  matrix: TrackingMatrix;
  drafts: Record<string, string>;
  canEdit: boolean;
  onChange: (key: string, value: string) => void;
  onHectaresChange: (row: TrackingFamilyRow, value: string) => Promise<void>;
  onTargetChange?: (planActivityId: string, value: string) => Promise<void>;
}) {
  const baseHeaders = ["Codigo Predio", "Familia", "Cedula", "Edad Años", "Municipio", "Vereda", "Hectareas del predio"];
  const agreementColSpan = 2;
  if (matrix.rows.length === 0) {
    return <div className="panel muted">No hay planes aprobados con actividades para los filtros seleccionados.</div>;
  }

  async function confirmTargetChange(event: React.FocusEvent<HTMLInputElement>, planActivityId: string, activityName: string) {
    const previous = event.currentTarget.defaultValue;
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (!confirmManualChange(`Va a cambiar la meta para "${activityName}" de "${previous || "N/A"}" a "${next || "0"}". ¿Desea aplicar este cambio?`)) {
      event.currentTarget.value = previous;
      return;
    }
    try {
      if (onTargetChange) await onTargetChange(planActivityId, next);
      event.currentTarget.defaultValue = next;
    } catch {
      event.currentTarget.value = previous;
    }
  }

  function confirmTrackingCellChange(
    event: React.FocusEvent<HTMLInputElement>,
    key: string,
    previous: string,
    label: string
  ) {
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (confirmManualChange(`Va a cambiar "${label}" de "${previous || "0"}" a "${next || "0"}". ¿Desea aplicar este cambio?`)) {
      onChange(key, next);
    } else {
      event.currentTarget.value = previous;
    }
  }

  function trackingGroupTone(index: number) {
    return index % 2 === 0 ? "tracking-group-tone-a" : "tracking-group-tone-b";
  }

  function trackingGroupCellClass(baseClass: string, groupIndex: number, isFirstInGroup = false) {
    return `${baseClass} ${trackingGroupTone(groupIndex)}${isFirstInGroup ? " tracking-group-start" : ""}`;
  }

  function trackingActivityAccumulatedWithDrafts(
    row: TrackingFamilyRow,
    group: TrackingActivityGroup,
    cell: TrackingActivityCell
  ) {
    const preferredType = trackingActivityPreferredType(cell);
    return TRACKING_YEAR_QUARTERS.reduce((sum, quarter) => {
      const draftKey = trackingActivityDraftKey(row.family_id, group.key, cell.plan_activity_id, preferredType, quarter);
      const value = drafts[draftKey] ?? trackingProgressValue(cell, preferredType, quarter) ?? "0";
      return sum + Number(value || 0);
    }, 0);
  }

  function trackingVegetalAccumulatedWithDrafts(
    row: TrackingFamilyRow,
    group: VegetalIndicatorGroup,
    cell: TrackingVegetalCell,
    type: VegetalQuarterlyType
  ) {
    return TRACKING_YEAR_QUARTERS.reduce((sum, quarter) => {
      const draftKey = trackingVegetalDraftKey(row.family_id, group, type, quarter);
      const value = drafts[draftKey] ?? trackingVegetalProgressValue(cell, type, quarter) ?? "0";
      return sum + Number(value || 0);
    }, 0);
  }

  async function confirmHectaresChange(event: React.FocusEvent<HTMLInputElement>, row: TrackingFamilyRow) {
    const previous = row.hectaresValue;
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (!confirmManualChange(`Va a cambiar las hectareas del predio de "${previous || "0"}" a "${next || "0"}". Desea aplicar este cambio?`)) {
      event.currentTarget.value = previous;
      return;
    }
    try {
      await onHectaresChange(row, next);
    } catch {
      event.currentTarget.value = previous;
    }
  }

  return (
    <div className="tracking-table-wrapper panel">
      <table className="tracking-table">
        <thead>
          <tr>
            {baseHeaders.map((header, index) => (
              <th className={`sticky-col sticky-col-${index + 1}`} key={header} rowSpan={2}>{header}</th>
            ))}
            {matrix.vegetalGroups.map((group, groupIndex) => (
              <th
                className={`tracking-group-header tracking-vegetal-header tracking-group-start ${trackingGroupTone(groupIndex)}`}
                colSpan={trackingVegetalVisibleColSpan(matrix.visibleQuarters)}
                key={group.key}
              >
                {`${group.label} (${group.unit})`}
              </th>
            ))}
            {matrix.groups.map((group, groupIndex) => (
              <th className={`tracking-group-header ${trackingGroupTone(matrix.vegetalGroups.length + groupIndex)} tracking-group-start`} colSpan={trackingGroupVisibleColSpan(group, matrix.visibleQuarters)} key={group.key}>{trackingGroupHeaderLabel(group)}</th>
            ))}
            <th className="tracking-group-header tracking-group-agreement tracking-group-start" colSpan={agreementColSpan}>Cumplimiento Acuerdo de Conservacion</th>
          </tr>
          <tr>
            {matrix.vegetalGroups.flatMap((group, groupIndex) => trackingVegetalVisibleSubheaders(matrix.visibleQuarters, matrix.year).map((header, headerIndex) => (
              <th className={trackingGroupCellClass(trackingHeaderClass(header), groupIndex, headerIndex === 0)} key={`${group.key}-${header}`}>{header}</th>
            )))}
            {matrix.groups.flatMap((group, groupIndex) => trackingGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year).map((header, headerIndex) => (
              <th className={trackingGroupCellClass(trackingHeaderClass(header), matrix.vegetalGroups.length + groupIndex, headerIndex === 0)} key={`${group.key}-${header}`}>{header}</th>
            )))}
            <th className="tracking-col-meta tracking-group-agreement tracking-group-start">Meta</th>
            <th className="tracking-col-percent tracking-group-agreement">% Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.key}>
              <td className="sticky-col sticky-col-1">{row.familyCode}</td>
              <td className="sticky-col sticky-col-2">{row.familyName}</td>
              <td className="sticky-col sticky-col-3">{row.documentNumber}</td>
              <td className="sticky-col sticky-col-4">{row.ageYears}</td>
              <td className="sticky-col sticky-col-5">{row.municipalityName}</td>
              <td className="sticky-col sticky-col-6">{row.villageName}</td>
              <td className="sticky-col sticky-col-7">
                <input
                  className="tracking-input"
                  defaultValue={row.hectaresValue}
                  disabled={!canEdit}
                  min="0"
                  onBlur={(event) => void confirmHectaresChange(event, row)}
                  step="0.01"
                  type="number"
                />
              </td>
              {matrix.vegetalGroups.flatMap((group, groupIndex) => {
                const visualGroupIndex = groupIndex;
                const cell = row.vegetalIndicators[group.key];
                if (!cell) {
                  return trackingVegetalVisibleSubheaders(matrix.visibleQuarters, matrix.year).map((header, headerIndex) => (
                    <td className={trackingGroupCellClass("muted", visualGroupIndex, headerIndex === 0)} key={`${row.key}-${group.key}-${header}`}>-</td>
                  ));
                }
                const cells = [
                  <td className={trackingGroupCellClass("tracking-col-meta", visualGroupIndex, true)} key={`${row.key}-${group.key}-meta`}>{formatNumber(cell.targetQuantity)}</td>
                ];
                for (const type of ["vegetal_entrega", "vegetal_siembra"] as VegetalQuarterlyType[]) {
                  for (const quarter of matrix.visibleQuarters) {
                    const draftKey = trackingVegetalDraftKey(row.family_id, group.key, type, quarter);
                    cells.push(
                      <td className={trackingGroupCellClass("tracking-col-progress", visualGroupIndex)} key={draftKey}>
                        <input
                          className="tracking-input"
                          disabled={!canEdit}
                          min="0"
                          defaultValue={drafts[draftKey] ?? trackingVegetalProgressValue(cell, type, quarter)}
                          onBlur={(event) => confirmTrackingCellChange(
                            event,
                            draftKey,
                            drafts[draftKey] ?? trackingVegetalProgressValue(cell, type, quarter),
                            `${row.familyCode} - ${group.label} - ${trackingVegetalTypeLabel(type)} Q${quarter}`
                          )}
                          step="0.01"
                          type="number"
                        />
                      </td>
                    );
                  }
                  const accumulated = trackingVegetalAccumulatedWithDrafts(row, group.key, cell, type);
                  const isOverTarget = cell.targetQuantity > 0 && accumulated > cell.targetQuantity;
                  cells.push(
                    <td
                      className={trackingGroupCellClass(`tracking-col-accumulated${isOverTarget ? " tracking-over-target" : ""}`, visualGroupIndex)}
                      key={`${row.key}-${group.key}-${type}-accumulated`}
                      title={isOverTarget ? "El acumulado supera la meta aprobada." : undefined}
                    >
                      {formatNumber(accumulated)}
                    </td>
                  );
                }
                return cells;
              })}
              {matrix.groups.flatMap((group, groupIndex) => {
                const visualGroupIndex = matrix.vegetalGroups.length + groupIndex;
                const cell = row.activities[group.key];
                if (!cell) {
                  return trackingGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year).map((header, headerIndex) => (
                    <td className={trackingGroupCellClass("muted", visualGroupIndex, headerIndex === 0)} key={`${row.key}-${group.key}-${header}`}>-</td>
                  ));
                }
                const cells = [
                  <td className={trackingGroupCellClass("tracking-col-meta", visualGroupIndex, true)} key={`${row.key}-${group.key}-meta`}>
                    <input
                      className="tracking-input"
                      style={{ width: "60px", textAlign: "center", border: "none", backgroundColor: "transparent", fontWeight: "bold" }}
                      defaultValue={cell.targetQuantity ?? ""}
                      onBlur={(event) => {
                        if (typeof document !== "undefined" && !document.body.classList.contains("is-super-admin")) {
                          event.currentTarget.value = event.currentTarget.defaultValue;
                          return;
                        }
                        void confirmTargetChange(event, cell.plan_activity_id, group.activityName);
                      }}
                      step="0.01"
                      type="number"
                      placeholder="N/A"
                      title="Meta (Super Admin editable)"
                    />
                  </td>
                ];
                for (const type of group.progressTypes) {
                  for (const quarter of matrix.visibleQuarters) {
                    const draftKey = trackingActivityDraftKey(row.family_id, group.key, cell.plan_activity_id, type, quarter);
                    cells.push(
                      <td className={trackingGroupCellClass("tracking-col-progress", visualGroupIndex)} key={draftKey}>
                        <input
                          className="tracking-input"
                          disabled={!canEdit}
                          min="0"
                          defaultValue={drafts[draftKey] ?? trackingProgressValue(cell, type, quarter)}
                          onBlur={(event) => confirmTrackingCellChange(
                            event,
                            draftKey,
                            drafts[draftKey] ?? trackingProgressValue(cell, type, quarter),
                            `${row.familyCode} - ${group.activityName} - ${trackingProgressTypeLabel(type)} Q${quarter}`
                          )}
                          step="0.01"
                          type="number"
                        />
                      </td>
                    );
                  }
                }
                const accumulated = trackingActivityAccumulatedWithDrafts(row, group, cell);
                const isOverTarget = cell.targetQuantity > 0 && accumulated > cell.targetQuantity;
                cells.push(
                  <td
                    className={trackingGroupCellClass(`tracking-col-accumulated${isOverTarget ? " tracking-over-target" : ""}`, visualGroupIndex)}
                    key={`${row.key}-${group.key}-accumulated`}
                    title={isOverTarget ? "El avance acumulado supera la meta aprobada." : undefined}
                  >
                    {formatNumber(accumulated)}
                  </td>
                );
                return cells;
              })}
              <td className="tracking-col-meta tracking-group-agreement tracking-group-start">
                <input
                  className="tracking-input"
                  disabled={!canEdit}
                  min="0"
                  defaultValue={drafts[trackingAgreementDraftKey(row.family_id, "meta")] ?? String(row.agreement?.target_quantity ?? 100)}
                  onBlur={(event) => {
                    const draftKey = trackingAgreementDraftKey(row.family_id, "meta");
                    confirmTrackingCellChange(event, draftKey, drafts[draftKey] ?? String(row.agreement?.target_quantity ?? 100), `${row.familyCode} - Meta cumplimiento acuerdo`);
                  }}
                  step="0.01"
                  type="number"
                />
              </td>
              <td className="tracking-col-percent tracking-group-agreement">
                <input
                  className="tracking-input"
                  disabled={!canEdit}
                  min="0"
                  defaultValue={drafts[trackingAgreementDraftKey(row.family_id, "percent")] ?? String(row.agreement?.progress_quantity ?? 0)}
                  onBlur={(event) => {
                    const draftKey = trackingAgreementDraftKey(row.family_id, "percent");
                    confirmTrackingCellChange(event, draftKey, drafts[draftKey] ?? String(row.agreement?.progress_quantity ?? 0), `${row.familyCode} - % cumplimiento acuerdo`);
                  }}
                  step="0.01"
                  type="number"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaintenanceMatrixTable({
  matrix,
  canEdit,
  onSave,
  onSaveOrganic,
  onTargetChange
}: {
  matrix: MaintenanceMatrix;
  canEdit: boolean;
  onSave: (payload: {
    row: MaintenanceFamilyRow;
    group: MaintenanceActivityGroup;
    cell: MaintenanceActivityCell;
    maintenanceType: MaintenanceProgressType;
    maintenanceNumber: number;
    quarter: number | null;
    value: string;
  }) => Promise<void>;
  onSaveOrganic: (payload: {
    row: MaintenanceFamilyRow;
    maintenanceType: MaintenanceOrganicType;
    quarter: number;
    value: string;
  }) => Promise<void>;
  onTargetChange?: (planActivityId: string, value: string) => Promise<void>;
}) {
  const baseHeaders = ["Codigo Predio", "Familia", "Cedula", "Edad Años", "Municipio", "Vereda", "Hectareas del predio"];
  if (matrix.rows.length === 0) {
    return <div className="panel muted">No hay planes aprobados con actividades de mantenimiento para los filtros seleccionados.</div>;
  }

  async function confirmTargetChange(event: React.FocusEvent<HTMLInputElement>, planActivityId: string, activityName: string) {
    const previous = event.currentTarget.defaultValue;
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (!confirmManualChange(`Va a cambiar la meta para "${activityName}" de "${previous || "N/A"}" a "${next || "0"}". ¿Desea aplicar este cambio?`)) {
      event.currentTarget.value = previous;
      return;
    }
    try {
      if (onTargetChange) await onTargetChange(planActivityId, next);
      event.currentTarget.defaultValue = next;
    } catch {
      event.currentTarget.value = previous;
    }
  }

  function groupTone(index: number) {
    return index % 2 === 0 ? "tracking-group-tone-a" : "tracking-group-tone-b";
  }

  function groupCellClass(baseClass: string, groupIndex: number, isFirstInGroup = false) {
    return `${baseClass} ${groupTone(groupIndex)}${isFirstInGroup ? " tracking-group-start" : ""}`;
  }

  async function confirmMaintenanceChange(
    event: React.FocusEvent<HTMLInputElement>,
    previous: string,
    label: string,
    payload: Parameters<typeof onSave>[0]
  ) {
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (!confirmManualChange(`Va a cambiar "${label}" de "${previous || "vacio"}" a "${next || "vacio"}". Desea aplicar este cambio?`)) {
      event.currentTarget.value = previous;
      return;
    }
    try {
      await onSave({ ...payload, value: next });
    } catch {
      event.currentTarget.value = previous;
    }
  }

  async function confirmOrganicMaintenanceChange(
    event: React.FocusEvent<HTMLInputElement>,
    previous: string,
    label: string,
    payload: Parameters<typeof onSaveOrganic>[0]
  ) {
    const next = event.currentTarget.value;
    if (next === previous) return;
    if (!confirmManualChange(`Va a cambiar "${label}" de "${previous || "0"}" a "${next || "0"}". Desea aplicar este cambio?`)) {
      event.currentTarget.value = previous;
      return;
    }
    try {
      await onSaveOrganic({ ...payload, value: next });
    } catch {
      event.currentTarget.value = previous;
    }
  }

  return (
    <div className="tracking-table-wrapper panel">
      <table className="tracking-table maintenance-table">
        <thead>
          <tr>
            {baseHeaders.map((header, index) => (
              <th className={`sticky-col sticky-col-${index + 1}`} key={header} rowSpan={2}>{header}</th>
            ))}
            {matrix.groups.map((group, groupIndex) => (
              <th className={`tracking-group-header ${groupTone(groupIndex)} tracking-group-start`} colSpan={maintenanceGroupVisibleColSpan(group, matrix.visibleQuarters)} key={group.key}>
                {maintenanceGroupHeaderLabel(group)}
              </th>
            ))}
            <th className="tracking-group-header tracking-group-agreement tracking-group-start" colSpan={maintenanceOrganicColSpan(matrix.visibleQuarters)}>
              Produccion de abonos organicos
            </th>
          </tr>
          <tr>
            {matrix.groups.flatMap((group, groupIndex) => maintenanceGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year).map((header, headerIndex) => (
              <th className={groupCellClass(maintenanceHeaderClass(header), groupIndex, headerIndex === 0)} key={`${group.key}-${header}`}>{header}</th>
            )))}
            {maintenanceOrganicSubheaders(matrix.visibleQuarters, matrix.year).map((header, headerIndex) => (
              <th className={`tracking-group-agreement ${maintenanceHeaderClass(header)}${headerIndex === 0 ? " tracking-group-start" : ""}`} key={`organic-${header}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.key}>
              <td className="sticky-col sticky-col-1">{row.familyCode}</td>
              <td className="sticky-col sticky-col-2">{row.familyName}</td>
              <td className="sticky-col sticky-col-3">{row.documentNumber}</td>
              <td className="sticky-col sticky-col-4">{row.ageYears}</td>
              <td className="sticky-col sticky-col-5">{row.municipalityName}</td>
              <td className="sticky-col sticky-col-6">{row.villageName}</td>
              <td className="sticky-col sticky-col-7">{row.hectares}</td>
              {matrix.groups.flatMap((group, groupIndex) => {
                const cell = row.activities[group.key];
                const subheaders = maintenanceGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year);
                if (!cell) {
                  return [
                    <td className={groupCellClass("muted", groupIndex, true)} colSpan={subheaders.length} key={`${row.key}-${group.key}-na`}>No aplica</td>
                  ];
                }
                const cells = [
                  <td className={groupCellClass("tracking-col-meta", groupIndex, true)} key={`${row.key}-${group.key}-meta`}>
                    <input
                      className="tracking-input"
                      style={{ width: "60px", textAlign: "center", border: "none", backgroundColor: "transparent", fontWeight: "bold" }}
                      defaultValue={cell.targetQuantity ?? ""}
                      onBlur={(event) => {
                        if (typeof document !== "undefined" && !document.body.classList.contains("is-super-admin")) {
                          event.currentTarget.value = event.currentTarget.defaultValue;
                          return;
                        }
                        void confirmTargetChange(event, cell.plan_activity_id, group.activityName);
                      }}
                      step="0.01"
                      type="number"
                      placeholder="N/A"
                      title="Meta (Super Admin editable)"
                    />
                  </td>
                ];
                for (const task of group.tasks) {
                  const current = cell.progress[maintenanceProgressKey(task.type, task.number, null)];
                  const previous = current?.maintenance_date ?? "";
                  cells.push(
                    <td className={groupCellClass("maintenance-col-date", groupIndex)} key={`${row.key}-${group.key}-${task.type}-${task.number}`}>
                      <input
                        className="tracking-input maintenance-date-input"
                        defaultValue={previous}
                        disabled={!canEdit}
                        onBlur={(event) => void confirmMaintenanceChange(
                          event,
                          previous,
                          `${row.familyCode} - ${group.activityName} - ${task.label}`,
                          { row, group, cell, maintenanceType: task.type, maintenanceNumber: task.number, quarter: null, value: "" }
                        )}
                        type="date"
                      />
                    </td>
                  );
                }
                cells.push(
                  <td className={groupCellClass(`maintenance-cycle ${maintenanceCycleStatus(cell, group).className}`, groupIndex)} key={`${row.key}-${group.key}-cycle`}>
                    {maintenanceCycleStatus(cell, group).label}
                  </td>
                );
                return cells;
              })}
              {(["abono_liquido", "abono_solido"] as MaintenanceOrganicType[]).flatMap((organicType, typeIndex) => {
                const cells = matrix.visibleQuarters.map((quarter, quarterIndex) => {
                  const current = row.organicProgress[organicType]?.[quarter];
                  const previous = current?.progress_quantity === undefined ? "" : String(current.progress_quantity);
                  return (
                    <td className={`tracking-col-progress tracking-group-agreement${typeIndex === 0 && quarterIndex === 0 ? " tracking-group-start" : ""}`} key={`${row.key}-${organicType}-${quarter}`}>
                      <input
                        className="tracking-input"
                        defaultValue={previous}
                        disabled={!canEdit}
                        min="0"
                        onBlur={(event) => void confirmOrganicMaintenanceChange(event, previous, `${row.familyCode} - ${maintenanceOrganicLabel(organicType)} Q${quarter}`, {
                          row,
                          maintenanceType: organicType,
                          quarter,
                          value: ""
                        })}
                        step="0.01"
                        type="number"
                      />
                    </td>
                  );
                });
                cells.push(
                  <td className="tracking-col-accumulated tracking-group-agreement" key={`${row.key}-${organicType}-accumulated`}>
                    {formatNumber(maintenanceOrganicAccumulated(row, organicType))}
                  </td>
                );
                return cells;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuarterSelector({
  selected,
  onChange
}: {
  selected: number[];
  onChange: (quarters: number[]) => void;
}) {
  const normalized = selected.length > 0 ? [...selected].sort((left, right) => left - right) : [1, 2, 3, 4];

  function setPreset(quarters: number[]) {
    onChange(quarters);
  }

  function toggleQuarter(quarter: number) {
    const next = normalized.includes(quarter)
      ? normalized.filter((item) => item !== quarter)
      : [...normalized, quarter].sort((left, right) => left - right);
    onChange(next.length > 0 ? next : [quarter]);
  }

  return (
    <div className="quarter-selector">
      <div className="quarter-presets">
        <button className={sameQuarterSelection(normalized, [1]) ? "" : "secondary"} type="button" onClick={() => setPreset([1])}>Q1</button>
        <button className={sameQuarterSelection(normalized, [2]) ? "" : "secondary"} type="button" onClick={() => setPreset([2])}>Q2</button>
        <button className={sameQuarterSelection(normalized, [3]) ? "" : "secondary"} type="button" onClick={() => setPreset([3])}>Q3</button>
        <button className={sameQuarterSelection(normalized, [4]) ? "" : "secondary"} type="button" onClick={() => setPreset([4])}>Q4</button>
        <button className={sameQuarterSelection(normalized, [1, 2]) ? "" : "secondary"} type="button" onClick={() => setPreset([1, 2])}>Q1-Q2</button>
        <button className={sameQuarterSelection(normalized, [1, 2, 3]) ? "" : "secondary"} type="button" onClick={() => setPreset([1, 2, 3])}>Q1-Q3</button>
        <button className={sameQuarterSelection(normalized, [1, 2, 3, 4]) ? "" : "secondary"} type="button" onClick={() => setPreset([1, 2, 3, 4])}>Todos</button>
      </div>
      <div className="quarter-checks">
        {[1, 2, 3, 4].map((quarter) => (
          <label className="checkbox-row" key={quarter}>
            <input checked={normalized.includes(quarter)} onChange={() => toggleQuarter(quarter)} type="checkbox" />
            Q{quarter}
          </label>
        ))}
      </div>
    </div>
  );
}

function Phase5Filters({
  filters,
  projects,
  families,
  municipalities,
  villages,
  activities,
  materials,
  onChange
}: {
  filters: ProcurementFilters;
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  onChange: (key: keyof ProcurementFilters, value: string) => void;
}) {
  const visibleFamilies = families.filter((family) =>
    (!filters.project_id || family.project_id === filters.project_id)
    && (!filters.municipality_id || family.municipality_id === filters.municipality_id)
    && (!filters.village_id || family.village_id === filters.village_id)
  );
  const visibleVillages = villages.filter((village) =>
    !filters.municipality_id || village.municipality_id === filters.municipality_id
  );
  return (
    <div className="panel grid">
      <label className="span-3">
        Proyecto
        <select value={filters.project_id} onChange={(event) => onChange("project_id", event.target.value)}>
          <option value="">Todos</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label className="span-3">
        Municipio
        <select value={filters.municipality_id} onChange={(event) => onChange("municipality_id", event.target.value)}>
          <option value="">Todos</option>
          {municipalities.map((municipality) => <option key={municipality.id} value={municipality.id}>{municipality.name}</option>)}
        </select>
      </label>
      <label className="span-3">
        Vereda
        <select value={filters.village_id} onChange={(event) => onChange("village_id", event.target.value)}>
          <option value="">Todas</option>
          {visibleVillages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}
        </select>
      </label>
      <label className="span-3">
        Familia
        <select value={filters.family_id} onChange={(event) => onChange("family_id", event.target.value)}>
          <option value="">Todas</option>
          {visibleFamilies.map((family) => (
            <option key={family.id} value={family.id}>{family.family_code} - {family.representative_name}</option>
          ))}
        </select>
      </label>
      <label className="span-3">
        Actividad
        <select value={filters.activity_id} onChange={(event) => onChange("activity_id", event.target.value)}>
          <option value="">Todas</option>
          {activities.filter((a) => !a.is_deleted).map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
        </select>
      </label>
      <label className="span-3">
        Material
        <select value={filters.material_id} onChange={(event) => onChange("material_id", event.target.value)}>
          <option value="">Todos</option>
          {materials.filter((m) => !m.is_deleted).map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function buildTrackingMatrix(data: {
  projects: Project[];
  families: Family[];
  properties: Property[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  quarterlyProgress: QuarterlyProgress[];
  filters: ProcurementFilters;
  year: number;
  visibleQuarters: number[];
}): TrackingMatrix {
  const projectById = new Map(data.projects.map((item) => [item.id, item]));
  const familyById = new Map(data.families.map((item) => [item.id, item]));
  const propertyByFamily = new Map(data.properties.filter((item) => !item.is_deleted).map((item) => [item.family_id, item]));
  const municipalityById = new Map(data.municipalities.map((item) => [item.id, item]));
  const villageById = new Map(data.villages.map((item) => [item.id, item]));
  const activityById = new Map(data.activities.map((item) => [item.id, item]));
  const materialById = new Map(data.materials.map((item) => [item.id, item]));
  const planById = new Map(data.plans.map((item) => [item.id, item]));
  const progressByActivity = new Map<string, QuarterlyProgress>();
  const progressByVegetal = new Map<string, QuarterlyProgress>();
  const agreementByFamily = new Map<string, QuarterlyProgress>();

  for (const progress of data.quarterlyProgress.filter((item) => !item.is_deleted && item.year === data.year)) {
    if (progress.progress_type === "cumplimiento_acuerdo") {
      agreementByFamily.set(progress.family_id, progress);
    } else if (
      (progress.progress_type === "vegetal_entrega" || progress.progress_type === "vegetal_siembra")
      && progress.quarter
      && progress.vegetal_indicator_group
    ) {
      progressByVegetal.set(vegetalProgressKey(
        progress.family_id,
        progress.vegetal_indicator_group as VegetalIndicatorGroup,
        progress.progress_type as VegetalQuarterlyType,
        progress.quarter
      ), progress);
    } else if (progress.plan_activity_id && progress.quarter) {
      progressByActivity.set(quarterlyProgressKey(progress.family_id, progress.plan_activity_id, progress.progress_type as TrackingProgressType, progress.quarter), progress);
    }
  }

  const latestByFamilyActivity = new Map<string, { plan: OperationalPlan; planActivity: PlanActivity; activity: Activity }>();
  for (const planActivity of data.planActivities.filter((item) => !item.is_deleted)) {
    const plan = planById.get(planActivity.plan_id);
    if (!plan || !isApprovedPlanStatus(plan.status) || plan.is_deleted) continue;
    const family = familyById.get(plan.family_id);
    if (!family || family.is_deleted) continue;
    const activity = activityById.get(planActivity.activity_id);
    if (!activity || activity.is_deleted || isAgreementActivity(activity.name)) continue;
    const key = `${plan.family_id}-${planActivity.activity_id}`;
    const current = latestByFamilyActivity.get(key);
    if (!current || comparePlanRecency(plan, current.plan) > 0) {
      latestByFamilyActivity.set(key, { plan, planActivity, activity });
    }
  }

  const groups = new Map<string, TrackingActivityGroup>();
  const rows = new Map<string, TrackingFamilyRow>();
  for (const item of latestByFamilyActivity.values()) {
    const family = familyById.get(item.plan.family_id);
    if (!family) continue;
    const municipality = family.municipality_id ? municipalityById.get(family.municipality_id) : undefined;
    const village = family.village_id ? villageById.get(family.village_id) : undefined;
    if (data.filters.project_id && item.plan.project_id !== data.filters.project_id) continue;
    if (data.filters.municipality_id && family.municipality_id !== data.filters.municipality_id) continue;
    if (data.filters.village_id && family.village_id !== data.filters.village_id) continue;
    if (data.filters.family_id && family.id !== data.filters.family_id) continue;
    if (data.filters.activity_id && item.activity.id !== data.filters.activity_id) continue;
    if (data.filters.material_id && !data.planMaterials.some((material) =>
      !material.is_deleted &&
      material.plan_activity_id === item.planActivity.id &&
      material.material_id === data.filters.material_id
    )) continue;

    const groupKey = item.activity.id;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        activity_id: item.activity.id,
        activityName: item.activity.name,
        unit: item.activity.unit || item.planActivity.unit,
        progressTypes: trackingProgressTypesForActivity(item.activity)
      });
    }

    const property = propertyByFamily.get(family.id);
    const hectaresValue = property?.total_area_ha !== null && property?.total_area_ha !== undefined ? String(Number(property.total_area_ha)) : "";
    const row = rows.get(family.id) ?? {
      key: family.id,
      project_id: item.plan.project_id,
      family_id: family.id,
      property_id: property?.id,
      familyCode: family.family_code,
      familyName: family.representative_name,
      documentNumber: family.document_number ?? "",
      ageYears: family.birth_date ? String(calculateAge(family.birth_date, data.year)) : family.age !== null ? String(family.age) : "",
      municipality_id: family.municipality_id,
      municipalityName: municipality?.name ?? "N/A",
      village_id: family.village_id,
      villageName: village?.name ?? "N/A",
      hectares: hectaresValue ? formatNumber(Number(hectaresValue)) : "N/A",
      hectaresValue,
      activities: {},
      vegetalIndicators: {},
      agreement: agreementByFamily.get(family.id)
    };

    const values: TrackingActivityCell["values"] = {};
    for (const type of groups.get(groupKey)?.progressTypes ?? ["avance"]) {
      values[type] = {};
      for (const quarter of [1, 2, 3, 4]) {
        const progress = progressByActivity.get(quarterlyProgressKey(family.id, item.planActivity.id, type, quarter));
        if (progress) values[type]![quarter] = progress;
      }
    }
    row.activities[groupKey] = {
      operational_plan_id: item.plan.id,
      plan_activity_id: item.planActivity.id,
      activity_id: item.activity.id,
      baselineQuantity: item.planActivity.baseline !== null ? String(item.planActivity.baseline) : null,
      targetQuantity: Number(item.planActivity.target ?? 0),
      unit: item.activity.unit || item.planActivity.unit,
      values
    };

    const activityMaterials = data.planMaterials.filter((material) =>
      !material.is_deleted && material.plan_activity_id === item.planActivity.id && material.material_id
    );
    for (const planMaterial of activityMaterials) {
      const material = planMaterial.material_id ? materialById.get(planMaterial.material_id) : undefined;
      const vegetalGroup = material?.vegetal_indicator_group;
      if (!isTrackableVegetalGroup(vegetalGroup)) continue;
      const current = row.vegetalIndicators[vegetalGroup] ?? {
        targetQuantity: 0,
        unit: VEGETAL_INDICATOR_GROUPS.find((group) => group.key === vegetalGroup)?.unit ?? planMaterial.unit,
        values: {
          vegetal_entrega: {},
          vegetal_siembra: {}
        }
      };
      current.targetQuantity += Number(planMaterial.quantity ?? 0);
      for (const type of ["vegetal_entrega", "vegetal_siembra"] as VegetalQuarterlyType[]) {
        current.values[type] = current.values[type] ?? {};
        for (const quarter of [1, 2, 3, 4]) {
          const progress = progressByVegetal.get(vegetalProgressKey(family.id, vegetalGroup, type, quarter));
          if (progress) current.values[type]![quarter] = progress;
        }
      }
      row.vegetalIndicators[vegetalGroup] = current;
    }
    rows.set(family.id, row);
  }

  const vegetalGroups = VEGETAL_INDICATOR_GROUPS
    .filter((group) => Array.from(rows.values()).some((row) => row.vegetalIndicators[group.key]));

  return {
    year: data.year,
    visibleQuarters: data.visibleQuarters,
    groups: Array.from(groups.values()).sort((left, right) => left.activityName.localeCompare(right.activityName)),
    vegetalGroups,
    rows: Array.from(rows.values()).sort((left, right) => left.familyCode.localeCompare(right.familyCode))
  };
}

function trackingProgressTypesForActivity(activity: Activity): TrackingProgressType[] {
  const text = `${activity.indicator_type ?? ""} ${activity.category ?? ""} ${activity.name}`.toLowerCase();
  const types: TrackingProgressType[] = ["avance"];
  if (text.includes("entregado") || text.includes("sembrado") || text.includes("arbol") || text.includes("árbol") || text.includes("cacao") || text.includes("forestal") || text.includes("frutal") || text.includes("colino") || text.includes("siembra")) {
    types.push("entregados", "sembrados");
  }
  return types;
}

function isAgreementActivity(name: string) {
  const normalized = normalizeHeader(name).replaceAll("_", " ");
  return normalized.includes("cumplimiento acuerdo") || normalized.includes("acuerdo de conservacion");
}

function comparePlanRecency(left: OperationalPlan, right: OperationalPlan) {
  if (left.version !== right.version) return left.version - right.version;
  return left.plan_date.localeCompare(right.plan_date);
}

function trackingGroupSubheaders(group: TrackingActivityGroup) {
  return [
    "Meta",
    ...group.progressTypes.flatMap((type) => [1, 2, 3, 4].map((quarter) => `${trackingProgressTypeLabel(type)} Q${quarter}`)),
    "Avance acumulado"
  ];
}

function trackingGroupVisibleSubheaders(group: TrackingActivityGroup, quarters: number[], year: number) {
  return [
    "Meta",
    ...group.progressTypes.flatMap((type) => quarters.map((quarter) => `${trackingProgressTypeLabel(type)} Q${quarter}_${year}`)),
    "Avance acumulado"
  ];
}

function trackingVegetalVisibleSubheaders(quarters: number[], year: number) {
  return [
    "Meta",
    ...quarters.map((quarter) => `Entrega Q${quarter}_${year}`),
    "Acumulado entrega",
    ...quarters.map((quarter) => `Siembra Q${quarter}_${year}`),
    "Acumulado siembra"
  ];
}

function trackingGroupHeaderLabel(group: TrackingActivityGroup) {
  const unit = group.unit?.trim();
  return unit ? `${group.activityName} (${unit})` : group.activityName;
}

function trackingHeaderClass(header: string) {
  if (header === "Meta") return "tracking-col-meta";
  if (header === "Avance acumulado" || header.startsWith("Acumulado")) return "tracking-col-accumulated";
  if (header.includes("%")) return "tracking-col-percent";
  return "tracking-col-progress";
}

function sameQuarterSelection(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function trackingGroupColSpan(group: TrackingActivityGroup) {
  return trackingGroupSubheaders(group).length;
}

function trackingGroupVisibleColSpan(group: TrackingActivityGroup, quarters: number[]) {
  return 1 + group.progressTypes.length * quarters.length + 1;
}

function trackingVegetalVisibleColSpan(quarters: number[]) {
  return 1 + quarters.length + 1 + quarters.length + 1;
}

function trackingProgressTypeLabel(type: TrackingProgressType) {
  const labels: Record<TrackingProgressType, string> = {
    avance: "Avance",
    entregados: "Entregados",
    sembrados: "Sembrados"
  };
  return labels[type];
}

function trackingVegetalTypeLabel(type: VegetalQuarterlyType) {
  return type === "vegetal_entrega" ? "Entrega" : "Siembra";
}

function trackingProgressValue(cell: TrackingActivityCell, type: TrackingProgressType, quarter: number) {
  const value = cell.values[type]?.[quarter]?.progress_quantity;
  return value === undefined ? "" : String(value);
}

function trackingVegetalProgressValue(cell: TrackingVegetalCell, type: VegetalQuarterlyType, quarter: number) {
  const value = cell.values[type]?.[quarter]?.progress_quantity;
  return value === undefined ? "" : String(value);
}

const TRACKING_YEAR_QUARTERS = [1, 2, 3, 4];

function trackingActivityPreferredType(cell: TrackingActivityCell): TrackingProgressType {
  return cell.values.avance ? "avance" : cell.values.sembrados ? "sembrados" : "entregados";
}

function trackingActivityAccumulated(cell: TrackingActivityCell, quarters = TRACKING_YEAR_QUARTERS) {
  const preferredType = trackingActivityPreferredType(cell);
  return quarters.reduce((sum, quarter) => sum + Number(cell.values[preferredType]?.[quarter]?.progress_quantity ?? 0), 0);
}

function trackingVegetalAccumulated(cell: TrackingVegetalCell, type: VegetalQuarterlyType, quarters = TRACKING_YEAR_QUARTERS) {
  return quarters.reduce((sum, quarter) => sum + Number(cell.values[type]?.[quarter]?.progress_quantity ?? 0), 0);
}

function trackingActivityCompletion(cell: TrackingActivityCell, quarters = TRACKING_YEAR_QUARTERS) {
  if (cell.targetQuantity <= 0) return 0;
  const preferredType = trackingActivityPreferredType(cell);
  const total = quarters.reduce((sum, quarter) => sum + Number(cell.values[preferredType]?.[quarter]?.progress_quantity ?? 0), 0);
  return Math.min(999, total / cell.targetQuantity * 100);
}

function isTrackableVegetalGroup(value?: string | null): value is VegetalIndicatorGroup {
  return VEGETAL_INDICATOR_GROUPS.some((group) => group.key === value);
}

function quarterlyProgressKey(familyId: string, planActivityId: string, type: TrackingProgressType, quarter: number) {
  return `${familyId}|${planActivityId}|${type}|${quarter}`;
}

function vegetalProgressKey(familyId: string, group: VegetalIndicatorGroup, type: VegetalQuarterlyType, quarter: number) {
  return `${familyId}|${group}|${type}|${quarter}`;
}

function trackingActivityDraftKey(familyId: string, groupKey: string, planActivityId: string, type: TrackingProgressType, quarter: number) {
  return `activity|${familyId}|${groupKey}|${planActivityId}|${type}|${quarter}`;
}

function trackingVegetalDraftKey(familyId: string, group: VegetalIndicatorGroup, type: VegetalQuarterlyType, quarter: number) {
  return `vegetal|${familyId}|${group}|${type}|${quarter}`;
}

function trackingAgreementDraftKey(familyId: string, field: "meta" | "percent") {
  return `agreement|${familyId}|${field}`;
}

function parseTrackingDraftKey(key: string):
  | { kind: "activity"; familyId: string; groupKey: string; planActivityId: string; progressType: TrackingProgressType; quarter: number }
  | { kind: "vegetal"; familyId: string; vegetalGroup: VegetalIndicatorGroup; progressType: VegetalQuarterlyType; quarter: number }
  | { kind: "agreement"; familyId: string; field: "meta" | "percent" } {
  const parts = key.split("|");
  if (parts[0] === "activity") {
    return {
      kind: "activity",
      familyId: parts[1],
      groupKey: parts[2],
      planActivityId: parts[3],
      progressType: parts[4] as TrackingProgressType,
      quarter: Number(parts[5])
    };
  }
  if (parts[0] === "vegetal") {
    return {
      kind: "vegetal",
      familyId: parts[1],
      vegetalGroup: parts[2] as VegetalIndicatorGroup,
      progressType: parts[3] as VegetalQuarterlyType,
      quarter: Number(parts[4])
    };
  }
  return {
    kind: "agreement",
    familyId: parts[1],
    field: parts[2] === "meta" ? "meta" : "percent"
  };
}

async function upsertQuarterlyProgress(payload: {
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
  vegetal_indicator_group?: VegetalIndicatorGroup | null;
}) {
  let query = supabase
    .from("quarterly_progress")
    .select("id")
    .eq("is_deleted", false)
    .eq("project_id", payload.project_id)
    .eq("family_id", payload.family_id)
    .eq("year", payload.year)
    .eq("progress_type", payload.progress_type);

  if (payload.vegetal_indicator_group) {
    query = query
      .is("plan_activity_id", null)
      .eq("quarter", payload.quarter)
      .eq("vegetal_indicator_group", payload.vegetal_indicator_group);
  } else if (payload.plan_activity_id) {
    query = query.eq("plan_activity_id", payload.plan_activity_id).eq("quarter", payload.quarter);
  } else {
    query = query.is("plan_activity_id", null).is("quarter", null);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  const existingId = (data as { id: string }[] | null)?.[0]?.id;
  const result = existingId
    ? await supabase.from("quarterly_progress").update(payload).eq("id", existingId)
    : await supabase.from("quarterly_progress").insert(payload);
  if (result.error) throw result.error;
}

function buildMaintenanceMatrix(data: {
  projects: Project[];
  families: Family[];
  properties: Property[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  maintenanceProgress: MaintenanceProgress[];
  filters: ProcurementFilters;
  year: number;
  visibleQuarters: number[];
}): MaintenanceMatrix {
  const familyById = new Map(data.families.map((item) => [item.id, item]));
  const propertyByFamily = new Map(data.properties.filter((item) => !item.is_deleted).map((item) => [item.family_id, item]));
  const municipalityById = new Map(data.municipalities.map((item) => [item.id, item]));
  const villageById = new Map(data.villages.map((item) => [item.id, item]));
  const activityById = new Map(data.activities.map((item) => [item.id, item]));
  const planById = new Map(data.plans.map((item) => [item.id, item]));
  const progressByActivity = new Map<string, MaintenanceProgress>();
  const organicProgressByFamily = new Map<string, MaintenanceProgress>();

  for (const progress of data.maintenanceProgress.filter((item) => !item.is_deleted && item.year === data.year)) {
    if ((progress.maintenance_type === "abono_liquido" || progress.maintenance_type === "abono_solido") && !progress.plan_activity_id && progress.quarter) {
      organicProgressByFamily.set(maintenanceOrganicLookupKey(progress.family_id, progress.maintenance_type as MaintenanceOrganicType, progress.quarter), progress);
    } else if (progress.plan_activity_id) {
      progressByActivity.set(maintenanceProgressLookupKey(
        progress.family_id,
        progress.plan_activity_id,
        progress.maintenance_type,
        progress.maintenance_number,
        progress.quarter
      ), progress);
    }
  }

  const latestByFamilyActivity = new Map<string, { plan: OperationalPlan; planActivity: PlanActivity; activity: Activity }>();
  for (const planActivity of data.planActivities.filter((item) => !item.is_deleted)) {
    const plan = planById.get(planActivity.plan_id);
    if (!plan || !isApprovedPlanStatus(plan.status) || plan.is_deleted) continue;
    const family = familyById.get(plan.family_id);
    if (!family || family.is_deleted) continue;
    const activity = activityById.get(planActivity.activity_id);
    if (!activity || activity.is_deleted || isAgreementActivity(activity.name) || !isMaintenanceActivity(activity)) continue;
    const key = `${plan.family_id}-${planActivity.activity_id}`;
    const current = latestByFamilyActivity.get(key);
    if (!current || comparePlanRecency(plan, current.plan) > 0) {
      latestByFamilyActivity.set(key, { plan, planActivity, activity });
    }
  }

  const groups = new Map<string, MaintenanceActivityGroup>();
  const rows = new Map<string, MaintenanceFamilyRow>();
  for (const item of latestByFamilyActivity.values()) {
    const family = familyById.get(item.plan.family_id);
    if (!family) continue;
    const municipality = family.municipality_id ? municipalityById.get(family.municipality_id) : undefined;
    const village = family.village_id ? villageById.get(family.village_id) : undefined;
    if (data.filters.project_id && item.plan.project_id !== data.filters.project_id) continue;
    if (data.filters.municipality_id && family.municipality_id !== data.filters.municipality_id) continue;
    if (data.filters.village_id && family.village_id !== data.filters.village_id) continue;
    if (data.filters.family_id && family.id !== data.filters.family_id) continue;
    if (data.filters.activity_id && item.activity.id !== data.filters.activity_id) continue;
    if (data.filters.material_id && !data.planMaterials.some((material) =>
      !material.is_deleted &&
      material.plan_activity_id === item.planActivity.id &&
      material.material_id === data.filters.material_id
    )) continue;

    const groupKey = item.activity.id;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        activity_id: item.activity.id,
        activityName: item.activity.name,
        unit: item.activity.unit || item.planActivity.unit,
        tasks: maintenanceTasksForActivity(item.activity)
      });
    }
    const group = groups.get(groupKey);
    if (!group) continue;
    const property = propertyByFamily.get(family.id);
    const hectares = property?.total_area_ha !== null && property?.total_area_ha !== undefined ? formatNumber(Number(property.total_area_ha)) : "N/A";
    const row = rows.get(family.id) ?? {
      key: family.id,
      project_id: item.plan.project_id,
      family_id: family.id,
      familyCode: family.family_code,
      familyName: family.representative_name,
      documentNumber: family.document_number ?? "",
      ageYears: family.birth_date ? String(calculateAge(family.birth_date, data.year)) : family.age !== null ? String(family.age) : "",
      municipality_id: family.municipality_id,
      municipalityName: municipality?.name ?? "N/A",
      village_id: family.village_id,
      villageName: village?.name ?? "N/A",
      hectares,
      activities: {},
      organicProgress: {
        abono_liquido: {},
        abono_solido: {}
      }
    };
    for (const organicType of ["abono_liquido", "abono_solido"] as MaintenanceOrganicType[]) {
      row.organicProgress[organicType] = row.organicProgress[organicType] ?? {};
      for (const quarter of [1, 2, 3, 4]) {
        const progress = organicProgressByFamily.get(maintenanceOrganicLookupKey(family.id, organicType, quarter));
        if (progress) row.organicProgress[organicType]![quarter] = progress;
      }
    }
    const progress: MaintenanceActivityCell["progress"] = {};
    for (const task of group.tasks) {
      progress[maintenanceProgressKey(task.type, task.number, null)] = progressByActivity.get(maintenanceProgressLookupKey(family.id, item.planActivity.id, task.type, task.number, null));
    }
    row.activities[groupKey] = {
      operational_plan_id: item.plan.id,
      plan_activity_id: item.planActivity.id,
      activity_id: item.activity.id,
      baselineQuantity: item.planActivity.baseline !== null ? String(item.planActivity.baseline) : null,
      targetQuantity: Number(item.planActivity.target ?? 0),
      unit: item.activity.unit || item.planActivity.unit,
      progress
    };
    rows.set(family.id, row);
  }

  return {
    year: data.year,
    visibleQuarters: data.visibleQuarters,
    groups: Array.from(groups.values()).sort((left, right) => left.activityName.localeCompare(right.activityName)),
    rows: Array.from(rows.values()).sort((left, right) => left.familyCode.localeCompare(right.familyCode))
  };
}

const MAINTENANCE_TASK_LABELS: Record<MaintenanceTaskType, string> = {
  deshierbe: "Deshierbe",
  fertilizacion: "Fertilizacion",
  poda: "Poda",
  resiembra: "Resiembra"
};

function isMaintenanceActivity(activity: Activity) {
  if (activity.maintenance_enabled === false) return false;
  return maintenanceTasksForActivity(activity).length > 0;
}

function maintenanceTasksForActivity(activity: Activity): MaintenanceTaskColumn[] {
  return [
    ...maintenanceTaskColumns("deshierbe", Number(activity.maintenance_deshierbe_required ?? 1), Number(activity.maintenance_deshierbe_optional ?? 0)),
    ...maintenanceTaskColumns("fertilizacion", Number(activity.maintenance_fertilization_required ?? 1), Number(activity.maintenance_fertilization_optional ?? 0)),
    ...maintenanceTaskColumns("poda", Number(activity.maintenance_pruning_required ?? 1), Number(activity.maintenance_pruning_optional ?? 0)),
    ...maintenanceTaskColumns("resiembra", 0, Number(activity.maintenance_replanting_optional ?? 0))
  ];
}

function maintenanceTaskColumns(type: MaintenanceTaskType, requiredCount: number, optionalCount: number): MaintenanceTaskColumn[] {
  const columns: MaintenanceTaskColumn[] = [];
  for (let index = 1; index <= Math.max(0, requiredCount); index += 1) {
    columns.push({ type, number: index, label: `${MAINTENANCE_TASK_LABELS[type]} ${index}`, required: true });
  }
  for (let index = 1; index <= Math.max(0, optionalCount); index += 1) {
    const number = requiredCount + index;
    columns.push({ type, number, label: `${MAINTENANCE_TASK_LABELS[type]} ${number} opcional`, required: false });
  }
  return columns;
}

function maintenanceGroupHeaderLabel(group: MaintenanceActivityGroup) {
  const unit = group.unit?.trim();
  return unit ? `${group.activityName} (${unit})` : group.activityName;
}

function maintenanceGroupVisibleSubheaders(group: MaintenanceActivityGroup, quarters: number[], year: number) {
  return [
    "Meta",
    ...group.tasks.map((task) => task.label),
    "Estado ciclo"
  ];
}

function maintenanceGroupVisibleColSpan(group: MaintenanceActivityGroup, quarters: number[]) {
  return 1 + group.tasks.length + 1;
}

function maintenanceOrganicSubheaders(quarters: number[], year: number) {
  return (["abono_liquido", "abono_solido"] as MaintenanceOrganicType[]).flatMap((type) => [
    ...quarters.map((quarter) => `${maintenanceOrganicLabel(type)} (${maintenanceProgressUnit(type)}) Q${quarter}_${year}`),
    `Acumulado ${maintenanceOrganicLabel(type).toLowerCase()} (${maintenanceProgressUnit(type)})`
  ]);
}

function maintenanceOrganicColSpan(quarters: number[]) {
  return 2 * (quarters.length + 1);
}

function maintenanceHeaderClass(header: string) {
  if (header === "Meta") return "tracking-col-meta";
  if (header === "Estado ciclo") return "maintenance-col-cycle";
  if (header.startsWith("Acumulado")) return "tracking-col-accumulated";
  if (header.includes("Abono")) return "tracking-col-progress";
  return "maintenance-col-date";
}

function maintenanceCycleStatus(cell: MaintenanceActivityCell, group: MaintenanceActivityGroup) {
  const requiredTasks = group.tasks.filter((task) => task.required);
  if (requiredTasks.length === 0) return { label: "No aplica", className: "maintenance-cycle-na" };
  const complete = requiredTasks.every((task) => Boolean(cell.progress[maintenanceProgressKey(task.type, task.number, null)]?.maintenance_date));
  return complete
    ? { label: "Ciclo completado", className: "maintenance-cycle-complete" }
    : { label: "Ciclo incompleto", className: "maintenance-cycle-incomplete" };
}

function maintenanceOrganicLabel(type: MaintenanceOrganicType) {
  return type === "abono_liquido" ? "Abono liquido" : "Abono solido";
}

function maintenanceProgressUnit(type: MaintenanceProgressType) {
  if (type === "abono_liquido") return "litros";
  if (type === "abono_solido") return "kg";
  return null;
}

function maintenanceProgressKey(type: MaintenanceProgressType, number: number, quarter: number | null) {
  return `${type}|${number}|${quarter ?? 0}`;
}

function maintenanceProgressLookupKey(familyId: string, planActivityId: string, type: MaintenanceProgressType, number: number, quarter: number | null) {
  return `${familyId}|${planActivityId}|${maintenanceProgressKey(type, number, quarter)}`;
}

function maintenanceOrganicAccumulated(row: MaintenanceFamilyRow, type: MaintenanceOrganicType, quarters = TRACKING_YEAR_QUARTERS) {
  return quarters.reduce((sum, quarter) => sum + Number(row.organicProgress[type]?.[quarter]?.progress_quantity ?? 0), 0);
}

function maintenanceOrganicLookupKey(familyId: string, type: MaintenanceOrganicType, quarter: number) {
  return `${familyId}|${type}|${quarter}`;
}

async function upsertMaintenanceProgress(payload: {
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
}) {
  let query = supabase
    .from("maintenance_progress")
    .select("id")
    .eq("is_deleted", false)
    .eq("project_id", payload.project_id)
    .eq("family_id", payload.family_id)
    .eq("year", payload.year)
    .eq("maintenance_type", payload.maintenance_type)
    .eq("maintenance_number", payload.maintenance_number);

  query = payload.plan_activity_id === null ? query.is("plan_activity_id", null) : query.eq("plan_activity_id", payload.plan_activity_id);
  query = payload.quarter === null ? query.is("quarter", null) : query.eq("quarter", payload.quarter);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  const existingId = (data as { id: string }[] | null)?.[0]?.id;
  const result = existingId
    ? await supabase.from("maintenance_progress").update(payload).eq("id", existingId)
    : await supabase.from("maintenance_progress").insert(payload);
  if (result.error) throw result.error;
}

function calculateAge(birthDate: string, year: number) {
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const birthdayThisYear = new Date(year, date.getMonth(), date.getDate());
  const endOfYear = new Date(year, 11, 31);
  return Math.max(0, endOfYear.getFullYear() - date.getFullYear() - (endOfYear < birthdayThisYear ? 1 : 0));
}

function buildApprovedMaterialNeeds(data: {
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  plans: OperationalPlan[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  provisionalMaterials: ProvisionalMaterial[];
  materialDeliveryItems: MaterialDeliveryItem[];
}): ApprovedMaterialNeed[] {
  const projectById = new Map(data.projects.map((item) => [item.id, item]));
  const familyById = new Map(data.families.map((item) => [item.id, item]));
  const municipalityById = new Map(data.municipalities.map((item) => [item.id, item]));
  const villageById = new Map(data.villages.map((item) => [item.id, item]));
  const activityById = new Map(data.activities.map((item) => [item.id, item]));
  const materialById = new Map(data.materials.map((item) => [item.id, item]));
  const provisionalById = new Map(data.provisionalMaterials.map((item) => [item.id, item]));
  const deliveredByPlanMaterial = new Map<string, number>();

  for (const item of data.materialDeliveryItems.filter((row) => !row.is_deleted)) {
    deliveredByPlanMaterial.set(
      item.plan_project_material_id,
      (deliveredByPlanMaterial.get(item.plan_project_material_id) ?? 0) + Number(item.delivered_quantity)
    );
  }

  const activitiesByPlan = new Map<string, PlanActivity[]>();
  for (const activity of data.planActivities.filter((item) => !item.is_deleted)) {
    const rows = activitiesByPlan.get(activity.plan_id) ?? [];
    rows.push(activity);
    activitiesByPlan.set(activity.plan_id, rows);
  }
  const materialsByActivity = new Map<string, PlanProjectMaterial[]>();
  for (const material of data.planMaterials.filter((item) => !item.is_deleted)) {
    const rows = materialsByActivity.get(material.plan_activity_id) ?? [];
    rows.push(material);
    materialsByActivity.set(material.plan_activity_id, rows);
  }

  return data.plans
    .filter((plan) => isApprovedPlanStatus(plan.status) && !plan.is_deleted)
    .flatMap((plan) => {
      const project = projectById.get(plan.project_id);
      const family = familyById.get(plan.family_id);
      const municipality = family?.municipality_id ? municipalityById.get(family.municipality_id) : undefined;
      const village = family?.village_id ? villageById.get(family.village_id) : undefined;
      return (activitiesByPlan.get(plan.id) ?? []).flatMap((planActivity) => {
        const activity = activityById.get(planActivity.activity_id);
        return (materialsByActivity.get(planActivity.id) ?? []).map((planMaterial) => {
          const material = planMaterial.material_id ? materialById.get(planMaterial.material_id) : undefined;
          const provisional = planMaterial.provisional_material_id ? provisionalById.get(planMaterial.provisional_material_id) : undefined;
          const approvedQuantity = Number(planMaterial.quantity);
          const deliveredQuantity = deliveredByPlanMaterial.get(planMaterial.id) ?? 0;
          const unitPrice = Number(material?.quoted_unit_price ?? planMaterial.quoted_unit_price);
          return {
            id: planMaterial.id,
            project_id: plan.project_id,
            projectName: project?.name ?? "Sin proyecto",
            municipality_id: family?.municipality_id ?? null,
            municipalityName: municipality?.name ?? "N/A",
            village_id: family?.village_id ?? null,
            villageName: village?.name ?? "N/A",
            family_id: plan.family_id,
            familyCode: family?.family_code ?? "N/A",
            familyName: family?.representative_name ?? "N/A",
            documentNumber: family?.document_number ?? "N/A",
            operational_plan_id: plan.id,
            plan_activity_id: planActivity.id,
            activity_id: planActivity.activity_id,
            activityName: activity?.name ?? "Actividad",
            plan_project_material_id: planMaterial.id,
            material_id: planMaterial.material_id,
            provisional_material_id: planMaterial.provisional_material_id,
            materialName: material?.name ?? provisional?.provisional_name ?? planMaterial.observations ?? "Material",
            unit: planMaterial.unit,
            approvedQuantity,
            deliveredQuantity,
            pendingQuantity: Math.max(0, approvedQuantity - deliveredQuantity),
            unitPrice,
            totalValue: approvedQuantity * unitPrice
          };
        });
      });
    });
}

async function fetchApprovedMaterialNeeds(data: {
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  provisionalMaterials: ProvisionalMaterial[];
}): Promise<ApprovedMaterialNeed[]> {
  const plansResult = await supabase
    .from("operational_plans")
    .select("*")
    .eq("is_deleted", false);
  if (plansResult.error) throw plansResult.error;

  const approvedPlans = ((plansResult.data ?? []) as OperationalPlan[]).filter((plan) => isApprovedPlanStatus(plan.status));
  const planIds = approvedPlans.map((plan) => plan.id);
  if (planIds.length === 0) {
    return buildApprovedMaterialNeeds({
      ...data,
      plans: [],
      planActivities: [],
      planMaterials: [],
      materialDeliveryItems: []
    });
  }

  const activitiesResult = await supabase
    .from("plan_activities")
    .select("*")
    .in("plan_id", planIds)
    .eq("is_deleted", false);
  if (activitiesResult.error) throw activitiesResult.error;

  const planActivitiesRows = (activitiesResult.data ?? []) as PlanActivity[];
  const activityIds = planActivitiesRows.map((activity) => activity.id);
  const [materialsResult, deliveriesResult] = activityIds.length > 0
    ? await Promise.all([
        supabase
          .from("plan_project_materials")
          .select("*")
          .in("plan_activity_id", activityIds)
          .eq("is_deleted", false),
        supabase
          .from("material_delivery_items")
          .select("*")
          .in("operational_plan_id", planIds)
          .eq("is_deleted", false)
      ])
    : [
        { data: [], error: null },
        { data: [], error: null }
      ];
  if (materialsResult.error) throw materialsResult.error;

  const deliveryItems = deliveriesResult.error ? [] : (deliveriesResult.data ?? []) as MaterialDeliveryItem[];

  return buildApprovedMaterialNeeds({
    ...data,
    plans: approvedPlans,
    planActivities: planActivitiesRows,
    planMaterials: (materialsResult.data ?? []) as PlanProjectMaterial[],
    materialDeliveryItems: deliveryItems
  });
}

function isApprovedPlanStatus(status: string) {
  return status === "approved" || status === "aprobado";
}

function filterApprovedNeeds(needs: ApprovedMaterialNeed[], filters: ProcurementFilters) {
  return needs.filter((need) =>
    (!filters.project_id || need.project_id === filters.project_id)
    && (!filters.municipality_id || need.municipality_id === filters.municipality_id)
    && (!filters.village_id || need.village_id === filters.village_id)
    && (!filters.family_id || need.family_id === filters.family_id)
    && (!filters.activity_id || need.activity_id === filters.activity_id)
    && (!filters.material_id || need.material_id === filters.material_id)
  );
}

function filterProcurementBatches(batches: ProcurementBatch[], filters: ProcurementFilters) {
  return batches
    .filter((batch) =>
      (!filters.project_id || batch.project_id === filters.project_id)
      && (!filters.municipality_id || batch.filter_municipality_id === filters.municipality_id || !batch.filter_municipality_id)
      && (!filters.village_id || batch.filter_village_id === filters.village_id || !batch.filter_village_id)
      && (!filters.family_id || batch.filter_family_id === filters.family_id || !batch.filter_family_id)
      && (!filters.activity_id || batch.filter_activity_id === filters.activity_id || !batch.filter_activity_id)
      && (!filters.material_id || batch.filter_material_id === filters.material_id || !batch.filter_material_id)
    )
    .sort((left, right) => (left.purchase_number ?? 0) - (right.purchase_number ?? 0) || left.name.localeCompare(right.name));
}

function buildDetailFamilyOptions(needs: ApprovedMaterialNeed[]) {
  const options = new Map<string, { id: string; label: string }>();
  for (const need of needs) {
    if (!options.has(need.family_id)) {
      options.set(need.family_id, {
        id: need.family_id,
        label: `${need.familyCode} - ${need.familyName}`
      });
    }
  }
  return Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function buildDetailPurchaseOptions(batches: ProcurementBatch[]) {
  return Array.from(new Set(
    batches
      .map((batch) => Number(batch.purchase_number ?? 0))
      .filter((purchaseNumber) => Number.isInteger(purchaseNumber) && purchaseNumber > 0)
  )).sort((left, right) => left - right);
}

function hasActivePurchaseFilters(filters: PurchaseFilters) {
  return Boolean(filters.purchaseNumber || filters.invoiceNumber.trim() || filters.supplierName.trim());
}

function purchaseBatchMatchesFilters(batch: ProcurementBatch | undefined, filters: PurchaseFilters) {
  if (!hasActivePurchaseFilters(filters)) return true;
  if (!batch) return false;
  if (filters.purchaseNumber && Number(batch.purchase_number) !== Number(filters.purchaseNumber)) return false;
  const invoiceFilter = normalizeHeader(filters.invoiceNumber);
  if (invoiceFilter && !normalizeHeader(batch.invoice_number ?? "").includes(invoiceFilter)) return false;
  const supplierFilter = normalizeHeader(filters.supplierName);
  if (supplierFilter && !normalizeHeader(batch.supplier_name ?? "").includes(supplierFilter)) return false;
  return true;
}

function filterConsolidatedRowsByPurchase(rows: ConsolidatedMatrixRow[], filters: PurchaseFilters) {
  return rows.filter((row) => purchaseBatchMatchesFilters(row.purchaseBatch, filters));
}

function filterConsolidatedDetailNeeds(data: {
  needs: ApprovedMaterialNeed[];
  batches: ProcurementBatch[];
  items: ProcurementBatchItem[];
  familyId: string;
  purchaseFilters: PurchaseFilters;
}) {
  let rows = data.familyId
    ? data.needs.filter((need) => need.family_id === data.familyId)
    : data.needs;

  if (hasActivePurchaseFilters(data.purchaseFilters)) {
    const batchIds = new Set(data.batches
      .filter((batch) => purchaseBatchMatchesFilters(batch, data.purchaseFilters))
      .map((batch) => batch.id));
    const sourcePlanMaterialIds = new Set(data.items
      .filter((item) => batchIds.has(item.procurement_batch_id) && !item.is_deleted)
      .flatMap((item) => item.source_plan_material_ids));
    rows = rows.filter((need) => sourcePlanMaterialIds.has(need.plan_project_material_id));
  }

  return rows;
}

function filterPurchaseFamilyReportRows(rows: PurchaseFamilyReportRow[], filters: PurchaseFilters) {
  if (!hasActivePurchaseFilters(filters)) return rows;
  const invoiceFilter = normalizeHeader(filters.invoiceNumber);
  const supplierFilter = normalizeHeader(filters.supplierName);
  return rows.filter((row) =>
    (!filters.purchaseNumber || row.purchaseNumber === Number(filters.purchaseNumber))
    && (!invoiceFilter || normalizeHeader(row.invoiceNumber).includes(invoiceFilter))
    && (!supplierFilter || normalizeHeader(row.supplierName).includes(supplierFilter))
  );
}

function filterIndicatorRows(rows: IndicatorRow[], filters: ProcurementFilters) {
  return rows.filter((row) =>
    (!filters.project_id || row.project_id === filters.project_id)
    && (!filters.municipality_id || row.municipality_id === filters.municipality_id)
    && (!filters.village_id || row.village_id === filters.village_id)
    && (!filters.family_id || row.family_id === filters.family_id)
    && (!filters.activity_id || row.activity_id === filters.activity_id || row.plan_activity_id === filters.activity_id)
    && (!filters.material_id || row.material_id === filters.material_id)
  );
}

function consolidateMaterialNeeds(needs: ApprovedMaterialNeed[]): ConsolidatedMaterialNeed[] {
  const rows = new Map<string, ConsolidatedMaterialNeed>();
  for (const need of needs) {
    const key = `${need.project_id}-${need.material_id ?? need.provisional_material_id ?? need.materialName}-${need.unit}-${need.unitPrice}`;
    const current = rows.get(key) ?? {
      key,
      project_id: need.project_id,
      projectName: need.projectName,
      material_id: need.material_id,
      provisional_material_id: need.provisional_material_id,
      materialName: need.materialName,
      unit: need.unit,
      requiredQuantity: 0,
      deliveredQuantity: 0,
      pendingQuantity: 0,
      unitPrice: need.unitPrice,
      totalValue: 0,
      sourcePlanMaterialIds: []
    };
    current.requiredQuantity += need.approvedQuantity;
    current.deliveredQuantity += need.deliveredQuantity;
    current.pendingQuantity += need.pendingQuantity;
    current.totalValue += need.pendingQuantity * need.unitPrice;
    current.sourcePlanMaterialIds.push(need.plan_project_material_id);
    rows.set(key, current);
  }
  return Array.from(rows.values()).sort((left, right) => left.materialName.localeCompare(right.materialName));
}

function buildConsolidatedMatrix(
  needs: ApprovedMaterialNeed[],
  batches: ProcurementBatch[],
  items: ProcurementBatchItem[]
): ConsolidatedMatrix {
  const rowMap = new Map<string, ConsolidatedMatrixRow>();

  for (const need of needs) {
    const key = `${need.project_id}-${need.material_id ?? need.provisional_material_id ?? need.materialName}-${need.unit}-${need.unitPrice}`;
    const row = rowMap.get(key) ?? {
      key,
      project_id: need.project_id,
      projectName: need.projectName,
      material_id: need.material_id,
      provisional_material_id: need.provisional_material_id,
      materialName: need.materialName,
      unit: need.unit,
      unitPrice: need.unitPrice,
      total: 0,
      totalValue: 0,
      sourcePlanMaterialIds: [],
      families: []
    };
    row.total += need.approvedQuantity;
    row.totalValue += need.approvedQuantity * need.unitPrice;
    row.sourcePlanMaterialIds.push(need.plan_project_material_id);
    if (need.familyName && !row.families.includes(need.familyName)) {
      row.families.push(need.familyName);
    }
    rowMap.set(key, row);
  }

  const rows = Array.from(rowMap.values()).sort((left, right) => left.materialName.localeCompare(right.materialName));
  for (const row of rows) {
    const match = findProcurementMatchForConsolidatedRow(row, batches, items);
    row.purchaseBatch = match?.batch;
    row.purchaseItem = match?.item;
  }

  return {
    rows
  };
}

function buildEtecMatrix(
  needs: ApprovedMaterialNeed[],
  materials: Material[],
  drafts: Record<string, EtecDraft>,
  mode: EtecViewMode,
  blockFilter: string
): EtecMatrix {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const rowMap = new Map<string, EtecRow>();
  const territories = new Set<string>();

  for (const need of needs) {
    const material = need.material_id ? materialById.get(need.material_id) : undefined;
    const baseBlock = material?.etec_block || defaultEtecBlockForCategory(material?.category);
    const key = `${need.project_id}-${need.material_id ?? need.provisional_material_id ?? need.materialName}-${need.unit}`;
    const draft = drafts[key];
    const block = normalizeEtecBlock(draft?.block ?? baseBlock);
    if (blockFilter && block !== blockFilter) continue;
    const territory = mode === "municipality" ? need.municipalityName : need.villageName;
    const territoryName = territory || (mode === "municipality" ? "Sin municipio" : "Sin vereda");
    territories.add(territoryName);
    const row = rowMap.get(key) ?? {
      key,
      project_id: need.project_id,
      material_id: need.material_id,
      provisional_material_id: need.provisional_material_id,
      materialName: need.materialName,
      unit: need.unit,
      block,
      characteristics: draft?.characteristics ?? material?.technical_characteristics ?? "",
      total: 0,
      unitPrice: need.unitPrice,
      totalValue: 0,
      territoryQuantities: {},
      sourcePlanMaterialIds: [],
      material
    };
    row.block = block;
    row.characteristics = draft?.characteristics ?? row.characteristics;
    row.total += need.approvedQuantity;
    row.totalValue += need.approvedQuantity * need.unitPrice;
    row.territoryQuantities[territoryName] = (row.territoryQuantities[territoryName] ?? 0) + need.approvedQuantity;
    row.sourcePlanMaterialIds.push(need.plan_project_material_id);
    rowMap.set(key, row);
  }

  const sortedTerritories = Array.from(territories).sort((left, right) => left.localeCompare(right));
  const rows = Array.from(rowMap.values()).sort((left, right) =>
    `${left.block}-${left.materialName}`.localeCompare(`${right.block}-${right.materialName}`)
  );
  return { mode, territories: sortedTerritories, rows };
}

function buildEtecBlockOptions(materials: Material[], rows: EtecRow[], customBlocks: string[] = []) {
  return Array.from(new Set([
    ...ETEC_DEFAULT_BLOCKS,
    ...customBlocks.map((block) => normalizeEtecBlock(block)).filter(Boolean),
    ...materials.map((material) => normalizeEtecBlock(material.etec_block ?? "")).filter(Boolean),
    ...rows.map((row) => normalizeEtecBlock(row.block)).filter(Boolean)
  ])).sort((left, right) => left.localeCompare(right));
}

async function exportEtecExcel(matrix: EtecMatrix) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();

  const groupedRows = new Map<string, EtecRow[]>();
  for (const row of matrix.rows) {
    const block = normalizeEtecBlock(row.block);
    const rows = groupedRows.get(block) ?? [];
    rows.push(row);
    groupedRows.set(block, rows);
  }

  for (const [block, rows] of groupedRows.entries()) {
    const sheet = workbook.addWorksheet(sanitizeWorksheetName(block));
    const totalColumns = 3 + matrix.territories.length + 1;
    sheet.mergeCells(1, 1, 1, totalColumns);
    sheet.getCell(1, 1).value = `BLOQUE ${block.toUpperCase()}`;
    sheet.getCell(1, 1).font = { bold: true, size: 12 };
    sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.addRow(["ITEM", "ELEMENTO", "CARACTERISTICAS", ...matrix.territories.map((territory) => territory.toUpperCase()), "TOTAL"]);
    rows.forEach((row, index) => {
      sheet.addRow([
        index + 1,
        row.materialName,
        row.characteristics,
        ...matrix.territories.map((territory) => row.territoryQuantities[territory] ?? 0),
        row.total
      ]);
    });
    stylePlainWorksheetHeader(sheet, 2);
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 48;
    sheet.getColumn(3).width = 80;
    for (let column = 4; column <= totalColumns; column += 1) {
      sheet.getColumn(column).width = 18;
      sheet.getColumn(column).numFmt = "#,##0.00";
    }
    sheet.eachRow((row) => {
      row.alignment = { vertical: "middle", wrapText: true };
    });
  }

  if (groupedRows.size === 0) {
    const sheet = workbook.addWorksheet("ETEC");
    sheet.addRow(["Sin datos ETEC para los filtros seleccionados."]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), `etec-${matrix.mode === "municipality" ? "municipios" : "veredas"}.xlsx`);
}

async function exportConsolidatedExcel(matrix: ConsolidatedMatrix, _needs: ApprovedMaterialNeed[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();

  const consolidated = workbook.addWorksheet("Consolidado");
  consolidated.addRow([
    "Descripcion Producto",
    "Unidad",
    "Valor unitario cotizado",
    "Total cantidad",
    "Valor total cotizado",
    "Valor unitario facturado",
    "Valor total facturado",
    "Numero compra",
    "Numero factura",
    "Proveedor"
  ]);
  for (const row of matrix.rows) {
    const draft = consolidatedPurchaseDraftFromRow(row);
    const invoicedUnitValue = Number(draft.invoiced_value || 0);
    consolidated.addRow([
      row.materialName,
      row.unit,
      row.unitPrice,
      row.total,
      row.totalValue,
      invoicedUnitValue,
      invoicedUnitValue * row.total,
      draft.purchase_number,
      draft.invoice_number,
      draft.supplier_name
    ]);
  }
  stylePlainWorksheetHeader(consolidated);
  consolidated.getColumn(1).width = 61;
  consolidated.getColumn(2).width = 14;
  consolidated.getColumn(3).width = 20;
  for (let index = 4; index <= 10; index += 1) {
    consolidated.getColumn(index).width = index >= 8 ? 22 : 18;
  }
  consolidated.getColumn(3).numFmt = '"$"#,##0';
  consolidated.getColumn(5).numFmt = '"$"#,##0';
  consolidated.getColumn(6).numFmt = '"$"#,##0';
  consolidated.getColumn(7).numFmt = '"$"#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), "consolidado-materiales.xlsx");
}

function nextProcurementPurchaseNumber(batches: ProcurementBatch[], projectId: string) {
  const maxNumber = batches
    .filter((batch) => batch.project_id === projectId)
    .reduce((max, batch) => Math.max(max, Number(batch.purchase_number ?? 0)), 0);
  return maxNumber + 1;
}

function purchaseBatchLabel(batch: ProcurementBatch) {
  const number = batch.purchase_number ? `Compra ${batch.purchase_number}` : batch.batch_code;
  return `${number} - ${batch.name}`;
}

function procurementQuotedUnitPrice(item: ProcurementBatchItem) {
  return Number(item.quoted_unit_price ?? item.unit_price ?? 0);
}

function procurementQuotedTotalValue(item: ProcurementBatchItem) {
  return Number(item.quoted_total_value ?? item.required_quantity * procurementQuotedUnitPrice(item));
}

function procurementPurchaseUnitPrice(item: ProcurementBatchItem) {
  return Number(item.purchase_unit_price ?? 0);
}

function findProcurementMatchForConsolidatedRow(
  row: ConsolidatedMatrixRow,
  batches: ProcurementBatch[],
  items: ProcurementBatchItem[]
) {
  const sourceIds = new Set(row.sourcePlanMaterialIds);
  const candidates = items
    .filter((item) =>
      !item.is_deleted
      && item.unit === row.unit
      && ((item.material_id ?? null) === (row.material_id ?? null) || (!item.material_id && !row.material_id && item.material_name === row.materialName))
      && (item.provisional_material_id ?? null) === (row.provisional_material_id ?? null)
      && item.source_plan_material_ids.some((id) => sourceIds.has(id))
    )
    .map((item) => {
      const batch = batches.find((candidate) => candidate.id === item.procurement_batch_id && !candidate.is_deleted);
      return batch ? { item, batch } : null;
    })
    .filter((match): match is { item: ProcurementBatchItem; batch: ProcurementBatch } => Boolean(match))
    .sort((left, right) =>
      (right.batch.purchase_number ?? 0) - (left.batch.purchase_number ?? 0)
      || right.batch.name.localeCompare(left.batch.name)
    );
  return candidates[0] ?? null;
}

function consolidatedPurchaseDraftFromRow(row: ConsolidatedMatrixRow): ConsolidatedPurchaseDraft {
  const savedUnitPrice = Number(row.purchaseItem?.purchase_unit_price ?? 0);
  const legacyTotalValue = Number(row.purchaseItem?.purchase_total_value ?? 0);
  const invoicedUnitValue = savedUnitPrice > 0 ? savedUnitPrice : row.total > 0 && legacyTotalValue > 0 ? legacyTotalValue / row.total : 0;
  return {
    invoiced_value: invoicedUnitValue > 0 ? String(invoicedUnitValue) : "",
    purchase_number: row.purchaseBatch?.purchase_number ? String(row.purchaseBatch.purchase_number) : "",
    invoice_number: row.purchaseBatch?.invoice_number ?? "",
    supplier_name: row.purchaseBatch?.supplier_name ?? ""
  };
}

function buildPurchaseFamilyReportRows(data: {
  batches: ProcurementBatch[];
  items: ProcurementBatchItem[];
  needs: ApprovedMaterialNeed[];
  deliveryItems: MaterialDeliveryItem[];
}): PurchaseFamilyReportRow[] {
  const needsByPlanMaterial = new Map(data.needs.map((need) => [need.plan_project_material_id, need]));
  const deliveredByPlanMaterial = new Map<string, number>();
  for (const deliveryItem of data.deliveryItems.filter((item) => !item.is_deleted)) {
    deliveredByPlanMaterial.set(
      deliveryItem.plan_project_material_id,
      (deliveredByPlanMaterial.get(deliveryItem.plan_project_material_id) ?? 0) + Number(deliveryItem.delivered_quantity)
    );
  }

  const rows: PurchaseFamilyReportRow[] = [];
  for (const batch of data.batches) {
    const batchItems = data.items.filter((item) => item.procurement_batch_id === batch.id && !item.is_deleted);
    for (const item of batchItems) {
      const relatedNeeds = item.source_plan_material_ids
        .map((id) => needsByPlanMaterial.get(id))
        .filter((need): need is ApprovedMaterialNeed => Boolean(need));
      for (const need of relatedNeeds) {
        const deliveredQuantity = deliveredByPlanMaterial.get(need.plan_project_material_id) ?? 0;
        const quotedUnitPrice = procurementQuotedUnitPrice(item) || need.unitPrice;
        const purchaseUnitPrice = procurementPurchaseUnitPrice(item);
        const quantityForPurchaseValue = deliveredQuantity > 0 ? deliveredQuantity : need.approvedQuantity;
        const quotedTotalValue = need.approvedQuantity * quotedUnitPrice;
        const purchaseTotalValue = quantityForPurchaseValue * purchaseUnitPrice;
        rows.push({
          projectName: need.projectName,
          purchaseNumber: Number(batch.purchase_number ?? 0) || null,
          purchaseLabel: purchaseBatchLabel(batch),
          supplierName: batch.supplier_name ?? "",
          invoiceNumber: batch.invoice_number ?? "",
          invoiceDate: batch.invoice_date ?? "",
          familyCode: need.familyCode,
          familyName: need.familyName,
          municipalityName: need.municipalityName,
          villageName: need.villageName,
          activityName: need.activityName,
          materialName: need.materialName,
          unit: need.unit,
          approvedQuantity: need.approvedQuantity,
          deliveredQuantity,
          quotedUnitPrice,
          quotedTotalValue,
          purchaseUnitPrice,
          purchaseTotalValue,
          differenceValue: purchaseTotalValue - quotedTotalValue
        });
      }
    }
  }
  return rows.sort((left, right) =>
    left.familyCode.localeCompare(right.familyCode)
    || left.purchaseLabel.localeCompare(right.purchaseLabel)
    || left.activityName.localeCompare(right.activityName)
    || left.materialName.localeCompare(right.materialName)
  );
}

async function exportPurchasesByFamilyExcel(rows: PurchaseFamilyReportRow[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Compras por familia");
  sheet.addRow([
    "Proyecto",
    "Compra",
    "Proveedor",
    "Factura",
    "Fecha factura",
    "Codigo familia",
    "Familia",
    "Municipio",
    "Vereda",
    "Actividad",
    "Producto",
    "Unidad",
    "Cantidad aprobada",
    "Cantidad entregada",
    "Valor unitario cotizado",
    "Valor total cotizado",
    "Valor unitario facturado",
    "Valor total entregado/facturado"
  ]);
  for (const row of rows) {
    sheet.addRow([
      row.projectName,
      row.purchaseLabel,
      row.supplierName,
      row.invoiceNumber,
      row.invoiceDate,
      row.familyCode,
      row.familyName,
      row.municipalityName,
      row.villageName,
      row.activityName,
      row.materialName,
      row.unit,
      row.approvedQuantity,
      row.deliveredQuantity,
      row.quotedUnitPrice,
      row.quotedTotalValue,
      row.purchaseUnitPrice,
      row.purchaseTotalValue
    ]);
  }
  stylePlainWorksheetHeader(sheet);
  [1, 2, 3, 7, 8, 9, 10, 11].forEach((column) => {
    sheet.getColumn(column).width = column === 11 ? 42 : 24;
  });
  for (const column of [15, 16, 17, 18]) {
    sheet.getColumn(column).numFmt = '"$"#,##0';
  }

  const summarySheet = workbook.addWorksheet("Resumen por familia");
  summarySheet.addRow([
    "Codigo familia",
    "Familia",
    "Municipio",
    "Vereda",
    "Actividad",
    "Producto",
    "Unidad",
    "Compra",
    "Factura",
    "Proveedor",
    "Cantidad entregada",
    "Valor unitario facturado",
    "Valor total entregado/facturado"
  ]);
  const summaryRows = new Map<string, PurchaseFamilyReportRow & { totalDelivered: number; totalPurchaseValue: number }>();
  for (const row of rows) {
    const key = [
      row.familyCode,
      row.activityName,
      row.materialName,
      row.unit,
      row.purchaseLabel,
      row.invoiceNumber,
      row.supplierName
    ].join("|");
    const current = summaryRows.get(key) ?? { ...row, totalDelivered: 0, totalPurchaseValue: 0 };
    current.totalDelivered += row.deliveredQuantity;
    current.totalPurchaseValue += row.purchaseTotalValue;
    summaryRows.set(key, current);
  }
  for (const row of summaryRows.values()) {
    summarySheet.addRow([
      row.familyCode,
      row.familyName,
      row.municipalityName,
      row.villageName,
      row.activityName,
      row.materialName,
      row.unit,
      row.purchaseLabel,
      row.invoiceNumber,
      row.supplierName,
      row.totalDelivered,
      row.purchaseUnitPrice,
      row.totalPurchaseValue
    ]);
  }
  stylePlainWorksheetHeader(summarySheet);
  [1, 2, 3, 4, 5, 6, 8, 9, 10].forEach((column) => {
    summarySheet.getColumn(column).width = column === 6 ? 42 : 24;
  });
  summarySheet.getColumn(12).numFmt = '"$"#,##0';
  summarySheet.getColumn(13).numFmt = '"$"#,##0';
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), "compras-por-familia.xlsx");
}

async function exportDeliveredByFamilyExcel(rows: PurchaseFamilyReportRow[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Entregado por familia");
  sheet.addRow([
    "Codigo familia",
    "Familia",
    "Municipio",
    "Vereda",
    "Compra",
    "Factura",
    "Proveedor",
    "Actividad",
    "Material",
    "Unidad",
    "Cantidad entregada",
    "Valor unitario facturado",
    "Valor total entregado"
  ]);
  for (const row of rows) {
    const unitPrice = row.purchaseUnitPrice || row.quotedUnitPrice;
    sheet.addRow([
      row.familyCode,
      row.familyName,
      row.municipalityName,
      row.villageName,
      row.purchaseLabel,
      row.invoiceNumber,
      row.supplierName,
      row.activityName,
      row.materialName,
      row.unit,
      row.deliveredQuantity,
      unitPrice,
      row.deliveredQuantity * unitPrice
    ]);
  }
  stylePlainWorksheetHeader(sheet);
  sheet.autoFilter = "A1:M1";
  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((column) => {
    sheet.getColumn(column).width = column === 9 ? 42 : 24;
  });
  sheet.getColumn(12).numFmt = '"$"#,##0';
  sheet.getColumn(13).numFmt = '"$"#,##0';
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), "entregado-por-familia.xlsx");
}

function buildIndicatorRows(needs: ApprovedMaterialNeed[], progressRows: ImplementationProgress[]): IndicatorRow[] {
  const progressByKey = new Map<string, ImplementationProgress>();
  for (const progress of progressRows.filter((row) => !row.is_deleted)) {
    progressByKey.set(implementationProgressKey(progress.family_id, progress.operational_plan_id, progress.plan_activity_id, progress.material_id, progress.indicator_name), progress);
  }

  return needs.map((need) => {
    const progress = progressByKey.get(implementationProgressKey(need.family_id, need.operational_plan_id, need.plan_activity_id, need.material_id, need.materialName));
    const targetQuantity = need.approvedQuantity;
    const implementedQuantity = Number(progress?.implemented_quantity ?? 0);
    const deliveredQuantity = need.deliveredQuantity;
    const progressPercentage = targetQuantity > 0 ? Math.min(999, implementedQuantity / targetQuantity * 100) : 0;
    const status = progress?.status ?? (implementedQuantity >= targetQuantity && targetQuantity > 0 ? "completed" : implementedQuantity > 0 ? "in_progress" : "pending");
    return {
      key: need.id,
      project_id: need.project_id,
      municipality_id: need.municipality_id,
      village_id: need.village_id,
      family_id: need.family_id,
      operational_plan_id: need.operational_plan_id,
      plan_activity_id: need.plan_activity_id,
      activity_id: need.activity_id,
      plan_project_material_id: need.plan_project_material_id,
      material_id: need.material_id,
      provisional_material_id: need.provisional_material_id,
      familyCode: need.familyCode,
      familyName: need.familyName,
      municipalityName: need.municipalityName,
      villageName: need.villageName,
      hectares: "N/A",
      activityName: need.activityName,
      materialName: need.materialName,
      unit: need.unit,
      targetQuantity,
      deliveredQuantity,
      implementedQuantity,
      progressPercentage,
      status,
      observations: progress?.observations ?? "",
      progress
    };
  });
}

function implementationProgressKey(familyId: string, operationalPlanId: string | null, planActivityId: string | null, materialId: string | null, indicatorName: string | null) {
  return `${familyId}-${operationalPlanId ?? "sin-plan"}-${planActivityId ?? "sin-actividad"}-${materialId ?? indicatorName ?? "indicador"}`;
}

async function findExistingImplementationProgress(row: IndicatorRow) {
  let query = supabase
    .from("implementation_progress")
    .select("*")
    .eq("is_deleted", false)
    .eq("project_id", row.project_id)
    .eq("family_id", row.family_id)
    .eq("operational_plan_id", row.operational_plan_id)
    .eq("plan_activity_id", row.plan_activity_id);

  query = row.material_id
    ? query.eq("material_id", row.material_id)
    : query.eq("indicator_name", row.materialName || row.activityName);

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(1);
  if (error) throw error;
  return ((data as ImplementationProgress[] | null)?.[0]) ?? null;
}

function consolidateIndicatorRows(rows: IndicatorRow[]): IndicatorConsolidatedRow[] {
  const consolidated = new Map<string, IndicatorConsolidatedRow>();
  for (const row of rows) {
    const key = `${row.municipalityName}-${row.villageName}-${row.activityName}-${row.status}`;
    const current = consolidated.get(key) ?? {
      key,
      municipalityName: row.municipalityName,
      villageName: row.villageName,
      activityName: row.activityName,
      status: row.status,
      targetQuantity: 0,
      deliveredQuantity: 0,
      implementedQuantity: 0,
      progressPercentage: 0
    };
    current.targetQuantity += row.targetQuantity;
    current.deliveredQuantity += row.deliveredQuantity;
    current.implementedQuantity += row.implementedQuantity;
    current.progressPercentage = current.targetQuantity > 0 ? current.implementedQuantity / current.targetQuantity * 100 : 0;
    consolidated.set(key, current);
  }
  return Array.from(consolidated.values()).sort((left, right) =>
    `${left.municipalityName}-${left.villageName}-${left.activityName}`.localeCompare(`${right.municipalityName}-${right.villageName}-${right.activityName}`)
  );
}

async function exportIndicatorsExcel(rows: IndicatorRow[], consolidatedRows: IndicatorConsolidatedRow[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();

  const cover = workbook.addWorksheet("HERRAMIENTA_SEGUIMIENTO");
  cover.mergeCells("A9:L9");
  cover.mergeCells("A10:L10");
  cover.getCell("A9").value = "PROYECTO DE RESTAURACION ECOLOGICA, REHABILITACION Y RECUPERACION DE ECOSISTEMAS DEGRADADOS";
  cover.getCell("A10").value = "HERRAMIENTA DE SEGUIMIENTO PROCESOS DE IMPLEMENTACION";
  cover.getCell("A9").font = { bold: true, size: 13 };
  cover.getCell("A10").font = { bold: true, size: 13 };
  cover.getCell("A9").alignment = { horizontal: "center" };
  cover.getCell("A10").alignment = { horizontal: "center" };
  for (let column = 1; column <= 12; column += 1) cover.getColumn(column).width = 13;

  const detail = workbook.addWorksheet("T4_2025");
  detail.getCell("C2").value = "Indicadores de avances de implementaciones";
  detail.getCell("C2").font = { bold: true, size: 13 };
  const indicatorGroups = buildIndicatorExcelGroups(rows);
  const fixedHeaders = ["Codigo Predio", "Familia", "Municipio", "Vereda", "Hectareas del predio"];
  fixedHeaders.forEach((header, index) => {
    const cell = detail.getCell(5, index + 1);
    cell.value = header;
    detail.mergeCells(5, index + 1, 6, index + 1);
  });
  let startColumn = 6;
  for (const group of indicatorGroups) {
    detail.getCell(5, startColumn).value = group.name;
    detail.mergeCells(5, startColumn, 5, startColumn + 2);
    detail.getCell(6, startColumn).value = "Meta";
    detail.getCell(6, startColumn + 1).value = "Entregados";
    detail.getCell(6, startColumn + 2).value = "Sembrados";
    startColumn += 3;
  }
  const familyRows = buildIndicatorFamilyRows(rows);
  let rowNumber = 7;
  for (const familyRow of familyRows) {
    detail.getCell(rowNumber, 1).value = familyRow.familyCode;
    detail.getCell(rowNumber, 2).value = familyRow.familyName;
    detail.getCell(rowNumber, 3).value = familyRow.municipalityName;
    detail.getCell(rowNumber, 4).value = familyRow.villageName;
    detail.getCell(rowNumber, 5).value = familyRow.hectares;
    startColumn = 6;
    for (const group of indicatorGroups) {
      const value = familyRow.groups[group.key] ?? { target: 0, delivered: 0, implemented: 0 };
      detail.getCell(rowNumber, startColumn).value = value.target;
      detail.getCell(rowNumber, startColumn + 1).value = value.delivered;
      detail.getCell(rowNumber, startColumn + 2).value = value.implemented;
      startColumn += 3;
    }
    rowNumber += 1;
  }
  styleIndicatorDetailSheet(detail, indicatorGroups.length);

  const consolidated = workbook.addWorksheet("Consolidado");
  startColumn = 1;
  for (const group of indicatorGroups) {
    consolidated.getCell(1, startColumn).value = group.name;
    consolidated.mergeCells(1, startColumn, 1, startColumn + 2);
    consolidated.getCell(2, startColumn).value = "Meta";
    consolidated.getCell(2, startColumn + 1).value = "Entregados";
    consolidated.getCell(2, startColumn + 2).value = "Sembrados";
    const totals = group.rows.reduce((acc, row) => ({
      target: acc.target + row.targetQuantity,
      delivered: acc.delivered + row.deliveredQuantity,
      implemented: acc.implemented + row.implementedQuantity
    }), { target: 0, delivered: 0, implemented: 0 });
    consolidated.getCell(3, startColumn).value = totals.target;
    consolidated.getCell(3, startColumn + 1).value = totals.delivered;
    consolidated.getCell(3, startColumn + 2).value = totals.implemented;
    startColumn += 3;
  }
  styleIndicatorSummarySheet(consolidated, indicatorGroups.length);

  const base = workbook.addWorksheet("Base");
  base.addRow(["Codigo familia", "Familia", "Municipio", "Vereda", "Actividad/indicador", "Material/insumo", "Unidad", "Meta", "Entregado", "Implementado", "Avance", "Estado", "Observaciones"]);
  for (const row of rows) {
    base.addRow([
      row.familyCode,
      row.familyName,
      row.municipalityName,
      row.villageName,
      row.activityName,
      row.materialName,
      row.unit,
      row.targetQuantity,
      row.deliveredQuantity,
      row.implementedQuantity,
      row.progressPercentage / 100,
      implementationStatusLabel(row.status),
      row.observations
    ]);
  }
  stylePlainWorksheetHeader(base);
  base.getColumn(11).numFmt = "0.00%";

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), "herramienta-indicadores.xlsx");
}

async function exportTrackingMatrixExcel(matrix: TrackingMatrix) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`SEGUIMIENTO_${matrix.year}`);
  const baseHeaders = ["Codigo Predio", "Familia", "Cedula", "Edad Años", "Municipio", "Vereda", "Hectareas del predio"];
  baseHeaders.forEach((header, index) => {
    const column = index + 1;
    sheet.getCell(1, column).value = header;
    sheet.mergeCells(1, column, 2, column);
  });

  let column = baseHeaders.length + 1;
  for (const group of matrix.vegetalGroups) {
    const subheaders = trackingVegetalVisibleSubheaders(matrix.visibleQuarters, matrix.year);
    sheet.getCell(1, column).value = `${group.label} (${group.unit})`;
    sheet.mergeCells(1, column, 1, column + subheaders.length - 1);
    subheaders.forEach((header, index) => {
      sheet.getCell(2, column + index).value = header;
    });
    column += subheaders.length;
  }
  for (const group of matrix.groups) {
    const subheaders = trackingGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year);
    sheet.getCell(1, column).value = trackingGroupHeaderLabel(group);
    sheet.mergeCells(1, column, 1, column + subheaders.length - 1);
    subheaders.forEach((header, index) => {
      sheet.getCell(2, column + index).value = header;
    });
    column += subheaders.length;
  }
  sheet.getCell(1, column).value = "Cumplimiento Acuerdo de Conservacion";
  sheet.mergeCells(1, column, 1, column + 1);
  sheet.getCell(2, column).value = "Meta";
  sheet.getCell(2, column + 1).value = "% Cumplimiento";

  let rowNumber = 3;
  for (const row of matrix.rows) {
    const values: (string | number)[] = [
      row.familyCode,
      row.familyName,
      row.documentNumber,
      row.ageYears,
      row.municipalityName,
      row.villageName,
      row.hectares
    ];
    for (const group of matrix.vegetalGroups) {
      const cell = row.vegetalIndicators[group.key];
      if (!cell) {
        values.push(...trackingVegetalVisibleSubheaders(matrix.visibleQuarters, matrix.year).map(() => ""));
        continue;
      }
      values.push(cell.targetQuantity);
      for (const type of ["vegetal_entrega", "vegetal_siembra"] as VegetalQuarterlyType[]) {
        for (const quarter of matrix.visibleQuarters) {
          values.push(Number(cell.values[type]?.[quarter]?.progress_quantity ?? 0));
        }
        values.push(trackingVegetalAccumulated(cell, type));
      }
    }
    for (const group of matrix.groups) {
      const cell = row.activities[group.key];
      if (!cell) {
        values.push(...trackingGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year).map(() => ""));
        continue;
      }
      values.push(cell.targetQuantity);
      for (const type of group.progressTypes) {
        for (const quarter of matrix.visibleQuarters) {
          values.push(Number(cell.values[type]?.[quarter]?.progress_quantity ?? 0));
        }
      }
      values.push(trackingActivityAccumulated(cell));
    }
    values.push(Number(row.agreement?.target_quantity ?? 100));
    values.push(Number(row.agreement?.progress_quantity ?? 0) / 100);
    const excelRow = sheet.addRow(values);
    let activityColumn = baseHeaders.length + 1;
    for (const group of matrix.vegetalGroups) {
      const subheaders = trackingVegetalVisibleSubheaders(matrix.visibleQuarters, matrix.year);
      const cell = row.vegetalIndicators[group.key];
      if (cell) {
        const entregaAccumulated = trackingVegetalAccumulated(cell, "vegetal_entrega");
        const siembraAccumulated = trackingVegetalAccumulated(cell, "vegetal_siembra");
        const entregaColumn = activityColumn + 1 + matrix.visibleQuarters.length;
        const siembraColumn = activityColumn + 1 + matrix.visibleQuarters.length + 1 + matrix.visibleQuarters.length;
        if (cell.targetQuantity > 0 && entregaAccumulated > cell.targetQuantity) {
          const accumulatedCell = excelRow.getCell(entregaColumn);
          accumulatedCell.font = { color: { argb: "FFC00000" }, bold: true };
          accumulatedCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE5E5" } };
        }
        if (cell.targetQuantity > 0 && siembraAccumulated > cell.targetQuantity) {
          const accumulatedCell = excelRow.getCell(siembraColumn);
          accumulatedCell.font = { color: { argb: "FFC00000" }, bold: true };
          accumulatedCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE5E5" } };
        }
      }
      activityColumn += subheaders.length;
    }
    for (const group of matrix.groups) {
      const subheaders = trackingGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year);
      const cell = row.activities[group.key];
      if (cell) {
        const accumulated = trackingActivityAccumulated(cell);
        if (cell.targetQuantity > 0 && accumulated > cell.targetQuantity) {
          const accumulatedCell = excelRow.getCell(activityColumn + subheaders.length - 1);
          accumulatedCell.font = { color: { argb: "FFC00000" }, bold: true };
          accumulatedCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE5E5" } };
        }
      }
      activityColumn += subheaders.length;
    }
    rowNumber += 1;
  }

  const totalsRow = sheet.getRow(rowNumber);
  totalsRow.getCell(2).value = "TOTAL";
  for (let col = 7; col <= sheet.columnCount; col += 1) {
    const letter = sheet.getColumn(col).letter;
    totalsRow.getCell(col).value = { formula: `SUM(${letter}3:${letter}${rowNumber - 1})` };
  }
  styleTrackingWorksheet(sheet);

  const base = {
    addRow: (_values: Array<string | number>) => undefined
  };

  base.addRow(["Codigo familia", "Familia", "Municipio", "Vereda", "Actividad", "Tipo avance", "Año", "Trimestre", "Meta", "Avance", "Cumplimiento"]);
  for (const row of matrix.rows) {
    for (const group of matrix.groups) {
      const cell = row.activities[group.key];
      if (!cell) continue;
      for (const type of group.progressTypes) {
        for (const quarter of matrix.visibleQuarters) {
          base.addRow([
            row.familyCode,
            row.familyName,
            row.municipalityName,
            row.villageName,
            group.activityName,
            trackingProgressTypeLabel(type),
            matrix.year,
            `Q${quarter}`,
            cell.targetQuantity,
            Number(cell.values[type]?.[quarter]?.progress_quantity ?? 0),
            trackingActivityAccumulated(cell)
          ]);
        }
      }
    }
    base.addRow([
      row.familyCode,
      row.familyName,
      row.municipalityName,
      row.villageName,
      "Cumplimiento Acuerdo de Conservacion",
      "% Cumplimiento",
      matrix.year,
      "",
      Number(row.agreement?.target_quantity ?? 100),
      Number(row.agreement?.progress_quantity ?? 0),
      Number(row.agreement?.progress_quantity ?? 0) / 100
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), `herramienta-seguimiento-${matrix.year}.xlsx`);
}

async function exportMaintenanceMatrixExcel(matrix: MaintenanceMatrix) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`MANTENIMIENTO_${matrix.year}`);
  const baseHeaders = ["Codigo Predio", "Familia", "Cedula", "Edad Años", "Municipio", "Vereda", "Hectareas del predio"];
  baseHeaders.forEach((header, index) => {
    const column = index + 1;
    sheet.getCell(1, column).value = header;
    sheet.mergeCells(1, column, 2, column);
  });

  let column = baseHeaders.length + 1;
  for (const group of matrix.groups) {
    const subheaders = maintenanceGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year);
    sheet.getCell(1, column).value = maintenanceGroupHeaderLabel(group);
    sheet.mergeCells(1, column, 1, column + subheaders.length - 1);
    subheaders.forEach((header, index) => {
      sheet.getCell(2, column + index).value = header;
    });
    column += subheaders.length;
  }
  const organicSubheaders = maintenanceOrganicSubheaders(matrix.visibleQuarters, matrix.year);
  sheet.getCell(1, column).value = "Produccion de abonos organicos";
  sheet.mergeCells(1, column, 1, column + organicSubheaders.length - 1);
  organicSubheaders.forEach((header, index) => {
    sheet.getCell(2, column + index).value = header;
  });

  for (const row of matrix.rows) {
    const values: Array<string | number | Date> = [
      row.familyCode,
      row.familyName,
      row.documentNumber,
      row.ageYears,
      row.municipalityName,
      row.villageName,
      row.hectares
    ];
    for (const group of matrix.groups) {
      const cell = row.activities[group.key];
      if (!cell) {
        values.push(...maintenanceGroupVisibleSubheaders(group, matrix.visibleQuarters, matrix.year).map(() => "No aplica"));
        continue;
      }
      values.push(cell.targetQuantity);
      for (const task of group.tasks) {
        values.push(cell.progress[maintenanceProgressKey(task.type, task.number, null)]?.maintenance_date ?? "");
      }
      values.push(maintenanceCycleStatus(cell, group).label);
    }
    for (const organicType of ["abono_liquido", "abono_solido"] as MaintenanceOrganicType[]) {
      for (const quarter of matrix.visibleQuarters) {
        values.push(Number(row.organicProgress[organicType]?.[quarter]?.progress_quantity ?? 0));
      }
      values.push(maintenanceOrganicAccumulated(row, organicType));
    }
    sheet.addRow(values);
  }

  styleTrackingWorksheet(sheet);
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    row.eachCell((cell) => {
      if (cell.value === "Ciclo completado") {
        cell.font = { color: { argb: "FF145F3B" }, bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDFF0E7" } };
      }
      if (cell.value === "Ciclo incompleto") {
        cell.font = { color: { argb: "FFB42318" }, bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE5E5" } };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), `herramienta-mantenimiento-${matrix.year}.xlsx`);
}

function buildIndicatorExcelGroups(rows: IndicatorRow[]) {
  const groups = new Map<string, { key: string; name: string; rows: IndicatorRow[] }>();
  for (const row of rows) {
    const name = row.materialName || row.activityName;
    const key = `${row.activityName}-${name}`;
    const current = groups.get(key) ?? { key, name, rows: [] };
    current.rows.push(row);
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function buildIndicatorFamilyRows(rows: IndicatorRow[]) {
  const families = new Map<string, {
    familyCode: string;
    familyName: string;
    municipalityName: string;
    villageName: string;
    hectares: string;
    groups: Record<string, { target: number; delivered: number; implemented: number }>;
  }>();
  for (const row of rows) {
    const groupKey = `${row.activityName}-${row.materialName || row.activityName}`;
    const current = families.get(row.family_id) ?? {
      familyCode: row.familyCode,
      familyName: row.familyName,
      municipalityName: row.municipalityName,
      villageName: row.villageName,
      hectares: row.hectares,
      groups: {}
    };
    const value = current.groups[groupKey] ?? { target: 0, delivered: 0, implemented: 0 };
    value.target += row.targetQuantity;
    value.delivered += row.deliveredQuantity;
    value.implemented += row.implementedQuantity;
    current.groups[groupKey] = value;
    families.set(row.family_id, current);
  }
  return Array.from(families.values()).sort((left, right) => left.familyName.localeCompare(right.familyName));
}

function stylePlainWorksheetHeader(worksheet: import("exceljs").Worksheet, rowNumber = 1) {
  const header = worksheet.getRow(rowNumber);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  worksheet.views = [{ state: "frozen", ySplit: rowNumber }];
  worksheet.columns.forEach((column) => {
    column.width = Math.max(column.width ?? 13, 13);
  });
}

function styleIndicatorDetailSheet(worksheet: import("exceljs").Worksheet, groupCount: number) {
  const lastColumn = 5 + groupCount * 3;
  [5, 6].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  worksheet.views = [{ state: "frozen", xSplit: 5, ySplit: 6 }];
  [10.6, 26.5, 10.75, 33.6, 15.25].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  for (let column = 6; column <= lastColumn; column += 1) {
    worksheet.getColumn(column).width = column % 3 === 0 ? 7.75 : 13;
  }
}

function styleIndicatorSummarySheet(worksheet: import("exceljs").Worksheet, groupCount: number) {
  const lastColumn = groupCount * 3;
  [1, 2].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  for (let column = 1; column <= lastColumn; column += 1) {
    worksheet.getColumn(column).width = 13;
  }
}

function styleTrackingWorksheet(worksheet: import("exceljs").Worksheet) {
  [1, 2].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  worksheet.views = [{ state: "frozen", xSplit: 7, ySplit: 2 }];
  [12, 28, 14, 10, 16, 28, 16].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  for (let column = 8; column <= worksheet.columnCount; column += 1) {
    worksheet.getColumn(column).width = 13;
  }
  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    worksheet.getColumn(column).alignment = {
      vertical: "middle",
      horizontal: column <= 7 ? "left" : "center",
      wrapText: true
    };
    const header = String(worksheet.getCell(2, column).value ?? worksheet.getCell(1, column).value ?? "");
    if (header.includes("%")) worksheet.getColumn(column).numFmt = "0.00%";
  }
}

function styleWorksheetHeader(worksheet: import("exceljs").Worksheet) {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4D35" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.columns.forEach((column) => {
    column.width = Math.max(column.width ?? 14, 14);
  });
}

function exportConsolidatedCsv(rows: ConsolidatedMaterialNeed[]) {
  const headers = ["proyecto", "material", "unidad", "cantidad_aprobada", "cantidad_entregada", "cantidad_pendiente", "valor_pendiente"];
  const body = rows.map((row) => [
    row.projectName,
    row.materialName,
    row.unit,
    formatNumber(row.requiredQuantity),
    formatNumber(row.deliveredQuantity),
    formatNumber(row.pendingQuantity),
    String(Math.round(row.pendingQuantity * row.unitPrice))
  ]);
  const csv = [headers, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "consolidado-materiales.csv");
}

function buildDeliveryActContext(data: {
  act: DeliveryAct;
  delivery: MaterialDelivery;
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  plans: OperationalPlan[];
  activities: Activity[];
  materialDeliveryItems: MaterialDeliveryItem[];
  technician?: Profile | null;
  projectLogos: Record<string, ProjectLogoConfig[]>;
}): DeliveryActContext {
  const family = data.families.find((item) => item.id === data.delivery.family_id);
  return {
    act: data.act,
    delivery: data.delivery,
    items: data.materialDeliveryItems.filter((item) => item.material_delivery_id === data.delivery.id && !item.is_deleted),
    project: data.projects.find((item) => item.id === data.delivery.project_id),
    family,
    municipality: data.municipalities.find((item) => item.id === family?.municipality_id),
    village: data.villages.find((item) => item.id === family?.village_id),
    plan: data.plans.find((item) => item.id === data.delivery.operational_plan_id),
    technician: data.technician,
    activityById: new Map(data.activities.map((item) => [item.id, item])),
    projectLogos: data.projectLogos
  };
}

function buildDeliveryActExportRecords(data: {
  filteredNeeds: ApprovedMaterialNeed[];
  materialDeliveries: MaterialDelivery[];
  materialDeliveryItems: MaterialDeliveryItem[];
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  plans: OperationalPlan[];
  filters: ProcurementFilters;
  deliveryDate: string;
  actNumberPrefix: string;
}): DeliveryActExportRecord[] {
  const needsByFamilyPlan = new Map<string, ApprovedMaterialNeed[]>();
  for (const need of data.filteredNeeds) {
    const groupKey = `${need.project_id}:${need.family_id}:${need.operational_plan_id}`;
    const rows = needsByFamilyPlan.get(groupKey) ?? [];
    rows.push(need);
    needsByFamilyPlan.set(groupKey, rows);
  }
  const prefix = data.actNumberPrefix.trim() || "Entrega";
  const records: DeliveryActExportRecord[] = [];
  const nextSequenceByFamilyProject = new Map<string, number>();
  Array.from(needsByFamilyPlan.values())
    .sort((leftNeeds, rightNeeds) => {
      const leftFamily = data.families.find((item) => item.id === leftNeeds[0]?.family_id);
      const rightFamily = data.families.find((item) => item.id === rightNeeds[0]?.family_id);
      const leftPlan = data.plans.find((item) => item.id === leftNeeds[0]?.operational_plan_id);
      const rightPlan = data.plans.find((item) => item.id === rightNeeds[0]?.operational_plan_id);
      return `${leftFamily?.family_code ?? ""}-${leftPlan?.plan_date ?? ""}-${leftPlan?.version ?? 0}-${leftPlan?.id ?? ""}`
        .localeCompare(`${rightFamily?.family_code ?? ""}-${rightPlan?.plan_date ?? ""}-${rightPlan?.version ?? 0}-${rightPlan?.id ?? ""}`);
    })
    .forEach((needs) => {
      const familyId = needs[0]?.family_id;
      const projectId = needs[0]?.project_id;
      const planId = needs[0]?.operational_plan_id;
      const family = data.families.find((item) => item.id === familyId);
      const project = data.projects.find((item) => item.id === projectId);
      if (!family || !project) return;
      const municipality = data.municipalities.find((item) => item.id === family.municipality_id);
      const village = data.villages.find((item) => item.id === family.village_id);
      const plan = data.plans.find((item) => item.id === planId);
      const deliveredItems = data.materialDeliveryItems.filter((item) =>
        !item.is_deleted
        && item.family_id === familyId
        && item.project_id === projectId
        && item.operational_plan_id === planId
        && (!data.filters.project_id || item.project_id === data.filters.project_id)
        && needs.some((need) => need.plan_project_material_id === item.plan_project_material_id)
      );
      const items = deliveredItems.length > 0
        ? deliveredItems
        : needs.map((need, itemIndex) => approvedNeedToDeliveryItem(need, itemIndex));
      if (items.length === 0) return;
      const familyProjectKey = `${project.id}:${family.id}`;
      const currentSequence = nextSequenceByFamilyProject.get(familyProjectKey)
        ?? existingDeliveryCountForFamilyProject(project.id, family.id, data.materialDeliveries, data.materialDeliveryItems);
      const deliveryNumber = deliveredItems.length > 0
        ? deliveryNumberForFamilyRecord(family.id, deliveredItems, data.materialDeliveries, data.materialDeliveryItems)
        : currentSequence + 1;
      nextSequenceByFamilyProject.set(familyProjectKey, Math.max(currentSequence, deliveryNumber));
      records.push({
        key: `${project.id}:${family.id}:${plan?.id ?? "sin-plan"}`,
        project,
        family,
        municipality,
        village,
        plan,
        items,
        sourceLabel: deliveredItems.length > 0 ? "Materiales entregados" : "Materiales aprobados / a entregar",
        deliveryDate: data.deliveryDate,
        actNumber: `${prefix} ${deliveryNumber}`
      });
    });
  return records;
}

function deliveryNumberForFamilyRecord(
  familyId: string,
  deliveredItems: MaterialDeliveryItem[],
  deliveries: MaterialDelivery[],
  allItems: MaterialDeliveryItem[]
) {
  const deliveredIds = Array.from(new Set(deliveredItems
    .map((item) => item.material_delivery_id)
    .filter(Boolean)));
  if (deliveredIds.length === 0) return 1;
  const sequences = deliveredIds
    .map((deliveryId) => deliveries.find((delivery) => delivery.id === deliveryId))
    .filter((delivery): delivery is MaterialDelivery => Boolean(delivery))
    .map((delivery) => deliverySequenceForFamilyDelivery(delivery, deliveries, allItems));
  return Math.max(1, ...sequences);
}

function deliverySequenceForFamilyDelivery(delivery: MaterialDelivery, deliveries: MaterialDelivery[], items: MaterialDeliveryItem[]) {
  const deliveryIdsWithItems = new Set(items
    .filter((item) =>
      !item.is_deleted
      && item.project_id === delivery.project_id
      && item.family_id === delivery.family_id
    )
    .map((item) => item.material_delivery_id));
  const familyDeliveries = deliveries
    .filter((item) =>
      !item.is_deleted
      && item.project_id === delivery.project_id
      && item.family_id === delivery.family_id
      && deliveryIdsWithItems.has(item.id)
    )
    .sort((left, right) =>
      `${left.delivery_date}-${left.id}`.localeCompare(`${right.delivery_date}-${right.id}`)
    );
  const index = familyDeliveries.findIndex((item) => item.id === delivery.id);
  return index >= 0 ? index + 1 : Math.max(1, familyDeliveries.length + 1);
}

function existingDeliveryCountForFamilyProject(
  projectId: string,
  familyId: string,
  deliveries: MaterialDelivery[],
  items: MaterialDeliveryItem[]
) {
  const deliveryIdsWithItems = new Set(items
    .filter((item) =>
      !item.is_deleted
      && item.project_id === projectId
      && item.family_id === familyId
    )
    .map((item) => item.material_delivery_id));
  return deliveries.filter((delivery) =>
    !delivery.is_deleted
    && delivery.project_id === projectId
    && delivery.family_id === familyId
    && deliveryIdsWithItems.has(delivery.id)
  ).length;
}

function deliveryPlanLabel(plan?: OperationalPlan) {
  if (!plan) return "Plan operativo";
  return `Plan v${plan.version} - ${plan.plan_date}`;
}

function approvedNeedToDeliveryItem(need: ApprovedMaterialNeed, index: number): MaterialDeliveryItem {
  return {
    id: `approved-${need.plan_project_material_id}-${index}`,
    material_delivery_id: "",
    project_id: need.project_id,
    family_id: need.family_id,
    operational_plan_id: need.operational_plan_id,
    plan_activity_id: need.plan_activity_id,
    activity_id: need.activity_id,
    plan_project_material_id: need.plan_project_material_id,
    material_id: need.material_id,
    provisional_material_id: need.provisional_material_id,
    material_name: need.materialName,
    unit: need.unit,
    approved_quantity: need.approvedQuantity,
    delivered_quantity: need.approvedQuantity,
    unit_price: need.unitPrice,
    total_value: need.totalValue,
    observations: "Material aprobado / a entregar",
    admin_override: false,
    override_authorized_by: null,
    is_deleted: false
  };
}

function buildDeliveryActContextFromRecord(data: {
  record: DeliveryActExportRecord;
  activities: Activity[];
  technician: Profile | null;
  projectLogos: Record<string, ProjectLogoConfig[]>;
  introText: string;
  finalText: string;
  technicianName: string;
  technicianDocument: string;
}): DeliveryActContext {
  return {
    act: {
      id: data.record.key,
      project_id: data.record.project.id,
      family_id: data.record.family.id,
      operational_plan_id: data.record.plan?.id ?? "",
      material_delivery_id: "",
      act_number: data.record.actNumber,
      status: "generated",
      generated_at: new Date().toISOString(),
      generated_by: data.technician?.id ?? null,
      pdf_path: null,
      word_path: null,
      observations: data.record.sourceLabel,
      is_deleted: false
    },
    delivery: {
      id: data.record.key,
      project_id: data.record.project.id,
      family_id: data.record.family.id,
      operational_plan_id: data.record.plan?.id ?? "",
      delivery_date: data.record.deliveryDate,
      status: "entregado_parcial",
      observations: data.record.sourceLabel,
      registered_by: data.technician?.id ?? null,
      is_deleted: false
    },
    items: data.record.items,
    project: data.record.project,
    family: data.record.family,
    municipality: data.record.municipality,
    village: data.record.village,
    plan: data.record.plan,
    technician: data.technician,
    activityById: new Map(data.activities.map((item) => [item.id, item])),
    projectLogos: data.projectLogos,
    introText: data.introText,
    finalText: data.finalText,
    technicianName: data.technicianName,
    technicianDocument: data.technicianDocument
  };
}

async function buildDeliveryActsExcel(records: DeliveryActExportRecord[], technicianName: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Restauracion Admin";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Actas");
  sheet.addRow(["Proyecto", "Departamento", "Municipio", "Vereda", "Codigo familia", "Familia", "Fecha entrega", "Entrega No.", "Material", "Cantidad", "Unidad", "Tecnico", "Observaciones"]);
  for (const record of records) {
    for (const item of record.items) {
      sheet.addRow([
        record.project.name,
        record.municipality?.department ?? "",
        record.municipality?.name ?? "",
        record.village?.name ?? "",
        record.family.family_code,
        record.family.representative_name,
        record.deliveryDate,
        record.actNumber,
        item.material_name,
        Number(item.delivered_quantity),
        item.unit,
        technicianName,
        item.observations ?? record.sourceLabel
      ]);
    }
  }
  stylePlainWorksheetHeader(sheet);
  [1, 2, 3, 4, 6, 9, 12, 13].forEach((column) => {
    sheet.getColumn(column).width = column === 9 ? 42 : 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

async function buildDeliveryActPdf(context: DeliveryActContext) {
  const doc = createPdfDocument();
  await drawDeliveryActPdf(doc, context);
  return doc.finish();
}

async function buildDeliveryActsPdf(contexts: DeliveryActContext[]) {
  const doc = createPdfDocument();
  for (const [index, context] of contexts.entries()) {
    if (index > 0) doc.addPage(false);
    await drawDeliveryActPdf(doc, context);
  }
  return doc.finish();
}

async function drawDeliveryActPdf(doc: PdfDocumentBuilder, context: DeliveryActContext) {
  const logos = context.projectLogos[context.delivery.project_id] ?? [];
  doc.setPageChrome({
    topLogos: await preparePdfLogos(logos.filter((logo) => !isBottomLogoPosition(logo.position)), "header"),
    bottomLogos: await preparePdfLogos(logos.filter((logo) => isBottomLogoPosition(logo.position)), "footer")
  });
  let y = doc.contentTop;
  doc.text("ACTA DE ENTREGA DE INSUMOS Y MATERIALES", doc.margin, y, 16, true, ForestPdf);
  y += 24;
  y = drawMetaPdf(doc, [
    ["Entrega No.", context.act.act_number],
    ["Representante familia", context.family?.representative_name ?? "N/A"],
    ["Proyecto", context.project?.name ?? "N/A"],
    ["Departamento", context.municipality?.department ?? "N/A"],
    ["Municipio", context.municipality?.name ?? "N/A"],
    ["Vereda", context.village?.name ?? "N/A"],
    ["Codigo predial / familia", context.family?.family_code ?? "N/A"],
    ["Fecha de entrega", context.delivery.delivery_date]
  ], y);
  doc.line(doc.margin, y + 6, doc.pageWidth - doc.margin, y + 6, ForestPdf, 2);
  y += 24;
  y = drawWrappedPdfText(doc, context.introText ?? DefaultDeliveryActIntroText, doc.margin, y, doc.pageWidth - doc.margin * 2, 9, true);
  y += 12;
  y = drawPdfTable(doc, y, ["#", "Descripcion del articulo", "Unidad", "Cantidad"], context.items.map((item, index) => [
    String(index + 1),
    item.material_name,
    item.unit,
    formatNumber(Number(item.delivered_quantity))
  ]), [40, 290, 95, 95]);
  y = doc.ensureSpace(y + 10, 100);
  y = drawWrappedPdfText(doc, context.finalText ?? DefaultDeliveryActFinalText, doc.margin, y, doc.pageWidth - doc.margin * 2, 9, true);
  y += 54;
  const leftSignatureX = doc.margin;
  const rightSignatureX = doc.pageWidth - doc.margin - 190;
  const signatureWidth = 190;
  doc.line(leftSignatureX, y, leftSignatureX + signatureWidth, y, "111111", 0.8);
  doc.line(rightSignatureX, y, rightSignatureX + signatureWidth, y, "111111", 0.8);
  y += 14;
  drawCenteredPdfText(doc, "Representante familia", leftSignatureX, y, signatureWidth, 9, true);
  drawCenteredPdfText(doc, "Tecnico proyecto", rightSignatureX, y, signatureWidth, 9, true);
  y += 14;
  drawCenteredPdfText(doc, `Nombre: ${context.family?.representative_name ?? "________________"}`, leftSignatureX, y, signatureWidth, 8);
  drawCenteredPdfText(doc, `Nombre: ${context.technicianName || context.technician?.full_name || "________________"}`, rightSignatureX, y, signatureWidth, 8);
  y += 12;
  drawCenteredPdfText(doc, `Cedula: ${context.family?.document_number ?? "________________"}`, leftSignatureX, y, signatureWidth, 8);
  drawCenteredPdfText(doc, `Cedula: ${context.technicianDocument || context.technician?.document_number || "________________"}`, rightSignatureX, y, signatureWidth, 8);
}

async function buildDeliveryActDocx(context: DeliveryActContext) {
  return buildDeliveryActsDocx([context]);
}

async function buildDeliveryActsDocx(contexts: DeliveryActContext[]) {
  const document = new WordDocument({
    title: "Actas de entrega",
    creator: "Restauracion Admin",
    sections: contexts.map((context) => buildDeliveryActDocxSection(context))
  });
  return Packer.toBlob(document);
}

function buildDeliveryActDocxSection(context: DeliveryActContext) {
  const logos = context.projectLogos[context.delivery.project_id] ?? [];
  return {
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT, width: 11906, height: 16838 },
        margin: { top: 1500, right: 648, bottom: 1220, left: 648, header: 260, footer: 260 }
      }
    },
    headers: {
      default: new Header({ children: [buildDocxLogoParagraph(logos.filter((logo) => !isBottomLogoPosition(logo.position)), "header", "right")] })
    },
    footers: {
      default: new Footer({ children: [buildDocxLogoParagraph(logos.filter((logo) => isBottomLogoPosition(logo.position)), "footer", "center")] })
    },
    children: [
        docxParagraph("ACTA DE ENTREGA DE INSUMOS Y MATERIALES", { bold: true, size: 30, color: ForestPdf, spacingAfter: 120 }),
        buildDocxMetaTable([
          ["Entrega No.", context.act.act_number],
          ["Representante familia", context.family?.representative_name ?? "N/A"],
          ["Proyecto", context.project?.name ?? "N/A"],
          ["Departamento", context.municipality?.department ?? "N/A"],
          ["Municipio", context.municipality?.name ?? "N/A"],
          ["Vereda", context.village?.name ?? "N/A"],
          ["Codigo predial / familia", context.family?.family_code ?? "N/A"],
          ["Fecha de entrega", context.delivery.delivery_date]
        ]),
        docxSeparator(),
        docxParagraph(context.introText ?? DefaultDeliveryActIntroText, {
          alignment: AlignmentType.JUSTIFIED,
          size: 18,
          spacingAfter: 140
        }),
        buildDocxDeliveryItemsTable(context.items),
        docxParagraph(context.finalText ?? DefaultDeliveryActFinalText, { alignment: AlignmentType.JUSTIFIED, size: 18, spacingBefore: 160, spacingAfter: 520 }),
        buildDocxSignatureTable(context)
      ]
  };
}

function buildDocxDeliveryItemsTable(items: MaterialDeliveryItem[]) {
  const widths = [600, 6200, 1600, 1600];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    borders: docxTableBorders(),
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["#", "DESCRIPCION DEL ARTICULO", "UNIDAD", "CANTIDAD"].map((header, index) =>
          docxCell(header, { bold: true, fill: "F3F6F1", alignment: AlignmentType.CENTER, width: widths[index] })
        )
      }),
      ...items.map((item, index) => new TableRow({
        children: [
          docxCell(String(index + 1), { alignment: AlignmentType.CENTER, width: widths[0] }),
          docxCell(item.material_name, { alignment: AlignmentType.CENTER, width: widths[1] }),
          docxCell(item.unit, { alignment: AlignmentType.CENTER, width: widths[2] }),
          docxCell(formatNumber(Number(item.delivered_quantity)), { alignment: AlignmentType.CENTER, width: widths[3] })
        ]
      }))
    ]
  });
}

function buildDocxSignatureTable(context: DeliveryActContext) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "111111" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: docxNoBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: border, bottom: docxNoBorder(), left: docxNoBorder(), right: docxNoBorder() },
            children: [
              docxParagraph("Representante familia", { bold: true, alignment: AlignmentType.CENTER, spacingAfter: 60 }),
              docxParagraph(`Nombre: ${context.family?.representative_name ?? "________________"}`, { alignment: AlignmentType.CENTER, spacingAfter: 20 }),
              docxParagraph(`Cedula: ${context.family?.document_number ?? "________________"}`, { alignment: AlignmentType.CENTER, spacingAfter: 20 }),
              docxParagraph("Firma:", { alignment: AlignmentType.CENTER, spacingAfter: 0 })
            ]
          }),
          new TableCell({
            borders: { top: border, bottom: docxNoBorder(), left: docxNoBorder(), right: docxNoBorder() },
            children: [
              docxParagraph("Tecnico proyecto", { bold: true, alignment: AlignmentType.CENTER, spacingAfter: 60 }),
              docxParagraph(`Nombre: ${context.technicianName || context.technician?.full_name || "________________"}`, { alignment: AlignmentType.CENTER, spacingAfter: 20 }),
              docxParagraph(`Cedula: ${context.technicianDocument || context.technician?.document_number || "________________"}`, { alignment: AlignmentType.CENTER, spacingAfter: 20 }),
              docxParagraph("Firma:", { alignment: AlignmentType.CENTER, spacingAfter: 0 })
            ]
          })
        ]
      })
    ]
  });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

function vegetalIndicatorGroupLabel(value?: string | null) {
  const labels: Record<string, string> = {
    colinos: "Colinos (platano y pina)",
    cacao: "Cacao",
    frutales: "Frutales",
    forestales_nativos: "Forestales nativos",
    otro: "Otro vegetal sin indicador"
  };
  return value ? labels[value] ?? value : "No aplica";
}

function normalizeVegetalIndicatorGroup(value?: string | null) {
  const normalized = normalizeHeader(value ?? "").replaceAll("_", " ");
  if (!normalized) return null;
  if (normalized.includes("platano") || normalized.includes("pina") || normalized.includes("colino")) return "colinos";
  if (normalized.includes("cacao")) return "cacao";
  if (normalized.includes("frutal") || normalized.includes("frutales")) return "frutales";
  if (normalized.includes("forestal") || normalized.includes("nativo")) return "forestales_nativos";
  if (normalized.includes("otro")) return "otro";
  return null;
}

function normalizeEtecBlock(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Otros";
  const normalized = normalizeHeader(trimmed);
  const defaultMatch = ETEC_DEFAULT_BLOCKS.find((block) => normalizeHeader(block) === normalized);
  return defaultMatch ?? trimmed;
}

function defaultEtecBlockForCategory(category?: string | null) {
  const normalized = normalizeHeader(category ?? "");
  if (normalized.includes("abono") || normalized.includes("fertiliz")) return "Abonos y Fertilizantes";
  if (normalized.includes("vegetal") || normalized.includes("plant") || normalized.includes("arbol") || normalized.includes("arb")) return "Material vegetal";
  if (normalized.includes("ferreter")) return "Ferreteria";
  return "Otros";
}

function procurementStatusLabel(status: ProcurementStatus) {
  const labels: Record<ProcurementStatus, string> = {
    pendiente_compra: "Pendiente compra",
    en_proceso: "En proceso",
    comprado: "Comprado",
    entregado_parcial: "Entregado parcial",
    entregado_total: "Entregado total",
    cancelado: "Cancelado"
  };
  return labels[status] ?? status;
}

function deliveryStatusLabel(status: MaterialDelivery["status"]) {
  const labels: Record<MaterialDelivery["status"], string> = {
    entregado_parcial: "Entregado parcial",
    entregado_total: "Entregado total",
    cancelado: "Cancelado"
  };
  return labels[status] ?? status;
}

function implementationStatusLabel(status: ImplementationProgressStatus) {
  const labels: Record<ImplementationProgressStatus, string> = {
    pending: "Pendiente",
    in_progress: "En proceso",
    completed: "Completado",
    overdue: "Atrasado",
    cancelled: "Cancelado"
  };
  return labels[status] ?? status;
}

type PlanExportContext = {
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
  activities: Activity[];
  materials: Material[];
  planActivities: PlanActivity[];
  planMaterials: PlanProjectMaterial[];
  planCounterparts: PlanFamilyCounterpart[];
  provisionalMaterials: ProvisionalMaterial[];
  projectLogos: Record<string, ProjectLogoConfig[]>;
};

async function exportPlansAsPdf(plans: OperationalPlan[], context: PlanExportContext) {
  try {
    const refreshedContext = await refreshPlanExportContext(plans, context);
    const pdfBytes = await buildPlansPdf(plans, refreshedContext);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileName(plans, refreshedContext)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    window.alert(`No fue posible generar el PDF: ${getErrorMessage(error)}`);
  }
}

async function exportPlansAsWord(plans: OperationalPlan[], context: PlanExportContext) {
  const refreshedContext = await refreshPlanExportContext(plans, context);
  const blob = await buildPlansDocx(plans, refreshedContext);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${exportFileName(plans, refreshedContext)}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function refreshPlanExportContext(plans: OperationalPlan[], context: PlanExportContext): Promise<PlanExportContext> {
  const planIds = plans.map((plan) => plan.id);
  if (planIds.length === 0) return context;

  const activitiesResult = await supabase
    .from("plan_activities")
    .select("*")
    .in("plan_id", planIds)
    .eq("is_deleted", false);
  if (activitiesResult.error) throw activitiesResult.error;

  const refreshedActivities = (activitiesResult.data ?? []) as PlanActivity[];
  const activityIds = refreshedActivities.map((activity) => activity.id);
  const [materialsResult, counterpartsResult] = activityIds.length > 0
    ? await Promise.all([
        supabase.from("plan_project_materials").select("*").in("plan_activity_id", activityIds).eq("is_deleted", false),
        supabase.from("plan_family_counterparts").select("*").in("plan_activity_id", activityIds).eq("is_deleted", false)
      ])
    : [
        { data: [], error: null },
        { data: [], error: null }
      ];

  if (materialsResult.error) throw materialsResult.error;
  if (counterpartsResult.error) throw counterpartsResult.error;

  const refreshedMaterials = (materialsResult.data ?? []) as PlanProjectMaterial[];
  const refreshedCounterparts = (counterpartsResult.data ?? []) as PlanFamilyCounterpart[];
  const refreshedActivityIds = new Set(activityIds);
  const refreshedPlanIds = new Set(planIds);

  return {
    ...context,
    planActivities: [
      ...context.planActivities.filter((activity) => !refreshedPlanIds.has(activity.plan_id)),
      ...refreshedActivities
    ],
    planMaterials: [
      ...context.planMaterials.filter((material) => !refreshedActivityIds.has(material.plan_activity_id)),
      ...refreshedMaterials
    ],
    planCounterparts: [
      ...context.planCounterparts.filter((counterpart) => !refreshedActivityIds.has(counterpart.plan_activity_id)),
      ...refreshedCounterparts
    ]
  };
}

async function buildPlansDocx(plans: OperationalPlan[], context: PlanExportContext) {
  const document = new WordDocument({
    title: "Planes Operativos",
    creator: "Restauracion Admin",
    sections: plans.map((plan) => buildPlanDocxSection(plan, context))
  });
  return Packer.toBlob(document);
}

function buildPlanDocxSection(plan: OperationalPlan, context: PlanExportContext) {
  const logos = context.projectLogos[plan.project_id] ?? [];
  const topLogos = logos.filter((logo) => !isBottomLogoPosition(logo.position));
  const bottomLogos = logos.filter((logo) => isBottomLogoPosition(logo.position));
  return {
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT, width: 11906, height: 16838 },
        margin: { top: 1500, right: 648, bottom: 1220, left: 648, header: 260, footer: 260 }
      }
    },
    headers: {
      default: new Header({ children: [buildDocxLogoParagraph(topLogos, "header", "right")] })
    },
    footers: {
      default: new Footer({ children: [buildDocxLogoParagraph(bottomLogos, "footer", "center")] })
    },
    children: buildPlanDocxChildren(plan, context)
  };
}

function buildPlanDocxChildren(plan: OperationalPlan, context: PlanExportContext) {
  const project = context.projects.find((item) => item.id === plan.project_id);
  const family = context.families.find((item) => item.id === plan.family_id);
  const municipality = context.municipalities.find((item) => item.id === family?.municipality_id);
  const village = context.villages.find((item) => item.id === family?.village_id);
  const realActivitiesForPlan = context.planActivities.filter((item) => item.plan_id === plan.id);
  const activitiesForPlan = realActivitiesForPlan.length > 0 ? realActivitiesForPlan : examplePlanActivities(plan.id);
  const familyTotal = activitiesForPlan.reduce((sum, activity) =>
    sum + familyCounterpartsForExport(activity, context)
      .reduce((partial, item) => partial + item.quantity * item.estimated_unit_value, 0), 0);
  const projectTotal = activitiesForPlan.reduce((sum, activity) =>
    sum + projectMaterialsForExport(activity, context)
      .reduce((partial, item) => partial + item.quantity * item.quoted_unit_price, 0), 0);
  const children: Array<Paragraph | Table> = [
    docxParagraph("Planes Operativos", { bold: true, size: 36, color: ForestPdf, spacingAfter: 120 }),
    buildDocxMetaTable([
      ["Proyecto", project?.name ?? "Sin proyecto"],
      ["Codigo familia", family?.family_code ?? "N/A"],
      ["Representante", family?.representative_name ?? "N/A"],
      ["Documento", family?.document_number ?? "N/A"],
      ["Municipio", municipality?.name ?? "N/A"],
      ["Vereda", village?.name ?? "N/A"]
    ]),
    docxSeparator()
  ];

  if (realActivitiesForPlan.length === 0) {
    children.push(docxParagraph("Plan sin actividades registradas. Se muestran actividades de ejemplo para previsualizar el formato.", {
      color: "555555",
      size: 18,
      spacingAfter: 120
    }));
  }

  for (const [activityIndex, activity] of activitiesForPlan.entries()) {
    children.push(...buildActivityDocx(activity, activityIndex, context));
  }

  children.push(buildDocxSummaryTable([
    ["Subtotal aporte de la familia", formatExportMoney(familyTotal)],
    ["Subtotal aporte del proyecto", formatExportMoney(projectTotal)],
    ["Total general", formatExportMoney(familyTotal + projectTotal)]
  ]));
  return children;
}

function buildActivityDocx(activity: PlanActivity, index: number, context: PlanExportContext) {
  const catalogActivity = context.activities.find((item) => item.id === activity.activity_id);
  const projectMaterials = projectMaterialsForExport(activity, context);
  const familyCounterparts = familyCounterpartsForExport(activity, context);
  const familySubtotal = familyCounterparts.reduce((sum, item) => sum + item.quantity * item.estimated_unit_value, 0);
  const projectSubtotal = projectMaterials.reduce((sum, item) => {
    const official = item.material_id ? context.materials.find((material) => material.id === item.material_id) : null;
    return sum + item.quantity * (official?.quoted_unit_price ?? item.quoted_unit_price);
  }, 0);
  const familyRows = familyCounterparts.length > 0
    ? familyCounterparts.map((item) => [
        counterpartExportName(item),
        formatQuantity(item.quantity, item.unit),
        formatExportMoney(item.estimated_unit_value),
        formatExportMoney(item.quantity * item.estimated_unit_value)
      ])
    : [["Sin aportes de la familia.", "", "", ""]];
  const projectRows = projectMaterials.length > 0
    ? projectMaterials.map((item) => {
        const official = item.material_id ? context.materials.find((material) => material.id === item.material_id) : null;
        const provisional = item.provisional_material_id
          ? context.provisionalMaterials.find((material) => material.id === item.provisional_material_id)
          : null;
        const price = official?.quoted_unit_price ?? item.quoted_unit_price;
        return [
          `${official?.name ?? provisional?.provisional_name ?? item.observations ?? ""}${provisional?.status === "pending" ? " (pendiente)" : ""}`,
          formatQuantity(item.quantity, official?.unit ?? item.unit),
          formatExportMoney(price),
          formatExportMoney(item.quantity * price)
        ];
      })
    : [["Sin materiales del proyecto.", "", "", ""]];

  return [
    docxParagraph(`Actividad ${index + 1}: ${catalogActivity?.name ?? exampleActivityName(activity)}`, {
      bold: true,
      size: 24,
      color: ForestPdf,
      spacingBefore: 120,
      spacingAfter: 40
    }),
    docxParagraph(`Linea base: ${activity.baseline ?? "N/A"} | Meta: ${activity.target ?? "N/A"} | Unidad: ${activity.unit}`, {
      size: 18,
      spacingAfter: 80
    }),
    buildDocxExportTable("APORTE DE LA FAMILIA", [
      ...familyRows,
      ["SUBTOTAL FAMILIA", "", "", formatExportMoney(familySubtotal)]
    ]),
    buildDocxExportTable("APORTE DEL PROYECTO", [
      ...projectRows,
      ["SUBTOTAL PROYECTO", "", "", formatExportMoney(projectSubtotal)]
    ])
  ];
}

function buildDocxLogoParagraph(logos: ProjectLogoConfig[], placement: "header" | "footer", alignment: "left" | "center" | "right") {
  const imageRuns = logos
    .filter((logo) => logoAlignment(logo.position) === alignment)
    .map((logo) => docxImageRun(logo, placement));
  return new Paragraph({
    alignment: docxAlignment(alignment),
    spacing: { before: 0, after: 0 },
    children: imageRuns.length > 0 ? imageRuns : [new TextRun("")]
  });
}

function docxImageRun(logo: ProjectLogoConfig, placement: "header" | "footer") {
  const dimensions = logoDocumentDimensions(logo, placement);
  const image = dataUrlToImageBytes(logo.dataUrl);
  return new ImageRun({
    data: image.bytes,
    type: image.type,
    transformation: {
      width: Math.round(dimensions.width * 4 / 3),
      height: Math.round(dimensions.height * 4 / 3)
    },
    altText: { title: logo.name, description: logo.name, name: logo.name }
  });
}

function buildDocxMetaTable(rows: [string, string][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [10610],
    borders: docxNoBorders(),
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          margins: docxCellMargins(35),
          borders: {
            top: docxNoBorder(),
            left: docxNoBorder(),
            right: docxNoBorder(),
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" }
          },
          children: [docxParagraph(`${label}: ${value}`, { bold: true, size: 18, spacingAfter: 0 })]
        })
      ]
    }))
  });
}

function buildDocxExportTable(groupTitle: string, rows: string[][]) {
  const widths = [5200, 1600, 1800, 2010];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    borders: docxTableBorders(),
    margins: docxCellMargins(70),
    rows: [
      new TableRow({
        cantSplit: true,
        tableHeader: true,
        children: [
          docxCell(groupTitle, { columnSpan: 4, bold: true, fill: "FFFFFF", alignment: AlignmentType.CENTER })
        ]
      }),
      new TableRow({
        cantSplit: true,
        tableHeader: true,
        children: ["ARTICULO", "CANTIDAD", "VALOR UNI", "VALOR TOTAL"].map((header, index) =>
          docxCell(header, { bold: true, fill: "F3F6F1", alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, width: widths[index] })
        )
      }),
      ...rows.map((row, rowIndex) => new TableRow({
        cantSplit: false,
        children: row.map((cell, index) => docxCell(cell, {
          bold: rowIndex === rows.length - 1,
          fill: rowIndex === rows.length - 1 ? "F8F8F8" : undefined,
          alignment: index === 0 ? AlignmentType.LEFT : index >= 2 ? AlignmentType.RIGHT : AlignmentType.CENTER,
          width: widths[index]
        }))
      }))
    ]
  });
}

function buildDocxSummaryTable(rows: [string, string][]) {
  const widths = [4600, 2200];
  return new Table({
    width: { size: 6800, type: WidthType.DXA },
    alignment: AlignmentType.RIGHT,
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    borders: docxTableBorders(),
    margins: docxCellMargins(70),
    rows: rows.map(([label, value], index) => new TableRow({
      cantSplit: true,
      children: [
        docxCell(label, { bold: true, fill: index === rows.length - 1 ? "F8F8F8" : undefined, width: widths[0] }),
        docxCell(value, { bold: index === rows.length - 1, alignment: AlignmentType.RIGHT, fill: index === rows.length - 1 ? "F8F8F8" : undefined, width: widths[1] })
      ]
    }))
  });
}

function docxCell(text: string, options: {
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  bold?: boolean;
  columnSpan?: number;
  fill?: string;
  width?: number;
} = {}) {
  return new TableCell({
    columnSpan: options.columnSpan,
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill, color: "auto" } : undefined,
    margins: docxCellMargins(70),
    children: [docxParagraph(text, {
      bold: options.bold,
      size: 16,
      alignment: options.alignment,
      spacingAfter: 0
    })]
  });
}

function docxParagraph(text: string, options: {
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  bold?: boolean;
  color?: string;
  size?: number;
  spacingAfter?: number;
  spacingBefore?: number;
} = {}) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { before: options.spacingBefore ?? 0, after: options.spacingAfter ?? 0 },
    children: [
      new TextRun({
        text: pdfText(text),
        bold: options.bold,
        color: options.color ?? "111111",
        font: "Arial",
        size: options.size ?? 18
      })
    ]
  });
}

function docxSeparator() {
  return new Paragraph({
    spacing: { before: 70, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, color: ForestPdf, size: 18 } },
    children: [new TextRun("")]
  });
}

function docxCellMargins(value: number) {
  return { top: value, bottom: value, left: value, right: value };
}

function docxTableBorders() {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "222222" };
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

function docxNoBorder() {
  return { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
}

function docxNoBorders() {
  const border = docxNoBorder();
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

function docxAlignment(alignment: "left" | "center" | "right") {
  if (alignment === "center") return AlignmentType.CENTER;
  if (alignment === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function dataUrlToImageBytes(dataUrl: string): { bytes: Uint8Array; type: "png" | "jpg" } {
  const [meta, base64] = dataUrl.split(",");
  return {
    bytes: Uint8Array.from(atob(base64 ?? ""), (char) => char.charCodeAt(0)),
    type: meta.includes("image/png") ? "png" : "jpg"
  };
}

function buildPlansExportHtml(plans: OperationalPlan[], context: PlanExportContext) {
  const generatedAt = new Date().toLocaleString("es-CO");
  const sectionStyles = plans.map((_, index) => {
    const sectionNumber = index + 1;
    return `@page WordSection${sectionNumber} { size: 8.27in 11.69in; margin: 1.15in .45in 1.2in .45in; mso-header-margin: .2in; mso-footer-margin: .2in; mso-header: h${sectionNumber}; mso-footer: f${sectionNumber}; }
    div.WordSection${sectionNumber} { page: WordSection${sectionNumber}; }`;
  }).join("\n    ");
  const body = plans.map((plan, index) => buildPlanSectionHtml(plan, context, generatedAt, index)).join("");
  const wordChrome = plans.map((plan, index) => buildWordHeaderFooterHtml(plan, context, index)).join("");
  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Planes Operativos</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    ${sectionStyles}
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
    .plan-page { page-break-before: auto; padding: 0 0 18px; }
    .page-break { page-break-before: always; }
    .doc-header { border-bottom: 3px solid #1f4d35; margin-bottom: 12px; padding-bottom: 8px; }
    .word-header, .word-footer { width: 100%; }
    .logo-block { width: 100%; margin: 0; }
    .logo-line { margin: 0 0 4px; padding: 0; line-height: 1; border: 0; }
    .logo-line img { border: 0; object-fit: contain; margin: 0 5px 4px 0; }
    .brand { color: #1f4d35; font-size: 18px; font-weight: 700; letter-spacing: .2px; margin-bottom: 6px; }
    .meta-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; margin: 8px 0 0; }
    .meta-table td { border: 0; border-bottom: 1px solid #ddd; padding: 2px 0; }
    h2 { color: #1f4d35; margin: 12px 0 5px; font-size: 13px; }
    h3 { margin: 8px 0 5px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; margin-bottom: 9px; }
    th, td { border: 1px solid #222; padding: 3px; vertical-align: top; word-wrap: break-word; }
    th { text-align: center; font-weight: 700; background: #f3f6f1; }
    .group { background: #fff; font-size: 10px; }
    .number { text-align: right; white-space: nowrap; }
    .qty { text-align: center; }
    .subtotal td { font-weight: 700; background: #f8f8f8; }
    .summary { width: 60%; margin-left: auto; font-size: 9px; }
    .summary td:first-child { font-weight: 700; }
    .muted { color: #555; }
    @media print {
      html, body { width: 210mm; }
    }
  </style>
</head>
<body>${wordChrome}${body}</body>
</html>`;
}

function buildPlanSectionHtml(plan: OperationalPlan, context: PlanExportContext, _generatedAt: string, sectionIndex: number) {
  const project = context.projects.find((item) => item.id === plan.project_id);
  const family = context.families.find((item) => item.id === plan.family_id);
  const municipality = context.municipalities.find((item) => item.id === family?.municipality_id);
  const village = context.villages.find((item) => item.id === family?.village_id);
  const realActivitiesForPlan = context.planActivities.filter((item) => item.plan_id === plan.id);
  const activitiesForPlan = realActivitiesForPlan.length > 0 ? realActivitiesForPlan : examplePlanActivities(plan.id);
  const projectTotal = activitiesForPlan.reduce((sum, activity) => {
    return sum + projectMaterialsForExport(activity, context)
      .reduce((partial, material) => {
        const official = material.material_id ? context.materials.find((m) => m.id === material.material_id) : null;
        return partial + material.quantity * (official?.quoted_unit_price ?? material.quoted_unit_price);
      }, 0);
  }, 0);
  const familyTotal = activitiesForPlan.reduce((sum, activity) => {
    return sum + familyCounterpartsForExport(activity, context)
      .reduce((partial, counterpart) => partial + counterpart.quantity * counterpart.estimated_unit_value, 0);
  }, 0);
  const activitySections = activitiesForPlan.map((activity, index) => buildActivityExportHtml(activity, index, context)).join("");
  const sectionNumber = sectionIndex + 1;

  return `<div class="WordSection${sectionNumber} ${sectionIndex > 0 ? "page-break" : ""}">
    <section class="plan-page">
    <div class="doc-header">
      <div class="brand">Planes Operativos</div>
      <table class="meta-table">
        <tbody>
          <tr><td><strong>Proyecto:</strong> ${escapeHtml(project?.name ?? "Sin proyecto")}</td></tr>
          <tr><td><strong>Codigo familia:</strong> ${escapeHtml(family?.family_code ?? "N/A")}</td></tr>
          <tr><td><strong>Representante:</strong> ${escapeHtml(family?.representative_name ?? "N/A")}</td></tr>
          <tr><td><strong>Documento:</strong> ${escapeHtml(family?.document_number ?? "N/A")}</td></tr>
          <tr><td><strong>Municipio:</strong> ${escapeHtml(municipality?.name ?? "N/A")}</td></tr>
          <tr><td><strong>Vereda:</strong> ${escapeHtml(village?.name ?? "N/A")}</td></tr>
        </tbody>
      </table>
    </div>
    ${realActivitiesForPlan.length === 0 ? `<p class="muted">Plan sin actividades registradas. Se muestran actividades de ejemplo para previsualizar el formato.</p>` : ""}
    ${activitySections}
    <table class="summary">
      <tbody>
        <tr><td>Subtotal aporte de la familia</td><td class="number">${formatExportMoney(familyTotal)}</td></tr>
        <tr><td>Subtotal aporte del proyecto</td><td class="number">${formatExportMoney(projectTotal)}</td></tr>
        <tr><td>Total general</td><td class="number">${formatExportMoney(familyTotal + projectTotal)}</td></tr>
      </tbody>
    </table>
    </section>
  </div>`;
}

function buildWordHeaderFooterHtml(plan: OperationalPlan, context: PlanExportContext, sectionIndex: number) {
  const sectionNumber = sectionIndex + 1;
  const logos = context.projectLogos[plan.project_id] ?? [];
  const topLogos = logos.filter((logo) => !isBottomLogoPosition(logo.position));
  const bottomLogos = logos.filter((logo) => isBottomLogoPosition(logo.position));
  return `<div class="word-header" style="mso-element:header" id="h${sectionNumber}">
      ${buildLogoRowHtml(topLogos, "header")}
    </div>
    <div class="word-footer" style="mso-element:footer" id="f${sectionNumber}">
      ${buildLogoRowHtml(bottomLogos, "footer")}
    </div>`;
}

function buildActivityExportHtml(activity: PlanActivity, index: number, context: PlanExportContext) {
  const catalogActivity = context.activities.find((item) => item.id === activity.activity_id);
  const projectMaterials = projectMaterialsForExport(activity, context);
  const familyCounterparts = familyCounterpartsForExport(activity, context);
  const familySubtotal = familyCounterparts.reduce((sum, item) => sum + item.quantity * item.estimated_unit_value, 0);
  const projectSubtotal = projectMaterials.reduce((sum, item) => {
    const official = item.material_id ? context.materials.find((material) => material.id === item.material_id) : null;
    return sum + item.quantity * (official?.quoted_unit_price ?? item.quoted_unit_price);
  }, 0);
  const familyRows = familyCounterparts.length > 0
    ? familyCounterparts.map((familyItem) => `<tr>
      <td>${escapeHtml(counterpartExportName(familyItem))}</td>
      <td class="qty">${formatQuantity(familyItem.quantity, familyItem.unit)}</td>
      <td class="number">${formatExportMoney(familyItem.estimated_unit_value)}</td>
      <td class="number">${formatExportMoney(familyItem.quantity * familyItem.estimated_unit_value)}</td>
    </tr>`).join("")
    : `<tr><td colspan="4" class="muted">Sin aportes de la familia.</td></tr>`;
  const projectRows = projectMaterials.length > 0
    ? projectMaterials.map((projectItem) => {
    const projectMaterial = projectItem?.material_id
      ? context.materials.find((item) => item.id === projectItem.material_id)
      : null;
    const provisional = projectItem?.provisional_material_id
      ? context.provisionalMaterials.find((item) => item.id === projectItem.provisional_material_id)
      : null;
    const price = projectMaterial?.quoted_unit_price ?? projectItem.quoted_unit_price;
    return `<tr>
      <td>${escapeHtml(projectMaterial?.name ?? provisional?.provisional_name ?? projectItem.observations ?? "")}${provisional?.status === "pending" ? " (pendiente)" : ""}</td>
      <td class="qty">${formatQuantity(projectItem.quantity, projectMaterial?.unit ?? projectItem.unit)}</td>
      <td class="number">${formatExportMoney(price)}</td>
      <td class="number">${formatExportMoney(projectItem.quantity * price)}</td>
    </tr>`;
  }).join("")
    : `<tr><td colspan="4" class="muted">Sin materiales del proyecto.</td></tr>`;

  return `<h2>Actividad ${index + 1}: ${escapeHtml(catalogActivity?.name ?? exampleActivityName(activity))}</h2>
    <h3>Linea base: ${activity.baseline ?? "N/A"} | Meta: ${activity.target ?? "N/A"} | Unidad: ${escapeHtml(activity.unit)}</h3>
    <table>
      <thead>
        <tr><th class="group" colspan="4">APORTE DE LA FAMILIA</th></tr>
        <tr>
          <th>ARTICULO</th><th>CANTIDAD</th><th>VALOR UNI</th><th>VALOR TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${familyRows}
        <tr class="subtotal">
          <td colspan="3">SUBTOTAL FAMILIA</td><td class="number">${formatExportMoney(familySubtotal)}</td>
        </tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr><th class="group" colspan="4">APORTE DEL PROYECTO</th></tr>
        <tr>
          <th>ARTICULO</th><th>CANTIDAD</th><th>VALOR UNI</th><th>VALOR TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${projectRows}
        <tr class="subtotal">
          <td colspan="3">SUBTOTAL PROYECTO</td><td class="number">${formatExportMoney(projectSubtotal)}</td>
        </tr>
      </tbody>
    </table>`;
}

function buildLogoRowHtml(logos: ProjectLogoConfig[], placement: "header" | "footer" = "header") {
  if (logos.length === 0) return "";
  const byPosition: Record<"left" | "center" | "right", ProjectLogoConfig[]> = {
    left: logos.filter((logo) => logoAlignment(logo.position) === "left"),
    center: logos.filter((logo) => logoAlignment(logo.position) === "center"),
    right: logos.filter((logo) => logoAlignment(logo.position) === "right")
  };
  const renderImages = (items: ProjectLogoConfig[]) => items
    .map((logo) => {
      const dimensions = logoDocumentDimensions(logo, placement);
      return `<img src="${escapeHtml(logo.dataUrl)}" alt="${escapeHtml(logo.name)}" width="${dimensions.width}" height="${dimensions.height}" style="width:${dimensions.width}pt; height:${dimensions.height}pt;" />`;
    })
    .join("");
  const renderLine = (position: "left" | "center" | "right") => {
    const images = renderImages(byPosition[position]);
    return images ? `<p class="logo-line" align="${position}">${images}</p>` : "";
  };
  return `<div class="logo-block ${placement === "footer" ? "logo-footer" : ""}">
    ${renderLine("left")}
    ${renderLine("center")}
    ${renderLine("right")}
  </div>`;
}

function examplePlanActivities(planId: string): PlanActivity[] {
  return [
    { id: `${planId}-example-1`, plan_id: planId, activity_id: "example-isolation", baseline: 0, target: 1, unit: "hectarea", observations: null, is_deleted: false },
    { id: `${planId}-example-2`, plan_id: planId, activity_id: "example-enrichment", baseline: 0, target: 120, unit: "plantulas", observations: null, is_deleted: false },
    { id: `${planId}-example-3`, plan_id: planId, activity_id: "example-maintenance", baseline: 0, target: 3, unit: "jornales", observations: null, is_deleted: false }
  ];
}

function exampleActivityName(activity: PlanActivity) {
  if (activity.activity_id === "example-isolation") return "Aislamiento de area de restauracion";
  if (activity.activity_id === "example-enrichment") return "Enriquecimiento con especies nativas";
  if (activity.activity_id === "example-maintenance") return "Mantenimiento y seguimiento del predio";
  return "Actividad";
}

function projectMaterialsForExport(activity: PlanActivity, context: PlanExportContext): PlanProjectMaterial[] {
  const rows = context.planMaterials.filter((item) => item.plan_activity_id === activity.id);
  if (rows.length > 0 || !activity.id.includes("-example-")) return rows;
  const data: Record<string, Array<[string, number, string, number]>> = {
    "example-isolation": [["Alambre de cerca calibre 14", 2, "rollo", 270000], ["Estantillos", 80, "unidad", 25000]],
    "example-enrichment": [["Plantulas nativas", 120, "unidad", 3500], ["Abono organico", 6, "bulto", 28000]],
    "example-maintenance": [["Herramientas menores", 1, "kit", 180000], ["Protector individual", 3, "unidad", 45000]]
  };
  return (data[activity.activity_id] ?? []).map(([name, quantity, unit, price], index) => ({
    id: `${activity.id}-material-${index}`,
    plan_activity_id: activity.id,
    material_id: null,
    provisional_material_id: null,
    quantity,
    unit,
    quoted_unit_price: price,
    quoted_total: quantity * price,
    observations: name,
    is_deleted: false
  }));
}

function familyCounterpartsForExport(activity: PlanActivity, context: PlanExportContext): PlanFamilyCounterpart[] {
  const rows = context.planCounterparts.filter((item) => item.plan_activity_id === activity.id);
  if (rows.length > 0 || !activity.id.includes("-example-")) return rows;
  const data: Record<string, Array<[string, number, string, number]>> = {
    "example-isolation": [["Mano de obra familiar", 4, "jornal", 50000], ["Transporte familiar", 1, "servicio", 80000]],
    "example-enrichment": [["Preparacion del terreno", 3, "jornal", 50000], ["Material vegetal propio", 20, "unidad", 2500]],
    "example-maintenance": [["Limpieza manual", 3, "jornal", 50000], ["Herramientas propias", 1, "kit", 60000]]
  };
  return (data[activity.activity_id] ?? []).map(([name, quantity, unit, price], index) => ({
    id: `${activity.id}-counterpart-${index}`,
    plan_activity_id: activity.id,
    contribution_type: "ejemplo",
    name,
    quantity,
    unit,
    estimated_unit_value: price,
    estimated_total: quantity * price,
    vegetal_indicator_group: null,
    observations: null,
    is_deleted: false
  }));
}

function counterpartExportName(item: PlanFamilyCounterpart) {
  const label = vegetalIndicatorGroupLabel(item.vegetal_indicator_group);
  return item.vegetal_indicator_group ? `${item.name} (${label})` : item.name;
}

const ForestPdf = "1f4d35";
const PdfFooterContentGap = 4;

function drawActivityPdf(doc: PdfDocumentBuilder, activity: PlanActivity, index: number, context: PlanExportContext, startY: number) {
  let y = startY;
  const catalogActivity = context.activities.find((item) => item.id === activity.activity_id);
  const projectMaterials = projectMaterialsForExport(activity, context);
  const familyCounterparts = familyCounterpartsForExport(activity, context);
  y = doc.ensureSpace(y, 120);
  doc.text(`Actividad ${index + 1}: ${catalogActivity?.name ?? exampleActivityName(activity)}`, doc.margin, y, 12, true, ForestPdf);
  y += 15;
  doc.text(`Linea base: ${activity.baseline ?? "N/A"} | Meta: ${activity.target ?? "N/A"} | Unidad: ${activity.unit}`, doc.margin, y, 9);
  y += 12;
  const familyRows = familyCounterparts.length > 0
    ? familyCounterparts.map((item) => [
        counterpartExportName(item),
        item.quantity.toString(),
        item.unit,
        formatExportMoney(item.estimated_unit_value),
        formatExportMoney(item.quantity * item.estimated_unit_value)
      ])
    : [["Sin aportes de la familia.", "", "", "", ""]];
  const familySubtotal = familyCounterparts.reduce((sum, item) => sum + item.quantity * item.estimated_unit_value, 0);
  y = drawPdfTable(doc, y, ["APORTE DE LA FAMILIA", "CANTIDAD", "UNIDAD", "VALOR UNI", "VALOR TOTAL"], [
    ...familyRows,
    ["SUBTOTAL FAMILIA", "", "", "", formatExportMoney(familySubtotal)]
  ], [210, 60, 70, 90, 90]);
  const projectRows = projectMaterials.length > 0
    ? projectMaterials.map((item) => {
        const official = item.material_id ? context.materials.find((material) => material.id === item.material_id) : null;
        const provisional = item.provisional_material_id
          ? context.provisionalMaterials.find((material) => material.id === item.provisional_material_id)
          : null;
        const price = official?.quoted_unit_price ?? item.quoted_unit_price;
        return [
          `${official?.name ?? provisional?.provisional_name ?? item.observations ?? ""}${provisional?.status === "pending" ? " (pendiente)" : ""}`,
          item.quantity.toString(),
          official?.unit ?? item.unit,
          formatExportMoney(price),
          formatExportMoney(item.quantity * price)
        ];
      })
    : [["Sin materiales del proyecto.", "", "", "", ""]];
  const projectSubtotal = projectMaterials.reduce((sum, item) => {
    const official = item.material_id ? context.materials.find((material) => material.id === item.material_id) : null;
    return sum + item.quantity * (official?.quoted_unit_price ?? item.quoted_unit_price);
  }, 0);
  return drawPdfTable(doc, y, ["APORTE DEL PROYECTO", "CANTIDAD", "UNIDAD", "VALOR UNI", "VALOR TOTAL"], [
    ...projectRows,
    ["SUBTOTAL PROYECTO", "", "", "", formatExportMoney(projectSubtotal)]
  ], [210, 60, 70, 90, 90]) + 4;
}

function drawMetaPdf(doc: PdfDocumentBuilder, rows: [string, string][], startY: number) {
  let y = startY;
  for (const [label, value] of rows) {
    doc.text(`${label}: ${value}`, doc.margin, y, 9, true);
    doc.line(doc.margin, y + 3, doc.pageWidth - doc.margin, y + 3, "dddddd", 0.5);
    y += 13;
  }
  return y;
}

function drawWrappedPdfText(doc: PdfDocumentBuilder, value: string, x: number, startY: number, width: number, size = 9, justify = false) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const maxChars = Math.max(20, Math.floor(width / (size * 0.48)));
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  let y = startY;
  for (const [index, current] of lines.entries()) {
    if (justify && index < lines.length - 1 && current.includes(" ")) {
      drawJustifiedPdfTextLine(doc, current, x, y, width, size);
    } else {
      doc.text(current, x, y, size);
    }
    y += size + 4;
  }
  return y;
}

function approximatePdfTextWidth(value: string, size: number) {
  return pdfText(value).length * size * 0.48;
}

function drawCenteredPdfText(doc: PdfDocumentBuilder, value: string, x: number, y: number, width: number, size = 8, bold = false) {
  const textWidth = approximatePdfTextWidth(value, size);
  doc.text(value, x + Math.max(0, (width - textWidth) / 2), y, size, bold);
}

// Como drawCenteredPdfText pero reduce la letra hasta que el texto quepa en la columna,
// para que los nombres largos no se salgan hacia la celda vecina.
function drawFittedCellText(doc: PdfDocumentBuilder, value: string, x: number, y: number, width: number, size = 8, bold = false, minSize = 5) {
  const available = width - 4;
  let fittedSize = size;
  while (fittedSize > minSize && approximatePdfTextWidth(value, fittedSize) > available) {
    fittedSize -= 0.5;
  }
  const textWidth = approximatePdfTextWidth(value, fittedSize);
  doc.text(value, x + Math.max(2, (width - textWidth) / 2), y, fittedSize, bold);
}

function drawJustifiedPdfTextLine(doc: PdfDocumentBuilder, value: string, x: number, y: number, width: number, size = 9) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    doc.text(value, x, y, size);
    return;
  }
  const wordsWidth = words.reduce((sum, word) => sum + approximatePdfTextWidth(word, size), 0);
  const gap = Math.max(size * 0.35, (width - wordsWidth) / (words.length - 1));
  let cursor = x;
  for (const word of words) {
    doc.text(word, cursor, y, size);
    cursor += approximatePdfTextWidth(word, size) + gap;
  }
}

function drawPdfTable(doc: PdfDocumentBuilder, startY: number, headers: string[], rows: string[][], widths: number[]) {
  let y = doc.ensureSpace(startY, 44);
  const rowHeight = 19;
  let x = doc.margin;
  for (const [index, header] of headers.entries()) {
    doc.rect(x, y, widths[index], rowHeight, "f3f6f1");
    drawFittedCellText(doc, header, x, y + 12, widths[index], 8, true);
    x += widths[index];
  }
  y += rowHeight;
  for (const row of rows) {
    y = doc.ensureSpace(y, rowHeight + 4);
    x = doc.margin;
    for (const [index, cell] of row.entries()) {
      doc.rect(x, y, widths[index], rowHeight);
      drawFittedCellText(doc, cell, x, y + 12, widths[index], 8);
      x += widths[index];
    }
    y += rowHeight;
  }
  return y + 4;
}

async function preparePdfLogos(logos: ProjectLogoConfig[], placement: "header" | "footer" = "header"): Promise<PreparedPdfLogo[]> {
  if (logos.length === 0) return [];
  const maxHeight = placement === "footer" ? 150 : 80;
  const prepared = (
    await Promise.all(logos.map(async (logo) => ({ logo, image: await imageDataForPdf(logo.dataUrl) })))
  ).filter((item): item is { logo: ProjectLogoConfig; image: PdfImage } => Boolean(item.image));
  if (prepared.length === 0) return [];

  return prepared.map(({ logo, image }) => {
    const dimensions = logoDocumentDimensions(logo, placement);
    const width = dimensions.width;
    const height = Math.min(maxHeight, dimensions.height);
    return { logo, image, width, height };
  });
}

function drawPreparedPdfLogos(doc: PdfDocumentBuilder, displayItems: PreparedPdfLogo[], startY: number) {
  if (displayItems.length === 0) return startY;
  const gap = 8;
  const byPosition: Record<"left" | "center" | "right", typeof displayItems> = {
    left: displayItems.filter((item) => logoAlignment(item.logo.position) === "left"),
    center: displayItems.filter((item) => logoAlignment(item.logo.position) === "center"),
    right: displayItems.filter((item) => logoAlignment(item.logo.position) === "right")
  };
  const rowHeight = Math.max(...displayItems.map((item) => item.height));

  const drawGroup = (items: typeof displayItems, position: "left" | "center" | "right") => {
    if (items.length === 0) return;
    const groupWidth = items.reduce((sum, item) => sum + item.width, 0) + gap * (items.length - 1);
    let x = doc.margin;
    if (position === "center") x = doc.pageWidth / 2 - groupWidth / 2;
    if (position === "right") x = doc.pageWidth - doc.margin - groupWidth;
    for (const item of items) {
      const y = startY + (rowHeight - item.height) / 2;
      doc.image(item.image, x, y, item.width, item.height);
      x += item.width + gap;
    }
  };

  for (const position of ["left", "center", "right"] as const) {
    drawGroup(byPosition[position], position);
  }
  return startY + rowHeight + 12;
}

function measurePreparedPdfLogosHeight(logos: PreparedPdfLogo[]) {
  if (logos.length === 0) return 0;
  return Math.max(...logos.map((logo) => logo.height));
}

async function imageDataForPdf(dataUrl: string): Promise<PdfImage | null> {
  const jpeg = dataUrl.startsWith("data:image/jpeg") ? dataUrl : await convertImageToJpeg(dataUrl);
  const base64 = jpeg.split(",")[1];
  if (!base64) return null;
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const size = jpegSize(bytes);
  return size ? { bytes, width: size.width, height: size.height } : null;
}

function convertImageToJpeg(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No fue posible preparar el logo."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => reject(new Error("No fue posible cargar el logo."));
    image.src = dataUrl;
  });
}

type PdfImage = { bytes: Uint8Array; width: number; height: number };
type PreparedPdfLogo = { logo: ProjectLogoConfig; image: PdfImage; width: number; height: number };
type PdfPageChrome = { topLogos: PreparedPdfLogo[]; bottomLogos: PreparedPdfLogo[] };

function dataUrlImageSize(dataUrl: string) {
  const base64 = dataUrl.split(",")[1];
  if (!base64) return null;
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (dataUrl.startsWith("data:image/png") && bytes.length >= 24) {
    const width = bytes[16] * 16777216 + bytes[17] * 65536 + bytes[18] * 256 + bytes[19];
    const height = bytes[20] * 16777216 + bytes[21] * 65536 + bytes[22] * 256 + bytes[23];
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (dataUrl.startsWith("data:image/jpeg")) {
    return jpegSize(bytes);
  }
  return null;
}

function jpegSize(bytes: Uint8Array) {
  for (let i = 2; i < bytes.length - 9; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] >= 0xc0 && bytes[i + 1] <= 0xc3) {
      return { height: bytes[i + 5] * 256 + bytes[i + 6], width: bytes[i + 7] * 256 + bytes[i + 8] };
    }
  }
  return null;
}

function createPdfDocument() {
  return new PdfDocumentBuilder();
}

class PdfDocumentBuilder {
  pageWidth = 595.28;
  pageHeight = 841.89;
  margin = 36;
  contentTop = this.margin;
  contentBottom = this.pageHeight - this.margin;
  private pages: string[][] = [[]];
  private objects: string[] = [];
  private images = new Map<string, number>();
  private pageChrome: PdfPageChrome = { topLogos: [], bottomLogos: [] };

  addPage(drawChrome = true) {
    this.pages.push([]);
    if (drawChrome) this.drawPageChrome();
  }

  setPageChrome(pageChrome: PdfPageChrome) {
    this.pageChrome = pageChrome;
    const headerHeight = measurePreparedPdfLogosHeight(pageChrome.topLogos);
    const footerHeight = measurePreparedPdfLogosHeight(pageChrome.bottomLogos);
    this.contentTop = this.margin + (headerHeight > 0 ? headerHeight + 12 : 0);
    this.contentBottom = this.pageHeight - this.margin - (footerHeight > 0 ? footerHeight + PdfFooterContentGap : 0);
    this.drawPageChrome();
  }

  ensureSpace(y: number, needed: number) {
    if (y + needed < this.contentBottom) return y;
    this.addPage();
    return this.contentTop;
  }

  text(value: string, x: number, y: number, size = 10, bold = false, color = "111111", width = 0, alignRight = false) {
    const clean = pdfText(value);
    const tx = alignRight && width > 0 ? x + Math.max(0, width - clean.length * size * 0.48) : x;
    this.current().push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${pdfColor(color)} rg ${tx.toFixed(2)} ${(this.pageHeight - y).toFixed(2)} Td (${escapePdf(clean)}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "111111", width = 1) {
    this.current().push(`${pdfColor(color)} RG ${width} w ${x1} ${this.pageHeight - y1} m ${x2} ${this.pageHeight - y2} l S`);
  }

  rect(x: number, y: number, width: number, height: number, fill?: string) {
    if (fill) this.current().push(`${pdfColor(fill)} rg ${x} ${this.pageHeight - y - height} ${width} ${height} re f`);
    this.current().push(`0 0 0 RG 0.6 w ${x} ${this.pageHeight - y - height} ${width} ${height} re S`);
  }

  image(image: PdfImage, x: number, y: number, width: number, height: number) {
    const key = pdfImageKey(image);
    let objectId = this.images.get(key);
    if (!objectId) {
      objectId = this.addObject(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n${binaryString(image.bytes)}\nendstream`);
      this.images.set(key, objectId);
    }
    this.current().push(`q ${width} 0 0 ${height} ${x} ${this.pageHeight - y - height} cm /Im${objectId} Do Q`);
  }

  finish() {
    const font1 = this.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const font2 = this.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds: number[] = [];
    const pagesId = this.objects.length + this.pages.length * 2 + 1;
    for (const page of this.pages) {
      const contentId = this.addObject(`<< /Length ${page.join("\n").length} >>\nstream\n${page.join("\n")}\nendstream`);
      const imageResources = Array.from(this.images.values()).map((id) => `/Im${id} ${id} 0 R`).join(" ");
      pageIds.push(this.addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /XObject << ${imageResources} >> >> /Contents ${contentId} 0 R >>`));
    }
    this.addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    return writePdf(this.objects, catalogId);
  }

  private current() {
    return this.pages[this.pages.length - 1];
  }

  private drawPageChrome() {
    if (this.pageChrome.topLogos.length > 0) {
      drawPreparedPdfLogos(this, this.pageChrome.topLogos, this.margin);
    }
    if (this.pageChrome.bottomLogos.length > 0) {
      const footerHeight = measurePreparedPdfLogosHeight(this.pageChrome.bottomLogos);
      drawPreparedPdfLogos(this, this.pageChrome.bottomLogos, this.pageHeight - this.margin - footerHeight);
    }
  }

  private addObject(content: string) {
    this.objects.push(content);
    return this.objects.length;
  }
}

function writePdf(objects: string[], catalogId: number) {
  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(output, (char) => char.charCodeAt(0) & 0xff);
}

function pdfColor(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function pdfImageKey(image: PdfImage) {
  let hash = 2166136261;
  for (const byte of image.bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `${image.width}-${image.height}-${image.bytes.length}-${hash >>> 0}`;
}

function pdfText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}

function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function binaryString(bytes: Uint8Array) {
  let result = "";
  for (const byte of bytes) result += String.fromCharCode(byte);
  return result;
}

async function buildPlansPdf(plans: OperationalPlan[], context: PlanExportContext) {
  const doc = createPdfDocument();
  for (const [index, plan] of plans.entries()) {
    if (index > 0) doc.addPage(false);
    await drawPlanPdf(doc, plan, context);
  }
  return doc.finish();
}

async function drawPlanPdf(doc: PdfDocumentBuilder, plan: OperationalPlan, context: PlanExportContext) {
  const project = context.projects.find((item) => item.id === plan.project_id);
  const family = context.families.find((item) => item.id === plan.family_id);
  const municipality = context.municipalities.find((item) => item.id === family?.municipality_id);
  const village = context.villages.find((item) => item.id === family?.village_id);
  const logos = context.projectLogos[plan.project_id] ?? [];
  const topLogos = logos.filter((logo) => !isBottomLogoPosition(logo.position));
  const bottomLogos = logos.filter((logo) => isBottomLogoPosition(logo.position));
  doc.setPageChrome({
    topLogos: await preparePdfLogos(topLogos, "header"),
    bottomLogos: await preparePdfLogos(bottomLogos, "footer")
  });
  let y = doc.contentTop;

  doc.text("Planes Operativos", doc.margin, y, 18, true, ForestPdf);
  y += 24;
  y = drawMetaPdf(doc, [
    ["Proyecto", project?.name ?? "Sin proyecto"],
    ["Codigo familia", family?.family_code ?? "N/A"],
    ["Representante", family?.representative_name ?? "N/A"],
    ["Documento", family?.document_number ?? "N/A"],
    ["Municipio", municipality?.name ?? "N/A"],
    ["Vereda", village?.name ?? "N/A"]
  ], y);
  doc.line(doc.margin, y + 6, doc.pageWidth - doc.margin, y + 6, ForestPdf, 2);
  y += 26;

  const realActivitiesForPlan = context.planActivities.filter((item) => item.plan_id === plan.id);
  const activitiesForPlan = realActivitiesForPlan.length > 0 ? realActivitiesForPlan : examplePlanActivities(plan.id);
  if (realActivitiesForPlan.length === 0) {
    doc.text("Plan sin actividades registradas. Se muestran actividades de ejemplo para previsualizar el formato.", doc.margin, y, 9, false, "555555");
    y += 18;
  }
  for (const [activityIndex, activity] of activitiesForPlan.entries()) {
    if (activityIndex > 0) y += 16;
    const result = drawActivityPdf(doc, activity, activityIndex, context, y);
    y = result;
  }
  const familyTotal = activitiesForPlan.reduce((sum, activity) =>
    sum + familyCounterpartsForExport(activity, context)
      .reduce((partial, item) => partial + item.quantity * item.estimated_unit_value, 0), 0);
  const projectTotal = activitiesForPlan.reduce((sum, activity) =>
    sum + projectMaterialsForExport(activity, context)
      .reduce((partial, item) => partial + item.quantity * item.quoted_unit_price, 0), 0);
  y = drawPdfTable(doc, y, ["Concepto", "Valor"], [
    ["Subtotal aporte de la familia", formatExportMoney(familyTotal)],
    ["Subtotal aporte del proyecto", formatExportMoney(projectTotal)],
    ["Total general", formatExportMoney(familyTotal + projectTotal)]
  ], [350, 150]);
}

function exportFileName(plans: OperationalPlan[], context: PlanExportContext) {
  if (plans.length === 1) {
    const family = context.families.find((item) => item.id === plans[0].family_id);
    return sanitizeFileName(`plan-operativo-${family?.family_code ?? plans[0].version}`);
  }
  return sanitizeFileName(`planes-operativos-${plans.length}`);
}

function sanitizeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
}

function sanitizeWorksheetName(value: string) {
  const clean = value.replace(/[\\/?*[\]:]/g, " ").trim() || "ETEC";
  return clean.slice(0, 31);
}

function formatExportMoney(value: number) {
  return `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampLogoSize(value: number) {
  if (!Number.isFinite(value)) return 90;
  return Math.min(360, Math.max(40, Math.round(value)));
}

function logoDocumentWidth(size: number) {
  return clampLogoSize(size);
}

function logoDocumentDimensions(logo: ProjectLogoConfig, placement: "header" | "footer") {
  const imageSize = dataUrlImageSize(logo.dataUrl);
  const maxWidth = placement === "footer" ? 500 : 280;
  const maxHeight = placement === "footer" ? 150 : 80;
  const multiplier = placement === "footer" ? 2.25 : 1;
  let width = Math.min(maxWidth, logoDocumentWidth(logo.size) * multiplier);
  let height = imageSize ? width * (imageSize.height / imageSize.width) : Math.round(width * 0.42);
  if (height > maxHeight) {
    const scale = maxHeight / height;
    width *= scale;
    height = maxHeight;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function isBottomLogoPosition(position: ProjectLogoPosition) {
  return position.startsWith("bottom-");
}

function logoAlignment(position: ProjectLogoPosition): "left" | "center" | "right" {
  if (position.endsWith("left")) return "left";
  if (position.endsWith("center")) return "center";
  return "right";
}

function actProjectLogosForExport(logos: Record<string, ProjectLogoConfig[]>): Record<string, ProjectLogoConfig[]> {
  return logos;
}

function actLogosForProject(logos: Record<string, ProjectLogoConfig[]>, projectId: string) {
  const positionOrder: Record<ProjectLogoPosition, number> = {
    left: 3,
    center: 4,
    right: 1,
    "bottom-left": 5,
    "bottom-center": 2,
    "bottom-right": 6
  };
  return (logos[projectId] ?? [])
    .filter((logo) => logo.position === "right" || logo.position === "bottom-center")
    .sort((left, right) => positionOrder[left.position] - positionOrder[right.position]);
}

// Logos por proyecto, ahora en Supabase (tabla project_logos) para que servidor y app los compartan.
async function loadProjectLogos(): Promise<Record<string, ProjectLogoConfig[]>> {
  const { data, error } = await supabase
    .from("project_logos")
    .select("id, project_id, data_url, position, name, size")
    .eq("is_deleted", false)
    .order("created_at")
    .order("id");
  if (error || !data) return {};
  const result: Record<string, ProjectLogoConfig[]> = {};
  for (const row of data as Array<{ id: string; project_id: string; data_url: string; position: ProjectLogoPosition; name: string | null; size: number }>) {
    (result[row.project_id] ??= []).push({
      id: row.id,
      dataUrl: row.data_url,
      position: row.position,
      name: row.name ?? "Logo",
      size: clampLogoSize(row.size)
    });
  }
  return result;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function planStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    ready_to_sync: "Listo sync",
    synced: "Sincronizado",
    pending_material: "Pendiente material",
    pending_review: "Pendiente revision",
    approved: "Aprobado",
    returned: "Devuelto",
    closed: "Cerrado",
    conflict: "Conflicto"
  };
  return labels[status] ?? status;
}

function CrudSection({
  title,
  canWrite,
  notice,
  children
}: {
  title: string;
  canWrite: boolean;
  notice: Notice;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="toolbar">
        <h2>{title}</h2>
        <span className="badge">{canWrite ? "Edicion habilitada" : "Solo lectura"}</span>
      </div>
      {notice ? <div className={`alert ${notice.type}`}>{notice.message}</div> : null}
      {children}
    </section>
  );
}

// Ancho del logo con botones -/+ (sin teclado): ajusta de a 10 con clics del mouse.
// Elimina los problemas de teclado fisico/NumLock y el salto de foco entre logos.
function LogoSizeInput({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (size: number) => void }) {
  const step = 10;
  const change = (delta: number) => {
    const next = clampLogoSize(value + delta);
    if (!disabled && next !== value) onCommit(next);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <button type="button" className="secondary" disabled={disabled || value <= 40} onClick={() => change(-step)}>−</button>
      <span style={{ minWidth: "40px", textAlign: "center", fontWeight: 600 }}>{value}</span>
      <button type="button" className="secondary" disabled={disabled || value >= 360} onClick={() => change(step)}>+</button>
    </div>
  );
}

function AlertNotice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  return (
    <div className={`alert ${notice.type} alert-dismissible`}>
      <span>{notice.message}</span>
      <button type="button" className="alert-close" aria-label="Cerrar aviso" onClick={onClose}>×</button>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyMessage = "No hay registros para mostrar con los filtros actuales.",
  embedded = false
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyMessage?: string;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "table-panel embedded-table" : "panel table-panel"}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="muted">{emptyMessage}</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Actions({
  canWrite,
  onEdit,
  onDelete
}: {
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="row-actions">
      <button className="secondary" type="button" disabled={!canWrite} onClick={onEdit}>Editar</button>
      <button className="danger super-admin-only" type="button" onClick={() => {
        if (window.confirm("¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.")) onDelete();
      }}>Eliminar</button>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  className = "span-4"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} required={required} />
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="span-3">
      {label}
      <select value={String(value)} onChange={(event) => onChange(event.target.value === "true")}>
        <option value="true">Si</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}

function ChipMultiSelect({
  label,
  options,
  value,
  onChange,
  className = "span-4"
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}) {
  const selectedOptions = options.filter((option) => value.includes(option.value));
  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  }

  return (
    <div className={`territory-picker ${className}`}>
      <div className="territory-title">{label}</div>
      {selectedOptions.length > 0 ? (
        <div className="chip-list">
          {selectedOptions.map((option) => (
            <button
              className="chip"
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              title={`Quitar ${option.label}`}
            >
              {option.label} x
            </button>
          ))}
        </div>
      ) : (
        <div className="muted">Sin territorios seleccionados.</div>
      )}
      <div className="checkbox-list">
        {options.length === 0 ? (
          <div className="muted">No hay opciones disponibles para la seleccion anterior.</div>
        ) : (
          options.map((option) => (
            <label className="checkbox-row" key={option.value}>
              <input
                checked={value.includes(option.value)}
                onChange={() => toggle(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function ChipList({ labels }: { labels: string[] }) {
  return (
    <div className="chip-list compact">
      {labels.map((label) => (
        <span className="chip static" key={label}>
          {label}
        </span>
      ))}
    </div>
  );
}

function getSelectedLabels(options: { value: string; label: string }[], ids: string[]) {
  const labelsById = new Map(options.map((option) => [option.value, option.label]));
  return ids.map((id) => labelsById.get(id)).filter((label): label is string => Boolean(label));
}

function SelectProject({
  projects,
  value,
  onChange
}: {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="span-4">
      Proyecto
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Seleccione</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
    </label>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Ocurrio un error inesperado.";
}

function confirmManualChange(message: string) {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

function isMissingEtecColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (message.includes("etec_block") || message.includes("technical_characteristics"))
    && (message.includes("schema cache") || message.includes("column") || message.includes("columna"));
}

function isMissingCounterpartVegetalColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("vegetal_indicator_group")
    && (message.includes("schema cache") || message.includes("column") || message.includes("columna"));
}

function isMissingActivityStrategyColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("restoration_strategy")
    && (message.includes("schema cache") || message.includes("column") || message.includes("columna"));
}

function isMissingActivityMaintenanceColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("maintenance_")
    && (message.includes("schema cache") || message.includes("column") || message.includes("columna"));
}

function isMissingTableError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("could not find the table")
    || message.includes("schema cache")
    || message.includes("relation") && message.includes("does not exist")
    || message.includes("tabla") && message.includes("no existe");
}

function localEtecDraftsKey(projectId: string) {
  return `etec_drafts_${projectId || "all"}`;
}

function loadLocalEtecDrafts(projectId: string): Record<string, EtecDraft> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(localEtecDraftsKey(projectId)) ?? "{}") as Record<string, EtecDraft>;
  } catch {
    return {};
  }
}

function saveLocalEtecDrafts(projectId: string, drafts: Record<string, EtecDraft>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localEtecDraftsKey(projectId), JSON.stringify(drafts));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

// ==========================================================================
// Fase 8: Economia Familiar - modulo web analitico (solo lectura + exportacion).
// Carga sus propias tablas economia_* (aislado del loadAll principal) y presenta
// las fuentes de ingreso por familia, agregadas por vereda/municipio/departamento.
// ==========================================================================
type EconomiaNivel = "departamento" | "municipio" | "vereda";

type EconomiaRow = {
  encuestaId: string;
  familyId: string;
  familia: string;
  departamento: string;
  municipio: string;
  vereda: string;
  ronda: string;
  personas: number;
  ingProductos: number;
  ingGobierno: number;
  ingOtros: number;
  ingTotal: number;
  jornal: number;
};

function EconomiaAnalytics({
  projects,
  families,
  municipalities,
  villages
}: {
  projects: Project[];
  families: Family[];
  municipalities: Municipality[];
  villages: Village[];
}) {
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rondas, setRondas] = useState<EconomiaRonda[]>([]);
  const [productosCat, setProductosCat] = useState<EconomiaProductoCatalogo[]>([]);
  const [tiposApoyo, setTiposApoyo] = useState<EconomiaTipoApoyo[]>([]);
  const [tiposPago, setTiposPago] = useState<EconomiaTipoPago[]>([]);
  const [encuestas, setEncuestas] = useState<EconomiaEncuesta[]>([]);
  const [apoyos, setApoyos] = useState<EconomiaEncuestaApoyo[]>([]);
  const [pagos, setPagos] = useState<EconomiaEncuestaPago[]>([]);
  const [productos, setProductos] = useState<EconomiaEncuestaProducto[]>([]);
  const [rondaFilter, setRondaFilter] = useState<string>("all");
  const [nivel, setNivel] = useState<EconomiaNivel>("municipio");
  const [comparaNivel, setComparaNivel] = useState<"familia" | EconomiaNivel>("familia");
  const [expandedEncuesta, setExpandedEncuesta] = useState<string | null>(null);

  const loadEconomia = useCallback(async () => {
    setLoading(true);
    setSchemaError(null);
    setLoadError(null);
    const [rondasRes, productosCatRes, tiposApoyoRes, tiposPagoRes, encuestasRes, apoyosRes, pagosRes, productosRes] = await Promise.all([
      supabase.from("economia_rondas").select("*").eq("is_deleted", false).order("orden"),
      supabase.from("economia_productos").select("*").eq("is_deleted", false).order("orden"),
      supabase.from("economia_tipos_apoyo").select("*").eq("is_deleted", false).order("orden"),
      supabase.from("economia_tipos_pago").select("*").eq("is_deleted", false).order("orden"),
      supabase.from("economia_encuestas").select("*").eq("is_deleted", false),
      supabase.from("economia_encuesta_apoyos").select("*").eq("is_deleted", false),
      supabase.from("economia_encuesta_pagos").select("*").eq("is_deleted", false),
      supabase.from("economia_encuesta_productos").select("*").eq("is_deleted", false)
    ]);
    const results = [rondasRes, productosCatRes, tiposApoyoRes, tiposPagoRes, encuestasRes, apoyosRes, pagosRes, productosRes];
    const missing = results.some((r) => r.error && isMissingTableError(r.error));
    if (missing) {
      setSchemaError(
        "Faltan migraciones de Economia Familiar en Supabase. Aplique 20260813120000_phase8_economia_familiar.sql antes de usar este modulo."
      );
      setLoading(false);
      return;
    }
    const anyError = results.find((r) => r.error);
    if (anyError?.error) {
      setLoadError(getErrorMessage(anyError.error));
      setLoading(false);
      return;
    }
    setRondas((rondasRes.data as EconomiaRonda[]) ?? []);
    setProductosCat((productosCatRes.data as EconomiaProductoCatalogo[]) ?? []);
    setTiposApoyo((tiposApoyoRes.data as EconomiaTipoApoyo[]) ?? []);
    setTiposPago((tiposPagoRes.data as EconomiaTipoPago[]) ?? []);
    setEncuestas((encuestasRes.data as EconomiaEncuesta[]) ?? []);
    setApoyos((apoyosRes.data as EconomiaEncuestaApoyo[]) ?? []);
    setPagos((pagosRes.data as EconomiaEncuestaPago[]) ?? []);
    setProductos((productosRes.data as EconomiaEncuestaProducto[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEconomia();
  }, [loadEconomia]);

  const municById = useMemo(() => new Map(municipalities.map((m) => [m.id, m] as const)), [municipalities]);
  const villById = useMemo(() => new Map(villages.map((v) => [v.id, v] as const)), [villages]);
  const famById = useMemo(() => new Map(families.map((f) => [f.id, f] as const)), [families]);
  const rondaById = useMemo(() => new Map(rondas.map((r) => [r.id, r] as const)), [rondas]);
  const prodCatById = useMemo(() => new Map(productosCat.map((p) => [p.id, p] as const)), [productosCat]);
  const tipoApoyoById = useMemo(() => new Map(tiposApoyo.map((t) => [t.id, t] as const)), [tiposApoyo]);
  const tipoPagoById = useMemo(() => new Map(tiposPago.map((t) => [t.id, t] as const)), [tiposPago]);

  const nombreProducto = (p: EconomiaEncuestaProducto): string =>
    p.producto_id ? prodCatById.get(p.producto_id)?.nombre ?? "(producto)" : p.nombre_otro ?? "Otro producto";

  const rows = useMemo<EconomiaRow[]>(() => {
    const familyIds = new Set(families.map((f) => f.id));
    const prodByEnc = new Map<string, number>();
    productos.forEach((p) => prodByEnc.set(p.encuesta_id, (prodByEnc.get(p.encuesta_id) ?? 0) + (p.ingreso_mensual ?? 0)));
    const apoyoByEnc = new Map<string, number>();
    apoyos.forEach((a) => apoyoByEnc.set(a.encuesta_id, (apoyoByEnc.get(a.encuesta_id) ?? 0) + (a.valor_mensual ?? 0)));
    const pagoByEnc = new Map<string, number>();
    pagos.forEach((p) => pagoByEnc.set(p.encuesta_id, (pagoByEnc.get(p.encuesta_id) ?? 0) + (p.valor_mensual ?? 0)));
    return encuestas
      .filter((e) => familyIds.has(e.family_id) && (rondaFilter === "all" || e.ronda_id === rondaFilter))
      .map((e) => {
        const fam = famById.get(e.family_id);
        const m = fam?.municipality_id ? municById.get(fam.municipality_id) : undefined;
        const v = fam?.village_id ? villById.get(fam.village_id) : undefined;
        const ingProductos = prodByEnc.get(e.id) ?? 0;
        const ingGobierno = apoyoByEnc.get(e.id) ?? 0;
        const ingOtros = pagoByEnc.get(e.id) ?? 0;
        return {
          encuestaId: e.id,
          familyId: e.family_id,
          familia: fam ? `${fam.family_code} - ${fam.representative_name}` : "(familia desconocida)",
          departamento: m?.department ?? "Sin departamento",
          municipio: m?.name ?? "Sin municipio",
          vereda: v?.name ?? "Sin vereda",
          ronda: rondaById.get(e.ronda_id)?.nombre ?? "-",
          personas: e.personas_total ?? 0,
          ingProductos,
          ingGobierno,
          ingOtros,
          ingTotal: ingProductos + ingGobierno + ingOtros,
          jornal: e.valor_jornal ?? 0
        };
      })
      .sort((a, b) => b.ingTotal - a.ingTotal);
  }, [encuestas, productos, apoyos, pagos, families, rondaFilter, famById, municById, villById, rondaById]);

  const totales = useMemo(() => {
    const familias = new Set(rows.map((r) => r.familyId));
    const ingProductos = rows.reduce((acc, r) => acc + r.ingProductos, 0);
    const ingGobierno = rows.reduce((acc, r) => acc + r.ingGobierno, 0);
    const ingOtros = rows.reduce((acc, r) => acc + r.ingOtros, 0);
    const ingTotal = ingProductos + ingGobierno + ingOtros;
    return {
      familias: familias.size,
      encuestas: rows.length,
      ingProductos,
      ingGobierno,
      ingOtros,
      ingTotal,
      promedio: familias.size > 0 ? ingTotal / familias.size : 0
    };
  }, [rows]);

  const aggRows = useMemo(() => {
    const map = new Map<string, { clave: string; familias: Set<string>; encuestas: number; ingProductos: number; ingGobierno: number; ingOtros: number; ingTotal: number }>();
    rows.forEach((r) => {
      const clave =
        nivel === "departamento" ? r.departamento : nivel === "municipio" ? `${r.departamento} / ${r.municipio}` : `${r.municipio} / ${r.vereda}`;
      const cur = map.get(clave) ?? { clave, familias: new Set<string>(), encuestas: 0, ingProductos: 0, ingGobierno: 0, ingOtros: 0, ingTotal: 0 };
      cur.familias.add(r.familyId);
      cur.encuestas += 1;
      cur.ingProductos += r.ingProductos;
      cur.ingGobierno += r.ingGobierno;
      cur.ingOtros += r.ingOtros;
      cur.ingTotal += r.ingTotal;
      map.set(clave, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.ingTotal - a.ingTotal);
  }, [rows, nivel]);

  const topProductos = useMemo(() => {
    const encIds = new Set(rows.map((r) => r.encuestaId));
    const map = new Map<string, { nombre: string; ingreso: number; encuestas: Set<string> }>();
    productos
      .filter((p) => encIds.has(p.encuesta_id))
      .forEach((p) => {
        const nombre = p.producto_id ? prodCatById.get(p.producto_id)?.nombre ?? "(producto)" : p.nombre_otro ?? "Otro producto";
        const cur = map.get(nombre) ?? { nombre, ingreso: 0, encuestas: new Set<string>() };
        cur.ingreso += p.ingreso_mensual ?? 0;
        cur.encuestas.add(p.encuesta_id);
        map.set(nombre, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.ingreso - a.ingreso).slice(0, 20);
  }, [productos, rows, prodCatById]);

  const nivelLabel = nivel === "departamento" ? "Departamento" : nivel === "municipio" ? "Departamento / Municipio" : "Municipio / Vereda";

  // --- Comparacion entre rondas (linea base vs monitoreos). Ignora el filtro de una sola ronda:
  //     usa TODAS las rondas como columnas para poder compararlas. Escala a muchos monitoreos.
  const ingresoPorEncuesta = useMemo(() => {
    const m = new Map<string, number>();
    const add = (encuestaId: string, valor: number) => m.set(encuestaId, (m.get(encuestaId) ?? 0) + valor);
    productos.forEach((p) => add(p.encuesta_id, p.ingreso_mensual ?? 0));
    apoyos.forEach((a) => add(a.encuesta_id, a.valor_mensual ?? 0));
    pagos.forEach((p) => add(p.encuesta_id, p.valor_mensual ?? 0));
    return m;
  }, [productos, apoyos, pagos]);

  const rondasOrdenadas = useMemo(() => [...rondas].sort((a, b) => a.orden - b.orden), [rondas]);

  const comparaNivelLabel =
    comparaNivel === "familia" ? "Familia" : comparaNivel === "departamento" ? "Departamento" : comparaNivel === "municipio" ? "Departamento / Municipio" : "Municipio / Vereda";

  const pivotRondas = useMemo(() => {
    const familyIds = new Set(families.map((f) => f.id));
    const claveDe = (e: EconomiaEncuesta): string => {
      const fam = famById.get(e.family_id);
      if (comparaNivel === "familia") return fam ? `${fam.family_code} - ${fam.representative_name}` : "(familia desconocida)";
      const m = fam?.municipality_id ? municById.get(fam.municipality_id) : undefined;
      const v = fam?.village_id ? villById.get(fam.village_id) : undefined;
      if (comparaNivel === "departamento") return m?.department ?? "Sin departamento";
      if (comparaNivel === "municipio") return `${m?.department ?? "Sin departamento"} / ${m?.name ?? "Sin municipio"}`;
      return `${m?.name ?? "Sin municipio"} / ${v?.name ?? "Sin vereda"}`;
    };
    const map = new Map<string, Map<string, number>>();
    encuestas
      .filter((e) => familyIds.has(e.family_id))
      .forEach((e) => {
        const clave = claveDe(e);
        const inner = map.get(clave) ?? new Map<string, number>();
        inner.set(e.ronda_id, (inner.get(e.ronda_id) ?? 0) + (ingresoPorEncuesta.get(e.id) ?? 0));
        map.set(clave, inner);
      });
    return Array.from(map.entries())
      .map(([clave, inner]) => {
        const valores = rondasOrdenadas.map((r) => (inner.has(r.id) ? inner.get(r.id) ?? 0 : null));
        const conDato = valores.filter((v): v is number => v != null);
        let variacion: number | null = null;
        if (conDato.length >= 2) {
          const base = conDato[0];
          const ultimo = conDato[conDato.length - 1];
          variacion = base > 0 ? ((ultimo - base) / base) * 100 : null;
        }
        return { clave, valores, variacion };
      })
      .sort((a, b) => {
        const ultA = [...a.valores].reverse().find((v) => v != null) ?? 0;
        const ultB = [...b.valores].reverse().find((v) => v != null) ?? 0;
        return ultB - ultA;
      });
  }, [encuestas, families, comparaNivel, famById, municById, villById, rondasOrdenadas, ingresoPorEncuesta]);

  async function exportarExcel() {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();

    const s1 = workbook.addWorksheet("Por familia");
    s1.addRow(["Familia", "Departamento", "Municipio", "Vereda", "Ronda", "Personas", "Ing. productos", "Ing. gobierno", "Ing. otros", "Ing. total mensual", "Valor jornal"]);
    rows.forEach((r) => s1.addRow([r.familia, r.departamento, r.municipio, r.vereda, r.ronda, r.personas, r.ingProductos, r.ingGobierno, r.ingOtros, r.ingTotal, r.jornal]));
    s1.getRow(1).font = { bold: true };

    const s2 = workbook.addWorksheet("Agregado");
    s2.addRow([nivelLabel, "Familias", "Encuestas", "Ing. productos", "Ing. gobierno", "Ing. otros", "Ing. total", "Promedio por familia"]);
    aggRows.forEach((a) =>
      s2.addRow([a.clave, a.familias.size, a.encuestas, a.ingProductos, a.ingGobierno, a.ingOtros, a.ingTotal, a.familias.size > 0 ? a.ingTotal / a.familias.size : 0])
    );
    s2.getRow(1).font = { bold: true };

    const s3 = workbook.addWorksheet("Fuentes por producto");
    s3.addRow(["Producto", "Ingreso mensual total", "Encuestas"]);
    topProductos.forEach((p) => s3.addRow([p.nombre, p.ingreso, p.encuestas.size]));
    s3.getRow(1).font = { bold: true };

    const s4 = workbook.addWorksheet("Comparacion rondas");
    s4.addRow([comparaNivelLabel, ...rondasOrdenadas.map((r) => r.nombre), "Variacion %"]);
    pivotRondas.forEach((row) =>
      s4.addRow([row.clave, ...row.valores.map((v) => (v == null ? "" : v)), row.variacion == null ? "" : Math.round(row.variacion)])
    );
    s4.getRow(1).font = { bold: true };

    // Detalle desglosado: por cada familia, cada fuente (producto/apoyo/otro) con cantidades y valor.
    const s5 = workbook.addWorksheet("Detalle ingresos");
    s5.addRow(["Familia", "Departamento", "Municipio", "Vereda", "Ronda", "Fuente", "Detalle", "Producido", "Consumido", "Vendido", "Precio unitario", "Valor/Ingreso mensual", "Apoyo ACT"]);
    rows.forEach((r) => {
      productos.filter((p) => p.encuesta_id === r.encuestaId).forEach((p) => {
        s5.addRow([
          r.familia, r.departamento, r.municipio, r.vereda, r.ronda, "Producto", nombreProducto(p),
          p.cantidad_producida ?? 0, p.consumo ?? 0, p.vendido ?? 0, p.precio_unitario ?? 0, p.ingreso_mensual ?? 0, p.apoyo_act ? "Si" : "No"
        ]);
      });
      apoyos.filter((a) => a.encuesta_id === r.encuestaId).forEach((a) => {
        s5.addRow([
          r.familia, r.departamento, r.municipio, r.vereda, r.ronda, "Apoyo gobierno",
          tipoApoyoById.get(a.tipo_apoyo_id)?.nombre ?? a.nombre_libre ?? "Apoyo", "", "", "", "", a.valor_mensual ?? 0, ""
        ]);
      });
      pagos.filter((p) => p.encuesta_id === r.encuestaId).forEach((p) => {
        s5.addRow([
          r.familia, r.departamento, r.municipio, r.vereda, r.ronda, "Otro ingreso",
          tipoPagoById.get(p.tipo_pago_id)?.nombre ?? "Ingreso", "", "", "", "", p.valor_mensual ?? 0, ""
        ]);
      });
    });
    s5.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `economia-familiar-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>Economía Familiar</h2>
          <div className="muted">
            Fuentes de ingreso por familia y su comparación por vereda, municipio y departamento.
            {projects.length > 0 ? "" : " (Seleccione un proyecto para ver datos.)"}
          </div>
        </div>
        <button className="secondary" type="button" onClick={() => void exportarExcel()} disabled={loading}>
          Descargar Excel Economía
        </button>
      </div>

      {schemaError ? <div className="alert error">{schemaError}</div> : null}
      {loadError ? <div className="alert error">No fue posible cargar Economía Familiar: {loadError}</div> : null}
      {loading ? <div className="muted">Cargando…</div> : null}

      {!loading && !schemaError && !loadError ? (
        <>
          <div className="panel grid compact-panel">
            <label>
              Ronda
              <select value={rondaFilter} onChange={(e) => setRondaFilter(e.target.value)}>
                <option value="all">Todas las rondas</option>
                {rondas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Agregar por
              <select value={nivel} onChange={(e) => setNivel(e.target.value as EconomiaNivel)}>
                <option value="departamento">Departamento</option>
                <option value="municipio">Municipio</option>
                <option value="vereda">Vereda</option>
              </select>
            </label>
          </div>

          <div className="summary-grid">
            <div className="metric">
              <strong>{totales.encuestas}</strong>
              <span>Encuestas</span>
            </div>
            <div className="metric">
              <strong>{totales.familias}</strong>
              <span>Familias</span>
            </div>
            <div className="metric">
              <strong>{formatMoney(totales.ingTotal)}</strong>
              <span>Ingreso total mensual</span>
            </div>
            <div className="metric">
              <strong>{formatMoney(totales.promedio)}</strong>
              <span>Promedio por familia</span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">Fuentes de ingreso</div>
            <div className="summary-grid">
              <div className="metric">
                <strong>{formatMoney(totales.ingProductos)}</strong>
                <span>Venta de productos</span>
              </div>
              <div className="metric">
                <strong>{formatMoney(totales.ingGobierno)}</strong>
                <span>Apoyos del gobierno</span>
              </div>
              <div className="metric">
                <strong>{formatMoney(totales.ingOtros)}</strong>
                <span>Otros ingresos</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">Comparación por {nivel}</div>
            <div className="tracking-table-wrapper">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>{nivelLabel}</th>
                    <th>Familias</th>
                    <th>Encuestas</th>
                    <th>Ing. productos</th>
                    <th>Ing. gobierno</th>
                    <th>Ing. otros</th>
                    <th>Ing. total</th>
                    <th>Promedio/familia</th>
                  </tr>
                </thead>
                <tbody>
                  {aggRows.map((a) => (
                    <tr key={a.clave}>
                      <td>{a.clave}</td>
                      <td>{a.familias.size}</td>
                      <td>{a.encuestas}</td>
                      <td>{formatMoney(a.ingProductos)}</td>
                      <td>{formatMoney(a.ingGobierno)}</td>
                      <td>{formatMoney(a.ingOtros)}</td>
                      <td>{formatMoney(a.ingTotal)}</td>
                      <td>{formatMoney(a.familias.size > 0 ? a.ingTotal / a.familias.size : 0)}</td>
                    </tr>
                  ))}
                  {aggRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="muted">
                        No hay encuestas para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">Comparación entre rondas (línea base vs monitoreos)</div>
            <div className="panel grid compact-panel">
              <label>
                Comparar por
                <select value={comparaNivel} onChange={(e) => setComparaNivel(e.target.value as "familia" | EconomiaNivel)}>
                  <option value="familia">Familia</option>
                  <option value="departamento">Departamento</option>
                  <option value="municipio">Municipio</option>
                  <option value="vereda">Vereda</option>
                </select>
              </label>
              <div className="muted">Cada ronda es una columna; se agregan solas al crear nuevas rondas. El ingreso es el total mensual (productos + gobierno + otros).</div>
            </div>
            <div className="tracking-table-wrapper">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>{comparaNivelLabel}</th>
                    {rondasOrdenadas.map((r) => (
                      <th key={r.id}>{r.nombre}</th>
                    ))}
                    <th>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotRondas.map((row) => (
                    <tr key={row.clave}>
                      <td>{row.clave}</td>
                      {row.valores.map((v, i) => (
                        <td key={rondasOrdenadas[i]?.id ?? i}>{v == null ? "—" : formatMoney(v)}</td>
                      ))}
                      <td>{row.variacion == null ? "—" : `${row.variacion >= 0 ? "+" : ""}${row.variacion.toFixed(0)}%`}</td>
                    </tr>
                  ))}
                  {pivotRondas.length === 0 ? (
                    <tr>
                      <td colSpan={rondasOrdenadas.length + 2} className="muted">
                        No hay encuestas registradas todavía.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">Detalle por familia</div>
            <div className="muted">Pulse &quot;Ver&quot; para desglosar los ingresos de cada familia por fuente (productos con cantidades y valor, apoyos del gobierno y otros ingresos).</div>
            <div className="tracking-table-wrapper">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Familia</th>
                    <th>Departamento</th>
                    <th>Municipio</th>
                    <th>Vereda</th>
                    <th>Ronda</th>
                    <th>Personas</th>
                    <th>Ing. productos</th>
                    <th>Ing. gobierno</th>
                    <th>Ing. otros</th>
                    <th>Ing. total</th>
                    <th>Jornal</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const abierto = expandedEncuesta === r.encuestaId;
                    const prods = productos.filter((p) => p.encuesta_id === r.encuestaId);
                    const aps = apoyos.filter((a) => a.encuesta_id === r.encuestaId);
                    const pgs = pagos.filter((p) => p.encuesta_id === r.encuestaId);
                    return (
                      <Fragment key={r.encuestaId}>
                        <tr>
                          <td>
                            <button className="secondary" type="button" onClick={() => setExpandedEncuesta(abierto ? null : r.encuestaId)}>
                              {abierto ? "Ocultar" : "Ver"}
                            </button>
                          </td>
                          <td>{r.familia}</td>
                          <td>{r.departamento}</td>
                          <td>{r.municipio}</td>
                          <td>{r.vereda}</td>
                          <td>{r.ronda}</td>
                          <td>{r.personas}</td>
                          <td>{formatMoney(r.ingProductos)}</td>
                          <td>{formatMoney(r.ingGobierno)}</td>
                          <td>{formatMoney(r.ingOtros)}</td>
                          <td>{formatMoney(r.ingTotal)}</td>
                          <td>{formatMoney(r.jornal)}</td>
                        </tr>
                        {abierto ? (
                          <tr>
                            <td colSpan={12}>
                              <div className="panel">
                                <div className="panel-heading">Productos que generan ingreso</div>
                                <div className="tracking-table-wrapper">
                                  <table className="tracking-table">
                                    <thead>
                                      <tr>
                                        <th>Producto</th>
                                        <th>Producido</th>
                                        <th>Consumido</th>
                                        <th>Vendido</th>
                                        <th>Precio unitario</th>
                                        <th>Ingreso mensual</th>
                                        <th>Apoyo ACT</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {prods.map((p) => (
                                        <tr key={p.id}>
                                          <td>{nombreProducto(p)}{p.es_pecuario ? " (pecuario)" : ""}</td>
                                          <td>{p.cantidad_producida ?? 0}</td>
                                          <td>{p.consumo ?? 0}</td>
                                          <td>{p.vendido ?? 0}</td>
                                          <td>{formatMoney(p.precio_unitario ?? 0)}</td>
                                          <td>{formatMoney(p.ingreso_mensual ?? 0)}</td>
                                          <td>{p.apoyo_act ? "Sí" : "No"}</td>
                                        </tr>
                                      ))}
                                      {prods.length === 0 ? (
                                        <tr>
                                          <td colSpan={7} className="muted">Sin productos registrados.</td>
                                        </tr>
                                      ) : null}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="panel-heading">Apoyos del gobierno</div>
                                {aps.length === 0 ? (
                                  <div className="muted">Ninguno.</div>
                                ) : (
                                  <ul>
                                    {aps.map((a) => (
                                      <li key={a.id}>
                                        {tipoApoyoById.get(a.tipo_apoyo_id)?.nombre ?? a.nombre_libre ?? "Apoyo"}: {formatMoney(a.valor_mensual ?? 0)} / mes
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div className="panel-heading">Otros ingresos</div>
                                {pgs.length === 0 ? (
                                  <div className="muted">Ninguno.</div>
                                ) : (
                                  <ul>
                                    {pgs.map((p) => (
                                      <li key={p.id}>
                                        {tipoPagoById.get(p.tipo_pago_id)?.nombre ?? "Ingreso"}: {formatMoney(p.valor_mensual ?? 0)} / mes
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="muted">
                        No hay encuestas para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">Productos con más ingreso</div>
            <div className="tracking-table-wrapper">
              <table className="tracking-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Ingreso mensual total</th>
                    <th>Encuestas</th>
                  </tr>
                </thead>
                <tbody>
                  {topProductos.map((p) => (
                    <tr key={p.nombre}>
                      <td>{p.nombre}</td>
                      <td>{formatMoney(p.ingreso)}</td>
                      <td>{p.encuestas.size}</td>
                    </tr>
                  ))}
                  {topProductos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        Sin productos registrados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
