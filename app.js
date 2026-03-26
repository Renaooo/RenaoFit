const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    admin: document.getElementById('admin-screen')
};

let currentUser = null;
let selectedSlotIds = new Set();

function showScreen(name) {
    Object.keys(screens).forEach(k => screens[k].classList.remove('active'));
    screens[name].classList.add('active');
}

function cleanPhone(phone) {
    return phone.replace(/[^0-9]/g, '');
}

async function loginWithPhone(phone, name) {
    const cleanPhoneNumber = cleanPhone(phone);
    const email = `${cleanPhoneNumber}@trainer.com`;
    const password = cleanPhoneNumber + 'simplepass';
    
    console.log('Попытка входа с email:', email);
    
    let { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { name: name, phone: phone }
        }
    });
    
    if (error && error.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (signInError) throw signInError;
        data = signInData;
    } else if (error) {
        throw error;
    }
    
    const { error: profileError } = await sb
        .from('profiles')
        .upsert({ id: data.user.id, phone: phone, name: name });
    
    if (profileError) console.error('Ошибка профиля:', profileError);
    
    return data.user;
}

async function loadSlots() {
    const { data, error } = await sb
        .from('slots')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time');
    if (error) throw error;
    return data;
}

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
        div.innerHTML = `<span class="slot-time">${formatted}</span><input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''}>`;
        const cb = div.querySelector('.slot-select');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedSlotIds.add(slot.id);
            else selectedSlotIds.delete(slot.id);
            const btn = document.getElementById('confirm-booking-btn');
            if (btn) btn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
        });
        container.appendChild(div);
    });
}

async function confirmBooking() {
    if (!currentUser) return;
    const bookings = Array.from(selectedSlotIds).map(slotId => ({ slot_id: slotId, user_id: currentUser.id }));
    const { error } = await sb.from('bookings').insert(bookings);
    if (error) alert('Ошибка: слоты уже заняты');
    else { alert('Успешно записано!'); selectedSlotIds.clear(); showScreen('menu'); }
}

async function loadMyBookings() {
    const { data: bookings, error } = await sb
        .from('bookings')
        .select('id, slot_id, slots(start_time, end_time)')
        .eq('user_id', currentUser.id);
    if (error) throw error;
    const container = document.getElementById('my-bookings-list');
    if (!container) return;
    container.innerHTML = '';
    for (let b of bookings) {
        const start = new Date(b.slots.start_time);
        const formatted = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        const div = document.createElement('div');
        div.className = 'booking-card';
        div.innerHTML = `<span>${formatted}</span><button class="cancel-btn" data-id="${b.id}">Отменить</button>`;
        div.querySelector('.cancel-btn').addEventListener('click', async () => {
            const { error } = await sb.from('bookings').delete().eq('id', b.id);
            if (!error) loadMyBookings();
            else alert('Ошибка отмены');
        });
        container.appendChild(div);
    }
}

async function loadAdminData() {
    const { data: slots } = await sb.from('slots').select('*').order('start_time');
    const adminSlotsDiv = document.getElementById('admin-slots');
    if (adminSlotsDiv) {
        adminSlotsDiv.innerHTML = '';
        slots.forEach(slot => {
            const start = new Date(slot.start_time);
            const div = document.createElement('div');
            div.className = 'admin-slot';
            div.innerHTML = `<span>${start.toLocaleString()}</span><button class="btn small">${slot.is_available ? 'Закрыть' : 'Открыть'}</button>`;
            adminSlotsDiv.appendChild(div);
        });
    }
    const { data: bookings } = await sb.from('bookings').select('*, profiles(name, phone), slots(start_time)');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    if (adminBookingsDiv) {
        adminBookingsDiv.innerHTML = '';
        bookings.forEach(b => {
            const start = new Date(b.slots.start_time);
            adminBookingsDiv.innerHTML += `<div class="booking-card"><div><strong>${b.profiles.name}</strong> (${b.profiles.phone})<br>${start.toLocaleString()}</div></div>`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    sb.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            const nameSpan = document.getElementById('user-name');
            if (nameSpan) nameSpan.innerText = session.user.user_metadata.name || 'Друг';
            
            // Проверяем админа по метаданным
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn && session.user.user_metadata?.is_admin === true) {
                adminBtn.style.display = 'block';
                console.log('Админ-панель доступна');
            } else {
                console.log('Не админ, метаданные:', session.user.user_metadata);
            }
            
            showScreen('menu');
        } else {
            showScreen('auth');
        }
    });
    
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        const phone = document.getElementById('phone-input').value;
        const name = document.getElementById('name-input').value;
        if (!phone || !name) return alert('Введите телефон и имя');
        if (cleanPhone(phone).length < 5) return alert('Введите корректный номер телефона');
        
        try {
            currentUser = await loginWithPhone(phone, name);
            document.getElementById('user-name').innerText = name;
            showScreen('menu');
        } catch(e) {
            console.error('Ошибка:', e);
            alert('Ошибка входа: ' + e.message);
        }
    });
    
    document.getElementById('book-btn')?.addEventListener('click', async () => {
        const slots = await loadSlots();
        renderSlots(slots);
        showScreen('booking');
    });
    
    document.getElementById('my-bookings-btn')?.addEventListener('click', async () => {
        await loadMyBookings();
        showScreen('myBookings');
    });
    
    document.getElementById('confirm-booking-btn')?.addEventListener('click', confirmBooking);
    document.getElementById('admin-btn')?.addEventListener('click', async () => {
        await loadAdminData();
        showScreen('admin');
    });
    
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => showScreen('menu')));
    
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await sb.auth.signOut();
        currentUser = null;
        showScreen('auth');
    });
    
    document.getElementById('admin-add-slot')?.addEventListener('click', async () => {
        const start = document.getElementById('admin-start').value;
        const end = document.getElementById('admin-end').value;
        if (!start || !end) return alert('Заполните время');
        const { error } = await sb.from('slots').insert({ start_time: start, end_time: end, is_available: true });
        if (error) alert('Ошибка');
        else { alert('Слот добавлен'); loadAdminData(); }
    });
});
