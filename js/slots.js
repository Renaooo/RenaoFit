// ============================================
// МОДУЛЬ СЛОТОВ (С ОТЛАДКОЙ)
// ============================================

// --- Получение списка заблокированных слотов (с учётом исключений) ---
async function getBlockedSlotIds() {
    const blockedIds = new Set();
    
    // Получаем список слотов, которые разблокированы вручную (исключения)
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
        const hour = date.getHours();
        const minute = date.getMinutes();
        if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
        slotsByDay[dayKey].push({ id: slot.id, hour, minute, timeValue: hour + minute/60 });
    });
    
    const bookedByDay = {};
    bookedSlots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toISOString().split('T')[0];
        const hour = date.getHours();
        const minute = date.getMinutes();
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
        const [hours, minutes] = timeStr.split(':').map(Number);
        const currentMinutes = hours * 60 + minutes;
        
        const adjacentMinutes = [
            currentMinutes - 60,
            currentMinutes + 60
        ];
        
        const bookedTimes = bookedTimesByDay[dayKey] || [];
        
        for (let adjMin of adjacentMinutes) {
            if (adjMin < 0) continue;
            const adjHour = Math.floor(adjMin / 60);
            const adjMinute = adjMin % 60;
            if (adjHour > 23) continue;
            const adjTimeStr = `${adjHour.toString().padStart(2,'0')}:${adjMinute.toString().padStart(2,'0')}`;
            if (bookedTimes.includes(adjTimeStr)) {
                return true;
            }
        }
        return false;
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
        console.error('Ошибка создания брони:', insertError);
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

// --- Безопасная генерация слотов (с учётом удалённых слотов) ---
window.app.ensureWeeklySchedule = async function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    
    // Получаем все существующие слоты
    const { data: existingSlots } = await window.app.sb
        .from('slots')
        .select('start_time')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    // Получаем список удалённых слотов (которые не нужно создавать)
    const { data: deletedSlots } = await window.app.sb
        .from('deleted_slots')
        .select('slot_time')
        .gte('slot_time', today.toISOString())
        .lte('slot_time', endDate.toISOString());
    
    const deletedSlotKeys = new Set();
    deletedSlots?.forEach(ds => {
        const date = new Date(ds.slot_time);
        const key = date.toISOString().slice(0, 16);
        deletedSlotKeys.add(key);
    });
    
    const existingSlotKeys = new Set();
    existingSlots?.forEach(slot => {
        const date = new Date(slot.start_time);
        const key = date.toISOString().slice(0, 16);
        existingSlotKeys.add(key);
    });
    
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
        currentDate.setDate(today.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        const daySchedule = schedule[dayOfWeek] || schedule[1];
        const requiredTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        if (requiredTimes.length === 0) continue;
        
        for (let time of requiredTimes) {
            const [hours, minutes] = time.split(':');
            const startTime = new Date(currentDate);
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            if (startTime < new Date()) continue;
            
            const slotKey = startTime.toISOString().slice(0, 16);
            
            // Пропускаем, если слот уже существует
            if (existingSlotKeys.has(slotKey)) continue;
            
            // Пропускаем, если слот был удалён ранее
            if (deletedSlotKeys.has(slotKey)) continue;
            
            const endTime = new Date(startTime);
            endTime.setHours(startTime.getHours() + 1);
            
            const { error } = await window.app.sb.from('slots').insert({
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                is_available: true
            });
            
            if (!error) {
                addedCount++;
                existingSlotKeys.add(slotKey);
            }
        }
    }
    
    if (addedCount > 0) {
        console.log(`✅ Добавлено ${addedCount} новых слотов`);
    }
};

// --- Функция отображения слота в админке (с кнопкой разблокировки) ---
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
            ${showUnblockBtn ? '<button class="unblock-slot-btn" data-id="' + slot.id + '" style="background: #36B647; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;" title="Разблокировать слот">🔓</button>' : ''}
            <button class="delete-slot-btn" data-id="${slot.id}" data-time="${start.toISOString()}" style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">✖</button>
        </div>
    `;
    
    const unblockBtn = div.querySelector('.unblock-slot-btn');
    if (unblockBtn) {
        unblockBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Разблокировать слот на ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}?\n\nСлот будет добавлен в исключения и больше не будет блокироваться правилами.`)) {
                await window.app.sb
                    .from('slot_exceptions')
                    .insert({ slot_id: slot.id });
                await window.app.sb
                    .from('slots')
                    .update({ is_available: true })
                    .eq('id', slot.id);
                alert('✅ Слот разблокирован');
                await window.app.loadAdminData();
            }
        });
    }
    
    const deleteBtn = div.querySelector('.delete-slot-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Удалить этот слот? Он больше НЕ БУДЕТ восстанавливаться автоматически.')) {
                const slotTime = deleteBtn.dataset.time;
                
                // Добавляем в таблицу удалённых слотов
                await window.app.sb
                    .from('deleted_slots')
                    .insert({ slot_time: slotTime });
                
                // Удаляем связанные записи в bookings
                await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
                // Удаляем сам слот
                await window.app.sb.from('slots').delete().eq('id', slot.id);
                
                alert('✅ Слот удалён. Он больше не будет появляться в расписании.');
                await window.app.loadAdminDataWithoutGenerate();
            }
        });
    }
    
    container.appendChild(div);
};

// --- Админ-панель: отображение слотов и записей (с генерацией) ---
window.app.loadAdminData = async function() {
    await window.app.ensureWeeklySchedule();
    await window.app.loadAdminDataWithoutGenerate();
};

// --- Админ-панель: обновление без автоматической генерации слотов ---
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
                
                const morningDeleteBtn = dayDiv.querySelector('.delete-morning-btn');
                const eveningDeleteBtn = dayDiv.querySelector('.delete-evening-btn');
                
                if (morningDeleteBtn) {
                    morningDeleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить все УТРЕННИЕ слоты на ${day}? Они больше не будут восстанавливаться.`)) {
                            const dayDateStr = e.target.dataset.day;
                            const slotsToDelete = slots.filter(s => {
                                const date = new Date(s.start_time);
                                const hours = date.getHours();
                                return date.toISOString().split('T')[0] === dayDateStr && hours < 12;
                            });
                            
                            for (const slot of slotsToDelete) {
                                await window.app.sb.from('deleted_slots').insert({ slot_time: slot.start_time });
                                await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
                            }
                            
                            await window.app.sb
                                .from('slots')
                                .delete()
                                .gte('start_time', `${dayDateStr}T00:00:00.000Z`)
                                .lt('start_time', `${dayDateStr}T12:00:00.000Z`);
                            
                            await window.app.loadAdminDataWithoutGenerate();
                        }
                    });
                }
                
                if (eveningDeleteBtn) {
                    eveningDeleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить все ВЕЧЕРНИЕ слоты на ${day}? Они больше не будут восстанавливаться.`)) {
                            const dayDateStr = e.target.dataset.day;
                            const slotsToDelete = slots.filter(s => {
                                const date = new Date(s.start_time);
                                const hours = date.getHours();
                                return date.toISOString().split('T')[0] === dayDateStr && hours >= 12;
                            });
                            
                            for (const slot of slotsToDelete) {
                                await window.app.sb.from('deleted_slots').insert({ slot_time: slot.start_time });
                                await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
                            }
                            
                            await window.app.sb
                                .from('slots')
                                .delete()
                                .gte('start_time', `${dayDateStr}T12:00:00.000Z`)
                                .lt('start_time', `${dayDateStr}T23:59:59.999Z`);
                            
                            await window.app.loadAdminDataWithoutGenerate();
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
            const groupedByDay = {};
            bookings.forEach(booking => {
                const date = new Date(booking.start_time);
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
                
                const morning = dayBookings.filter(b => new Date(b.start_time).getHours() < 15);
                const evening = dayBookings.filter(b => new Date(b.start_time).getHours() >= 15);
                
                if (morning.length > 0) {
                    const morningDiv = document.createElement('div');
                    morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
                    morning.forEach(booking => {
                        const timeStr = new Date(booking.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
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
                        morningDiv.appendChild(bookingDiv);
                    });
                    dayDiv.appendChild(morningDiv);
                }
                
                if (evening.length > 0) {
                    const eveningDiv = document.createElement('div');
                    eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
                    evening.forEach(booking => {
                        const timeStr = new Date(booking.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
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
