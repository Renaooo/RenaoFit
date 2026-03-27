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
    const startDate = new Date(today);
    
    let created = 0;
    let deleted = 0;
    
    // Проверяем следующие 7 дней
    for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        
        const daySchedule = schedule[dayOfWeek];
        const requiredTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        // Получаем существующие слоты на этот день
        const startOfDay = new Date(currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: existingSlots } = await sb
            .from('slots')
            .select('id, start_time')
            .gte('start_time', startOfDay.toISOString())
            .lte('start_time', endOfDay.toISOString());
        
        const existingTimes = existingSlots?.map(s => {
            const d = new Date(s.start_time);
            return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        }) || [];
        
        // Удаляем слоты, которых нет в расписании
        for (let slot of existingSlots || []) {
            const timeStr = new Date(slot.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            if (!requiredTimes.includes(timeStr)) {
                await sb.from('bookings').delete().eq('slot_id', slot.id);
                await sb.from('slots').delete().eq('id', slot.id);
                deleted++;
            }
        }
        
        // Добавляем недостающие слоты
        for (let time of requiredTimes) {
            if (!existingTimes.includes(time)) {
                const [hours, minutes] = time.split(':');
                const startTime = new Date(currentDate);
                startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
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
        await loadAdminData();
    }
}



async function loadAdminData() {
    // Сначала обновляем расписание на 7 дней вперед
    await ensureWeeklySchedule();
    
    // Очищаем контейнеры
    const adminSlotsDiv = document.getElementById('admin-slots');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (adminSlotsDiv) adminSlotsDiv.innerHTML = '';
    if (adminBookingsDiv) adminBookingsDiv.innerHTML = '';
    
    // Получаем все слоты на ближайшие 7 дней
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
        // Группируем по дням
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
                
                // Группируем по утро/вечер
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
    
    // Бронирования
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

async function generateNextWeekSlots() {
    // Расписание по дням недели (0 - воскресенье, 1 - понедельник, ...)
    const schedule = {
        1: ['08:00', '09:00', '10:00', '11:00', '18:00', '19:00', '20:00', '21:00'], // Пн
        2: ['08:00', '09:00', '10:00', '11:00'], // Вт
        3: ['08:00', '09:00', '10:00', '11:00', '18:00', '19:00', '20:00', '21:00'], // Ср
        4: ['18:00', '19:00', '20:00', '21:00'], // Чт
        5: ['08:00', '09:00', '10:00', '11:00', '18:00', '19:00', '20:00', '21:00'], // Пт
        6: ['10:00', '11:00', '12:00', '13:00'], // Сб
        0: [] // Вс - выходной
    };
    
    // Получаем следующий понедельник
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (1 - today.getDay() + 7) % 7;
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    let startDate = new Date(nextMonday);
    
    let created = 0;
    let skipped = 0;
    
    // Генерируем слоты на 7 дней
    for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        
        const daySlots = schedule[dayOfWeek];
        
        if (!daySlots || daySlots.length === 0) {
            console.log(`${currentDate.toLocaleDateString()} - выходной, пропускаем`);
            continue;
        }
        
        console.log(`Генерирую слоты на ${currentDate.toLocaleDateString()} (${getDayName(dayOfWeek)}):`);
        
        for (let time of daySlots) {
            const [hours, minutes] = time.split(':');
            const startTime = new Date(currentDate);
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // Пропускаем если время уже прошло
            if (startTime < new Date()) {
                console.log(`  ${time} - уже прошло, пропускаем`);
                skipped++;
                continue;
            }
            
            const endTime = new Date(startTime);
            endTime.setHours(startTime.getHours() + 1, startTime.getMinutes(), 0, 0);
            
            // Проверяем, не существует ли уже такой слот
            const { data: existing } = await sb
                .from('slots')
                .select('id')
                .eq('start_time', startTime.toISOString())
                .maybeSingle();
            
            if (existing) {
                console.log(`  ${time} - уже существует`);
                skipped++;
                continue;
            }
            
            // Создаем слот
            const { error } = await sb
                .from('slots')
                .insert({
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    is_available: true
                });
            
            if (error) {
                console.error(`  ${time} - ошибка:`, error);
            } else {
                created++;
                console.log(`  ${time} - создан`);
            }
        }
    }
    
    alert(`Генерация завершена!\n✅ Создано: ${created} слотов\n⏭️ Пропущено: ${skipped}`);
    
    // Обновляем список слотов в админ-панели
    await loadAdminData();
}

// Вспомогательная функция для названий дней
function getDayName(day) {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[day];
}

async function clearAllSlots() {
    if (confirm('⚠️ ВНИМАНИЕ! Это действие удалит ВСЕ слоты и ВСЕ записи!\n\nВы уверены, что хотите очистить всё?')) {
        const doubleConfirm = confirm('Ещё раз подтвердите: удалить ВСЕ слоты и записи? Отменить будет нельзя!');
        
        if (doubleConfirm) {
            try {
                // Удаляем все бронирования
                const { error: bookingsError } = await sb
                    .from('bookings')
                    .delete()
                    .neq('id', 0); // удаляем все записи
                
                if (bookingsError) throw bookingsError;
                
                // Удаляем все слоты
                const { error: slotsError } = await sb
                    .from('slots')
                    .delete()
                    .neq('id', 0); // удаляем все слоты
                
                if (slotsError) throw slotsError;
                
                alert('✅ Все слоты и записи успешно удалены!');
                
                // Обновляем админ-панель
                await loadAdminData();
                
            } catch (error) {
                console.error('Ошибка очистки:', error);
                alert('❌ Ошибка при очистке: ' + error.message);
            }
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

// Кнопка очистки всех слотов
document.getElementById('clear-all-slots-btn')?.addEventListener('click', async () => {
    await clearAllSlots();
});
    
    // Новая кнопка генерации недели (ДОБАВЛЯЕМ СЮДА, ПЕРЕД ЗАКРЫВАЮЩЕЙ СКОБКОЙ)
    document.getElementById('generate-week-btn')?.addEventListener('click', async () => {
        if (confirm('Сгенерировать слоты на следующую неделю по расписанию?\n\nПн: 8,9,10,11,18,19,20,21\nВт: 8,9,10,11\nСр: 8,9,10,11,18,19,20,21\nЧт: 18,19,20,21\nПт: 8,9,10,11,18,19,20,21\nСб: 10,11,12,13\nВс: выходной')) {
            await generateNextWeekSlots();
        }
    });
});
