// ============================================
// ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЕН
// ============================================

// --- Инициализация Supabase (через Cloudflare Worker прокси) ---
window.app = window.app || {};

// 🔴 ИЗМЕНЕНО: URL теперь указывает на Cloudflare Worker, а не напрямую на Supabase
const SUPABASE_URL = 'https://renao-fit.renao-russia.workers.dev';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

window.app.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// --- Функция переключения экранов (доступна везде) ---
window.app.switchScreen = function(screenName) {
    console.log('Переключение на экран:', screenName);
    const screens = ['auth', 'menu', 'booking', 'myBookings', 'dailyReport', 'profile', 'admin'];
    screens.forEach(name => {
        const el = document.getElementById(`${name}-screen`);
        if (el) {
            if (name === screenName) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    });
};

// --- Дублируем showScreen для совместимости ---
window.app.showScreen = window.app.switchScreen;

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

// --- Повторная инициализация экранов после загрузки DOM ---
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
