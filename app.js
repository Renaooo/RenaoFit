// --- Инициализация Supabase
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

// Создаем клиент Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM элементы
const screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    admin: document.getElementById('admin-screen')
};

let currentUser = null;
let selectedSlotIds = new Set();

// --- Функции переключения экранов
function showScreen(screenName) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

// --- Авторизация
async function loginWithPhone(phone, name) {
    const fakeEmail = `${phone.replace(/[^0-9]/g, '')}@user.local`;
    const fakePassword = phone + 'simplepass';
    
    let { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password: fakePassword,
        options: {
            data: { name: name, phone: phone }
        }
    });
    
    if (error && error.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: fakeEmail,
            password: fakePassword
        });
        if (signInError) throw signInError;
        data = signInData;
    } else if (error) {
        throw error;
    }
    
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id, phone: phone, name: name });
    
    if (profileError) console.error(profileError);
    
    return data.user;
}

// --- Загрузка слотов
async function loadSlots() {
    const { data, error } = await supabase
        .from('slots')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });
    
    if (error) throw error;
    return data;
}

// --- Отображение слотов для записи
function renderSlots(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    slots.forEach(slot => {
        const start = new Date(slot.start_time);
        const formatted = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        
        const div = document.createElement('div');
        div.className = 'slot-item';
        if (selectedSlotIds.has(slot.id)) div.classList.add('selected');
        
        div.innerHTML = `
            <span class="slot-time">${formatted}</span>
            <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''}>
        `;
        
        const checkbox = div.querySelector('.slot-select');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedSlotIds.add(slot.id);
            } else {
                selectedSlotIds.delete(slot.id);
            }
            const confirmBtn = document.getElementById('confirm-booking-btn');
            if (confirmBtn) confirmBtn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
        });
        
        container.appendChild(div);
    });
}

// --- Подтверждение записи
async function confirmBooking() {
    if (!currentUser) return;
    
    const bookingsToInsert = Array.from(selectedSlotIds).map(slotId => ({
        slot_id: slotId,
        user_id: currentUser.id
    }));
    
    const { error } = await supabase
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (error) {
        alert('Ошибка: некоторые слоты уже заняты');
        console.error(error);
    } else {
        alert('Успешно записано!');
        selectedSlotIds.clear();
        showScreen('menu');
    }
}

// --- Мои записи
async function loadMyBookings() {
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
            id,
            slot_id,
            slots (start_time, end_time)
        `)
        .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    const container = document.getElementById('my-bookings-list');
    if (!container) return;
    container.innerHTML = '';
    
    for (let booking of bookings) {
        const slot = booking.slots;
        const start = new Date(slot.start_time);
        const formatted = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        
        const div = document.createElement('div');
        div.className = 'booking-card';
        div.innerHTML = `
            <span>${formatted}</span>
            <button class="cancel-btn" data-id="${booking.id}">Отменить</button>
        `;
        
        div.querySelector('.cancel-btn').addEventListener('click', async () => {
            const { error: cancelError } = await supabase
                .from('bookings')
                .delete()
                .eq('id', booking.id);
            
            if (!cancelError) {
                loadMyBookings();
            } else {
                alert('Ошибка отмены');
            }
        });
        
        container.appendChild(div);
    }
}

// --- Админ-панель
async function loadAdminData() {
    const { data: slots } = await supabase
        .from('slots')
        .select('*')
        .order('start_time');
    
    const adminSlotsDiv = document.getElementById('admin-slots');
    if (adminSlotsDiv) {
        adminSlotsDiv.innerHTML = '';
        slots.forEach(slot => {
            const start = new Date(slot.start_time);
            const div = document.createElement('div');
            div.className = 'admin-slot';
            div.innerHTML = `
                <span>${start.toLocaleString()}</span>
                <button class="btn small" data-slot="${slot.id}" data-available="${slot.is_available}">
                    ${slot.is_available ? 'Закрыть' : 'Открыть'}
                </button>
            `;
            adminSlotsDiv.appendChild(div);
        });
    }
    
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*, profiles(name, phone), slots(start_time)');
    
    const adminBookingsDiv = document.getElementById('admin-bookings');
    if (adminBookingsDiv) {
        adminBookingsDiv.innerHTML = '';
        bookings.forEach(b => {
            const start = new Date(b.slots.start_time);
            adminBookingsDiv.innerHTML += `
                <div class="booking-card">
                    <div>
                        <strong>${b.profiles.name}</strong> (${b.profiles.phone})<br>
                        ${start.toLocaleString()}
                    </div>
                </div>
            `;
        });
    }
}

// --- Инициализация и обработчики событий
document.addEventListener('DOMContentLoaded', () => {
    // Проверка сессии
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            const userNameSpan = document.getElementById('user-name');
            if (userNameSpan) userNameSpan.innerText = session.user.user_metadata.name || 'Друг';
            const adminBtn = document.getElementById('admin-btn');
            // Админ-доступ для renao.russia@gmail.com
            if (adminBtn && session.user.email === 'renao.russia@gmail.com') {
                adminBtn.style.display = 'block';
            }
            showScreen('menu');
        } else {
            showScreen('auth');
        }
    });
    
    // Вход
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const phone = document.getElementById('phone-input').value;
            const name = document.getElementById('name-input').value;
            if (!phone || !name) return alert('Введите телефон и имя');
            try {
                const user = await loginWithPhone(phone, name);
                currentUser = user;
                const userNameSpan = document.getElementById('user-name');
                if (userNameSpan) userNameSpan.innerText = name;
                showScreen('menu');
            } catch(e) {
                alert('Ошибка входа: ' + e.message);
            }
        });
    }
    
    // Навигация
    const bookBtn = document.getElementById('book-btn');
    if (bookBtn) {
        bookBtn.addEventListener('click', async () => {
            const slots = await loadSlots();
            renderSlots(slots);
            showScreen('booking');
        });
    }
    
    const myBookingsBtn = document.getElementById('my-bookings-btn');
    if (myBookingsBtn) {
        myBookingsBtn.addEventListener('click', async () => {
            await loadMyBookings();
            showScreen('myBookings');
        });
    }
    
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmBooking);
    }
    
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', async () => {
            await loadAdminData();
            showScreen('admin');
        });
    }
    
    // Кнопки назад
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen('menu'));
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            currentUser = null;
            showScreen('auth');
        });
    }
    
    // Добавление слота админом
    const adminAddSlot = document.getElementById('admin-add-slot');
    if (adminAddSlot) {
        adminAddSlot.addEventListener('click', async () => {
            const start = document.getElementById('admin-start').value;
            const end = document.getElementById('admin-end').value;
            if (!start || !end) return alert('Заполните время');
            const { error } = await supabase
                .from('slots')
                .insert({ start_time: start, end_time: end, is_available: true });
            if (error) alert('Ошибка');
            else {
                alert('Слот добавлен');
                loadAdminData();
            }
        });
    }
});