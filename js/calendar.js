// js/calendar.js
import { timeManager } from './utils.js';

export const calendarMixin = {
    toggleCalendarModal(show) {
        if (show) {
            haptics.openModal();
            // Сброс выбора
            app.tempStart = null; app.tempEnd = null; app.selectingState = 'start';
            app.calendarViewDate = app.rangeStart ? new Date(app.rangeStart) : new Date();
            document.getElementById('calendar-modal').classList.add('open');

            this.renderFullCalendar();
            this.updateCalendarButton();
            // Скрываем выбор периода, если открыт
            this.togglePeriodModal(false);
        } else {
            document.getElementById('calendar-modal').classList.remove('open');
        }
    },

    renderFullCalendar() {
        const container = document.getElementById('calendar-content');
        const scrollBox = document.getElementById('calendar-scroll-container');

        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'continuous-grid';
        container.appendChild(grid);

        // Инициализация: загружаем текущий месяц, прошлый и будущий (3 месяца)
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 1 число прошлого месяца
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);   // Последний день следующего месяца

        this.loadDateRange(start, end, 'append');

        // Скроллим к сегодня
        setTimeout(() => this.scrollToTargetDate(now), 0);

        // Вешаем обработчик скролла
        scrollBox.onscroll = (e) => this.handleCalendarScroll(e);
    },

    // Основная функция загрузки (переиспользована)
loadDateRange(start, end, direction) {
        const grid = document.querySelector('.continuous-grid');
        if (!grid) return;
        
        // Запоминаем "старый" первый элемент, чтобы очистить ему стиль (если это prepend)
        const oldFirst = grid.firstElementChild;

        const daysCount = Math.round((end - start) / (24 * 60 * 60 * 1000));
        const fragment = document.createDocumentFragment();

        for (let i = 0; i <= daysCount; i++) {
            const current = new Date(start);
            current.setDate(start.getDate() + i);
            fragment.appendChild(this.createDayCell(current));
        }

        if (direction === 'append') {
            grid.appendChild(fragment);
            app.calendarBounds.end = new Date(end);
            if (!app.calendarBounds.start) app.calendarBounds.start = new Date(start);
        } else {
            grid.prepend(fragment);
            app.calendarBounds.start = new Date(start);
            
            // Если добавили в начало -> старый первый элемент стал "серединным".
            // Сбрасываем ему отступ, иначе будет дыра в календаре.
            if (oldFirst) {
                oldFirst.style.gridColumnStart = 'auto'; 
            }
        }
        
        // --- ФИКС СМЕЩЕНИЯ СЕТКИ ---
        // Берем САМЫЙ первый элемент, который сейчас есть в календаре
        const firstEl = grid.firstElementChild;
        if (firstEl) {
            // Узнаем его дату
            const d = new Date(firstEl.dataset.fullDate);
            // Узнаем день недели (0=Вс, 1=Пн...)
            const day = d.getDay();
            // Переводим в формат CSS Grid (1=Пн ... 7=Вс)
            // Если 0 (Вс) -> ставим 7. Иначе оставляем как есть.
            const col = day === 0 ? 7 : day;
            
            // Принудительно ставим его в нужную колонку
            firstEl.style.gridColumnStart = col;
        }

        this.refreshCalendarClasses();
    },

    handleCalendarScroll(e) {
        const container = document.getElementById('calendar-scroll-container');
        if (!container) return;

        // --- 1. ЛОГИКА ОБНОВЛЕНИЯ ЗАГОЛОВКА (Месяц/Год) ---
        const boxRect = container.getBoundingClientRect();
        // Ищем элемент по центру экрана
        const el = document.elementFromPoint(
            boxRect.left + boxRect.width / 2,
            boxRect.top + 80
        );

        if (el && el.dataset && el.dataset.monthInfo) {
            const info = JSON.parse(el.dataset.monthInfo);
            const mL = document.getElementById('cal-month');
            const yL = document.getElementById('cal-year');

            // Делаем первую букву заглавной
            const newM = info.fullM.charAt(0).toUpperCase() + info.fullM.slice(1);

            if (mL.innerText !== newM || yL.innerText !== info.y.toString()) {
                mL.innerText = newM;
                yL.innerText = info.y;
                this.refreshCalendarClasses(); // Подсвечиваем дни этого месяца
            }
        }

        // --- 2. ЛОГИКА БЕСКОНЕЧНОГО СКРОЛЛА ---
        if (app.isCalendarLoading) return;

        // === ВВЕРХ (ПРОШЛОЕ) ===
        if (container.scrollTop < 200) { // Порог 200px сверху
            app.isCalendarLoading = true;

            const oldHeight = container.scrollHeight;
            const oldTop = container.scrollTop;

            // Вычисляем даты ПРЕДЫДУЩЕГО месяца
            const currentStart = app.calendarBounds.start;
            // Берем 1 число месяца, идущего перед текущим стартом
            const newStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
            // Конец - это день перед текущим стартом
            const newEnd = new Date(currentStart);
            newEnd.setDate(newEnd.getDate() - 1);

            // Рендерим
            this.loadDateRange(newStart, newEnd, 'prepend');

            // КОРРЕКЦИЯ СКРОЛЛА (Самое важное!)
            // Новая высота - Старая высота = Высота добавленного контента
            const newHeight = container.scrollHeight;
            const diff = newHeight - oldHeight;

            // Сдвигаем скролл вниз на эту разницу, чтобы визуально остаться на месте
            container.scrollTop = oldTop + diff;

            // Небольшая задержка перед следующей загрузкой
            setTimeout(() => { app.isCalendarLoading = false; }, 100);
        }

        // === ВНИЗ (БУДУЩЕЕ) ===
        const distToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distToBottom < 200) {
            app.isCalendarLoading = true;

            const currentEnd = app.calendarBounds.end;
            // Начало - следующий день после текущего конца
            const newStart = new Date(currentEnd);
            newStart.setDate(newStart.getDate() + 1);
            // Конец - конец следующего месяца
            const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);

            this.loadDateRange(newStart, newEnd, 'append');

            setTimeout(() => { app.isCalendarLoading = false; }, 100);
        }
    },

    createDayCell(date) {
        const x = document.createElement('div');
        x.className = 'cal-day';
        x.innerText = date.getDate();
        x.dataset.fullDate = date.toISOString();

        // Сохраняем инфо для заголовка
        x.dataset.monthInfo = JSON.stringify({
            fullM: date.toLocaleString('ru-RU', { month: 'long' }),
            y: date.getFullYear(),
            mIdx: date.getFullYear() * 12 + date.getMonth()
        });

        // Классы для стилей
        if (date.getDate() === 1) x.classList.add('snap-point'); // Первое число месяца
        if (timeManager.isToday(date)) x.classList.add('is-today');

        const ts = app.tempStart ? new Date(app.tempStart).setHours(0, 0, 0, 0) : null;
        const te = app.tempEnd ? new Date(app.tempEnd).setHours(0, 0, 0, 0) : null;
        const ct = new Date(date).setHours(0, 0, 0, 0);

        if (ts && ct === ts) {
            if (!te || ts === te) x.classList.add('range-single');
            else x.classList.add('range-start');
        } else if (te && ct === te) {
            x.classList.add('range-end');
        } else if (ts && te && ct > ts && ct < te) {
            x.classList.add('in-range');
        }

        x.onclick = (ev) => {
            haptics.tap();
            ev.stopPropagation();
            const d = new Date(x.dataset.fullDate);
            if (!app.tempStart || app.selectingState === 'start' || (app.tempStart && app.tempEnd)) {
                app.tempStart = d; app.tempEnd = null; app.selectingState = 'end';
            } else {
                if (d < app.tempStart) { app.tempEnd = app.tempStart; app.tempStart = d; }
                else app.tempEnd = d;
            }
            this.refreshCalendarClasses();
            this.updateCalendarButton();
        };
        return x;
    },

refreshCalendarClasses() {
        const ts = app.tempStart ? new Date(app.tempStart).setHours(0,0,0,0) : null;
        const te = app.tempEnd ? new Date(app.tempEnd).setHours(0,0,0,0) : null;
        
        const mL = document.getElementById('cal-month').innerText.toLowerCase();
        const yL = parseInt(document.getElementById('cal-year').innerText);
        const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
        const activeIdx = yL * 12 + months.indexOf(mL);

        document.querySelectorAll('.continuous-grid .cal-day').forEach(dayEl => {
            const info = JSON.parse(dayEl.dataset.monthInfo);
            const dateObj = new Date(dayEl.dataset.fullDate);
            const dayDate = dateObj.setHours(0,0,0,0);
            const dayOfWeek = dateObj.getDay(); // 0 = Вс, 1 = Пн...
            
            dayEl.classList.remove(
                'range-start', 'range-end', 'range-single', 'in-range', 
                'is-visual-start', 'is-visual-end', 
                'muted'
            );

            // --- ОСНОВНАЯ ЛОГИКА ---

            if (ts && dayDate === ts) {
                // ЭТО СТАРТ
                if (!te || ts === te) {
                    dayEl.classList.add('range-single');
                } else {
                    dayEl.classList.add('range-start');
                    
                    // ФИКС: Если старт выпал на Воскресенье (0),
                    // он визуально должен быть и концом строки тоже.
                    if (dayOfWeek === 0) {
                        dayEl.classList.add('is-visual-end');
                    }
                }
            } 
            else if (te && dayDate === te) {
                // ЭТО КОНЕЦ
                dayEl.classList.add('range-end');
                
                // ФИКС: Если конец выпал на Понедельник (1),
                // он визуально должен быть и началом строки тоже.
                if (dayOfWeek === 1) {
                    dayEl.classList.add('is-visual-start');
                }
            } 
            else if (ts && te && dayDate > ts && dayDate < te) {
                // ЭТО ВНУТРИ
                dayEl.classList.add('in-range');

                // Логика для границ недели внутри диапазона
                if (dayOfWeek === 1) dayEl.classList.add('is-visual-start');
                if (dayOfWeek === 0) dayEl.classList.add('is-visual-end');
            }

            if (info.mIdx !== activeIdx) dayEl.classList.add('muted');
        });
    },

    scrollToTargetDate(targetDate) {
        const t = targetDate.setHours(0, 0, 0, 0);
        // Ищем элемент с этой датой
        const dayEl = Array.from(document.querySelectorAll('.continuous-grid .cal-day')).find(el => {
            return new Date(el.dataset.fullDate).setHours(0, 0, 0, 0) === t;
        });

        if (dayEl) {
            dayEl.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
    },

    updateCalendarButton() {
        const applyBtn = document.getElementById('calendar-apply-btn');
        const cancelBtn = document.getElementById('calendar-cancel-btn'); // Получаем вторую кнопку

        const opts = { day: 'numeric', month: 'long' };

        // 1. ЛОГИКА КНОПКИ "ПРИМЕНИТЬ" (Показываем выбранные даты)
        if (app.tempStart && app.tempEnd) {
            const s = new Date(app.tempStart);
            const e = new Date(app.tempEnd);

            // Проверяем, совпадают ли месяц и год
            if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
                // ЕСЛИ МЕСЯЦ ОДИН: "19 - 24 января"
                // s.getDate() даст "19"
                // e.toLocaleDateString даст "24 января"
                applyBtn.innerText = `Выбрано: ${s.getDate()}—${e.toLocaleDateString('ru-RU', opts)}`;
            } else {
                // РАЗНЫЕ МЕСЯЦЫ: "30 января - 4 февраля"
                const sStr = s.toLocaleDateString('ru-RU', opts);
                const eStr = e.toLocaleDateString('ru-RU', opts);
                applyBtn.innerText = `Выбрано: ${sStr}—${eStr}`;
            }
            applyBtn.classList.remove('disabled');

        } else if (app.tempStart) {
            // ОДНА ДАТА: "15 января"
            applyBtn.innerText = new Date(app.tempStart).toLocaleDateString('ru-RU', opts);
            applyBtn.classList.remove('disabled');
        } else {
            // ПУСТО
            applyBtn.innerText = 'Выберите дату или период';
            applyBtn.classList.add('disabled');
        }
        if (cancelBtn) {
            // Если начали выбирать (есть старт) — кнопка превращается в сброс
            cancelBtn.innerText = app.tempStart ? 'Сбросить' : 'Закрыть';
        }

    },

    applyCalendarDate() {
        if (!app.tempStart) return;
        const s = new Date(app.tempStart), e = app.tempEnd ? new Date(app.tempEnd) : new Date(app.tempStart);

        if (s.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0) && e.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0)) {
            ui.setHistoryFilter('today');
        } else if (s.getTime() === e.getTime()) {
            app.selectedDate = s;
            ui.setHistoryFilter('date');
        } else {
            app.rangeStart = s; app.rangeEnd = e;
            ui.setHistoryFilter('period');
        }
        this.toggleCalendarModal(false);
    }
};