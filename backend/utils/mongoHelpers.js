// Strips MongoDB's internal _id/__v so API responses look identical to the
// old JSON-file version — the frontend was never touched for this migration.
function clean(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj._id;
  delete obj.__v;
  return obj;
}

function cleanAll(docs) {
  return (docs || []).map(clean);
}

module.exports = { clean, cleanAll };
