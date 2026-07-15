function p(a){return a?a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"):""}const y=[{id:"kukushonok",title:"Родной мой Кукушонок",dates:["28 июня 2026"],description:"Драму проживает каждый Ребенок, разочаровавший своих родителей. Трагедию носит в себе каждая Мать, оттолкнувшая своего ребенка...",quote:'"Спектакль о том, как взрослеют родители..."',image:"/images/projects/kukushonok.JPG",actors:[{name:"Валерия",role:"Актриса",video:"/videos/valeria.mp4",bio:`Она из тех людей, которых хочешь видеть в своем будущем сталкерском отряде. С пути не свернёт даже при сильном шторме. Патроны вовремя поднесёт (причем молча, что особенно важно в сложной ситуации). Будет уверенно держать атаку зомби в узком дверном проёме, отбиваясь попеременно лопатой и букетом гладиолусов… При этом шикарно танцует танго, готовит какие-то невероятные оладушки и вечерами смотрит с детворой хорошие советские фильмы.

Люблю видеть её на сцене. Знаю, что буду чувствовать и проживать вслед за ней. Буду внутри повторять ее реплики и тайком плакать ее слезами. Живая. Сложная. Странная.

В общем, не актриса, а мечта. Не ту женщину Сарой Коннор назвали.

Да и не надо. Наша – интереснее. И моложе, кстати!`},{name:"Анна",role:"Актриса. Хореограф.",video:"/videos/anna.mp4",bio:`При всей своей внешней хрупкости эта девушка умеет упереться лапкой и упорно добиваться поставленной цели – сказывается балетная выучка. Мечтает об ярком музыкальном шоу, которое мы могли бы провезти по всей стране. И мы шаг за шагом идем к тому, чтобы реализовать эту красивую мечту.

Потому что какой смысл жить в мире, который не украшен музыкой и движением?

Может, она не построит мощный каменный дом. Зато вы бы видели, какие нежные и парящие воздушные замки она строит одним поворотом головы.

Вероятно, она не будет угощать нас на репетициях свежевыращенными кабачками. Но когда она заходит в театр – все лица расцветают улыбками.

Красоту нужно уметь создавать, и это идёт изнутри.

У неё – получается.`},{name:"Егор",role:"Актер"},{name:"Алексей",role:"Актер"}],duration:"1 час 30 минут",ageRestriction:"16+"}];document.addEventListener("DOMContentLoaded",()=>{const a=document.getElementById("playsGrid"),d=document.getElementById("playModal"),g=document.getElementById("modalClose"),k=document.getElementById("modalImage"),v=document.getElementById("modalTitle"),E=document.getElementById("modalDate"),f=document.getElementById("modalQuote"),M=document.getElementById("modalDescription"),c=document.getElementById("modalActors"),l=document.getElementById("actorModal"),I=document.getElementById("actorModalClose"),i=document.getElementById("actorModalImage"),b=document.getElementById("actorModalName"),B=document.getElementById("actorModalRole"),m=document.getElementById("actorModalVideoWrapper"),s=document.getElementById("actorModalVideo"),L=document.getElementById("actorModalBio");if(!a||!d||!g||!k||!v||!E||!f||!M||!c||!l||!I||!i||!b||!B||!m||!s||!L)return;function h(){let e="";const o=y.find(t=>t.id==="kukushonok");o&&(e+=`
          <div class="special-play-kukushonok" data-play-id="${o.id}">
            <img src="${o.image}" alt="${o.title}" class="kukushonok-image" loading="lazy">
            <div class="kukushonok-info">
              <div class="kukushonok-title">${o.title}</div>
              <p style="color: #666; margin-top: 0.5rem;">Нажмите для подробностей</p>
            </div>
          </div>
        `),e+=y.filter(t=>t.id!=="kukushonok").map(t=>`
        <div class="play-item" data-play-id="${t.id}">
          <div class="play-title">${t.title}</div>
          <div class="play-dates">${t.dates.map(n=>`<span>${n}</span>`).join(" • ")}</div>
        </div>
      `).join(""),a.innerHTML=e,a.querySelectorAll("[data-play-id]").forEach(t=>{t.addEventListener("click",()=>{const n=y.find(x=>x.id===t.dataset.playId);n&&C(n)})})}function C(e){k.src=e.image,v.textContent=e.title,E.textContent=e.dates.join(" • "),f.textContent=e.quote||"",M.textContent=e.description,c.innerHTML=e.actors.map((o,t)=>`
        <li><button type="button" class="actor-btn" data-actor-index="${t}">${p(o.name)} — ${p(o.role)}</button></li>
      `).join(""),c.querySelectorAll(".actor-btn").forEach(o=>{o.addEventListener("click",()=>{const t=Number(o.dataset.actorIndex),n=e.actors[t];n&&$(n)})}),d.classList.add("visible"),document.body.style.overflow="hidden"}function r(){d.classList.remove("visible"),document.body.style.overflow=""}function $(e){b.textContent=e.name,B.textContent=e.role,e.image?(i.src=e.image,i.alt=e.name,i.style.display="block"):i.style.display="none",e.video?(s.src=e.video,m.style.display="block"):m.style.display="none";const o=e.bio&&e.bio.trim()?e.bio:"Информация об актёре появится позже.";L.innerHTML=p(o).replace(/\n/g,"<br>"),l.classList.add("visible")}function u(){l.classList.remove("visible"),s.pause(),s.src=""}g.addEventListener("click",r),d.addEventListener("click",e=>{e.target===d&&r()}),I.addEventListener("click",u),l.addEventListener("click",e=>{e.target===l&&u()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&(l.classList.contains("visible")?u():d.classList.contains("visible")&&r())}),h()});
