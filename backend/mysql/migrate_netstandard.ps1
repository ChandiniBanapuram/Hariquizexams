# migrate_netstandard.ps1 — Uses netstandard2.0 build of MySqlConnector

$DBHost     = "online-examination-examproject45.f.aivencloud.com"
$DBPort     = 19935
$DBUser     = "avnadmin"
$DBPassword = "YOUR_DB_PASSWORD_HERE"
$DBName     = "exam_db"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$tempDir = Join-Path $env:TEMP "mysql_migration_dll"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Coding Platform MySQL Migration" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ".NET Version: $($PSVersionTable.PSVersion)" -ForegroundColor Gray
Write-Host ""

function Extract-DllFromNuget {
    param($url, $targetFrameworks, $destPath)
    $zipPath = Join-Path $env:TEMP "pkg_$(Get-Random).zip"
    try {
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 60
    } catch {
        Write-Host "  Download failed: $_" -ForegroundColor Red
        return $false
    }

    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $found = $false
    foreach ($tfm in $targetFrameworks) {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match "$tfm/MySqlConnector\.dll$") {
                Write-Host "  Found: $($entry.FullName)" -ForegroundColor Green
                $stream     = $entry.Open()
                $fileStream = [System.IO.File]::Create($destPath)
                $stream.CopyTo($fileStream)
                $fileStream.Close(); $stream.Close()
                $found = $true
                break
            }
        }
        if ($found) { break }
    }
    $zip.Dispose()
    Remove-Item $zipPath -ErrorAction SilentlyContinue
    return $found
}

$dllPath = Join-Path $tempDir "MySqlConnector.dll"

if (-not (Test-Path $dllPath)) {
    Write-Host "Downloading MySqlConnector 2.3.7 (netstandard2.0)..." -ForegroundColor Yellow
    $url = "https://www.nuget.org/api/v2/package/MySqlConnector/2.3.7"
    # Try netstandard2.0, netstandard2.1, then net6.0
    $ok = Extract-DllFromNuget -url $url -targetFrameworks @("netstandard2.0", "netstandard2.1", "net6.0", "net8.0") -destPath $dllPath
    if (-not $ok) {
        Write-Host "  Could not extract DLL from NuGet package." -ForegroundColor Red
    }
}

# Try to load
$loaded = $false
if (Test-Path $dllPath) {
    try {
        Add-Type -Path $dllPath -ErrorAction Stop
        $loaded = $true
        Write-Host "MySqlConnector loaded successfully." -ForegroundColor Green
    } catch {
        Write-Host "Load error: $_" -ForegroundColor DarkYellow
        # Check what .NET version is available
        $runtimeVer = [System.Runtime.InteropServices.RuntimeEnvironment]::GetSystemVersion()
        Write-Host "  .NET Runtime: $runtimeVer" -ForegroundColor Gray
    }
}

if (-not $loaded) {
    Write-Host ""
    Write-Host "Cannot load MySQL connector on this machine." -ForegroundColor Red
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Yellow
    Write-Host "  MANUAL MIGRATION — COPY & PASTE BELOW" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to: https://console.aiven.io" -ForegroundColor White
    Write-Host "2. Open your MySQL service" -ForegroundColor White  
    Write-Host "3. Click 'Query Editor' (or connect via DBeaver/TablePlus)" -ForegroundColor White
    Write-Host "4. Run this SQL:" -ForegroundColor White
    Write-Host ""
    Write-Host "-- ==== PASTE START ====" -ForegroundColor Cyan
    Write-Host @"
CREATE TABLE IF NOT EXISTS code_submissions (
  id            INT          NOT NULL AUTO_INCREMENT,
  student_id    INT          NOT NULL,
  question_id   INT          NOT NULL,
  language      VARCHAR(20)  NOT NULL DEFAULT 'python',
  code          MEDIUMTEXT   NOT NULL,
  status        VARCHAR(50)  NOT NULL DEFAULT 'Pending',
  score         INT          NOT NULL DEFAULT 0,
  total_score   INT          NOT NULL DEFAULT 0,
  passed        INT          NOT NULL DEFAULT 0,
  total         INT          NOT NULL DEFAULT 0,
  exec_time     FLOAT        NULL,
  memory_bytes  INT          NULL,
  is_submit     TINYINT(1)   NOT NULL DEFAULT 0,
  submitted_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_cs_student  (student_id),
  INDEX idx_cs_question (question_id),
  INDEX idx_cs_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
  s.id                 AS student_id,
  s.name,
  s.roll_number,
  s.department,
  SUM(cs.score)        AS total_score,
  COUNT(*)             AS submissions,
  MIN(cs.exec_time)    AS best_time,
  MIN(cs.memory_bytes) AS best_memory,
  MAX(cs.submitted_at) AS last_submitted
FROM code_submissions cs
JOIN students s ON s.id = cs.student_id
WHERE cs.is_submit = 1
GROUP BY cs.student_id
ORDER BY total_score DESC, best_time ASC;
"@ -ForegroundColor White
    Write-Host "-- ==== PASTE END ====" -ForegroundColor Cyan
    exit 0
}

# ─── Execute SQL ──────────────────────────────────────────────────
$connStr = "Server=$DBHost;Port=$DBPort;Database=$DBName;User Id=$DBUser;Password=$DBPassword;SslMode=Required;AllowPublicKeyRetrieval=True;ConnectionTimeout=30;"
Write-Host ""
Write-Host "Connecting to Aiven MySQL..." -ForegroundColor Yellow
$conn = New-Object MySqlConnector.MySqlConnection($connStr)
$conn.Open()
Write-Host "Connected to $DBName!" -ForegroundColor Green
Write-Host ""

$sqls = @{
    "code_submissions" = @"
CREATE TABLE IF NOT EXISTS code_submissions (
  id            INT          NOT NULL AUTO_INCREMENT,
  student_id    INT          NOT NULL,
  question_id   INT          NOT NULL,
  language      VARCHAR(20)  NOT NULL DEFAULT 'python',
  code          MEDIUMTEXT   NOT NULL,
  status        VARCHAR(50)  NOT NULL DEFAULT 'Pending',
  score         INT          NOT NULL DEFAULT 0,
  total_score   INT          NOT NULL DEFAULT 0,
  passed        INT          NOT NULL DEFAULT 0,
  total         INT          NOT NULL DEFAULT 0,
  exec_time     FLOAT        NULL,
  memory_bytes  INT          NULL,
  is_submit     TINYINT(1)   NOT NULL DEFAULT 0,
  submitted_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_cs_student  (student_id),
  INDEX idx_cs_question (question_id),
  INDEX idx_cs_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"@
    "v_leaderboard" = @"
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
  s.id                 AS student_id,
  s.name,
  s.roll_number,
  s.department,
  SUM(cs.score)        AS total_score,
  COUNT(*)             AS submissions,
  MIN(cs.exec_time)    AS best_time,
  MIN(cs.memory_bytes) AS best_memory,
  MAX(cs.submitted_at) AS last_submitted
FROM code_submissions cs
JOIN students s ON s.id = cs.student_id
WHERE cs.is_submit = 1
GROUP BY cs.student_id
ORDER BY total_score DESC, best_time ASC
"@
}

foreach ($name in $sqls.Keys) {
    Write-Host "  $name ..." -NoNewline -ForegroundColor Gray
    try {
        $cmd = New-Object MySqlConnector.MySqlCommand($sqls[$name], $conn)
        $cmd.ExecuteNonQuery() | Out-Null
        Write-Host " CREATED" -ForegroundColor Green
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
}

$conn.Close()
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  Migration COMPLETE - Database Ready!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
