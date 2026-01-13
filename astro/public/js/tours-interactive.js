// tours-interactive.js
document.addEventListener('DOMContentLoaded', () => {
    const dots = document.querySelectorAll('.city-dot');
    const popover = document.getElementById('tour-popover');

    if (!popover) {
        console.warn('Popover element not found');
        return;
    }

    const closeBtn = document.querySelector('.popover-close');

    // Данные будущих гастролей
    const showsData = {
        "Скрипичное Шоу": {
            title: "Скрипичное Шоу",
            desc: "Виртуозное сочетание музыки и драмы. Билеты от 1500 руб.",
            img: "/images/projects/skripka-show.jpg",
            link: "#"  // ← замени на реальную ссылку
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

    // Связь городов → будущие спектакли
    const cityToShow = {
        "moscow":     "Скрипичное Шоу",
        "spb":        "Мамочка, Купи Собаку",
        "ekb":        "Родной Мой Кукушонок",
        "novosib":    "Неделя Испании",
        // "vladivostok" → специально null, т.к. уже был
    };

    // Данные для уже состоявшихся гастролей
    const visitedCitiesData = {
        "vladivostok": {
            title: "Спасибо, Владивосток!",
            comment: "Ваш город встретил нас невероятной энергией и потрясающей атмосферой у моря. Зал пел вместе с нами — это было незабываемо! Возвращаемся обязательно ♥",
            img: "/cities/vladivostok.jpg", // ← положи реальное фото
            type: "visited"
        }
        // Можно легко добавить другие города позже
    };

    function hidePopover() {
        popover.classList.remove('visible', 'arrow-top', 'arrow-bottom', 'visited-mode');
        popover.querySelector('.popover-btn').style.display = 'block';
    }

    function positionPopover(cityDot) {
        const mapContainer = document.querySelector('.map-container');
        const mapRect = mapContainer.getBoundingClientRect();
        const dotRect = cityDot.getBoundingClientRect();

        const popoverWidth = 280;
        const popoverHeightApprox = 260;
        const offsetY = 15;
        const minMargin = 15;

        let x = (dotRect.left - mapRect.left) + (dotRect.width / 2) - (popoverWidth / 2);
        let y = (dotRect.top - mapRect.top) - popoverHeightApprox - offsetY;

        let arrowDirection = 'bottom';

        // Корректировка по горизонтали
        if (x < minMargin) x = minMargin;
        if (x + popoverWidth > mapRect.width - minMargin) {
            x = mapRect.width - popoverWidth - minMargin;
        }

        // Если сверху тесно → показываем снизу
        if (y < minMargin) {
            y = (dotRect.top - mapRect.top) + dotRect.height + offsetY + 5;
            arrowDirection = 'top';
        }

        popover.style.left = `${x}px`;
        popover.style.top  = `${y}px`;

        popover.classList.remove('arrow-top', 'arrow-bottom');
        popover.classList.add(`arrow-${arrowDirection}`);
    }

    function showPopoverForCity(cityDot) {
        const cityKey = cityDot.dataset.city;

        // 1. Проверяем, был ли уже визит в этот город
        if (visitedCitiesData[cityKey]) {
            const data = visitedCitiesData[cityKey];

            popover.querySelector('.popover-title').textContent = data.title;
            popover.querySelector('.popover-desc').textContent = data.comment;
            popover.querySelector('.popover-img').src = data.img;

            // Для посещённых городов скрываем кнопку покупки
            popover.querySelector('.popover-btn').style.display = 'none';

            popover.classList.add('visited-mode');
            positionPopover(cityDot);
            popover.classList.add('visible');
            return;
        }

        // 2. Обычные будущие гастроли
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

        popover.classList.remove('visited-mode');
        popover.querySelector('.popover-btn').style.display = 'block';

        positionPopover(cityDot);
        popover.classList.add('visible');
    }

    // События на все точки
    dots.forEach(dot => {
        dot.addEventListener('click', () => showPopoverForCity(dot));

        dot.addEventListener('touchstart', (e) => {
            e.preventDefault();
            showPopoverForCity(dot);
        }, { passive: false });
    });

    // Закрытие по крестику
    if (closeBtn) {
        closeBtn.addEventListener('click', hidePopover);
    }

    // Закрытие по клику вне поповера и точек
    document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) &&
            !Array.from(dots).some(dot => dot.contains(e.target))) {
            hidePopover();
        }
    });
});