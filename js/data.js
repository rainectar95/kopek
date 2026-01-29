// js/data.js

export const storage = {
    getServices: () => {
        const data = JSON.parse(localStorage.getItem('services')) || [];
        return data.map(s => ({ ...s, category: s.category || 'Мужская' }));
    },
    saveServices: (data) => localStorage.setItem('services', JSON.stringify(data)),
    
    getRecords: () => JSON.parse(localStorage.getItem('records')) || [],
    saveRecords: (data) => localStorage.setItem('records', JSON.stringify(data)),
};