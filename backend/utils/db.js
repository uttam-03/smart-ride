const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// Simple in-process queue to avoid concurrent write corruption for this demo app
let writeChain = Promise.resolve();
function saveDB(db) {
  writeChain = writeChain.then(() => writeDB(db));
  return writeChain;
}

module.exports = { readDB, saveDB };
