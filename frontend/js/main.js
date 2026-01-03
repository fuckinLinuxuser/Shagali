const container = document.getElementById('entity-container');

/**
 * Создаём HTML-карточку из JSON
 */
function renderEntity(entity) {
  const card = document.createElement('div');
  card.className = 'entity-card';

  for (const key in entity) {
    const field = document.createElement('div');
    field.className = 'entity-field';

    const label = document.createElement('strong');
    label.textContent = key + ': ';

    const value = document.createElement('span');
    value.textContent = entity[key];

    field.appendChild(label);
    field.appendChild(value);
    card.appendChild(field);
  }

  return card;
}

/**
 * Загружаем все сущности
 */
async function loadEntities() {
  try {
    // 1. Получаем список сущностей
    const listResponse = await fetch('/api/entities');
    const entities = await listResponse.json();
    
    container.innerHTML = '';

    // 2. Для каждой сущности — отдельный запрос
    for (const name of entities) {
      const res = await fetch(`/api/entities/${name}`);
      const data = await res.json();

      const card = renderEntity(data);
      container.appendChild(card);
    }

  } catch (error) {
    container.innerHTML = '<p>Ошибка загрузки данных</p>';
    console.error(error);
  }
}

loadEntities();
