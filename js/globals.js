// ============================================
// ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЕН
// ============================================

// --- Инициализация Supabase ---
window.app = window.app || {};

window.app.sb = window.supabase.createClient(
    'https://wviocztioezobgfktdrz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8'
);

// --- DOM элементы (экран) ---
window.app.screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    dailyReport: document.getElementById('daily-report-screen'),
    profile: document.getElementById('profile-screen'),
    admin: document.getElementById('admin-screen')
};

// --- Глобальные переменные состояния ---
window.app.currentUser = null;           // Текущий пользователь
window.app.selectedSlotIds = new Set();   // Выбранные слоты для записи
window.app.isLoggingIn = false;           // Флаг входа

// --- Вспомогательные функции ---

// Очистка телефона (приводим к единому формату)
window.app.cleanPhone = function(phone) {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.substring(1);
    }
    return cleaned;
};

// --- Преобразование времени (единый часовой пояс МСК) ---
// В БД время хранится в UTC. При отображении прибавляем 3 часа.
window.app.utcToMsk = function(utcDate) {
    const date = new Date(utcDate);
    date.setUTCHours(date.getUTCHours() + 3);
    return date;
};

// При сохранении в БД вычитаем 3 часа из МСК
window.app.mskToUtc = function(mskDate) {
    const date = new Date(mskDate);
    date.setUTCHours(date.getUTCHours() - 3);
    return date;
};

// Текущая дата и время в МСК
window.app.getNowMSK = function() {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 3);
    return now;
};

// --- Функция переключения экранов (будет переопределена в main.js, но заглушка) ---
window.app.showScreen = function(name) {
    console.log('Переключение на экран:', name);
    if (window.app.screens && window.app.screens[name]) {
        Object.keys(window.app.screens).forEach(key => {
            if (window.app.screens[key]) {
                window.app.screens[key].classList.remove('active');
            }
        });
        window.app.screens[name].classList.add('active');
    }
};
