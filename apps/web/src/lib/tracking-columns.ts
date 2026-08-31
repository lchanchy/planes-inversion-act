export const TRACKING_BASE_COLUMNS = [
  { key: "familyCode", label: "Código predio", width: 120 },
  { key: "familyName", label: "Familia", width: 210 },
  { key: "documentNumber", label: "Cédula", width: 115 },
  { key: "ageYears", label: "Edad", width: 90 },
  { key: "municipalityName", label: "Municipio", width: 150 },
  { key: "villageName", label: "Vereda", width: 170 },
  { key: "hectares", label: "Hectáreas", width: 130 }
] as const;

export type TrackingBaseColumnKey = typeof TRACKING_BASE_COLUMNS[number]["key"];

const TRACKING_EDITOR_ROLES = new Set(["super_admin", "project_admin", "municipal_technician"]);

export function canEditTracking(roleNames: Iterable<string>) {
  return Array.from(roleNames).some((role) => TRACKING_EDITOR_ROLES.has(role));
}

export function trackingFrozenOffsets(frozen: TrackingBaseColumnKey[]) {
  let left = 0;
  return Object.fromEntries(TRACKING_BASE_COLUMNS.map((column) => {
    if (!frozen.includes(column.key)) return [column.key, null];
    const offset = left;
    left += column.width;
    return [column.key, offset];
  })) as Record<TrackingBaseColumnKey, number | null>;
}
