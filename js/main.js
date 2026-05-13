// ============================================
// МОДУЛЬ ГЛАВНОГО ПРИЛОЖЕНИЯ (ТОЛЬКО ЗАПИСЬ)
// ============================================

// --- Функция переключения экранов ---
function switchScreen(screenName) {
    console.log('Переключение на экран:', screenName);
    const screens = ['auth', 'menu', 'booking', 'myBookings', 'admin'];
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

// --- Дублируем функцию в window.app ---
window.app.showScreen = switchScreen;

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Приложение загружено');
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const { data: { session } } = await window.app.sb.auth.getSession();
    console.log('Сессия:', session ? 'есть' : 'нет');
    
    if (session) {
        window.app.currentUser = session.user;
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan) {
            userNameSpan.innerText = session.user.user_metadata.name || 'Друг';
        }
        
        // Проверяем, админ ли пользователь
        const isAdmin = await window.app.isAdmin(session.user.id);
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && isAdmin) {
            adminBtn.style.display = 'block';
            console.log('Админ-панель доступна');
        }
        
        setTimeout(() => {
            switchScreen('menu');
        }, 100);
    } else {
        setTimeout(() => {
            switchScreen('auth');
        }, 100);
    }
});

// ========== ОБРАБОТЧИКИ КНОПОК ==========

// --- Авторизация ---
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        if (window.app.isLoggingIn) return;
        window.app.isLoggingIn = true;
        
        const phone = document.getElementById('phone-input').value;
        const name = document.getElementById('name-input').value;
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) errorDiv.innerText = '';
        
        if (!phone || !name) {
            alert('Введите телефон и имя');
            window.app.isLoggingIn = false;
            return;
        }
        
        try {
            const user = await window.app.loginWithPhone(phone, name);
            window.app.currentUser = user;
            const userNameSpan = document.getElementById('user-name');
            if (userNameSpan) userNameSpan.innerText = name;
            
            // Проверяем админа
            const isAdmin = await window.app.isAdmin(user.id);
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn && isAdmin) {
                adminBtn.style.display = 'block';
            }
            
            switchScreen('menu');
        } catch(e) {
            console.error('Ошибка входа:', e);
            if (errorDiv) errorDiv.innerText = e.message;
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
        // Не вызываем switchScreen, потому что loadMyBookings уже показывает экран
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
        window.app.selectedSlotIds.clear();
        switchScreen('auth');
    });
}

// --- Добавление слота вручную (админка) ---
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
            await window.app.loadAdminData();
            document.getElementById('admin-start').value = '';
        }
    });
}

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
            generateMorningBtn.textContent = '🌅 Утро';
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
            generateEveningBtn.textContent = '🌙 Вечер';
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
            generateWeekBtn.textContent = '📅 Неделя (ПН-СБ)';
        }
    });
}

// --- Переключение вкладок в админке ---
const slotsTab = document.getElementById('admin-slots-tab');
const clientsTab = document.getElementById('admin-clients-tab');
const slotsPanel = document.getElementById('admin-slots-panel');
const clientsPanel = document.getElementById('admin-clients-panel');
const adminBookingsDiv = document.getElementById('admin-bookings');

if (slotsTab && clientsTab) {
    slotsTab.addEventListener('click', () => {
        slotsTab.style.background = '#36B647';
        slotsTab.style.color = 'white';
        clientsTab.style.background = '#f0f0f0';
        clientsTab.style.color = '#323338';
        slotsPanel.style.display = 'block';
        clientsPanel.style.display = 'none';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'block';
    });
    
    clientsTab.addEventListener('click', async () => {
        clientsTab.style.background = '#36B647';
        clientsTab.style.color = 'white';
        slotsTab.style.background = '#f0f0f0';
        slotsTab.style.color = '#323338';
        slotsPanel.style.display = 'none';
        clientsPanel.style.display = 'block';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'none';
        
        if (typeof window.app.renderClientsList === 'function') {
            await window.app.renderClientsList();
        } else {
            console.warn('renderClientsList не определена, создайте admin-clients.js');
            clientsPanel.innerHTML = '<p style="padding:20px;">Функция клиентов временно отключена</p>';
        }
    });
}
