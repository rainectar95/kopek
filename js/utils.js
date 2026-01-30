// js/utils.js

export const timeManager = {
    // Получение ключа даты "ГГГГ-ММ-ДД" по местному времени
    getLocalKey: (dateInput) => {
        const d = new Date(dateInput);
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
            .toISOString().slice(0, 10);
    },

    // Проверка диапазона
    isInRange: (recordDateStr, startDate, endDate) => {
        const d = new Date(recordDateStr);
        const s = new Date(startDate); s.setHours(0, 0, 0, 0);
        const e = new Date(endDate); e.setHours(23, 59, 59, 999);
        return d >= s && d <= e;
    },

    // Проверка "Сегодня"
    isToday: (recordDateStr) => {
        return timeManager.getLocalKey(new Date()) === timeManager.getLocalKey(recordDateStr);
    }
};

export const formatMoney = (num) => {
    return Math.round(num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' ₽';
};

export const getGenitiveMonth = (d) => {
    return ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][d.getMonth()];
};

// js/utils.js

// ... (ваш старый код timeManager, formatMoney и т.д.) ...

export const haptics = {
    // Флаг: включены ли вибрации (читается из настроек)
    enabled: true,

    // ШАБЛОНЫ (Длительность в миллисекундах)
    // Одиночное число = один импульс.
    // Массив [вибрация, пауза, вибрация] = паттерн.
patterns: {
        // --- ПРОСТЫЕ (Одно число) ---
        tap: 1,               // Очень короткий "тык"
        soft: 1,             // Чуть заметнее
        medium: 1,           // Обычный отклик
        heavy: 8,            // Тяжелый удар

        // --- СОБЫТИЯ (Таймлайны) ---
        
        // SUCCESS: "Ты-дын!"
        // 10мс вибро -> 50мс тишины -> 20мс вибро
        // success: [1, 350, 5], 

        // ERROR: "Бз-бз-бз" (Резкий сбой)
        // 30мс вибро -> 30мс пауза -> 30мс вибро -> 30мс пауза -> 50мс вибро (финал посильнее)
        // error: [30, 30, 30, 30, 50],

        // WARNING: "Тук-тук"
        // 20мс вибро -> 40мс пауза -> 20мс вибро
        // warning: [20, 40, 20],

        // --- ИНТЕРФЕЙС ---

        // OPEN: "Вжух" (Нарастание через серию быстрых импульсов)
        // Короткий -> пауза -> Средний -js/utils.js> пауза -> Длинный
        // open:  [0, 300, 5] , 

        // DELETE: Длинное затухание (имитация)
        // delete: [4, 200, 10, 800, 5],
        
        // DELAYED: Если нужна вибрация с задержкой (например, после анимации)
        // 0 вибро -> 200 пауза -> 20 вибро
        // delayedTap: [0, 200, 20] 
    },
    // Основной метод вызова
vibrate(type) {
        if (!this.enabled || !window.navigator || !window.navigator.vibrate) return;

        const pattern = this.patterns[type] || 15;

        // --- ЛОГИКА ЗАДЕРЖКИ (ИСПРАВЛЕНИЕ) ---
        // Если это массив и первое число 0 (или меньше 1)
        if (Array.isArray(pattern) && pattern[0] === 0) {
            const delay = pattern[1]; // Второе число - это время паузы
            const restOfPattern = pattern.slice(2); // Всё остальное - сама вибрация

            // Используем JS таймер вместо глючного navigator.vibrate([0...])
            setTimeout(() => {
                if (restOfPattern.length > 0) {
                    try { window.navigator.vibrate(restOfPattern); } catch (e) {}
                }
            }, delay);
            
            return; // Выходим, так как вибрацию запустит таймер
        }

        // Обычный запуск (без задержки в начале)
        try {
            window.navigator.vibrate(pattern);
        } catch (e) {}
    },

    // Алиасы для удобства (чтобы писать haptics.success() вместо vibrate('success'))
    tap() { this.vibrate('tap'); },
    impactLight() { this.vibrate('soft'); },
    impactMedium() { this.vibrate('medium'); },
    impactHeavy() { this.vibrate('heavy'); },
    openModal() { this.vibrate('open'); },
    success() { this.vibrate('success'); },
    error() { this.vibrate('error'); },
};