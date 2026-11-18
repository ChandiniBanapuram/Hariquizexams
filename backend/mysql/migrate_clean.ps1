# migrate_clean.ps1
$DBHost = "online-examination-examproject45.f.aivencloud.com"
$DBPort = 19935
$DBUser = "avnadmin"
$DBPass = "YOUR_DB_PASSWORD_HERE"
$DBName = "exam_db"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$tempDir = Join-Path $env:TEMP "mysql_mig"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem

Write-Host "Downloading MySqlConnector (netstandard2.0)..." -ForegroundColor Yellow
$dllPath  = Join-Path $tempDir "MySqlConnector.dll"
$zipLocal = Join-Path $tempDir "mc.zip"

if (-not (Test-Path $dllPath)) {
    Invoke-WebRequest "https://www.nuget.org/api/v2/package/MySqlConnector/2.3.7" -OutFile $zipLocal -UseBasicParsing
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipLocal)
    $found = $false
    foreach ($tfm in @("netstandard2.0","netstandard2.1","net6.0")) {
        foreach ($e in $zip.Entries) {
            if ($e.FullName -like "*$tfm/MySqlConnector.dll") {
                $s = $e.Open()
                $f = [System.IO.File]::Create($dllPath)
                $s.CopyTo($f); $f.Close(); $s.Close()
                Write-Host "  Extracted: $($e.FullName)" -ForegroundColor Green
                $found = $true; break
            }
        }
        if ($found) { break }
    }
    $zip.Dispose()
}

try {
    Add-Type -Path $dllPath -ErrorAction Stop
    Write-Host "DLL loaded OK" -ForegroundColor Green
} catch {
    Write-Host "DLL load error: $_" -ForegroundColor Red
    exit 1
}

$cs = "Server=$DBHost;Port=$DBPort;Database=$DBName;User Id=$DBUser;Password=$DBPass;SslMode=Required;AllowPublicKeyRetrieval=True;ConnectionTimeout=30;"
Write-Host "Connecting..." -ForegroundColor Yellow
$conn = New-Object MySqlConnector.MySqlConnection($cs)
$conn.Open()
Write-Host "Connected to $DBName" -ForegroundColor Green

$sql1 = "CREATE TABLE IF NOT EXISTS code_submissions (" +
        "  id           INT NOT NULL AUTO_INCREMENT," +
        "  student_id   INT NOT NULL," +
        "  question_id  INT NOT NULL," +
        "  language     VARCHAR(20) NOT NULL DEFAULT 'python'," +
        "  code         MEDIUMTEXT NOT NULL," +
        "  status       VARCHAR(50) NOT NULL DEFAULT 'Pending'," +
        "  score        INT NOT NULL DEFAULT 0," +
        "  total_score  INT NOT NULL DEFAULT 0," +
        "  passed       INT NOT NULL DEFAULT 0," +
        "  total        INT NOT NULL DEFAULT 0," +
        "  exec_time    FLOAT NULL," +
        "  memory_bytes INT NULL," +
        "  is_submit    TINYINT(1) NOT NULL DEFAULT 0," +
        "  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "  PRIMARY KEY (id)," +
        "  INDEX idx_cs_student (student_id)," +
        "  INDEX idx_cs_question (question_id)," +
        "  INDEX idx_cs_status (status)" +
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

foreach ($pair in @(@{n="code_submissions table"; q=$sql1}, @{n="v_leaderboard view"; q=$sql2})) {
    Write-Host "  Creating $($pair.n)..." -NoNewline
    try {
        $cmd = New-Object MySqlConnector.MySqlCommand($pair.q, $conn)
        $cmd.ExecuteNonQuery() | Out-Null
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
}

$conn.Close()
Write-Host ""
Write-Host "Migration COMPLETE - Database ready!" -ForegroundColor Green
