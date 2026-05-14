// ============================================
// ГЛОБАЛЬНЫЙ МОДУЛЬ
// ============================================

window.app = window.app || {};

// --- Supabase ---
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

window.app.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Переменные состояния ---
window.app.currentUser = null;
window.app.selectedSlotIds = new Set();

// --- Функция очистки телефона (8 и +7 → 7XXXXXXXXXX) ---
window.app.cleanPhone = function(phone) {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('8')) cleaned = '7' + cleaned.substring(1);
    return cleaned;
};

// ============================================
// ЧАСОВОЙ ПОЯС (МСК ↔ UTC)
// ============================================
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

// ============================================
// РАСПИСАНИЕ СЛОТОВ (В МСК)
// ============================================
window.app.SCHEDULE = {
    1: { morning: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
         evening: ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'] },
    2: { morning: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
         evening: ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'] },
    3: { morning: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
         evening: ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'] },
    4: { morning: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
         evening: ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'] },
    5: { morning: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
         evening: ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30'] },
    6: { morning: ['10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00'],
         evening: [] },
    0: { morning: [], evening: [] }
};
