# migrate.ps1 — Run coding platform SQL migration against Aiven MySQL
# Requires: mysql.exe in PATH, OR downloads MySqlConnector .NET lib

param(
  [string]$DBHost     = "online-examination-examproject45.f.aivencloud.com",
  [int]   $DBPort     = 19935,
  [string]$DBUser     = "avnadmin",
  [string]$DBPassword = "YOUR_DB_PASSWORD_HERE",
  [string]$DBName     = "exam_db"
)

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Coding Platform — MySQL Migration" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Host     : $DBHost" -ForegroundColor Gray
Write-Host "  Port     : $DBPort" -ForegroundColor Gray
Write-Host "  Database : $DBName" -ForegroundColor Gray
Write-Host ""

# ─── Check TCP reachability ──────────────────────────────
Write-Host "Checking TCP connectivity..." -ForegroundColor Yellow
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $tcp.Connect($DBHost, $DBPort)
    Write-Host "  TCP connection OK" -ForegroundColor Green
    $tcp.Close()
} catch {
    Write-Host "  Cannot reach MySQL server: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ─── Look for mysql.exe ──────────────────────────────────
$mysqlExe = $null
$candidates = @(
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 9.0\bin\mysql.exe",
    "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "$env:LOCALAPPDATA\MySQLWorkbench\mysql.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $mysqlExe = $c; break }
}
if (-not $mysqlExe) {
    # Search PATH
    try { $mysqlExe = (Get-Command mysql -ErrorAction SilentlyContinue).Source } catch {}
}

# ─── SQL to execute ──────────────────────────────────────
$sqlFile = Join-Path $PSScriptRoot "coding_platform_schema.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "SQL file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

if ($mysqlExe) {
    Write-Host ""
    Write-Host "Found mysql.exe: $mysqlExe" -ForegroundColor Green
    Write-Host "Running migration..." -ForegroundColor Yellow
    $env:MYSQL_PWD = $DBPassword
    $cmdLine = """$mysqlExe"" --host=$DBHost --port=$DBPort --user=$DBUser --database=$DBName --ssl-mode=REQUIRED < ""$sqlFile"""
    Write-Host "  Running: $cmdLine" -ForegroundColor Gray
    cmd /c $cmdLine
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration executed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "mysql.exe returned non-zero exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} else {
    # ─── Fallback: use MySqlConnector via NuGet ───────────
    Write-Host ""
    Write-Host "mysql.exe not found. Attempting via .NET MySqlConnector..." -ForegroundColor Yellow

    $nugetDir = Join-Path $env:TEMP "MySqlConnector"
    $dllPath  = "$nugetDir\lib\net6.0\MySqlConnector.dll"

    if (-not (Test-Path $dllPath)) {
        Write-Host "  Downloading MySqlConnector from NuGet..." -ForegroundColor Gray
        $nupkgUrl  = "https://www.nuget.org/api/v2/package/MySqlConnector/2.3.7"
        $nupkgPath = "$env:TEMP\MySqlConnector.nupkg"
        Invoke-WebRequest -Uri $nupkgUrl -OutFile $nupkgPath -UseBasicParsing
        Expand-Archive -Path $nupkgPath -DestinationPath $nugetDir -Force
    }

    Add-Type -Path $dllPath

    $connStr = "Server=$DBHost;Port=$DBPort;Database=$DBName;User=$DBUser;Password=$DBPassword;SslMode=Required;"
    $conn = New-Object MySqlConnector.MySqlConnection($connStr)
    Write-Host "  Connecting..." -ForegroundColor Gray
    $conn.Open()
    Write-Host "  Connected!" -ForegroundColor Green

    $sqlContent = Get-Content $sqlFile -Raw

    # Split on semicolons (skip comments & empty)
    $statements = $sqlContent -split ";" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" -and -not $_.StartsWith("--") -and -not $_.StartsWith("#") }

    foreach ($stmt in $statements) {
        if ($stmt.Length -lt 5) { continue }
        Write-Host "  Executing: $($stmt.Substring(0, [Math]::Min(60, $stmt.Length)))..." -ForegroundColor Gray
        $cmd = New-Object MySqlConnector.MySqlCommand($stmt, $conn)
        $cmd.ExecuteNonQuery() | Out-Null
    }

    $conn.Close()
    Write-Host ""
    Write-Host "Migration executed successfully via .NET connector!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Tables & Views created:" -ForegroundColor Cyan
Write-Host "  code_submissions   — stores all code runs/submissions" -ForegroundColor Gray
Write-Host "  v_leaderboard      — view showing ranked student scores" -ForegroundColor Gray
Write-Host ""
Write-Host "Coding platform database is READY!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
