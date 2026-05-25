// src/scripts/modal-controller.js

function openPeopleModal(data) {
  const modal = document.getElementById('people-modal');
  if (!modal) return;

  document.getElementById('modal-name').textContent = data.name || '';
  document.getElementById('modal-role').textContent = data.role || '';
  document.getElementById('modal-bio').innerHTML    = data.bio  || '';

  modal.style.display = 'block';
}

function openCastingsModal(data) {
  const modal = document.getElementById('castings-modal');
  if (!modal) return;

  document.getElementById('modalTitle').textContent = data.name || '';
  document.getElementById('modalDate').textContent  = data.date || '';
  document.getElementById('modalVideo').src         = data.video || '';

  let raw  = data.description || 'Описание отсутствует.';
  let safe = raw
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');

  let html = safe.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br>');
  if (html.trim()) html = '<p>' + html + '</p>';

  document.getElementById('modalDesc').innerHTML = html;

  modal.style.display = 'block';
}

function closeAllModals() {
  document.querySelectorAll('#people-modal, #castings-modal').forEach(modal => {
    modal.style.display = 'none';
    // очищаем видео, если есть
    const iframe = modal.querySelector('iframe');
    if (iframe) iframe.src = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Люди — клик по всей карточке
  document.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', () => {
      openPeopleModal({
        name: card.dataset.name,
        role: card.dataset.role,
        bio:  card.dataset.bio
      });
    });
  });

  // Кастинги — только кнопка «Подробнее»
  document.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();           // важно — чтобы не срабатывал клик по карточке timeline-item

      const item = btn.closest('.timeline-item');
      if (!item) return;

      openCastingsModal({
        name:        item.dataset.name,
        date:        item.dataset.date,
        video:       item.dataset.video,
        description: item.dataset.description
      });
    });
  });

  // ───────────────────────────────────────────────
  // Единый обработчик закрытия (самый надёжный вариант)
  document.addEventListener('click', function closeHandler(e) {
    // Если нет ни одной открытой модалки → выходим
    const anyOpen = document.querySelector('#people-modal[style*="block"], #castings-modal[style*="block"]');
    if (!anyOpen) return;

    const target = e.target;

    // 1. Крестик (ищем элемент с текстом × или класс close)
    if (
      target.textContent === '×' ||
      target.textContent === '×' ||           // на случай разных символов
      target.closest('.close')
    ) {
      closeAllModals();
      return;
    }

    // 2. Клик по фону (сам контейнер модального окна)
    if (
      target.id === 'people-modal' ||
      target.id === 'castings-modal'
    ) {
      closeAllModals();
      return;
    }

  }, { capture: true });   // capture — чтобы перехватывать даже при stopPropagation

  // Дополнительно: закрытие по Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
});