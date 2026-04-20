// ============================================
// МОДУЛЬ ГЛАВНОГО ПРИЛОЖЕНИЯ (ФИНАЛЬНЫЙ)
// ============================================

// Флаг для предотвращения многократной генерации (если нужно)
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

// --- Безопасный вызов генерации (отключён, оставлен для совместимости) ---
async function safeEnsureWeeklySchedule() {
    // Автоматическая генерация ОТКЛЮЧЕНА
    console.log('Автоматическая генерация отключена. Используйте ручную генерацию в админ-панели.');
    return;
}

// --- Инициализация приложения ---
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
        
        // Автоматическая генерация ОТКЛЮЧЕНА
        // safeEnsureWeeklySchedule().catch(e => console.error('Ошибка генерации:', e));
        
        setTimeout(() => {
            switchScreen('menu');
        }, 100);
    } else {
        setTimeout(() => {
            switchScreen('auth');
        }, 100);
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
                
                // Автоматическая генерация ОТКЛЮЧЕНА
                // safeEnsureWeeklySchedule().catch(e => console.error('Ошибка генерации:', e));
                
                switchScreen('menu');
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
            switchScreen('profile');
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
    
    // --- Кнопки "Назад" ---
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScreen('menu'));
    });
    
    // --- Выход ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.app.sb.auth.signOut();
            window.app.currentUser = null;
            switchScreen('auth');
        });
    }

    // --- Сброс расписания (если есть кнопка) ---
    const resetScheduleBtn = document.getElementById('reset-schedule-btn');
    if (resetScheduleBtn) {
        resetScheduleBtn.addEventListener('click', async () => {
            if (confirm('Сбросить расписание? Это удалит ВСЕ слоты и создаст новые.')) {
                alert('Функция сброса отключена. Используйте ручную генерацию.');
            }
        });
    }
    
    // --- Добавление слота вручную ---
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
            
            // Если используется таблица deleted_slots (опционально)
            if (window.app.sb.from('deleted_slots')) {
                try {
                    await window.app.sb.from('deleted_slots').delete().eq('slot_time', start);
                } catch(e) {
                    // Таблицы может не быть, игнорируем
                }
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
    
    // ========== НОВЫЕ ОБРАБОТЧИКИ ДЛЯ РУЧНОЙ ГЕНЕРАЦИИ СЛОТОВ ==========
    
    // --- Генерация утра ---
    const generateMorningBtn = document.getElementById('generate-morning-btn');
    if (generateMorningBtn) {
        generateMorningBtn.addEventListener('click', async () => {
            const dateInput = document.getElementById('generate-date');
            const dateStr = dateInput?.value;
            
            if (!dateStr) {
                alert('Выберите дату');
                return;
            }
            
            generateMorningBtn.disabled = true;
            generateMorningBtn.textContent = '⏳ Генерация...';
            
            try {
                await window.app.generateSlotsForDay(dateStr, 'morning');
            } catch (e) {
                console.error('Ошибка генерации:', e);
                alert('Ошибка генерации: ' + e.message);
            } finally {
                generateMorningBtn.disabled = false;
                generateMorningBtn.textContent = '🌅 Сгенерировать утро';
            }
        });
    }
    
    // --- Генерация вечера ---
    const generateEveningBtn = document.getElementById('generate-evening-btn');
    if (generateEveningBtn) {
        generateEveningBtn.addEventListener('click', async () => {
            const dateInput = document.getElementById('generate-date');
            const dateStr = dateInput?.value;
            
            if (!dateStr) {
                alert('Выберите дату');
                return;
            }
            
            generateEveningBtn.disabled = true;
            generateEveningBtn.textContent = '⏳ Генерация...';
            
            try {
                await window.app.generateSlotsForDay(dateStr, 'evening');
            } catch (e) {
                console.error('Ошибка генерации:', e);
                alert('Ошибка генерации: ' + e.message);
            } finally {
                generateEveningBtn.disabled = false;
                generateEveningBtn.textContent = '🌙 Сгенерировать вечер';
            }
        });
    }
    
    // --- Генерация всей недели ---
    const generateWeekBtn = document.getElementById('generate-week-btn');
    if (generateWeekBtn) {
        generateWeekBtn.addEventListener('click', async () => {
            generateWeekBtn.disabled = true;
            generateWeekBtn.textContent = '⏳ Генерация...';
            
            try {
                await window.app.generateFullWeek();
            } catch (e) {
                console.error('Ошибка генерации недели:', e);
                alert('Ошибка генерации: ' + e.message);
            } finally {
                generateWeekBtn.disabled = false;
                generateWeekBtn.textContent = '📅 Сгенерировать неделю (ПН-СБ)';
            }
        });
    }
});
