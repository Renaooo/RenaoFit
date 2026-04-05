// ============================================
// МОДУЛЬ ГЛАВНОГО ПРИЛОЖЕНИЯ (НАВИГАЦИЯ, ИНИЦИАЛИЗАЦИЯ)
// ============================================

// --- Функция переключения экранов ---
function showScreen(name) {
    Object.keys(screens).forEach(key => {
        if (screens[key]) {
            screens[key].classList.remove('active');
        }
    });
    if (screens[name]) {
        screens[name].classList.add('active');
    }
}

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', async () => {
    // Инициализируем UI ежедневного отчета
    if (typeof initDailyReportUI === 'function') {
        initDailyReportUI();
    }
    
    // Проверяем сессию пользователя
    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.innerText = session.user.user_metadata.name || 'Друг';
        }
        
        // Показываем кнопку админа, если пользователь админ
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && session.user.user_metadata?.is_admin === true) {
            adminBtn.style.display = 'block';
        }
        
        showScreen('menu');
    } else {
        showScreen('auth');
    }
    
    // ========== ОБРАБОТЧИКИ КНОПОК ==========
    
    // --- Авторизация ---
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        if (isLoggingIn) return;
        isLoggingIn = true;
        
        const phone = document.getElementById('phone-input').value;
        const name = document.getElementById('name-input').value;
        
        if (!phone || !name) {
            alert('Введите телефон и имя');
            isLoggingIn = false;
            return;
        }
        
        try {
            currentUser = await loginWithPhone(phone, name);
            const userNameSpan = document.getElementById('user-name');
            if (userNameSpan) userNameSpan.innerText = name;
            showScreen('menu');
        } catch(e) {
            console.error('Ошибка входа:', e);
            alert('Ошибка входа: ' + e.message);
        } finally {
            isLoggingIn = false;
        }
    });
    
    // --- Записаться ---
    document.getElementById('book-btn')?.addEventListener('click', async () => {
        const slots = await loadSlots();
        await renderSlots(slots);
        showScreen('booking');
    });
    
    // --- Мои записи ---
    document.getElementById('my-bookings-btn')?.addEventListener('click', async () => {
        await loadMyBookings();
        showScreen('myBookings');
    });
    
    // --- Ежедневный отчет ---
    document.getElementById('daily-report-btn')?.addEventListener('click', async () => {
        await openDailyReport();
    });
    
    // --- Мой профиль ---
    document.getElementById('my-profile-btn')?.addEventListener('click', async () => {
        await loadMyProfile();
        await updateWeeklyMessage();
        showScreen('profile');
    });
    
    // --- Админ-панель ---
    document.getElementById('admin-btn')?.addEventListener('click', async () => {
        await loadAdminData();
        showScreen('admin');
    });
    
    // --- Кнопка подтверждения записи ---
    document.getElementById('confirm-booking-btn')?.addEventListener('click', confirmBooking);
    
    // --- Кнопки "Назад" ---
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen('menu'));
    });
    
    // --- Выход ---
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await sb.auth.signOut();
        currentUser = null;
        showScreen('auth');
    });
    
    // --- Добавление слота в админ-панели ---
    document.getElementById('admin-add-slot')?.addEventListener('click', async () => {
        const start = document.getElementById('admin-start').value;
        if (!start) return alert('Выберите начало слота');
        
        const startDate = new Date(start);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        const end = endDate.toISOString().slice(0, 16);
        
        const { error } = await sb.from('slots').insert({ 
            start_time: start, 
            end_time: end, 
            is_available: true 
        });
        
        if (error) {
            alert('Ошибка: ' + error.message);
        } else { 
            alert('Слот добавлен (1 час)'); 
            loadAdminData();
            document.getElementById('admin-start').value = '';
        }
    });
});
