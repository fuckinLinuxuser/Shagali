const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

const entityRouter = require('./routes/entityRouter');

app.use(cors());
app.use(express.json());

app.use('/api/entities', entityRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

console.log('API endpoints available at /api/entities/:entity');
console.log('Example: GET /api/entities/shagali');
console.log('Available entities: shagali (producer)');
console.log('Try: curl http://localhost:3000/api/entities/shagali');
console.log('Try: http://localhost:3000/api/entities/shagali');
console.log('Try: http://localhost:3000/api/entities/shagali/health');
console.log('Try: http://localhost:3000/api/entities/shagali/health');


