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
    // Очищаем контейнеры
    const adminSlotsDiv = document.getElementById('admin-slots');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (adminSlotsDiv) adminSlotsDiv.innerHTML = '';
    if (adminBookingsDiv) adminBookingsDiv.innerHTML = '';
    
    // Слоты — только свободные
    const { data: slots } = await sb
        .from('slots')
        .select('*')
        .eq('is_available', true)
        .order('start_time');
    
    if (adminSlotsDiv) {
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
                            await loadAdminData();
                        }
                    }
                });
                
                adminSlotsDiv.appendChild(div);
            }
        } else {
            adminSlotsDiv.innerHTML = '<p>Нет свободных слотов</p>';
        }
    }
    
    // Бронирования
    const { data: bookings } = await sb
        .rpc('get_bookings_with_profiles');
    
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
                        console.log('Удаляю бронь ID:', booking.id, 'slot ID:', booking.slot_id);
                        
                        const { error: deleteError } = await sb
                            .from('bookings')
                            .delete()
                            .eq('id', booking.id);
                        
                        if (deleteError) {
                            console.error('Ошибка удаления:', deleteError);
                            alert('Ошибка удаления записи: ' + deleteError.message);
                            return;
                        }
                        
                        console.log('Бронь успешно удалена');
                        
                        const { error: updateError } = await sb
                            .from('slots')
                            .update({ is_available: true })
                            .eq('id', booking.slot_id);
                        
                        if (updateError) {
                            console.error('Ошибка разблокировки:', updateError);
                            alert('Ошибка разблокировки слота: ' + updateError.message);
                        } else {
                            console.log('Слот разблокирован');
                            alert('Запись удалена, слот свободен');
                            await loadAdminData();
                        }
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
    
    // Новая кнопка генерации недели (ДОБАВЛЯЕМ СЮДА, ПЕРЕД ЗАКРЫВАЮЩЕЙ СКОБКОЙ)
    document.getElementById('generate-week-btn')?.addEventListener('click', async () => {
        if (confirm('Сгенерировать слоты на следующую неделю по расписанию?\n\nПн: 8,9,10,11,18,19,20,21\nВт: 8,9,10,11\nСр: 8,9,10,11,18,19,20,21\nЧт: 18,19,20,21\nПт: 8,9,10,11,18,19,20,21\nСб: 10,11,12,13\nВс: выходной')) {
            await generateNextWeekSlots();
        }
    });
});
