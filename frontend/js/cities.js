const cities = {
    moscow: {
        img: "../public/images/violin-show.jpg",     // путь к фото спектакля
        title: "Скрипичное Шоу",
        date: "Январь 2026",
        link: "https://example.com/buy/moscow"       // реальная ссылка на билеты
    },
    spb: {
        img: "../public/images/mama-dog.jpg",
        title: "Мамочка, Купи Собаку",
        date: "Март 2026",
        link: "https://example.com/buy/spb"
    },
    ekb: {
        img: "../public/images/kukushonok.jpg",
        title: "Родной Мой Кукушонок",
        date: "Февраль 2026",
        link: "https://example.com/buy/ekb"
    },
    novosib: {
        img: "../public/images/spain-week.jpg",
        title: "Неделя Испании",
        date: "Апрель 2026",
        link: "https://example.com/buy/novosib"
    },
    vladivostok: {
        img: "../public/images/all-shows.jpg",
        title: "Все проекты",
        date: "Май 2026",
        link: "https://example.com/buy/vladivostok"
    }
};

const tooltip = document.getElementById('city-tooltip');
const dots = document.querySelectorAll('.city-dot');

dots.forEach(dot => {
    dot.addEventListener('mouseenter', () => showTooltip(dot));
    dot.addEventListener('mouseleave', hideTooltip);
    dot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.innerWidth <= 768) {  // только на мобильных
            showTooltip(dot);
        }
    });
});

document.addEventListener('click', () => hideTooltip());

function showTooltip(dot) {
    const city = cities[dot.dataset.city];
    if (!city) return;

    document.getElementById('tooltip-img').src = city.img;
    document.getElementById('tooltip-title').textContent = city.title;
    document.getElementById('tooltip-date').textContent = city.date;
    document.getElementById('tooltip-link').href = city.link;

    tooltip.classList.add('visible');

    // Позиционируем tooltip рядом с точкой
    const svgRect = dot.ownerSVGElement.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    tooltip.style.left = (dotRect.left - svgRect.left + 20) + 'px';
    tooltip.style.top = (dotRect.top - svgRect.top + 20) + 'px';
}

function hideTooltip() {
    tooltip.classList.remove('visible');
}
