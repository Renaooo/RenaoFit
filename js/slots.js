// ============================================
// МОДУЛЬ СЛОТОВ (ЗАПИСЬ, АДМИНКА, РЕКОМЕНДАЦИИ)
// ============================================

// --- Получение заблокированных слотов (соседние ±30 минут) ---
async function getBlockedSlotIds() {
    const blockedIds = new Set();
    
    // Ручные блокировки
    const { data: manuallyBlocked } = await window.app.sb
        .from('slots')
        .select('id')
        .eq('is_blocked', true);
    manuallyBlocked?.forEach(s => blockedIds.add(s.id));
    
    // Занятые слоты
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 14);
    
    const { data: bookedSlots } = await window.app.sb
        .from('slots')
        .select('id, start_time')
        .eq('is_available', false)
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    if (!bookedSlots?.length) return blockedIds;
    
    // Все слоты за период
    const { data: allSlots } = await window.app.sb
        .from('slots')
        .select('id, start_time')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    if (!allSlots) return blockedIds;
    
    // Карта времени → id
    const timeMap = new Map();
    allSlots.forEach(slot => {
        timeMap.set(new Date(slot.start_time).getTime(), slot.id);
    });
    
    const halfHour = 30 * 60 * 1000;
    bookedSlots.forEach(booked => {
        const t = new Date(booked.start_time).getTime();
        const prev = timeMap.get(t - halfHour);
        const next = timeMap.get(t + halfHour);
        if (prev) blockedIds.add(prev);
        if (next) blockedIds.add(next);
    });
    
    return blockedIds;
}

// --- Загрузка свободных слотов для клиента ---
window.app.loadSlots = async function() {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    const { data: slots } = await window.app.sb
        .from('slots')
        .select('*')
        .eq('is_available', true)
        .eq('is_blocked', false)
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');
    
    if (!slots) return [];
    
    const blockedIds = await getBlockedSlotIds();
    return slots.filter(slot => !blockedIds.has(slot.id));
};

// --- Отображение слотов для клиента ---
window.app.renderSlots = async function(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots.length) {
        container.innerHTML = '<p style="text-align:center;padding:20px;">Нет свободных слотов</p>';
        return;
    }
    
    // Загружаем занятые слоты для рекомендаций
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 8);
    
    const { data: allSlots } = await window.app.sb
        .from('slots')
        .select('start_time, is_available')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString());
    
    const bookedMap = new Map();
    (allSlots || []).forEach(slot => {
        if (!slot.is_available) {
            const date = window.app.utcToMsk(slot.start_time);
            const key = `${date.toLocaleDateString('ru-RU')}|${date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
            bookedMap.set(key, true);
        }
    });
    
    function hasAdjacent(dayKey, timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const curMin = h * 60 + m;
        for (const delta of [-30, 30]) {
            const adjMin = curMin + delta;
            if (adjMin < 0 || adjMin > 24*60) continue;
            const adjH = Math.floor(adjMin / 60);
            const adjM = adjMin % 60;
            const adjStr = `${adjH.toString().padStart(2,'0')}:${adjM.toString().padStart(2,'0')}`;
            if (bookedMap.get(`${dayKey}|${adjStr}`)) return true;
        }
        return false;
    }
    
    // Группировка по дням
    const groups = {};
    for (const slot of slots) {
        const date = window.app.utcToMsk(slot.start_time);
        const dayKey = date.toLocaleDateString('ru-RU');
        const display = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groups[display]) groups[display] = { dayKey, slots: [] };
        groups[display].slots.push(slot);
    }
    
    for (const [display, data] of Object.entries(groups)) {
        const daySlots = data.slots.sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
        const morning = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom:20px;border-left:3px solid #36B647;padding-left:12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom:10px;">📅 ${display}</h3>`;
        
        if (morning.length) {
            const block = document.createElement('div');
            block.innerHTML = '<div style="font-size:12px;color:#666;margin-bottom:5px;">☀️ Утро</div>';
            for (const slot of morning) {
                const start = window.app.utcToMsk(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const recommend = hasAdjacent(data.dayKey, timeStr);
                const isSelected = window.app.selectedSlotIds.has(slot.id);
                
                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-item' + (isSelected ? ' selected' : '');
                slotDiv.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:12px;margin-bottom:8px;background:${recommend ? '#e8f5e9' : '#f8f9fa'};border-radius:12px;border:1px solid ${recommend ? '#36B647' : '#e9ecef'};`;
                slotDiv.innerHTML = `
                    <div><span class="slot-time">${timeStr}</span>${recommend ? '<span class="recommended-badge">⭐ РЕКОМЕНДУЕМОЕ</span>' : ''}</div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${isSelected ? 'checked' : ''}>
                `;
                const cb = slotDiv.querySelector('.slot-select');
                cb.onchange = () => {
                    if (cb.checked) window.app.selectedSlotIds.add(slot.id);
                    else window.app.selectedSlotIds.delete(slot.id);
                    const btn = document.getElementById('confirm-booking-btn');
                    const span = document.getElementById('selected-count');
                    if (btn && span) {
                        const cnt = window.app.selectedSlotIds.size;
                        btn.style.display = cnt ? 'block' : 'none';
                        span.textContent = cnt;
                    }
                };
                block.appendChild(slotDiv);
            }
            dayDiv.appendChild(block);
        }
        
        if (evening.length) {
            const block = document.createElement('div');
            block.innerHTML = '<div style="font-size:12px;color:#666;margin:10px 0 5px;">🌙 Вечер</div>';
            for (const slot of evening) {
                const start = window.app.utcToMsk(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const recommend = hasAdjacent(data.dayKey, timeStr);
                const isSelected = window.app.selectedSlotIds.has(slot.id);
                
                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-item' + (isSelected ? ' selected' : '');
                slotDiv.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:12px;margin-bottom:8px;background:${recommend ? '#e8f5e9' : '#f8f9fa'};border-radius:12px;border:1px solid ${recommend ? '#36B647' : '#e9ecef'};`;
                slotDiv.innerHTML = `
                    <div><span class="slot-time">${timeStr}</span>${recommend ? '<span class="recommended-badge">⭐ РЕКОМЕНДУЕМОЕ</span>' : ''}</div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${isSelected ? 'checked' : ''}>
                `;
                const cb = slotDiv.querySelector('.slot-select');
                cb.onchange = () => {
                    if (cb.checked) window.app.selectedSlotIds.add(slot.id);
                    else window.app.selectedSlotIds.delete(slot.id);
                    const btn = document.getElementById('confirm-booking-btn');
                    const span = document.getElementById('selected-count');
                    if (btn && span) {
                        const cnt = window.app.selectedSlotIds.size;
                        btn.style.display = cnt ? 'block' : 'none';
                        span.textContent = cnt;
                    }
                };
                block.appendChild(slotDiv);
            }
            dayDiv.appendChild(block);
        }
        container.appendChild(dayDiv);
    }
};

// --- Подтверждение записи ---
window.app.confirmBooking = async function() {
    if (!window.app.currentUser) return alert('Авторизуйтесь');
    if (!window.app.selectedSlotIds.size) return alert('Выберите слоты');
    
    const btn = document.getElementById('confirm-booking-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Сохранение...';
    }
    
    try {
        const ids = Array.from(window.app.selectedSlotIds);
        
        // Проверяем блокировку
        const blockedIds = await getBlockedSlotIds();
        if (ids.some(id => blockedIds.has(id))) {
            alert('Некоторые слоты стали недоступны. Обновите страницу.');
            window.app.selectedSlotIds.clear();
            const slots = await window.app.loadSlots();
            await window.app.renderSlots(slots);
            return;
        }
        
        // Создаём записи
        const { error } = await window.app.sb
            .from('bookings')
            .insert(ids.map(slotId => ({ slot_id: slotId, user_id: window.app.currentUser.id })));
        
        if (error) throw error;
        
        // Обновляем статус слотов
        for (const id of ids) {
            await window.app.sb
                .from('slots')
                .update({ is_available: false })
                .eq('id', id);
        }
        
        alert('✅ Успешно записано!');
        window.app.selectedSlotIds.clear();
        const slots = await window.app.loadSlots();
        await window.app.renderSlots(slots);
        
    } catch (err) {
        console.error(err);
        alert('Ошибка: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✅ Подтвердить запись (0)';
            btn.style.display = 'none';
            document.getElementById('selected-count').textContent = '0';
        }
    }
};

// --- Мои записи ---
window.app.loadMyBookings = async function() {
    const container = document.getElementById('my-bookings-list');
    if (!container) return;
    container.innerHTML = '<div style="padding:20px;text-align:center;">Загрузка...</div>';
    
    const { data: bookings } = await window.app.sb
        .from('bookings')
        .select('*, slots(*)')
        .eq('user_id', window.app.currentUser.id);
    
    if (!bookings?.length) {
        container.innerHTML = '<p style="text-align:center;padding:20px;">У вас нет записей</p>';
        return;
    }
    
    const groups = {};
    for (const b of bookings) {
        if (!b.slots) continue;
        const date = window.app.utcToMsk(b.slots.start_time);
        const key = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(b);
    }
    
    container.innerHTML = '';
    for (const [day, dayBookings] of Object.entries(groups)) {
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom:20px;border-left:3px solid #36B647;padding-left:12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom:10px;">📅 ${day}</h3>`;
        
        for (const b of dayBookings) {
            const time = window.app.utcToMsk(b.slots.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const div = document.createElement('div');
            div.className = 'booking-card';
            div.innerHTML = `
                <span>${time}</span>
                <button class="cancel-btn" data-id="${b.id}" data-slot="${b.slot_id}">Отменить</button>
            `;
            div.querySelector('.cancel-btn').onclick = async () => {
                if (confirm('Отменить запись?')) {
                    await window.app.sb.from('bookings').delete().eq('id', b.id);
                    await window.app.sb.from('slots').update({ is_available: true }).eq('id', b.slot_id);
                    await window.app.loadMyBookings();
                }
            };
            dayDiv.appendChild(div);
        }
        container.appendChild(dayDiv);
    }
};

// --- Генерация слотов на день ---
window.app.generateSlotsForDay = async function(dateStr, half) {
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return alert('Неверная дата');
    
    const dayOfWeek = target.getDay();
    const times = half === 'morning' 
        ? (window.app.SCHEDULE[dayOfWeek] || window.app.SCHEDULE[1]).morning
        : (window.app.SCHEDULE[dayOfWeek] || window.app.SCHEDULE[1]).evening;
    
    if (!times.length) return alert('Нет слотов в это половинку');
    
    let created = 0, skipped = 0, existing = 0;
    const nowMSK = window.app.getNowMSK();
    const toInsert = [];
    
    for (const time of times) {
        const [h, m] = time.split(':');
        const startMSK = new Date(target);
        startMSK.setHours(parseInt(h), parseInt(m), 0, 0);
        if (startMSK < nowMSK) { skipped++; continue; }
        
        const startUTC = window.app.mskToUtc(startMSK);
        const { data: exists } = await window.app.sb
            .from('slots')
            .select('id')
            .eq('start_time', startUTC.toISOString())
            .maybeSingle();
        if (exists) { existing++; continue; }
        
        const endUTC = new Date(startUTC);
        endUTC.setUTCHours(startUTC.getUTCHours() + 1);
        toInsert.push({
            start_time: startUTC.toISOString(),
            end_time: endUTC.toISOString(),
            is_available: true,
            is_blocked: false
        });
    }
    
    if (toInsert.length) {
        const { error } = await window.app.sb.from('slots').insert(toInsert);
        if (error) return alert('Ошибка: ' + error.message);
        created = toInsert.length;
    }
    
    alert(`✅ Создано ${created}\n⏭️ Пропущено: ${skipped}\n📌 Уже есть: ${existing}`);
    if (typeof window.app.loadAdminData === 'function') await window.app.loadAdminData();
};

// --- Генерация недели ---
window.app.generateFullWeek = async function() {
    const today = new Date();
    const daysToMon = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMon);
    
    const toInsert = [];
    const nowMSK = window.app.getNowMSK();
    
    for (let i = 0; i < 6; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dow = date.getDay();
        if (dow === 0) continue;
        const sched = window.app.SCHEDULE[dow] || window.app.SCHEDULE[1];
        const allTimes = [...sched.morning, ...sched.evening];
        
        for (const time of allTimes) {
            const [h, m] = time.split(':');
            const startMSK = new Date(date);
            startMSK.setHours(parseInt(h), parseInt(m), 0, 0);
            if (startMSK < nowMSK) continue;
            
            const startUTC = window.app.mskToUtc(startMSK);
            const endUTC = new Date(startUTC);
            endUTC.setUTCHours(startUTC.getUTCHours() + 1);
            toInsert.push({
                start_time: startUTC.toISOString(),
                end_time: endUTC.toISOString(),
                is_available: true,
                is_blocked: false
            });
        }
    }
    
    if (!toInsert.length) return alert('Нет слотов для генерации');
    
    // Убираем дубликаты внутри массива по start_time
    const unique = new Map();
    for (const slot of toInsert) {
        if (!unique.has(slot.start_time)) unique.set(slot.start_time, slot);
    }
    const finalSlots = Array.from(unique.values());
    
    const { error } = await window.app.sb.from('slots').insert(finalSlots);
    if (error) return alert('Ошибка: ' + error.message);
    alert(`✅ Создано ${finalSlots.length} слотов`);
    if (typeof window.app.loadAdminData === 'function') await window.app.loadAdminData();
};

// ============================================
// АДМИН-ПАНЕЛЬ
// ============================================

window.app.addSlotElement = function(container, slot, isBlockedByRule) {
    const start = window.app.utcToMsk(slot.start_time);
    const isAvailable = slot.is_available;
    const isBlocked = !isAvailable || slot.is_blocked || isBlockedByRule;
    let status = '';
    if (!isAvailable) status = '❌ занят';
    else if (slot.is_blocked) status = '🔒 заблокирован';
    else if (isBlockedByRule) status = '🔒 заблокирован правилами';
    
    const div = document.createElement('div');
    div.className = 'admin-slot';
    div.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:6px;background:${isBlocked ? '#f0f0f0' : '#fff'};border-radius:8px;border:1px solid ${isBlocked ? '#ffcccc' : '#e0e0e0'};`;
    div.innerHTML = `
        <span style="${isBlocked ? 'text-decoration:line-through;color:#999;' : ''}">${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} ${status}</span>
        <div style="display:flex;gap:6px;">
            ${slot.is_blocked && isAvailable ? '<button class="unblock-btn" data-id="' + slot.id + '">🔓</button>' : ''}
            ${!slot.is_blocked && isAvailable ? '<button class="block-btn" data-id="' + slot.id + '">🔒</button>' : ''}
            <button class="delete-btn" data-id="' + slot.id + '">✖</button>
        </div>
    `;
    
    div.querySelector('.unblock-btn')?.addEventListener('click', async () => {
        await window.app.sb.from('slots').update({ is_blocked: false }).eq('id', slot.id);
        await window.app.loadAdminData();
    });
    div.querySelector('.block-btn')?.addEventListener('click', async () => {
        await window.app.sb.from('slots').update({ is_blocked: true }).eq('id', slot.id);
        await window.app.loadAdminData();
    });
    div.querySelector('.delete-btn')?.addEventListener('click', async () => {
        if (confirm('Удалить слот?')) {
            await window.app.sb.from('bookings').delete().eq('slot_id', slot.id);
            await window.app.sb.from('slots').delete().eq('id', slot.id);
            await window.app.loadAdminData();
        }
    });
    container.appendChild(div);
};

window.app.loadAdminData = async function() {
    const slotsDiv = document.getElementById('admin-slots');
    const bookingsDiv = document.getElementById('admin-bookings');
    if (slotsDiv) slotsDiv.innerHTML = '<div>Загрузка...</div>';
    if (bookingsDiv) bookingsDiv.innerHTML = '<div>Загрузка...</div>';
    
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 8);
    
    const [slotsRes, bookingsRes, profilesRes] = await Promise.all([
        window.app.sb.from('slots').select('*').gte('start_time', today.toISOString()).lte('start_time', end.toISOString()).order('start_time'),
        window.app.sb.from('bookings').select('*'),
        window.app.sb.from('profiles').select('*')
    ]);
    
    const slots = slotsRes.data || [];
    const bookings = bookingsRes.data || [];
    const profiles = profilesRes.data || [];
    
    const blockedIds = await getBlockedSlotIds();
    const slotsMap = new Map(slots.map(s => [s.id, s]));
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    
    // Слоты
    if (slotsDiv) {
        if (!slots.length) slotsDiv.innerHTML = '<p>Нет слотов</p>';
        else {
            slotsDiv.innerHTML = '';
            const groups = {};
            for (const s of slots) {
                const d = window.app.utcToMsk(s.start_time);
                const key = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                if (!groups[key]) groups[key] = [];
                groups[key].push(s);
            }
            
            for (const [day, daySlots] of Object.entries(groups)) {
                const dateStr = window.app.utcToMsk(daySlots[0].start_time).toISOString().split('T')[0];
                const morning = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() < 15);
                const evening = daySlots.filter(s => window.app.utcToMsk(s.start_time).getHours() >= 15);
                
                const dayDiv = document.createElement('div');
                dayDiv.className = 'admin-day';
                dayDiv.innerHTML = `
                    <div class="admin-day-header">
                        <h3 class="admin-day-title">📅 ${day}</h3>
                        <div class="half-buttons">
                            <button class="block-morning" data-day="${dateStr}" style="background:#ff9800;padding:4px 8px;border-radius:6px;font-size:10px;">🔒 Утро</button>
                            <button class="unblock-morning" data-day="${dateStr}" style="background:#36B647;padding:4px 8px;border-radius:6px;font-size:10px;">🔓 Утро</button>
                            <button class="block-evening" data-day="${dateStr}" style="background:#ff9800;padding:4px 8px;border-radius:6px;font-size:10px;">🔒 Вечер</button>
                            <button class="unblock-evening" data-day="${dateStr}" style="background:#36B647;padding:4px 8px;border-radius:6px;font-size:10px;">🔓 Вечер</button>
                        </div>
                    </div>
                `;
                
                if (morning.length) {
                    const div = document.createElement('div');
                    div.innerHTML = '<div class="half-title">☀️ Утро</div>';
                    const cont = document.createElement('div');
                    morning.forEach(s => window.app.addSlotElement(cont, s, blockedIds.has(s.id)));
                    div.appendChild(cont);
                    dayDiv.appendChild(div);
                }
                if (evening.length) {
                    const div = document.createElement('div');
                    div.innerHTML = '<div class="half-title">🌙 Вечер</div>';
                    const cont = document.createElement('div');
                    evening.forEach(s => window.app.addSlotElement(cont, s, blockedIds.has(s.id)));
                    div.appendChild(cont);
                    dayDiv.appendChild(div);
                }
                slotsDiv.appendChild(dayDiv);
                
                dayDiv.querySelector('.block-morning')?.addEventListener('click', async () => {
                    if (!confirm('Заблокировать всё утро?')) return;
                    const dow = new Date(dateStr).getDay();
                    const times = (window.app.SCHEDULE[dow] || window.app.SCHEDULE[1]).morning;
                    for (const t of times) {
                        const [h,m] = t.split(':');
                        const ms = new Date(dateStr);
                        ms.setHours(parseInt(h), parseInt(m), 0, 0);
                        const utc = window.app.mskToUtc(ms);
                        const iso = utc.toISOString();
                        const { data: exist } = await window.app.sb.from('slots').select('id').eq('start_time', iso);
                        if (exist?.length) await window.app.sb.from('slots').update({ is_blocked: true }).eq('start_time', iso);
                        else {
                            const end = new Date(utc);
                            end.setUTCHours(utc.getUTCHours() + 1);
                            await window.app.sb.from('slots').insert({ start_time: iso, end_time: end.toISOString(), is_available: true, is_blocked: true });
                        }
                    }
                    await window.app.loadAdminData();
                });
                dayDiv.querySelector('.unblock-morning')?.addEventListener('click', async () => {
                    if (!confirm('Разблокировать всё утро?')) return;
                    const start = window.app.mskToUtc(new Date(`${dateStr}T00:00:00`));
                    const end = window.app.mskToUtc(new Date(`${dateStr}T12:00:00`));
                    await window.app.sb.from('slots').update({ is_blocked: false }).gte('start_time', start.toISOString()).lt('start_time', end.toISOString());
                    await window.app.loadAdminData();
                });
                dayDiv.querySelector('.block-evening')?.addEventListener('click', async () => {
                    if (!confirm('Заблокировать весь вечер?')) return;
                    const dow = new Date(dateStr).getDay();
                    const times = (window.app.SCHEDULE[dow] || window.app.SCHEDULE[1]).evening;
                    for (const t of times) {
                        const [h,m] = t.split(':');
                        const ms = new Date(dateStr);
                        ms.setHours(parseInt(h), parseInt(m), 0, 0);
                        const utc = window.app.mskToUtc(ms);
                        const iso = utc.toISOString();
                        const { data: exist } = await window.app.sb.from('slots').select('id').eq('start_time', iso);
                        if (exist?.length) await window.app.sb.from('slots').update({ is_blocked: true }).eq('start_time', iso);
                        else {
                            const end = new Date(utc);
                            end.setUTCHours(utc.getUTCHours() + 1);
                            await window.app.sb.from('slots').insert({ start_time: iso, end_time: end.toISOString(), is_available: true, is_blocked: true });
                        }
                    }
                    await window.app.loadAdminData();
                });
                dayDiv.querySelector('.unblock-evening')?.addEventListener('click', async () => {
                    if (!confirm('Разблокировать весь вечер?')) return;
                    const start = window.app.mskToUtc(new Date(`${dateStr}T12:00:00`));
                    const end = window.app.mskToUtc(new Date(`${dateStr}T23:59:59`));
                    await window.app.sb.from('slots').update({ is_blocked: false }).gte('start_time', start.toISOString()).lt('start_time', end.toISOString());
                    await window.app.loadAdminData();
                });
            }
        }
    }
    
    // Все записи
    if (bookingsDiv) {
        const enriched = [];
        for (const b of bookings) {
            const slot = slotsMap.get(b.slot_id);
            if (!slot) continue;
            const profile = profilesMap.get(b.user_id);
            enriched.push({ ...b, slot, profile });
        }
        enriched.sort((a,b) => new Date(a.slot.start_time) - new Date(b.slot.start_time));
        
        if (!enriched.length) bookingsDiv.innerHTML = '<h3>Все записи</h3><p>Нет записей</p>';
        else {
            bookingsDiv.innerHTML = '<h3>Все записи</h3>';
            const groups = {};
            for (const e of enriched) {
                const d = window.app.utcToMsk(e.slot.start_time);
                const key = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
                if (!groups[key]) groups[key] = [];
                groups[key].push(e);
            }
            for (const [day, dayBookings] of Object.entries(groups)) {
                const dayDiv = document.createElement('div');
                dayDiv.style.cssText = 'margin-bottom:20px;border-left:3px solid #36B647;padding-left:12px;';
                dayDiv.innerHTML = `<h3 style="margin-bottom:10px;">📅 ${day}</h3>`;
                for (const b of dayBookings) {
                    const time = window.app.utcToMsk(b.slot.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px;margin-bottom:8px;background:#f9f9f9;border-radius:8px;';
                    div.innerHTML = `
                        <div><strong>${b.profile?.name || 'Неизвестно'}</strong><br>📞 ${b.profile?.phone || 'нет телефона'}<br>🕐 ${time}</div>
                        <button class="delete-booking" data-id="${b.id}" data-slot="${b.slot_id}" style="background:#dc3545;padding:8px 16px;border-radius:8px;">✖</button>
                    `;
                    div.querySelector('.delete-booking').onclick = async () => {
                        if (confirm('Удалить запись?')) {
                            await window.app.sb.from('bookings').delete().eq('id', b.id);
                            await window.app.sb.from('slots').update({ is_available: true }).eq('id', b.slot_id);
                            await window.app.loadAdminData();
                        }
                    };
                    dayDiv.appendChild(div);
                }
                bookingsDiv.appendChild(dayDiv);
            }
        }
    }
};
