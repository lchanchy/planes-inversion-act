"use client";

import { useEffect, useMemo, useState } from "react";
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
  Department,
  Family,
  Material,
  Municipality,
  OperationalPlan,
  PlanActivity,
  PlanFamilyCounterpart,
  PlanProjectMaterial,
  Profile,
  Project,
  ProjectDepartment,
  ProjectMunicipality,
  ProjectUser,
  ProjectVillage,
  ProvisionalMaterial,
  Role,
  Village
} from "@/lib/types";

type ViewKey = "dashboard" | "projects" | "profiles" | "families" | "activities" | "materials" | "counterparts" | "plans";
type Notice = { type: "info" | "error"; message: string } | null;
type ProjectLogoPosition = "left" | "center" | "right" | "bottom-left" | "bottom-center" | "bottom-right";
type ProjectLogoConfig = { id: string; dataUrl: string; position: ProjectLogoPosition; name: string; size: number };

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
  phone: "",
  municipality_id: "",
  village_id: "",
  observations: "",
  status: "active",
  validation_status: "validated"
};

const emptyActivity = {
  project_id: "",
  name: "",
  category: "",
  description: "",
  unit: "",
  indicator_type: "physical",
  requires_baseline: false,
  requires_target: true,
  allows_project_materials: true,
  allows_counterpart: true,
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
        </section>
      </main>
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

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setNotice({ type: "error", message: error.message });
    }
    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-box">
        <h1>Restauracion Admin</h1>
        <p>Ingreso para administradores, coordinadores, tecnicos, visores y auditores.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Correo
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Contrasena
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </label>
          <button disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
          {notice ? <div className={`alert ${notice.type}`}>{notice.message}</div> : null}
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
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

  const canWrite = roleNames.has("admin") || roleNames.has("coordinator");
  const canManageProfiles = roleNames.has("admin");

  async function loadAll() {
    setLoading(true);
    setNotice(null);
    try {
      const [
        rolesResult,
        profileResult,
        membershipsResult,
        projectsResult,
        profilesResult,
        familiesResult,
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
        projectVillagesResult
      ] = await Promise.all([
        supabase.from("roles").select("id,name,description,permissions").order("name"),
        supabase.from("users_profiles").select("*").eq("auth_user_id", session.user.id).maybeSingle(),
        supabase.from("project_users").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("users_profiles").select("*").order("full_name"),
        supabase.from("families").select("*").order("created_at", { ascending: false }),
        supabase.from("activity_catalog").select("*").order("name"),
        supabase.from("material_catalog").select("*").order("name"),
        supabase.from("counterpart_catalog").select("*").eq("is_deleted", false).order("name"),
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
        supabase.from("project_villages").select("*").eq("is_deleted", false)
      ]);

      const error = [
        rolesResult.error,
        profileResult.error,
        membershipsResult.error,
        projectsResult.error,
        profilesResult.error,
        familiesResult.error,
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

      setRoles((rolesResult.data ?? []) as Role[]);
      setProfile((profileResult.data as Profile | null) ?? null);
      setProjectUsers((membershipsResult.data ?? []) as ProjectUser[]);
      setProjects((projectsResult.data ?? []) as Project[]);
      setProfiles((profilesResult.data ?? []) as Profile[]);
      setFamilies((familiesResult.data ?? []) as Family[]);
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

  const views: { key: ViewKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "projects", label: "Proyectos" },
    { key: "profiles", label: "Usuarios" },
    { key: "families", label: "Familias" },
    { key: "activities", label: "Actividades" },
    { key: "materials", label: "Materiales" },
    { key: "counterparts", label: "Contrapartidas" },
    { key: "plans", label: "Planes Operativos" }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Restauracion Admin</h1>
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
          <div>
            <strong>{profile?.full_name ?? session.user.email}</strong>
            <div className="muted">
              {[...roleNames].join(", ") || "Sin perfil/rol asignado"}
            </div>
          </div>
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
          {notice ? <div className={`alert ${notice.type}`}>{notice.message}</div> : null}
          {!profile ? (
            <div className="alert info">
              No existe perfil para este usuario. Un administrador debe crear un registro en usuarios/perfiles.
            </div>
          ) : null}
          {view === "dashboard" ? (
            <Dashboard
              projects={projects}
              profiles={profiles}
              families={families}
              activities={activities}
              materials={materials}
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
            <ProfilesCrud profiles={profiles} roles={roles} canWrite={canManageProfiles} onChange={loadAll} />
          ) : null}
          {view === "families" ? (
            <FamiliesCrud
              families={families}
              projects={projects}
              projectMunicipalities={projectMunicipalities}
              projectVillages={projectVillages}
              municipalities={municipalities}
              villages={villages}
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
              plans={plans}
              projects={projects}
              families={families}
              municipalities={municipalities}
              villages={villages}
              activities={activities}
              materials={materials}
              planActivities={planActivities}
              planMaterials={planMaterials}
              planCounterparts={planCounterparts}
              provisionalMaterials={provisionalMaterials}
              canReview={canWrite}
              canManageLogos={roleNames.has("admin")}
              currentProfile={profile}
              onChange={loadAll}
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
  activities,
  materials
}: {
  projects: Project[];
  profiles: Profile[];
  families: Family[];
  activities: Activity[];
  materials: Material[];
}) {
  return (
    <section className="section">
      <div className="toolbar">
        <h2>Dashboard basico</h2>
      </div>
      <div className="summary-grid">
        <Metric label="Proyectos" value={projects.length} />
        <Metric label="Usuarios" value={profiles.length} />
        <Metric label="Familias" value={families.length} />
        <Metric label="Actividades" value={activities.length} />
        <Metric label="Materiales" value={materials.length} />
      </div>
      <div className="panel">
        <h3>Estado operativo</h3>
        <p className="muted">
          Fase 2 incluye administracion base. Planes operativos, compras, actas, indicadores y reportes se implementan
          en fases posteriores.
        </p>
      </div>
    </section>
  );
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

  return (
    <CrudSection title="Proyectos" canWrite={canWrite} notice={notice}>
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
  canWrite,
  onChange
}: {
  profiles: Profile[];
  roles: Role[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const roleName = (id?: string | null) => roles.find((role) => role.id === id)?.name ?? "";

  function edit(profile: Profile) {
    setEditingId(profile.id);
    setForm({
      auth_user_id: profile.auth_user_id,
      full_name: profile.full_name,
      document_number: profile.document_number ?? "",
      phone: profile.phone ?? "",
      default_role_id: profile.default_role_id ?? "",
      active: profile.active
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setNotice(null);
    const payload = {
      ...form,
      default_role_id: form.default_role_id || null,
      document_number: form.document_number || null,
      phone: form.phone || null
    };
    const result = editingId
      ? await supabase.from("users_profiles").update(payload).eq("id", editingId)
      : await supabase.from("users_profiles").insert(payload);
    if (result.error) {
      setNotice({ type: "error", message: result.error.message });
      return;
    }
    setForm(emptyProfile);
    setEditingId(null);
    await onChange();
  }

  async function remove(id: string) {
    if (!canWrite) return;
    const { error } = await supabase.from("users_profiles").update({ is_deleted: true, active: false }).eq("id", id);
    if (error) setNotice({ type: "error", message: error.message });
    await onChange();
  }

  return (
    <CrudSection title="Usuarios / perfiles" canWrite={canWrite} notice={notice}>
      <div className="alert info">
        Este CRUD administra perfiles. La cuenta de autenticacion debe existir primero en Supabase Auth.
      </div>
      <form className="panel grid" onSubmit={save}>
        <TextInput
          label="Auth user ID"
          value={form.auth_user_id}
          onChange={(auth_user_id) => setForm({ ...form, auth_user_id })}
          required
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
          Rol por defecto
          <select value={form.default_role_id} onChange={(event) => setForm({ ...form, default_role_id: event.target.value })}>
            <option value="">Sin rol</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </label>
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
        headers={["Nombre", "Auth user ID", "Rol", "Activo", "Acciones"]}
        rows={profiles.map((item) => [
          item.full_name,
          item.auth_user_id,
          roleName(item.default_role_id),
          item.active ? "Si" : "No",
          <Actions key="actions" canWrite={canWrite} onEdit={() => edit(item)} onDelete={() => remove(item.id)} />
        ])}
      />
    </CrudSection>
  );
}

function FamiliesCrud({
  families,
  projects,
  projectMunicipalities,
  projectVillages,
  municipalities,
  villages,
  canWrite,
  onChange
}: {
  families: Family[];
  projects: Project[];
  projectMunicipalities: ProjectMunicipality[];
  projectVillages: ProjectVillage[];
  municipalities: Municipality[];
  villages: Village[];
  canWrite: boolean;
  onChange: () => Promise<void>;
}) {
  const [form, setForm] = useState(emptyFamily);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [importProjectId, setImportProjectId] = useState("");
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

  function edit(family: Family) {
    setEditingId(family.id);
    setForm({
      project_id: family.project_id,
      family_code: family.family_code,
      representative_name: family.representative_name,
      document_number: family.document_number ?? "",
      age: family.age?.toString() ?? "",
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
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
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

  return (
    <CrudSection title="Familias" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Cargar familias desde CSV exportado de Excel</strong></div>
        <SelectProject projects={projects} value={importProjectId} onChange={setImportProjectId} />
        <label className="span-8">
          Archivo CSV
          <input
            accept=".csv,text/csv"
            disabled={!canWrite || !importProjectId}
            onChange={(event) => importFamilies(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <p className="span-12 muted">
          Columnas esperadas: codigo familiar/codigo predial, representante, documento, telefono, departamento,
          municipio, vereda, predio, area predio.
        </p>
      </div>
      <form className="panel grid" onSubmit={save}>
        <SelectProject
          projects={projects}
          value={form.project_id}
          onChange={(project_id) =>
            setForm({ ...form, project_id, municipality_id: "", village_id: "" })
          }
        />
        <TextInput
          label="Codigo familiar"
          value={form.family_code}
          onChange={(family_code) => setForm({ ...form, family_code })}
          required
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
      <DataTable
        headers={["Codigo", "Representante", "Documento", "Estado", "Acciones"]}
        rows={families.map((family) => [
          family.family_code,
          family.representative_name,
          family.document_number ?? "",
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

  function edit(activity: Activity) {
    setEditingId(activity.id);
    setForm({
      project_id: activity.project_id ?? "",
      name: activity.name,
      category: activity.category ?? "",
      description: activity.description ?? "",
      unit: activity.unit,
      indicator_type: activity.indicator_type ?? "physical",
      requires_baseline: activity.requires_baseline,
      requires_target: activity.requires_target,
      allows_project_materials: activity.allows_project_materials,
      allows_counterpart: activity.allows_counterpart,
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
      category: form.category || null,
      description: form.description || null,
      indicator_type: form.indicator_type || null
    };
    const result = editingId
      ? await supabase.from("activity_catalog").update(payload).eq("id", editingId)
      : await supabase.from("activity_catalog").insert(payload);
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
        category: csvValue(row, ["categoria", "categoría"]) || null,
        unit,
        requires_baseline: csvBool(csvValue(row, ["requiere linea base", "linea base"]), false),
        requires_target: csvBool(csvValue(row, ["requiere meta", "meta"]), true),
        active: csvBool(csvValue(row, ["activo", "estado"]), true),
        allows_project_materials: true,
        allows_counterpart: true,
        indicator_type: "physical"
      }];
    });
    if (payload.length > 0) {
      const { error } = await supabase.from("activity_catalog").insert(payload);
      if (error) {
        setNotice({ type: "error", message: error.message });
        return;
      }
    }
    setNotice({ type: "info", message: `Importacion finalizada. Creadas: ${created}. Omitidas: ${skipped}.` });
    await onChange();
  }

  return (
    <CrudSection title="Catalogo de actividades" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Cargar actividades desde CSV exportado de Excel</strong></div>
        <SelectProject projects={projects} value={importProjectId} onChange={setImportProjectId} />
        <label className="span-8">
          Archivo CSV
          <input accept=".csv,text/csv" disabled={!canWrite} onChange={(event) => importActivities(event.target.files?.[0] ?? null)} type="file" />
        </label>
        <p className="span-12 muted">Columnas esperadas: nombre actividad, categoria, unidad, requiere linea base, requiere meta, estado/activo.</p>
      </div>
      <form className="panel grid" onSubmit={save}>
        <SelectProject projects={projects} value={form.project_id} onChange={(project_id) => setForm({ ...form, project_id })} />
        <TextInput label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <TextInput label="Categoria" value={form.category} onChange={(category) => setForm({ ...form, category })} />
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
        <div className="span-12 form-actions">
          <button disabled={!canWrite}>{editingId ? "Actualizar" : "Crear"}</button>
          {editingId ? (
            <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(emptyActivity); }}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      <DataTable
        headers={["Nombre", "Categoria", "Unidad", "Activo", "Acciones"]}
        rows={activities.map((activity) => [
          activity.name,
          activity.category ?? "",
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

  function edit(material: Material) {
    setEditingId(material.id);
    setForm({
      project_id: material.project_id ?? "",
      internal_code: material.internal_code ?? "",
      name: material.name,
      category: material.category ?? "",
      unit: material.unit,
      quoted_unit_price: material.quoted_unit_price.toString(),
      price_updated_at: material.price_updated_at ?? "",
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
      category: form.category || null,
      quoted_unit_price: Number(form.quoted_unit_price || 0),
      price_updated_at: form.price_updated_at || null,
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
      const category = csvValue(row, ["categoria", "categoría"]);
      if (!name || !unit) {
        skipped += 1;
        return [];
      }
      const duplicate = materials.some((material) =>
        (material.project_id ?? "") === importProjectId &&
        sameText(material.name, name) &&
        sameText(material.category, category) &&
        sameText(material.unit, unit)
      );
      if (duplicate) {
        skipped += 1;
        return [];
      }
      created += 1;
      return [{
        project_id: importProjectId || null,
        internal_code: csvValue(row, ["codigo", "codigo interno"]) || null,
        name,
        category: category || null,
        unit,
        quoted_unit_price: Number(csvValue(row, ["valor unitario", "precio", "precio cotizado"]) || 0),
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

  return (
    <CrudSection title="Catalogo de materiales" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Cargar materiales desde CSV exportado de Excel</strong></div>
        <SelectProject projects={projects} value={importProjectId} onChange={setImportProjectId} />
        <label className="span-8">
          Archivo CSV
          <input accept=".csv,text/csv" disabled={!canWrite} onChange={(event) => importMaterials(event.target.files?.[0] ?? null)} type="file" />
        </label>
        <p className="span-12 muted">Columnas esperadas: nombre material, categoria, unidad, valor unitario, estado/activo.</p>
      </div>
      <form className="panel grid" onSubmit={save}>
        <SelectProject projects={projects} value={form.project_id} onChange={(project_id) => setForm({ ...form, project_id })} />
        <TextInput label="Codigo interno" value={form.internal_code} onChange={(internal_code) => setForm({ ...form, internal_code })} />
        <TextInput label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
        <TextInput label="Categoria" value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <TextInput label="Unidad" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} required />
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
      <DataTable
        headers={["Nombre", "Categoria", "Unidad", "Precio", "Acciones"]}
        rows={materials.map((material) => [
          material.name,
          material.category ?? "",
          material.unit,
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

  return (
    <CrudSection title="Catalogo de contrapartidas familiares" canWrite={canWrite} notice={notice}>
      <div className="panel grid">
        <div className="span-12"><strong>Cargar contrapartidas desde CSV exportado de Excel</strong></div>
        <SelectProject projects={projects} value={importProjectId} onChange={setImportProjectId} />
        <label className="span-8">
          Archivo CSV
          <input accept=".csv,text/csv" disabled={!canWrite} onChange={(event) => importCounterparts(event.target.files?.[0] ?? null)} type="file" />
        </label>
        <p className="span-12 muted">Columnas esperadas: aporte/descripcion, tipo, unidad sugerida, estado/activo.</p>
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
            <option value="mano_obra">Mano de obra</option>
            <option value="material_propio">Materiales propios</option>
            <option value="otro">Otros aportes</option>
          </select>
        </label>
        <TextInput label="Unidad sugerida" value={form.suggested_unit} onChange={(suggested_unit) => setForm({ ...form, suggested_unit })} required />
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
          item.type,
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

  useEffect(() => {
    setProjectLogos(loadProjectLogos());
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const visiblePlans = plans.filter((plan) => {
    const family = families.find((item) => item.id === plan.family_id);
    if (filters.projectId && plan.project_id !== filters.projectId) return false;
    if (filters.familyId && plan.family_id !== filters.familyId) return false;
    if (filters.status && plan.status !== filters.status) return false;
    if (filters.municipalityId && family?.municipality_id !== filters.municipalityId) return false;
    if (filters.villageId && family?.village_id !== filters.villageId) return false;
    return true;
  });

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
    const nextLogos = {
      ...projectLogos,
      [logoProjectId]: [
        ...(projectLogos[logoProjectId] ?? []),
        { id: crypto.randomUUID(), dataUrl, position: logoPosition, name: file.name, size: clampLogoSize(Number(logoSize)) }
      ]
    };
    setProjectLogos(nextLogos);
    saveProjectLogos(nextLogos);
    setNotice({ type: "info", message: "Logo agregado para el proyecto seleccionado." });
    event.target.value = "";
  }

  function removeLogo(logoId: string) {
    if (!logoProjectId) return;
    const nextLogos = { ...projectLogos };
    nextLogos[logoProjectId] = (nextLogos[logoProjectId] ?? []).filter((logo) => logo.id !== logoId);
    if (nextLogos[logoProjectId].length === 0) delete nextLogos[logoProjectId];
    setProjectLogos(nextLogos);
    saveProjectLogos(nextLogos);
    setNotice({ type: "info", message: "Logo retirado." });
  }

  function updateLogo(logoId: string, updates: Partial<ProjectLogoConfig>) {
    if (!logoProjectId) return;
    const nextLogos = {
      ...projectLogos,
      [logoProjectId]: (projectLogos[logoProjectId] ?? []).map((logo) =>
        logo.id === logoId ? { ...logo, ...updates } : logo
      )
    };
    setProjectLogos(nextLogos);
    saveProjectLogos(nextLogos);
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
      {notice ? <div className={`alert ${notice.type}`}>{notice.message}</div> : null}
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
          <strong>Logo para exportacion</strong>
          <p className="muted">El administrador puede cargar varios logos JPG/PNG por proyecto y definir posicion y tamano para PDF y Word.</p>
        </div>
        <label className="span-4">
          Proyecto del logo
          <select value={logoProjectId} onChange={(event) => setLogoProjectId(event.target.value)}>
            <option value="">Seleccione</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="span-4">
          Logo JPG/PNG
          <input disabled={!canManageLogos || !logoProjectId} type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} />
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
          <input
            disabled={!canManageLogos}
            min="40"
            max="360"
            type="number"
            value={logoSize}
            onChange={(event) => setLogoSize(event.target.value)}
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
                  <input
                    disabled={!canManageLogos}
                    min="40"
                    max="360"
                    type="number"
                    value={logo.size}
                    onChange={(event) => updateLogo(logo.id, { size: clampLogoSize(Number(event.target.value)) })}
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
            disabled={visiblePlans.length === 0}
            onClick={() => void exportPlansAsPdf(visiblePlans, exportContext)}
          >
            Exportar PDF visibles
          </button>
          <button
            className="secondary"
            type="button"
            disabled={visiblePlans.length === 0}
            onClick={() => void exportPlansAsWord(visiblePlans, exportContext)}
          >
            Exportar Word visibles
          </button>
        </div>
      </div>
      <div className="grid">
        <div className="span-6">
          <DataTable
            headers={["Codigo", "Familia", "Municipio", "Vereda", "Estado"]}
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
                <span className="badge" key="status">{planStatusLabel(plan.status)}</span>
              ];
            })}
          />
        </div>
        <div className="span-6">
          {selectedPlan ? (
            <PlanDetail
              plan={selectedPlan}
              families={families}
              activities={activities}
              materials={materials}
              planActivities={selectedPlanActivities}
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
  onResolveMaterial
}: {
  plan: OperationalPlan;
  families: Family[];
  activities: Activity[];
  materials: Material[];
  planActivities: PlanActivity[];
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
}) {
  const family = families.find((item) => item.id === plan.family_id);
  const validation = validatePlanForApproval(plan, { activities, planActivities, planMaterials, provisionalMaterials });
  const canEditStatus = canReview && !["approved", "closed"].includes(plan.status);
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
              <h5>Materiales del proyecto</h5>
              <DataTable
                headers={["Material", "Cantidad", "Unidad", "Valor cotizado", "Resolver"]}
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
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>{material.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge" key="ok">OK</span>
                    )
                  ];
                })}
              />
              <h5>Contrapartida familiar</h5>
              <DataTable
                headers={["Aporte", "Cantidad", "Unidad", "Valor estimado"]}
                rows={counterpartsForActivity.map((item) => [
                  item.name,
                  item.quantity,
                  item.unit,
                  formatMoney(item.estimated_total)
                ])}
              />
            </div>
          );
        })
      )}
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
  const projectSubtotal = projectMaterials.reduce((sum, item) => sum + item.quantity * item.quoted_unit_price, 0);
  const familyRows = familyCounterparts.length > 0
    ? familyCounterparts.map((item) => [
        item.name,
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
        return [
          `${official?.name ?? provisional?.provisional_name ?? item.observations ?? ""}${provisional?.status === "pending" ? " (pendiente)" : ""}`,
          formatQuantity(item.quantity, item.unit),
          formatExportMoney(item.quoted_unit_price),
          formatExportMoney(item.quantity * item.quoted_unit_price)
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
      .reduce((partial, material) => partial + material.quantity * material.quoted_unit_price, 0);
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
  const projectSubtotal = projectMaterials.reduce((sum, item) => sum + item.quantity * item.quoted_unit_price, 0);
  const familyRows = familyCounterparts.length > 0
    ? familyCounterparts.map((familyItem) => `<tr>
      <td>${escapeHtml(familyItem.name)}</td>
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
    return `<tr>
      <td>${escapeHtml(projectMaterial?.name ?? provisional?.provisional_name ?? projectItem.observations ?? "")}${provisional?.status === "pending" ? " (pendiente)" : ""}</td>
      <td class="qty">${formatQuantity(projectItem.quantity, projectItem.unit)}</td>
      <td class="number">${formatExportMoney(projectItem.quoted_unit_price)}</td>
      <td class="number">${formatExportMoney(projectItem.quantity * projectItem.quoted_unit_price)}</td>
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
    observations: null,
    is_deleted: false
  }));
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
  y += 16;
  doc.text(`Linea base: ${activity.baseline ?? "N/A"} | Meta: ${activity.target ?? "N/A"} | Unidad: ${activity.unit}`, doc.margin, y, 9);
  y += 16;
  const familyRows = familyCounterparts.length > 0
    ? familyCounterparts.map((item) => [
        item.name,
        formatQuantity(item.quantity, item.unit),
        formatExportMoney(item.estimated_unit_value),
        formatExportMoney(item.quantity * item.estimated_unit_value)
      ])
    : [["Sin aportes de la familia.", "", "", ""]];
  const familySubtotal = familyCounterparts.reduce((sum, item) => sum + item.quantity * item.estimated_unit_value, 0);
  y = drawPdfTable(doc, y, ["APORTE DE LA FAMILIA", "CANTIDAD", "VALOR UNI", "VALOR TOTAL"], [
    ...familyRows,
    ["SUBTOTAL FAMILIA", "", "", formatExportMoney(familySubtotal)]
  ], [250, 80, 90, 100]);
  const projectRows = projectMaterials.length > 0
    ? projectMaterials.map((item) => {
        const official = item.material_id ? context.materials.find((material) => material.id === item.material_id) : null;
        const provisional = item.provisional_material_id
          ? context.provisionalMaterials.find((material) => material.id === item.provisional_material_id)
          : null;
        return [
          `${official?.name ?? provisional?.provisional_name ?? item.observations ?? ""}${provisional?.status === "pending" ? " (pendiente)" : ""}`,
          formatQuantity(item.quantity, item.unit),
          formatExportMoney(item.quoted_unit_price),
          formatExportMoney(item.quantity * item.quoted_unit_price)
        ];
      })
    : [["Sin materiales del proyecto.", "", "", ""]];
  const projectSubtotal = projectMaterials.reduce((sum, item) => sum + item.quantity * item.quoted_unit_price, 0);
  return drawPdfTable(doc, y, ["APORTE DEL PROYECTO", "CANTIDAD", "VALOR UNI", "VALOR TOTAL"], [
    ...projectRows,
    ["SUBTOTAL PROYECTO", "", "", formatExportMoney(projectSubtotal)]
  ], [250, 80, 90, 100]) + 4;
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

function drawPdfTable(doc: PdfDocumentBuilder, startY: number, headers: string[], rows: string[][], widths: number[]) {
  let y = doc.ensureSpace(startY, 44);
  const rowHeight = 19;
  let x = doc.margin;
  for (const [index, header] of headers.entries()) {
    doc.rect(x, y, widths[index], rowHeight, "f3f6f1");
    doc.text(header, x + 3, y + 12, 8, true);
    x += widths[index];
  }
  y += rowHeight;
  for (const row of rows) {
    y = doc.ensureSpace(y, rowHeight + 4);
    x = doc.margin;
    for (const [index, cell] of row.entries()) {
      doc.rect(x, y, widths[index], rowHeight);
      const alignRight = index >= 2;
      doc.text(cell, x + 3, y + 12, 8, false, "111111", widths[index] - 6, alignRight);
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

function loadProjectLogos(): Record<string, ProjectLogoConfig[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem("project_export_logos") ?? "{}") as Record<string, string | ProjectLogoConfig[]>;
    return Object.fromEntries(
      Object.entries(raw).map(([projectId, value]) => [
        projectId,
        Array.isArray(value)
          ? value.map((logo) => ({ ...logo, size: clampLogoSize(logo.size) }))
          : [{ id: crypto.randomUUID(), dataUrl: value, position: "right", name: "Logo", size: 90 }]
      ])
    ) as Record<string, ProjectLogoConfig[]>;
  } catch {
    return {};
  }
}

function saveProjectLogos(logos: Record<string, ProjectLogoConfig[]>) {
  window.localStorage.setItem("project_export_logos", JSON.stringify(logos));
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

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="panel">
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
              <td colSpan={headers.length} className="muted">Sin registros visibles.</td>
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
      <button className="danger" type="button" disabled={!canWrite} onClick={onDelete}>Inactivar</button>
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}
