  import { Swiper } from 'swiper';
  import { EffectFade, Navigation, Pagination, Autoplay } from 'swiper/modules';

  document.addEventListener('astro:page-load', () => {
    new Swiper('.projects-swiper', {
      modules: [EffectFade, Navigation, Pagination, Autoplay],
      
      effect: 'fade',
      fadeEffect: { crossFade: true },
      
      speed: 1200,
      autoplay: { delay: 6500, disableOnInteraction: false },
      loop: true,
      
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
        bulletClass: 'swiper-pagination-bullet !bg-white/60 !w-3 !h-3 !rounded-full',
        bulletActiveClass: '!bg-gold !w-8 !opacity-100',
      },

      // Лёгкий zoom-эффект на фото
      on: {
        slideChangeTransitionStart: (swiper) => {
          swiper.slides.forEach(slide => {
            const img = slide.querySelector('img');
            if (img) img.style.transform = 'scale(1.08)';
          });
        },
        slideChangeTransitionEnd: (swiper) => {
          const active = swiper.slides[swiper.activeIndex];
          const img = active?.querySelector('img');
          if (img) img.style.transform = 'scale(1.12)';
        },
      },
    });
  });