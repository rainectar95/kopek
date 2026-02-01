// js/ui.js
import { storage } from './data.js';
import { timeManager, formatMoney } from './utils.js';
import { calendarMixin } from './calendar.js';
import { statistics } from './statistics.js';

// Базовая логика интерфейса
const baseUi = {
    getSumForPeriod: (startOff, endOff = 0) => {
        const records = storage.getRecords();
        const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - startOff);
        const e = new Date(); e.setHours(23, 59, 59, 999); e.setDate(e.getDate() - endOff);
        const isTips = (app.currentTab === 'home' && app.todayFilter === 'tips');
        return records.filter(r => { const rd = new Date(r.date); return rd >= s && rd <= e; }).reduce((sum, r) => sum + (isTips ? (r.tip || 0) : (r.price + (r.tip || 0))), 0);
    },

    updateHeader: (totalSum = null) => {
        const hDate = document.getElementById('header-date');
        const hWeek = document.getElementById('header-week-day');
        const hTotal = document.getElementById('header-total');
        const hStat = document.getElementById('header-stat');
        const statText = document.getElementById('stat-text');
        const statIcon = document.getElementById('stat-icon');

        const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const monthsGen = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабрь'];
        const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

        const now = new Date();
        const records = storage.getRecords();
        let displaySum = 0;

        // 1. Считаем сумму
        if (app.currentTab === 'home' || app.currentTab === 'settings' || (app.currentTab === 'history' && app.historyMode === 'today')) {
            displaySum = baseUi.getSumForPeriod(0);
        } else if (app.historyMode === 'week') {
            displaySum = baseUi.getSumForPeriod(7);
        } else if (app.historyMode === 'month') {
            displaySum = records.filter(r => new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear())
                .reduce((s, r) => s + r.price + (r.tip || 0), 0);
        } else if (app.historyMode === 'month-prev') {
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            displaySum = records.filter(r => {
                const d = new Date(r.date);
                return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear();
            }).reduce((s, r) => s + r.price + (r.tip || 0), 0);
        } else if (app.historyMode === 'period' || app.historyMode === 'date') {
            displaySum = totalSum !== null ? totalSum : 0;
        }

        hTotal.innerText = formatMoney(displaySum);
        hStat.classList.remove('hidden');
        statIcon.classList.remove('hidden');

        // ЛОГИКА "УСЛУГИ / НАСТРОЙКИ"
        if (app.currentTab === 'settings') {
            // 1. Считаем реальный вес всех данных в localStorage
            let totalBytes = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    // (Длина ключа + длина значения) * 2 байта (так как JS использует UTF-16)
                    totalBytes += (localStorage[key].length + key.length) * 2;
                }
            }

            // 2. Конвертируем в Кб
            const usedKB = (totalBytes / 1024).toFixed(2);
            const limitMB = 5; // Стандартный лимит для PWA

            // 3. Выводим текст
            statText.innerText = `${usedKB} Кб из ${limitMB} Мб`;
            statIcon.innerText = "database"; // Или "sd_card", "database"

            // Делаем текст ярким
            hStat.className = "short-statistic";

            hDate.innerText = `${now.getDate()} ${monthsGen[now.getMonth()]}`;
            hWeek.innerText = days[now.getDay()];
            return;
        }

        // 2. Считаем статистику (через модуль statistics)
        let statsMode = app.historyMode;
        if (app.currentTab === 'home') statsMode = 'today';

        const contextData = { selectedDate: app.selectedDate, rangeStart: app.rangeStart, rangeEnd: app.rangeEnd, now: now };
        const stats = statistics.calculateHeaderStats(displaySum, statsMode, records, contextData);

        statText.innerText = stats.text;
        statIcon.innerText = stats.icon;
        hStat.className = stats.className;
        if (stats.icon === 'remove') statIcon.classList.add('hidden');

        // 3. Обновляем заголовки дат
        if (app.currentTab === 'home' || statsMode === 'today') {
            hDate.innerText = `${now.getDate()} ${monthsGen[now.getMonth()]}`;
            hWeek.innerText = days[now.getDay()];

            const hour = now.getHours();
            const todayCount = records.filter(r => timeManager.isToday(r.date)).length;
            if (hour >= 8 && hour < 10 && todayCount === 0) {
                statText.innerText = "Удачного начала смены!"; statIcon.innerText = "wb_sunny"; hStat.className = "short-statistic muted";
            } else if (hour >= 22) {
                statText.innerText = "Хорошо потрудились!"; statIcon.innerText = "bedtime"; hStat.className = "short-statistic muted";
            }
        } else if (app.currentTab === 'history') {
            if (statsMode === 'date') {
                const selDate = app.selectedDate;
                hDate.innerText = `${selDate.getDate()} ${monthsGen[selDate.getMonth()]}`;
                hWeek.innerText = days[selDate.getDay()];
            }
            else if (statsMode === 'week') {
                const start = new Date(); start.setDate(now.getDate() - 7);
                const dateOpt = { day: '2-digit', month: '2-digit' };
                hDate.innerText = `${start.toLocaleDateString('ru-RU', dateOpt)} - ${now.toLocaleDateString('ru-RU', dateOpt)}`;
                hWeek.innerText = "За неделю";
            }
            else if (statsMode === 'month') {
                hDate.innerText = months[now.getMonth()];
                hWeek.innerText = now.getFullYear();
            }
            else if (statsMode === 'month-prev') {
                const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                hDate.innerText = months[prevDate.getMonth()];
                hWeek.innerText = prevDate.getFullYear();
            }
            else if (statsMode === 'period') {
                const s = new Date(app.rangeStart); const e = new Date(app.rangeEnd);
                const opts = { day: 'numeric', month: 'numeric' };
                hDate.innerText = `${s.toLocaleDateString('ru-RU', opts)} - ${e.toLocaleDateString('ru-RU', opts)}`;
                hWeek.innerText = "Период";
            }
        }
    },

    togglePeriodModal: (show) => {
        const p = document.getElementById('period-popover');
        const b = document.getElementById('period-popover-backdrop');
        if (show) {
            p.classList.remove('hidden'); b.classList.remove('hidden');
            requestAnimationFrame(() => { p.classList.add('visible'); b.classList.add('visible'); });
        } else {
            p.classList.remove('visible'); b.classList.remove('visible');
            setTimeout(() => { p.classList.add('hidden'); b.classList.add('hidden'); }, 300);
        }
    },

    setHistoryFilter: (m) => {
        app.historyMode = m;
        app.historyCategoryFilter = 'all';
        ui.togglePeriodModal(false);
        const cal = document.getElementById('calendar-wrapper');
        const resetBtn = document.getElementById('history-reset-btn');
        if (m === 'today') {
            resetBtn.classList.add('hidden'); cal.classList.add('visible'); app.selectedDate = new Date();
        } else {
            resetBtn.classList.remove('hidden');
            if (m === 'date') cal.classList.add('visible'); else cal.classList.remove('visible');
        }
        ui.renderHistory(); ui.renderCalendarStrip();
    },

    renderHistory: () => {
        const list = document.getElementById('history-list'); list.innerHTML = '';
        let records = storage.getRecords();
        const now = new Date();

        if (app.historyMode === 'today') records = records.filter(r => timeManager.isToday(r.date));
        else if (app.historyMode === 'week') {
            const w = new Date(); w.setDate(now.getDate() - 7); w.setHours(0, 0, 0, 0);
            records = records.filter(r => new Date(r.date) >= w);
        } else if (app.historyMode === 'month') {
            records = records.filter(r => { const d = new Date(r.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
        } else if (app.historyMode === 'month-prev') {
            const prev = new Date(); prev.setMonth(now.getMonth() - 1);
            records = records.filter(r => { const d = new Date(r.date); return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear(); });
        } else if (app.historyMode === 'period') {
            records = records.filter(r => timeManager.isInRange(r.date, app.rangeStart, app.rangeEnd));
        } else if (app.historyMode === 'date') {
            records = records.filter(r => timeManager.isInRange(r.date, app.selectedDate, app.selectedDate));
        }

        if (records.length === 0) {
            document.getElementById('history-chips').innerHTML = '';
            list.innerHTML = `<div class="empty-block"><img class="illustation" src="./img/calendar.svg"><div class="empty-message-block"><div class="empty-title">Записей нет</div><div class="empty-subtitle">За этот период пусто</div></div></div>`;
            ui.updateHeader(0); return;
        }

        const chipsContainer = document.getElementById('history-chips');
        if (records.length === 1) {
            chipsContainer.innerHTML = ''; app.historyCategoryFilter = 'all';
        } else {
            const categories = new Set(records.map(r => r.category));
            let chipsHtml = `<button class="filter-pill pill ${app.historyCategoryFilter === 'all' ? 'active' : ''}" onclick="ui.setHistoryCategoryFilter('all')">Все</button>`;
            if (records.some(r => r.tip > 0)) chipsHtml += `<button class="filter-pill pill ${app.historyCategoryFilter === 'tips' ? 'active' : ''}" onclick="ui.setHistoryCategoryFilter('tips')">Чаевые</button>`;
            categories.forEach(cat => { chipsHtml += `<button class="filter-pill pill ${app.historyCategoryFilter === cat ? 'active' : ''}" onclick="ui.setHistoryCategoryFilter('${cat}')">${cat}</button>`; });
            chipsContainer.innerHTML = chipsHtml;
        }

        let displayRecs = [...records];
        if (app.historyCategoryFilter === 'tips') displayRecs = displayRecs.filter(r => r.tip > 0);
        else if (app.historyCategoryFilter !== 'all') displayRecs = displayRecs.filter(r => r.category === app.historyCategoryFilter);

        const groups = {}; let totalSum = 0;
        displayRecs.forEach(r => {
            totalSum += (app.historyCategoryFilter === 'tips' ? (r.tip || 0) : (r.price + (r.tip || 0)));
            const k = timeManager.getLocalKey(r.date);
            if (!groups[k]) groups[k] = []; groups[k].push(r);
        });

        let showH = true;
        if (['today', 'date'].includes(app.historyMode)) showH = false;
        if (app.historyMode === 'period' && new Date(app.rangeStart).setHours(0, 0, 0, 0) === new Date(app.rangeEnd).setHours(0, 0, 0, 0)) showH = false;

        Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(k => {
            if (showH) {
                const daySum = groups[k].reduce((s, r) => s + r.price + (r.tip || 0), 0);
                const headerLi = document.createElement('li');
                headerLi.innerHTML = `<div class="group-header"><span class="date-label">${new Date(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span><span class="day-total">${formatMoney(daySum)}</span></div>`;
                list.appendChild(headerLi);
                const blockLi = document.createElement('li'); blockLi.className = 'list-block';
                const innerUl = document.createElement('ul'); innerUl.className = 'inner-list';
                groups[k].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(r => { innerUl.appendChild(ui.createListItem(r, app.historyCategoryFilter === 'tips')); });
                blockLi.appendChild(innerUl); list.appendChild(blockLi);
            } else {
                groups[k].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(r => { list.appendChild(ui.createListItem(r, app.historyCategoryFilter === 'tips')); });
            }
        });
        ui.updateHeader(totalSum);
    },

    setHistoryCategoryFilter: (cat) => { app.historyCategoryFilter = cat; ui.renderHistory(); },

    showConfirmDialog: (title, text, cb) => {
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-text').innerText = text;
        app.pendingDeleteAction = cb;
        document.getElementById('confirmation-modal').classList.add('open');
    },
    closeConfirmModal: () => { document.getElementById('confirmation-modal').classList.remove('open'); app.pendingDeleteAction = null; },

    toggleModal: (show) => {
        const m = document.getElementById('add-modal');
        if (show) {
            haptics.openModal();
            m.classList.add('open');
            if (!app.editingRecordId) {
                document.getElementById('modal-title').innerText = 'Новая запись'; document.getElementById('modal-save-btn').innerText = 'Создать';
                document.getElementById('modal-delete-btn').classList.add('hidden'); document.getElementById('modal-cancel-btn').classList.remove('hidden');
                document.getElementById('client-name').value = ''; document.getElementById('final-price').value = ''; document.getElementById('tip-amount').value = '';
                ui.selectCategory(document.querySelector('#add-modal .cat-pill'), 'Мужская');
            }
        } else m.classList.remove('open');
    },
    toggleServiceModal: (show) => {
        const m = document.getElementById('service-modal');
        if (show) {
            haptics.openModal();
            m.classList.add('open');
            if (!app.editingServiceId) {
                document.getElementById('service-modal-title').innerText = 'Новая услуга'; document.getElementById('service-save-btn').innerText = 'Создать';
                document.getElementById('service-delete-btn').classList.add('hidden'); document.getElementById('service-cancel-btn').classList.remove('hidden');
                document.getElementById('new-service-name').value = ''; document.getElementById('new-service-price').value = '';
                ui.selectSettingsCategory(document.querySelector('#service-modal .cat-pill'), 'Мужская');
            }
        } else { m.classList.remove('open'); app.editingServiceId = null; }
    },

    resetCalendarSelection: () => {
        app.tempStart = null; app.tempEnd = null; app.selectingState = 'start';
        ui.refreshCalendarClasses(); ui.updateCalendarButton();
    },

    renderToday: () => {
        const l = document.getElementById('today-list'); l.innerHTML = '';
        const all = storage.getRecords().filter(r => timeManager.isToday(r.date)); const fr = document.querySelector('#view-home .filters-row');
        if (all.length === 0) fr.classList.add('hidden'); else fr.classList.remove('hidden');
        let recs = [...all].reverse();
        if (app.todayFilter === 'tips') recs = recs.filter(r => r.tip > 0);
        let tot = 0;
        recs.forEach(r => { tot += (app.todayFilter === 'tips' ? (r.tip || 0) : r.price + (r.tip || 0)); l.appendChild(ui.createListItem(r, app.todayFilter === 'tips')); });
        if (recs.length === 0) l.innerHTML = `<div class="empty-block"><img class="illustation" src="./img/empty.svg"><div class="empty-message-block"><div class="empty-title">Пусто</div><div class="empty-subtitle">Создайте первую запись</div></div></div>`;
        ui.updateHeader(tot);
    },

    renderServices: () => {
        const list = document.getElementById('services-list'); list.innerHTML = '';
        const services = storage.getServices();
        const cats = ['Мужская', 'Женская', 'Детская'];
        if (app.serviceFilter === 'all') {
            cats.forEach(cat => {
                const filtered = services.filter(s => s.category === cat);
                if (filtered.length > 0) {
                    const headerLi = document.createElement('li'); headerLi.innerHTML = `<div class="group-header"><span class="cat-label">${cat}</span><span class="cat-count">${filtered.length}</span></div>`; list.appendChild(headerLi);
                    const blockLi = document.createElement('li'); blockLi.className = 'list-block';
                    const innerUl = document.createElement('ul'); innerUl.className = 'inner-list';
                    filtered.forEach(s => { const itemLi = ui.createServiceListItem(s); itemLi.onclick = () => app.openEditServiceModal(s); innerUl.appendChild(itemLi); });
                    blockLi.appendChild(innerUl); list.appendChild(blockLi);
                }
            });
        } else {
            const filtered = services.filter(s => s.category === app.serviceFilter);
            if (filtered.length > 0) {
                const blockLi = document.createElement('li'); blockLi.className = 'list-block';
                const innerUl = document.createElement('ul'); innerUl.className = 'inner-list';
                filtered.forEach(s => { const itemLi = ui.createServiceListItem(s); itemLi.onclick = () => app.openEditServiceModal(s); innerUl.appendChild(itemLi); });
                blockLi.appendChild(innerUl); list.appendChild(blockLi);
            }
        }
    },

    createListItem: (r, tipMode) => {
        const t = new Date(r.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const img = { 'Мужская': './img/man.svg', 'Женская': './img/woman.svg', 'Детская': './img/child.svg' }[r.category] || './img/man.svg';
        const p = tipMode ? (r.tip || 0) : r.price;
        const li = document.createElement('li'); li.className = 'list-item'; li.onclick = () => app.openEditModal(r);
        li.innerHTML = `<div class="item-left"><div class="avatar"><img src="${img}" class="avatar-img"></div><div class="info-col"><div class="client-name">${r.client}</div><div class="service-row"><div class="service-name">${r.service}</div><span class="dot">·</span><span class="time-badge">${t}</span></div></div></div><div class="price-col"><div class="price-main" ${tipMode ? 'style="color:var(--grow)"' : ''}>${formatMoney(p)}</div>${(!tipMode && r.tip > 0) ? `<div class="price-tip">${r.tip} ₽</div>` : ''}</div>`;
        return li;
    },

    createServiceListItem: (s) => {
        const img = { 'Мужская': './img/man.svg', 'Женская': './img/woman.svg', 'Детская': './img/child.svg' }[s.category] || './img/man.svg';
        const li = document.createElement('li'); li.className = 'list-item';
        li.innerHTML = `<div class="item-left"><div class="avatar"><img src="${img}" class="avatar-img"></div><div class="info-col"><div class="name-row">${s.name}</div><div class="service-name">${formatMoney(s.price)}</div></div></div>`;
        return li;
    },

    renderCalendarStrip: () => {
        const c = document.getElementById('calendar-strip'); c.innerHTML = '';
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], today = new Date();
        for (let i = 0; i <= 90; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const sel = (app.historyMode === 'date' && d.toDateString() === app.selectedDate.toDateString()) || (app.historyMode === 'today' && d.toDateString() === today.toDateString());
            const el = document.createElement('div'); el.className = `day-item ${sel ? 'selected' : ''}`; el.id = `day-${d.getTime()}`;
            el.innerHTML = `<span class="week-day">${days[d.getDay()]}</span><span class="day-num">${d.getDate()}</span>`;
            el.onclick = () => { if (d.toDateString() === today.toDateString()) ui.setHistoryFilter('today'); else { app.historyMode = 'date'; app.selectedDate = d; ui.setHistoryFilter('date'); } };
            c.appendChild(el);
        }
        setTimeout(() => { if (app.historyMode === 'today') c.scrollLeft = 0; else { const el = document.getElementById(`day-${app.selectedDate.getTime()}`); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); } }, 10);
    },

    initScrollHandler: () => {
        const s = document.querySelector('.content-sheet'), f = document.getElementById('main-fab'), n = document.querySelector('nav'), rows = document.querySelectorAll('.filters-row');
        let lst = 0; if (!s) return;
        s.addEventListener('scroll', () => {
            const st = s.scrollTop;
            rows.forEach(r => st > 0 ? r.classList.add('scrolled') : r.classList.remove('scrolled'));
            if (st > lst && st > 50) { f.classList.add('collapsed'); n.classList.add('nav-hidden'); document.body.classList.add('nav-hidden-mode'); }
            else if (st < lst) { f.classList.remove('collapsed'); n.classList.remove('nav-hidden'); document.body.classList.remove('nav-hidden-mode'); }
            lst = st;
        });
    },

    selectCategory: (el, c) => { document.querySelectorAll('#add-modal .cat-pill').forEach(p => p.classList.remove('active')); el.classList.add('active'); app.currentCategory = c; ui.populateServiceSelect(); },
    selectSettingsCategory: (el, c) => { document.querySelectorAll('#service-modal .cat-pill').forEach(p => p.classList.remove('active')); el.classList.add('active'); app.settingsCategory = c; },
    populateServiceSelect: () => {
        const s = document.getElementById('service-select'), servs = storage.getServices().filter(i => i.category === app.currentCategory);
        if (servs.length) { s.innerHTML = servs.map(i => `<option value="${i.id}" data-price="${i.price}">${i.name}</option>`).join(''); app.onServiceSelect(); }
        else { s.innerHTML = '<option>Нет услуг</option>'; document.getElementById('final-price').value = ''; }
    },
    setTodayFilter: (f) => { app.todayFilter = f; document.querySelectorAll('.filter-today').forEach((b, i) => b.classList.toggle('active', (f === 'all' && i === 0) || (f === 'tips' && i === 1))); ui.renderToday(); },
    setServiceFilter: (c) => { app.serviceFilter = c; document.querySelectorAll('.filter-service').forEach(b => b.classList.toggle('active', b.innerText === c || (c === 'all' && b.innerText === 'Все'))); ui.renderServices(); },
    resetDateFilter: () => ui.setHistoryFilter('today'),
    switchTab: (t) => {
        app.currentTab = t;
        ['view-home', 'view-history', 'view-settings'].forEach(id => document.getElementById(id).classList.add('hidden'));
        document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.id === 'nav-' + t));
        const f = document.getElementById('main-fab'), fi = document.getElementById('fab-icon'), ft = document.getElementById('fab-text');
        const cal = document.getElementById('calendar-wrapper'), set = document.getElementById('settings-wrapper');
        f.classList.remove('collapsed'); document.querySelector('nav').classList.remove('nav-hidden'); document.body.classList.remove('nav-hidden-mode');
        if (t === 'home') {
            document.getElementById('view-home').classList.remove('hidden'); cal.classList.remove('visible'); if (set) set.classList.remove('visible');
            fi.innerText = 'draw'; ft.innerText = 'Добавить запись'; ui.renderToday();
        } else if (t === 'history') {
            document.getElementById('view-history').classList.remove('hidden');
            if (app.historyMode === 'today' || app.historyMode === 'date') cal.classList.add('visible'); else cal.classList.remove('visible');
            if (set) set.classList.remove('visible');
            fi.innerText = 'calendar_month'; ft.innerText = 'Выбрать дату';
            ui.renderCalendarStrip(); ui.renderHistory();
        } else {
            document.getElementById('view-settings').classList.remove('hidden'); cal.classList.remove('visible'); if (set) set.classList.add('visible');
            fi.innerText = 'note_stack_add'; ft.innerText = 'Добавить услугу'; ui.renderServices(); ui.updateHeader();
        }
    }
};

// Экспортируем объединенный UI
export const ui = { ...baseUi, ...calendarMixin };