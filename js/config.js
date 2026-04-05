// --- Инициализация Supabase ---
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM элементы (основные экраны) ---
const screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    dailyReport: document.getElementById('daily-report-screen'),
    profile: document.getElementById('profile-screen'),
    admin: document.getElementById('admin-screen')
};

let currentUser = null;
let selectedSlotIds = new Set();
let isLoggingIn = false;
