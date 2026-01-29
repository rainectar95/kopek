import { storage } from './js/data.js';
import { timeManager, formatMoney, getGenitiveMonth } from './js/utils.js';
import { calendarMixin } from './js/calendar.js';

// --- ОСНОВНАЯ ЛОГИКА (STATE & LOGIC) ---
const app = {
    currentTab: 'home',
    todayFilter: 'all',
    serviceFilter: 'all',
    editingServiceId: null,
    historyMode: 'today',
    historyCategoryFilter: 'all',
    selectedDate: new Date(),
    editingRecordId: null,
    currentCategory: 'Мужская',
    settingsCategory: 'Мужская',
    calendarViewDate: new Date(),
    tempSelectedDate: new Date(),
    calendarBounds: { start: null, end: null },
    rangeStart: null, rangeEnd: null,
    tempStart: null, tempEnd: null,
    selectingState: 'start',
    pendingDeleteAction: null,

    toggleTheme: () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.innerText = isLight ? 'light_mode' : 'dark_mode';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    },

    setAccent: (colorVar, el) => {
        document.body.style.setProperty('--primary', colorVar);
        document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('active'));
        if (el) el.classList.add('active');
        localStorage.setItem('accentColor', colorVar);
    },

    handleCalendarCancel: () => {
        if (app.tempStart) ui.resetCalendarSelection(); // Нужно убедиться, что этот метод есть, или просто закрыть
        else ui.toggleCalendarModal(false);
    },

    init: () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            const icon = document.getElementById('theme-icon');
            if (icon) icon.innerText = 'light_mode';
        }
        const savedColor = localStorage.getItem('accentColor');
        if (savedColor) {
            document.body.style.setProperty('--primary', savedColor);
            setTimeout(() => {
                document.querySelectorAll('.color-dot').forEach(d => {
                    if (d.getAttribute('style').includes(savedColor)) d.classList.add('active');
                    else d.classList.remove('active');
                });
            }, 50);
        }
        if (storage.getServices().length === 0) {
            storage.saveServices([
                { id: 1, name: 'Модельная стрижка', price: 1500, category: 'Мужская' },
                { id: 2, name: 'Стрижка машинкой', price: 1000, category: 'Мужская' },
                { id: 3, name: 'Оформление бороды', price: 1200, category: 'Мужская' },
                { id: 4, name: 'Стрижка кончиков', price: 1500, category: 'Женская' },
                { id: 7, name: 'Детская стрижка', price: 1000, category: 'Детская' }
            ]);
        }
        document.getElementById('system-date-input').addEventListener('change', (e) => {
            if (e.target.value) {
                app.historyMode = 'date';
                app.selectedDate = new Date(e.target.value);
                ui.setHistoryFilter('date');
            }
        });
        const confirmBtn = document.getElementById('confirm-proceed-btn');
        if (confirmBtn) confirmBtn.addEventListener('click', () => {
            if (app.pendingDeleteAction) { app.pendingDeleteAction(); app.pendingDeleteAction = null; }
            ui.closeConfirmModal();
        });
        window.onclick = (event) => {
            if (event.target.id === 'add-modal') ui.toggleModal(false);
            if (event.target.id === 'service-modal') ui.toggleServiceModal(false);
            if (event.target.id === 'calendar-modal') ui.toggleCalendarModal(false);
            if (event.target.id === 'confirmation-modal') ui.closeConfirmModal();
        };

        const prevMonthDate = new Date();
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const monthName = prevMonthDate.toLocaleString('ru-RU', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const prevMonthBtn = document.getElementById('prev-month-btn-text');
        if (prevMonthBtn) prevMonthBtn.innerText = capitalizedMonth;

        ui.initScrollHandler();
        ui.updateHeader();
        ui.renderToday();
    },

    saveService: () => {
        const name = document.getElementById('new-service-name').value.trim();
        const price = document.getElementById('new-service-price').value;
        if (!name || !price) return;
        let services = storage.getServices();
        let records = storage.getRecords();
        if (app.editingServiceId) {
            const index = services.findIndex(s => s.id === app.editingServiceId);
            if (index !== -1) {
                const old = services[index];
                services[index].name = name;
                services[index].price = Number(price);
                services[index].category = app.settingsCategory;
                records = records.map(r => (r.service === old.name && r.category === old.category) ? { ...r, service: name, category: app.settingsCategory } : r);
                storage.saveRecords(records);
            }
        } else {
            services.push({ id: Date.now(), name, price: Number(price), category: app.settingsCategory });
        }
        storage.saveServices(services);
        ui.toggleServiceModal(false);
        ui.renderServices();
    },

    openEditServiceModal: (s) => {
        app.editingServiceId = s.id;
        ui.toggleServiceModal(true);
        document.getElementById('service-modal-title').innerText = 'Редактирование';
        document.getElementById('service-save-btn').innerText = 'Сохранить';
        document.getElementById('service-delete-btn').classList.remove('hidden');
        document.getElementById('service-cancel-btn').classList.add('hidden');
        document.getElementById('new-service-name').value = s.name;
        document.getElementById('new-service-price').value = s.price;
        document.querySelectorAll('#service-modal .cat-pill').forEach(p => { if (p.innerText.includes(s.category)) ui.selectSettingsCategory(p, s.category); });
    },

    deleteCurrentService: () => {
        if (!app.editingServiceId) return;
        ui.showConfirmDialog('Удалить услугу?', 'Это действие нельзя будет отменить.', () => {
            storage.saveServices(storage.getServices().filter(s => s.id !== app.editingServiceId));
            ui.toggleServiceModal(false);
            ui.renderServices();
        });
    },

    onServiceSelect: () => {
        const s = document.getElementById('service-select');
        if (s.selectedIndex !== -1) document.getElementById('final-price').value = s.options[s.selectedIndex].dataset.price;
    },

    saveRecord: () => {
        let client = document.getElementById('client-name').value.trim();
        const s = document.getElementById('service-select');
        const price = document.getElementById('final-price').value;
        const tip = document.getElementById('tip-amount').value || 0;
        if (!price) return alert('Заполните цену');
        if (!client) client = { 'Мужская': 'Клиент', 'Женская': 'Клиентка', 'Детская': 'Детская' }[app.currentCategory] || 'Клиент';
        let records = storage.getRecords();
        const rData = {
            id: app.editingRecordId || Date.now(),
            date: app.editingRecordId ? records.find(r => r.id === app.editingRecordId).date : new Date().toISOString(),
            category: app.currentCategory,
            client,
            service: s.options[s.selectedIndex]?.text || 'Услуга',
            price: Number(price),
            tip: Number(tip)
        };
        if (app.editingRecordId) records[records.findIndex(r => r.id === app.editingRecordId)] = rData;
        else records.push(rData);
        storage.saveRecords(records);
        ui.toggleModal(false);
        app.currentTab === 'home' ? ui.renderToday() : ui.renderHistory();
    },

    openEditModal: (r) => {
        app.editingRecordId = r.id;
        ui.toggleModal(true);
        document.getElementById('modal-title').innerText = 'Редактирование';
        document.getElementById('modal-save-btn').innerText = 'Сохранить';
        document.getElementById('modal-delete-btn').classList.remove('hidden');
        document.getElementById('modal-cancel-btn').classList.add('hidden');
        document.getElementById('client-name').value = r.client;
        document.getElementById('final-price').value = r.price;
        document.getElementById('tip-amount').value = r.tip || '';
        document.querySelectorAll('#add-modal .cat-pill').forEach(p => { if (p.innerText.includes(r.category)) ui.selectCategory(p, r.category); });
        setTimeout(() => {
            const s = document.getElementById('service-select');
            for (let i = 0; i < s.options.length; i++) if (s.options[i].text === r.service) { s.selectedIndex = i; break; }
        }, 50);
    },

    deleteCurrentRecord: () => {
        if (!app.editingRecordId) return;
        ui.showConfirmDialog('Удалить запись?', 'Запись будет удалена безвозвратно.', () => {
            storage.saveRecords(storage.getRecords().filter(r => r.id !== app.editingRecordId));
            ui.toggleModal(false);
            app.currentTab === 'home' ? ui.renderToday() : ui.renderHistory();
        });
    },

    handleFabClick: () => {
        if (app.currentTab === 'home') { app.editingRecordId = null; ui.toggleModal(true); }
        else if (app.currentTab === 'history') ui.toggleCalendarModal(true);
        else if (app.currentTab === 'settings') { app.editingServiceId = null; ui.toggleServiceModal(true); }
    }
};

// --- UI (RENDERING) ---
// Мы объединяем базовый UI и логику календаря
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
        const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const monthsPrep = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
        const monthsShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        const monthsGen = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабрь'];

        const now = new Date();
        const records = storage.getRecords();
        let displaySum = 0;

        // --- ОПРЕДЕЛЯЕМ СУММУ ---
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
        hStat.className = "short-statistic muted";
        statIcon.classList.remove('hidden');

        // ЛОГИКА "УСЛУГИ"
        if (app.currentTab === 'settings') {
            // Эмуляция размера базы данных
            statText.innerText = "База активна"; 
            statIcon.innerText = "database";
            hDate.innerText = `${now.getDate()} ${monthsGen[now.getMonth()]}`;
            hWeek.innerText = days[now.getDay()];
            return;
        }

        // ЛОГИКА "СЕГОДНЯ"
        if (app.currentTab === 'home' || (app.currentTab === 'history' && app.historyMode === 'today')) {
            hDate.innerText = `${now.getDate()} ${monthsGen[now.getMonth()]}`;
            hWeek.innerText = days[now.getDay()];

            const hour = now.getHours();
            const todayCount = records.filter(r => new Date(r.date).setHours(0, 0, 0, 0) === now.setHours(0, 0, 0, 0)).length;

            if (hour >= 8 && hour < 10 && todayCount === 0) {
                statText.innerText = "Удачного начала смены!";
                statIcon.innerText = "wb_sunny";
            } else if (hour >= 22) {
                statText.innerText = "Хорошо потрудились!";
                statIcon.innerText = "bedtime";
            } else {
                if (displaySum === 0) {
                    statText.innerText = "Пока без записей";
                    statIcon.classList.add('hidden');
                } else {
                    const yesterdaySameTime = new Date(now);
                    yesterdaySameTime.setDate(now.getDate() - 1);
                    const yestPartSum = records.filter(r => {
                        const d = new Date(r.date);
                        return d.getDate() === yesterdaySameTime.getDate() && d.getMonth() === yesterdaySameTime.getMonth() && d <= yesterdaySameTime;
                    }).reduce((s, r) => s + r.price + (r.tip || 0), 0);

                    const diff = displaySum - yestPartSum;
                    statText.innerText = `${formatMoney(Math.abs(diff))} чем вчера`;
                    statIcon.innerText = diff >= 0 ? 'arrow_upward' : 'arrow_downward';
                    hStat.className = diff >= 0 ? "short-statistic stat-up" : "short-statistic stat-down";
                }
            }
        }
        // ЛОГИКА "ИСТОРИЯ"
        else if (app.currentTab === 'history') {
            if (displaySum === 0) {
                 if (app.historyMode === 'date') {
                    hDate.innerText = `${app.selectedDate.getDate()} ${monthsGen[app.selectedDate.getMonth()]}`;
                    hWeek.innerText = days[app.selectedDate.getDay()];
                } else if (app.historyMode === 'week') {
                    const start = new Date(); start.setDate(now.getDate() - 7);
                    const dateOpt = { day: '2-digit', month: '2-digit' };
                    hDate.innerText = `${start.toLocaleDateString('ru-RU', dateOpt)} - ${now.toLocaleDateString('ru-RU', dateOpt)}`;
                    hWeek.innerText = "За неделю";
                } else if (app.historyMode === 'month') {
                    hDate.innerText = months[now.getMonth()];
                    hWeek.innerText = now.getFullYear();
                } else if (app.historyMode === 'period') {
                   const s = new Date(app.rangeStart); const e = new Date(app.rangeEnd);
                   const opts = { day: 'numeric', month: 'numeric' };
                   hDate.innerText = `${s.toLocaleDateString('ru-RU', opts)} - ${e.toLocaleDateString('ru-RU', opts)}`;
                   hWeek.innerText = "Период";
                }
                statText.innerText = "Нет записей";
                statIcon.classList.add('hidden');
                return;
            }

            if (app.historyMode === 'date') {
                const selDate = app.selectedDate;
                hDate.innerText = `${selDate.getDate()} ${monthsGen[selDate.getMonth()]}`;
                hWeek.innerText = days[selDate.getDay()];
                statText.innerText = "За выбранный день";
                statIcon.innerText = "event";
            } else if (app.historyMode === 'week') {
                const start = new Date(); start.setDate(now.getDate() - 7);
                const dateOpt = { day: '2-digit', month: '2-digit' };
                hDate.innerText = `${start.toLocaleDateString('ru-RU', dateOpt)} - ${now.toLocaleDateString('ru-RU', dateOpt)}`;
                hWeek.innerText = "За неделю";
                statText.innerText = "Последние 7 дней";
                statIcon.innerText = "date_range";
            } else if (app.historyMode === 'month') {
                hDate.innerText = months[now.getMonth()];
                hWeek.innerText = now.getFullYear();
                statText.innerText = "Текущий месяц";
                statIcon.innerText = "calendar_today";
            } else if (app.historyMode === 'period') {
                const s = new Date(app.rangeStart); const e = new Date(app.rangeEnd);
                const opts = { day: 'numeric', month: 'numeric' };
                hDate.innerText = `${s.toLocaleDateString('ru-RU', opts)} - ${e.toLocaleDateString('ru-RU', opts)}`;
                hWeek.innerText = "Период";
                
                const oneDay = 24 * 60 * 60 * 1000;
                const daysCount = Math.round(Math.abs((e - s) / oneDay)) + 1;
                const avg = Math.round(displaySum / (daysCount || 1));
                statText.innerText = `~ ${formatMoney(avg)} в день`;
                statIcon.innerText = "money_bag";
                hStat.className = "short-statistic muted";
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
        baseUi.togglePeriodModal(false);
        const cal = document.getElementById('calendar-wrapper');
        const resetBtn = document.getElementById('history-reset-btn');
        if (m === 'today') {
            resetBtn.classList.add('hidden');
            cal.classList.add('visible');
            app.selectedDate = new Date();
        } else {
            resetBtn.classList.remove('hidden');
            if (m === 'date') cal.classList.add('visible'); else cal.classList.remove('visible');
        }
        ui.renderHistory();
        ui.renderCalendarStrip();
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
            const hasTips = records.some(r => r.tip > 0);
            const categories = new Set(records.map(r => r.category));
            let chipsHtml = `<button class="filter-pill pill ${app.historyCategoryFilter === 'all' ? 'active' : ''}" onclick="ui.setHistoryCategoryFilter('all')">Все</button>`;
            if (hasTips) chipsHtml += `<button class="filter-pill pill ${app.historyCategoryFilter === 'tips' ? 'active' : ''}" onclick="ui.setHistoryCategoryFilter('tips')">Чаевые</button>`;
            categories.forEach(cat => { chipsHtml += `<button class="filter-pill pill ${app.historyCategoryFilter === cat ? 'active' : ''}" onclick="ui.setHistoryCategoryFilter('${cat}')">${cat}</button>`; });
            chipsContainer.innerHTML = chipsHtml;
        }

        let displayRecs = [...records];
        if (app.historyCategoryFilter === 'tips') displayRecs = displayRecs.filter(r => r.tip > 0);
        else if (app.historyCategoryFilter !== 'all') displayRecs = displayRecs.filter(r => r.category === app.historyCategoryFilter);

        const groups = {};
        let totalSum = 0;
        displayRecs.forEach(r => {
            totalSum += (app.historyCategoryFilter === 'tips' ? (r.tip || 0) : (r.price + (r.tip || 0)));
            const k = timeManager.getLocalKey(r.date);
            if (!groups[k]) groups[k] = [];
            groups[k].push(r);
        });

        let showH = true;
        if (['today', 'date'].includes(app.historyMode)) showH = false;
        if (app.historyMode === 'period') { if (new Date(app.rangeStart).setHours(0, 0, 0, 0) === new Date(app.rangeEnd).setHours(0, 0, 0, 0)) showH = false; }

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
        recs.forEach(r => { tot += (app.todayFilter === 'tips' ? (r.tip || 0) : r.price + (r.tip || 0)); l.appendChild(baseUi.createListItem(r, app.todayFilter === 'tips')); });
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
                    filtered.forEach(s => { const itemLi = baseUi.createServiceListItem(s); itemLi.onclick = () => app.openEditServiceModal(s); innerUl.appendChild(itemLi); });
                    blockLi.appendChild(innerUl); list.appendChild(blockLi);
                }
            });
        } else {
            const filtered = services.filter(s => s.category === app.serviceFilter);
            if (filtered.length > 0) {
                const blockLi = document.createElement('li'); blockLi.className = 'list-block';
                const innerUl = document.createElement('ul'); innerUl.className = 'inner-list';
                filtered.forEach(s => { const itemLi = baseUi.createServiceListItem(s); itemLi.onclick = () => app.openEditServiceModal(s); innerUl.appendChild(itemLi); });
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

// Объединяем базовый UI и логику календаря
const ui = { ...baseUi, ...calendarMixin };

// Делаем объекты глобальными, чтобы HTML-обработчики (onclick="...") работали
window.app = app;
window.ui = ui;
window.timeManager = timeManager;

// Запуск
app.init();