const express = require('express');
const router = express.Router();
const { getEntity } = require('../services/entityService');

router.get('/:entity', (req, res) => {
  const entityName = req.params.entity;
  const data = getEntity(entityName);

  if (!data) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  res.json(data);
});

module.exports = router;
