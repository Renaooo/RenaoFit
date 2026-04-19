// ============================================
// МОДУЛЬ СЛОТОВ (ФИНАЛЬНАЯ ВЕРСИЯ - ИСПРАВЛЕНА)
// ============================================

// --- Вспомогательная функция для работы с UTC и локальным временем ---
function getUTCDateFromLocal(year, month, day, hour, minute) {
    return new Date(Date.UTC(year, month, day, hour, minute));
}

function getLocalHourFromUTC(utcDate) {
    // Преобразуем UTC в локальное время (МСК = UTC+3)
    const localDate = new Date(utcDate);
    localDate.setHours(localDate.getHours() + 3);
    return localDate.getHours();
}

// --- Получение списка заблокированных слотов (с учётом исключений) ---
async function getBlockedSlotIds() {
    const blockedIds = new Set();
    
    const { data: exceptions } = await window.app.sb
        .from('slot_exceptions')
        .select('slot_id');
    
    const exceptionIds = new Set();
    exceptions?.forEach(ex => exceptionIds.add(ex.slot_id));
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 14);
    
    const { data: bookedSlots } = await window.app.sb
        .from('slots')
        .select('id, start_time')
        .eq('is_available', false)
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    if (!bookedSlots || bookedSlots.length === 0) return blockedIds;
    
    const { data: allSlots } = await window.app.sb
        .from('slots')
        .select('id, start_time')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    if (!allSlots) return blockedIds;
    
    const slotsByDay = {};
    allSlots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toISOString().split('T')[0];
        const hour = date.getUTCHours();
        const minute = date.getUTCMinutes();
        if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
        slotsByDay[dayKey].push({ id: slot.id, hour, minute, timeValue: hour + minute/60 });
    });
    
    const bookedByDay = {};
    bookedSlots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toISOString().split('T')[0];
        const hour = date.getUTCHours();
        const minute = date.getUTCMinutes();
        if (!bookedByDay[dayKey]) bookedByDay[dayKey] = [];
        bookedByDay[dayKey].push({ id: slot.id, hour, minute, timeValue: hour + minute/60 });
    });
    
    for (let [dayKey, booked] of Object.entries(bookedByDay)) {
        const morningBooked = booked.filter(b => b.hour < 15);
        const eveningBooked = booked.filter(b => b.hour >= 15);
        
        if (morningBooked.length > 0) {
            for (let bookedSlot of morningBooked) {
                const startMinutes = bookedSlot.timeValue * 60;
                const blockFromMinutes = startMinutes + 240;
                const blockUntilMinutes = startMinutes - 240;
                
                const laterSlots = slotsByDay[dayKey]?.filter(slot => {
                    const isMorning = slot.hour < 15;
                    const slotMinutes = slot.timeValue * 60;
                    return isMorning && slotMinutes >= blockFromMinutes;
                });
                if (laterSlots && laterSlots.length > 0) {
                    laterSlots.forEach(slot => {
                        if (!exceptionIds.has(slot.id)) blockedIds.add(slot.id);
                    });
                }
                
                const earlierSlots = slotsByDay[dayKey]?.filter(slot => {
                    const isMorning = slot.hour < 15;
                    const slotMinutes = slot.timeValue * 60;
                    return isMorning && slotMinutes <= blockUntilMinutes;
                });
                if (earlierSlots && earlierSlots.length > 0) {
                    earlierSlots.forEach(slot => {
                        if (!exceptionIds.has(slot.id)) blockedIds.add(slot.id);
                    });
                }
            }
        }
        
        if (eveningBooked.length > 0) {
            for (let bookedSlot of eveningBooked) {
                const startMinutes = bookedSlot.timeValue * 60;
                const blockFromMinutes = startMinutes + 240;
                const blockUntilMinutes = startMinutes - 240;
                
                const laterSlots = slotsByDay[dayKey]?.filter(slot => {
                    const isEvening = slot.hour >= 15;
                    const slotMinutes = slot.timeValue * 60;
                    return isEvening && slotMinutes >= blockFromMinutes;
                });
                if (laterSlots && laterSlots.length > 0) {
                    laterSlots.forEach(slot => {
                        if (!exceptionIds.has(slot.id)) blockedIds.add(slot.id);
                    });
                }
                
                const earlierSlots = slotsByDay[dayKey]?.filter(slot => {
                    const isEvening = slot.hour >= 15;
                    const slotMinutes = slot.timeValue * 60;
                    return isEvening && slotMinutes <= blockUntilMinutes;
                });
                if (earlierSlots && earlierSlots.length > 0) {
                    earlierSlots.forEach(slot => {
                        if (!exceptionIds.has(slot.id)) blockedIds.add(slot.id);
                    });
                }
            }
        }
        
        for (let bookedSlot of booked) {
            const startMinutes = bookedSlot.timeValue * 60;
            
            const adjacentSlots = [];
            slotsByDay[dayKey]?.forEach(slot => {
                const slotMinutes = slot.timeValue * 60;
                if (Math.abs(slotMinutes - startMinutes) < 60 && slot.id !== bookedSlot.id) {
                    adjacentSlots.push(slot);
                }
            });
            
            if (adjacentSlots.length > 0) {
                adjacentSlots.forEach(slot => {
                    if (!exceptionIds.has(slot.id)) blockedIds.add(slot.id);
                });
            }
        }
    }
    
    return blockedIds;
}

// --- Загрузка свободных слотов для клиента ---
window.app.loadSlots = async function() {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    const { data: slots, error } = await window.app.sb
        .from('slots')
        .select('*')
        .eq('is_available', true)
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');
    
    if (error) throw error;
    
    const blockedIds = await getBlockedSlotIds();
    return slots.filter(slot => !blockedIds.has(slot.id));
};

// --- Отображение слотов для клиента ---
window.app.renderSlots = async function(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет свободных слотов</p>';
        return;
    }
    
    const groupedByDay = {};
    slots.forEach(slot => {
        const date = new Date(slot.start_time);
        const displayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[displayKey]) {
            groupedByDay[displayKey] = [];
        }
        groupedByDay[displayKey].push(slot);
    });
    
    for (let [displayDay, daySlots] of Object.entries(groupedByDay)) {
        daySlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const morning = daySlots.filter(s => new Date(s.start_time).getUTCHours() < 15);
        const evening = daySlots.filter(s => new Date(s.start_time).getUTCHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${displayDay}</h3>`;
        
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            morning.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const slotDiv = document.createElement('div');
                if (window.app.selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
                slotDiv.innerHTML = `
                    <span style="font-weight: 500;">${timeStr}</span>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${window.app.selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                const cb = slotDiv.querySelector('.slot-select');
                cb.addEventListener('change', () => {
                    if (cb.checked) {
                        window.app.selectedSlotIds.add(slot.id);
                    } else {
                        window.app.selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = window.app.selectedSlotIds.size > 0 ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${window.app.selectedSlotIds.size})`;
                    }
                });
                morningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(morningDiv);
        }
        
        if (evening.length > 0) {
            const eveningDiv = document.createElement('div');
            eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
            evening.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const slotDiv = document.createElement('div');
                if (window.app.selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
                slotDiv.innerHTML = `
                    <span style="font-weight: 500;">${timeStr}</span>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${window.app.selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                const cb = slotDiv.querySelector('.slot-select');
                cb.addEventListener('change', () => {
                    if (cb.checked) {
                        window.app.selectedSlotIds.add(slot.id);
                    } else {
                        window.app.selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = window.app.selectedSlotIds.size > 0 ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${window.app.selectedSlotIds.size})`;
                    }
                });
                eveningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(eveningDiv);
        }
        
        container.appendChild(dayDiv);
    }
};

// --- Подтверждение записи ---
window.app.confirmBooking = async function() {
    if (!window.app.currentUser) return;
    
    if (window.app.selectedSlotIds.size === 0) {
        alert('Выберите слоты для записи');
        return;
    }
    
    const selectedIds = Array.from(window.app.selectedSlotIds);
    
    const blockedIds = await getBlockedSlotIds();
    const hasBlocked = selectedIds.some(id => blockedIds.has(id));
    if (hasBlocked) {
        alert('Некоторые выбранные слоты стали недоступны. Обновите страницу.');
        window.app.selectedSlotIds.clear();
        const slots = await window.app.loadSlots();
        await window.app.renderSlots(slots);
        return;
    }
    
    const bookingsToInsert = selectedIds.map(slotId => ({
        slot_id: slotId,
        user_id: window.app.currentUser.id
    }));
    
    const { error: insertError } = await window.app.sb
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (insertError) {
        alert('Ошибка записи: ' + insertError.message);
        return;
    }
    
    for (let slotId of selectedIds) {
        await window.app.sb
            .from('slots')
            .update({ is_available: false })
            .eq('id', slotId);
    }
    
    alert('Успешно записано!');
    window.app.selectedSlotIds.clear();
    window.app.showScreen('menu');
};

// --- Мои записи ---
window.app.loadMyBookings = async function() {
    const { data: bookings, error } = await window.app.sb
        .from('bookings')
        .select('id, slot_id, slots(start_time, end_time)')
        .eq('user_id', window.app.currentUser.id);
    
    if (error) throw error;
    
    const container = document.getElementById('my-bookings-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">У вас нет записей</p>';
        return;
    }
    
    const groupedByDay = {};
    bookings.forEach(booking => {
        const date = new Date(booking.slots.start_time);
        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
        groupedByDay[dayKey].push(booking);
    });
    
    for (let [day, dayBookings] of Object.entries(groupedByDay)) {
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${day}</h3>`;
        
        dayBookings.forEach(booking => {
            const start = new Date(booking.slots.start_time);
            const formatted = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 12px; margin-bottom: 8px;';
            div.innerHTML = `
                <span>${formatted}</span>
                <button class="cancel-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px;">Отменить</button>
            `;
            div.querySelector('.cancel-btn').addEventListener('click', async () => {
                if (confirm('Отменить запись?')) {
                    await window.app.sb.from('bookings').delete().eq('id', booking.id);
                    await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                    await window.app.loadMyBookings();
                }
            });
            dayDiv.appendChild(div);
        });
        container.appendChild(dayDiv);
    }
};

// --- Генерация расписания (ТОЛЬКО если слоты отсутствуют И не в deleted_slots) ---
window.app.ensureWeeklySchedule = async function() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setUTCDate(today.getUTCDate() + 7);
    
    // Получаем существующие слоты
    const { data: existingSlots } = await window.app.sb
        .from('slots')
        .select('start_time')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    // Получаем удалённые слоты
    const { data: deletedSlots } = await window.app.sb
        .from('deleted_slots')
        .select('slot_time')
        .gte('slot_time', today.toISOString())
        .lte('slot_time', endDate.toISOString());
    
    const existingSlotKeys = new Set();
    existingSlots?.forEach(slot => {
        const key = new Date(slot.start_time).toISOString().slice(0, 16);
        existingSlotKeys.add(key);
    });
    
    const deletedSlotKeys = new Set();
    deletedSlots?.forEach(ds => {
        const key = new Date(ds.slot_time).toISOString().slice(0, 16);
        deletedSlotKeys.add(key);
    });
    
    // Расписание (в UTC+3, но храним в UTC)
    const schedule = {
        1: { morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], 
             evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] },
        2: { morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], 
             evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] },
        3: { morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], 
             evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] },
        4: { morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], 
             evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] },
        5: { morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], 
             evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] },
        6: { morning: ['10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'], 
             evening: [] },
        0: { morning: [], evening: [] }
    };
    
    let addedCount = 0;
    
    for (let day = 0; day <= 7; day++) {
        const currentDate = new Date(today);
        currentDate.setUTCDate(today.getUTCDate() + day);
        const dayOfWeek = currentDate.getUTCDay();
        const daySchedule = schedule[dayOfWeek] || schedule[1];
        const requiredTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        if (requiredTimes.length === 0) continue;
        
        for (let time of requiredTimes) {
            const [hours, minutes] = time.split(':');
            const startTime = new Date(currentDate);
            startTime.setUTCHours(parseInt(hours) - 3, parseInt(minutes), 0, 0);
            
            if (startTime < new Date()) continue;
            
            const slotKey = startTime.toISOString().slice(0, 16);
            
            if (existingSlotKeys.has(slotKey)) continue;
            if (deletedSlotKeys.has(slotKey)) continue;
            
            const endTime = new Date(startTime);
            endTime.setUTCHours(startTime.getUTCHours() + 1);
            
            await window.app.sb.from('slots').insert({
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                is_available: true
            });
            addedCount++;
        }
    }
    
    if (addedCount > 0) {
        console.log(`✅ Добавлено ${addedCount} новых слотов по расписанию`);
    }
};

// --- Отображение слота в админке ---
window.app.addSlotElement = function(container, slot, isBlockedByRule = false) {
    const start = new Date(slot.start_time);
    const isAvailable = slot.is_available;
    const isBlocked = !isAvailable || isBlockedByRule;
    
    const div = document.createElement('div');
    div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: ${isBlocked ? '#f0f0f0' : '#fff'}; border-radius: 8px; border: 1px solid ${isBlocked ? '#ffcccc' : '#e0e0e0'};`;
    
    let statusText = '';
    if (!isAvailable) statusText = '❌ занят';
    else if (isBlockedByRule) statusText = '🔒 заблокирован правилами';
    
    const showUnblockBtn = isBlockedByRule && isAvailable;
    
    div.innerHTML = `
        <span style="${isBlocked ? 'text-decoration: line-through; color: #999;' : ''}">
            ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            ${statusText ? ` ${statusText}` : ''}
        </span>
        <div style="display: flex; gap: 6px;">
            ${showUnblockBtn ? '<button class="unblock-slot-btn" data-id="' + slot.id + '" style="background: #36B647; color: white; border: none; padding: 4px 12px; border-radius: 6px;">🔓</button>' : ''}
            <button class="delete-slot-btn" data-id="${slot.id}" data-time="${start.toISOString()}" style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 6px;">✖</button>
        </div>
    `;
    
    div.querySelector('.delete-slot-btn')?.addEventListener('click', async () => {
        if (confirm('Удалить слот? Он не восстановится.')) {
            const slotTime = div.querySelector('.delete-slot-btn').dataset.time;
            await window.app.sb.from('deleted_slots').insert({ slot_time: slotTime });
            await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
            await window.app.sb.from('slots').delete().eq('id', slot.id);
            await window.app.loadAdminDataWithoutGenerate();
        }
    });
    
    div.querySelector('.unblock-slot-btn')?.addEventListener('click', async () => {
        await window.app.sb.from('slot_exceptions').insert({ slot_id: slot.id });
        await window.app.sb.from('slots').update({ is_available: true }).eq('id', slot.id);
        await window.app.loadAdminData();
    });
    
    container.appendChild(div);
};

// --- Загрузка админ-панели ---
window.app.loadAdminData = async function() {
    await window.app.ensureWeeklySchedule();
    await window.app.loadAdminDataWithoutGenerate();
};

window.app.loadAdminDataWithoutGenerate = async function() {
    const adminSlotsDiv = document.getElementById('admin-slots');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    if (adminSlotsDiv) adminSlotsDiv.innerHTML = '';
    if (adminBookingsDiv) adminBookingsDiv.innerHTML = '';
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    const { data: slots } = await window.app.sb
        .from('slots')
        .select('*')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');
    
    const blockedIds = await getBlockedSlotIds();
    
    if (slots?.length) {
        const grouped = {};
        slots.forEach(slot => {
            const date = new Date(slot.start_time);
            const key = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(slot);
        });
        
        for (let [day, daySlots] of Object.entries(grouped)) {
            const dayDiv = document.createElement('div');
            dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
            dayDiv.innerHTML = `<h3>📅 ${day}</h3>`;
            
            const morning = daySlots.filter(s => new Date(s.start_time).getUTCHours() < 15);
            const evening = daySlots.filter(s => new Date(s.start_time).getUTCHours() >= 15);
            
            if (morning.length) {
                const morningDiv = document.createElement('div');
                morningDiv.innerHTML = '<div style="font-size: 12px; color: #666;">☀️ Утро</div>';
                morning.forEach(slot => {
                    const isBlockedByRule = blockedIds.has(slot.id);
                    window.app.addSlotElement(morningDiv, slot, isBlockedByRule);
                });
                dayDiv.appendChild(morningDiv);
            }
            
            if (evening.length) {
                const eveningDiv = document.createElement('div');
                eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-top: 10px;">🌙 Вечер</div>';
                evening.forEach(slot => {
                    const isBlockedByRule = blockedIds.has(slot.id);
                    window.app.addSlotElement(eveningDiv, slot, isBlockedByRule);
                });
                dayDiv.appendChild(eveningDiv);
            }
            
            adminSlotsDiv.appendChild(dayDiv);
        }
    }
    
    const { data: bookings } = await window.app.sb.rpc('get_bookings_with_profiles');
    if (bookings?.length) {
        const grouped = {};
        bookings.forEach(b => {
            const date = new Date(b.start_time);
            const key = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(b);
        });
        
        for (let [day, dayBookings] of Object.entries(grouped)) {
            const dayDiv = document.createElement('div');
            dayDiv.innerHTML = `<h3>📅 ${day}</h3>`;
            dayBookings.forEach(b => {
                const div = document.createElement('div');
                div.innerHTML = `${b.name} — ${new Date(b.start_time).toLocaleTimeString()}`;
                dayDiv.appendChild(div);
            });
            adminBookingsDiv.appendChild(dayDiv);
        }
    }
};
