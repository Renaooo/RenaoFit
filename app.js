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
let isLoggingIn = false;

function showScreen(name) {
    Object.keys(screens).forEach(k => screens[k].classList.remove('active'));
    screens[name].classList.add('active');
}

function cleanPhone(phone) {
    return phone.replace(/[^0-9]/g, '');
}

async function loginWithPhone(phone, name) {
    const cleanPhoneNumber = cleanPhone(phone);
    const email = `${cleanPhoneNumber}@gmail.com`;
    const password = cleanPhoneNumber + 'simplepass';
    
    console.log('Попытка входа с email:', email);
    
    let { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error && error.message.includes('Invalid login credentials')) {
        console.log('Пользователь не найден, регистрируем...');
        const { data: signUpData, error: signUpError } = await sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { name: name, phone: phone }
            }
        });
        
        if (signUpError) throw signUpError;
        data = signUpData;
    } else if (error && !error.message.includes('Invalid login credentials')) {
        throw error;
    }
    
    await sb.from('profiles').upsert({ id: data.user.id, phone: phone, name: name });
    return data.user;
}

async function loadSlots() {
    const { data, error } = await sb
        .from('slots')
        .select('*')
        .eq('is_available', true)
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
    
    if (selectedSlotIds.size === 0) {
        alert('Выберите слоты для записи');
        return;
    }
    
    // Блокируем слоты
    for (let slotId of selectedSlotIds) {
        const { error: updateError } = await sb
            .from('slots')
            .update({ is_available: false })
            .eq('id', slotId);
        
        if (updateError) {
            alert('Ошибка при бронировании');
            return;
        }
    }
    
    // Создаем бронирования
    const bookingsToInsert = Array.from(selectedSlotIds).map(slotId => ({
        slot_id: slotId,
        user_id: currentUser.id
    }));
    
    const { error: insertError } = await sb
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (insertError) {
        // Разблокируем слоты
        for (let slotId of selectedSlotIds) {
            await sb
                .from('slots')
                .update({ is_available: true })
                .eq('id', slotId);
        }
        alert('Ошибка записи');
    } else {
        alert('Успешно записано!');
        selectedSlotIds.clear();
        showScreen('menu');
    }
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
    
    for (let booking of bookings) {
        const start = new Date(booking.slots.start_time);
        const formatted = `${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        
        const div = document.createElement('div');
        div.className = 'booking-card';
        div.innerHTML = `<span>${formatted}</span><button class="cancel-btn" data-id="${booking.id}">Отменить</button>`;
        
        div.querySelector('.cancel-btn').addEventListener('click', async () => {
            const { error: cancelError } = await sb
                .from('bookings')
                .delete()
                .eq('id', booking.id);
            
            if (!cancelError) {
                // Разблокируем слот
                await sb
                    .from('slots')
                    .update({ is_available: true })
                    .eq('id', booking.slot_id);
                loadMyBookings();
            } else {
                alert('Ошибка отмены');
            }
        });
        
        container.appendChild(div);
    }
}

async function loadAdminData() {
    // Слоты
    const { data: slots } = await sb
        .from('slots')
        .select('*')
        .order('start_time');
    
    const adminSlotsDiv = document.getElementById('admin-slots');
    if (adminSlotsDiv) {
        adminSlotsDiv.innerHTML = '';
        if (slots && slots.length > 0) {
            slots.forEach(slot => {
                const start = new Date(slot.start_time);
                const div = document.createElement('div');
                div.className = 'admin-slot';
                div.innerHTML = `<span>${start.toLocaleString()} ${slot.is_available ? '✅' : '❌'}</span><button class="btn small">${slot.is_available ? 'Закрыть' : 'Открыть'}</button>`;
                adminSlotsDiv.appendChild(div);
            });
        } else {
            adminSlotsDiv.innerHTML = '<p>Нет слотов</p>';
        }
    }
    
    // Бронирования
    const { data: bookings } = await sb
        .from('bookings')
        .select('*');
    
    const adminBookingsDiv = document.getElementById('admin-bookings');
    if (adminBookingsDiv) {
        adminBookingsDiv.innerHTML = '<h3>Все записи</h3>';
        
        if (bookings && bookings.length > 0) {
            for (let booking of bookings) {
                const { data: profile } = await sb
                    .from('profiles')
                    .select('name, phone')
                    .eq('id', booking.user_id)
                    .single();
                
                const { data: slot } = await sb
                    .from('slots')
                    .select('start_time')
                    .eq('id', booking.slot_id)
                    .single();
                
                const startTime = slot ? new Date(slot.start_time).toLocaleString() : 'Неизвестно';
                
                adminBookingsDiv.innerHTML += `
                    <div class="booking-card" style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                        <strong>${profile?.name || 'Неизвестно'}</strong><br>
                        📞 ${profile?.phone || 'нет телефона'}<br>
                        🕐 ${startTime}
                    </div>
                `;
            }
        } else {
            adminBookingsDiv.innerHTML += '<p>Нет записей</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        const nameSpan = document.getElementById('user-name');
        if (nameSpan) nameSpan.innerText = session.user.user_metadata.name || 'Друг';
        
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.style.display = 'block';
        }
        
        showScreen('menu');
    } else {
        showScreen('auth');
    }
    
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
            document.getElementById('user-name').innerText = name;
            showScreen('menu');
        } catch(e) {
            console.error('Ошибка:', e);
            alert('Ошибка входа: ' + e.message);
        } finally {
            isLoggingIn = false;
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
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen('menu'));
    });
    
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await sb.auth.signOut();
        currentUser = null;
        showScreen('auth');
    });
    
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
