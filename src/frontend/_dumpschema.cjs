const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('../backend/practice_delivery/my_practice.db', { readOnly: true });
const rows = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all();
for (const r of rows) {
  console.log('=== ' + r.type + ' ' + r.name + ' ===');
  console.log(r.sql);
  console.log();
}
