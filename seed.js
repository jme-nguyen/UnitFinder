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