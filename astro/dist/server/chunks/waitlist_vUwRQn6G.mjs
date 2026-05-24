import { c as createComponent } from './astro-component_CNLK_uwO.mjs';
import 'piccolore';
import { k as renderComponent, r as renderTemplate, m as maybeRenderHead } from './server_BBnQDNBb.mjs';
import { r as renderScript } from './script_DKkfqjt2.mjs';
import { $ as $$MainLayout } from './MainLayout_BV8-X1qr.mjs';

const $$Waitlist = createComponent(($$result, $$props, $$slots) => {
  const title = "Лист ожидания — Гастроли и выступления";
  const description = "Запишитесь в лист ожидания, чтобы первыми узнать о точных датах, городах и купить билеты на выступления.";
  return renderTemplate`${renderComponent($$result, "Layout", $$MainLayout, { "title": title, "description": description, "data-astro-cid-w7n6fwfs": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="section waitlist" data-astro-cid-w7n6fwfs> <div class="container" data-astro-cid-w7n6fwfs> <div class="hero" data-astro-cid-w7n6fwfs> <h1 data-astro-cid-w7n6fwfs>Станьте частью первых</h1> <p class="lead" data-astro-cid-w7n6fwfs>
Запишитесь в лист ожидания — сообщим вам о датах гастролей 2026–2027 раньше всех и дадим приоритет на покупку билетов.
</p> </div> <div class="waitlist-card" data-astro-cid-w7n6fwfs> <div class="counter" data-astro-cid-w7n6fwfs></div> <form class="waitlist-form" id="waitlist-form" data-astro-cid-w7n6fwfs> <div class="form-group" data-astro-cid-w7n6fwfs> <label for="name" data-astro-cid-w7n6fwfs>Имя</label> <input type="text" id="name" name="name" placeholder="Как к вам обращаться?" required data-astro-cid-w7n6fwfs> </div> <div class="form-group" data-astro-cid-w7n6fwfs> <label for="email" data-astro-cid-w7n6fwfs>Email</label> <input type="email" id="email" name="email" placeholder="Ваш основной email" required data-astro-cid-w7n6fwfs> </div> <div class="form-group" data-astro-cid-w7n6fwfs> <label for="city" data-astro-cid-w7n6fwfs>Желаемый город</label> <input type="text" id="city" name="city" placeholder="Например: Екатеринбург, Новосибирск…" data-astro-cid-w7n6fwfs> </div> <div class="form-group" data-astro-cid-w7n6fwfs> <label for="project" data-astro-cid-w7n6fwfs>Интересующий проект / спектакль</label> <textarea id="project" name="project" rows="2" placeholder="Можно указать несколько или оставить пустым" data-astro-cid-w7n6fwfs></textarea> </div> <button type="submit" class="btn-primary" data-astro-cid-w7n6fwfs>Записаться в лист ожидания</button> </form> <p class="privacy" data-astro-cid-w7n6fwfs>
Мы ценим вашу приватность. Данные используются только для уведомлений о гастролях.
</p> </div> <div class="benefits" data-astro-cid-w7n6fwfs> <h2 data-astro-cid-w7n6fwfs>Что вы получите, записавшись</h2> <div class="benefits-grid" data-astro-cid-w7n6fwfs> <div class="benefit-item" data-astro-cid-w7n6fwfs> <span class="icon" data-astro-cid-w7n6fwfs>🔔</span> <p data-astro-cid-w7n6fwfs>Первыми узнаете точные даты и города</p> </div> <div class="benefit-item" data-astro-cid-w7n6fwfs> <span class="icon" data-astro-cid-w7n6fwfs>🎟️</span> <p data-astro-cid-w7n6fwfs>Приоритетный доступ к билетам (без очереди)</p> </div> <div class="benefit-item" data-astro-cid-w7n6fwfs> <span class="icon" data-astro-cid-w7n6fwfs>✉️</span> <p data-astro-cid-w7n6fwfs>Эксклюзивные анонсы и бонусы для участников</p> </div> <div class="benefit-item" data-astro-cid-w7n6fwfs> <span class="icon" data-astro-cid-w7n6fwfs>❤️</span> <p data-astro-cid-w7n6fwfs>Возможность повлиять на выбор городов</p> </div> </div> </div> <!-- Можно добавить блок с картой или отзывами позже --> </div> </section> ` })}  ${renderScript($$result, "/home/romanus/Project/Shagali/astro/src/pages/waitlist.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/romanus/Project/Shagali/astro/src/pages/waitlist.astro", void 0);

const $$file = "/home/romanus/Project/Shagali/astro/src/pages/waitlist.astro";
const $$url = "/waitlist";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Waitlist,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
