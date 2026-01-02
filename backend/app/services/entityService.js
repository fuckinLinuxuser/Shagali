const path = require('path');
const fs = require('fs');

function getEntity(entityName) {
  const filePath = path.join(__dirname, '../entities', `${entityName}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

module.exports = { getEntity };
