# migrate_v2.ps1 — Direct MySQL migration via MySqlConnector nuget zip

$DBHost     = "online-examination-examproject45.f.aivencloud.com"
$DBPort     = 19935
$DBUser     = "avnadmin"
$DBPassword = "YOUR_DB_PASSWORD_HERE"
$DBName     = "exam_db"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Coding Platform - MySQL Migration" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Step 1 - TCP check
Write-Host "Checking TCP connectivity..." -ForegroundColor Yellow
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $result = $tcp.BeginConnect($DBHost, $DBPort, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(8000, $true)
    if ($success) {
        $tcp.EndConnect($result)
        Write-Host "  TCP OK - server is reachable" -ForegroundColor Green
    } else {
        throw "Timeout"
    }
} catch {
    Write-Host "  Cannot reach server: $_" -ForegroundColor Red
    exit 1
} finally {
    $tcp.Close()
}

# Step 2 - Download MySqlConnector as zip from GitHub release
Write-Host ""
Write-Host "Downloading MySqlConnector..." -ForegroundColor Yellow

$tempDir     = Join-Path $env:TEMP "mysql_connector_migration"
$zipPath     = Join-Path $env:TEMP "MySqlConnector.zip"
$dllPath     = $null

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Download the DLL directly from a CDN/github release
$dllUrl = "https://github.com/mysql-net/MySqlConnector/releases/download/2.3.7/MySqlConnector-net60.zip"
try {
    Write-Host "  Fetching from GitHub..." -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $dllUrl -OutFile $zipPath -TimeoutSec 30 -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    $dllPath = Get-ChildItem -Path $tempDir -Filter "MySqlConnector.dll" -Recurse | Select-Object -First 1 -ExpandProperty FullName
    if ($dllPath) {
        Write-Host "  Downloaded: $dllPath" -ForegroundColor Green
    }
} catch {
    Write-Host "  Download failed: $_" -ForegroundColor DarkYellow
}

if (-not $dllPath) {
    # Fallback: use System.Data.SqlClient style via .NET's built-in ODBC or ADO if MySQL ODBC driver present
    Write-Host ""
    Write-Host "Cannot load MySqlConnector.dll - falling back to raw .NET approach" -ForegroundColor Yellow

    # Try ODBC
    $odbcDrivers   = (Get-OdbcDriver | Where-Object { $_.Name -like "*MySQL*" }).Name
    Write-Host "  ODBC MySQL drivers found: $($odbcDrivers -join ', ')" -ForegroundColor Gray

    if ($odbcDrivers) {
        $connStr = "DRIVER={$($odbcDrivers[0])};SERVER=$DBHost;PORT=$DBPort;DATABASE=$DBName;USER=$DBUser;PASSWORD=$DBPassword;SSLMODE=Required"
        Write-Host "  Connecting via ODBC..." -ForegroundColor Gray
        $conn = New-Object System.Data.Odbc.OdbcConnection($connStr)
        $conn.Open()
        RunStatements $conn
        $conn.Close()
    } else {
        Write-Host ""
        Write-Host "  No MySQL driver available. Node.js and mysql.exe not found." -ForegroundColor Red
        Write-Host ""
        Write-Host "  PLEASE RUN THIS SQL MANUALLY in Aiven Console or your MySQL client:" -ForegroundColor Yellow
        Write-Host ""
        $sqlFile = Join-Path $PSScriptRoot "coding_platform_schema.sql"
        Get-Content $sqlFile | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
        exit 0
    }
} else {
    Add-Type -Path $dllPath
    $connStr = "Server=$DBHost;Port=$DBPort;Database=$DBName;User Id=$DBUser;Password=$DBPassword;SslMode=Required;AllowPublicKeyRetrieval=True;"
    Write-Host "Connecting to MySQL..." -ForegroundColor Yellow
    $conn = New-Object MySqlConnector.MySqlConnection($connStr)
    $conn.Open()
    Write-Host "Connected!" -ForegroundColor Green

    $sql1 = @"
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

    $sql2 = @"
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
  s.id              AS student_id,
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

    Write-Host "Creating table code_submissions..." -ForegroundColor Gray
    $cmd = New-Object MySqlConnector.MySqlCommand($sql1, $conn)
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "  code_submissions - OK" -ForegroundColor Green

    Write-Host "Creating view v_leaderboard..." -ForegroundColor Gray
    $cmd2 = New-Object MySqlConnector.MySqlCommand($sql2, $conn)
    $cmd2.ExecuteNonQuery() | Out-Null
    Write-Host "  v_leaderboard    - OK" -ForegroundColor Green

    $conn.Close()
    Write-Host ""
    Write-Host "Migration COMPLETE! Database is ready." -ForegroundColor Green
}
