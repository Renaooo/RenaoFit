// ============================================
// МОДУЛЬ ЕЖЕДНЕВНЫХ ОТЧЕТОВ
// ============================================

let currentTrainingType = '';
let currentTrainingTime = '';
let currentSocialEvent = false;
let currentPreMeal = '';
let currentPostMeal = '';
let currentWeekOffset = 0;

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

async function updateMealBlocksVisibility() {
    if (!window.app.currentUser) return;
    
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('fitness_goal')
        .eq('id', window.app.currentUser.id)
        .single();
    
    const isWellnessMode = profile?.fitness_goal === 'wellness';
    const preMealContainer = document.getElementById('pre-meal-container');
    const postMealContainer = document.getElementById('post-meal-container');
    
    if (preMealContainer) preMealContainer.style.display = isWellnessMode ? 'none' : 'block';
    if (postMealContainer) postMealContainer.style.display = isWellnessMode ? 'none' : 'block';
}

window.app.initDailyReportUI = function() {
    console.log('initDailyReportUI вызван');
    
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
    
    document.getElementById('save-daily-report-btn')?.addEventListener('click', window.app.saveDailyReport);
    
    document.getElementById('prev-week-btn')?.addEventListener('click', () => {
        if (currentWeekOffset > -2) { currentWeekOffset--; window.app.loadWeeklyProgress(); }
    });
    document.getElementById('next-week-btn')?.addEventListener('click', () => {
        if (currentWeekOffset < 0) { currentWeekOffset++; window.app.loadWeeklyProgress(); }
    });
};

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
    document.getElementById('training-type').value = type;
    
    const timeContainer = document.getElementById('training-time-container');
    if (type === 'rest') {
        if (timeContainer) timeContainer.style.display = 'none';
        currentTrainingTime = '';
        currentPreMeal = '';
        currentPostMeal = '';
    } else {
        if (timeContainer) timeContainer.style.display = 'block';
        updateMealBlocksVisibility();
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
            btn.style.background = time === key ? '#36B647' : '#e9ecef';
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
        noBtn.style.background = !value ? '#36B647' : '#e9ecef';
        noBtn.style.color = !value ? 'white' : '#1e1e1e';
    }
    if (yesBtn) {
        yesBtn.style.background = value ? '#dc3545' : '#e9ecef';
        yesBtn.style.color = value ? 'white' : '#1e1e1e';
    }
    document.getElementById('social-event').value = value;
}

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
    document.getElementById('pre-meal').value = value;
}

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
    document.getElementById('post-meal').value = value;
}

window.app.saveDailyReport = async function() {
    const steps = parseInt(document.getElementById('daily-steps')?.value || 0);
    if (!steps || steps <= 0) return alert('Введите количество шагов');
    
    const today = getMoscowDateString();
    const { data: profile } = await window.app.sb.from('profiles').select('min_steps').eq('id', window.app.currentUser.id).single();
    const currentNorm = profile?.min_steps || 10000;
    
    const { error } = await window.app.sb.from('daily_reports').upsert({
        user_id: window.app.currentUser.id,
        report_date: today,
        steps: steps,
        training_type: currentTrainingType === 'rest' ? 'rest' : currentTrainingType,
        training_time: currentTrainingTime || null,
        social_event: currentSocialEvent,
        pre_meal_compliant: currentPreMeal === 'yes' ? true : (currentPreMeal === 'no' ? false : null),
        post_meal_compliant: currentPostMeal === 'yes' ? true : (currentPostMeal === 'no' ? false : null),
        notes: document.getElementById('daily-notes')?.value || '',
        norm_steps: currentNorm
    }, { onConflict: 'user_id,report_date' });
    
    if (error) alert('Ошибка сохранения: ' + error.message);
    else {
        alert('✅ Отчет сохранен!');
        await window.app.loadWeeklyProgress();
        if (typeof window.app.updateWeeklyMessage === 'function') await window.app.updateWeeklyMessage();
    }
};

window.app.loadWeeklyProgress = async function() {
    if (!window.app.currentUser) return;
    
    const { data: profile } = await window.app.sb.from('profiles').select('fitness_goal, min_steps, target_strength_weekly, target_cardio_weekly')
        .eq('id', window.app.currentUser.id).single();
    
    const isWellnessMode = profile?.fitness_goal === 'wellness';
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    
    const now = new Date();
    const mskDate = getMoscowDate(now);
    const targetDate = new Date(mskDate);
    targetDate.setDate(mskDate.getDate() + (currentWeekOffset * 7));
    
    const monday = getMoscowStartOfWeek(targetDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const startDateStr = monday.toISOString().split('T')[0];
    const endDateStr = sunday.toISOString().split('T')[0];
    
    const weekTitle = currentWeekOffset === 0 ? 'Текущая неделя' : `${monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })} - ${sunday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}`;
    document.getElementById('weekly-week-title').textContent = weekTitle;
    document.getElementById('prev-week-btn').disabled = currentWeekOffset <= -2;
    document.getElementById('next-week-btn').disabled = currentWeekOffset >= 0;
    
    const { data: reports } = await window.app.sb.from('daily_reports').select('*').eq('user_id', window.app.currentUser.id)
        .gte('report_date', startDateStr).lte('report_date', endDateStr).order('report_date');
    
    const displayNorm = reports?.length ? reports[reports.length - 1].norm_steps : (profile?.min_steps || 10000);
    const container = document.getElementById('weekly-progress');
    if (!container) return;
    
    if (!reports?.length) {
        container.innerHTML = `<div style="background:#f8f9fa;border-radius:12px;padding:15px;"><div>🎯 Норма шагов: <strong>${displayNorm.toLocaleString()}</strong></div><p style="text-align:center;">Нет данных за эту неделю</p></div>`;
        return;
    }
    
    const reportsMap = Object.fromEntries(reports.map(r => [r.report_date, r]));
    let strengthCount = 0, cardioCount = 0, socialDays = 0, lowStepsDays = 0;
    let dailyTable = '<div style="margin-top:15px;"><h4>📅 По дням</h4>';
    
    for (let i = 0; i < 7; i++) {
        const currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];
        const dayName = currentDay.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
        const report = reportsMap[dateStr];
        
        if (report) {
            const stepsOk = report.steps >= (report.norm_steps || displayNorm);
            if (!stepsOk) lowStepsDays++;
            let trainingIcon = { strength: '💪', cardio: '🏃', rest: '😴' }[report.training_type] || '⚪';
            dailyTable += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                <div><span style="font-weight:500;">${dayName}</span> <span style="margin-left:8px;">${trainingIcon} ${report.social_event ? '⚠️' : '✅'}</span></div>
                <div><span>${report.steps.toLocaleString()}</span> <span style="margin-left:8px;color:${stepsOk ? '#36B647' : '#dc3545'};">${stepsOk ? '✅' : '⚠️'}</span></div>
            </div>`;
            if (report.training_type === 'strength') strengthCount++;
            if (report.training_type === 'cardio') cardioCount++;
            if (report.social_event) socialDays++;
        } else {
            dailyTable += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                <div><span style="font-weight:500;color:#999;">${dayName}</span> <span>⚪</span></div>
                <div><span style="color:#999;">—</span></div>
            </div>`;
        }
    }
    dailyTable += '</div>';
    
    container.innerHTML = `
        <div style="background:#f8f9fa;border-radius:12px;padding:15px;">
            <div style="margin-bottom:15px;"><div>🎯 Норма шагов: <strong>${displayNorm.toLocaleString()}</strong></div></div>
            <div style="margin-bottom:15px;">
                <div>💪 Силовые: <strong>${strengthCount} / ${targetStrength}</strong> ${strengthCount >= targetStrength ? '✅' : '⚠️'}</div>
                <div>🏃 Кардио: <strong>${cardioCount} / ${targetCardio}</strong> ${cardioCount >= targetCardio ? '✅' : '⚠️'}</div>
                <div>🎉 Социальные приемы: <strong>${socialDays} дней</strong> ${socialDays <= 1 ? '✅' : '⚠️'}</div>
                ${!isWellnessMode ? `<div>📉 Дней с шагами ниже нормы: <strong>${lowStepsDays} дней</strong></div>` : ''}
            </div>
            ${dailyTable}
        </div>
    `;
};

window.app.openDailyReport = async function() {
    if (!window.app.currentUser) return;
    currentWeekOffset = 0;
    
    const today = getMoscowDateString();
    document.getElementById('daily-report-date').innerHTML = `📅 ${getMoscowDate().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' })}`;
    
    const { data: existing } = await window.app.sb.from('daily_reports').select('*')
        .eq('user_id', window.app.currentUser.id).eq('report_date', today).maybeSingle();
    
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
    
    await updateMealBlocksVisibility();
    await window.app.loadWeeklyProgress();
    
    // Прямое переключение экрана
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dailyReport-screen').classList.add('active');
};
