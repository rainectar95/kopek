// js/statistics.js
import { timeManager, formatMoney, getGenitiveMonth } from './utils.js';

export const statistics = {
    // Вспомогательная функция суммы
    getSum: (records) => {
        return records.reduce((s, r) => s + r.price + (r.tip || 0), 0);
    },

    // Основная функция расчета заголовка
    calculateHeaderStats: (currentSum, mode, records, contextData) => {
        // contextData: { selectedDate, rangeStart, rangeEnd, now }
        
        const result = {
            text: '',
            icon: '',
            className: 'short-statistic muted' // Дефолтный класс
        };

        let prevSum = 0;
        let diff = 0;
        const now = contextData.now || new Date();

        // 1. РЕЖИМ: ОДИН ДЕНЬ (Сравниваем со вчерашним)
        if (mode === 'date' || mode === 'today') {
            const targetDate = mode === 'today' ? now : contextData.selectedDate;
            const prevDate = new Date(targetDate);
            prevDate.setDate(targetDate.getDate() - 1);

            prevSum = records.filter(r => 
                timeManager.getLocalKey(r.date) === timeManager.getLocalKey(prevDate)
            ).reduce((s, r) => s + r.price + (r.tip || 0), 0);

            diff = currentSum - prevSum;
            result.text = `${formatMoney(Math.abs(diff))} чем вчера`;
            
        // 2. РЕЖИМ: НЕДЕЛЯ (Сравниваем с прошлой неделей)
        } else if (mode === 'week') {
            const currentStart = new Date(); 
            currentStart.setDate(now.getDate() - 7);
            
            // "Прошлая" неделя это с -14 по -7 день от сегодня
            const prevStart = new Date(now); prevStart.setDate(now.getDate() - 14);
            const prevEnd = new Date(now); prevEnd.setDate(now.getDate() - 7);

            prevSum = records.filter(r => {
                const d = new Date(r.date);
                // Важно: сравниваем даты без времени для точности
                return d >= prevStart && d < prevEnd;
            }).reduce((s, r) => s + r.price + (r.tip || 0), 0);

            diff = currentSum - prevSum;
            result.text = `${formatMoney(Math.abs(diff))} чем прошлая`;

        // 3. РЕЖИМ: МЕСЯЦ (Сравниваем с прошлым месяцем)
        } else if (mode === 'month') {
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            
            prevSum = records.filter(r => {
                const d = new Date(r.date);
                return d.getMonth() === prevMonthDate.getMonth() && 
                       d.getFullYear() === prevMonthDate.getFullYear();
            }).reduce((s, r) => s + r.price + (r.tip || 0), 0);

            diff = currentSum - prevSum;
            // Используем helper для склонения месяца (январе, феврале...)
            const monthsPrep = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
            result.text = `${formatMoney(Math.abs(diff))} чем в ${monthsPrep[prevMonthDate.getMonth()]}`;

        // 4. РЕЖИМ: ПЕРИОД (Считаем среднее)
        } else if (mode === 'period') {
            const s = new Date(contextData.rangeStart);
            const e = new Date(contextData.rangeEnd);
            const oneDay = 24 * 60 * 60 * 1000;
            const daysCount = Math.round(Math.abs((e - s) / oneDay)) + 1;
            const avg = Math.round(currentSum / (daysCount || 1));

            result.text = `~ ${formatMoney(avg)} в день`;
            result.icon = 'money_bag'; // Специальная иконка
            return result; // Возвращаем сразу, так как тут логика отличается
        }

        // Общая логика присвоения иконок и цветов для сравнений
        if (currentSum === 0 && prevSum === 0) {
            result.text = (mode === 'today') ? "Пока без записей" : "Нет данных";
            result.className = 'short-statistic muted';
            result.icon = 'remove'; // Или скрыть
        } else {
            result.icon = diff >= 0 ? 'arrow_upward' : 'arrow_downward';
            result.className = diff >= 0 ? "short-statistic stat-up" : "short-statistic stat-down";
        }

        return result;
    }
};