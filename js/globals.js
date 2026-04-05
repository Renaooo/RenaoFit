// ============================================
// ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЕН
// ============================================

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
