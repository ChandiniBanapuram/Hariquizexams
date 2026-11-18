const mysql = require('mysql2/promise');
require('dotenv').config();

const caCert = `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIULCTRqlE9nm3ujxzv4u88Wl/catowDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1NjgxMDRkY2EtZjhjMS00MTBkLTkyNTgtNmIwODkzNGFl
NzZiIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUxMjI0MTc1NDUzWhcNMzUxMjIyMTc1
NDUzWjBAMT4wPAYDVQQDDDU2ODEwNGRjYS1mOGMxLTQxMGQtOTI1OC02YjA4OTM0
YWU3NmIgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBALzN7nz/+LOXOOltvGPg/dAiHQYw7YF2o5xEPY50jLmsMv2RnL6F4kWZ
OHcXJ6/elYBQYaWks2Z+YjhlIuPS4psDjaJ0vu0ELBmv9q1Pa7daLXl8g2HDSOZe
aY4+T7M9brMRez3xKPvT+ZrVopcb9Ft0WmcoijtqXJmAzcrCFXjIKFMWUhIBPszi
VMccmohqJvbb2IJEZdPL1po58myLzmyxLWNAeY1/2kGHe0S2wrHvhXTBTx+/Rb3F
MOxuJ2W/dB3Wo7UK7sIivP6RcXc60bVb+X2wQIrraX+9zLGWJfCiDr3UYNkrCnpu
vyp8Hle5Nb7GRJ0ZNvbDsgJeq9eaZPhTxDgeHfyCf6XDU3eLxTAb0tpF24kJWOXl
qauhPbJ3ubEpJuchfo0cWbv2D9Q/5I3t8STaoF76si201NEi0HqwSsM344/XYVQ+
3cPY4L8tfdmx4Rla/AVFhR2lQue9L+VMivA6Ryr9qhhWmv8iIc8y7ugVWxS6Epxx
Y1EycTuwmQIDAQABo0IwQDAdBgNVHQ4EFgQU+gV6quUQgnaDDXGRijL9y9bMiwUw
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAHwKArtuZlF8BW4D3Kt3StpI634U6DajlLWxRBi+zS4ZkiEm6W4mVuOIQk8g
Utzy6GHCUGS3XQUFbZk0JzaWPOs0RwhpX5qFTm54TLbRO2jjg9+2fjmCSgrOTMrb
FD4lYubI8vAAdmvq7qrLQyFi4RQb3kfPl6gA097zvlpk1vgqIW+HKcBFRTchikxh
iE0pCCKtICA3cK+PF4jK1Xq+jQZTHaiyyzcuZcS9pVb/9r1KgvqMGu6R+wbByDhw
USf8ECCsQn1XYY6AmdXwpA7PKfxGgk0c15uJTzcnEqoLkeT8wsC1VqsfquI/2CZh
ghT1ciZm8feZSmhS0E913I92/ZF+6ivLbQwXuGdD9cbFrjjBhltb9cl+PWff2o4+
j8CPjQPTxyu7dPbYQnnRo8uI/wI6LSjS8aTvyUeB5+bx3IKm+GZYl1vEI0p3Ipgc
IImHx/5GxihNC/jH8E1juPsuyVAIKxLTbzB+Y6TJVheaplelIOSLvGI3HAcIwE5C
Dl5xmw==
-----END CERTIFICATE-----`;

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { ca: caCert, rejectUnauthorized: true }
  });

  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS coding_practice_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL,
        topic VARCHAR(255) NOT NULL,
        input_format TEXT,
        output_format TEXT,
        visible_test_cases JSON,
        hidden_test_cases JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await pool.query(createTableQuery);
    console.log('✅ Table coding_practice_questions created successfully');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
