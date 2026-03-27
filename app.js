// --- Инициализация Supabase ---
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);




// --- DOM элементы ---
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




// --- Функция переключения экранов ---
function showScreen(name) {
    Object.keys(screens).forEach(k => screens[k].classList.remove('active'));
    screens[name].classList.add('active');
}




// --- Очистка телефона от лишних символов ---
function cleanPhone(phone) {
    return phone.replace(/[^0-9]/g, '');
}




// --- Авторизация / регистрация ---
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




// --- Загрузка свободных слотов для клиента ---
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




// --- Отображение слотов для клиента ---
function renderSlots(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет свободных слотов на ближайшую неделю</p>';
        return;
    }
    
    // Группируем слоты по дням
    const groupedByDay = {};
    slots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
        groupedByDay[dayKey].push(slot);
    });
    
    // Сортируем дни по дате
    const sortedDays = Object.keys(groupedByDay).sort((a, b) => {
        const dateA = new Date(a.split(',')[1] + ' ' + a.split(',')[0]);
        const dateB = new Date(b.split(',')[1] + ' ' + b.split(',')[0]);
        return dateA - dateB;
    });
    
    for (let day of sortedDays) {
        const daySlots = groupedByDay[day];
        
        // Сортируем слоты по времени
        daySlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        // Группируем по утро/вечер
        const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
        
        // Утро
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            
            morning.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                
                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-item';
                if (selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
                slotDiv.innerHTML = `
                    <span class="slot-time" style="font-weight: 500;">${timeStr}</span>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                
                const checkbox = slotDiv.querySelector('.slot-select');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedSlotIds.add(slot.id);
                    } else {
                        selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${selectedSlotIds.size})`;
                    }
                });
                
                morningDiv.appendChild(slotDiv);
            });
            
            dayDiv.appendChild(morningDiv);
        }
        
        // Вечер
        if (evening.length > 0) {
            const eveningDiv = document.createElement('div');
            eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
            
            evening.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                
                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-item';
                if (selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
                slotDiv.innerHTML = `
                    <span class="slot-time" style="font-weight: 500;">${timeStr}</span>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                
                const checkbox = slotDiv.querySelector('.slot-select');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedSlotIds.add(slot.id);
                    } else {
                        selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${selectedSlotIds.size})`;
                    }
                });
                
                eveningDiv.appendChild(slotDiv);
            });
            
            dayDiv.appendChild(eveningDiv);
        }
        
        container.appendChild(dayDiv);
    }
}



// --- Подтверждение записи клиентом ---
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




// --- Загрузка и отображение записей клиента ---
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




// --- Функция автоматического обновления расписания на 7 дней ---
async function ensureWeeklySchedule() {
    const schedule = {
        1: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['18:00', '19:00', '20:00', '21:00'] }, // Пн
        2: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: [] }, // Вт
        3: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['18:00', '19:00', '20:00', '21:00'] }, // Ср
        4: { morning: [], evening: ['18:00', '19:00', '20:00', '21:00'] }, // Чт
        5: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['18:00', '19:00', '20:00', '21:00'] }, // Пт
        6: { morning: ['10:00', '11:00', '12:00', '13:00'], evening: [] }, // Сб
        0: { morning: [], evening: [] } // Вс
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let created = 0;
    let deleted = 0;
    
    for (let day = 0; day < 7; day++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        
        const daySchedule = schedule[dayOfWeek];
        const requiredTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        const startOfDay = new Date(currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: existingSlots } = await sb
            .from('slots')
            .select('id, start_time')
            .gte('start_time', startOfDay.toISOString())
            .lte('start_time', endOfDay.toISOString());
        
        const existingTimesSet = new Set();
        existingSlots?.forEach(slot => {
            const d = new Date(slot.start_time);
            const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            existingTimesSet.add(timeStr);
        });
        
        for (let slot of existingSlots || []) {
            const d = new Date(slot.start_time);
            const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            if (!requiredTimes.includes(timeStr)) {
                await sb.from('bookings').delete().eq('slot_id', slot.id);
                await sb.from('slots').delete().eq('id', slot.id);
                deleted++;
            }
        }
        
        for (let time of requiredTimes) {
            if (!existingTimesSet.has(time)) {
                const [hours, minutes] = time.split(':');
                const startTime = new Date(currentDate);
                startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                if (startTime < new Date()) {
                    continue;
                }
                
                const endTime = new Date(startTime);
                endTime.setHours(startTime.getHours() + 1);
                
                await sb.from('slots').insert({
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    is_available: true
                });
                created++;
            }
        }
    }
    
    if (created > 0 || deleted > 0) {
        console.log(`Расписание обновлено: +${created} / -${deleted}`);
    }
}




// --- Вспомогательная функция для отображения отдельного слота в админке ---
function addSlotElement(container, slot) {
    const start = new Date(slot.start_time);
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: #fff; border-radius: 8px; border: 1px solid #e0e0e0;';
    div.innerHTML = `
        <span>${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        <button class="delete-slot-btn" data-id="${slot.id}" style="background: #ff3b30; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">✖</button>
    `;
    
    div.querySelector('.delete-slot-btn').addEventListener('click', async () => {
        if (confirm('Удалить этот слот?')) {
            await sb.from('bookings').delete().eq('slot_id', slot.id);
            await sb.from('slots').delete().eq('id', slot.id);
            await loadAdminData();
        }
    });
    
    container.appendChild(div);
}




// --- Админ-панель: отображение слотов (группировка по дням и утро/вечер) и записей ---
async function loadAdminData() {
    await ensureWeeklySchedule();
    
    const adminSlotsDiv = document.getElementById('admin-slots');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (adminSlotsDiv) adminSlotsDiv.innerHTML = '';
    if (adminBookingsDiv) adminBookingsDiv.innerHTML = '';
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    
    const { data: slots } = await sb
        .from('slots')
        .select('*')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');
    
    if (adminSlotsDiv && slots) {
        const groupedByDay = {};
        slots.forEach(slot => {
            const date = new Date(slot.start_time);
            const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
            if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
            groupedByDay[dayKey].push(slot);
        });
        
        if (Object.keys(groupedByDay).length === 0) {
            adminSlotsDiv.innerHTML = '<p>Нет слотов на ближайшую неделю</p>';
        } else {
            for (let [day, daySlots] of Object.entries(groupedByDay)) {
                const dayDiv = document.createElement('div');
                dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
                dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
                
                const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
                const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
                
                if (morning.length > 0) {
                    const morningDiv = document.createElement('div');
                    morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
                    morning.forEach(slot => addSlotElement(morningDiv, slot));
                    dayDiv.appendChild(morningDiv);
                }
                
                if (evening.length > 0) {
                    const eveningDiv = document.createElement('div');
                    eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
                    evening.forEach(slot => addSlotElement(eveningDiv, slot));
                    dayDiv.appendChild(eveningDiv);
                }
                
                adminSlotsDiv.appendChild(dayDiv);
            }
        }
    }
    
    const { data: bookings } = await sb.rpc('get_bookings_with_profiles');
    
    if (adminBookingsDiv) {
        const title = document.createElement('h3');
        title.textContent = 'Все записи';
        adminBookingsDiv.appendChild(title);
        
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
                    <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                `;
                
                const deleteBtn = div.querySelector('.delete-booking-btn');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                        const { error: deleteError } = await sb
                            .from('bookings')
                            .delete()
                            .eq('id', booking.id);
                        
                        if (deleteError) {
                            alert('Ошибка удаления записи');
                            return;
                        }
                        
                        await sb
                            .from('slots')
                            .update({ is_available: true })
                            .eq('id', booking.slot_id);
                        
                        alert('Запись удалена, слот свободен');
                        await loadAdminData();
                    }
                });
                
                adminBookingsDiv.appendChild(div);
            }
        } else {
            const noBookings = document.createElement('p');
            noBookings.textContent = 'Нет записей';
            adminBookingsDiv.appendChild(noBookings);
        }
    }
}




// --- Инициализация при загрузке страницы ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        const nameSpan = document.getElementById('user-name');
        if (nameSpan) nameSpan.innerText = session.user.user_metadata.name || 'Друг';
        
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && session.user.user_metadata?.is_admin === true) {
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
