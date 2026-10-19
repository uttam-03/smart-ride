// Sequelize instances -> plain objects for API responses. Unlike a raw ORM
// result, .toJSON() only ever contains the columns we defined (no hidden
// framework fields to strip out).
function clean(instance) {
  if (!instance) return instance;
  return typeof instance.toJSON === 'function' ? instance.toJSON() : instance;
}

function cleanAll(instances) {
  return (instances || []).map(clean);
}

module.exports = { clean, cleanAll };
