// ============================================
// МОДУЛЬ ГЛАВНОГО ПРИЛОЖЕНИЯ (ФИНАЛЬНЫЙ)
// ============================================

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
        
        if (typeof window.app.ensureWeeklySchedule === 'function') {
            console.log('Проверяем и добавляем недостающие слоты...');
            try {
                await window.app.ensureWeeklySchedule();
            } catch(e) {
                console.error('Ошибка генерации слотов:', e);
            }
        }
        
        setTimeout(() => {
            if (typeof window.app.showScreen === 'function') {
                window.app.showScreen('menu');
                console.log('Меню отображено');
            } else {
                const menuScreen = document.getElementById('menu-screen');
                if (menuScreen) {
                    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                    menuScreen.classList.add('active');
                }
            }
        }, 100);
    } else {
        setTimeout(() => {
            if (typeof window.app.showScreen === 'function') {
                window.app.showScreen('auth');
            } else {
                const authScreen = document.getElementById('auth-screen');
                if (authScreen) {
                    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                    authScreen.classList.add('active');
                }
            }
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
    
    const bookBtn = document.getElementById('book-btn');
    if (bookBtn) {
        bookBtn.addEventListener('click', async () => {
            const slots = await window.app.loadSlots();
            await window.app.renderSlots(slots);
            window.app.showScreen('booking');
        });
    }
    
    const myBookingsBtn = document.getElementById('my-bookings-btn');
    if (myBookingsBtn) {
        myBookingsBtn.addEventListener('click', async () => {
            await window.app.loadMyBookings();
            window.app.showScreen('myBookings');
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
            window.app.showScreen('profile');
        });
    }
    
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', async () => {
            await window.app.loadAdminData();
            window.app.showScreen('admin');
        });
    }
    
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', window.app.confirmBooking);
    }
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => window.app.showScreen('menu'));
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.app.sb.auth.signOut();
            window.app.currentUser = null;
            window.app.showScreen('auth');
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
    
    // --- Добавление слота (с удалением из deleted_slots) ---
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
            
            // Удаляем из deleted_slots, если был там
            await window.app.sb.from('deleted_slots').delete().eq('slot_time', start);
            
            const { error } = await window.app.sb.from('slots').insert({ 
                start_time: start, 
                end_time: end, 
                is_available: true 
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
