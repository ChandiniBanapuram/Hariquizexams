# migrate_net45.ps1 — uses MySql.Data which supports .NET Framework 4.x

$DBHost = "online-examination-examproject45.f.aivencloud.com"
$DBPort = 19935
$DBUser = "avnadmin"
$DBPass = "YOUR_DB_PASSWORD_HERE"
$DBName = "exam_db"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$tempDir = Join-Path $env:TEMP "mysql_mig_net45"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem

Write-Host ""
Write-Host "Running on .NET Framework 4.x - using MySql.Data connector" -ForegroundColor Cyan
Write-Host ""

$dllPath  = Join-Path $tempDir "MySql.Data.dll"
$zipLocal = Join-Path $tempDir "mysqldata.zip"

if (-not (Test-Path $dllPath)) {
    Write-Host "Downloading MySql.Data 8.0.33..." -ForegroundColor Yellow
    # MySql.Data 8.0.33 has net45 build
    Invoke-WebRequest "https://www.nuget.org/api/v2/package/MySql.Data/8.0.33" -OutFile $zipLocal -UseBasicParsing -TimeoutSec 60
    Write-Host "  Download complete. Extracting net45 DLL..." -ForegroundColor Gray
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipLocal)
    $found = $false
    foreach ($tfm in @("net45","net452","net46","net461","net47","net48","net40","net35","netstandard2.0")) {
        foreach ($e in $zip.Entries) {
            if ($e.FullName -like "*$tfm/MySql.Data.dll") {
                $s = $e.Open()
                $f = [System.IO.File]::Create($dllPath)
                $s.CopyTo($f); $f.Close(); $s.Close()
                Write-Host "  Extracted: $($e.FullName)" -ForegroundColor Green
                $found = $true; break
            }
        }
        if ($found) { break }
    }
    if (-not $found) {
        # Take any MySql.Data.dll
        foreach ($e in $zip.Entries) {
            if ($e.Name -eq "MySql.Data.dll") {
                $s = $e.Open()
                $f = [System.IO.File]::Create($dllPath)
                $s.CopyTo($f); $f.Close(); $s.Close()
                Write-Host "  Extracted fallback: $($e.FullName)" -ForegroundColor DarkYellow
                break
            }
        }
    }
    $zip.Dispose()
}

Write-Host "Loading MySql.Data..." -ForegroundColor Yellow
try {
    Add-Type -Path $dllPath -ErrorAction Stop
    Write-Host "DLL loaded OK" -ForegroundColor Green
} catch {
    Write-Host "Load error: $_" -ForegroundColor Red

    # Last resort: try Google.Protobuf dependency (MySql.Data 8.x requires it)
    # Download a simpler older version - MySql.Data 6.9.12 (no protobuf, pure net45)
    $dllPath6  = Join-Path $tempDir "MySql.Data6.dll"
    $zipLocal6 = Join-Path $tempDir "mysqldata6.zip"
    Write-Host "Trying MySql.Data 6.9.12 (no Protobuf dependency)..." -ForegroundColor Yellow
    Invoke-WebRequest "https://www.nuget.org/api/v2/package/MySql.Data/6.9.12" -OutFile $zipLocal6 -UseBasicParsing -TimeoutSec 60
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipLocal6)
    foreach ($e in $zip.Entries) {
        if ($e.Name -eq "MySql.Data.dll") {
            $s = $e.Open()
            $f = [System.IO.File]::Create($dllPath6)
            $s.CopyTo($f); $f.Close(); $s.Close()
            Write-Host "  Got: $($e.FullName)" -ForegroundColor Green
            break
        }
    }
    $zip.Dispose()
    try {
        Add-Type -Path $dllPath6 -ErrorAction Stop
        $dllPath = $dllPath6
        Write-Host "MySql.Data 6.9.12 loaded OK" -ForegroundColor Green
    } catch {
        Write-Host "Still cannot load: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Yellow
        Write-Host " MANUAL STEP REQUIRED" -ForegroundColor Yellow
        Write-Host "====================================================" -ForegroundColor Yellow
        Write-Host " Node.js is not installed and no .NET MySQL driver" -ForegroundColor White
        Write-Host " can be loaded on this machine." -ForegroundColor White
        Write-Host ""
        Write-Host " Please paste the SQL below into Aiven Query Editor:" -ForegroundColor White
        Write-Host " https://console.aiven.io" -ForegroundColor Cyan
        Write-Host ""
        Get-Content (Join-Path $PSScriptRoot "coding_platform_schema.sql") | Write-Host
        exit 0
    }
}

# ─── Connect and run ──────────────────────────────────────────────
$cs = "server=$DBHost;port=$DBPort;database=$DBName;uid=$DBUser;pwd=$DBPass;SslMode=Required;AllowPublicKeyRetrieval=true;ConnectionTimeout=30;"
Write-Host ""
Write-Host "Connecting to Aiven MySQL..." -ForegroundColor Yellow
$conn = New-Object MySql.Data.MySqlClient.MySqlConnection($cs)
$conn.Open()
Write-Host "Connected to $DBName!" -ForegroundColor Green

$sql1 = "CREATE TABLE IF NOT EXISTS code_submissions (" +
        "id INT NOT NULL AUTO_INCREMENT, " +
        "student_id INT NOT NULL, " +
        "question_id INT NOT NULL, " +
        "language VARCHAR(20) NOT NULL DEFAULT 'python', " +
        "code MEDIUMTEXT NOT NULL, " +
        "status VARCHAR(50) NOT NULL DEFAULT 'Pending', " +
        "score INT NOT NULL DEFAULT 0, " +
        "total_score INT NOT NULL DEFAULT 0, " +
        "passed INT NOT NULL DEFAULT 0, " +
        "total INT NOT NULL DEFAULT 0, " +
        "exec_time FLOAT NULL, " +
        "memory_bytes INT NULL, " +
        "is_submit TINYINT(1) NOT NULL DEFAULT 0, " +
        "submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
        "PRIMARY KEY (id), " +
        "INDEX idx_cs_student (student_id), " +
        "INDEX idx_cs_question (question_id), " +
        "INDEX idx_cs_status (status)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"

$sql2 = "CREATE OR REPLACE VIEW v_leaderboard AS " +
        "SELECT s.id AS student_id, s.name, s.roll_number, s.department, " +
        "SUM(cs.score) AS total_score, COUNT(*) AS submissions, " +
        "MIN(cs.exec_time) AS best_time, MIN(cs.memory_bytes) AS best_memory, " +
        "MAX(cs.submitted_at) AS last_submitted " +
        "FROM code_submissions cs " +
        "JOIN students s ON s.id = cs.student_id " +
        "WHERE cs.is_submit = 1 " +
        "GROUP BY cs.student_id " +
        "ORDER BY total_score DESC, best_time ASC"

foreach ($item in @( @{n="code_submissions"; q=$sql1}, @{n="v_leaderboard"; q=$sql2} )) {
    Write-Host "  $($item.n)..." -NoNewline
    $cmd = New-Object MySql.Data.MySqlClient.MySqlCommand($item.q, $conn)
    try {
        $cmd.ExecuteNonQuery() | Out-Null
        Write-Host " CREATED" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -match "already exists") {
            Write-Host " ALREADY EXISTS (OK)" -ForegroundColor DarkYellow
        } else {
            Write-Host " ERROR: $_" -ForegroundColor Red
        }
    }
}

$conn.Close()
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host " Migration COMPLETE! DB Ready!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
