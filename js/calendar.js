// js/calendar.js
import { timeManager } from './utils.js';

export const calendarMixin = {
    toggleCalendarModal(show) {
        if (show) {
            // Используем глобальные переменные app и ui, которые будут доступны после сборки
            app.tempStart = null; app.tempEnd = null; app.selectingState = 'start';
            app.calendarViewDate = app.rangeStart ? new Date(app.rangeStart) : new Date();
            document.getElementById('calendar-modal').classList.add('open');
            
            this.renderFullCalendar();
            this.updateCalendarButton();
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

        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - 35);
        const end = new Date(now); end.setDate(now.getDate() + 35);

        this.loadDateRange(start, end, 'append');
        this.setupInfiniteObserver();

        // Привязываем контекст (this) к обработчику
        scrollBox.onscroll = () => this.handleCalendarScroll();

        setTimeout(() => this.scrollToTargetDate(now), 50);
    },

    loadDateRange(start, end, direction) {
        const grid = document.querySelector('.continuous-grid');
        if (!grid) return;
        
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
        }
        this.refreshCalendarClasses();
    },

    createDayCell(date) {
        const x = document.createElement('div');
        x.className = 'cal-day';
        x.innerText = date.getDate();
        x.dataset.fullDate = date.toISOString();

        x.dataset.monthInfo = JSON.stringify({
            fullM: date.toLocaleString('ru-RU', { month: 'long' }),
            y: date.getFullYear(),
            mIdx: date.getFullYear() * 12 + date.getMonth()
        });

        if (date.getDate() === 1 || date.getDay() === 1) x.classList.add('snap-point');
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

    handleCalendarScroll() {
        const box = document.getElementById('calendar-scroll-container');
        const boxRect = box.getBoundingClientRect();
        
        const el = document.elementFromPoint(
            boxRect.left + boxRect.width / 2,
            boxRect.top + 80 
        );

        if (el && el.dataset && el.dataset.monthInfo) {
            const info = JSON.parse(el.dataset.monthInfo);
            const mL = document.getElementById('cal-month'), yL = document.getElementById('cal-year');
            const newM = info.fullM.charAt(0).toUpperCase() + info.fullM.slice(1);
            
            if (mL.innerText !== newM || yL.innerText !== info.y.toString()) {
                mL.innerText = newM; 
                yL.innerText = info.y;
                this.refreshCalendarClasses();
            }
        }
    },

    refreshCalendarClasses() {
        const ts = app.tempStart ? new Date(app.tempStart).setHours(0,0,0,0) : null;
        const te = app.tempEnd ? new Date(app.tempEnd).setHours(0,0,0,0) : null;
        
        const mL = document.getElementById('cal-month').innerText;
        const yL = parseInt(document.getElementById('cal-year').innerText);
        const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const activeIdx = yL * 12 + months.indexOf(mL);

        document.querySelectorAll('.continuous-grid .cal-day').forEach(dayEl => {
            const info = JSON.parse(dayEl.dataset.monthInfo);
            const dayDate = new Date(dayEl.dataset.fullDate).setHours(0,0,0,0);
            
            dayEl.classList.remove('range-start', 'range-end', 'range-single', 'in-range', 'muted');

            if (ts && dayDate === ts) {
                if (!te || ts === te) dayEl.classList.add('range-single');
                else dayEl.classList.add('range-start');
            } else if (te && dayDate === te) dayEl.classList.add('range-end');
            else if (ts && te && dayDate > ts && dayDate < te) dayEl.classList.add('in-range');

            if (info.mIdx !== activeIdx) dayEl.classList.add('muted');
        });
    },

    setupInfiniteObserver() {
        const scrollBox = document.getElementById('calendar-scroll-container');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const grid = document.querySelector('.continuous-grid');
                    if (entry.target === grid.firstElementChild) {
                        const newStart = new Date(app.calendarBounds.start);
                        newStart.setDate(newStart.getDate() - 15);
                        this.loadDateRange(newStart, new Date(app.calendarBounds.start.getTime() - 86400000), 'prepend');
                        observer.disconnect();
                        this.setupInfiniteObserver();
                    } else if (entry.target === grid.lastElementChild) {
                        const newStart = new Date(app.calendarBounds.end.getTime() + 86400000);
                        const newEnd = new Date(app.calendarBounds.end);
                        newEnd.setDate(newEnd.getDate() + 15);
                        this.loadDateRange(newStart, newEnd, 'append');
                        observer.disconnect();
                        this.setupInfiniteObserver();
                    }
                }
            });
        }, { root: scrollBox, threshold: 0, rootMargin: '100px' });

        const grid = document.querySelector('.continuous-grid');
        if (grid && grid.firstElementChild) observer.observe(grid.firstElementChild);
        if (grid && grid.lastElementChild) observer.observe(grid.lastElementChild);
    },

    scrollToTargetDate(targetDate) {
        const t = targetDate.setHours(0, 0, 0, 0);
        const days = document.querySelectorAll('.continuous-grid .cal-day:not(.empty)');
        for (let dayEl of days) {
            const d = new Date(dayEl.dataset.fullDate).setHours(0, 0, 0, 0);
            if (d === t) {
                dayEl.scrollIntoView({ block: 'center', behavior: 'auto' });
                break;
            }
        }
    },

    updateCalendarButton() {
        const btn = document.getElementById('calendar-apply-btn');
        if (app.tempStart && app.tempEnd) {
            btn.innerText = 'Выбрать период';
            btn.classList.remove('disabled');
        } else if (app.tempStart) {
            btn.innerText = 'Выбрать дату';
            btn.classList.remove('disabled');
        } else {
            btn.innerText = 'Выберите дату';
        }
    },

    applyCalendarDate() {
        if (!app.tempStart) return;
        const s = new Date(app.tempStart), e = app.tempEnd ? new Date(app.tempEnd) : new Date(app.tempStart);
        
        if (s.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0) && e.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0)) { 
            this.setHistoryFilter('today'); 
        } else {
            app.rangeStart = s; app.rangeEnd = e;
            this.setHistoryFilter('period');
        }
        this.toggleCalendarModal(false);
    }
};