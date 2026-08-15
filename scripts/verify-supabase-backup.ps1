param([Parameter(Mandatory = $true)][string]$BackupDirectory)

$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path -LiteralPath $BackupDirectory).Path
$manifestPath = Join-Path $resolved "manifest.json"
if (!(Test-Path -LiteralPath $manifestPath)) { throw "No existe manifest.json en el respaldo." }

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
foreach ($file in $manifest.files) {
    $path = Join-Path $resolved $file.name
    if (!(Test-Path -LiteralPath $path)) { throw "Falta el archivo $($file.name)." }
    $item = Get-Item -LiteralPath $path
    if ($item.Length -ne $file.bytes) { throw "Tamano incorrecto en $($file.name)." }
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($hash -ne $file.sha256) { throw "SHA-256 incorrecto en $($file.name)." }
}

$schema = Get-Content -Raw -LiteralPath (Join-Path $resolved "02-public-schema.sql")
$data = Get-Content -Raw -LiteralPath (Join-Path $resolved "03-public-data.sql")
$criticalTables = @(
    "projects", "users_profiles", "project_users", "families", "properties",
    "operational_plans", "plan_activities", "plan_project_materials", "plan_family_counterparts",
    "procurement_batches", "procurement_batch_items", "material_deliveries", "material_delivery_items",
    "economia_encuestas", "economia_encuesta_productos", "economia_encuesta_apoyos", "economia_encuesta_pagos"
)
foreach ($table in $criticalTables) {
    $tablePattern = "(?:public\.)?`"?" + [regex]::Escape($table) + "`"?"
    if ($schema -notmatch $tablePattern -and $data -notmatch $tablePattern) {
        throw "No se encontro la tabla critica public.$table en el respaldo."
    }
}

Write-Host "Integridad correcta: $($manifest.files.Count) archivos y $($criticalTables.Count) tablas criticas verificadas."
