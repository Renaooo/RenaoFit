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
        .select('min_steps, target_strength_weekly, target_cardio_weekly')
        .eq('id', currentUser.id)
        .single();
    
    const dailyNorm = profile?.min_steps || 10000;
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    
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
        .select('target_steps_weekly, target_strength_weekly, target_cardio_weekly, min_steps')
        .eq('id', currentUser.id)
        .single();
    
    const targetSteps = profile?.target_steps_weekly || 70000;
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    const dailyNorm = profile?.min_steps || 10000;
    
    let actualSteps = 0, actualStrength = 0, actualCardio = 0, socialDays = 0;
    let lowStepsDays = 0;
    
    reports?.forEach(r => {
        actualSteps += r.steps || 0;
        if (r.training_type === 'strength') actualStrength++;
        if (r.training_type === 'cardio') actualCardio++;
        if (r.social_event) socialDays++;
        if ((r.steps || 0) < dailyNorm) lowStepsDays++;
    });
    
    const stepsPercent = actualSteps / targetSteps;
    const strengthOk = actualStrength >= targetStrength;
    const cardioOk = actualCardio >= targetCardio;
    const socialOk = socialDays <= 1;
    const stepsOk = stepsPercent >= 0.9;
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
        if (!stepsOk) failures.push(`👣 Шаги: ${Math.round(actualSteps).toLocaleString()} из ${targetSteps.toLocaleString()} (в ${lowStepsDays} днях ниже нормы ${dailyNorm.toLocaleString()})`);
        if (!strengthOk) failures.push(`💪 Силовые: ${actualStrength} из ${targetStrength}`);
        if (!cardioOk) failures.push(`🏃 Кардио: ${actualCardio} из ${targetCardio}`);
        if (!socialOk) failures.push(`🎉 Социальные приемы: ${socialDays} дней`);
        
        messageDiv.style.background = '#fff3e0';
        messageDiv.style.borderLeftColor = '#ff9800';
        
        let adjustmentText = '';
        let newTargetSteps = targetSteps;
        let newTargetCardio = targetCardio;
        
        if (weightChange !== null && (weightChange >= -0.2 || weightChange > 0)) {
            newTargetSteps = Math.min(Math.round(targetSteps * 1.1), 105000);
            newTargetCardio = Math.min(targetCardio + 1, 4);
            
            await sb
                .from('profiles')
                .update({
                    target_steps_weekly: newTargetSteps,
                    target_cardio_weekly: newTargetCardio
                })
                .eq('id', currentUser.id);
            
            adjustmentText = `<br><br>📈 <strong>Корректировка плана на следующую неделю:</strong><br>• Шаги: +10% → ${newTargetSteps.toLocaleString()} в неделю<br>• Кардио: +1 сессия → ${newTargetCardio} в неделю`;
        }
        
        messageText.innerHTML = `⚠️ <strong>На этой неделе не было отвеса.</strong><br><br>Давай разберем, что могло повлиять:<br>${failures.map(f => `• ${f}`).join('<br>')}<br><br>На этой неделе сфокусируемся на выполнении плана. Ты справишься! 🔥${adjustmentText}`;
        messageDiv.style.display = 'block';
    } 
    else {
        messageDiv.style.background = '#e3f2fd';
        messageDiv.style.borderLeftColor = '#007aff';
        
        let adjustmentText = '';
        
        if (weightChange !== null && (weightChange >= -0.2 || weightChange > 0)) {
            const newTargetSteps = Math.min(Math.round(targetSteps * 1.05), 100000);
            
            await sb
                .from('profiles')
                .update({
                    target_steps_weekly: newTargetSteps
                })
                .eq('id', currentUser.id);
            
            adjustmentText = `<br><br>📈 <strong>Мягкая корректировка:</strong> шаги +5% → ${newTargetSteps.toLocaleString()} в неделю. Организм адаптируется, дадим ему время.`;
        }
        
        messageText.innerHTML = `🤔 <strong>На этой неделе отвеса не случилось, но все рекомендации выполнены!</strong><br><br>Организм — сложная штука. Иногда ему нужно время, чтобы "переварить" изменения. Бывает, что вес стоит из-за задержки воды, адаптации или накопления гликогена.<br><br><strong>Главное — ты не сдаешься!</strong> Продолжай в том же ри
