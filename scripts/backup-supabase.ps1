param(
    [string]$OutputRoot = "$(Split-Path $PSScriptRoot -Parent) respaldos",
    [string]$DatabaseUrl = $env:SUPABASE_DB_URL,
    [string]$ProjectRef = "",
    [string]$DatabasePassword = $env:SUPABASE_DB_PASSWORD
)

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path ([System.IO.Path]::GetFullPath($OutputRoot)) "supabase-$stamp"
New-Item -ItemType Directory -Path $backupDirectory | Out-Null

function Invoke-Dump([string[]]$DumpArguments) {
    & npx.cmd supabase db dump @DumpArguments
    if ($LASTEXITCODE -ne 0) { throw "Supabase db dump termino con codigo $LASTEXITCODE." }
}

$connectionArguments = @()
if ($DatabaseUrl) {
    $connectionArguments += @("--db-url", $DatabaseUrl)
} elseif ($ProjectRef -and $DatabasePassword) {
    $connectionArguments += @("--project-ref", $ProjectRef, "--password", $DatabasePassword)
} else {
    Remove-Item -LiteralPath $backupDirectory -Force
    throw "Defina SUPABASE_DB_URL o proporcione ProjectRef y SUPABASE_DB_PASSWORD. No guarde esas credenciales en el repositorio."
}

$rolesFile = Join-Path $backupDirectory "01-roles.sql"
$schemaFile = Join-Path $backupDirectory "02-public-schema.sql"
$dataFile = Join-Path $backupDirectory "03-public-data.sql"

Invoke-Dump ($connectionArguments + @("--role-only", "--file", $rolesFile))
Invoke-Dump ($connectionArguments + @("--schema", "public", "--file", $schemaFile))
Invoke-Dump ($connectionArguments + @("--schema", "public", "--data-only", "--use-copy", "--file", $dataFile))

$files = @($rolesFile, $schemaFile, $dataFile) | ForEach-Object {
    $item = Get-Item -LiteralPath $_
    [ordered]@{
        name = $item.Name
        bytes = $item.Length
        sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
    }
}

$manifest = [ordered]@{
    formatVersion = 1
    createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    projectRef = $ProjectRef
    schema = "public"
    files = $files
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDirectory "manifest.json") -Encoding utf8

& (Join-Path $PSScriptRoot "verify-supabase-backup.ps1") -BackupDirectory $backupDirectory
if ($LASTEXITCODE -ne 0) { throw "El respaldo fue creado pero no supero la verificacion." }

Write-Host "Respaldo verificado: $backupDirectory"

