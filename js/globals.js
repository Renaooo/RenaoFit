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
window.app.currentUser = null;
window.app.selectedSlotIds = new Set();
window.app.isLoggingIn = false;

// --- Очистка телефона ---
window.app.cleanPhone = function(phone) {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.substring(1);
    }
    return cleaned;
};

// --- Преобразование времени (МСК) ---
window.app.utcToMsk = function(utcDate) {
    const date = new Date(utcDate);
    date.setUTCHours(date.getUTCHours() + 3);
    return date;
};

window.app.mskToUtc = function(mskDate) {
    const date = new Date(mskDate);
    date.setUTCHours(date.getUTCHours() - 3);
    return date;
};

window.app.getNowMSK = function() {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 3);
    return now;
};

// --- Функция переключения экранов ---
window.app.showScreen = function(name) {
    console.log('Переключение на экран:', name);
    if (!window.app.screens || !window.app.screens[name]) {
        console.error('Экран не найден:', name);
        // Fallback: прямое управление классами
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`${name}-screen`);
        if (target) target.classList.add('active');
        return;
    }
    Object.keys(window.app.screens).forEach(key => {
        if (window.app.screens[key]) {
            window.app.screens[key].classList.remove('active');
        }
    });
    window.app.screens[name].classList.add('active');
};

// --- Повторная инициализация экранов после загрузки DOM (на случай, если скрипт загрузился раньше) ---
document.addEventListener('DOMContentLoaded', function() {
    if (!window.app.screens || Object.keys(window.app.screens).length === 0 || 
        Object.values(window.app.screens).some(el => !el)) {
        window.app.screens = {
            auth: document.getElementById('auth-screen'),
            menu: document.getElementById('menu-screen'),
            booking: document.getElementById('booking-screen'),
            myBookings: document.getElementById('my-bookings-screen'),
            dailyReport: document.getElementById('daily-report-screen'),
            profile: document.getElementById('profile-screen'),
            admin: document.getElementById('admin-screen')
        };
        console.log('Screens re-initialized on DOMContentLoaded');
    }
});
