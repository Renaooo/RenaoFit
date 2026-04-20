// ============================================
// МОДУЛЬ ГЛАВНОГО ПРИЛОЖЕНИЯ (ФИНАЛЬНЫЙ)
// ============================================

let isGeneratingSchedule = false;

// --- Функция переключения экранов (работает напрямую с DOM) ---
function switchScreen(screenName) {
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
}

// --- Дублируем функцию в window.app для совместимости ---
window.app.showScreen = switchScreen;

async function safeEnsureWeeklySchedule() {
    if (isGeneratingSchedule) {
        console.log('Генерация расписания уже выполняется, пропускаем...');
        return;
    }
    
    if (typeof window.app.ensureWeeklySchedule !== 'function') {
        console.log('Функция ensureWeeklySchedule не определена');
        return;
    }
    
    isGeneratingSchedule = true;
    try {
        await window.app.ensureWeeklySchedule();
    } catch (e) {
        console.error('Ошибка генерации расписания:', e);
    } finally {
        isGeneratingSchedule = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Приложение загружено');
    
    if (typeof window.app.initDailyReportUI === 'function') {
        window.app.initDailyReportUI();
        console.log('DailyReportUI инициализирован');
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const { data: { session } } = await window.app.sb.auth.getSession();
    console.log('Сессия:', session ? 'есть' : 'нет');
    
    if (session) {
        window.app.currentUser = session.user;
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.innerText = session.user.user_metadata.name || 'Друг';
        }
        
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && session.user.user_metadata?.is_admin === true) {
            adminBtn.style.display = 'block';
            console.log('Админ-панель доступна');
        }
        
        safeEnsureWeeklySchedule().catch(e => console.error('Ошибка генерации:', e));
        
        setTimeout(() => {
            switchScreen('menu');
        }, 100);
    } else {
        setTimeout(() => {
            switchScreen('auth');
        }, 100);
    }
    
    // --- Обработчики кнопок ---
    
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
                
                safeEnsureWeeklySchedule().catch(e => console.error('Ошибка генерации:', e));
                
                switchScreen('menu');
            } catch(e) {
                console.error('Ошибка входа:', e);
                alert('Ошибка входа: ' + e.message);
            } finally {
                window.app.isLoggingIn = false;
            }
        });
    }
    
    const bookBtn = document.getElementById('book-btn');
    if (bookBtn) {
        bookBtn.addEventListener('click', async () => {
            const slots = await window.app.loadSlots();
            await window.app.renderSlots(slots);
            switchScreen('booking');
        });
    }
    
    const myBookingsBtn = document.getElementById('my-bookings-btn');
    if (myBookingsBtn) {
        myBookingsBtn.addEventListener('click', async () => {
            await window.app.loadMyBookings();
            switchScreen('myBookings');
        });
    }
    
    const dailyReportBtn = document.getElementById('daily-report-btn');
    if (dailyReportBtn) {
        dailyReportBtn.addEventListener('click', async () => {
            await window.app.openDailyReport();
        });
    }
    
    const myProfileBtn = document.getElementById('my-profile-btn');
    if (myProfileBtn) {
        myProfileBtn.addEventListener('click', async () => {
            await window.app.loadMyProfile();
            if (typeof window.app.updateWeeklyMessage === 'function') {
                await window.app.updateWeeklyMessage();
            }
            switchScreen('profile');
        });
    }
    
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', async () => {
            await window.app.loadAdminData();
            switchScreen('admin');
        });
    }
    
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', window.app.confirmBooking);
    }
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScreen('menu'));
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.app.sb.auth.signOut();
            window.app.currentUser = null;
            switchScreen('auth');
        });
    }

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
    
    const adminAddSlotBtn = document.getElementById('admin-add-slot');
    if (adminAddSlotBtn) {
        adminAddSlotBtn.addEventListener('click', async () => {
            const startLocal = document.getElementById('admin-start').value;
            if (!startLocal) return alert('Выберите начало слота');
            
            const startDate = new Date(startLocal);
            const startUTC = new Date(Date.UTC(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate(),
                startDate.getHours(),
                startDate.getMinutes()
            ));
            const start = startUTC.toISOString();
            
            const endDate = new Date(startLocal);
            endDate.setHours(startDate.getHours() + 1);
            const endUTC = new Date(Date.UTC(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate(),
                endDate.getHours(),
                endDate.getMinutes()
            ));
            const end = endUTC.toISOString();
            
            if (window.app.sb.from('deleted_slots')) {
                try {
                    await window.app.sb.from('deleted_slots').delete().eq('slot_time', start);
                } catch(e) {}
            }
            
            const { error } = await window.app.sb.from('slots').insert({ 
                start_time: start, 
                end_time: end, 
                is_available: true,
                is_blocked: false
            });
            
            if (error) {
                alert('Ошибка: ' + error.message);
            } else { 
                alert('✅ Слот добавлен'); 
                if (typeof window.app.loadAdminData === 'function') {
                    await window.app.loadAdminData();
                }
                document.getElementById('admin-start').value = '';
            }
        });
    }
});
