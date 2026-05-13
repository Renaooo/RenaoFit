// ============================================
// ГЛОБАЛЬНЫЙ МОДУЛЬ
// ============================================

// --- Инициализация Supabase ---
window.app = window.app || {};

const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

// Создаём клиент с увеличенным таймаутом (60 секунд)
window.app.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
        fetch: (url, options) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            return fetch(url, { ...options, signal: controller.signal })
                .finally(() => clearTimeout(timeoutId));
        }
    }
});

// --- DOM элементы экранов ---
window.app.screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    admin: document.getElementById('admin-screen')
};

// --- Глобальные переменные ---
window.app.currentUser = null;
window.app.selectedSlotIds = new Set();
window.app.isLoggingIn = false;

// --- Функция очистки телефона (8 и +7 равнозначны, приводим к 7XXXXXXXXXX) ---
window.app.cleanPhone = function(phone) {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.substring(1);
    }
    return cleaned;
};

// ============================================
// РАБОТА С ЧАСОВЫМИ ПОЯСАМИ (МСК ↔ UTC)
// ============================================

// Преобразование UTC в МСК (при отображении)
window.app.utcToMsk = function(utcDate) {
    const date = new Date(utcDate);
    date.setUTCHours(date.getUTCHours() + 3);
    return date;
};

// Преобразование МСК в UTC (при сохранении)
window.app.mskToUtc = function(mskDate) {
    const date = new Date(mskDate);
    date.setUTCHours(date.getUTCHours() - 3);
    return date;
};

// Получение текущей даты и времени в МСК
window.app.getNowMSK = function() {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 3);
    return now;
};

// ============================================
// РАСПИСАНИЕ СЛОТОВ (В МСК)
// ============================================
window.app.SCHEDULE = {
    1: { // ПН
        morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'],
        evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
    },
    2: { // ВТ
        morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'],
        evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
    },
    3: { // СР
        morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'],
        evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
    },
    4: { // ЧТ
        morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'],
        evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
    },
    5: { // ПТ
        morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'],
        evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
    },
    6: { // СБ
        morning: ['10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'],
        evening: []
    },
    0: { // ВС
        morning: [],
        evening: []
    }
};

// ============================================
// ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ (ЗАГЛУШКА, БУДЕТ ПЕРЕОПРЕДЕЛЕНА В MAIN.JS)
// ============================================
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
