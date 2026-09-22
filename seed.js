const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
 
// ── Connection ────────────────────────────────────────────────────────────────
 
const pool = new Pool({
  host:     'localhost',
  database: 'unitfinder',
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  port:     5432,
});
 
// ── Transformers ──────────────────────────────────────────────────────────────
 
// Walks the operators array and splits units into AND-of-OR groups.
// Each AND closes the current OR group and starts a new one.
//
// Example: units=[A,B,C,D,E], operators=[OR,OR,AND,OR]
//   i=0 OR  → current=[A,B]
//   i=1 OR  → current=[A,B,C]
//   i=2 AND → push [A,B,C], current=[D]
//   i=3 OR  → current=[D,E]
//   end     → push [D,E]
//   result: [["A","B","C"], ["D","E"]]

function buildGroups(units, operators){
    if (!units || units.length === 0) return null;
    if (units.length === 1) return [[units[0].code]]

    const groups = [];
    let current = [units[0].code];

    for (let i = 0 ; i < operators.length; i++){
        if (operators[i].toUpperCase() === 'AND'){
            groups.push(current);
            current = [units[i + 1].code];
        }
        else {
            current.push(units[i + 1].code);
        }
    }

    groups.push(current);
    return groups;
}

// Splits requisite array into the three separate columns
function parseRequisites(requisiteArray){
    const result = { prerequisite: null, corequisite: null, prohibition: null};
    if (!requisiteArray) return result;

    for (const item of requisiteArray){
        const type = item.type.toLowerCase();

        if (type === 'prerequisite' || type === 'corequisite'){
            result[type] = buildGroups(item.units, item.operators);
        }

        if (type === 'prohibition'){
            // Prohibition is a flat array — unit is blocked if any code was completed
            result.prohibition = item.units.map(u => u.code) ?? null;
        }
    }

    return result;
}

// Extracts the short code from the verbose attendance mode string.
// e.g. "Teaching activities are on-campus (ON-CAMPUS)" → "internal"
// Add more mappings here if your scraper returns other values.
function parseAttendanceMode(raw) {
  const match = raw?.match(/\(([^)]+)\)$/);
  if (!match) return raw ?? null;
  const map = {
    'ON-CAMPUS': 'internal',
    'ONLINE':    'online',
    'FLEXIBLE':  'mixed',
  };
  return map[match[1].toUpperCase()] ?? match[1];
}
 
function parseAssessments(assessments) {
  return (assessments ?? []).map(a => ({
    name:   a.name,
    weight: parseInt(a.valuePercent, 10),
  }));
}
 
// ── DB helpers ────────────────────────────────────────────────────────────────
 
async function getOrCreateFaculty(client, name) {
  const existing = await client.query(
    'SELECT id FROM faculty WHERE name = $1', [name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
 
  const res = await client.query(
    'INSERT INTO faculty (name) VALUES ($1) RETURNING id', [name]
  );
  return res.rows[0].id;
}
 
async function getOrCreateOffering(client, offering) {
  const res = await client.query(
    `INSERT INTO offering (location, teaching_period, attendance_mode)
     VALUES ($1, $2, $3)
     ON CONFLICT (location, teaching_period, attendance_mode)
     DO UPDATE SET location = EXCLUDED.location
     RETURNING id`,
    [
      offering.location,
      offering.teachingPeriod,
      parseAttendanceMode(offering.attendanceMode),
    ]
  );
  return res.rows[0].id;
}
 
async function upsertUnit(client, unit, facultyId, requisites) {
  const attrs = unit.attributes ?? {};
 
  const res = await client.query(
    `INSERT INTO units (
       code, name, faculty_id, study_level, sca_band,
       eftsl, credit_points, open_to_exchange,
       prerequisite, corequisite, prohibition, assessments
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (code, study_level)
     DO UPDATE SET
       name             = EXCLUDED.name,
       faculty_id       = EXCLUDED.faculty_id,
       sca_band         = EXCLUDED.sca_band,
       eftsl            = EXCLUDED.eftsl,
       credit_points    = EXCLUDED.credit_points,
       open_to_exchange = EXCLUDED.open_to_exchange,
       prerequisite     = EXCLUDED.prerequisite,
       corequisite      = EXCLUDED.corequisite,
       prohibition      = EXCLUDED.prohibition,
       assessments      = EXCLUDED.assessments
     RETURNING id`,
    [
      unit.code,                                         // ← adjust key if different in your JSON
      unit.name,                                         // ← adjust key if different in your JSON
      facultyId,
      (attrs.studyLevel ?? '').toLowerCase(),            // "Undergraduate" → "undergraduate"
      attrs.sca      ?? null,                            // "SCA Band 1"
      parseFloat(attrs.eftsl) || null,                         // ← adjust key if scraped, else stays null
      parseInt(attrs.creditPoints, 10),                  // "6" → 6
      attrs.openToExchange === 'Yes',                    // "Yes" → true
      requisites.prerequisite ? JSON.stringify(requisites.prerequisite) : null,
      requisites.corequisite  ? JSON.stringify(requisites.corequisite)  : null,
      requisites.prohibition  ? JSON.stringify(requisites.prohibition)  : null,
      JSON.stringify(parseAssessments(unit.assessments)),
    ]
  );
  return res.rows[0].id;
}
 
async function linkUnitOffering(client, unitId, offeringId) {
  await client.query(
    `INSERT INTO unit_offering (unit_id, offering_id) VALUES ($1, $2)
     ON CONFLICT (unit_id, offering_id) DO NOTHING`,
    [unitId, offeringId]
  );
}
 
// ── Main ──────────────────────────────────────────────────────────────────────
 
async function seed() {
  const filePath = path.join(__dirname, 'units.json');
  const units = JSON.parse(fs.readFileSync(filePath, 'utf8'));
 
  console.log(`Seeding ${units.length} units...`);
  const client = await pool.connect();
 
  try {
    await client.query('BEGIN');
 
    for (const unit of units) {
      const attrs      = unit.attributes ?? {};
      const requisites = parseRequisites(unit.requisite);
      const facultyId  = await getOrCreateFaculty(client, attrs.faculty);
      const unitId     = await upsertUnit(client, unit, facultyId, requisites);
 
      for (const offering of unit.offerings ?? []) {
        const offeringId = await getOrCreateOffering(client, offering);
        await linkUnitOffering(client, unitId, offeringId);
      }
    }
 
    await client.query('COMMIT');
    console.log(`Done — ${units.length} units seeded.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
 
seed();