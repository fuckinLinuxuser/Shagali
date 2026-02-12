    // Появление элементов при скролле
    const items = document.querySelectorAll('.timeline-item');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.2 });
    items.forEach(item => observer.observe(item));

    // Навигация + прогресс
    const wrapper = document.getElementById('timelineWrapper');
    const prev = document.getElementById('prev');
    const next = document.getElementById('next');
    const progressFill = document.getElementById('progressFill');
    let scrollPos = 0;
    const itemWidth = 360 + 60; // ширина карточки + margin
    const maxScroll = (items.length - 1) * itemWidth;

    function updateProgress() {
        if (!progressFill) return;
        const percent = Math.min(100, (scrollPos / maxScroll) * 100);
        progressFill.style.width = `${percent}%`;
    }

    next?.addEventListener('click', () => {
        scrollPos = Math.min(maxScroll, scrollPos + itemWidth);
        wrapper.style.transform = `translateX(-${scrollPos}px)`;
        updateProgress();
        setTimeout(highlightNearestCard, 650);
    });

    prev?.addEventListener('click', () => {
        scrollPos = Math.max(0, scrollPos - itemWidth);
        wrapper.style.transform = `translateX(-${scrollPos}px)`;
        updateProgress();
        setTimeout(highlightNearestCard, 650);
    });

    updateProgress();

    // Центрирование карточки по клику
    items.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            // Если нажали на кнопку «Подробнее» — ничего не делаем здесь
            if (e.target.closest('.btn-detail')) return;

            // Проверяем ширину экрана
            if (window.innerWidth > 900) {           // ← только на десктопе центрируем
                const container = document.querySelector('.timeline-container');
                const containerWidth = container.offsetWidth;
                const targetScroll = index * itemWidth - (containerWidth / 2 - itemWidth / 2) + 30;
                scrollPos = Math.max(0, Math.min(maxScroll, targetScroll));
                wrapper.style.transform = `translateX(-${scrollPos}px)`;
                updateProgress();
                setTimeout(highlightNearestCard, 650);
            }
            // на мобильных — просто игнорируем клик по карточке (кроме кнопки)
        });
    });
    // Подсветка ближайшей карточки
    function highlightNearestCard() {
        if (!wrapper) return;
        const container = document.querySelector('.timeline-container');
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        let closest = null;
        let minDist = Infinity;
        items.forEach(item => {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.left + rect.width / 2;
            const dist = Math.abs(itemCenter - centerX);
            if (dist < minDist) {
                minDist = dist;
                closest = item;
            }
        });
        items.forEach(i => i.classList.remove('nearest'));
        if (closest) closest.classList.add('nearest');
    }

    window.addEventListener('resize', highlightNearestCard);
    ['click', 'scroll'].forEach(ev => window.addEventListener(ev, highlightNearestCard));
    next?.addEventListener('click', () => setTimeout(highlightNearestCard, 650));
    prev?.addEventListener('click', () => setTimeout(highlightNearestCard, 650));
    highlightNearestCard();

    // Добавьте в конец скрипта или замените существующий обработчик scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
    });