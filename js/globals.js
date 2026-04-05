// ============================================
// ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЕН
// ============================================


// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С МОСКОВСКИМ ВРЕМЕНЕМ
// ============================================

// Получить текущую дату в московском времени
window.app.getMoscowDate = function(date = new Date()) {
    const mskDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    return mskDate;
};

// Получить строку даты в формате YYYY-MM-DD (московское время)
window.app.getMoscowDateString = function(date = new Date()) {
    const mskDate = window.app.getMoscowDate(date);
    return mskDate.toISOString().split('T')[0];
};

// Получить начало дня в московском времени
window.app.getMoscowStartOfDay = function(date = new Date()) {
    const mskDate = window.app.getMoscowDate(date);
    mskDate.setHours(0, 0, 0, 0);
    return mskDate;
};

// Получить начало недели (понедельник) в московском времени
window.app.getMoscowStartOfWeek = function(date = new Date()) {
    const mskDate = window.app.getMoscowDate(date);
    const day = mskDate.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    mskDate.setDate(mskDate.getDate() - diff);
    mskDate.setHours(0, 0, 0, 0);
    return mskDate;
};

window.app = window.app || {};

// Supabase клиент
window.app.sb = window.supabase.createClient(
    'https://wviocztioezobgfktdrz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8'
);

// DOM элементы
window.app.screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    dailyReport: document.getElementById('daily-report-screen'),
    profile: document.getElementById('profile-screen'),
    admin: document.getElementById('admin-screen')
};

// Переменные состояния
window.app.currentUser = null;
window.app.selectedSlotIds = new Set();
window.app.isLoggingIn = false;

// Вспомогательные функции
window.app.showScreen = function(name) {
    Object.keys(window.app.screens).forEach(key => {
        if (window.app.screens[key]) {
            window.app.screens[key].classList.remove('active');
        }
    });
    if (window.app.screens[name]) {
        window.app.screens[name].classList.add('active');
    }
};

window.app.cleanPhone = function(phone) {
    return phone.replace(/[^0-9]/g, '');
};
