# migrate_direct.ps1 — Uses MySqlConnector downloaded as NuGet zip

$DBHost     = "online-examination-examproject45.f.aivencloud.com"
$DBPort     = 19935
$DBUser     = "avnadmin"
$DBPassword = "YOUR_DB_PASSWORD_HERE"
$DBName     = "exam_db"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Coding Platform - MySQL Migration" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# ─── Download connector DLL ────────────────────────────────────
$tempDir = Join-Path $env:TEMP "mysql_migration_dll"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$dllDest = Join-Path $tempDir "MySqlConnector.dll"

if (-not (Test-Path $dllDest)) {
    Write-Host "Downloading MySqlConnector DLL..." -ForegroundColor Yellow
    # NuGet packages ARE zip files — just rename the extension
    $nupkgUrl  = "https://www.nuget.org/api/v2/package/MySqlConnector/2.3.7"
    $nupkgZip  = Join-Path $env:TEMP "MySqlConnector_2.3.7.zip"
    $extractDir = Join-Path $env:TEMP "MySqlConnector_2.3.7"

    try {
        Invoke-WebRequest -Uri $nupkgUrl -OutFile $nupkgZip -UseBasicParsing -TimeoutSec 60
        Write-Host "  Downloaded. Extracting..." -ForegroundColor Gray

        # PowerShell can open zip but .nupkg doesn't extract — use .NET ZipFile
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($nupkgZip)

        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match "net6\.0/MySqlConnector\.dll$" -or $entry.FullName -match "net60/MySqlConnector\.dll$") {
                Write-Host "  Found: $($entry.FullName)" -ForegroundColor Gray
                $stream = $entry.Open()
                $fileStream = [System.IO.File]::Create($dllDest)
                $stream.CopyTo($fileStream)
                $fileStream.Close()
                $stream.Close()
                Write-Host "  Extracted to: $dllDest" -ForegroundColor Green
                break
            }
        }
        $zip.Dispose()

        # Also try net8 or netstandard as fallback
        if (-not (Test-Path $dllDest)) {
            $zip = [System.IO.Compression.ZipFile]::OpenRead($nupkgZip)
            foreach ($entry in $zip.Entries) {
                if ($entry.FullName -match "MySqlConnector\.dll$") {
                    Write-Host "  Fallback DLL: $($entry.FullName)" -ForegroundColor DarkYellow
                    $stream = $entry.Open()
                    $fileStream = [System.IO.File]::Create($dllDest)
                    $stream.CopyTo($fileStream)
                    $fileStream.Close()
                    $stream.Close()
                    Write-Host "  Extracted to: $dllDest" -ForegroundColor Green
                    break
                }
            }
            $zip.Dispose()
        }
    } catch {
        Write-Host "  Download/extract failed: $_" -ForegroundColor Red
    }
}

if (-not (Test-Path $dllDest)) {
    Write-Host ""
    Write-Host "Could not obtain MySqlConnector.dll automatically." -ForegroundColor Red
    Write-Host "Trying alternative: MySql.Data (Oracle connector)..." -ForegroundColor Yellow

    $mysqlDataUrl = "https://www.nuget.org/api/v2/package/MySql.Data/8.3.0"
    $mysqlDataZip = Join-Path $env:TEMP "MySqlData_8.3.0.zip"
    $dllDest2     = Join-Path $tempDir "MySql.Data.dll"

    try {
        Invoke-WebRequest -Uri $mysqlDataUrl -OutFile $mysqlDataZip -UseBasicParsing -TimeoutSec 60
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($mysqlDataZip)
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match "MySql\.Data\.dll$") {
                $stream = $entry.Open()
                $fileStream = [System.IO.File]::Create($dllDest2)
                $stream.CopyTo($fileStream)
                $fileStream.Close(); $stream.Close()
                Write-Host "  Got MySql.Data.dll" -ForegroundColor Green
                break
            }
        }
        $zip.Dispose()
    } catch {
        Write-Host "  Also failed: $_" -ForegroundColor Red
    }
}

# ─── Load DLL and connect ─────────────────────────────────────
$loaded = $false
foreach ($dll in @($dllDest, (Join-Path $tempDir "MySql.Data.dll"))) {
    if (Test-Path $dll) {
        try {
            Add-Type -Path $dll -ErrorAction Stop
            $loaded = $true
            Write-Host "Loaded: $dll" -ForegroundColor Green
            break
        } catch {
            Write-Host "  Could not load $dll : $_" -ForegroundColor DarkYellow
        }
    }
}

if (-not $loaded) {
    Write-Host ""
    Write-Host "!!! All automatic methods failed." -ForegroundColor Red
    Write-Host "!!! Please run the SQL file manually." -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Yellow
    Write-Host "  1. Open https://console.aiven.io" -ForegroundColor White
    Write-Host "  2. Go to your MySQL service -> Query Editor" -ForegroundColor White
    Write-Host "  3. Paste and run the contents of:" -ForegroundColor White
    Write-Host "     backend\mysql\coding_platform_schema.sql" -ForegroundColor Cyan
    exit 0
}

# ─── Run SQL statements ───────────────────────────────────────
$connStr = "Server=$DBHost;Port=$DBPort;Database=$DBName;User Id=$DBUser;Password=$DBPassword;SslMode=Required;AllowPublicKeyRetrieval=True;ConnectionTimeout=30;"

Write-Host ""
Write-Host "Connecting to Aiven MySQL..." -ForegroundColor Yellow

# Determine which namespace to use
try {
    $conn = New-Object MySqlConnector.MySqlConnection($connStr)
} catch {
    $conn = New-Object MySql.Data.MySqlClient.MySqlConnection($connStr)
}

$conn.Open()
Write-Host "Connected to exam_db!" -ForegroundColor Green

$statements = @(
    @{
        name = "code_submissions table"
        sql  = @"
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
    },
    @{
        name = "v_leaderboard view"
        sql  = @"
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
)

foreach ($s in $statements) {
    Write-Host "  Creating $($s.name)..." -NoNewline -ForegroundColor Gray
    try {
        if ($conn.GetType().Namespace -eq "MySqlConnector") {
            $cmd = New-Object MySqlConnector.MySqlCommand($s.sql, $conn)
        } else {
            $cmd = New-Object MySql.Data.MySqlClient.MySqlCommand($s.sql, $conn)
        }
        $cmd.ExecuteNonQuery() | Out-Null
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
}

$conn.Close()

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  Migration COMPLETE!" -ForegroundColor Green
Write-Host "  code_submissions table - created" -ForegroundColor Gray
Write-Host "  v_leaderboard view     - created" -ForegroundColor Gray
Write-Host "=================================================" -ForegroundColor Green
