// ============================================
// МОДУЛЬ ЕЖЕДНЕВНЫХ ОТЧЕТОВ (с московским временем)
// ============================================

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ МОСКОВСКОГО ВРЕМЕНИ
// ============================================

function getMoscowDate(date = new Date()) {
    const mskDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    return mskDate;
}

function getMoscowDateString(date = new Date()) {
    const mskDate = getMoscowDate(date);
    return mskDate.toISOString().split('T')[0];
}

function getMoscowStartOfWeek(date = new Date()) {
    const mskDate = getMoscowDate(date);
    const day = mskDate.getDay();
    const daysToMonday = (day === 0 ? 6 : day - 1);
    mskDate.setDate(mskDate.getDate() - daysToMonday);
    mskDate.setHours(0, 0, 0, 0);
    return mskDate;
}

// --- Переменные состояния отчета ---
let currentTrainingType = '';
let currentTrainingTime = '';
let currentSocialEvent = false;
let currentPreMeal = '';
let currentPostMeal = '';

// --- Инициализация UI ---
window.app.initDailyReportUI = function() {
    console.log('initDailyReportUI вызван');
    
    const strengthBtn = document.getElementById('training-strength');
    const cardioBtn = document.getElementById('training-cardio');
    const restBtn = document.getElementById('training-rest');
    
    if (strengthBtn) strengthBtn.addEventListener('click', () => setTrainingType('strength'));
    if (cardioBtn) cardioBtn.addEventListener('click', () => setTrainingType('cardio'));
    if (restBtn) restBtn.addEventListener('click', () => setTrainingType('rest'));
    
    const morningBtn = document.getElementById('time-morning');
    const dayBtn = document.getElementById('time-day');
    const eveningBtn = document.getElementById('time-evening');
    
    if (morningBtn) morningBtn.addEventListener('click', () => setTrainingTime('morning'));
    if (dayBtn) dayBtn.addEventListener('click', () => setTrainingTime('day'));
    if (eveningBtn) eveningBtn.addEventListener('click', () => setTrainingTime('evening'));
    
    const socialNoBtn = document.getElementById('social-no');
    const socialYesBtn = document.getElementById('social-yes');
    
    if (socialNoBtn) socialNoBtn.addEventListener('click', () => setSocialEvent(false));
    if (socialYesBtn) socialYesBtn.addEventListener('click', () => setSocialEvent(true));
    
    const preYesBtn = document.getElementById('pre-yes');
    const preNoBtn = document.getElementById('pre-no');
    
    if (preYesBtn) preYesBtn.addEventListener('click', () => setPreMeal('yes'));
    if (preNoBtn) preNoBtn.addEventListener('click', () => setPreMeal('no'));
    
    const postYesBtn = document.getElementById('post-yes');
    const postNoBtn = document.getElementById('post-no');
    
    if (postYesBtn) postYesBtn.addEventListener('click', () => setPostMeal('yes'));
    if (postNoBtn) postNoBtn.addEventListener('click', () => setPostMeal('no'));
    
    const saveBtn = document.getElementById('save-daily-report-btn');
    if (saveBtn) saveBtn.addEventListener('click', window.app.saveDailyReport);
};

// --- Установка типа тренировки ---
function setTrainingType(type) {
    currentTrainingType = type;
    const btns = {
        strength: document.getElementById('training-strength'),
        cardio: document.getElementById('training-cardio'),
        rest: document.getElementById('training-rest')
    };
    
    Object.entries(btns).forEach(([key, btn]) => {
        if (btn) {
            btn.style.background = type === key ? '#36B647' : '#e9ecef';
            btn.style.color = type === key ? 'white' : '#1e1e1e';
        }
    });
    
    const trainingTypeInput = document.getElementById('training-type');
    if (trainingTypeInput) trainingTypeInput.value = type;
    
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

// --- Установка времени тренировки ---
function setTrainingTime(time) {
    currentTrainingTime = time;
    const btns = {
        morning: document.getElementById('time-morning'),
        day: document.getElementById('time-day'),
        evening: document.getElementById('time-evening')
    };
    
    Object.entries(btns).forEach(([key, btn]) => {
        if (btn) {
            btn.style.background = time === key ? '#36B647' : '#e9ecef';
            btn.style.color = time === key ? 'white' : '#1e1e1e';
        }
    });
    const trainingTimeInput = document.getElementById('training-time');
    if (trainingTimeInput) trainingTimeInput.value = time;
}

// --- Установка социального события ---
function setSocialEvent(value) {
    currentSocialEvent = value;
    const noBtn = document.getElementById('social-no');
    const yesBtn = document.getElementById('social-yes');
    if (noBtn) {
        noBtn.style.background = !value ? '#36B647' : '#e9ecef';
        noBtn.style.color = !value ? 'white' : '#1e1e1e';
    }
    if (yesBtn) {
        yesBtn.style.background = value ? '#36B647' : '#e9ecef';
        yesBtn.style.color = value ? 'white' : '#1e1e1e';
    }
    const socialEventInput = document.getElementById('social-event');
    if (socialEventInput) socialEventInput.value = value;
}

// --- Установка питания до тренировки ---
function setPreMeal(value) {
    currentPreMeal = value;
    const yesBtn = document.getElementById('pre-yes');
    const noBtn = document.getElementById('pre-no');
    if (yesBtn) {
        yesBtn.style.background = value === 'yes' ? '#36B647' : '#e9ecef';
        yesBtn.style.color = value === 'yes' ? 'white' : '#1e1e1e';
    }
    if (noBtn) {
        noBtn.style.background = value === 'no' ? '#dc3545' : '#e9ecef';
        noBtn.style.color = value === 'no' ? 'white' : '#1e1e1e';
    }
    const preMealInput = document.getElementById('pre-meal');
    if (preMealInput) preMealInput.value = value;
}

// --- Установка питания после тренировки ---
function setPostMeal(value) {
    currentPostMeal = value;
    const yesBtn = document.getElementById('post-yes');
    const noBtn = document.getElementById('post-no');
    if (yesBtn) {
        yesBtn.style.background = value === 'yes' ? '#36B647' : '#e9ecef';
        yesBtn.style.color = value === 'yes' ? 'white' : '#1e1e1e';
    }
    if (noBtn) {
        noBtn.style.background = value === 'no' ? '#dc3545' : '#e9ecef';
        noBtn.style.color = value === 'no' ? 'white' : '#1e1e1e';
    }
    const postMealInput = document.getElementById('post-meal');
    if (postMealInput) postMealInput.value = value;
}

// --- Сохранение отчета ---
window.app.saveDailyReport = async function() {
    console.log('saveDailyReport вызвана');
    
    const stepsInput = document.getElementById('daily-steps');
    const steps = parseInt(stepsInput?.value || 0);
    
    if (!steps || steps <= 0) {
        alert('Введите количество шагов');
        return;
    }
    
    const trainingType = currentTrainingType;
    const trainingTime = currentTrainingTime;
    const socialEvent = currentSocialEvent;
    const preMeal = currentPreMeal === 'yes' ? true : (currentPreMeal === 'no' ? false : null);
    const postMeal = currentPostMeal === 'yes' ? true : (currentPostMeal === 'no' ? false : null);
    const notes = document.getElementById('daily-notes')?.value || '';
    
    const today = getMoscowDateString();
    
    console.log('Сохраняем отчет за дату (МСК):', today);
    
    const { error } = await window.app.sb
        .from('daily_reports')
        .upsert({
            user_id: window.app.currentUser.id,
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
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    } else {
        console.log('Отчет успешно сохранен');
        alert('✅ Отчет сохранен!');
        
        if (typeof window.app.loadWeeklyProgress === 'function') {
            await window.app.loadWeeklyProgress();
        }
        
        if (typeof window.app.updateWeeklyMessage === 'function') {
            await window.app.updateWeeklyMessage();
        }
    }
};

// --- Загрузка прогресса за неделю ---
window.app.loadWeeklyProgress = async function() {
    console.log('=== loadWeeklyProgress START ===');
    
    if (!window.app.currentUser) return;
    
    const today = getMoscowDate();
    const startOfWeek = getMoscowStartOfWeek(today);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startDateStr = startOfWeek.toISOString().split('T')[0];
    const endDateStr = endOfWeek.toISOString().split('T')[0];
    const todayStr = getMoscowDateString();
    
    console.log('Неделя (МСК):', startDateStr, '-', endDateStr);
    console.log('Сегодня (МСК):', todayStr);
    
    const { data: reports } = await window.app.sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', window.app.currentUser.id)
        .gte('report_date', startDateStr)
        .lte('report_date', endDateStr)
        .order('report_date');
    
    console.log('Найдено отчетов:', reports?.length || 0);
    
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('target_strength_weekly, target_cardio_weekly, min_steps')
        .eq('id', window.app.currentUser.id)
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
                        <span><strong style="color: #36B647;">${dailyNorm.toLocaleString()}</strong> шагов</span>
                    </div>
                </div>
                <p style="text-align: center;">Нет данных за эту неделю</p>
                <p style="text-align: center; font-size: 12px; color: #999;">Неделя: ${startDateStr} - ${endDateStr}</p>
                <p style="text-align: center; font-size: 12px; color: #999;">Сегодня: ${todayStr}</p>
            </div>
        `;
        return;
    }
    
    let strengthCount = 0, cardioCount = 0, socialDays = 0, lowStepsDays = 0;
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
        
        const socialIcon = r.social_event ? '🎉' : '✅';
        
        dailyTable += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                <div style="flex: 1;">
                    <span style="font-weight: 500;">${dayName}</span>
                    <span style="margin-left: 8px; font-size: 12px;">${trainingIcon} ${socialIcon}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-weight: 500;">${steps.toLocaleString()}</span>
                    <span style="margin-left: 8px; color: ${stepsOk ? '#36B647' : '#dc3545'};">${stepsOk ? '✅' : '⚠️'}</span>
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
                    <span><strong style="color: #36B647;">${dailyNorm.toLocaleString()}</strong> шагов</span>
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
                    <span><strong style="color: ${lowStepsDays > 0 ? '#dc3545' : '#36B647'};">${lowStepsDays} дней</strong></span>
                </div>
            </div>
            
            ${dailyTable}
        </div>
    `;
};

// --- Открытие экрана отчета ---
window.app.openDailyReport = async function() {
    console.log('openDailyReport вызвана');
    
    if (!window.app.currentUser) return;
    
    const today = getMoscowDateString();
    const dateEl = document.getElementById('daily-report-date');
    if (dateEl) {
        const mskDate = getMoscowDate();
        dateEl.innerHTML = `📅 ${mskDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' })}`;
    }
    
    const { data: existing } = await window.app.sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', window.app.currentUser.id)
        .eq('report_date', today)
        .maybeSingle();
    
    if (existing) {
        const stepsInput = document.getElementById('daily-steps');
        if (stepsInput) stepsInput.value = existing.steps || '';
        
        setTrainingType(existing.training_type || '');
        setTrainingTime(existing.training_time || '');
        setSocialEvent(existing.social_event || false);
        setPreMeal(existing.pre_meal_compliant === true ? 'yes' : (existing.pre_meal_compliant === false ? 'no' : ''));
        setPostMeal(existing.post_meal_compliant === true ? 'yes' : (existing.post_meal_compliant === false ? 'no' : ''));
        
        const notesInput = document.getElementById('daily-notes');
        if (notesInput) notesInput.value = existing.notes || '';
    } else {
        const stepsInput = document.getElementById('daily-steps');
        if (stepsInput) stepsInput.value = '';
        
        setTrainingType('');
        setTrainingTime('');
        setSocialEvent(false);
        setPreMeal('');
        setPostMeal('');
        
        const notesInput = document.getElementById('daily-notes');
        if (notesInput) notesInput.value = '';
    }
    
    if (typeof window.app.loadWeeklyProgress === 'function') {
        await window.app.loadWeeklyProgress();
    }
    
    window.app.showScreen('dailyReport');
};
