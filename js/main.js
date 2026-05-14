// ============================================
// ГЛАВНЫЙ МОДУЛЬ (НАВИГАЦИЯ, ОБРАБОТЧИКИ)
// ============================================

// --- Переключение экранов ---
function switchScreen(screenName) {
    console.log('Переключение на экран:', screenName);
    const screens = ['auth', 'menu', 'booking', 'myBookings', 'admin'];
    screens.forEach(name => {
        const el = document.getElementById(`${name}-screen`);
        if (el) {
            if (name === screenName) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
}

window.app.showScreen = switchScreen;

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Приложение загружено');
    
    // Проверяем сессию
    const { data: { session } } = await window.app.sb.auth.getSession();
    
    if (session) {
        window.app.currentUser = session.user;
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.innerText = session.user.user_metadata.name || 'Друг';
        }
        
        // Показываем кнопку админа, если пользователь админ
        const isAdmin = await window.app.isAdmin(session.user.id);
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && isAdmin) {
            adminBtn.style.display = 'block';
        }
        
        switchScreen('menu');
    } else {
        switchScreen('auth');
    }
});

// ========== ОБРАБОТЧИКИ КНОПОК ==========

// --- Авторизация ---
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const phone = document.getElementById('phone-input').value;
        const name = document.getElementById('name-input').value;
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) errorDiv.innerText = '';
        
        if (!phone || !name) {
            alert('Введите телефон и имя');
            return;
        }
        
        try {
            const user = await window.app.loginWithPhone(phone, name);
            window.app.currentUser = user;
            document.getElementById('user-name').innerText = name;
            
            const isAdmin = await window.app.isAdmin(user.id);
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn && isAdmin) adminBtn.style.display = 'block';
            
            switchScreen('menu');
        } catch (err) {
            console.error(err);
            if (errorDiv) errorDiv.innerText = err.message;
            alert('Ошибка: ' + err.message);
        }
    });
}

// --- Записаться ---
const bookBtn = document.getElementById('book-btn');
if (bookBtn) {
    bookBtn.addEventListener('click', async () => {
        const slots = await window.app.loadSlots();
        await window.app.renderSlots(slots);
        switchScreen('booking');
    });
}

// --- Мои записи ---
const myBookingsBtn = document.getElementById('my-bookings-btn');
if (myBookingsBtn) {
    myBookingsBtn.addEventListener('click', async () => {
        await window.app.loadMyBookings();
        switchScreen('myBookings');
    });
}

// --- Админ-панель ---
const adminBtn = document.getElementById('admin-btn');
if (adminBtn) {
    adminBtn.addEventListener('click', async () => {
        await window.app.loadAdminData();
        switchScreen('admin');
    });
}

// --- Подтверждение записи ---
const confirmBtn = document.getElementById('confirm-booking-btn');
if (confirmBtn) {
    confirmBtn.addEventListener('click', window.app.confirmBooking);
}

// --- Назад (все кнопки с классом back-btn) ---
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => switchScreen('menu'));
});

// --- Выход ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await window.app.logout();
        window.app.currentUser = null;
        window.app.selectedSlotIds.clear();
        switchScreen('auth');
    });
}

// --- Добавление слота вручную (админка) ---
const addSlotBtn = document.getElementById('admin-add-slot');
if (addSlotBtn) {
    addSlotBtn.addEventListener('click', async () => {
        const localStart = document.getElementById('admin-start').value;
        if (!localStart) return alert('Выберите дату и время');
        
        const startDate = new Date(localStart);
        const startUTC = new Date(Date.UTC(
            startDate.getFullYear(), startDate.getMonth(), startDate.getDate(),
            startDate.getHours(), startDate.getMinutes()
        ));
        const start = startUTC.toISOString();
        const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000);
        const end = endUTC.toISOString();
        
        const { error } = await window.app.sb.from('slots').insert({
            start_time: start, end_time: end, is_available: true, is_blocked: false
        });
        if (error) alert('Ошибка: ' + error.message);
        else {
            alert('✅ Слот добавлен');
            await window.app.loadAdminData();
            document.getElementById('admin-start').value = '';
        }
    });
}

// --- Генерация утра ---
const genMorning = document.getElementById('generate-morning-btn');
if (genMorning) {
    genMorning.addEventListener('click', async () => {
        const date = document.getElementById('generate-date').value;
        if (!date) return alert('Выберите дату');
        await window.app.generateSlotsForDay(date, 'morning');
    });
}

// --- Генерация вечера ---
const genEvening = document.getElementById('generate-evening-btn');
if (genEvening) {
    genEvening.addEventListener('click', async () => {
        const date = document.getElementById('generate-date').value;
        if (!date) return alert('Выберите дату');
        await window.app.generateSlotsForDay(date, 'evening');
    });
}

// --- Генерация недели ---
const genWeek = document.getElementById('generate-week-btn');
if (genWeek) {
    genWeek.addEventListener('click', async () => {
        await window.app.generateFullWeek();
    });
}
