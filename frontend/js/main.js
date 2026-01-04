const container = document.getElementById('entity-container');

/**
 * Создаём HTML-карточку из JSON
 */
function renderEntity(entity, type) {
  switch (type) {
    case 'producer':
      return renderProducer(entity);
    case 'production':
      return renderProduction(entity);
    default:
      return renderDefault(entity);
  }
}

const producerFields = [
  'name',
  'role',
  'method'
];

function renderProducer(producer) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  
  // Добавляем поля producer'а
  for (const key of producerFields) {
  if (!producer[key]) continue;

  const field = document.createElement('div');
  field.className = 'entity-field';


  const value = document.createElement('span');
  value.textContent = producer[key];

  field.appendChild(value);
  card.appendChild(field);
}

  return card;
}

function renderProduction(production) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  
  // Добавляем поля production
  for (const key of Object.keys(production)) {
    if (!production[key]) continue;
    
    const field = document.createElement('div');
    field.className = 'entity-field';
    
    const value = document.createElement('span');
    value.textContent = production[key];
    
    field.appendChild(value);
    card.appendChild(field);
  }
  
  return card;
}

function renderDefault(entity) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  
  // Добавляем поля по умолчанию
  for (const key of Object.keys(entity)) {
    if (!entity[key]) continue;
    
    const field = document.createElement('div');
    field.className = 'entity-field';
    
    const value = document.createElement('span');
    value.textContent = entity[key];
    
    field.appendChild(value);
    card.appendChild(field);
  }
  
  return card;
}

/**
 * Загружаем все сущности
 */

const entities = ['producer', 'production'];

async function loadEntities() {
  for (const name of entities) {
  const res = await fetch(`/api/entities/${name}`);
  const data = await res.json();

  if (name === 'producer') {
    document
      .getElementById('producer-section')
      .appendChild(renderProducer(data));
  }

  if (name === 'production') {
    document
      .getElementById('production-section')
      .appendChild(renderProduction(data));
  }
}
}

loadEntities();
