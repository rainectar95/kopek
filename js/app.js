// js/app.js
import { storage } from './data.js';
import { timeManager } from './utils.js';

export const app = {
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
    isCalendarLoading: false,
    searchQuery: '',

toggleTheme: () => {
        // 1. Просто переключаем класс (CSS сделает остальное)
        document.body.classList.toggle('light-theme');
        
        // 2. Проверяем, включился ли он
        const isLight = document.body.classList.contains('light-theme');
        
        // 3. Сохраняем выбор пользователя
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        // 4. Меняем иконку кнопки (если нужно)
        const icon = document.getElementById('theme-icon');
        if (icon) {
            // Если светлая - показываем луну (чтобы переключить на темную)
            // Если темная - показываем солнце
            icon.innerText = isLight ? 'dark_mode' : 'light_mode';
        }
        
        // 5. (Опционально) Красим "шапку" браузера в мобилках
        document.querySelector('meta[name="theme-color"]')
            .setAttribute('content', isLight ? '#f2f2f7' : '#141414');
    },

    setAccent: (colorVar, el) => {
        document.body.style.setProperty('--primary', colorVar);
        document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('active'));
        if (el) el.classList.add('active');
        localStorage.setItem('accentColor', colorVar);
    },

    handleCalendarCancel: () => {
        if (app.tempStart) ui.resetCalendarSelection();
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

        const isLight = document.body.classList.contains('light-theme');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.innerText = isLight ? 'dark_mode' : 'light_mode';

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
    },
    
    // Бэкапы
    exportData: () => {
        const data = {
            services: storage.getServices(),
            records: storage.getRecords(),
            settings: {
                theme: localStorage.getItem('theme'),
                accent: localStorage.getItem('accentColor')
            },
            version: '1.0'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0,10);
        a.download = `MasterLog_Backup_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    importData: (input) => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if(confirm('Это действие перезапишет все текущие данные. Продолжить?')) {
                    if(data.services) storage.saveServices(data.services);
                    if(data.records) storage.saveRecords(data.records);
                    if(data.settings) {
                        localStorage.setItem('theme', data.settings.theme);
                        if(data.settings.accent) localStorage.setItem('accentColor', data.settings.accent);
                    }
                    alert('Данные восстановлены! Обновите страницу.');
                    location.reload();
                }
            } catch (err) {
                alert('Ошибка файла');
            }
        };
        reader.readAsText(file);
    },
    
    // Поиск
    handleSearch: (query) => {
        app.searchQuery = query.toLowerCase();
        ui.renderHistory();
    },
};