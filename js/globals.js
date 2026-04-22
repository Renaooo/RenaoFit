// ============================================
// ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЕН
// ============================================

// --- Инициализация Supabase ---
window.app = window.app || {};

window.app.sb = window.supabase.createClient(
    'https://wviocztioezobgfktdrz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8'
);

// --- Глобальные переменные состояния ---
window.app.currentUser = null;
window.app.selectedSlotIds = new Set();
window.app.isLoggingIn = false;

// --- Функция инициализации экранов (вызывается при загрузке и после DOM) ---
function initScreens() {
    window.app.screens = {
        auth: document.getElementById('auth-screen'),
        menu: document.getElementById('menu-screen'),
        booking: document.getElementById('booking-screen'),
        myBookings: document.getElementById('my-bookings-screen'),
        dailyReport: document.getElementById('daily-report-screen'),
        profile: document.getElementById('profile-screen'),
        admin: document.getElementById('admin-screen')
    };
    console.log('Screens initialized:', window.app.screens);
}

// --- Функция переключения экранов (работает напрямую с DOM) ---
window.app.switchScreen = function(screenName) {
    console.log('Переключение на экран:', screenName);
    
    // Маппинг названий экранов на ID в DOM
    const screenIdMap = {
        'auth': 'auth-screen',
        'menu': 'menu-screen',
        'booking': 'booking-screen',
        'myBookings': 'my-bookings-screen',
        'dailyReport': 'daily-report-screen',
        'profile': 'profile-screen',
        'admin': 'admin-screen'
    };
    
    const targetId = screenIdMap[screenName];
    if (!targetId) {
        console.error('Неизвестный экран:', screenName);
        return;
    }
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // Показываем нужный
    const targetScreen = document.getElementById(targetId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`Экран ${screenName} (${targetId}) показан`);
    } else {
        console.error(`Экран с id ${targetId} не найден`);
    }
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

// --- Инициализация при загрузке скрипта (если DOM уже готов) ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScreens);
} else {
    initScreens();
}
