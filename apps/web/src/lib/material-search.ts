import type { Material } from "./types";

export function materialSuggestions(materials: Material[], query: string): Material[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return materials.filter((material) => !material.is_deleted && material.active &&
    words.every((word) => normalize(`${material.name} ${material.internal_code ?? ""} ${material.unit}`).includes(word)))
    .sort((left, right) => left.name.localeCompare(right.name, "es"))
    .slice(0, 3);
}
