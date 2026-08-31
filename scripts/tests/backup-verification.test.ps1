$ErrorActionPreference = "Stop"
$testDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "act-backup-test-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $testDirectory | Out-Null

try {
    $criticalTables = @(
        "projects", "users_profiles", "project_users", "families", "properties",
        "operational_plans", "plan_activities", "plan_project_materials", "plan_family_counterparts",
        "procurement_batches", "procurement_batch_items", "material_deliveries", "material_delivery_items",
        "economia_encuestas", "economia_encuesta_productos", "economia_encuesta_apoyos", "economia_encuesta_pagos"
    )
    Set-Content -LiteralPath (Join-Path $testDirectory "01-roles.sql") -Value "create role authenticated;" -Encoding utf8
    $schema = $criticalTables | ForEach-Object { "create table public.$_ (id uuid);" }
    Set-Content -LiteralPath (Join-Path $testDirectory "02-public-schema.sql") -Value $schema -Encoding utf8
    Set-Content -LiteralPath (Join-Path $testDirectory "03-public-data.sql") -Value "-- respaldo ficticio sin registros" -Encoding utf8

    $files = Get-ChildItem -LiteralPath $testDirectory -Filter "*.sql" | Sort-Object Name | ForEach-Object {
        [ordered]@{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash }
    }
    [ordered]@{ formatVersion = 1; files = $files } | ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath (Join-Path $testDirectory "manifest.json") -Encoding utf8

    & (Join-Path $PSScriptRoot "..\verify-supabase-backup.ps1") -BackupDirectory $testDirectory
    Add-Content -LiteralPath (Join-Path $testDirectory "03-public-data.sql") -Value "alterado"
    try {
        & (Join-Path $PSScriptRoot "..\verify-supabase-backup.ps1") -BackupDirectory $testDirectory
        throw "El verificador acepto un archivo alterado."
    } catch {
        if ($_.Exception.Message -notmatch "Tamano incorrecto|SHA-256 incorrecto") { throw }
    }
    Write-Host "Prueba correcta: respaldo integro aceptado y respaldo alterado rechazado."
} finally {
    Remove-Item -LiteralPath $testDirectory -Recurse -Force
}
