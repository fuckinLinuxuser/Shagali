// Закрытый просмотр: пока site.json → closed = true, на / стоит заглушка «в разработке» с входом по паролю,
// настоящая главная лежит на /preview, а все страницы с noindex. К запуску витрины: closed → false (docs/SITE-PASSWORD.md).
// SHAGALI_CLOSED=0|1 при сборке перекрывает файл (стенд собирается открытым — иначе e2e не видят каталог).
import site from '../data/site.json';

export const isClosed = (): boolean =>
  process.env.SHAGALI_CLOSED !== undefined ? process.env.SHAGALI_CLOSED === '1' : site.closed;
