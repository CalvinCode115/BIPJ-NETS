function runTransaction(database, fn) {
  database.exec('BEGIN IMMEDIATE');
  try {
    fn();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  runTransaction,
};
