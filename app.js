// --- Инициализация Supabase ---
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aW9jenRpb2V6b2JnZmt0ZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjMwNjYsImV4cCI6MjA4OTk5OTA2Nn0.NT66Ur7c8hnIjY5aZGeuSYPEM--coy9nAT7yLEK9nZ8';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);




// --- DOM элементы ---
const screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    booking: document.getElementById('booking-screen'),
    myBookings: document.getElementById('my-bookings-screen'),
    dailyReport: document.getElementById('daily-report-screen'),
    profile: document.getElementById('profile-screen'),
    admin: document.getElementById('admin-screen')
};

let currentUser = null;
let selectedSlotIds = new Set();
let isLoggingIn = false;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// --- Функция переключения экранов ---
function showScreen(name) {
    Object.keys(screens).forEach(k => {
        if (screens[k]) screens[k].classList.remove('active');
    });
    if (screens[name]) screens[name].classList.add('active');
}




// --- Очистка телефона ---
function cleanPhone(phone) {
    return phone.replace(/[^0-9]/g, '');
}




// --- Авторизация / регистрация ---
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
    
    await sb.from('profiles').upsert({ id: data.user.id, phone: phone, name: name });
    return data.user;
}




// --- Загрузка свободных слотов ---
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




// --- Отображение слотов с подсветкой рекомендуемых ---
async function renderSlots(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет свободных слотов</p>';
        return;
    }
    
    const { data: allSlots } = await sb
        .from('slots')
        .select('start_time, is_available')
        .gte('start_time', new Date().toISOString())
        .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    
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
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${displayDay}</h3>`;
        
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            morning.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const hasAdjacent = hasAdjacentBooking(dayKey, timeStr);
                
                const slotDiv = document.createElement('div');
                slotDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: ${hasAdjacent ? '#fff9e6' : '#f8f9fa'}; border-radius: 12px; border: 1px solid ${hasAdjacent ? '#ffc107' : '#e9ecef'};`;
                
                let badgeHtml = '';
                if (hasAdjacent) {
                    badgeHtml = '<span style="background: #ffc107; color: #333; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>';
                }
                
                slotDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 500;">${timeStr}</span>
                        ${badgeHtml}
                    </div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''}>
                `;
                
                const cb = slotDiv.querySelector('.slot-select');
                cb.addEventListener('change', () => {
                    if (cb.checked) selectedSlotIds.add(slot.id);
                    else selectedSlotIds.delete(slot.id);
                    const btn = document.getElementById('confirm-booking-btn');
                    if (btn) btn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
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
                slotDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: ${hasAdjacent ? '#fff9e6' : '#f8f9fa'}; border-radius: 12px; border: 1px solid ${hasAdjacent ? '#ffc107' : '#e9ecef'};`;
                
                let badgeHtml = '';
                if (hasAdjacent) {
                    badgeHtml = '<span style="background: #ffc107; color: #333; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ РЕКОМЕНДУЕМОЕ</span>';
                }
                
                slotDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 500;">${timeStr}</span>
                        ${badgeHtml}
                    </div>
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''}>
                `;
                
                const cb = slotDiv.querySelector('.slot-select');
                cb.addEventListener('change', () => {
                    if (cb.checked) selectedSlotIds.add(slot.id);
                    else selectedSlotIds.delete(slot.id);
                    const btn = document.getElementById('confirm-booking-btn');
                    if (btn) btn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
                });
                eveningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(eveningDiv);
        }
        
        container.appendChild(dayDiv);
    }
}




// --- Подтверждение записи ---
async function confirmBooking() {
    if (!currentUser) return;
    if (selectedSlotIds.size === 0) return alert('Выберите слоты');
    
    for (let slotId of selectedSlotIds) {
        await sb.from('slots').update({ is_available: false }).eq('id', slotId);
    }
    
    const bookings = Array.from(selectedSlotIds).map(slotId => ({ slot_id: slotId, user_id: currentUser.id }));
    const { error } = await sb.from('bookings').insert(bookings);
    
    if (error) {
        for (let slotId of selectedSlotIds) {
            await sb.from('slots').update({ is_available: true }).eq('id', slotId);
        }
        alert('Ошибка записи');
    } else {
        alert('Успешно записано!');
        selectedSlotIds.clear();
        showScreen('menu');
    }
}




// --- Загрузка моих записей ---
async function loadMyBookings() {
    const { data: bookings } = await sb
        .from('bookings')
        .select('id, slot_id, slots(start_time, end_time)')
        .eq('user_id', currentUser.id);
    
    const container = document.getElementById('my-bookings-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<p style="text-align: center;">Нет записей</p>';
        return;
    }
    
    const groupedByDay = {};
    bookings.forEach(b => {
        const date = new Date(b.slots.start_time);
        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
        groupedByDay[dayKey].push(b);
    });
    
    for (let [day, dayBookings] of Object.entries(groupedByDay)) {
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 15px;';
        dayDiv.innerHTML = `<h3 style="font-size: 16px;">📅 ${day}</h3>`;
        
        dayBookings.forEach(b => {
            const start = new Date(b.slots.start_time);
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;';
            div.innerHTML = `
                <span>${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <button class="cancel-btn" data-id="${b.id}" data-slot="${b.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 5px 12px; border-radius: 6px;">Отменить</button>
            `;
            const cancelBtn = div.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', async () => {
                if (confirm('Отменить запись?')) {
                    await sb.from('bookings').delete().eq('id', b.id);
                    await sb.from('slots').update({ is_available: true }).eq('id', b.slot_id);
                    await loadMyBookings();
                }
            });
            dayDiv.appendChild(div);
        });
        container.appendChild(dayDiv);
    }
}




// --- ЕЖЕДНЕВНЫЙ ОТЧЕТ ---
let currentTrainingType = '';
let currentTrainingTime = '';
let currentSocialEvent = false;
let currentPreMeal = '';
let currentPostMeal = '';

function initDailyReportUI() {
    document.getElementById('training-strength')?.addEventListener('click', () => setTrainingType('strength'));
    document.getElementById('training-cardio')?.addEventListener('click', () => setTrainingType('cardio'));
    document.getElementById('training-rest')?.addEventListener('click', () => setTrainingType('rest'));
    
    document.getElementById('time-morning')?.addEventListener('click', () => setTrainingTime('morning'));
    document.getElementById('time-day')?.addEventListener('click', () => setTrainingTime('day'));
    document.getElementById('time-evening')?.addEventListener('click', () => setTrainingTime('evening'));
    
    document.getElementById('social-no')?.addEventListener('click', () => setSocialEvent(false));
    document.getElementById('social-yes')?.addEventListener('click', () => setSocialEvent(true));
    
    document.getElementById('pre-yes')?.addEventListener('click', () => setPreMeal('yes'));
    document.getElementById('pre-no')?.addEventListener('click', () => setPreMeal('no'));
    
    document.getElementById('post-yes')?.addEventListener('click', () => setPostMeal('yes'));
    document.getElementById('post-no')?.addEventListener('click', () => setPostMeal('no'));
    
    document.getElementById('save-daily-report-btn')?.addEventListener('click', saveDailyReport);
}

function setTrainingType(type) {
    currentTrainingType = type;
    const btns = {
        strength: document.getElementById('training-strength'),
        cardio: document.getElementById('training-cardio'),
        rest: document.getElementById('training-rest')
    };
    
    Object.entries(btns).forEach(([key, btn]) => {
        if (btn) {
            btn.style.background = type === key ? '#007aff' : '#e9ecef';
            btn.style.color = type === key ? 'white' : '#1e1e1e';
        }
    });
    
    document.getElementById('training-type').value = type;
    
    const timeContainer = document.getElementById('training-time-container');
    const preMealContainer = document.getElementById('pre-meal-container');
    const postMealContainer = document.getElementById('post-meal-container');
    
    if (type === 'rest') {
        if (timeContainer) timeContainer.style.display = 'none';
        if (preMealContainer) preMealContainer.style.display = 'none';
        if (postMealContainer) postMealContainer.style.display = 'none';
        currentTrainingTime = '';
        currentPreMeal = '';
        currentPostMeal = '';
    } else {
        if (timeContainer) timeContainer.style.display = 'block';
        if (preMealContainer) preMealContainer.style.display = 'block';
        if (postMealContainer) postMealContainer.style.display = 'block';
    }
}

function setTrainingTime(time) {
    currentTrainingTime = time;
    const btns = {
        morning: document.getElementById('time-morning'),
        day: document.getElementById('time-day'),
        evening: document.getElementById('time-evening')
    };
    
    Object.entries(btns).forEach(([key, btn]) => {
        if (btn) {
            btn.style.background = time === key ? '#007aff' : '#e9ecef';
            btn.style.color = time === key ? 'white' : '#1e1e1e';
        }
    });
    document.getElementById('training-time').value = time;
}

function setSocialEvent(value) {
    currentSocialEvent = value;
    const noBtn = document.getElementById('social-no');
    const yesBtn = document.getElementById('social-yes');
    if (noBtn) {
        noBtn.style.background = !value ? '#007aff' : '#e9ecef';
        noBtn.style.color = !value ? 'white' : '#1e1e1e';
    }
    if (yesBtn) {
        yesBtn.style.background = value ? '#007aff' : '#e9ecef';
        yesBtn.style.color = value ? 'white' : '#1e1e1e';
    }
    document.getElementById('social-event').value = value;
}

function setPreMeal(value) {
    currentPreMeal = value;
    const yesBtn = document.getElementById('pre-yes');
    const noBtn = document.getElementById('pre-no');
    if (yesBtn) {
        yesBtn.style.background = value === 'yes' ? '#34c759' : '#e9ecef';
        yesBtn.style.color = value === 'yes' ? 'white' : '#1e1e1e';
    }
    if (noBtn) {
        noBtn.style.background = value === 'no' ? '#ff3b30' : '#e9ecef';
        noBtn.style.color = value === 'no' ? 'white' : '#1e1e1e';
    }
    document.getElementById('pre-meal').value = value;
}

function setPostMeal(value) {
    currentPostMeal = value;
    const yesBtn = document.getElementById('post-yes');
    const noBtn = document.getElementById('post-no');
    if (yesBtn) {
        yesBtn.style.background = value === 'yes' ? '#34c759' : '#e9ecef';
        yesBtn.style.color = value === 'yes' ? 'white' : '#1e1e1e';
    }
    if (noBtn) {
        noBtn.style.background = value === 'no' ? '#ff3b30' : '#e9ecef';
        noBtn.style.color = value === 'no' ? 'white' : '#1e1e1e';
    }
    document.getElementById('post-meal').value = value;
}

async function saveDailyReport() {
    const steps = parseInt(document.getElementById('daily-steps').value);
    const trainingType = currentTrainingType;
    const trainingTime = currentTrainingTime;
    const socialEvent = currentSocialEvent;
    const preMeal = currentPreMeal === 'yes' ? true : (currentPreMeal === 'no' ? false : null);
    const postMeal = currentPostMeal === 'yes' ? true : (currentPostMeal === 'no' ? false : null);
    const notes = document.getElementById('daily-notes').value;
    
    if (!steps || steps <= 0) {
        alert('Введите количество шагов');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await sb
        .from('daily_reports')
        .upsert({
            user_id: currentUser.id,
            report_date: today,
            steps: steps,
            training_type: trainingType === 'rest' ? 'rest' : trainingType,
            training_time: trainingTime || null,
            social_event: socialEvent,
            pre_meal_compliant: preMeal,
            post_meal_compliant: postMeal,
            notes: notes
        }, { onConflict: 'user_id,report_date' });
    
    if (error) {
        alert('Ошибка сохранения: ' + error.message);
    } else {
        alert('✅ Отчет сохранен!');
        await loadWeeklyProgress();
        await updateWeeklyMessage();
    }
}

async function loadWeeklyProgress() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const { data: reports } = await sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('report_date', startOfWeek.toISOString().split('T')[0])
        .lte('report_date', endOfWeek.toISOString().split('T')[0])
        .order('report_date');
    
    const { data: profile } = await sb
        .from('profiles')
        .select('target_strength_weekly, target_cardio_weekly, min_steps')
        .eq('id', currentUser.id)
        .single();
    
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    const dailyNorm = profile?.min_steps || 10000;
    
    const container = document.getElementById('weekly-progress');
    if (!container) return;
    
    if (!reports || reports.length === 0) {
        container.innerHTML = `
            <div style="background: #f8f9fa; border-radius: 12px; padding: 15px;">
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>🎯 <strong>Твоя норма шагов в день:</strong></span>
                        <span><strong style="color: #007aff;">${dailyNorm.toLocaleString()}</strong> шагов</span>
                    </div>
                </div>
                <p style="text-align: center;">Нет данных за эту неделю</p>
            </div>
        `;
        return;
    }
    
    let strengthCount = 0;
    let cardioCount = 0;
    let socialDays = 0;
    let lowStepsDays = 0;
    
    let dailyTable = '<div style="margin-top: 15px;"><h4 style="margin-bottom: 10px;">📅 По дням</h4>';
    for (let r of reports) {
        const date = new Date(r.report_date);
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
        const steps = r.steps || 0;
        const stepsOk = steps >= dailyNorm;
        if (!stepsOk) lowStepsDays++;
        
        let trainingIcon = '';
        if (r.training_type === 'strength') trainingIcon = '💪';
        else if (r.training_type === 'cardio') trainingIcon = '🏃';
        else if (r.training_type === 'rest') trainingIcon = '😴';
        else trainingIcon = '⚪';
        
        const socialIcon = r.social_event ? '🎉' : '✅';
        
        dailyTable += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                <div style="flex: 1;">
                    <span style="font-weight: 500;">${dayName}</span>
                    <span style="margin-left: 8px; font-size: 12px;">${trainingIcon} ${socialIcon}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-weight: 500;">${steps.toLocaleString()}</span>
                    <span style="margin-left: 8px; color: ${stepsOk ? '#34c759' : '#ff3b30'};">${stepsOk ? '✅' : '⚠️'}</span>
                </div>
            </div>
        `;
        
        if (r.training_type === 'strength') strengthCount++;
        if (r.training_type === 'cardio') cardioCount++;
        if (r.social_event) socialDays++;
    }
    dailyTable += '</div>';
    
    const strengthOk = strengthCount >= targetStrength;
    const cardioOk = cardioCount >= targetCardio;
    const socialOk = socialDays <= 1;
    
    container.innerHTML = `
        <div style="background: #f8f9fa; border-radius: 12px; padding: 15px;">
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>🎯 <strong>Твоя норма шагов в день:</strong></span>
                    <span><strong style="color: #007aff;">${dailyNorm.toLocaleString()}</strong> шагов</span>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>💪 Силовые:</span>
                    <span><strong>${strengthCount} / ${targetStrength}</strong> ${strengthOk ? '✅' : '⚠️'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>🏃 Кардио:</span>
                    <span><strong>${cardioCount} / ${targetCardio}</strong> ${cardioOk ? '✅' : '⚠️'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>🎉 Социальные приемы:</span>
                    <span><strong>${socialDays} дней</strong> ${socialOk ? '✅' : '⚠️'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>📉 Дней с шагами ниже нормы:</span>
                    <span><strong style="color: ${lowStepsDays > 0 ? '#ff3b30' : '#34c759'};">${lowStepsDays} дней</strong></span>
                </div>
            </div>
            
            ${dailyTable}
        </div>
    `;
}



async function openDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('daily-report-date').innerHTML = `📅 ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' })}`;
    
    const { data: existing } = await sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('report_date', today)
        .single();
    
    if (existing) {
        document.getElementById('daily-steps').value = existing.steps || '';
        setTrainingType(existing.training_type || '');
        setTrainingTime(existing.training_time || '');
        setSocialEvent(existing.social_event || false);
        setPreMeal(existing.pre_meal_compliant === true ? 'yes' : (existing.pre_meal_compliant === false ? 'no' : ''));
        setPostMeal(existing.post_meal_compliant === true ? 'yes' : (existing.post_meal_compliant === false ? 'no' : ''));
        document.getElementById('daily-notes').value = existing.notes || '';
    } else {
        document.getElementById('daily-steps').value = '';
        setTrainingType('');
        setTrainingTime('');
        setSocialEvent(false);
        setPreMeal('');
        setPostMeal('');
        document.getElementById('daily-notes').value = '';
    }
    
    await loadWeeklyProgress();
    showScreen('dailyReport');
}




// --- ПРОФИЛЬ И МОТИВАЦИОННОЕ СООБЩЕНИЕ ---
async function loadMyProfile() {
    if (!currentUser) return;
    
    const { data: profile } = await sb
        .from('profiles')
        .select('weight, subscription_until')
        .eq('id', currentUser.id)
        .single();
    
    const subscriptionEl = document.getElementById('profile-subscription');
    if (subscriptionEl && profile?.subscription_until) {
        const untilDate = new Date(profile.subscription_until);
        const daysLeft = Math.ceil((untilDate - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) subscriptionEl.innerHTML = '❌ Истек';
        else if (daysLeft <= 7) subscriptionEl.innerHTML = `⚠️ ${daysLeft} дней (до ${untilDate.toLocaleDateString()})`;
        else subscriptionEl.innerHTML = `✅ ${daysLeft} дней (до ${untilDate.toLocaleDateString()})`;
    } else if (subscriptionEl) {
        subscriptionEl.innerHTML = '—';
    }
    
    const weightHistory = await loadWeightHistory();
    const weightEl = document.getElementById('profile-weight');
    if (weightEl) {
        if (weightHistory && weightHistory.length > 0) {
            weightEl.innerHTML = `${weightHistory[weightHistory.length - 1].weight} кг`;
        } else {
            weightEl.innerHTML = '—';
        }
    }
    
    const weightContainer = document.getElementById('profile-weight-container');
    if (weightContainer) {
        weightContainer.style.cursor = 'pointer';
        weightContainer.onclick = () => openWeightModal();
    }
    
    await renderWeightChart();
}

async function updateWeeklyMessage() {
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() + 1);
    lastMonday.setHours(0, 0, 0, 0);
    
    const { data: weights } = await sb
        .from('weight_history')
        .select('weight, weigh_date')
        .eq('user_id', currentUser.id)
        .order('weigh_date', { ascending: false })
        .limit(2);
    
    let weightChange = null;
    if (weights && weights.length >= 2) {
        weightChange = weights[1].weight - weights[0].weight;
    }
    
    const { data: reports } = await sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('report_date', lastMonday.toISOString().split('T')[0])
        .lte('report_date', new Date().toISOString().split('T')[0]);
    
    const { data: profile } = await sb
        .from('profiles')
        .select('target_strength_weekly, target_cardio_weekly, min_steps')
        .eq('id', currentUser.id)
        .single();
    
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    const dailyNorm = profile?.min_steps || 10000;
    
    let actualStrength = 0, actualCardio = 0, socialDays = 0;
    let lowStepsDays = 0;
    
    reports?.forEach(r => {
        if (r.training_type === 'strength') actualStrength++;
        if (r.training_type === 'cardio') actualCardio++;
        if (r.social_event) socialDays++;
        if ((r.steps || 0) < dailyNorm) lowStepsDays++;
    });
    
    const strengthOk = actualStrength >= targetStrength;
    const cardioOk = actualCardio >= targetCardio;
    const socialOk = socialDays <= 1;
    const stepsOk = lowStepsDays === 0; // все дни с шагами выше нормы
    const allCompliant = stepsOk && strengthOk && cardioOk && socialOk;
    
    const messageDiv = document.getElementById('weekly-message');
    const messageText = document.getElementById('weekly-message-text');
    
    if (!messageDiv || !messageText) return;
    
    if (weightChange !== null && weightChange < -0.2) {
        messageDiv.style.background = '#e8f5e9';
        messageDiv.style.borderLeftColor = '#34c759';
        messageText.innerHTML = `🎉 <strong>Поздравляю!</strong> Ты похудел${weightChange > 0 ? 'а' : ''} на ${Math.abs(weightChange).toFixed(1)} кг за эту неделю! Отличная работа! Продолжай в том же духе 💪`;
        messageDiv.style.display = 'block';
    } 
    else if (!allCompliant) {
        let failures = [];
        if (!stepsOk) failures.push(`👣 Шаги: в ${lowStepsDays} днях ниже нормы ${dailyNorm.toLocaleString()}`);
        if (!strengthOk) failures.push(`💪 Силовые: ${actualStrength} из ${targetStrength}`);
        if (!cardioOk) failures.push(`🏃 Кардио: ${actualCardio} из ${targetCardio}`);
        if (!socialOk) failures.push(`🎉 Социальные приемы: ${socialDays} дней`);
        
        messageDiv.style.background = '#fff3e0';
        messageDiv.style.borderLeftColor = '#ff9800';
        
        let adjustmentText = '';
        let newTargetCardio = targetCardio;
        
        if (weightChange !== null && (weightChange >= -0.2 || weightChange > 0)) {
            newTargetCardio = Math.min(targetCardio + 1, 4);
            
            await sb
                .from('profiles')
                .update({
                    target_cardio_weekly: newTargetCardio
                })
                .eq('id', currentUser.id);
            
            adjustmentText = `<br><br>📈 <strong>Корректировка плана на следующую неделю:</strong><br>• Кардио: +1 сессия → ${newTargetCardio} в неделю`;
        }
        
        messageText.innerHTML = `⚠️ <strong>На этой неделе не было отвеса.</strong><br><br>Давай разберем, что могло повлиять:<br>${failures.map(f => `• ${f}`).join('<br>')}<br><br>На этой неделе сфокусируемся на выполнении плана. Ты справишься! 🔥${adjustmentText}`;
        messageDiv.style.display = 'block';
    } 
    else {
        messageDiv.style.background = '#e3f2fd';
        messageDiv.style.borderLeftColor = '#007aff';
        
        let adjustmentText = '';
        
        if (weightChange !== null && (weightChange >= -0.2 || weightChange > 0)) {
            adjustmentText = `<br><br>📈 <strong>Мягкая корректировка:</strong> продолжаем в том же ритме. Организм адаптируется, дадим ему время.`;
        }
        
        messageText.innerHTML = `🤔 <strong>На этой неделе отвеса не случилось, но все рекомендации выполнены!</strong><br><br>Организм — сложная штука. Иногда ему нужно время, чтобы "переварить" изменения. Бывает, что вес стоит из-за задержки воды, адаптации или накопления гликогена.<br><br><strong>Главное — ты не сдаешься!</strong> Продолжай в том же ритме, результат обязательно придет. Доверяй процессу 🙌${adjustmentText}`;
        messageDiv.style.display = 'block';
    }
}




// --- ВЕС, ГРАФИКИ, ШАГИ, АДМИНКА ---
async function loadWeightHistory() {
    if (!currentUser) return [];
    const { data } = await sb
        .from('weight_history')
        .select('weight, weigh_date')
        .eq('user_id', currentUser.id)
        .order('weigh_date', { ascending: true });
    return data || [];
}

async function saveWeight(weight) {
    if (!currentUser) return false;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await sb.from('weight_history').insert({
        user_id: currentUser.id,
        weight: parseFloat(weight),
        weigh_date: today
    });
    return !error;
}

function canAddWeight(history) {
    if (!history || history.length === 0) return true;
    const lastDate = new Date(history[history.length - 1].weigh_date);
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    return isMonday && daysSinceLast >= 7;
}

async function openWeightModal() {
    const history = await loadWeightHistory();
    const canAdd = canAddWeight(history);
    const modal = document.getElementById('weight-modal');
    const weightInput = document.getElementById('weight-input');
    const errorDiv = document.getElementById('weight-error');
    const saveBtn = document.getElementById('weight-save-btn');
    const cancelBtn = document.getElementById('weight-cancel-btn');
    
    if (!canAdd) {
        errorDiv.textContent = '⚠️ Взвешивание возможно только по понедельникам, 1 раз в неделю.';
        errorDiv.style.display = 'block';
        weightInput.disabled = true;
        saveBtn.disabled = true;
    } else {
        errorDiv.style.display = 'none';
        weightInput.disabled = false;
        saveBtn.disabled = false;
        weightInput.value = '';
    }
    
    modal.style.display = 'flex';
    
    const handleSave = async () => {
        const weight = weightInput.value;
        if (!weight || weight <= 0) return alert('Введите корректный вес');
        const success = await saveWeight(weight);
        if (success) {
            alert('✅ Вес сохранен');
            modal.style.display = 'none';
            await loadMyProfile();
            await updateWeeklyMessage();
        } else {
            alert('❌ Ошибка сохранения');
        }
        cleanup();
    };
    
    const handleCancel = () => {
        modal.style.display = 'none';
        cleanup();
    };
    
    const handleClickOutside = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            cleanup();
        }
    };
    
    const cleanup = () => {
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleClickOutside);
    };
    
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleClickOutside);
}

async function renderWeightChart() {
    const history = await loadWeightHistory();
    const container = document.getElementById('weight-chart-container');
    const totalLossEl = document.getElementById('total-loss');
    
    if (!history || history.length < 2) {
        if (container) container.style.display = 'none';
        return;
    }
    
    if (container) container.style.display = 'block';
    
    const ctx = document.getElementById('weight-chart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = history.map(h => new Date(h.weigh_date).toLocaleDateString());
    const weights = history.map(h => h.weight);
    
    if (window.weightChart) window.weightChart.destroy();
    
    window.weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Вес (кг)',
                data: weights,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0,122,255,0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
    
    const loss = (history[0].weight - history[history.length - 1].weight).toFixed(1);
    if (totalLossEl) {
        if (loss > 0) totalLossEl.innerHTML = `📉 Общая потеря: ${loss} кг`;
        else if (loss < 0) totalLossEl.innerHTML = `📈 Общий набор: ${Math.abs(loss)} кг`;
        else totalLossEl.innerHTML = `⚖️ Вес стабилен`;
    }
}




// --- АДМИНКА (упрощенная версия для совместимости) ---
async function ensureWeeklySchedule() {
    // Базовая функция для совместимости
    console.log('ensureWeeklySchedule вызвана');
}

function addSlotElement(container, slot) {
    const start = new Date(slot.start_time);
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; justify-content: space-between; padding: 8px; margin-bottom: 5px; background: #f5f5f5; border-radius: 8px;';
    div.innerHTML = `
        <span>${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        <button class="delete-slot-btn" data-id="${slot.id}" style="background: #ff3b30; color: white; border: none; padding: 4px 12px; border-radius: 6px;">✖</button>
    `;
    div.querySelector('.delete-slot-btn').addEventListener('click', async () => {
        await sb.from('slots').delete().eq('id', slot.id);
        await loadAdminData();
    });
    container.appendChild(div);
}

async function loadAdminData() {
    const container = document.getElementById('admin-slots');
    if (container) {
        const { data: slots } = await sb.from('slots').select('*').order('start_time');
        container.innerHTML = '';
        if (slots && slots.length > 0) {
            slots.forEach(slot => {
                const start = new Date(slot.start_time);
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; padding: 8px; margin-bottom: 5px; background: #f5f5f5; border-radius: 8px;';
                div.innerHTML = `
                    <span>${start.toLocaleString()}</span>
                    <button class="delete-slot-btn" data-id="${slot.id}" style="background: #ff3b30; color: white; border: none; padding: 4px 12px; border-radius: 6px;">✖</button>
                `;
                div.querySelector('.delete-slot-btn').addEventListener('click', async () => {
                    await sb.from('slots').delete().eq('id', slot.id);
                    await loadAdminData();
                });
                container.appendChild(div);
            });
        } else {
            container.innerHTML = '<p>Нет слотов</p>';
        }
    }
    
    const bookingsContainer = document.getElementById('admin-bookings');
    if (bookingsContainer) {
        const { data: bookings } = await sb.from('bookings').select('*, profiles(name, phone), slots(start_time)');
        bookingsContainer.innerHTML = '<h3>Все записи</h3>';
        if (bookings && bookings.length > 0) {
            bookings.forEach(b => {
                bookingsContainer.innerHTML += `
                    <div style="border:1px solid #ddd; padding:10px; margin:10px 0; border-radius:8px;">
                        <strong>${b.profiles?.name || 'Неизвестно'}</strong> (${b.profiles?.phone || 'нет телефона'})<br>
                        ${new Date(b.slots.start_time).toLocaleString()}
                    </div>
                `;
            });
        } else {
            bookingsContainer.innerHTML += '<p>Нет записей</p>';
        }
    }
}

async function renderClientsList() {
    const container = document.getElementById('admin-clients-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка клиентов...</div>';
    
    const { data: clients, error } = await sb
        .from('profiles')
        .select('*')
        .neq('id', 'edafd00c-3f7d-47aa-8d69-9efbe95de98e')
        .order('name');
    
    if (error || !clients || clients.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет зарегистрированных клиентов</p>';
        return;
    }
    
    container.innerHTML = '';
    
    for (let client of clients) {
        const { count } = await sb
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', client.id);
        
        const clientCard = document.createElement('div');
        clientCard.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fff; cursor: pointer; transition: all 0.2s;';
        clientCard.onmouseover = () => clientCard.style.backgroundColor = '#f8f9fa';
        clientCard.onmouseout = () => clientCard.style.backgroundColor = '#fff';
        
        clientCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <strong style="font-size: 16px;">👤 ${client.name || 'Без имени'}</strong><br>
                    <span style="color: #666; font-size: 14px;">📞 ${client.phone || 'нет телефона'}</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="background: #007aff; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${count || 0} записей</span>
                    <button class="delete-client-btn" data-id="${client.id}" data-name="${client.name || client.phone || 'клиента'}" style="background: #ff3b30; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                </div>
            </div>
        `;
        
        const clientInfoDiv = clientCard.querySelector('div:first-child');
        clientInfoDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            showClientDetails(client);
        });
        
        const deleteBtn = clientCard.querySelector('.delete-client-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const clientName = client.name || client.phone || 'клиента';
            if (confirm(`Удалить клиента "${clientName}"?`)) {
                await sb.from('bookings').delete().eq('user_id', client.id);
                await sb.from('profiles').delete().eq('id', client.id);
                alert(`✅ Клиент "${clientName}" удален`);
                await renderClientsList();
                await loadAdminData();
            }
        });
        
        container.appendChild(clientCard);
    }
}

// --- Отображение карточки клиента с протоколом, комментариями и редактированием ---
async function showClientDetails(client) {
    // Получаем записи клиента
    const { data: bookings, error: bookingsError } = await sb
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
    
    // Получаем отчеты клиента за текущую неделю
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const { data: weeklyReports } = await sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', client.id)
        .gte('report_date', startOfWeek.toISOString().split('T')[0])
        .lte('report_date', endOfWeek.toISOString().split('T')[0]);
    
    const targetSteps = client.target_steps_weekly || 70000;
    const targetStrength = client.target_strength_weekly || 3;
    const targetCardio = client.target_cardio_weekly || 1;
    const dailyNorm = client.min_steps || 10000;
    
    let actualSteps = 0, actualStrength = 0, actualCardio = 0, socialDays = 0;
    weeklyReports?.forEach(r => {
        actualSteps += r.steps || 0;
        if (r.training_type === 'strength') actualStrength++;
        if (r.training_type === 'cardio') actualCardio++;
        if (r.social_event) socialDays++;
    });
    
    const stepsPercent = (actualSteps / targetSteps * 100).toFixed(0);
    const strengthOk = actualStrength >= targetStrength;
    const cardioOk = actualCardio >= targetCardio;
    const socialOk = socialDays <= 1;
    
    // Создаем модальное окно
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
        max-width: 500px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        padding: 20px;
    `;
    
    // Формируем HTML для кружочков шагов
    let stepsCirclesHtml = '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;">';
    const daysOfWeek = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        const dateStr = dayDate.toISOString().split('T')[0];
        const report = weeklyReports?.find(r => r.report_date === dateStr);
        const steps = report?.steps || 0;
        const isOk = steps >= dailyNorm;
        const hasData = !!report;
        
        stepsCirclesHtml += `
            <div style="text-align: center; width: 40px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: ${hasData ? (isOk ? '#34c759' : '#ff3b30') : '#e0e0e0'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                    ${hasData ? (isOk ? '✓' : '✗') : '?'}
                </div>
                <div style="font-size: 10px; color: #666; margin-top: 4px;">${daysOfWeek[i]}</div>
            </div>
        `;
    }
    stepsCirclesHtml += '</div>';
    
    // Формируем HTML для записей
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
            bookingsHtml += `<div style="margin-top: 10px;"><strong style="font-size: 13px; color: #007aff;">📅 ${day}</strong></div>`;
            dayBookings.forEach(booking => {
                const start = new Date(booking.slots.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                bookingsHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                        <span>🕐 ${timeStr}</span>
                        <button class="delete-booking-from-client" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">✖</button>
                    </div>
                `;
            });
        }
    } else {
        bookingsHtml = '<p style="text-align: center; padding: 20px;">Нет записей</p>';
    }
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">👤 ${client.name || 'Без имени'}</h2>
            <button id="close-client-modal" style="background: none; border: none; font-size: 24px; cursor: pointer;">✖</button>
        </div>
        
        <div style="margin-bottom: 20px;">
            <p><strong>📞 Телефон:</strong> ${client.phone || 'не указан'}</p>
        </div>
        
        <!-- Блок протокола за неделю с кружочками -->
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
                <span>🎉 Нарушения (СПП):</span>
                <span><strong>${socialDays} дней</strong> ${socialOk ? '✅' : '⚠️'}</span>
            </div>
        </div>
        
        <!-- Комментарии клиента -->
        <div id="client-comments-section" style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin: 15px 0;"></div>
        
        <!-- Редактирование профиля -->
        <div style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px;">✏️ Редактировать профиль</h3>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Вес (кг)</label>
                <input type="number" id="edit-weight" step="0.1" value="${client.weight || ''}" placeholder="например: 75.5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
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
            
            <button id="save-profile-btn" style="background: #007aff; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; width: 100%; margin-top: 5px;">💾 Сохранить</button>
        </div>
        
        <!-- Записи клиента -->
        <div>
            <h3 style="margin: 0 0 10px 0; font-size: 16px;">📋 Записи клиента</h3>
            <div id="client-bookings-list" style="max-height: 200px; overflow-y: auto;">
                ${bookingsHtml}
            </div>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Загружаем и отображаем комментарии
    const commentsSection = document.getElementById('client-comments-section');
    if (weeklyReports && weeklyReports.length > 0) {
        const reportsWithComments = weeklyReports.filter(r => r.notes && r.notes.trim());
        if (reportsWithComments.length > 0) {
            let commentsHtml = '<h3 style="margin: 0 0 12px 0; font-size: 16px;">💬 Комментарии клиента</h3>';
            for (let r of reportsWithComments) {
                const date = new Date(r.report_date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'numeric' });
                commentsHtml += `
                    <div style="margin-bottom: 12px; padding: 8px; background: white; border-radius: 8px; border-left: 3px solid #007aff;">
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
    
    // Закрытие модального окна
    const closeBtn = modalContent.querySelector('#close-client-modal');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
    // Сохранение профиля
    const saveBtn = modalContent.querySelector('#save-profile-btn');
    saveBtn.addEventListener('click', async () => {
        const weight = modalContent.querySelector('#edit-weight').value;
        const subscriptionUntil = modalContent.querySelector('#edit-subscription').value;
        const minSteps = modalContent.querySelector('#edit-min-steps').value;
        const targetStepsWeekly = modalContent.querySelector('#edit-target-steps').value;
        const targetStrengthWeekly = modalContent.querySelector('#edit-target-strength').value;
        const targetCardioWeekly = modalContent.querySelector('#edit-target-cardio').value;
        
        const updateData = {};
        if (weight) updateData.weight = parseFloat(weight);
        if (subscriptionUntil) updateData.subscription_until = subscriptionUntil;
        if (minSteps) updateData.min_steps = parseInt(minSteps);
        if (targetStrengthWeekly) updateData.target_strength_weekly = parseInt(targetStrengthWeekly);
        if (targetCardioWeekly) updateData.target_cardio_weekly = parseInt(targetCardioWeekly);
        
        const { error: updateError } = await sb
            .from('profiles')
            .update(updateData)
            .eq('id', client.id);
        
        if (updateError) {
            alert('Ошибка сохранения: ' + updateError.message);
        } else {
            alert('✅ Профиль обновлен!');
            modal.remove();
            await renderClientsList();
        }
    });
    
    // Обработчики удаления записей
    const deleteButtons = modalContent.querySelectorAll('.delete-booking-from-client');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookingId = btn.dataset.id;
            const slotId = btn.dataset.slot;
            
            if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                await sb.from('bookings').delete().eq('id', bookingId);
                await sb.from('slots').update({ is_available: true }).eq('id', slotId);
                alert('Запись удалена, слот свободен');
                modal.remove();
                await renderClientsList();
                await loadAdminData();
            }
        });
    });
}



function setupAdminTabs() {
    const slotsTab = document.getElementById('admin-slots-tab');
    const clientsTab = document.getElementById('admin-clients-tab');
    const slotsPanel = document.getElementById('admin-slots-panel');
    const clientsPanel = document.getElementById('admin-clients-panel');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (!slotsTab || !clientsTab) return;
    
    slotsTab.onclick = () => {
        slotsTab.style.background = '#007aff';
        slotsTab.style.color = 'white';
        clientsTab.style.background = '#e9ecef';
        clientsTab.style.color = '#1e1e1e';
        slotsPanel.style.display = 'block';
        clientsPanel.style.display = 'none';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'block';
    };
    
    clientsTab.onclick = async () => {
        clientsTab.style.background = '#007aff';
        clientsTab.style.color = 'white';
        slotsTab.style.background = '#e9ecef';
        slotsTab.style.color = '#1e1e1e';
        slotsPanel.style.display = 'none';
        clientsPanel.style.display = 'block';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'none';
        await renderClientsList();
    };
}




// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
    initDailyReportUI();
    
    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        document.getElementById('user-name').innerText = session.user.user_metadata.name || 'Друг';
        
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && session.user.user_metadata?.is_admin === true) {
            adminBtn.style.display = 'block';
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
            alert('Ошибка входа: ' + e.message);
        } finally {
            isLoggingIn = false;
        }
    });
    
    document.getElementById('book-btn')?.addEventListener('click', async () => {
        const slots = await loadSlots();
        await renderSlots(slots);
        showScreen('booking');
    });
    
    document.getElementById('my-bookings-btn')?.addEventListener('click', async () => {
        await loadMyBookings();
        showScreen('myBookings');
    });
    
    document.getElementById('daily-report-btn')?.addEventListener('click', async () => {
        await openDailyReport();
    });
    
    document.getElementById('my-profile-btn')?.addEventListener('click', async () => {
        await loadMyProfile();
        await updateWeeklyMessage();
        showScreen('profile');
    });
    
    document.getElementById('admin-btn')?.addEventListener('click', async () => {
        await loadAdminData();
        setupAdminTabs();
        showScreen('admin');
    });
    
    document.getElementById('confirm-booking-btn')?.addEventListener('click', confirmBooking);
    
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
        if (!start) return alert('Выберите время');
        const end = new Date(new Date(start).getTime() + 60*60*1000).toISOString().slice(0,16);
        const { error } = await sb.from('slots').insert({ start_time: start, end_time: end, is_available: true });
        if (error) alert('Ошибка: ' + error.message);
        else { alert('Слот добавлен'); loadAdminData(); }
    });
});
