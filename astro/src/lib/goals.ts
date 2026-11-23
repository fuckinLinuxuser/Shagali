// Цели Метрики, привязанные к визиту страницы: элемент с data-goal-view="<цель>" (city_view, purchase).
// Подключается из MainLayout; отправка идёт через reachGoal() — без согласия цель не уходит.
import { reachGoal, type Goal } from './counters';

document.querySelectorAll<HTMLElement>('[data-goal-view]').forEach((el) => reachGoal(el.dataset.goalView as Goal));
