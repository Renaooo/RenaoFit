// ============================================
// МОДУЛЬ СЛОТОВ (ЗАПИСЬ, ОТМЕНА, АДМИН-ПАНЕЛЬ СЛОТОВ)
// ============================================

// --- Получение списка заблокированных слотов на основе занятых ---
async function getBlockedSlotIds() {
    const blockedIds = new Set();
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    // Получаем все занятые слоты
    const { data: bookedSlots, error: bookedError } = await window.app.sb
        .from('slots')
        .select('id, start_time')
        .eq('is_available', false)
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    if (bookedError || !bookedSlots || bookedSlots.length === 0) return blockedIds;
    
    // Группируем занятые слоты по дням и часам
    const bookedByDay = {};
    bookedSlots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toISOString().split('T')[0];
        const hour = date.getHours();
        if (!bookedByDay[dayKey]) bookedByDay[dayKey] = [];
        bookedByDay[dayKey].push({ id: slot.id, hour });
    });
    
    // Получаем все слоты для поиска ID
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
        const hour = date.getHours();
        if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
        slotsByDay[dayKey].push({ id: slot.id, hour });
    });
    
    function findSlotId(dayKey, hour) {
        return slotsByDay[dayKey]?.find(s => s.hour === hour)?.id;
    }
    
    // Анализируем каждый день
    for (let [dayKey, booked] of Object.entries(bookedByDay)) {
        const bookedHours = booked.map(b => b.hour);
        const date = new Date(dayKey);
        const dayOfWeek = date.getDay();
        const isSaturday = dayOfWeek === 6;
        
        // === 1. Парные блокировки 17:00 ↔ 21:00 ===
        if (bookedHours.includes(17)) {
            const slot21 = findSlotId(dayKey, 21);
            if (slot21) blockedIds.add(slot21);
        }
        if (bookedHours.includes(21)) {
            const slot17 = findSlotId(dayKey, 17);
            if (slot17) blockedIds.add(slot17);
        }
        
        // === 2. Субботние парные блокировки 10:00 ↔ 14:00 ===
        if (isSaturday) {
            if (bookedHours.includes(10)) {
                const slot14 = findSlotId(dayKey, 14);
                if (slot14) blockedIds.add(slot14);
            }
            if (bookedHours.includes(14)) {
                const slot10 = findSlotId(dayKey, 10);
                if (slot10) blockedIds.add(slot10);
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

// --- Отображение слотов с подсветкой рекомендуемых ---
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
            const date = new Date(slot.start_time);
            const dayKey = date.toLocaleDateString('ru-RU');
            const timeStr = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            if (!bookedTimesByDay[dayKey]) bookedTimesByDay[dayKey] = [];
            bookedTimesByDay[dayKey].push(timeStr);
        }
    });
    
    function hasAdjacentBooking(dayKey, timeStr) {
        const [hours] = timeStr.split(':').map(Number);
        const prevHour = `${(hours - 1).toString().padStart(2,'0')}:00`;
        const nextHour = `${(hours + 1).toString().padStart(2,'0')}:00`;
        const bookedTimes = bookedTimesByDay[dayKey] || [];
        return bookedTimes.includes(prevHour) || bookedTimes.includes(nextHour);
    }
    
    const groupedByDay = {};
    slots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toLocaleDateString('ru-RU');
        const displayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[displayKey]) {
            groupedByDay[displayKey] = { slots: [], dayKey: dayKey };
        }
        groupedByDay[displayKey].slots.push(slot);
    });
    
    for (let [displayDay, dayData] of Object.entries(groupedByDay)) {
        const daySlots = dayData.slots;
        const dayKey = dayData.dayKey;
        
        daySlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${displayDay}</h3>`;
        
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            
            morning.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const hasAdjacent = hasAdjacentBooking(dayKey, timeStr);
                
                const slotDiv = document.createElement('div');
                if (window.app.selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: ${hasAdjacent ? '#e8f5e9' : '#f8f9fa'}; border-radius: 12px; border: 1px solid ${hasAdjacent ? '#36B647' : '#e9ecef'};`;
                
                let badgeHtml = '';
                if (hasAdjacent) {
                    badgeHtml = '<span style="background: #36B647; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>';
                }
                
                slotDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 500;">${timeStr}</span>
                        ${badgeHtml}
                    </div>
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
                const hasAdjacent = hasAdjacentBooking(dayKey, timeStr);
                
                const slotDiv = document.createElement('div');
                if (window.app.selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
                slotDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: ${hasAdjacent ? '#e8f5e9' : '#f8f9fa'}; border-radius: 12px; border: 1px solid ${hasAdjacent ? '#36B647' : '#e9ecef'};`;
                
                let badgeHtml = '';
                if (hasAdjacent) {
                    badgeHtml = '<span style="background: #36B647; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>';
                }
                
                slotDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 500;">${timeStr}</span>
                        ${badgeHtml}
                    </div>
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

// --- Подтверждение записи клиентом ---
window.app.confirmBooking = async function() {
    if (!window.app.currentUser) return;
    
    if (window.app.selectedSlotIds.size === 0) {
        alert('Выберите слоты для записи');
        return;
    }
    
    const selectedIds = Array.from(window.app.selectedSlotIds);
    console.log('Бронирую слоты:', selectedIds);
    
    // Сначала создаём бронирования
    const bookingsToInsert = selectedIds.map(slotId => ({
        slot_id: slotId,
        user_id: window.app.currentUser.id
    }));
    
    const { error: insertError } = await window.app.sb
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (insertError) {
        console.error('Ошибка создания брони:', insertError);
        alert('Ошибка записи: ' + insertError.message);
        return;
    }
    
    // Затем блокируем слоты
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

// --- Загрузка и отображение записей клиента ---
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
        
        const morning = dayBookings.filter(b => new Date(b.slots.start_time).getHours() < 15);
        const evening = dayBookings.filter(b => new Date(b.slots.start_time).getHours() >= 15);
        
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            morning.forEach(booking => {
                const start = new Date(booking.slots.start_time);
                const formatted = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
                div.innerHTML = `
                    <span style="font-weight: 500;">${formatted}</span>
                    <button class="cancel-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 14px; cursor: pointer;">Отменить</button>
                `;
                const cancelBtn = div.querySelector('.cancel-btn');
                cancelBtn.addEventListener('click', async () => {
                    if (confirm('Отменить запись?')) {
                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                        alert('Запись отменена');
                        await window.app.loadMyBookings();
                    }
                });
                morningDiv.appendChild(div);
            });
            dayDiv.appendChild(morningDiv);
        }
        
        if (evening.length > 0) {
            const eveningDiv = document.createElement('div');
            eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
            evening.forEach(booking => {
                const start = new Date(booking.slots.start_time);
                const formatted = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
                div.innerHTML = `
                    <span style="font-weight: 500;">${formatted}</span>
                    <button class="cancel-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 14px; cursor: pointer;">Отменить</button>
                `;
                const cancelBtn = div.querySelector('.cancel-btn');
                cancelBtn.addEventListener('click', async () => {
                    if (confirm('Отменить запись?')) {
                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                        alert('Запись отменена');
                        await window.app.loadMyBookings();
                    }
                });
                eveningDiv.appendChild(div);
            });
            dayDiv.appendChild(eveningDiv);
        }
        
        container.appendChild(dayDiv);
    }
};

// --- Автоматическое обновление расписания на 8 дней ---
window.app.ensureWeeklySchedule = async function(force = false) {
    // Проверяем, есть ли уже слоты на ближайшие дни
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    const { data: existingSlots } = await window.app.sb
        .from('slots')
        .select('id')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString())
        .limit(1);
    
    // Если слоты уже есть и не force, то ничего не делаем
    if (!force && existingSlots && existingSlots.length > 0) {
        console.log('Слоты уже существуют, пропускаем генерацию');
        return;
    }
    
    console.log('Генерируем расписание...');
    
    const schedule = {
        1: ['08:00', '09:00', '10:00', '11:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
        2: ['08:00', '09:00', '10:00', '11:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
        3: ['08:00', '09:00', '10:00', '11:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
        4: ['08:00', '09:00', '10:00', '11:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
        5: ['08:00', '09:00', '10:00', '11:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
        6: ['10:00', '11:00', '12:00', '13:00', '14:00'],
        0: []
    };
    
    // Очищаем старые слоты (только если force)
    if (force) {
        await window.app.sb.from('bookings').delete().neq('id', 0);
        await window.app.sb.from('slots').delete().neq('id', 0);
    }
    
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    
    for (let day = 0; day < 8; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        
        const times = schedule[dayOfWeek];
        if (!times || times.length === 0) continue;
        
        for (let time of times) {
            const [hours, minutes] = time.split(':');
            const startTime = new Date(currentDate);
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            if (startTime < new Date()) continue;
            
            const endTime = new Date(startTime);
            endTime.setHours(startTime.getHours() + 1);
            
            // Проверяем, нет ли уже такого слота
            const { data: existing } = await window.app.sb
                .from('slots')
                .select('id')
                .eq('start_time', startTime.toISOString())
                .maybeSingle();
            
            if (!existing) {
                await window.app.sb.from('slots').insert({
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    is_available: true
                });
            }
        }
    }
    
    console.log('Расписание готово');
};

// --- Вспомогательная функция для отображения слота в админке ---
window.app.addSlotElement = function(container, slot, isBlockedByRule = false) {
    const start = new Date(slot.start_time);
    const isAvailable = slot.is_available;
    const isBlocked = !isAvailable || isBlockedByRule;
    
    const div = document.createElement('div');
    div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: ${isBlocked ? '#f0f0f0' : '#fff'}; border-radius: 8px; border: 1px solid ${isBlocked ? '#ffcccc' : '#e0e0e0'};`;
    div.innerHTML = `
        <span style="${isBlocked ? 'text-decoration: line-through; color: #999;' : ''}">
            ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            ${!isAvailable ? ' ❌ занят' : (isBlockedByRule ? ' 🔒 заблокирован правилами' : '')}
        </span>
        <button class="delete-slot-btn" data-id="${slot.id}" style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">✖</button>
    `;
    
    const deleteBtn = div.querySelector('.delete-slot-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Удалить этот слот?')) {
                await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
                await window.app.sb.from('slots').delete().eq('id', slot.id);
                await window.app.loadAdminData();
            }
        });
    }
    
    container.appendChild(div);
};

// --- Админ-панель: отображение слотов и записей ---
window.app.loadAdminData = async function() {
    await window.app.ensureWeeklySchedule(false);
    
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
    
    // Получаем заблокированные правилами слоты
    const blockedIds = await getBlockedSlotIds();
    
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
                dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #36B647; padding-left: 12px;';
                
                // Получаем дату дня для кнопок удаления
                const firstSlotDate = daySlots[0]?.start_time ? new Date(daySlots[0].start_time) : new Date();
                const dayDateStr = firstSlotDate.toISOString().split('T')[0];
                
                dayDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 16px;">📅 ${day}</h3>
                        <div style="display: flex; gap: 8px;">
                            <button class="delete-morning-btn" data-day="${dayDateStr}" style="background: #ff9800; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">🗑️ Утро</button>
                            <button class="delete-evening-btn" data-day="${dayDateStr}" style="background: #ff9800; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">🗑️ Вечер</button>
                        </div>
                    </div>
                `;
                
                const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
                const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
                
                if (morning.length > 0) {
                    const morningDiv = document.createElement('div');
                    morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
                    morning.forEach(slot => {
                        const isBlockedByRule = blockedIds.has(slot.id);
                        window.app.addSlotElement(morningDiv, slot, isBlockedByRule);
                    });
                    dayDiv.appendChild(morningDiv);
                }
                
                if (evening.length > 0) {
                    const eveningDiv = document.createElement('div');
                    eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
                    evening.forEach(slot => {
                        const isBlockedByRule = blockedIds.has(slot.id);
                        window.app.addSlotElement(eveningDiv, slot, isBlockedByRule);
                    });
                    dayDiv.appendChild(eveningDiv);
                }
                
                adminSlotsDiv.appendChild(dayDiv);
                
                // Обработчики кнопок удаления утра/вечера
                const morningDeleteBtn = dayDiv.querySelector('.delete-morning-btn');
                const eveningDeleteBtn = dayDiv.querySelector('.delete-evening-btn');
                
                if (morningDeleteBtn) {
                    morningDeleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить все УТРЕННИЕ слоты на ${day}?`)) {
                            const dayDateStr = e.target.dataset.day;
                            await window.app.sb
                                .from('slots')
                                .delete()
                                .gte('start_time', `${dayDateStr}T00:00:00.000Z`)
                                .lt('start_time', `${dayDateStr}T12:00:00.000Z`);
                            await window.app.loadAdminData();
                        }
                    });
                }
                
                if (eveningDeleteBtn) {
                    eveningDeleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить все ВЕЧЕРНИЕ слоты на ${day}?`)) {
                            const dayDateStr = e.target.dataset.day;
                            await window.app.sb
                                .from('slots')
                                .delete()
                                .gte('start_time', `${dayDateStr}T12:00:00.000Z`)
                                .lt('start_time', `${dayDateStr}T23:59:59.999Z`);
                            await window.app.loadAdminData();
                        }
                    });
                }
            }
        }
    }
    
    const { data: bookings } = await window.app.sb.rpc('get_bookings_with_profiles');
    
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
                    <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                `;
                
                const deleteBtn = div.querySelector('.delete-booking-btn');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                        await window.app.sb.from('bookings').delete().eq('id', booking.id);
                        await window.app.sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                        alert('Запись удалена, слот свободен');
                        await window.app.loadAdminData();
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
    
    if (typeof window.app.setupAdminTabs === 'function') {
        window.app.setupAdminTabs();
    }
};

// --- Переключение между вкладками в админ-панели ---
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
