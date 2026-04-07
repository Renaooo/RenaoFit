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
        const dayOfWeek = date.getDay(); // 0=вс, 1=пн, 2=вт, 3=ср, 4=чт, 5=пт, 6=сб
        const isSaturday = dayOfWeek === 6;
        const isTuesdayOrThursday = (dayOfWeek === 2 || dayOfWeek === 4);
        
        console.log(`Анализ дня ${dayKey} (${dayOfWeek}), занятые часы:`, bookedHours);
        
        // === 1. Парные блокировки 17:00 ↔ 21:00 ===
        if (bookedHours.includes(17)) {
            const slot21 = findSlotId(dayKey, 21);
            if (slot21) {
                console.log(`Блокируем 21:00 из-за 17:00 в ${dayKey}`);
                blockedIds.add(slot21);
            }
        }
        if (bookedHours.includes(21)) {
            const slot17 = findSlotId(dayKey, 17);
            if (slot17) {
                console.log(`Блокируем 17:00 из-за 21:00 в ${dayKey}`);
                blockedIds.add(slot17);
            }
        }
        
        // === 2. Субботние парные блокировки 10:00 ↔ 14:00 ===
        if (isSaturday) {
            if (bookedHours.includes(10)) {
                const slot14 = findSlotId(dayKey, 14);
                if (slot14) {
                    console.log(`Блокируем 14:00 из-за 10:00 в субботу ${dayKey}`);
                    blockedIds.add(slot14);
                }
            }
            if (bookedHours.includes(14)) {
                const slot10 = findSlotId(dayKey, 10);
                if (slot10) {
                    console.log(`Блокируем 10:00 из-за 14:00 в субботу ${dayKey}`);
                    blockedIds.add(slot10);
                }
            }
        }
        
        // === 3. Вторник и четверг: блокировка утро ↔ вечер ===
        if (isTuesdayOrThursday) {
            const hasMorning = bookedHours.some(h => h >= 8 && h <= 11);
            const hasEvening = bookedHours.some(h => h >= 17 && h <= 21);
            
            console.log(`Вторник/Четверг ${dayKey}: hasMorning=${hasMorning}, hasEvening=${hasEvening}`);
            
            if (hasMorning && !hasEvening) {
                // Блокируем все вечерние слоты (17,18,19,20,21)
                console.log(`Блокируем вечерние слоты в ${dayKey} из-за утренней записи`);
                [17, 18, 19, 20, 21].forEach(hour => {
                    const slotId = findSlotId(dayKey, hour);
                    if (slotId) blockedIds.add(slotId);
                });
            }
            if (hasEvening && !hasMorning) {
                // Блокируем все утренние слоты (8,9,10,11)
                console.log(`Блокируем утренние слоты в ${dayKey} из-за вечерней записи`);
                [8, 9, 10, 11].forEach(hour => {
                    const slotId = findSlotId(dayKey, hour);
                    if (slotId) blockedIds.add(slotId);
                });
            }
        }
    }
    
    console.log('Итоговые заблокированные слоты:', Array.from(blockedIds));
    return blockedIds;
}

    
    function findSlotId(dayKey, hour) {
        return slotsByDay[dayKey]?.find(s => s.hour === hour)?.id;
    }
    
    for (let [dayKey, booked] of Object.entries(bookedByDay)) {
        const bookedHours = booked.map(b => b.hour);
        const date = new Date(dayKey);
        const dayOfWeek = date.getDay();
        const isSaturday = dayOfWeek === 6;
        const isTuesdayOrThursday = (dayOfWeek === 2 || dayOfWeek === 4);
        
        // Парные блокировки 17 ↔ 21
        if (bookedHours.includes(17)) {
            const slot21 = findSlotId(dayKey, 21);
            if (slot21) blockedIds.add(slot21);
        }
        if (bookedHours.includes(21)) {
            const slot17 = findSlotId(dayKey, 17);
            if (slot17) blockedIds.add(slot17);
        }
        
        // Суббота: 10 ↔ 14
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
        
        // Вторник и четверг: утро ↔ вечер
        if (isTuesdayOrThursday) {
            const hasMorning = bookedHours.some(h => h >= 8 && h <= 11);
            const hasEvening = bookedHours.some(h => h >= 17 && h <= 21);
            
            if (hasMorning && !hasEvening) {
                [17, 18, 19, 20, 21].forEach(hour => {
                    const slotId = findSlotId(dayKey, hour);
                    if (slotId) blockedIds.add(slotId);
                });
            }
            if (hasEvening && !hasMorning) {
                [8, 9, 10, 11].forEach(hour => {
                    const slotId = findSlotId(dayKey, hour);
                    if (slotId) blockedIds.add(slotId);
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
window.app.ensureWeeklySchedule = async function() {
    const schedule = {
        1: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
        2: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
        3: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
        4: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
        5: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
        6: { morning: ['10:00', '11:00', '12:00', '13:00', '14:00'], evening: [] },
        0: { morning: [], evening: [] }
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Очищаем старые слоты старше 8 дней
    const oldDate = new Date(today);
    oldDate.setDate(today.getDate() - 1);
    await window.app.sb
        .from('slots')
        .delete()
        .lt('start_time', oldDate.toISOString());
    
    for (let day = 0; day < 8; day++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        
        const daySchedule = schedule[dayOfWeek];
        const requiredTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        const startOfDay = new Date(currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: existingSlots } = await window.app.sb
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
        
        // Удаляем слоты, которых нет в расписании
        for (let slot of existingSlots || []) {
            const d = new Date(slot.start_time);
            const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            if (!requiredTimes.includes(timeStr)) {
                await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
                await window.app.sb.from('slots').delete().eq('id', slot.id);
            }
        }
        
        // Добавляем недостающие слоты
        for (let time of requiredTimes) {
            if (!existingTimesSet.has(time)) {
                const [hours, minutes] = time.split(':');
                const startTime = new Date(currentDate);
                startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                if (startTime < new Date()) continue;
                
                const endTime = new Date(startTime);
                endTime.setHours(startTime.getHours() + 1);
                
                await window.app.sb.from('slots').insert({
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    is_available: true
                });
            }
        }
    }
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
        ${(!isBlocked && isAvailable) ? '<button class="delete-slot-btn" data-id="' + slot.id + '" style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">✖</button>' : ''}
    `;
    
    if (!isBlocked && isAvailable) {
        const deleteBtn = div.querySelector('.delete-slot-btn');
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
    await window.app.ensureWeeklySchedule();
    
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
                dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
                
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
