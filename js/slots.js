// ============================================
// МОДУЛЬ СЛОТОВ (ФИНАЛЬНАЯ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
// ============================================

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

let isRenderingAdmin = false;
let isGenerating = false;

// --- Функция повторных попыток при ошибках сети ---
async function fetchWithRetry(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

// --- ОПТИМИЗИРОВАННАЯ версия getBlockedSlotIds (быстрая, правильная) ---
window.app.getBlockedSlotIds = async function() {
    const blockedIds = new Set();
    
    // 1. Ручные блокировки
    const { data: manuallyBlocked } = await window.app.sb
        .from('slots')
        .select('id')
        .eq('is_blocked', true);
    manuallyBlocked?.forEach(slot => blockedIds.add(slot.id));
    
    // 2. Получаем занятые слоты
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 14);
    
    const [bookedResult, allResult] = await Promise.all([
        window.app.sb.from('slots').select('id, start_time').eq('is_available', false).gte('start_time', today.toISOString()).lte('start_time', endDate.toISOString()),
        window.app.sb.from('slots').select('id, start_time').gte('start_time', today.toISOString()).lte('start_time', endDate.toISOString())
    ]);
    
    const bookedSlots = bookedResult.data || [];
    const allSlots = allResult.data || [];
    
    if (bookedSlots.length === 0) return blockedIds;
    
    // Группируем слоты по дням (в UTC) через Map
    const slotsByDay = new Map();
    allSlots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toISOString().split('T')[0];
        const timeValue = date.getUTCHours() + date.getUTCMinutes() / 60;
        if (!slotsByDay.has(dayKey)) slotsByDay.set(dayKey, []);
        slotsByDay.get(dayKey).push({ id: slot.id, timeValue });
    });
    
    // Блокируем соседние слоты (разница < 60 минут)
    for (let booked of bookedSlots) {
        const bookedDate = new Date(booked.start_time);
        const dayKey = bookedDate.toISOString().split('T')[0];
        const bookedTime = bookedDate.getUTCHours() + bookedDate.getUTCMinutes() / 60;
        
        const daySlots = slotsByDay.get(dayKey);
        if (!daySlots) continue;
        
        daySlots.forEach(slot => {
            if (slot.id !== booked.id && Math.abs(slot.timeValue - bookedTime) < 1) {
                blockedIds.add(slot.id);
            }
        });
    }
    
    return blockedIds;
};

// --- Загрузка свободных слотов для клиента (с retry) ---
window.app.loadSlots = async function() {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    const { data: slots, error } = await fetchWithRetry(() =>
        window.app.sb
            .from('slots')
            .select('*')
            .eq('is_available', true)
            .eq('is_blocked', false)
            .gte('start_time', today.toISOString())
            .lte('start_time', endDate.toISOString())
            .order('start_time')
    );
    
    if (error) throw error;
    
    const blockedIds = await window.app.getBlockedSlotIds();
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
    
    const { data: allSlots } = await window.app.sb
        .from('slots')
        .select('start_time, is_available')
        .gte('start_time', new Date().toISOString())
        .lte('start_time', new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString());
    
    const bookedTimesByDay = {};
    (allSlots || []).forEach(slot => {
        if (!slot.is_available) {
            const date = window.app.utcToMsk(slot.start_time);
            const dayKey = date.toLocaleDateString('ru-RU');
            const timeStr = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            if (!bookedTimesByDay[dayKey]) bookedTimesByDay[dayKey] = [];
            bookedTimesByDay[dayKey].push(timeStr);
        }
    });
    
    function hasAdjacentBooking(dayKey, timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const currentMinutes = hours * 60 + minutes;
        const bookedTimes = bookedTimesByDay[dayKey] || [];
        
        for (const adjMin of [currentMinutes - 60, currentMinutes + 60]) {
            if (adjMin < 0) continue;
            const adjHour = Math.floor(adjMin / 60);
            const adjMinute = adjMin % 60;
            if (adjHour > 23) continue;
            const adjTimeStr = `${adjHour.toString().padStart(2,'0')}:${adjMinute.toString().padStart(2,'0')}`;
            if (bookedTimes.includes(adjTimeStr)) return true;
        }
        return false;
    }
    
    const groupedByDay = {};
    slots.forEach(slot => {
        const date = window.app.utcToMsk(slot.start_time);
        const displayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        const dayKey = date.toLocaleDateString('ru-RU');
        if (!groupedByDay[displayKey]) groupedByDay[displayKey] = { slots: [], dayKey };
        groupedByDay[displayKey].slots.push(slot);
    });
    
    for (let [displayDay, dayData] of Object.entries(groupedByDay)) {
        const daySlots = dayData.slots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        const morning = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${displayDay}</h3>`;
        
        if (morning.length) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            morning.forEach(slot => {
                const start = window.app.utcToMsk(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const hasAdjacent = hasAdjacentBooking(dayData.dayKey, timeStr);
                const slotDiv = document.createElement('div');
                if (window.app.selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: ${hasAdjacent ? '#e8f5e9' : '#f8f9fa'}; border-radius: 12px; border: 1px solid ${hasAdjacent ? '#36B647' : '#e9ecef'};`;
                slotDiv.innerHTML = `<div><span style="font-weight: 500;">${timeStr}</span>${hasAdjacent ? '<span style="background: #36B647; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>' : ''}</div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${window.app.selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">`;
                slotDiv.querySelector('.slot-select').addEventListener('change', (e) => {
                    if (e.target.checked) window.app.selectedSlotIds.add(slot.id);
                    else window.app.selectedSlotIds.delete(slot.id);
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = window.app.selectedSlotIds.size ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${window.app.selectedSlotIds.size})`;
                    }
                });
                morningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(morningDiv);
        }
        
        if (evening.length) {
            const eveningDiv = document.createElement('div');
            eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
            evening.forEach(slot => {
                const start = window.app.utcToMsk(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const hasAdjacent = hasAdjacentBooking(dayData.dayKey, timeStr);
                const slotDiv = document.createElement('div');
                if (window.app.selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: ${hasAdjacent ? '#e8f5e9' : '#f8f9fa'}; border-radius: 12px; border: 1px solid ${hasAdjacent ? '#36B647' : '#e9ecef'};`;
                slotDiv.innerHTML = `<div><span style="font-weight: 500;">${timeStr}</span>${hasAdjacent ? '<span style="background: #36B647; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>' : ''}</div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${window.app.selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">`;
                slotDiv.querySelector('.slot-select').addEventListener('change', (e) => {
                    if (e.target.checked) window.app.selectedSlotIds.add(slot.id);
                    else window.app.selectedSlotIds.delete(slot.id);
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = window.app.selectedSlotIds.size ? 'block' : 'none';
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
    if (!window.app.selectedSlotIds.size) return alert('Выберите слоты для записи');
    
    const selectedIds = Array.from(window.app.selectedSlotIds);
    const blockedIds = await window.app.getBlockedSlotIds();
    if (selectedIds.some(id => blockedIds.has(id))) {
        alert('Некоторые выбранные слоты стали недоступны. Обновите страницу.');
        window.app.selectedSlotIds.clear();
        const slots = await window.app.loadSlots();
        await window.app.renderSlots(slots);
        return;
    }
    
    const { error } = await window.app.sb.from('bookings').insert(selectedIds.map(slotId => ({ slot_id: slotId, user_id: window.app.currentUser.id })));
    if (error) return alert('Ошибка записи: ' + error.message);
    
    for (let slotId of selectedIds) await window.app.sb.from('slots').update({ is_available: false }).eq('id', slotId);
    alert('Успешно записано!');
    window.app.selectedSlotIds.clear();
    window.app.showScreen('menu');
};

// --- Мои записи ---
window.app.loadMyBookings = async function() {
    const { data: bookings } = await window.app.sb.from('bookings').select('id, slot_id, slots(start_time, end_time)').eq('user_id', window.app.currentUser.id);
    const container = document.getElementById('my-bookings-list');
    if (!container) return;
    container.innerHTML = '';
    if (!bookings?.length) { container.innerHTML = '<p style="text-align:center;padding:20px;">У вас нет записей</p>'; return; }
    
    const groupedByDay = {};
    bookings.forEach(booking => {
        const date = window.app.utcToMsk(booking.slots.start_time);
        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
        groupedByDay[dayKey].push(booking);
    });
    
    for (let [day, dayBookings] of Object.entries(groupedByDay)) {
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom:20px;border-left:3px solid #36B647;padding-left:12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom:10px;">📅 ${day}</h3>`;
        dayBookings.forEach(booking => {
            const start = window.app.utcToMsk(booking.slots.start_time);
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8f9fa;border-radius:12px;margin-bottom:8px;';
            div.innerHTML = `<span>${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <button class="cancel-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background:#dc3545;color:white;border:none;padding:8px 16px;border-radius:20px;">Отменить</button>`;
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
    
    if (typeof window.app.showScreen === 'function') {
        window.app.showScreen('myBookings');
    } else {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('myBookings-screen')?.classList.add('active');
    }
};

// --- Ручная генерация слотов на день и половинку ---
window.app.generateSlotsForDay = async function(dateStr, half) {
    if (!dateStr) { alert('Выберите дату'); return false; }
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) { alert('Выберите корректную дату'); return false; }
    const dayOfWeek = targetDate.getDay();
    const daySchedule = SCHEDULE[dayOfWeek] || SCHEDULE[1];
    const times = half === 'morning' ? daySchedule.morning : daySchedule.evening;
    if (!times.length) { alert(`На ${half === 'morning' ? 'утро' : 'вечер'} этого дня нет расписания`); return false; }
    
    let created = 0, skipped = 0, existing = 0;
    const nowMSK = window.app.getNowMSK();
    for (const time of times) {
        const [hours, minutes] = time.split(':');
        const startTimeMSK = new Date(targetDate);
        startTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        if (startTimeMSK < nowMSK) { skipped++; continue; }
        const startTimeUTC = window.app.mskToUtc(startTimeMSK);
        const { data: existingSlot } = await window.app.sb.from('slots').select('id').eq('start_time', startTimeUTC.toISOString()).maybeSingle();
        if (existingSlot) { existing++; continue; }
        const endTimeUTC = new Date(startTimeUTC);
        endTimeUTC.setUTCHours(startTimeUTC.getUTCHours() + 1);
        await window.app.sb.from('slots').insert({ start_time: startTimeUTC.toISOString(), end_time: endTimeUTC.toISOString(), is_available: true, is_blocked: false });
        created++;
    }
    alert(`✅ Создано ${created} слотов\n⏭️ Пропущено (прошло): ${skipped}\n📌 Уже существовало: ${existing}`);
    if (typeof window.app.loadAdminData === 'function') await window.app.loadAdminData();
    return created > 0;
};

// --- Генерация всей недели ---
window.app.generateFullWeek = async function() {
    if (isGenerating) { alert('Генерация уже выполняется...'); return; }
    isGenerating = true;
    const today = new Date();
    const currentDay = today.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    let totalCreated = 0;
    for (let i = 0; i < 6; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0) continue;
        const daySchedule = SCHEDULE[dayOfWeek] || SCHEDULE[1];
        if (daySchedule.morning.length) totalCreated += (await window.app.generateSlotsForDay(dateStr, 'morning')) ? 1 : 0;
        if (daySchedule.evening.length) totalCreated += (await window.app.generateSlotsForDay(dateStr, 'evening')) ? 1 : 0;
    }
    isGenerating = false;
    alert(`✅ Генерация недели завершена!`);
    if (typeof window.app.loadAdminData === 'function') await window.app.loadAdminData();
};

// --- Отображение слота в админке ---
window.app.addSlotElement = function(container, slot, isBlockedByRule = false) {
    const start = window.app.utcToMsk(slot.start_time);
    const isAvailable = slot.is_available;
    const isManuallyBlocked = slot.is_blocked === true;
    const isBlocked = !isAvailable || isManuallyBlocked || isBlockedByRule;
    let statusText = '';
    if (!isAvailable) statusText = '❌ занят';
    else if (isManuallyBlocked) statusText = '🔒 заблокирован';
    else if (isBlockedByRule) statusText = '🔒 заблокирован правилами';
    const showUnblockBtn = isBlocked && isAvailable;
    const showBlockBtn = !isBlocked && isAvailable;
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:${isBlocked ? '#f0f0f0' : '#fff'};border-radius:8px;border:1px solid ${isBlocked ? '#ffcccc' : '#e0e0e0'};`;
    div.innerHTML = `<span style="${isBlocked ? 'text-decoration:line-through;color:#999;' : ''}">${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} ${statusText}</span>
        <div style="display:flex;gap:6px;">
            ${showUnblockBtn ? '<button class="unblock-slot-btn" data-id="' + slot.id + '" style="background:#36B647;color:white;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;">🔓</button>' : ''}
            ${showBlockBtn ? '<button class="block-slot-btn" data-id="' + slot.id + '" style="background:#ff9800;color:white;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;">🔒</button>' : ''}
        </div>`;
    div.querySelector('.unblock-slot-btn')?.addEventListener('click', async () => {
        if (confirm(`Разблокировать слот на ${start.toLocaleTimeString()}?`)) {
            await window.app.sb.from('slots').update({ is_blocked: false }).eq('id', slot.id);
            await window.app.loadAdminData();
        }
    });
    div.querySelector('.block-slot-btn')?.addEventListener('click', async () => {
        if (confirm(`Заблокировать слот на ${start.toLocaleTimeString()}?`)) {
            await window.app.sb.from('slots').update({ is_blocked: true }).eq('id', slot.id);
            await window.app.loadAdminData();
        }
    });
    container.appendChild(div);
};

// --- Админ-панель ---
window.app.loadAdminData = async function() {
    await window.app.loadAdminDataWithoutGenerate();
};

window.app.loadAdminDataWithoutGenerate = async function() {
    if (isRenderingAdmin) return;
    isRenderingAdmin = true;
    
    try {
        const adminSlotsDiv = document.getElementById('admin-slots');
        const adminBookingsDiv = document.getElementById('admin-bookings');
        
        const todayStartUTC = new Date();
        todayStartUTC.setUTCHours(0, 0, 0, 0);
        const endDateUTC = new Date(todayStartUTC);
        endDateUTC.setUTCDate(todayStartUTC.getUTCDate() + 8);
        
        const [slotsResult, bookingsResult] = await Promise.all([
            window.app.sb
                .from('slots')
                .select('*')
                .gte('start_time', todayStartUTC.toISOString())
                .lte('start_time', endDateUTC.toISOString())
                .order('start_time'),
            window.app.sb
                .from('bookings')
                .select(`
                    id,
                    slot_id,
                    user_id,
                    created_at,
                    slots!fk_bookings_slot_id (start_time, end_time),
                    profiles!fk_bookings_user_id (name, phone)
                `)
                .gte('slots.start_time', todayStartUTC.toISOString())
        ]);
        
        const slots = slotsResult.data || [];
        const bookings = bookingsResult.data || [];
        const blockedIds = await window.app.getBlockedSlotIds();
        
        if (adminSlotsDiv) {
            if (slots.length === 0) {
                adminSlotsDiv.innerHTML = '<p>Нет слотов на ближайшую неделю</p>';
            } else {
                adminSlotsDiv.innerHTML = '';
                const groupedByDay = {};
                slots.forEach(slot => {
                    const date = window.app.utcToMsk(slot.start_time);
                    const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                    if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
                    groupedByDay[dayKey].push(slot);
                });
                
                for (let [day, daySlots] of Object.entries(groupedByDay)) {
                    const dayDiv = document.createElement('div');
                    dayDiv.style.cssText = 'margin-bottom:20px;border-left:3px solid #36B647;padding-left:12px;';
                    const firstSlotDate = window.app.utcToMsk(daySlots[0]?.start_time);
                    const dayDateStr = firstSlotDate.toISOString().split('T')[0];
                    dayDiv.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><h3 style="margin:0;">📅 ${day}</h3></div>`;
                    
                    const morning = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() < 15);
                    const evening = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() >= 15);
                    
                    if (morning.length) {
                        const morningDiv = document.createElement('div');
                        morningDiv.style.cssText = 'margin-bottom:15px;';
                        morningDiv.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div style="font-size:12px;color:#666;">☀️ Утро</div>
                            <div style="display:flex;gap:6px;"><button class="block-morning-btn" data-day="${dayDateStr}" style="background:#ff9800;color:white;border:none;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;">🔒</button>
                            <button class="unblock-morning-btn" data-day="${dayDateStr}" style="background:#36B647;color:white;border:none;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;">🔓</button></div></div>`;
                        const morningSlotsContainer = document.createElement('div');
                        morning.forEach(slot => window.app.addSlotElement(morningSlotsContainer, slot, blockedIds.has(slot.id)));
                        morningDiv.appendChild(morningSlotsContainer);
                        dayDiv.appendChild(morningDiv);
                        
                        morningDiv.querySelector('.block-morning-btn')?.addEventListener('click', async () => {
                            if (confirm(`Заблокировать все УТРЕННИЕ слоты на ${day}?`)) {
                                const targetDate = new Date(dayDateStr);
                                const dayOfWeek = targetDate.getDay();
                                const morningTimes = (SCHEDULE[dayOfWeek] || SCHEDULE[1]).morning;
                                for (const time of morningTimes) {
                                    const [hours, minutes] = time.split(':');
                                    const slotTimeMSK = new Date(targetDate);
                                    slotTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const slotTimeUTC = window.app.mskToUtc(slotTimeMSK);
                                    const { data: existing } = await window.app.sb.from('slots').select('id').eq('start_time', slotTimeUTC.toISOString());
                                    if (existing?.length) await window.app.sb.from('slots').update({ is_blocked: true }).eq('start_time', slotTimeUTC.toISOString());
                                    else await window.app.sb.from('slots').insert({ start_time: slotTimeUTC.toISOString(), end_time: new Date(slotTimeUTC.getTime() + 3600000).toISOString(), is_available: true, is_blocked: true });
                                }
                                await window.app.loadAdminDataWithoutGenerate();
                                alert('✅ Все утренние слоты заблокированы');
                            }
                        });
                        morningDiv.querySelector('.unblock-morning-btn')?.addEventListener('click', async () => {
                            if (confirm(`Разблокировать все УТРЕННИЕ слоты на ${day}?`)) {
                                const startUTC = window.app.mskToUtc(new Date(`${dayDateStr}T00:00:00`));
                                const endUTC = window.app.mskToUtc(new Date(`${dayDateStr}T12:00:00`));
                                await window.app.sb.from('slots').update({ is_blocked: false }).gte('start_time', startUTC.toISOString()).lt('start_time', endUTC.toISOString());
                                await window.app.loadAdminDataWithoutGenerate();
                                alert('✅ Все утренние слоты разблокированы');
                            }
                        });
                    }
                    
                    if (evening.length) {
                        const eveningDiv = document.createElement('div');
                        eveningDiv.style.cssText = 'margin-top:15px;';
                        eveningDiv.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div style="font-size:12px;color:#666;">🌙 Вечер</div>
                            <div style="display:flex;gap:6px;"><button class="block-evening-btn" data-day="${dayDateStr}" style="background:#ff9800;color:white;border:none;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;">🔒</button>
                            <button class="unblock-evening-btn" data-day="${dayDateStr}" style="background:#36B647;color:white;border:none;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer;">🔓</button></div></div>`;
                        const eveningSlotsContainer = document.createElement('div');
                        evening.forEach(slot => window.app.addSlotElement(eveningSlotsContainer, slot, blockedIds.has(slot.id)));
                        eveningDiv.appendChild(eveningSlotsContainer);
                        dayDiv.appendChild(eveningDiv);
                        
                        eveningDiv.querySelector('.block-evening-btn')?.addEventListener('click', async () => {
                            if (confirm(`Заблокировать все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                                const targetDate = new Date(dayDateStr);
                                const dayOfWeek = targetDate.getDay();
                                const eveningTimes = (SCHEDULE[dayOfWeek] || SCHEDULE[1]).evening;
                                for (const time of eveningTimes) {
                                    const [hours, minutes] = time.split(':');
                                    const slotTimeMSK = new Date(targetDate);
                                    slotTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const slotTimeUTC = window.app.mskToUtc(slotTimeMSK);
                                    const { data: existing } = await window.app.sb.from('slots').select('id').eq('start_time', slotTimeUTC.toISOString());
                                    if (existing?.length) await window.app.sb.from('slots').update({ is_blocked: true }).eq('start_time', slotTimeUTC.toISOString());
                                    else await window.app.sb.from('slots').insert({ start_time: slotTimeUTC.toISOString(), end_time: new Date(slotTimeUTC.getTime() + 3600000).toISOString(), is_available: true, is_blocked: true });
                                }
                                await window.app.loadAdminDataWithoutGenerate();
                                alert('✅ Все вечерние слоты заблокированы');
                            }
                        });
                        eveningDiv.querySelector('.unblock-evening-btn')?.addEventListener('click', async () => {
                            if (confirm(`Разблокировать все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                                const startUTC = window.app.mskToUtc(new Date(`${dayDateStr}T12:00:00`));
                                const endUTC = window.app.mskToUtc(new Date(`${dayDateStr}T23:59:59`));
                                await window.app.sb.from('slots').update({ is_blocked: false }).gte('start_time', startUTC.toISOString()).lt('start_time', endUTC.toISOString());
                                await window.app.loadAdminDataWithoutGenerate();
                                alert('✅ Все вечерние слоты разблокированы');
                            }
                        });
                    }
                    adminSlotsDiv.appendChild(dayDiv);
                }
            }
        }
        
        if (adminBookingsDiv) {
            if (!bookings || bookings.length === 0) {
                adminBookingsDiv.innerHTML = '<h3>Все записи</h3><p>Нет предстоящих записей</p>';
            } else {
                adminBookingsDiv.innerHTML = '<h3>Все записи</h3>';
                const validBookings = bookings.filter(booking => booking && booking.slots && booking.slots.start_time);
                
                if (validBookings.length === 0) {
                    adminBookingsDiv.innerHTML += '<p>Нет записей с существующими слотами</p>';
                } else {
                    validBookings.sort((a, b) => {
                        const timeA = window.app.utcToMsk(a.slots.start_time);
                        const timeB = window.app.utcToMsk(b.slots.start_time);
                        return timeA - timeB;
                    });
                    
                    const groupedByDay = {};
                    validBookings.forEach(booking => {
                        const date = window.app.utcToMsk(booking.slots.start_time);
                        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
                        groupedByDay[dayKey].push(booking);
                    });
                    
                    for (let [day, dayBookings] of Object.entries(groupedByDay)) {
                        const dayDiv = document.createElement('div');
                        dayDiv.style.cssText = 'margin-bottom:20px;border-left:3px solid #36B647;padding-left:12px;';
                        dayDiv.innerHTML = `<h3 style="margin-bottom:10px;">📅 ${day}</h3>`;
                        
                        const morning = dayBookings.filter(b => window.app.utcToMsk(b.slots.start_time).getHours() < 15);
                        const evening = dayBookings.filter(b => window.app.utcToMsk(b.slots.start_time).getHours() >= 15);
                        
                        if (morning.length) {
                            const morningDiv = document.createElement('div');
                            morningDiv.innerHTML = '<div style="font-size:12px;color:#666;margin-bottom:5px;">☀️ Утро</div>';
                            morning.forEach(booking => {
                                const timeStr = window.app.utcToMsk(booking.slots.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                                const profile = booking.profiles || {};
                                const bookingDiv = document.createElement('div');
                                bookingDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px;margin-bottom:8px;background:#f9f9f9;border-radius:8px;';
                                bookingDiv.innerHTML = `<div><strong>${profile.name || 'Неизвестно'}</strong><br>📞 ${profile.phone || 'нет телефона'}<br>🕐 ${timeStr}</div>
                                    <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background:#dc3545;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;margin-left:10px;">✖ Удалить</button>`;
                                bookingDiv.querySelector('.delete-booking-btn').addEventListener('click', async () => {
                                    if (confirm('Удалить эту запись?')) {
                                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                                        await window.app.loadAdminDataWithoutGenerate();
                                    }
                                });
                                morningDiv.appendChild(bookingDiv);
                            });
                            dayDiv.appendChild(morningDiv);
                        }
                        
                        if (evening.length) {
                            const eveningDiv = document.createElement('div');
                            eveningDiv.innerHTML = '<div style="font-size:12px;color:#666;margin:10px 0 5px;">🌙 Вечер</div>';
                            evening.forEach(booking => {
                                const timeStr = window.app.utcToMsk(booking.slots.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                                const profile = booking.profiles || {};
                                const bookingDiv = document.createElement('div');
                                bookingDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px;margin-bottom:8px;background:#f9f9f9;border-radius:8px;';
                                bookingDiv.innerHTML = `<div><strong>${profile.name || 'Неизвестно'}</strong><br>📞 ${profile.phone || 'нет телефона'}<br>🕐 ${timeStr}</div>
                                    <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background:#dc3545;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;margin-left:10px;">✖ Удалить</button>`;
                                bookingDiv.querySelector('.delete-booking-btn').addEventListener('click', async () => {
                                    if (confirm('Удалить эту запись?')) {
                                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                                        await window.app.loadAdminDataWithoutGenerate();
                                    }
                                });
                                eveningDiv.appendChild(bookingDiv);
                            });
                            dayDiv.appendChild(eveningDiv);
                        }
                        adminBookingsDiv.appendChild(dayDiv);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки админ-панели:', error);
        const adminSlotsDiv = document.getElementById('admin-slots');
        if (adminSlotsDiv) adminSlotsDiv.innerHTML = '<p>Ошибка загрузки. Попробуйте обновить страницу.</p>';
        const adminBookingsDiv = document.getElementById('admin-bookings');
        if (adminBookingsDiv) adminBookingsDiv.innerHTML = '<h3>Все записи</h3><p>Ошибка загрузки записей</p>';
    } finally {
        isRenderingAdmin = false;
    }
};

// --- Переключение между вкладками в админке ---
window.app.setupAdminTabs = function() {
    console.log('🔵 setupAdminTabs вызвана');
    
    const slotsTab = document.getElementById('admin-slots-tab');
    const clientsTab = document.getElementById('admin-clients-tab');
    const slotsPanel = document.getElementById('admin-slots-panel');
    const clientsPanel = document.getElementById('admin-clients-panel');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (!slotsTab || !clientsTab) {
        console.error('🔴 Вкладки не найдены');
        return;
    }
    
    const newSlotsTab = slotsTab.cloneNode(true);
    const newClientsTab = clientsTab.cloneNode(true);
    slotsTab.parentNode.replaceChild(newSlotsTab, slotsTab);
    clientsTab.parentNode.replaceChild(newClientsTab, clientsTab);
    
    newSlotsTab.addEventListener('click', () => {
        console.log('🔵 Нажата вкладка Слоты');
        newSlotsTab.style.background = '#36B647';
        newSlotsTab.style.color = 'white';
        newClientsTab.style.background = '#f0f0f0';
        newClientsTab.style.color = '#323338';
        slotsPanel.style.display = 'block';
        clientsPanel.style.display = 'none';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'block';
    });
    
    newClientsTab.addEventListener('click', async () => {
        console.log('🔵 Нажата вкладка Клиенты');
        newClientsTab.style.background = '#36B647';
        newClientsTab.style.color = 'white';
        newSlotsTab.style.background = '#f0f0f0';
        newSlotsTab.style.color = '#323338';
        slotsPanel.style.display = 'none';
        clientsPanel.style.display = 'block';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'none';
        
        if (typeof window.app.renderClientsList === 'function') {
            await window.app.renderClientsList();
            console.log('🔵 renderClientsList выполнена');
        } else {
            console.error('🔴 renderClientsList не определена');
            clientsPanel.innerHTML = '<p style="padding:20px;text-align:center;">Ошибка: функция не загружена</p>';
        }
    });
    
    console.log('🔵 setupAdminTabs завершена');
};
