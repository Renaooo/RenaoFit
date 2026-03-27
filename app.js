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
    steps: document.getElementById('steps-screen'),
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




// --- Отображение слотов (сокращенно, как было ранее) ---
async function renderSlots(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет свободных слотов</p>';
        return;
    }
    
    const groupedByDay = {};
    slots.forEach(slot => {
        const date = new Date(slot.start_time);
        const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
        if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
        groupedByDay[dayKey].push(slot);
    });
    
    for (let [day, daySlots] of Object.entries(groupedByDay)) {
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px;">📅 ${day}</h3>`;
        
        const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
        
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            morning.forEach(slot => {
                const start = new Date(slot.start_time);
                const slotDiv = document.createElement('div');
                slotDiv.style.cssText = 'display: flex; justify-content: space-between; padding: 10px; margin-bottom: 6px; background: #f8f9fa; border-radius: 8px;';
                slotDiv.innerHTML = `
                    <span>${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
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
                const slotDiv = document.createElement('div');
                slotDiv.style.cssText = 'display: flex; justify-content: space-between; padding: 10px; margin-bottom: 6px; background: #f8f9fa; border-radius: 8px;';
                slotDiv.innerHTML = `
                    <span>${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
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
    // Тип тренировки
    document.getElementById('training-strength')?.addEventListener('click', () => setTrainingType('strength'));
    document.getElementById('training-cardio')?.addEventListener('click', () => setTrainingType('cardio'));
    document.getElementById('training-rest')?.addEventListener('click', () => setTrainingType('rest'));
    
    // Время тренировки
    document.getElementById('time-morning')?.addEventListener('click', () => setTrainingTime('morning'));
    document.getElementById('time-day')?.addEventListener('click', () => setTrainingTime('day'));
    document.getElementById('time-evening')?.addEventListener('click', () => setTrainingTime('evening'));
    
    // Социальный прием
    document.getElementById('social-no')?.addEventListener('click', () => setSocialEvent(false));
    document.getElementById('social-yes')?.addEventListener('click', () => setSocialEvent(true));
    
    // Питание до
    document.getElementById('pre-yes')?.addEventListener('click', () => setPreMeal('yes'));
    document.getElementById('pre-no')?.addEventListener('click', () => setPreMeal('no'));
    document.getElementById('pre-na')?.addEventListener('click', () => setPreMeal('na'));
    
    // Питание после
    document.getElementById('post-yes')?.addEventListener('click', () => setPostMeal('yes'));
    document.getElementById('post-no')?.addEventListener('click', () => setPostMeal('no'));
    document.getElementById('post-na')?.addEventListener('click', () => setPostMeal('na'));
    
    // Сохранение
    document.getElementById('save-daily-report-btn')?.addEventListener('click', saveDailyReport);
}

function setTrainingType(type) {
    currentTrainingType = type;
    document.getElementById('training-strength').style.background = type === 'strength' ? '#007aff' : '#e9ecef';
    document.getElementById('training-strength').style.color = type === 'strength' ? 'white' : '#1e1e1e';
    document.getElementById('training-cardio').style.background = type === 'cardio' ? '#007aff' : '#e9ecef';
    document.getElementById('training-cardio').style.color = type === 'cardio' ? 'white' : '#1e1e1e';
    document.getElementById('training-rest').style.background = type === 'rest' ? '#007aff' : '#e9ecef';
    document.getElementById('training-rest').style.color = type === 'rest' ? 'white' : '#1e1e1e';
    document.getElementById('training-type').value = type;
    
    const timeContainer = document.getElementById('training-time-container');
    const preMealContainer = document.getElementById('pre-meal-container');
    const postMealContainer = document.getElementById('post-meal-container');
    
    if (type === 'rest') {
        timeContainer.style.display = 'none';
        preMealContainer.style.display = 'none';
        postMealContainer.style.display = 'none';
        currentTrainingTime = '';
        currentPreMeal = '';
        currentPostMeal = '';
    } else {
        timeContainer.style.display = 'block';
        preMealContainer.style.display = 'block';
        postMealContainer.style.display = 'block';
    }
}

function setTrainingTime(time) {
    currentTrainingTime = time;
    document.getElementById('time-morning').style.background = time === 'morning' ? '#007aff' : '#e9ecef';
    document.getElementById('time-morning').style.color = time === 'morning' ? 'white' : '#1e1e1e';
    document.getElementById('time-day').style.background = time === 'day' ? '#007aff' : '#e9ecef';
    document.getElementById('time-day').style.color = time === 'day' ? 'white' : '#1e1e1e';
    document.getElementById('time-evening').style.background = time === 'evening' ? '#007aff' : '#e9ecef';
    document.getElementById('time-evening').style.color = time === 'evening' ? 'white' : '#1e1e1e';
    document.getElementById('training-time').value = time;
}

function setSocialEvent(value) {
    currentSocialEvent = value;
    document.getElementById('social-no').style.background = !value ? '#007aff' : '#e9ecef';
    document.getElementById('social-no').style.color = !value ? 'white' : '#1e1e1e';
    document.getElementById('social-yes').style.background = value ? '#007aff' : '#e9ecef';
    document.getElementById('social-yes').style.color = value ? 'white' : '#1e1e1e';
    document.getElementById('social-event').value = value;
}

function setPreMeal(value) {
    currentPreMeal = value;
    document.getElementById('pre-yes').style.background = value === 'yes' ? '#34c759' : '#e9ecef';
    document.getElementById('pre-yes').style.color = value === 'yes' ? 'white' : '#1e1e1e';
    document.getElementById('pre-no').style.background = value === 'no' ? '#ff3b30' : '#e9ecef';
    document.getElementById('pre-no').style.color = value === 'no' ? 'white' : '#1e1e1e';
    document.getElementById('pre-na').style.background = value === 'na' ? '#999' : '#e9ecef';
    document.getElementById('pre-na').style.color = value === 'na' ? 'white' : '#1e1e1e';
    document.getElementById('pre-meal').value = value;
}

function setPostMeal(value) {
    currentPostMeal = value;
    document.getElementById('post-yes').style.background = value === 'yes' ? '#34c759' : '#e9ecef';
    document.getElementById('post-yes').style.color = value === 'yes' ? 'white' : '#1e1e1e';
    document.getElementById('post-no').style.background = value === 'no' ? '#ff3b30' : '#e9ecef';
    document.getElementById('post-no').style.color = value === 'no' ? 'white' : '#1e1e1e';
    document.getElementById('post-na').style.background = value === 'na' ? '#999' : '#e9ecef';
    document.getElementById('post-na').style.color = value === 'na' ? 'white' : '#1e1e1e';
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
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const { data: reports } = await sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('report_date', startOfWeek.toISOString().split('T')[0])
        .lte('report_date', endOfWeek.toISOString().split('T')[0])
        .order('report_date');
    
    const container = document.getElementById('weekly-progress');
    if (!container) return;
    
    if (!reports || reports.length === 0) {
        container.innerHTML = '<p style="text-align: center;">Нет данных за эту неделю</p>';
        return;
    }
    
    let totalSteps = 0;
    let strengthCount = 0;
    let cardioCount = 0;
    let socialDays = 0;
    
    reports.forEach(r => {
        totalSteps += r.steps || 0;
        if (r.training_type === 'strength') strengthCount++;
        if (r.training_type === 'cardio') cardioCount++;
        if (r.social_event) socialDays++;
    });
    
    container.innerHTML = `
        <div style="background: #f8f9fa; border-radius: 12px; padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>👣 Шаги:</span>
                <span><strong>${totalSteps.toLocaleString()}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>💪 Силовые:</span>
                <span><strong>${strengthCount}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>🏃 Кардио:</span>
                <span><strong>${cardioCount}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>🎉 Нарушения:</span>
                <span><strong>${socialDays} дней</strong></span>
            </div>
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
        setPreMeal(existing.pre_meal_compliant === true ? 'yes' : (existing.pre_meal_compliant === false ? 'no' : 'na'));
        setPostMeal(existing.post_meal_compliant === true ? 'yes' : (existing.post_meal_compliant === false ? 'no' : 'na'));
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
    lastMonday.setHours(0,0,0,0);
    const prevMonday = new Date(lastMonday);
    prevMonday.setDate(lastMonday.getDate() - 7);
    
    // Получаем веса
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
    
    // Получаем данные за неделю
    const { data: reports } = await sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('report_date', lastMonday.toISOString().split('T')[0])
        .lte('report_date', new Date().toISOString().split('T')[0]);
    
    const { data: profile } = await sb
        .from('profiles')
        .select('target_steps_weekly, target_strength_weekly, target_cardio_weekly')
        .eq('id', currentUser.id)
        .single();
    
    const targetSteps = profile?.target_steps_weekly || 70000;
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    
    let actualSteps = 0, actualStrength = 0, actualCardio = 0, socialDays = 0;
    reports?.forEach(r => {
        actualSteps += r.steps || 0;
        if (r.training_type === 'strength') actualStrength++;
        if (r.training_type === 'cardio') actualCardio++;
        if (r.social_event) socialDays++;
    });
    
    const stepsPercent = actualSteps / targetSteps;
    const strengthOk = actualStrength >= targetStrength;
    const cardioOk = actualCardio >= targetCardio;
    const socialOk = socialDays <= 1;
    const allCompliant = stepsPercent >= 0.9 && strengthOk && cardioOk && socialOk;
    
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
        if (stepsPercent < 0.9) failures.push(`👣 Шаги: ${Math.round(actualSteps).toLocaleString()} из ${targetSteps.toLocaleString()}`);
        if (!strengthOk) failures.push(`💪 Силовые: ${actualStrength} из ${targetStrength}`);
        if (!cardioOk) failures.push(`🏃 Кардио: ${actualCardio} из ${targetCardio}`);
        if (!socialOk) failures.push(`🎉 Социальные приемы: ${socialDays} дней`);
        
        messageDiv.style.background = '#fff3e0';
        messageDiv.style.borderLeftColor = '#ff9800';
        messageText.innerHTML = `⚠️ <strong>На этой неделе не было отвеса.</strong><br><br>Давай разберем, что могло повлиять:<br>${failures.map(f => `• ${f}`).join('<br>')}<br><br>На этой неделе сфокусируемся на выполнении плана. Ты справишься! 🔥`;
        messageDiv.style.display = 'block';
    } 
    else {
        messageDiv.style.background = '#e3f2fd';
        messageDiv.style.borderLeftColor = '#007aff';
        messageText.innerHTML = `🤔 <strong>На этой неделе отвеса не случилось, но все рекомендации выполнены!</strong><br><br>Организм — сложная штука. Иногда ему нужно время, чтобы "переварить" изменения. Бывает, что вес стоит из-за задержки воды, адаптации или накопления гликогена.<br><br><strong>Главное — ты не сдаешься!</strong> Продолжай в том же ритме, результат обязательно придет. Доверяй процессу 🙌`;
        messageDiv.style.display = 'block';
    }
}




// ============================================
// АДМИН-ПАНЕЛЬ, КЛИЕНТЫ, СЛОТЫ, ШАГИ, ВЕС
// ============================================

// --- Автоматическое расписание ---
async function ensureWeeklySchedule() {
    const schedule = {
        1: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['18:00', '19:00', '20:00', '21:00'] },
        2: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: [] },
        3: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['18:00', '19:00', '20:00', '21:00'] },
        4: { morning: [], evening: ['18:00', '19:00', '20:00', '21:00'] },
        5: { morning: ['08:00', '09:00', '10:00', '11:00'], evening: ['18:00', '19:00', '20:00', '21:00'] },
        6: { morning: ['10:00', '11:00', '12:00', '13:00'], evening: [] },
        0: { morning: [], evening: [] }
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 0; day < 7; day++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + day);
        const dayOfWeek = currentDate.getDay();
        
        const daySchedule = schedule[dayOfWeek];
        const requiredTimes = [...daySchedule.morning, ...daySchedule.evening];
        
        const startOfDay = new Date(currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: existingSlots } = await sb
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
        
        for (let slot of existingSlots || []) {
            const d = new Date(slot.start_time);
            const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            if (!requiredTimes.includes(timeStr)) {
                await sb.from('bookings').delete().eq('slot_id', slot.id);
                await sb.from('slots').delete().eq('id', slot.id);
            }
        }
        
        for (let time of requiredTimes) {
            if (!existingTimesSet.has(time)) {
                const [hours, minutes] = time.split(':');
                const startTime = new Date(currentDate);
                startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                if (startTime < new Date()) continue;
                
                const endTime = new Date(startTime);
                endTime.setHours(startTime.getHours() + 1);
                
                await sb.from('slots').insert({
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    is_available: true
                });
            }
        }
    }
}

// --- Вспомогательная функция для отображения слота в админке ---
function addSlotElement(container, slot) {
    const start = new Date(slot.start_time);
    const isAvailable = slot.is_available;
    
    const div = document.createElement('div');
    div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; background: ${isAvailable ? '#fff' : '#f0f0f0'}; border-radius: 8px; border: 1px solid ${isAvailable ? '#e0e0e0' : '#ffcccc'};`;
    div.innerHTML = `
        <span style="${isAvailable ? '' : 'text-decoration: line-through; color: #999;'}">
            ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            ${!isAvailable ? ' ❌ занят' : ''}
        </span>
        ${isAvailable ? '<button class="delete-slot-btn" data-id="' + slot.id + '" style="background: #ff3b30; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer;">✖</button>' : ''}
    `;
    
    if (isAvailable) {
        const deleteBtn = div.querySelector('.delete-slot-btn');
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Удалить этот слот?')) {
                await sb.from('bookings').delete().eq('slot_id', slot.id);
                await sb.from('slots').delete().eq('id', slot.id);
                await loadAdminData();
            }
        });
    }
    
    container.appendChild(div);
}

// --- Админ-панель ---
async function loadAdminData() {
    await ensureWeeklySchedule();
    
    const adminSlotsDiv = document.getElementById('admin-slots');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (adminSlotsDiv) adminSlotsDiv.innerHTML = '';
    if (adminBookingsDiv) adminBookingsDiv.innerHTML = '';
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    
    const { data: slots } = await sb
        .from('slots')
        .select('*')
        .gte('start_time', today.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');
    
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
                dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
                dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
                
                const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
                const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
                
                if (morning.length > 0) {
                    const morningDiv = document.createElement('div');
                    morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
                    morning.forEach(slot => addSlotElement(morningDiv, slot));
                    dayDiv.appendChild(morningDiv);
                }
                
                if (evening.length > 0) {
                    const eveningDiv = document.createElement('div');
                    eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
                    evening.forEach(slot => addSlotElement(eveningDiv, slot));
                    dayDiv.appendChild(eveningDiv);
                }
                
                adminSlotsDiv.appendChild(dayDiv);
            }
        }
    }
    
    const { data: bookings } = await sb.rpc('get_bookings_with_profiles');
    
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
                    <button class="delete-booking-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">✖ Удалить</button>
                `;
                
                const deleteBtn = div.querySelector('.delete-booking-btn');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                        await sb.from('bookings').delete().eq('id', booking.id);
                        await sb.from('slots').update({ is_available: true }).eq('id', booking.slot_id);
                        alert('Запись удалена, слот свободен');
                        await loadAdminData();
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
    
    setupAdminTabs();
}

// --- Переключение между вкладками в админ-панели ---
function setupAdminTabs() {
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
        newSlotsTab.style.background = '#007aff';
        newSlotsTab.style.color = 'white';
        newClientsTab.style.background = '#e9ecef';
        newClientsTab.style.color = '#1e1e1e';
        slotsPanel.style.display = 'block';
        clientsPanel.style.display = 'none';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'block';
    });
    
    newClientsTab.addEventListener('click', async () => {
        newClientsTab.style.background = '#007aff';
        newClientsTab.style.color = 'white';
        newSlotsTab.style.background = '#e9ecef';
        newSlotsTab.style.color = '#1e1e1e';
        slotsPanel.style.display = 'none';
        clientsPanel.style.display = 'block';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'none';
        
        if (typeof renderClientsList === 'function') {
            await renderClientsList();
        }
    });
}

// --- Загрузка списка клиентов ---
async function loadClientsList() {
    const adminId = 'edafd00c-3f7d-47aa-8d69-9efbe95de98e';
    
    const { data: profiles, error } = await sb
        .from('profiles')
        .select('*')
        .neq('id', adminId)
        .order('name');
    
    if (error) {
        console.error('Ошибка загрузки клиентов:', error);
        return [];
    }
    
    return profiles || [];
}

// --- Отображение списка клиентов ---
async function renderClientsList() {
    const container = document.getElementById('admin-clients-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка клиентов...</div>';
    
    const clients = await loadClientsList();
    
    if (!clients || clients.length === 0) {
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

// --- Отображение карточки клиента ---
async function showClientDetails(client) {
    const { data: bookings } = await sb
        .from('bookings')
        .select('id, slot_id, slots(start_time, end_time)')
        .eq('user_id', client.id);
    
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;`;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; padding: 20px;`;
    
    let bookingsHtml = '';
    if (bookings && bookings.length > 0) {
        bookings.forEach(booking => {
            const start = new Date(booking.slots.start_time);
            bookingsHtml += `
                <div style="display: flex; justify-content: space-between; padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 8px;">
                    <span>${start.toLocaleString()}</span>
                    <button class="delete-booking-from-client" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 4px 12px; border-radius: 6px;">✖</button>
                </div>
            `;
        });
    } else {
        bookingsHtml = '<p>Нет записей</p>';
    }
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <h2>👤 ${client.name || 'Без имени'}</h2>
            <button id="close-client-modal" style="background: none; border: none; font-size: 24px;">✖</button>
        </div>
        <p><strong>📞 Телефон:</strong> ${client.phone || 'не указан'}</p>
        <div style="margin: 15px 0;">
            <label>Вес (кг):</label>
            <input type="number" id="edit-weight" step="0.1" value="${client.weight || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <div style="margin: 15px 0;">
            <label>Абонемент до:</label>
            <input type="date" id="edit-subscription" value="${client.subscription_until || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <div style="margin: 15px 0;">
            <label>Норма шагов в день:</label>
            <input type="number" id="edit-min-steps" value="${client.min_steps || 10000}" style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <button id="save-profile-btn" style="background: #007aff; color: white; padding: 10px; border: none; border-radius: 8px; width: 100%; margin: 10px 0;">💾 Сохранить</button>
        <h3>Записи клиента</h3>
        <div id="client-bookings-list">${bookingsHtml}</div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    document.getElementById('close-client-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    document.getElementById('save-profile-btn').onclick = async () => {
        const weight = document.getElementById('edit-weight').value;
        const subscriptionUntil = document.getElementById('edit-subscription').value;
        const minSteps = document.getElementById('edit-min-steps').value;
        
        const updateData = {};
        if (weight) updateData.weight = parseFloat(weight);
        if (subscriptionUntil) updateData.subscription_until = subscriptionUntil;
        if (minSteps) updateData.min_steps = parseInt(minSteps);
        
        await sb.from('profiles').update(updateData).eq('id', client.id);
        alert('✅ Профиль обновлен');
        modal.remove();
        await renderClientsList();
    };
    
    document.querySelectorAll('.delete-booking-from-client').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Удалить запись?')) {
                await sb.from('bookings').delete().eq('id', btn.dataset.id);
                await sb.from('slots').update({ is_available: true }).eq('id', btn.dataset.slot);
                modal.remove();
                await renderClientsList();
                await loadAdminData();
            }
        };
    });
}

// --- Загрузка профиля пользователя ---
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

// --- Загрузка истории веса ---
async function loadWeightHistory() {
    if (!currentUser) return [];
    const { data } = await sb
        .from('weight_history')
        .select('weight, weigh_date')
        .eq('user_id', currentUser.id)
        .order('weigh_date', { ascending: true });
    return data || [];
}

// --- Сохранение веса ---
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

// --- Проверка возможности добавления веса ---
function canAddWeight(history) {
    if (!history || history.length === 0) return true;
    const lastDate = new Date(history[history.length - 1].weigh_date);
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    return isMonday && daysSinceLast >= 7;
}

// --- Открытие модалки веса ---
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

// --- Отрисовка графика веса ---
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

// --- Загрузка нормы шагов ---
async function loadMinSteps() {
    if (!currentUser) return 10000;
    const { data } = await sb.from('profiles').select('min_steps').eq('id', currentUser.id).single();
    return data?.min_steps || 10000;
}

// --- Проверка времени для добавления шагов ---
function canAddSteps() {
    const hours = new Date().getHours();
    return hours >= 19;
}

// --- Сохранение шагов ---
async function saveSteps(steps) {
    if (!currentUser) return false;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await sb.from('steps_history').upsert({
        user_id: currentUser.id,
        steps: parseInt(steps),
        steps_date: today
    }, { onConflict: 'user_id,steps_date' });
    return !error;
}

// --- Загрузка истории шагов ---
async function loadStepsHistory() {
    if (!currentUser) return [];
    const { data } = await sb
        .from('steps_history')
        .select('steps, steps_date')
        .eq('user_id', currentUser.id)
        .order('steps_date', { ascending: false })
        .limit(30);
    return data || [];
}

// --- Отображение истории шагов ---
async function renderStepsHistory() {
    const history = await loadStepsHistory();
    const minSteps = await loadMinSteps();
    const container = document.getElementById('steps-history-list');
    if (!container) return;
    
    if (!history || history.length === 0) {
        container.innerHTML = '<p>Нет данных</p>';
        return;
    }
    
    container.innerHTML = '';
    for (let record of history) {
        const date = new Date(record.steps_date).toLocaleDateString();
        const isOk = record.steps >= minSteps;
        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 10px; margin-bottom: 8px; background: ${isOk ? '#e8f5e9' : '#ffebee'}; border-radius: 8px;">
                <span>${date}</span>
                <span style="font-weight: bold;">${record.steps.toLocaleString()}</span>
                <span>${isOk ? '✅' : '⚠️'}</span>
            </div>
        `;
    }
}

// --- Открытие экрана отчетов ---
async function openStepsReport() {
    const canAdd = canAddSteps();
    const stepsInput = document.getElementById('steps-input');
    const addBtn = document.getElementById('add-steps-btn');
    const errorDiv = document.getElementById('steps-error');
    
    if (!canAdd) {
        errorDiv.textContent = '⚠️ Добавление шагов возможно только с 19:00';
        errorDiv.style.display = 'block';
        stepsInput.disabled = true;
        addBtn.disabled = true;
    } else {
        errorDiv.style.display = 'none';
        stepsInput.disabled = false;
        addBtn.disabled = false;
    }
    
    const minSteps = await loadMinSteps();
    document.getElementById('user-min-steps').innerHTML = `${minSteps.toLocaleString()} шагов`;
    await renderStepsHistory();
    showScreen('steps');
}

// --- Обработчик добавления шагов ---
async function handleAddSteps() {
    const steps = document.getElementById('steps-input').value;
    if (!steps || steps <= 0) return alert('Введите шаги');
    const minSteps = await loadMinSteps();
    const success = await saveSteps(steps);
    if (success) {
        alert(`✅ Шаги сохранены!\nНорма: ${minSteps.toLocaleString()}`);
        document.getElementById('steps-input').value = '';
        await renderStepsHistory();
    } else {
        alert('❌ Ошибка сохранения');
    }
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
    
    // Обработчики кнопок
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
});
