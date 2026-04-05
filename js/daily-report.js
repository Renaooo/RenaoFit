// ============================================
// МОДУЛЬ ЕЖЕДНЕВНЫХ ОТЧЕТОВ
// ============================================

// --- Переменные состояния отчета ---
let currentTrainingType = '';
let currentTrainingTime = '';
let currentSocialEvent = false;
let currentPreMeal = '';
let currentPostMeal = '';

// --- Инициализация UI ежедневного отчета ---
function initDailyReportUI() {
    // Тип тренировки
    document.getElementById('training-strength')?.addEventListener('click', () => setTrainingType('strength'));
    document.getElementById('training-cardio')?.addEventListener('click', () => setTrainingType('cardio'));
    document.getElementById('training-rest')?.addEventListener('click', () => setTrainingType('rest'));
    
    // Время тренировки
    document.getElementById('time-morning')?.addEventListener('click', () => setTrainingTime('morning'));
    document.getElementById('time-day')?.addEventListener('click', () => setTrainingTime('day'));
    document.getElementById('time-evening')?.addEventListener('click', () => setTrainingTime('evening'));
    
    // Социальный прием пищи
    document.getElementById('social-no')?.addEventListener('click', () => setSocialEvent(false));
    document.getElementById('social-yes')?.addEventListener('click', () => setSocialEvent(true));
    
    // Питание до тренировки
    document.getElementById('pre-yes')?.addEventListener('click', () => setPreMeal('yes'));
    document.getElementById('pre-no')?.addEventListener('click', () => setPreMeal('no'));
    
    // Питание после тренировки
    document.getElementById('post-yes')?.addEventListener('click', () => setPostMeal('yes'));
    document.getElementById('post-no')?.addEventListener('click', () => setPostMeal('no'));
    
    // Сохранение
    document.getElementById('save-daily-report-btn')?.addEventListener('click', saveDailyReport);
}

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
            btn.style.background = time === key ? '#007aff' : '#e9ecef';
            btn.style.color = time === key ? 'white' : '#1e1e1e';
        }
    });
    document.getElementById('training-time').value = time;
}

// --- Установка социального события ---
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

// --- Установка питания до тренировки ---
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

// --- Установка питания после тренировки ---
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

// --- Сохранение ежедневного отчета ---
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

// --- Определение начала недели (понедельник) ---
function getStartOfWeek(date) {
    const day = date.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    const start = new Date(date);
    start.setDate(date.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
}

// --- Загрузка и отображение прогресса за неделю ---
async function loadWeeklyProgress() {
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
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

// --- Открытие экрана ежедневного отчета ---
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
