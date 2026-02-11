// tours-interactive.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("Скрипт запустился — время:", new Date().toLocaleTimeString());

  const dots = document.querySelectorAll('.city-dot');
  const popover = document.getElementById('tour-popover');
  const mapContainer = document.querySelector('.map-container');

  console.log("Точек найдено:", dots.length);
  console.log("popover:", popover ? "найден" : "НЕ НАЙДЕН");

  if (!popover || !mapContainer) {
    console.warn('Popover или map-container не найдены');
    return;
  }

  const closeBtn = popover.querySelector('.popover-close');

  // ────────────────────────────────────────────────
  // Данные спектаклей и городов
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
    // добавляй другие города сюда
  };

  // ────────────────────────────────────────────────
  // Функции popover
  // ────────────────────────────────────────────────
  function hidePopover() {
    popover.classList.remove('visible', 'arrow-top', 'arrow-bottom', 'visited-mode');
    const btn = popover.querySelector('.popover-btn');
    if (btn) btn.style.display = 'block';
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
      const btn = popover.querySelector('.popover-btn');
      if (btn) {
        btn.href = show.link;
        btn.style.display = 'block';
      }
    }

    popover.classList.add('visible');

    requestAnimationFrame(() => {
      positionPopover(cityDot);
    });
  }

  // ────────────────────────────────────────────────
  // События кликов/тапов по точкам
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
  // Panzoom от timmywil — pinch + pan на мобильных
  // ────────────────────────────────────────────────
  if (svg) {
    const isMobile = 
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 1024;

    if (isMobile) {
      try {
        import('@panzoom/panzoom').then(({ default: Panzoom }) => {
          const panzoomInstance = Panzoom(svg, {
            maxZoom: 12,
            minZoom: 0.3,
            zoomSpeed: 0.065,           // плавность зума
            animate: true,
            duration: 200,
            easing: 'ease-out',
            touchAction: 'auto',        // пусть CSS управляет
            contain: 'inside',          // не улетать за границы
            noPanOnDblClick: true,      // отключаем dblclick pan
            focal: true                 // зум от центра жеста
          });

          // Скрываем поповер при любом жесте
          mapContainer.addEventListener('pointerdown', (e) => {
            if (popover.classList.contains('visible') && !popover.contains(e.target)) {
              hidePopover();
            }
          }, { passive: true });

          // Опционально: отключить зум колёсиком на десктопе, если нужно
          // panzoomInstance.zoomIn = () => {}; // пример отключения

          console.log("Panzoom (timmywil) успешно запущен — pinch должен работать");

        }).catch(err => {
          console.error("Ошибка динамического импорта Panzoom:", err);
        });

      } catch (err) {
        console.error("Ошибка инициализации Panzoom:", err);
      }
    } else {
      console.log("Десктоп — Panzoom не включается");
    }
  } else {
    console.warn("SVG-элемент не найден");
  }
});