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