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
    
    let { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error && error.message.includes('Invalid login credentials')) {
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
    
    const { error: profileError } = await sb
        .from('profiles')
        .upsert({ id: data.user.id, phone: phone, name: name });
    
    if (profileError) console.error('Ошибка сохранения профиля:', profileError);
    
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
    
    const bookingsToInsert = Array.from(selectedSlotIds).map(slotId => ({
        slot_id: slotId,
        user_id: currentUser.id
    }));
    
    const { error: insertError } = await sb
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (insertError) {
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
    // Слоты — только свободные
    const { data: slots } = await sb
        .from('slots')
        .select('*')
        .eq('is_available', true)
        .order('start_time');
    
    const adminSlotsDiv = document.getElementById('admin-slots');
    if (adminSlotsDiv) {
        adminSlotsDiv.innerHTML = '';
        if (slots && slots.length > 0) {
            for (let slot of slots) {
                const start = new Date(slot.start_time);
                const div = document.createElement('div');
                div.className = 'admin-slot';
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f5f5f5; border-radius: 8px;';
                div.innerHTML = `
                    <span>${start.toLocaleString()}</span>
                    <button class="delete-slot-btn" data-id="${slot.id}" style="background: #ff3b30; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                `;
                
                const deleteBtn = div.querySelector('.delete-slot-btn');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm('Удалить этот слот?')) {
                        const { error } = await sb
                            .from('slots')
                            .delete()
                            .eq('id', slot.id);
                        
                        if (error) {
                            alert('Ошибка удаления');
                        } else {
                            alert('Слот удален');
                            loadAdminData(); // обновляем список
                        }
                    }
                });
                
                adminSlotsDiv.appendChild(div);
            }
        } else {
            adminSlotsDiv.innerHTML = '<p>Нет свободных слотов</p>';
        }
    }
    
    // Бронирования с кнопкой удаления
    const { data: bookings } = await sb
        .rpc('get_bookings_with_profiles');
    
    const adminBookingsDiv = document.getElementById('admin-bookings');
    if (adminBookingsDiv) {
        adminBookingsDiv.innerHTML = '<h3>Все записи</h3>';
        
        if (bookings && bookings.length > 0) {
            for (let booking of bookings) {
                const div = document.createElement('div');
                div.style.cssText = 'border:1px solid #ddd; margin:10px 0; padding:12px; border-radius:8px; background:#f9f9f9; display: flex; justify-content: space-between; align-items: center;';
                div.innerHTML = `
                    <div>
                        <strong>${booking.name || 'Неизвестно'}</strong><br>
                        📞 ${booking.phone || 'нет телефона'}<br>
                        🕐 ${new Date(booking.start_time).toLocaleString()}
                    </div>
                    <button class="delete-booking-btn" data-id="${booking.id}" style="background: #ff3b30; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                `;
                
                const deleteBtn = div.querySelector('.delete-booking-btn');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                        // Удаляем бронирование
                        const { error: deleteError } = await sb
                            .from('bookings')
                            .delete()
                            .eq('id', booking.id);
                        
                        if (deleteError) {
                            alert('Ошибка удаления записи');
                            return;
                        }
                        
                        // Разблокируем слот
                        const { error: updateError } = await sb
                            .from('slots')
                            .update({ is_available: true })
                            .eq('id', booking.slot_id);
                        
                        if (updateError) {
                            alert('Ошибка разблокировки слота');
                        } else {
                            alert('Запись удалена, слот свободен');
                            loadAdminData(); // обновляем оба списка
                        }
                    }
                });
                
                adminBookingsDiv.appendChild(div);
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
        if (adminBtn && session.user.user_metadata?.is_admin === true) {
            adminBtn.style.display = 'block';
            console.log('Админ-панель доступна');
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
