// tours-interactive.js
document.addEventListener('DOMContentLoaded', () => {
  const dots = document.querySelectorAll('.city-dot');
  const popover = document.getElementById('tour-popover');
  const mapContainer = document.querySelector('.map-container');

  if (!popover || !mapContainer) {
    console.warn('Popover или map-container не найдены');
    return;
  }

  const closeBtn = popover.querySelector('.popover-close');

  // Данные будущих гастролей
  const showsData = {
    "Скрипичное Шоу": {
      title: "Скрипичное Шоу",
      desc: "Виртуозное сочетание музыки и драмы. Билеты от 1500 руб.",
      img: "/images/projects/skripka-show.jpg",
      link: "#" // ← замени на реальную ссылку
    },
    "Родной Мой Кукушонок": {
      title: "Родной Мой Кукушонок",
      desc: "Трогательная история о семье и потере. Билеты от 1200 руб.",
      img: "/images/projects/kukushonok.jpg",
      link: "#"
    },
    "Мамочка, Купи Собаку": {
      title: "Мамочка, Купи Собаку",
      desc: "Юмористическая комедия о повседневных желаниях. Билеты от 1000 руб.",
      img: "/images/projects/mamochka-sobaka.jpg",
      link: "#"
    },
    "Неделя Испании": {
      title: "Неделя Испании",
      desc: "Фламенко, страсть и испанский колорит. Билеты от 2000 руб.",
      img: "/images/projects/flamenko.jpg",
      link: "#"
    }
  };

  // Связь data-city → название спектакля
  const cityToShow = {
    moscow:     "Скрипичное Шоу",
    spb:        "Мамочка, Купи Собаку",
    ekb:        "Родной Мой Кукушонок",
    novosib:    "Неделя Испании",
  };

  // Данные для уже состоявшихся гастролей
  const visitedCitiesData = {
    vladivostok: {
      title: "Спасибо, Владивосток!",
      comment: "Ваш город встретил нас невероятной энергией и потрясающей атмосферой у моря. Зал пел вместе с нами — это было незабываемо! Возвращаемся обязательно ♥",
      img: "/cities/vladivostok.jpg",
      type: "visited"
    }
  };

  function hidePopover() {
    popover.classList.remove('visible', 'arrow-top', 'arrow-bottom', 'visited-mode');
    popover.querySelector('.popover-btn').style.display = 'block';
  }

  function positionPopover(triggerElement) {
    const containerRect = mapContainer.getBoundingClientRect();
    const triggerRect   = triggerElement.getBoundingClientRect();

    // Берём актуальные размеры уже видимого поповера
    const pw = popover.offsetWidth  || 280;   // fallback, если 0
    const ph = popover.offsetHeight || 240;   // fallback

    const PADDING       = 16;
    const ARROW_GAP     = 12;

    // Базовая позиция — сверху по центру
    let x = triggerRect.left - containerRect.left + (triggerRect.width / 2) - (pw / 2);
    let y = triggerRect.top  - containerRect.top  - ph - ARROW_GAP;

    let arrow = 'bottom';

    // Горизонтальная корректировка
    x = Math.max(PADDING, x);
    x = Math.min(x, containerRect.width - pw - PADDING);

    // Вертикальная: если сверху не влезает → показываем снизу
    if (y < PADDING) {
        y = triggerRect.bottom - containerRect.top + ARROW_GAP;
        arrow = 'top';
    }

    // Дополнительная защита: если и снизу не влезает — хотя бы не улетать сильно вниз
    if (y + ph > containerRect.height - PADDING) {
        y = containerRect.height - ph - PADDING;
        // Можно здесь оставить arrow='top' или добавить логику бокового позиционирования позже
    }

    popover.style.left = `${x}px`;
    popover.style.top  = `${y}px`;

    popover.classList.remove('arrow-top', 'arrow-bottom');
    popover.classList.add(`arrow-${arrow}`);
  }

  function showPopoverForCity(cityDot) {
    const cityKey = cityDot.dataset.city;

    // Сбрасываем состояние
    popover.classList.remove('visited-mode');

    // 1. Посещённый город
    if (visitedCitiesData[cityKey]) {
      const data = visitedCitiesData[cityKey];

      popover.querySelector('.popover-title').textContent = data.title;
      popover.querySelector('.popover-desc').textContent = data.comment;
      popover.querySelector('.popover-img').src = data.img;
      popover.querySelector('.popover-btn').style.display = 'none';

      popover.classList.add('visited-mode');
    }
    // 2. Будущая гастроль
    else {
      const showName = cityToShow[cityKey];
      if (!showName || !showsData[showName]) {
        hidePopover();
        return;
      }

      const show = showsData[showName];

      popover.querySelector('.popover-title').textContent = show.title;
      popover.querySelector('.popover-desc').textContent = show.desc;
      popover.querySelector('.popover-img').src = show.img;
      popover.querySelector('.popover-btn').href = show.link;
      popover.querySelector('.popover-btn').style.display = 'block';
    }

    // Показываем и позиционируем
    popover.classList.add('visible');
    // Даём браузеру отрендерить размеры
    requestAnimationFrame(() => {
      positionPopover(cityDot);
    });
  }

  // События
  dots.forEach(dot => {
    dot.addEventListener('click', () => showPopoverForCity(dot));

    // Для мобильных устройств
    dot.addEventListener('touchstart', (e) => {
      e.preventDefault();
      showPopoverForCity(dot);
    }, { passive: false });
  });

  // Закрытие
  if (closeBtn) {
    closeBtn.addEventListener('click', hidePopover);
  }

  // Клик вне поповера и точек → закрыть
  document.addEventListener('click', (e) => {
    if (
      !popover.contains(e.target) &&
      !Array.from(dots).some(dot => dot.contains(e.target))
    ) {
      hidePopover();
    }
  });
});