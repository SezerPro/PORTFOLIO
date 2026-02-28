param(
    [string]$EnvFile = "supabase/.env.local",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SupabaseArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# If the first positional argument is actually a Supabase arg (e.g. "db"),
# fallback to the default env file and prepend that arg back to command args.
$defaultEnvFile = "supabase/.env.local"
if (-not (Test-Path -Path $EnvFile) -and $EnvFile -ne $defaultEnvFile) {
    $SupabaseArgs = @($EnvFile) + $SupabaseArgs
    $EnvFile = $defaultEnvFile
}

$resolvedEnvFile = Resolve-Path -Path $EnvFile -ErrorAction SilentlyContinue
if (-not $resolvedEnvFile) {
    Write-Error "Env file not found: $EnvFile"
    exit 1
}

$loaded = 0
foreach ($line in Get-Content -Path $resolvedEnvFile) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
        continue
    }

    $sepIndex = $trimmed.IndexOf("=")
    if ($sepIndex -lt 1) {
        continue
    }

    $key = $trimmed.Substring(0, $sepIndex).Trim()
    $value = $trimmed.Substring($sepIndex + 1)

    if ($value.Length -ge 2) {
        $first = $value[0]
        $last = $value[$value.Length - 1]
        if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    Set-Item -Path "Env:$key" -Value $value
    $loaded++
}

Write-Host "Loaded $loaded variable(s) from $resolvedEnvFile"

if ($SupabaseArgs.Count -eq 0) {
    Write-Host "Usage: .\scripts\supabase-with-env.ps1 [supabase args]"
    Write-Host "Example: .\scripts\supabase-with-env.ps1 db push"
    exit 0
}

& supabase @SupabaseArgs
exit $LASTEXITCODE
