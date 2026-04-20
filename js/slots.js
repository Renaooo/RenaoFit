// ============================================
// МОДУЛЬ СЛОТОВ (ФИНАЛЬНАЯ ВЕРСИЯ - МСК)
// ============================================

// --- Расписание в МСК ---
const SCHEDULE = {
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

// Флаг для предотвращения повторного рендера
let isRenderingAdmin = false;

// --- Преобразование UTC в МСК (при отображении) ---
function utcToMsk(utcDate) {
    const date = new Date(utcDate);
    date.setUTCHours(date.getUTCHours() + 3);
    return date;
}

// --- Преобразование МСК в UTC (при сохранении) ---
function mskToUtc(mskDate) {
    const date = new Date(mskDate);
    date.setUTCHours(date.getUTCHours() - 3);
    return date;
}

// --- Получение текущей даты и времени в МСК ---
function getNowMSK() {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 3);
    return now;
}

// --- Получение списка заблокированных слотов ---
async function getBlockedSlotIds() {
    const blockedIds = new Set();
    
    const { data: manuallyBlocked } = await window.app.sb
        .from('slots')
        .select('id')
        .eq('is_blocked', true);
    
    manuallyBlocked?.forEach(slot => blockedIds.add(slot.id));
    
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
        .eq('is_blocked', false)
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
        const date = utcToMsk(slot.start_time);
        const displayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[displayKey]) {
            groupedByDay[displayKey] = [];
        }
        groupedByDay[displayKey].push(slot);
    });
    
    for (let [displayDay, daySlots] of Object.entries(groupedByDay)) {
        daySlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const morning = daySlots.filter(s => utcToMsk(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => utcToMsk(s.start_time).getHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${displayDay}</h3>`;
        
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            
            morning.forEach(slot => {
                const start = utcToMsk(slot.start_time);
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
                const start = utcToMsk(slot.start_time);
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
        const date = utcToMsk(booking.slots.start_time);
        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
        groupedByDay[dayKey].push(booking);
    });
    
    const sortedDays = Object.keys(groupedByDay).sort((a, b) => {
        const dateA = new Date(a.split(',')[1] + ' ' + a.split(',')[0]);
        const dateB = new Date(b.split(',')[1] + ' ' + b.split(',')[0]);
        return dateA - dateB;
    });
    
    for (let day of sortedDays) {
        const dayBookings = groupedByDay[day];
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
        
        dayBookings.forEach(booking => {
            const start = utcToMsk(booking.slots.start_time);
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

// --- РУЧНАЯ ГЕНЕРАЦИЯ СЛОТОВ (исправленная, МСК) ---
window.app.generateSlotsForDay = async function(dateStr, half) {
    if (!dateStr) {
        alert('Выберите дату');
        return false;
    }
    
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
        alert('Выберите корректную дату');
        return false;
    }
    
    const dayOfWeek = targetDate.getDay();
    const daySchedule = SCHEDULE[dayOfWeek] || SCHEDULE[1];
    const times = half === 'morning' ? daySchedule.morning : daySchedule.evening;
    
    if (times.length === 0) {
        alert(`На ${half === 'morning' ? 'утро' : 'вечер'} этого дня нет расписания`);
        return false;
    }
    
    let created = 0;
    let skipped = 0;
    let existing = 0;
    
    // Текущее время в МСК
    const nowMSK = getNowMSK();
    
    for (const time of times) {
        const [hours, minutes] = time.split(':');
        
        // Создаём время в МСК
        const startTimeMSK = new Date(targetDate);
        startTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Пропускаем прошедшие слоты
        if (startTimeMSK < nowMSK) {
            skipped++;
            continue;
        }
        
        // Конвертируем в UTC для сохранения в БД
        const startTimeUTC = mskToUtc(startTimeMSK);
        const startTimeISO = startTimeUTC.toISOString();
        
        // Проверяем, существует ли уже такой слот
        const { data: existingSlot } = await window.app.sb
            .from('slots')
            .select('id')
            .eq('start_time', startTimeISO)
            .maybeSingle();
        
        if (existingSlot) {
            existing++;
            continue;
        }
        
        const endTimeUTC = new Date(startTimeUTC);
        endTimeUTC.setUTCHours(startTimeUTC.getUTCHours() + 1);
        
        const { error } = await window.app.sb.from('slots').insert({
            start_time: startTimeISO,
            end_time: endTimeUTC.toISOString(),
            is_available: true,
            is_blocked: false
        });
        
        if (error) {
            console.error('Ошибка создания слота:', error);
        } else {
            created++;
        }
    }
    
    const message = `✅ Создано ${created} слотов\n⏭️ Пропущено (прошло): ${skipped}\n📌 Уже существовало: ${existing}`;
    alert(message);
    
    if (typeof window.app.loadAdminData === 'function') {
        await window.app.loadAdminData();
    }
    
    return created > 0;
};

// --- Функция отображения слота в админке ---
window.app.addSlotElement = function(container, slot, isBlockedByRule = false) {
    const start = utcToMsk(slot.start_time);
    const isAvailable = slot.is_available;
    const isManuallyBlocked = slot.is_blocked === true;
    const isBlocked = !isAvailable || isManuallyBlocked || isBlockedByRule;
    
    const div = document.createElement('div');
    div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: ${isBlocked ? '#f0f0f0' : '#fff'}; border-radius: 8px; border: 1px solid ${isBlocked ? '#ffcccc' : '#e0e0e0'};`;
    
    let statusText = '';
    if (!isAvailable) statusText = '❌ занят';
    else if (isManuallyBlocked) statusText = '🔒 заблокирован';
    else if (isBlockedByRule) statusText = '🔒 заблокирован правилами';
    
    const showUnblockBtn = isBlocked && isAvailable;
    const showBlockBtn = !isBlocked && isAvailable;
    
    div.innerHTML = `
        <span style="${isBlocked ? 'text-decoration: line-through; color: #999;' : ''}">
            ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            ${statusText ? ` ${statusText}` : ''}
        </span>
        <div style="display: flex; gap: 6px;">
            ${showUnblockBtn ? '<button class="unblock-slot-btn" data-id="' + slot.id + '" style="background: #36B647; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">🔓</button>' : ''}
            ${showBlockBtn ? '<button class="block-slot-btn" data-id="' + slot.id + '" style="background: #ff9800; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">🔒</button>' : ''}
        </div>
    `;
    
    const unblockBtn = div.querySelector('.unblock-slot-btn');
    if (unblockBtn) {
        unblockBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Разблокировать слот на ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}?`)) {
                await window.app.sb.from('slots').update({ is_blocked: false }).eq('id', slot.id);
                await window.app.loadAdminData();
            }
        });
    }
    
    const blockBtn = div.querySelector('.block-slot-btn');
    if (blockBtn) {
        blockBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Заблокировать слот на ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}?`)) {
                await window.app.sb.from('slots').update({ is_blocked: true }).eq('id', slot.id);
                await window.app.loadAdminData();
            }
        });
    }
    
    container.appendChild(div);
};

// --- Админ-панель (без автоматической генерации) ---
window.app.loadAdminData = async function() {
    await window.app.loadAdminDataWithoutGenerate();
};

window.app.loadAdminDataWithoutGenerate = async function() {
    if (isRenderingAdmin) {
        console.log('⚠️ Рендер админки уже выполняется, пропускаем');
        return;
    }
    isRenderingAdmin = true;
    
    try {
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
        
        if (adminSlotsDiv && slots) {
            const groupedByDay = {};
            slots.forEach(slot => {
                const date = utcToMsk(slot.start_time);
                const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
                groupedByDay[dayKey].push(slot);
            });
            
            if (Object.keys(groupedByDay).length === 0) {
                adminSlotsDiv.innerHTML = '<p>Нет слотов на ближайшую неделю</p>';
            } else {
                for (let [day, daySlots] of Object.entries(groupedByDay)) {
                    const dayDiv = document.createElement('div');
                    dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
                    
                    const firstSlotDate = utcToMsk(daySlots[0]?.start_time);
                    const dayDateStr = firstSlotDate.toISOString().split('T')[0];
                    
                    dayDiv.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h3 style="margin: 0; font-size: 16px;">📅 ${day}</h3>
                        </div>
                    `;
                    
                    const morning = daySlots.filter(s => utcToMsk(s.start_time).getHours() < 15);
                    const evening = daySlots.filter(s => utcToMsk(s.start_time).getHours() >= 15);
                    
                    if (morning.length > 0) {
                        const morningDiv = document.createElement('div');
                        morningDiv.style.cssText = 'margin-bottom: 15px;';
                        morningDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="font-size: 12px; color: #666;">☀️ Утро</div>
                                <div style="display: flex; gap: 6px;">
                                    <button class="block-morning-btn" data-day="${dayDateStr}" style="background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔒</button>
                                    <button class="unblock-morning-btn" data-day="${dayDateStr}" style="background: #36B647; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔓</button>
                                </div>
                            </div>
                        `;
                        
                        const morningSlotsContainer = document.createElement('div');
                        morning.forEach(slot => {
                            const isBlockedByRule = blockedIds.has(slot.id);
                            window.app.addSlotElement(morningSlotsContainer, slot, isBlockedByRule);
                        });
                        morningDiv.appendChild(morningSlotsContainer);
                        dayDiv.appendChild(morningDiv);
                        
                        const blockMorningBtn = morningDiv.querySelector('.block-morning-btn');
                        const unblockMorningBtn = morningDiv.querySelector('.unblock-morning-btn');
                        
                        if (blockMorningBtn) {
                            blockMorningBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (confirm(`Заблокировать все УТРЕННИЕ слоты на ${day}?`)) {
                                    const targetDate = new Date(dayDateStr);
                                    const dayOfWeek = targetDate.getDay();
                                    const daySchedule = SCHEDULE[dayOfWeek] || SCHEDULE[1];
                                    const morningTimes = daySchedule.morning;
                                    
                                    for (const time of morningTimes) {
                                        const [hours, minutes] = time.split(':');
                                        const slotTimeMSK = new Date(targetDate);
                                        slotTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                        const slotTimeUTC = mskToUtc(slotTimeMSK);
                                        
                                        const { data: existing } = await window.app.sb
                                            .from('slots')
                                            .select('id')
                                            .eq('start_time', slotTimeUTC.toISOString());
                                        
                                        if (existing && existing.length > 0) {
                                            await window.app.sb
                                                .from('slots')
                                                .update({ is_blocked: true })
                                                .eq('start_time', slotTimeUTC.toISOString());
                                        } else {
                                            const endTimeUTC = new Date(slotTimeUTC);
                                            endTimeUTC.setUTCHours(slotTimeUTC.getUTCHours() + 1);
                                            await window.app.sb.from('slots').insert({
                                                start_time: slotTimeUTC.toISOString(),
                                                end_time: endTimeUTC.toISOString(),
                                                is_available: true,
                                                is_blocked: true
                                            });
                                        }
                                    }
                                    await window.app.loadAdminDataWithoutGenerate();
                                    alert('✅ Все утренние слоты заблокированы');
                                }
                            });
                        }
                        
                        if (unblockMorningBtn) {
                            unblockMorningBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (confirm(`Разблокировать все УТРЕННИЕ слоты на ${day}?`)) {
                                    const startMSK = new Date(`${dayDateStr}T00:00:00`);
                                    const endMSK = new Date(`${dayDateStr}T12:00:00`);
                                    const startUTC = mskToUtc(startMSK);
                                    const endUTC = mskToUtc(endMSK);
                                    await window.app.sb
                                        .from('slots')
                                        .update({ is_blocked: false })
                                        .gte('start_time', startUTC.toISOString())
                                        .lt('start_time', endUTC.toISOString());
                                    await window.app.loadAdminDataWithoutGenerate();
                                    alert('✅ Все утренние слоты разблокированы');
                                }
                            });
                        }
                    }
                    
                    if (evening.length > 0) {
                        const eveningDiv = document.createElement('div');
                        eveningDiv.style.cssText = 'margin-top: 15px;';
                        eveningDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="font-size: 12px; color: #666;">🌙 Вечер</div>
                                <div style="display: flex; gap: 6px;">
                                    <button class="block-evening-btn" data-day="${dayDateStr}" style="background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔒</button>
                                    <button class="unblock-evening-btn" data-day="${dayDateStr}" style="background: #36B647; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔓</button>
                                </div>
                            </div>
                        `;
                        
                        const eveningSlotsContainer = document.createElement('div');
                        evening.forEach(slot => {
                            const isBlockedByRule = blockedIds.has(slot.id);
                            window.app.addSlotElement(eveningSlotsContainer, slot, isBlockedByRule);
                        });
                        eveningDiv.appendChild(eveningSlotsContainer);
                        dayDiv.appendChild(eveningDiv);
                        
                        const blockEveningBtn = eveningDiv.querySelector('.block-evening-btn');
                        const unblockEveningBtn = eveningDiv.querySelector('.unblock-evening-btn');
                        
                        if (blockEveningBtn) {
                            blockEveningBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (confirm(`Заблокировать все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                                    const targetDate = new Date(dayDateStr);
                                    const dayOfWeek = targetDate.getDay();
                                    const daySchedule = SCHEDULE[dayOfWeek] || SCHEDULE[1];
                                    const eveningTimes = daySchedule.evening;
                                    
                                    for (const time of eveningTimes) {
                                        const [hours, minutes] = time.split(':');
                                        const slotTimeMSK = new Date(targetDate);
                                        slotTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                        const slotTimeUTC = mskToUtc(slotTimeMSK);
                                        
                                        const { data: existing } = await window.app.sb
                                            .from('slots')
                                            .select('id')
                                            .eq('start_time', slotTimeUTC.toISOString());
                                        
                                        if (existing && existing.length > 0) {
                                            await window.app.sb
                                                .from('slots')
                                                .update({ is_blocked: true })
                                                .eq('start_time', slotTimeUTC.toISOString());
                                        } else {
                                            const endTimeUTC = new Date(slotTimeUTC);
                                            endTimeUTC.setUTCHours(slotTimeUTC.getUTCHours() + 1);
                                            await window.app.sb.from('slots').insert({
                                                start_time: slotTimeUTC.toISOString(),
                                                end_time: endTimeUTC.toISOString(),
                                                is_available: true,
                                                is_blocked: true
                                            });
                                        }
                                    }
                                    await window.app.loadAdminDataWithoutGenerate();
                                    alert('✅ Все вечерние слоты заблокированы');
                                }
                            });
                        }
                        
                        if (unblockEveningBtn) {
                            unblockEveningBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (confirm(`Разблокировать все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                                    const startMSK = new Date(`${dayDateStr}T12:00:00`);
                                    const endMSK = new Date(`${dayDateStr}T23:59:59`);
                                    const startUTC = mskToUtc(startMSK);
                                    const endUTC = mskToUtc(endMSK);
                                    await window.app.sb
                                        .from('slots')
                                        .update({ is_blocked: false })
                                        .gte('start_time', startUTC.toISOString())
                                        .lt('start_time', endUTC.toISOString());
                                    await window.app.loadAdminDataWithoutGenerate();
                                    alert('✅ Все вечерние слоты разблокированы');
                                }
                            });
                        }
                    }
                    
                    adminSlotsDiv.appendChild(dayDiv);
                }
            }
        }
        
        // --- Все записи ---
        if (adminBookingsDiv) {
            const title = document.createElement('h3');
            title.textContent = 'Все записи';
            adminBookingsDiv.appendChild(title);
            
            const { data: bookings } = await window.app.sb.rpc('get_bookings_with_profiles');
            
            if (bookings && bookings.length > 0) {
                const groupedByDay = {};
                bookings.forEach(booking => {
                    const date = utcToMsk(booking.start_time);
                    const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                    if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
                    groupedByDay[dayKey].push(booking);
                });
                
                const sortedDays = Object.keys(groupedByDay).sort((a, b) => {
                    const dateA = new Date(a.split(',')[1] + ' ' + a.split(',')[0]);
                    const dateB = new Date(b.split(',')[1] + ' ' + b.split(',')[0]);
                    return dateA - dateB;
                });
                
                for (let day of sortedDays) {
                    const dayBookings = groupedByDay[day];
                    const dayDiv = document.createElement('div');
                    dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
                    dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
                    
                    const morning = dayBookings.filter(b => utcToMsk(b.start_time).getHours() < 15);
                    const evening = dayBookings.filter(b => utcToMsk(b.start_time).getHours() >= 15);
                    
                    if (morning.length > 0) {
                        const morningDiv = document.createElement('div');
                        morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
                        morning.forEach(booking => {
                            const timeStr = utcToMsk(booking.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                            const bookingDiv = document.createElement('div');
                            bookingDiv.style.cssText = 'border:1px solid #ddd; margin:8px 0; padding:10px; border-radius:8px; background:#f9f9f9; display: flex; justify-content: space-between; align-items: center;';
                            bookingDiv.innerHTML = `
                                <div>
                                    <strong>${booking.name || 'Неизвестно'}</strong><br>
                                    📞 ${booking.phone || 'нет телефона'}<br>
                                    🕐 ${timeStr}
                                </div>
                                <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                            `;
                            const delBtn = bookingDiv.querySelector('.delete-booking-btn');
                            if (delBtn) {
                                delBtn.addEventListener('click', async () => {
                                    if (confirm('Удалить эту запись?')) {
                                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                                        await window.app.loadAdminDataWithoutGenerate();
                                    }
                                });
                            }
                            morningDiv.appendChild(bookingDiv);
                        });
                        dayDiv.appendChild(morningDiv);
                    }
                    
                    if (evening.length > 0) {
                        const eveningDiv = document.createElement('div');
                        eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
                        evening.forEach(booking => {
                            const timeStr = utcToMsk(booking.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                            const bookingDiv = document.createElement('div');
                            bookingDiv.style.cssText = 'border:1px solid #ddd; margin:8px 0; padding:10px; border-radius:8px; background:#f9f9f9; display: flex; justify-content: space-between; align-items: center;';
                            bookingDiv.innerHTML = `
                                <div>
                                    <strong>${booking.name || 'Неизвестно'}</strong><br>
                                    📞 ${booking.phone || 'нет телефона'}<br>
                                    🕐 ${timeStr}
                                </div>
                                <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                            `;
                            const delBtn = bookingDiv.querySelector('.delete-booking-btn');
                            if (delBtn) {
                                delBtn.addEventListener('click', async () => {
                                    if (confirm('Удалить эту запись?')) {
                                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                                        await window.app.loadAdminDataWithoutGenerate();
                                    }
                                });
                            }
                            eveningDiv.appendChild(bookingDiv);
                        });
                        dayDiv.appendChild(eveningDiv);
                    }
                    
                    adminBookingsDiv.appendChild(dayDiv);
                }
            } else {
                const noBookings = document.createElement('p');
                noBookings.textContent = 'Нет записей';
                adminBookingsDiv.appendChild(noBookings);
            }
        }
    } finally {
        isRenderingAdmin = false;
    }
};

// --- Переключение между вкладками ---
window.app.setupAdminTabs = function() {
    const slotsTab = document.getElementById('admin-slots-tab');
    const clientsTab = document.getElementById('admin-clients-tab');
    const slotsPanel = document.getElementById('admin-slots-panel');
    const clientsPanel = document.getElementById('admin-clients-panel');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (!slotsTab || !clientsTab) return;
    
    const newSlotsTab = slotsTab.cloneNode(true);
    const newClientsTab = clientsTab.cloneNode(true);
    slotsTab.parentNode.replaceChild(newSlotsTab, slotsTab);
    clientsTab.parentNode.replaceChild(newClientsTab, clientsTab);
    
    newSlotsTab.addEventListener('click', () => {
        newSlotsTab.style.background = '#36B647';
        newSlotsTab.style.color = 'white';
        newClientsTab.style.background = '#f0f0f0';
        newClientsTab.style.color = '#323338';
        slotsPanel.style.display = 'block';
        clientsPanel.style.display = 'none';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'block';
    });
    
    newClientsTab.addEventListener('click', async () => {
        newClientsTab.style.background = '#36B647';
        newClientsTab.style.color = 'white';
        newSlotsTab.style.background = '#f0f0f0';
        newSlotsTab.style.color = '#323338';
        slotsPanel.style.display = 'none';
        clientsPanel.style.display = 'block';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'none';
        
        if (typeof window.app.renderClientsList === 'function') {
            await window.app.renderClientsList();
        }
    });
};
