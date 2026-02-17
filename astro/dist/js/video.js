
  const track = document.getElementById('track');
  const slides = Array.from(document.querySelectorAll('.video-slide'));
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const progress = document.getElementById('progress');

  let current = Math.floor(slides.length / 2);
  let isAnimating = false;

  // Клоны для бесконечной прокрутки
  const firstClone = slides[0].cloneNode(true);
  const lastClone  = slides[slides.length-1].cloneNode(true);
  track.appendChild(firstClone);
  track.insertBefore(lastClone, slides[0]);

  const allSlides = Array.from(track.children);

  function update() {
    if (isAnimating) return;
    isAnimating = true;

    const slideWidth = allSlides[0].offsetWidth + 51; // gap 3.2rem ≈ 51px
    const offset = -(current + 1) * slideWidth;

    track.style.transform = `translateX(${offset}px)`;

    allSlides.forEach((s, i) => {
      const realIndex = (i - 1 + slides.length) % slides.length;
      s.classList.remove('active','prev','next');
      if (realIndex === current)         s.classList.add('active');
      if (realIndex === (current - 1 + slides.length) % slides.length) s.classList.add('prev');
      if (realIndex === (current + 1) % slides.length)               s.classList.add('next');
    });

    progress.style.width = `${((current + 1) / slides.length) * 100}%`;

    setTimeout(() => { isAnimating = false; }, 1150);
  }

  function next() {
    if (current >= slides.length - 1) {
      current = -1;
      track.style.transition = 'none';
      update();
      requestAnimationFrame(() => {
        track.style.transition = 'transform 1.15s cubic-bezier(0.16,1,0.3,1)';
        current++;
        update();
      });
    } else {
      current++;
      update();
    }
  }

  function prev() {
    if (current <= 0) {
      current = slides.length;
      track.style.transition = 'none';
      update();
      requestAnimationFrame(() => {
        track.style.transition = 'transform 1.15s cubic-bezier(0.16,1,0.3,1)';
        current--;
        update();
      });
    } else {
      current--;
      update();
    }
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // Touch-свайп
  let startX = 0;
  let currentTranslate = 0;
  let prevTranslate = 0;

  track.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    prevTranslate = currentTranslate;
  });

  track.addEventListener('touchmove', e => {
    if (!startX) return;
    const diff = e.touches[0].clientX - startX;
    currentTranslate = prevTranslate + diff;
    track.style.transform = `translateX(${currentTranslate}px)`;
  });

  track.addEventListener('touchend', () => {
    const movedBy = currentTranslate - prevTranslate;
    startX = 0;
    currentTranslate = 0;

    if (movedBy < -90) next();
    else if (movedBy > 90) prev();
    else update();
  });

  // Инициализация
  update();

  // Опционально — автопрокрутка
  // setInterval(next, 5800);
