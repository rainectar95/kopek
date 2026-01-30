import { app } from './js/app.js';
import { ui } from './js/ui.js';
import { timeManager } from './js/utils.js';

// Делаем объекты доступными для HTML-событий (onclick="app.saveRecord()")
window.app = app;
window.ui = ui;
window.timeManager = timeManager;

// Запуск приложения
app.init();