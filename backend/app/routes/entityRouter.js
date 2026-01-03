const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  const entitiesDir = path.join(__dirname, '../entities');

  const files = fs.readdirSync(entitiesDir);

  const entityNames = files
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));

  res.json(entityNames);
});


router.get('/:name', (req, res) => {
  const { name } = req.params;
  const filePath = path.join(__dirname, '../entities', `${name}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  const entityData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(entityData);
});

module.exports = router;
