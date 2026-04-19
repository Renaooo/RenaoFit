// ============================================
// МОДУЛЬ АДМИН-ПАНЕЛИ (КЛИЕНТЫ)
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getGoalDisplay(goal) {
    if (goal === 'wellness') {
        return '🌿 Здоровье и хорошее самочувствие';
    }
    return '🔥 Активное снижение веса';
}

window.app.loadClientsList = async function() {
    const adminId = 'edafd00c-3f7d-47aa-8d69-9efbe95de98e';
    
    const { data: profiles, error } = await window.app.sb
        .from('profiles')
        .select('*')
        .neq('id', adminId)
        .order('name');
    
    if (error) {
        console.error('Ошибка загрузки клиентов:', error);
        return [];
    }
    
    return profiles || [];
};

window.app.renderClientsList = async function() {
    const container = document.getElementById('admin-clients-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка клиентов...</div>';
    
    const clients = await window.app.loadClientsList();
    
    if (!clients || clients.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет зарегистрированных клиентов</p>';
        return;
    }
    
    const { data: allBookings } = await window.app.sb
        .from('bookings')
        .select('user_id');
    
    const bookingCounts = {};
    allBookings?.forEach(booking => {
        bookingCounts[booking.user_id] = (bookingCounts[booking.user_id] || 0) + 1;
    });
    
    container.innerHTML = '';
    
    for (let client of clients) {
        const count = bookingCounts[client.id] || 0;
        
        const clientCard = document.createElement('div');
        clientCard.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fff; cursor: pointer; transition: all 0.2s;';
        clientCard.onmouseover = () => clientCard.style.backgroundColor = '#f8f9fa';
        clientCard.onmouseout = () => clientCard.style.backgroundColor = '#fff';
        
        const goalDisplay = getGoalDisplay(client.fitness_goal);
        
        clientCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <strong style="font-size: 16px;">👤 ${escapeHtml(client.name) || 'Без имени'}</strong><br>
                    <span style="color: #666; font-size: 14px;">📞 ${escapeHtml(client.phone) || 'нет телефона'}</span><br>
                    <span style="color: #36B647; font-size: 13px;">🎯 ${goalDisplay}</span>
                    ${client.weight ? `<br><span style="color: #36B647; font-size: 13px;">⚖️ ${client.weight} кг</span>` : ''}
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="background: #36B647; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${count} записей</span>
                    <button class="delete-client-btn" data-id="${client.id}" data-name="${escapeHtml(client.name || client.phone || 'клиента')}" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                </div>
            </div>
        `;
        
        const clientInfoDiv = clientCard.querySelector('div:first-child');
        clientInfoDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            window.app.showClientDetails(client);
        });
        
        const deleteBtn = clientCard.querySelector('.delete-client-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const clientName = client.name || client.phone || 'клиента';
            if (confirm(`⚠️ Удалить клиента "${clientName}"?\n\nЭто действие удалит все записи клиента и его профиль.`)) {
                await window.app.sb.from('bookings').delete().eq('user_id', client.id);
                await window.app.sb.from('profiles').delete().eq('id', client.id);
                alert(`✅ Клиент "${clientName}" удален`);
                await window.app.renderClientsList();
                if (typeof window.app.loadAdminData === 'function') {
                    await window.app.loadAdminData();
                }
            }
        });
        
        container.appendChild(clientCard);
    }
};

function getStartOfWeekForClient(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

window.app.showClientDetails = async function(client) {
    const { data: bookings, error: bookingsError } = await window.app.sb
        .from('bookings')
        .select(`
            id,
            slot_id,
            slots (start_time, end_time)
        `)
        .eq('user_id', client.id)
        .order('slot_id');
    
    if (bookingsError) {
        console.error('Ошибка загрузки записей клиента:', bookingsError);
        alert('Ошибка загрузки записей');
        return;
    }
    
    function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day === 0 ? 6 : day - 1);
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    
    let currentWeekOffset = 0;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 16px;
        max-width: 550px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        padding: 20px;
    `;
    
    async function loadProtocolForWeek(offset) {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (offset * 7));
        const startOfWeek = getStartOfWeek(targetDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const startDateStr = formatLocalDate(startOfWeek);
        const endDateStr = formatLocalDate(endOfWeek);
        
        const weekStartFormatted = startOfWeek.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
        const weekEndFormatted = endOfWeek.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
        const weekTitle = offset === 0 ? 'Текущая неделя' : `${weekStartFormatted} - ${weekEndFormatted}`;
        
        const { data: weeklyReports } = await window.app.sb
            .from('daily_reports')
            .select('*')
            .eq('user_id', client.id)
            .gte('report_date', startDateStr)
            .lte('report_date', endDateStr);
        
        const targetStrength = client.target_strength_weekly || 3;
        const targetCardio = client.target_cardio_weekly || 1;
        const dailyNorm = client.min_steps || 10000;
        const isWellnessMode = client.fitness_goal === 'wellness';
        
        let actualStrength = 0, actualCardio = 0, socialDays = 0;
        let lowStepsDays = 0;
        let totalDays = 0;
        
        weeklyReports?.forEach(r => {
            totalDays++;
            if (r.training_type === 'strength') actualStrength++;
            if (r.training_type === 'cardio') actualCardio++;
            if (r.social_event) socialDays++;
            const normForDay = r.norm_steps || dailyNorm;
            if ((r.steps || 0) < normForDay) lowStepsDays++;
        });
        
        const strengthOk = actualStrength >= targetStrength;
        const cardioOk = actualCardio >= targetCardio;
        const socialOk = socialDays <= 1;
        
        let stepsCirclesHtml = '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;">';
        const daysOfWeek = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dateStr = formatLocalDate(dayDate);
            const report = weeklyReports?.find(r => r.report_date === dateStr);
            const steps = report?.steps || 0;
            const normForThisDay = report?.norm_steps || dailyNorm;
            const isOk = steps >= normForThisDay;
            const hasData = !!report;
            
            stepsCirclesHtml += `
                <div style="text-align: center; width: 40px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: ${hasData ? (isOk ? '#36B647' : '#dc3545') : '#e0e0e0'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                        ${hasData ? (isOk ? '✓' : '✗') : '?'}
                    </div>
                    <div style="font-size: 10px; color: #666; margin-top: 4px;">${daysOfWeek[i]}</div>
                </div>
            `;
        }
        stepsCirclesHtml += '</div>';
        
        return { html: `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <button class="protocol-prev-week" style="background: #36B647; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; ${offset <= -2 ? 'opacity: 0.5; pointer-events: none;' : ''}">← Пред. неделя</button>
                <div style="font-weight: 500;">${weekTitle}</div>
                <button class="protocol-next-week" style="background: #36B647; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; ${offset >= 0 ? 'opacity: 0.5; pointer-events: none;' : ''}">След. неделя →</button>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin: 15px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px;">📋 Протокол за эту неделю</h3>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">👣 Шаги (норма ${dailyNorm.toLocaleString()})</div>
                    ${stepsCirclesHtml}
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>💪 Силовые:</span>
                    <span><strong>${actualStrength} / ${targetStrength}</strong> ${strengthOk ? '✅' : '⚠️'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>🏃 Кардио:</span>
                    <span><strong>${actualCardio} / ${targetCardio}</strong> ${cardioOk ? '✅' : '⚠️'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>🎉 Социальные приемы пищи:</span>
                    <span><strong>${socialDays} дней</strong> ${socialDays <= 1 ? '✅' : '⚠️'}</span>
                </div>
                ${!isWellnessMode ? `
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <span>📉 Дней с шагами ниже нормы:</span>
                    <span><strong style="color: ${lowStepsDays > 0 ? '#dc3545' : '#36B647'};">${lowStepsDays} дней</strong></span>
                </div>
                ` : ''}
            </div>
            
            <div id="client-comments-section" style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin: 15px 0;"></div>
        `, reports: weeklyReports };
    }
    
    let weightHistoryHtml = '';
    if (client.fitness_goal !== 'wellness') {
        const { data: weightHistory } = await window.app.sb
            .from('weight_history')
            .select('weight, weigh_date')
            .eq('user_id', client.id)
            .order('weigh_date', { ascending: false })
            .limit(5);
        
        if (weightHistory && weightHistory.length > 0) {
            weightHistoryHtml = `
                <div style="background: #f8f9fa; border-radius: 12px; padding: 12px; margin: 15px 0;">
                    <strong>📊 История весов:</strong>
                    <div style="margin-top: 8px;">
            `;
            for (let w of weightHistory) {
                const date = new Date(w.weigh_date).toLocaleDateString();
                weightHistoryHtml += `<div style="font-size: 14px; padding: 4px 0;">${date}: <strong>${w.weight} кг</strong></div>`;
            }
            weightHistoryHtml += `</div></div>`;
        }
    }
    
    let bookingsHtml = '';
    if (bookings && bookings.length > 0) {
        const groupedByDay = {};
        bookings.forEach(booking => {
            const date = new Date(booking.slots.start_time);
            const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'numeric' });
            if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
            groupedByDay[dayKey].push(booking);
        });
        
        for (let [day, dayBookings] of Object.entries(groupedByDay)) {
            bookingsHtml += `<div style="margin-top: 10px;"><strong style="font-size: 13px; color: #36B647;">📅 ${escapeHtml(day)}</strong></div>`;
            
            const morning = dayBookings.filter(b => new Date(b.slots.start_time).getHours() < 15);
            const evening = dayBookings.filter(b => new Date(b.slots.start_time).getHours() >= 15);
            
            if (morning.length > 0) {
                bookingsHtml += '<div style="margin-top: 5px; margin-left: 8px;"><span style="font-size: 12px; color: #666;">☀️ Утро</span></div>';
                morning.forEach(booking => {
                    const start = new Date(booking.slots.start_time);
                    const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                    bookingsHtml += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0 6px 16px; border-bottom: 1px solid #f0f0f0;">
                            <span>🕐 ${timeStr}</span>
                            <button class="delete-booking-from-client" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">✖</button>
                        </div>
                    `;
                });
            }
            
            if (evening.length > 0) {
                bookingsHtml += '<div style="margin-top: 8px; margin-left: 8px;"><span style="font-size: 12px; color: #666;">🌙 Вечер</span></div>';
                evening.forEach(booking => {
                    const start = new Date(booking.slots.start_time);
                    const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                    bookingsHtml += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0 6px 16px; border-bottom: 1px solid #f0f0f0;">
                            <span>🕐 ${timeStr}</span>
                            <button class="delete-booking-from-client" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #dc3545; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">✖</button>
                        </div>
                    `;
                });
            }
        }
    } else {
        bookingsHtml = '<p style="text-align: center; padding: 20px;">Нет записей</p>';
    }
    
    const goalDisplay = getGoalDisplay(client.fitness_goal);
    const isWellnessMode = client.fitness_goal === 'wellness';
    
    let currentOffset = 0;
    let protocolData = await loadProtocolForWeek(currentOffset);
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">👤 ${escapeHtml(client.name) || 'Без имени'}</h2>
            <button id="close-client-modal" style="background: none; border: none; font-size: 24px; cursor: pointer;">✖</button>
        </div>
        
        <div style="margin-bottom: 20px;">
            <p><strong>📞 Телефон:</strong> ${escapeHtml(client.phone) || 'не указан'}</p>
            <p><strong>🎯 Текущая цель:</strong> ${goalDisplay}</p>
            ${!isWellnessMode && client.weight ? `<p><strong>⚖️ Текущий вес:</strong> ${client.weight} кг</p>` : ''}
        </div>
        
        ${weightHistoryHtml}
        
        <div id="protocol-container">
            ${protocolData.html}
        </div>
        
        <div id="client-comments-section" style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin: 15px 0;"></div>
        
        <div style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px;">✏️ Редактировать профиль</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 8px;">🎯 Цель тренировок</label>
                <div style="display: flex; gap: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="edit-goal" value="weight_loss" ${client.fitness_goal !== 'wellness' ? 'checked' : ''}> 🔥 Активное снижение веса
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="edit-goal" value="wellness" ${client.fitness_goal === 'wellness' ? 'checked' : ''}> 🌿 Здоровье и хорошее самочувствие
                    </label>
                </div>
            </div>
            
            ${!isWellnessMode ? `
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Вес (кг)</label>
                <input type="number" id="edit-weight" step="0.1" value="${client.weight || ''}" placeholder="например: 75.5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            ` : ''}
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Абонемент до</label>
                <input type="date" id="edit-subscription" value="${client.subscription_until || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Минимальное количество шагов в день</label>
                <input type="number" id="edit-min-steps" value="${client.min_steps || 10000}" placeholder="например: 10000" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Норма силовых в неделю</label>
                <input type="number" id="edit-target-strength" value="${client.target_strength_weekly || 3}" placeholder="например: 3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Норма кардио в неделю</label>
                <input type="number" id="edit-target-cardio" value="${client.target_cardio_weekly || 1}" placeholder="например: 1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
            <button id="save-profile-btn" style="background: #36B647; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; width: 100%; margin-top: 5px;">💾 Сохранить</button>
        </div>
        
        <div>
            <h3 style="margin: 0 0 10px 0; font-size: 16px;">📋 Записи клиента</h3>
            <div id="client-bookings-list" style="max-height: 200px; overflow-y: auto;">
                ${bookingsHtml}
            </div>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    async function loadComments(weekOffset) {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (weekOffset * 7));
        const startOfWeek = getStartOfWeek(targetDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const startDateStr = formatLocalDate(startOfWeek);
        const endDateStr = formatLocalDate(endOfWeek);
        
        const { data: weeklyReports } = await window.app.sb
            .from('daily_reports')
            .select('*')
            .eq('user_id', client.id)
            .gte('report_date', startDateStr)
            .lte('report_date', endDateStr);
        
        const commentsSection = document.getElementById('client-comments-section');
        if (weeklyReports && weeklyReports.length > 0) {
            const reportsWithComments = weeklyReports.filter(r => r.notes && r.notes.trim());
            if (reportsWithComments.length > 0) {
                let commentsHtml = '<h3 style="margin: 0 0 12px 0; font-size: 16px;">💬 Комментарии клиента</h3>';
                for (let r of reportsWithComments) {
                    const date = new Date(r.report_date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'numeric' });
                    commentsHtml += `
                        <div style="margin-bottom: 12px; padding: 8px; background: white; border-radius: 8px; border-left: 3px solid #36B647;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">📅 ${date}</div>
                            <div style="font-size: 14px;">${escapeHtml(r.notes)}</div>
                        </div>
                    `;
                }
                commentsSection.innerHTML = commentsHtml;
            } else {
                commentsSection.innerHTML = '';
            }
        } else {
            commentsSection.innerHTML = '';
        }
    }
    
    await loadComments(0);
    
    const protocolContainer = document.getElementById('protocol-container');
    
    protocolContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('protocol-prev-week')) {
            if (currentOffset > -2) {
                currentOffset--;
                const newProtocol = await loadProtocolForWeek(currentOffset);
                protocolContainer.innerHTML = newProtocol.html;
                await loadComments(currentOffset);
            }
        } else if (e.target.classList.contains('protocol-next-week')) {
            if (currentOffset < 0) {
                currentOffset++;
                const newProtocol = await loadProtocolForWeek(currentOffset);
                protocolContainer.innerHTML = newProtocol.html;
                await loadComments(currentOffset);
            }
        }
    });
    
    const closeBtn = modalContent.querySelector('#close-client-modal');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
    const saveBtn = modalContent.querySelector('#save-profile-btn');
    saveBtn.addEventListener('click', async () => {
        const goalRadio = modalContent.querySelector('input[name="edit-goal"]:checked');
        const newGoal = goalRadio ? goalRadio.value : 'weight_loss';
        
        const weight = modalContent.querySelector('#edit-weight')?.value;
        const subscriptionUntil = modalContent.querySelector('#edit-subscription')?.value;
        const minSteps = modalContent.querySelector('#edit-min-steps')?.value;
        const targetStrengthWeekly = modalContent.querySelector('#edit-target-strength')?.value;
        const targetCardioWeekly = modalContent.querySelector('#edit-target-cardio')?.value;
        
        const updateData = {
            fitness_goal: newGoal
        };
        
        if (weight && weight !== '' && newGoal !== 'wellness') updateData.weight = parseFloat(weight);
        if (subscriptionUntil && subscriptionUntil !== '') updateData.subscription_until = subscriptionUntil;
        if (minSteps && minSteps !== '') updateData.min_steps = parseInt(minSteps);
        if (targetStrengthWeekly && targetStrengthWeekly !== '') updateData.target_strength_weekly = parseInt(targetStrengthWeekly);
        if (targetCardioWeekly && targetCardioWeekly !== '') updateData.target_cardio_weekly = parseInt(targetCardioWeekly);
        
        if (weight && weight !== client.weight && newGoal !== 'wellness') {
            await window.app.sb.from('weight_history').insert({
                user_id: client.id,
                weight: parseFloat(weight),
                weigh_date: new Date().toISOString().split('T')[0]
            });
        }
        
        const { error: updateError } = await window.app.sb
            .from('profiles')
            .update(updateData)
            .eq('id', client.id);
        
        if (updateError) {
            alert('Ошибка сохранения: ' + updateError.message);
        } else {
            alert('✅ Профиль обновлен!');
            modal.remove();
            await window.app.renderClientsList();
        }
    });
    
    const deleteButtons = modalContent.querySelectorAll('.delete-booking-from-client');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookingId = btn.dataset.id;
            const slotId = btn.dataset.slot;
            
            if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                await window.app.sb.from('bookings').delete().eq('id', bookingId);
                await window.app.sb.from('slots').update({ is_available: true }).eq('id', slotId);
                alert('Запись удалена, слот свободен');
                modal.remove();
                await window.app.renderClientsList();
                if (typeof window.app.loadAdminData === 'function') {
                    await window.app.loadAdminData();
                }
            }
        });
    });
};
