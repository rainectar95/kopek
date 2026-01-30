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

    // Словарь цветов (Monet HSL)
    themeColors: {
        yellow: '56, 50%',
        blue:   '201, 50%',
        purple: '279, 50%',
        chrome: '0, 0%',
        sun:    '33, 50%',
        lime:   '105, 50%'
    },

    toggleTheme: () => {
        // 1. Переключаем класс
        document.body.classList.toggle('light-theme');
        
        // 2. Проверяем состояние
        const isLight = document.body.classList.contains('light-theme');
        
        // 3. Сохраняем
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        // 4. Меняем иконку
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.innerText = isLight ? 'dark_mode' : 'light_mode';
        }
        
        // 5. Меняем цвет шторки браузера
        // Примечание: тут можно доработать, чтобы брался цвет темы, но пока оставим серый/черный
        document.querySelector('meta[name="theme-color"]')
            .setAttribute('content', isLight ? '#f2f2f7' : '#141414');
    },

    // Основная функция смены цвета (Monet)
    setThemeColor: (colorName) => {
        const hsValue = app.themeColors[colorName];
        if (!hsValue) return;

        // 1. Устанавливаем HSL переменную темы
        document.documentElement.style.setProperty('--theme-hs', hsValue);
        
        // 2. Сохраняем выбор
        localStorage.setItem('themeColorName', colorName);

        // 3. Обновляем активный класс на кружочках
        document.querySelectorAll('.color-dot').forEach(dot => {
            // Проверяем dataset.color, если он есть, иначе пытаемся угадать
            if (dot.dataset.color === colorName) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    },

    // Эта функция для вызова из HTML (onclick="app.setAccent(...)")
    // Мы перенаправляем её на новую логику
    setAccent: (colorName, el) => {
        // Если вдруг передали 'var(--...)', обрезаем или игнорируем, 
        // но лучше в HTML передавать просто 'yellow', 'blue' и т.д.
        app.setThemeColor(colorName);
    },

    handleCalendarCancel: () => {
        if (app.tempStart) ui.resetCalendarSelection();
        else ui.toggleCalendarModal(false);
    },

    init: () => {
        // 1. Восстановление Темы (Dark/Light)
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            const icon = document.getElementById('theme-icon');
            if (icon) icon.innerText = 'dark_mode'; // Для светлой темы иконка "Луна"
        }

        // 2. Восстановление Цвета (Monet)
        // Берем сохраненное имя или дефолт 'yellow'
        const savedColor = localStorage.getItem('themeColorName') || 'yellow';
        app.setThemeColor(savedColor);

        // 3. Инициализация услуг (если пусто)
        if (storage.getServices().length === 0) {
            storage.saveServices([
                { id: 1, name: 'Модельная стрижка', price: 1500, category: 'Мужская' },
                { id: 2, name: 'Стрижка машинкой', price: 1000, category: 'Мужская' },
                { id: 3, name: 'Оформление бороды', price: 1200, category: 'Мужская' },
                { id: 4, name: 'Стрижка кончиков', price: 1500, category: 'Женская' },
                { id: 7, name: 'Детская стрижка', price: 1000, category: 'Детская' }
            ]);
        }

        // 4. Слушатели событий
        const dateInput = document.getElementById('system-date-input');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                if (e.target.value) {
                    app.historyMode = 'date';
                    app.selectedDate = new Date(e.target.value);
                    ui.setHistoryFilter('date');
                }
            });
        }

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

        // Текст "Предыдущий месяц" в кнопке
        const prevMonthDate = new Date();
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const monthName = prevMonthDate.toLocaleString('ru-RU', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const prevMonthBtn = document.getElementById('prev-month-btn-text');
        if (prevMonthBtn) prevMonthBtn.innerText = capitalizedMonth;

        // Запуск UI
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
                accent: localStorage.getItem('themeColorName') // Сохраняем имя цвета
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
                        if(data.settings.accent) localStorage.setItem('themeColorName', data.settings.accent);
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
    }
};