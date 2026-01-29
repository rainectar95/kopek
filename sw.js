const CACHE_NAME = 'masterlog-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  // Добавляем основные картинки, чтобы интерфейс не был "дырявым" без сети
  './img/man.svg',
  './img/woman.svg',
  './img/child.svg',
  './img/empty.svg',
  './img/calendar.svg',
  './img/trash.svg'
];

// 1. Установка: кэшируем все важные файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Активация: удаляем старые кэши, если обновили версию
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// 3. Запросы: сначала ищем в кэше, если нет — идем в сеть
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Если файл есть в кэше — возвращаем его
      if (response) {
        return response;
      }
      // Если нет — качаем из интернета
      return fetch(event.request);
    })
  );
});