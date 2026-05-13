// ============================================
// МОДУЛЬ СЛОТОВ (ЗАПИСЬ, ГЕНЕРАЦИЯ, БЛОКИРОВКА)
// ============================================

// --- Получение списка заблокированных слотов (только соседние) ---
async function getBlockedSlotIds() {
    const blockedIds = new Set();
    
    // 1. Слоты, заблокированные вручную
    const { data: manuallyBlocked } = await window.app.sb
        .from('slots')
        .select('id')
        .eq('is_blocked', true);
    manuallyBlocked?.forEach(slot => blockedIds.add(slot.id));
    
    // 2. Получаем занятые слоты
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
    
    // 3. Получаем все слоты для поиска соседних
    const { data: allSlots } = await window.app.sb
        .from('slots')
        .select('id, start_time')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    if (!allSlots) return blockedIds;
    
    // Создаём Map для быстрого поиска по времени
    const slotTimeMap = new Map();
    allSlots.forEach(slot => {
        const time = new Date(slot.start_time).getTime();
        slotTimeMap.set(time, slot.id);
    });
    
    // Блокируем соседние слоты (±30 минут)
    const halfHour = 30 * 60 * 1000;
    bookedSlots.forEach(booked => {
        const bookedTime = new Date(booked.start_time).getTime();
        
        const prevId = slotTimeMap.get(bookedTime - halfHour);
        const nextId = slotTimeMap.get(bookedTime + halfHour);
        
        if (prevId) blockedIds.add(prevId);
        if (nextId) blockedIds.add(nextId);
    });
    
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

// --- Отображение слотов для клиента (с рекомендациями) ---
window.app.renderSlots = async function(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет свободных слотов</p>';
        return;
    }
    
    // Получаем занятые слоты для определения рекомендаций
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
    
    // Функция проверки, есть ли занятой слот рядом
    function hasAdjacentBooking(dayKey, timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    const bookedTimes = bookedTimesByDay[dayKey] || [];
    
    // Проверяем занятость соседних слотов (±30 минут)
    for (const adjMin of [currentMinutes - 30, currentMinutes + 30]) {
        if (adjMin < 0) continue;
        const adjHour = Math.floor(adjMin / 60);
        const adjMinute = adjMin % 60;
        if (adjHour > 23) continue;
        const adjTimeStr = `${adjHour.toString().padStart(2,'0')}:${adjMinute.toString().padStart(2,'0')}`;
        if (bookedTimes.includes(adjTimeStr)) return true;
    }
    return false;
}
    
    // Группируем по дням
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
                slotDiv.innerHTML = `
                    <div>
                        <span style="font-weight: 500;">${timeStr}</span>
                        ${hasAdjacent ? '<span style="background: #36B647; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>' : ''}
                    </div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${window.app.selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                const cb = slotDiv.querySelector('.slot-select');
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        window.app.selectedSlotIds.add(slot.id);
                    } else {
                        window.app.selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    const countSpan = document.getElementById('selected-count');
                    if (confirmBtn && countSpan) {
                        const count = window.app.selectedSlotIds.size;
                        confirmBtn.style.display = count > 0 ? 'block' : 'none';
                        countSpan.textContent = count;
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
                slotDiv.innerHTML = `
                    <div>
                        <span style="font-weight: 500;">${timeStr}</span>
                        ${hasAdjacent ? '<span style="background: #36B647; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>' : ''}
                    </div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${window.app.selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                const cb = slotDiv.querySelector('.slot-select');
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        window.app.selectedSlotIds.add(slot.id);
                    } else {
                        window.app.selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    const countSpan = document.getElementById('selected-count');
                    if (confirmBtn && countSpan) {
                        const count = window.app.selectedSlotIds.size;
                        confirmBtn.style.display = count > 0 ? 'block' : 'none';
                        countSpan.textContent = count;
                    }
                });
                eveningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(eveningDiv);
        }
        container.appendChild(dayDiv);
    }
};

// --- Подтверждение записи клиентом ---
window.app.confirmBooking = async function() {
    if (!window.app.currentUser) return;
    
    if (window.app.selectedSlotIds.size === 0) {
        alert('Выберите слоты для записи');
        return;
    }
    
    const selectedIds = Array.from(window.app.selectedSlotIds);
    
    // Проверяем, не заблокированы ли выбранные слоты
    const blockedIds = await getBlockedSlotIds();
    const hasBlocked = selectedIds.some(id => blockedIds.has(id));
    if (hasBlocked) {
        alert('Некоторые выбранные слоты стали недоступны. Обновите страницу.');
        window.app.selectedSlotIds.clear();
        const slots = await window.app.loadSlots();
        await window.app.renderSlots(slots);
        return;
    }
    
    // Создаём записи
    const bookingsToInsert = selectedIds.map(slotId => ({
        slot_id: slotId,
        user_id: window.app.currentUser.id
    }));
    
    const { error: insertError } = await window.app.sb
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (insertError) {
        console.error('Ошибка записи:', insertError);
        alert('Ошибка записи: ' + insertError.message);
        return;
    }
    
    // Обновляем статус слотов
    for (let slotId of selectedIds) {
        await window.app.sb
            .from('slots')
            .update({ is_available: false })
            .eq('id', slotId);
    }
    
    alert('✅ Успешно записано!');
    window.app.selectedSlotIds.clear();
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const countSpan = document.getElementById('selected-count');
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (countSpan) countSpan.textContent = '0';
    window.app.showScreen('menu');
};

// --- Загрузка и отображение записей клиента ---
window.app.loadMyBookings = async function() {
    console.log('loadMyBookings вызвана');
    
    const container = document.getElementById('my-bookings-list');
    if (!container) {
        console.error('Контейнер my-bookings-list не найден');
        return;
    }
    
    // Получаем записи
    const { data: bookings, error } = await window.app.sb
        .from('bookings')
        .select('*, slots(*)')
        .eq('user_id', window.app.currentUser.id);
    
    if (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = '<p style="text-align:center;padding:20px;">Ошибка загрузки</p>';
        // Всё равно показываем экран
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const myBookingsScreen = document.getElementById('myBookings-screen');
        if (myBookingsScreen) myBookingsScreen.classList.add('active');
        return;
    }
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;">У вас нет записей</p>';
    } else {
        container.innerHTML = '';
        for (let booking of bookings) {
            if (!booking.slots) continue;
            const start = window.app.utcToMsk(booking.slots.start_time);
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
            container.appendChild(div);
        }
    }
    
    // Принудительно показываем экран
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const myBookingsScreen = document.getElementById('myBookings-screen');
    if (myBookingsScreen) myBookingsScreen.classList.add('active');
    console.log('Экран myBookings показан');
};

// --- Генерация слотов на день и половинку ---
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
    const daySchedule = window.app.SCHEDULE[dayOfWeek] || window.app.SCHEDULE[1];
    const times = half === 'morning' ? daySchedule.morning : daySchedule.evening;
    
    if (times.length === 0) {
        alert(`На ${half === 'morning' ? 'утро' : 'вечер'} этого дня нет расписания`);
        return false;
    }
    
    let created = 0;
    let skipped = 0;
    let existing = 0;
    
    const nowMSK = window.app.getNowMSK();
    
    for (const time of times) {
        const [hours, minutes] = time.split(':');
        
        const startTimeMSK = new Date(targetDate);
        startTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (startTimeMSK < nowMSK) {
            skipped++;
            continue;
        }
        
        const startTimeUTC = window.app.mskToUtc(startTimeMSK);
        const startTimeISO = startTimeUTC.toISOString();
        
        // Проверяем, не существует ли уже такой слот
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
    
    alert(`✅ Создано ${created} слотов\n⏭️ Пропущено (прошло): ${skipped}\n📌 Уже существовало: ${existing}`);
    
    if (typeof window.app.loadAdminData === 'function') {
        await window.app.loadAdminData();
    }
    
    return created > 0;
};

// --- Генерация всей недели (ПН-СБ) ---
let isGeneratingWeek = false;

window.app.generateFullWeek = async function() {
    if (isGeneratingWeek) {
        alert('Генерация уже выполняется, подождите...');
        return;
    }
    isGeneratingWeek = true;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToMonday);
    
    let totalSkipped = 0;
    
    // Собираем все слоты, которые нужно создать
    const slotsMap = new Map(); // используем Map для автоматической дедупликации
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dayOfWeek = currentDate.getDay();
        
        // Пропускаем воскресенье
        if (dayOfWeek === 0) continue;
        
        const daySchedule = window.app.SCHEDULE[dayOfWeek] || window.app.SCHEDULE[1];
        const allTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        for (const time of allTimes) {
            const [hours, minutes] = time.split(':');
            const startTimeMSK = new Date(currentDate);
            startTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // Пропускаем прошедшие слоты
            if (startTimeMSK < new Date()) {
                totalSkipped++;
                continue;
            }
            
            const startTimeUTC = window.app.mskToUtc(startTimeMSK);
            const endTimeUTC = new Date(startTimeUTC);
            endTimeUTC.setUTCHours(startTimeUTC.getUTCHours() + 1);
            
            const key = startTimeUTC.toISOString();
            if (!slotsMap.has(key)) {
                slotsMap.set(key, {
                    start_time: key,
                    end_time: endTimeUTC.toISOString(),
                    is_available: true,
                    is_blocked: false
                });
            }
        }
    }
    
    if (slotsMap.size === 0) {
        alert('Нет слотов для генерации (все дни уже есть или прошли)');
        isGeneratingWeek = false;
        return;
    }
    
    const slotsToInsert = Array.from(slotsMap.values());
    
    // Получаем существующие слоты
    const startDateUTC = window.app.mskToUtc(startDate);
    const endDateUTC = window.app.mskToUtc(new Date(startDate));
    endDateUTC.setUTCDate(startDateUTC.getUTCDate() + 8);
    
    const { data: existingSlots } = await window.app.sb
        .from('slots')
        .select('start_time')
        .gte('start_time', startDateUTC.toISOString())
        .lte('start_time', endDateUTC.toISOString());
    
    const existingSet = new Set(existingSlots?.map(s => s.start_time) || []);
    
    // Фильтруем только новые слоты
    const newSlots = slotsToInsert.filter(slot => !existingSet.has(slot.start_time));
    
    if (newSlots.length === 0) {
        alert('Все слоты уже существуют');
        isGeneratingWeek = false;
        return;
    }
    
    // Вставляем массово
    const { error } = await window.app.sb.from('slots').insert(newSlots);
    
    if (error) {
        console.error('Ошибка массовой вставки:', error);
        alert('Ошибка при создании слотов: ' + error.message);
    } else {
        alert(`✅ Создано ${newSlots.length} слотов\n⏭️ Пропущено (прошло/существует): ${totalSkipped + (slotsToInsert.length - newSlots.length)}`);
    }
    
    isGeneratingWeek = false;
    
    if (typeof window.app.loadAdminData === 'function') {
        await window.app.loadAdminData();
    }
};

// --- АДМИН-ПАНЕЛЬ ---

// Отображение слота в админке
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
    div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: ${isBlocked ? '#f0f0f0' : '#fff'}; border-radius: 8px; border: 1px solid ${isBlocked ? '#ffcccc' : '#e0e0e0'};`;
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

let isRenderingAdmin = false;

// Загрузка админ-панели
// Загрузка админ-панели (без ошибок 400)
window.app.loadAdminData = async function() {
    if (isRenderingAdmin) return;
    isRenderingAdmin = true;
    
    try {
        const adminSlotsDiv = document.getElementById('admin-slots');
        const adminBookingsDiv = document.getElementById('admin-bookings');
        
        if (adminSlotsDiv) adminSlotsDiv.innerHTML = '<div class="loading">Загрузка слотов...</div>';
        if (adminBookingsDiv) adminBookingsDiv.innerHTML = '<div class="loading">Загрузка записей...</div>';
        
        const todayStartUTC = new Date();
        todayStartUTC.setUTCHours(0, 0, 0, 0);
        const endDateUTC = new Date(todayStartUTC);
        endDateUTC.setUTCDate(todayStartUTC.getUTCDate() + 8);
        
        // Параллельная загрузка данных
        const [slotsResult, bookingsResult, profilesResult] = await Promise.all([
            window.app.sb.from('slots').select('*')
                .gte('start_time', todayStartUTC.toISOString())
                .lte('start_time', endDateUTC.toISOString())
                .order('start_time'),
            window.app.sb.from('bookings').select('*'),  // УБРАЛИ order('created_at')
            window.app.sb.from('profiles').select('*').order('name')
        ]);
        
        const slots = slotsResult.data || [];
        const bookings = bookingsResult.data || [];
        const profiles = profilesResult.data || [];
        
        const blockedIds = await getBlockedSlotIds();
        
        // === ОТОБРАЖЕНИЕ СЛОТОВ ===
        if (adminSlotsDiv) {
            if (slots.length === 0) {
                adminSlotsDiv.innerHTML = '<p>Нет слотов на ближайшую неделю</p>';
            } else {
                adminSlotsDiv.innerHTML = '';
                
                // Группируем по дням
                const groupedByDay = {};
                slots.forEach(slot => {
                    const date = window.app.utcToMsk(slot.start_time);
                    const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                    if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
                    groupedByDay[dayKey].push(slot);
                });
                
                for (let [day, daySlots] of Object.entries(groupedByDay)) {
                    const dayDiv = document.createElement('div');
                    dayDiv.className = 'admin-day';
                    
                    const firstSlotDate = window.app.utcToMsk(daySlots[0]?.start_time);
                    const dayDateStr = firstSlotDate.toISOString().split('T')[0];
                    
                    dayDiv.innerHTML = `
                        <div class="admin-day-header">
                            <h3 class="admin-day-title">📅 ${day}</h3>
                            <div class="half-buttons">
                                <button class="block-morning-btn" data-day="${dayDateStr}" style="background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔒 Утро</button>
                                <button class="unblock-morning-btn" data-day="${dayDateStr}" style="background: #36B647; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔓 Утро</button>
                                <button class="block-evening-btn" data-day="${dayDateStr}" style="background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔒 Вечер</button>
                                <button class="unblock-evening-btn" data-day="${dayDateStr}" style="background: #36B647; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; cursor: pointer;">🔓 Вечер</button>
                            </div>
                        </div>
                    `;
                    
                    const morning = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() < 15);
                    const evening = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() >= 15);
                    
                    if (morning.length) {
                        const morningDiv = document.createElement('div');
                        morningDiv.className = 'morning-section';
                        morningDiv.innerHTML = '<div class="half-title">☀️ Утро</div>';
                        const morningContainer = document.createElement('div');
                        morning.forEach(slot => {
                            window.app.addSlotElement(morningContainer, slot, blockedIds.has(slot.id));
                        });
                        morningDiv.appendChild(morningContainer);
                        dayDiv.appendChild(morningDiv);
                    }
                    
                    if (evening.length) {
                        const eveningDiv = document.createElement('div');
                        eveningDiv.className = 'evening-section';
                        eveningDiv.innerHTML = '<div class="half-title">🌙 Вечер</div>';
                        const eveningContainer = document.createElement('div');
                        evening.forEach(slot => {
                            window.app.addSlotElement(eveningContainer, slot, blockedIds.has(slot.id));
                        });
                        eveningDiv.appendChild(eveningContainer);
                        dayDiv.appendChild(eveningDiv);
                    }
                    
                    adminSlotsDiv.appendChild(dayDiv);
                    
                    // Обработчики кнопок блокировки/разблокировки половинок
                    const blockMorningBtn = dayDiv.querySelector('.block-morning-btn');
                    const unblockMorningBtn = dayDiv.querySelector('.unblock-morning-btn');
                    const blockEveningBtn = dayDiv.querySelector('.block-evening-btn');
                    const unblockEveningBtn = dayDiv.querySelector('.unblock-evening-btn');
                    
                    if (blockMorningBtn) {
                        blockMorningBtn.addEventListener('click', async () => {
                            if (confirm(`Заблокировать все УТРЕННИЕ слоты на ${day}?`)) {
                                const targetDate = new Date(dayDateStr);
                                const dayOfWeek = targetDate.getDay();
                                const morningTimes = (window.app.SCHEDULE[dayOfWeek] || window.app.SCHEDULE[1]).morning;
                                for (const time of morningTimes) {
                                    const [hours, minutes] = time.split(':');
                                    const slotTimeMSK = new Date(targetDate);
                                    slotTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const slotTimeUTC = window.app.mskToUtc(slotTimeMSK);
                                    const slotTimeISO = slotTimeUTC.toISOString();
                                    
                                    const { data: existing } = await window.app.sb.from('slots').select('id').eq('start_time', slotTimeISO);
                                    if (existing?.length) {
                                        await window.app.sb.from('slots').update({ is_blocked: true }).eq('start_time', slotTimeISO);
                                    } else {
                                        const endTimeUTC = new Date(slotTimeUTC);
                                        endTimeUTC.setUTCHours(slotTimeUTC.getUTCHours() + 1);
                                        await window.app.sb.from('slots').insert({
                                            start_time: slotTimeISO,
                                            end_time: endTimeUTC.toISOString(),
                                            is_available: true,
                                            is_blocked: true
                                        });
                                    }
                                }
                                await window.app.loadAdminData();
                                alert('✅ Все утренние слоты заблокированы');
                            }
                        });
                    }
                    
                    if (unblockMorningBtn) {
                        unblockMorningBtn.addEventListener('click', async () => {
                            if (confirm(`Разблокировать все УТРЕННИЕ слоты на ${day}?`)) {
                                const startUTC = window.app.mskToUtc(new Date(`${dayDateStr}T00:00:00`));
                                const endUTC = window.app.mskToUtc(new Date(`${dayDateStr}T12:00:00`));
                                await window.app.sb.from('slots').update({ is_blocked: false })
                                    .gte('start_time', startUTC.toISOString())
                                    .lt('start_time', endUTC.toISOString());
                                await window.app.loadAdminData();
                                alert('✅ Все утренние слоты разблокированы');
                            }
                        });
                    }
                    
                    if (blockEveningBtn) {
                        blockEveningBtn.addEventListener('click', async () => {
                            if (confirm(`Заблокировать все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                                const targetDate = new Date(dayDateStr);
                                const dayOfWeek = targetDate.getDay();
                                const eveningTimes = (window.app.SCHEDULE[dayOfWeek] || window.app.SCHEDULE[1]).evening;
                                for (const time of eveningTimes) {
                                    const [hours, minutes] = time.split(':');
                                    const slotTimeMSK = new Date(targetDate);
                                    slotTimeMSK.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const slotTimeUTC = window.app.mskToUtc(slotTimeMSK);
                                    const slotTimeISO = slotTimeUTC.toISOString();
                                    
                                    const { data: existing } = await window.app.sb.from('slots').select('id').eq('start_time', slotTimeISO);
                                    if (existing?.length) {
                                        await window.app.sb.from('slots').update({ is_blocked: true }).eq('start_time', slotTimeISO);
                                    } else {
                                        const endTimeUTC = new Date(slotTimeUTC);
                                        endTimeUTC.setUTCHours(slotTimeUTC.getUTCHours() + 1);
                                        await window.app.sb.from('slots').insert({
                                            start_time: slotTimeISO,
                                            end_time: endTimeUTC.toISOString(),
                                            is_available: true,
                                            is_blocked: true
                                        });
                                    }
                                }
                                await window.app.loadAdminData();
                                alert('✅ Все вечерние слоты заблокированы');
                            }
                        });
                    }
                    
                    if (unblockEveningBtn) {
                        unblockEveningBtn.addEventListener('click', async () => {
                            if (confirm(`Разблокировать все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                                const startUTC = window.app.mskToUtc(new Date(`${dayDateStr}T12:00:00`));
                                const endUTC = window.app.mskToUtc(new Date(`${dayDateStr}T23:59:59`));
                                await window.app.sb.from('slots').update({ is_blocked: false })
                                    .gte('start_time', startUTC.toISOString())
                                    .lt('start_time', endUTC.toISOString());
                                await window.app.loadAdminData();
                                alert('✅ Все вечерние слоты разблокированы');
                            }
                        });
                    }
                }
            }
        }
        
        // === ОТОБРАЖЕНИЕ ВСЕХ ЗАПИСЕЙ (без order) ===
        if (adminBookingsDiv) {
            if (bookings.length === 0) {
                adminBookingsDiv.innerHTML = '<h3>Все записи</h3><p>Нет записей</p>';
            } else {
                // Создаём Map для быстрого доступа к слотам и профилям
                const slotsMap = new Map();
                slots.forEach(s => slotsMap.set(s.id, s));
                const profilesMap = new Map();
                profiles.forEach(p => profilesMap.set(p.id, p));
                
                // Обогащаем записи данными
                const enrichedBookings = bookings.map(booking => ({
                    ...booking,
                    slot: slotsMap.get(booking.slot_id),
                    profile: profilesMap.get(booking.user_id)
                })).filter(b => b.slot);
                
                // Сортируем по времени (вручную, без order)
                enrichedBookings.sort((a, b) => {
                    const timeA = window.app.utcToMsk(a.slot.start_time);
                    const timeB = window.app.utcToMsk(b.slot.start_time);
                    return timeA - timeB;
                });
                
                // Группируем по дням
                const groupedByDay = {};
                enrichedBookings.forEach(booking => {
                    const date = window.app.utcToMsk(booking.slot.start_time);
                    const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                    if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
                    groupedByDay[dayKey].push(booking);
                });
                
                adminBookingsDiv.innerHTML = '<h3>Все записи</h3>';
                
                for (let [day, dayBookings] of Object.entries(groupedByDay)) {
                    const dayDiv = document.createElement('div');
                    dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
                    dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${day}</h3>`;
                    
                    const morning = dayBookings.filter(b => window.app.utcToMsk(b.slot.start_time).getHours() < 15);
                    const evening = dayBookings.filter(b => window.app.utcToMsk(b.slot.start_time).getHours() >= 15);
                    
                    if (morning.length) {
                        const morningDiv = document.createElement('div');
                        morningDiv.innerHTML = '<div class="half-title">☀️ Утро</div>';
                        morning.forEach(booking => {
                            const timeStr = window.app.utcToMsk(booking.slot.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                            const profile = booking.profile || {};
                            const bookingDiv = document.createElement('div');
                            bookingDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 8px;';
                            bookingDiv.innerHTML = `
                                <div>
                                    <strong>${profile.name || 'Неизвестно'}</strong><br>
                                    📞 ${profile.phone || 'нет телефона'}<br>
                                    🕐 ${timeStr}
                                </div>
                                <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                            `;
                            bookingDiv.querySelector('.delete-booking-btn').addEventListener('click', async () => {
                                if (confirm('Удалить эту запись?')) {
                                    await window.app.sb.from('bookings').delete().eq('id', booking.id);
                                    await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                                    await window.app.loadAdminData();
                                }
                            });
                            morningDiv.appendChild(bookingDiv);
                        });
                        dayDiv.appendChild(morningDiv);
                    }
                    
                    if (evening.length) {
                        const eveningDiv = document.createElement('div');
                        eveningDiv.innerHTML = '<div class="half-title">🌙 Вечер</div>';
                        evening.forEach(booking => {
                            const timeStr = window.app.utcToMsk(booking.slot.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                            const profile = booking.profile || {};
                            const bookingDiv = document.createElement('div');
                            bookingDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: #f9f9f9; border-radius: 8px;';
                            bookingDiv.innerHTML = `
                                <div>
                                    <strong>${profile.name || 'Неизвестно'}</strong><br>
                                    📞 ${profile.phone || 'нет телефона'}<br>
                                    🕐 ${timeStr}
                                </div>
                                <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                            `;
                            bookingDiv.querySelector('.delete-booking-btn').addEventListener('click', async () => {
                                if (confirm('Удалить эту запись?')) {
                                    await window.app.sb.from('bookings').delete().eq('id', booking.id);
                                    await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                                    await window.app.loadAdminData();
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
