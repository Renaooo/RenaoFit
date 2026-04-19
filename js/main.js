// ============================================
// МОДУЛЬ ГЛАВНОГО ПРИЛОЖЕНИЯ (НАВИГАЦИЯ, ИНИЦИАЛИЗАЦИЯ)
// ============================================

// --- Функция переключения экранов (уже определена в globals.js, но дублируем для надежности) ---
if (typeof window.app.showScreen !== 'function') {
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
}

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Приложение загружено');
    
    // Инициализируем UI ежедневного отчета
    if (typeof window.app.initDailyReportUI === 'function') {
        window.app.initDailyReportUI();
        console.log('DailyReportUI инициализирован');
    }
    
    // Проверяем сессию пользователя
    const { data: { session } } = await window.app.sb.auth.getSession();
    console.log('Сессия:', session ? 'есть' : 'нет');
    
    if (session) {
        window.app.currentUser = session.user;
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.innerText = session.user.user_metadata.name || 'Друг';
        }
        
        // Показываем кнопку админа, если пользователь админ
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && session.user.user_metadata?.is_admin === true) {
            adminBtn.style.display = 'block';
            console.log('Админ-панель доступна');
        }
        
        // ⭐ ГЕНЕРАЦИЯ СЛОТОВ при входе любого пользователя (без удаления существующих)
        if (typeof window.app.ensureWeeklySchedule === 'function') {
            console.log('Проверяем и добавляем недостающие слоты...');
            await window.app.ensureWeeklySchedule();
        }
        
        window.app.showScreen('menu');
    } else {
        window.app.showScreen('auth');
    }
    
    // ========== ОБРАБОТЧИКИ КНОПОК ==========
    
    // --- Авторизация ---
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            if (window.app.isLoggingIn) return;
            window.app.isLoggingIn = true;
            
            const phone = document.getElementById('phone-input').value;
            const name = document.getElementById('name-input').value;
            
            if (!phone || !name) {
                alert('Введите телефон и имя');
                window.app.isLoggingIn = false;
                return;
            }
            
            try {
                window.app.currentUser = await window.app.loginWithPhone(phone, name);
                const userNameSpan = document.getElementById('user-name');
                if (userNameSpan) userNameSpan.innerText = name;
                
                // ⭐ ГЕНЕРАЦИЯ СЛОТОВ после успешного входа
                if (typeof window.app.ensureWeeklySchedule === 'function') {
                    console.log('Проверяем и добавляем недостающие слоты...');
                    await window.app.ensureWeeklySchedule();
                }
                
                window.app.showScreen('menu');
            } catch(e) {
                console.error('Ошибка входа:', e);
                alert('Ошибка входа: ' + e.message);
            } finally {
                window.app.isLoggingIn = false;
            }
        });
    }
    
    // --- Записаться ---
    const bookBtn = document.getElementById('book-btn');
    if (bookBtn) {
        bookBtn.addEventListener('click', async () => {
            const slots = await window.app.loadSlots();
            await window.app.renderSlots(slots);
            window.app.showScreen('booking');
        });
    }
    
    // --- Мои записи ---
    const myBookingsBtn = document.getElementById('my-bookings-btn');
    if (myBookingsBtn) {
        myBookingsBtn.addEventListener('click', async () => {
            await window.app.loadMyBookings();
            window.app.showScreen('myBookings');
        });
    }
    
    // --- Ежедневный отчет ---
    const dailyReportBtn = document.getElementById('daily-report-btn');
    if (dailyReportBtn) {
        dailyReportBtn.addEventListener('click', async () => {
            await window.app.openDailyReport();
        });
    }
    
    // --- Мой профиль ---
    const myProfileBtn = document.getElementById('my-profile-btn');
    if (myProfileBtn) {
        myProfileBtn.addEventListener('click', async () => {
            await window.app.loadMyProfile();
            if (typeof window.app.updateWeeklyMessage === 'function') {
                await window.app.updateWeeklyMessage();
            }
            window.app.showScreen('profile');
        });
    }
    
    // --- Админ-панель ---
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', async () => {
            await window.app.loadAdminData();
            window.app.showScreen('admin');
        });
    }
    
    // --- Кнопка подтверждения записи ---
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', window.app.confirmBooking);
    }
    
    // --- Кнопки "Назад" ---
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => window.app.showScreen('menu'));
    });
    
    // --- Выход ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.app.sb.auth.signOut();
            window.app.currentUser = null;
            window.app.showScreen('auth');
        });
    }

    // --- Сброс расписания (если есть кнопка) ---
    const resetScheduleBtn = document.getElementById('reset-schedule-btn');
    if (resetScheduleBtn) {
        resetScheduleBtn.addEventListener('click', async () => {
            if (confirm('Сбросить расписание? Это удалит ВСЕ слоты и создаст новые.')) {
                await window.app.ensureWeeklySchedule(true);
                await window.app.loadAdminData();
                alert('Расписание обновлено');
            }
        });
    }
    
    // --- Добавление слота в админ-панели (с корректным преобразованием времени) ---
    const adminAddSlotBtn = document.getElementById('admin-add-slot');
    if (adminAddSlotBtn) {
        adminAddSlotBtn.addEventListener('click', async () => {
            const startLocal = document.getElementById('admin-start').value;
            if (!startLocal) return alert('Выберите начало слота');
            
            // Преобразуем локальное время (МСК) в UTC для сохранения в БД
            const startDate = new Date(startLocal);
            // Создаем UTC дату из локальных компонентов
            const startUTC = new Date(Date.UTC(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                startDate.getHours(),
                startDate.getMinutes()
            ));
            const start = startUTC.toISOString().slice(0, 16);
            
            const endDate = new Date(startLocal);
            endDate.setHours(startDate.getHours() + 1);
            const endUTC = new Date(Date.UTC(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate(),
                endDate.getHours(),
                endDate.getMinutes()
            ));
            const end = endUTC.toISOString().slice(0, 16);
            
            console.log('Добавление слота:', { startLocal, start, end });
            
            const { error } = await window.app.sb.from('slots').insert({ 
                start_time: start, 
                end_time: end, 
                is_available: true 
            });
            
            if (error) {
                alert('Ошибка: ' + error.message);
            } else { 
                alert('Слот добавлен (1 час)'); 
                if (typeof window.app.loadAdminData === 'function') {
                    await window.app.loadAdminData();
                }
                document.getElementById('admin-start').value = '';
            }
        });
    }
});
