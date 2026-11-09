[CmdletBinding()]
param(
    [string]$AsOf = '2026-11-07T12:00:00Z',
    [int[]]$OrderIds = @(9101, 9102)
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$pythonPath = Join-Path $repoRoot '.venv\Scripts\python.exe'
$schemaPath = Join-Path $PSScriptRoot 'schema_fresh.sql'
$seedPath = Join-Path $PSScriptRoot 'evaluate_agent_seed.sql'
$databasePath = Join-Path ([IO.Path]::GetTempPath()) (
    'delivery-agent-evaluation-' + [guid]::NewGuid().ToString() + '.db'
)

foreach ($requiredPath in @($schemaPath, $seedPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required input file does not exist: $requiredPath"
    }
}
if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "Project virtual environment not found: $pythonPath"
}

Push-Location $repoRoot
try {
    $initializeDatabase = @'
import sqlite3
import sys
from pathlib import Path

schema_path, seed_path, database_path = map(Path, sys.argv[1:4])
connection = sqlite3.connect(database_path)
try:
    connection.executescript(schema_path.read_text(encoding='utf-8'))
    connection.executescript(seed_path.read_text(encoding='utf-8'))
    print('Loaded evaluation data into {}'.format(database_path))
finally:
    connection.close()
'@
    & $pythonPath -c $initializeDatabase $schemaPath $seedPath $databasePath
    if ($LASTEXITCODE -ne 0) {
        throw "Database initialization failed with exit code $LASTEXITCODE"
    }

    $migrateDatabase = @'
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / 'src'))
from backend.migrations import migrate

database_path = Path(sys.argv[1])
backup_path = database_path.with_name(database_path.stem + '-before-migration.db')
print('Schema version: {}'.format(migrate(database_path, backup_path=backup_path)))
'@
    & $pythonPath -c $migrateDatabase $databasePath
    if ($LASTEXITCODE -ne 0) {
        throw "Database migration failed with exit code $LASTEXITCODE"
    }

    $runAgent = @'
import json
import sys
from datetime import datetime
from pathlib import Path

from backend.agent.graph import run_agent
from backend.agent.recommendations import request_qwen

database_path = Path(sys.argv[1])
decision_time = datetime.fromisoformat(sys.argv[2].replace('Z', '+00:00'))
order_ids = [int(value) for value in sys.argv[3:]]

def local_qwen(evidence, allowed_actions, at):
    return request_qwen(evidence, allowed_actions=allowed_actions, decision_time=at)

for order_id in order_ids:
    state = run_agent(
        database_path,
        order_id,
        decision_time,
        offline=True,
        recommendation_client=local_qwen,
    )
    result = {
        'order_id': order_id,
        'eligibility': state.get('eligibility_reason'),
        'p_late': state.get('p_late'),
        'risk_band': state.get('risk_band'),
        'features': state.get('feature_values'),
        'recommendation': state.get('recommendation'),
        'recommendation_error': state.get('recommendation_error'),
        'notification_id': state.get('notification_id'),
    }
    print(json.dumps(result, indent=2))

print('Evaluation database: {}'.format(database_path))
'@
    $runArguments = @($databasePath, $AsOf) + @($OrderIds | ForEach-Object { "$($_)" })
    & $pythonPath -c $runAgent @runArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Agent run failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
