// tours-interactive.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("Скрипт запустился — время:", new Date().toLocaleTimeString());

  const dots = document.querySelectorAll('.city-dot');
  const popover = document.getElementById('tour-popover');
  const mapContainer = document.querySelector('.map-container');

  console.log("Точек найдено:", dots.length);
  console.log("popover по getElementById:", popover);

  if (!popover || !mapContainer) {
    console.warn('Popover или map-container не найдены');
    return;
  }

  const closeBtn = popover.querySelector('.popover-close');

  // ────────────────────────────────────────────────
  // Данные спектаклей и городов (без изменений)
  // ────────────────────────────────────────────────
  const showsData = {
    "Скрипичное Шоу": {
      title: "Скрипичное Шоу",
      desc: "Виртуозное сочетание музыки и драмы. Билеты от 1500 руб.",
      img: "/images/projects/skripka-show.jpg",
      link: "#" 
    },
    "Родной Мой Кукушонок": {
      title: "Родной Мой Кукушонок",
      desc: "Трогательная история о семье и потере. Билеты от 1200 руб.",
      img: "/dist/images/projects/kukushonok.jpeg",
      link: "#"
    },
    "Мамочка, Купи Собаку": {
      title: "Мамочка, Купи Собаку",
      desc: "Юмористическая комедия о повседневных желаниях. Билеты от 1000 руб.",
      img: "/dist/images/projects/doggy.jpeg",
      link: "#"
    },
    "Неделя Испании": {
      title: "Неделя Испании",
      desc: "Фламенко, страсть и испанский колорит. Билеты от 2000 руб.",
      img: "/images/projects/flamenko.jpg",
      link: "#"
    }
  };

  const cityToShow = {
    moscow:     "Скрипичное Шоу",
    spb:        "Мамочка, Купи Собаку",
    ekb:        "Родной Мой Кукушонок",
    novosib:    "Неделя Испании",
  };

  const visitedCitiesData = {
    vladivostok: {
      title: "Спасибо, Владивосток!",
      comment: "Ваш город встретил нас невероятной энергией и потрясающей атмосферой у моря. Зал пел вместе с нами — это было незабываемо! Возвращаемся обязательно ♥",
      img: "/dist/images/cities/vladivostok.jpg",
      type: "visited"
    }
  };

  // ────────────────────────────────────────────────
  // Функции popover (без изменений)
  // ────────────────────────────────────────────────
  function hidePopover() {
    popover.classList.remove('visible', 'arrow-top', 'arrow-bottom', 'visited-mode');
    popover.querySelector('.popover-btn').style.display = 'block';
  }

  function positionPopover(triggerElement) {
    const containerRect = mapContainer.getBoundingClientRect();
    const triggerRect   = triggerElement.getBoundingClientRect();

    const pw = popover.offsetWidth  || 280;
    const ph = popover.offsetHeight || 240;

    const PADDING    = 16;
    const ARROW_GAP  = 12;

    let x = triggerRect.left - containerRect.left + (triggerRect.width / 2) - (pw / 2);
    let y = triggerRect.top  - containerRect.top  - ph - ARROW_GAP;

    let arrow = 'bottom';

    x = Math.max(PADDING, Math.min(x, containerRect.width - pw - PADDING));

    if (y < PADDING) {
      y = triggerRect.bottom - containerRect.top + ARROW_GAP;
      arrow = 'top';
    }

    if (y + ph > containerRect.height - PADDING) {
      y = containerRect.height - ph - PADDING;
    }

    popover.style.left = `${x}px`;
    popover.style.top  = `${y}px`;

    popover.classList.remove('arrow-top', 'arrow-bottom');
    popover.classList.add(`arrow-${arrow}`);
  }

  function showPopoverForCity(cityDot) {
    const cityKey = cityDot.dataset.city;

    popover.classList.remove('visited-mode');

    if (visitedCitiesData[cityKey]) {
      const data = visitedCitiesData[cityKey];
      popover.querySelector('.popover-title').textContent = data.title;
      popover.querySelector('.popover-desc').textContent = data.comment;
      popover.querySelector('.popover-img').src = data.img;
      popover.querySelector('.popover-btn').style.display = 'none';
      popover.classList.add('visited-mode');
    } else {
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

    popover.classList.add('visible');

    // Даём браузеру время на расчёт размеров после visible
    requestAnimationFrame(() => {
      positionPopover(cityDot);
    });
  }

  // ────────────────────────────────────────────────
  // Клик по точкам (делегирование через svg)
  // ────────────────────────────────────────────────
  const svg = document.querySelector('.map-container svg');

  if (svg) {
    svg.addEventListener('click', (e) => {
      const dot = e.target.closest('.city-dot');
      if (dot) {
        showPopoverForCity(dot);
      }
    });

    svg.addEventListener('touchstart', (e) => {
      const dot = e.target.closest('.city-dot');
      if (dot) {
        e.preventDefault();
        showPopoverForCity(dot);
      }
    }, { passive: false });
  }

  // Закрытие поповера
  if (closeBtn) {
    closeBtn.addEventListener('click', hidePopover);
  }

  document.addEventListener('click', (e) => {
    if (
      !popover.contains(e.target) &&
      !Array.from(dots).some(dot => dot.contains(e.target))
    ) {
      hidePopover();
    }
  });

  // ────────────────────────────────────────────────
  // svg-pan-zoom ТОЛЬКО НА МОБИЛЬНЫХ
  // ────────────────────────────────────────────────
  if (typeof svgPanZoom !== 'undefined' && svg) {
    const isMobile = window.innerWidth <= 1024;  // можно изменить порог: 768, 900, 1024...

    if (isMobile) {
      try {
        const panZoom = svgPanZoom(svg, {
          zoomEnabled:            true,
          panEnabled:             true,
          controlIconsEnabled:    false,       // ← никаких кнопок + / -
          fit:                    1,
          center:                 true,
          dblClickZoomEnabled:    false,       // двойной тап → не зумить
          mouseWheelZoomEnabled:  false,       // колёсико мыши не влияет (на моб. не актуально)
          minZoom:                0.6,
          maxZoom:                8,
          zoomScaleSensitivity:   0.65,

          // Прячем поповер при любом изменении вида (чтобы не висел в странном месте)
          beforeZoom: function() {
            if (popover.classList.contains('visible')) {
              hidePopover();
            }
            return true;
          },
          beforePan: function() {
            if (popover.classList.contains('visible')) {
              hidePopover();
            }
            return true;
          }
        });

        console.log("svg-pan-zoom активирован только для мобильных устройств");

        // Опционально: ресайз окна → проверяем заново
        window.addEventListener('resize', () => {
          const nowMobile = window.innerWidth <= 1024;
          if (nowMobile !== isMobile) {
            // Если перешли с моб. на десктоп или обратно — можно destroy / re-init
            // но для простоты оставляем как есть (библиотека не сильно мешает на десктопе)
          }
        });

      } catch (err) {
        console.error("Ошибка при запуске svg-pan-zoom:", err);
      }
    } else {
      console.log("Десктоп: svg-pan-zoom отключён");
    }
  } else {
    console.warn("svgPanZoom не загружен или SVG не найден");
  }
});