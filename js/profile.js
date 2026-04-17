// ============================================
// МОДУЛЬ ПРОФИЛЯ (ВЕС, ГРАФИК, МОТИВАЦИОННЫЕ СООБЩЕНИЯ)
// ДОБАВЛЕНА ЦЕЛЬ "ЗДОРОВЬЕ И ХОРОШЕЕ САМОЧУВСТВИЕ"
// ============================================

// --- Загрузка профиля пользователя ---
window.app.loadMyProfile = async function() {
    if (!window.app.currentUser) return;
    
    const { data: profile, error } = await window.app.sb
        .from('profiles')
        .select('weight, subscription_until, fitness_goal, min_steps, target_strength_weekly, target_cardio_weekly')
        .eq('id', window.app.currentUser.id)
        .single();
    
    if (error) {
        console.error('Ошибка загрузки профиля:', error);
        return;
    }
    
    // Сохраняем цель в глобальную переменную для других модулей
    window.app.currentUserFitnessGoal = profile?.fitness_goal || 'weight_loss';
    
    // Отображаем абонемент
    const subscriptionEl = document.getElementById('profile-subscription');
    if (subscriptionEl) {
        if (profile?.subscription_until) {
            const untilDate = new Date(profile.subscription_until);
            const daysLeft = Math.ceil((untilDate - new Date()) / (1000 * 60 * 60 * 24));
            
            if (daysLeft < 0) {
                subscriptionEl.innerHTML = '❌ Истек';
                subscriptionEl.style.color = '#ff3b30';
            } else if (daysLeft <= 7) {
                subscriptionEl.innerHTML = `⚠️ ${daysLeft} дней (до ${untilDate.toLocaleDateString()})`;
                subscriptionEl.style.color = '#ff9500';
            } else {
                subscriptionEl.innerHTML = `✅ ${daysLeft} дней (до ${untilDate.toLocaleDateString()})`;
                subscriptionEl.style.color = '#34c759';
            }
        } else {
            subscriptionEl.innerHTML = '—';
            subscriptionEl.style.color = '#666';
        }
    }
    
    // Отображаем цель в профиле (добавим новый элемент)
    let goalEl = document.getElementById('profile-goal');
    if (!goalEl) {
        const container = document.querySelector('#profile-screen .container > div:first-child');
        if (container && subscriptionEl) {
            const goalDiv = document.createElement('div');
            goalDiv.style.cssText = 'background: #f8f9fa; border-radius: 16px; padding: 20px; margin-bottom: 20px;';
            goalDiv.innerHTML = `
                <label style="display: block; color: #666; font-size: 14px; margin-bottom: 5px;">🎯 Моя цель</label>
                <div style="font-size: 18px; font-weight: 500;" id="profile-goal"></div>
            `;
            container.parentNode.insertBefore(goalDiv, container.nextSibling);
            goalEl = document.getElementById('profile-goal');
        }
    }
    
    if (goalEl) {
        const goalText = profile?.fitness_goal === 'wellness' ? '🌿 Здоровье и хорошее самочувствие' : '🔥 Активное снижение веса';
        goalEl.innerHTML = goalText;
    }
    
    // Отображаем последний вес из истории (ТОЛЬКО для режима снижения веса)
    const weightEl = document.getElementById('profile-weight');
    const weightContainer = document.getElementById('profile-weight-container');
    const weightChartContainer = document.getElementById('weight-chart-container');
    
    const isWeightLossMode = profile?.fitness_goal !== 'wellness';
    
    if (isWeightLossMode) {
        const weightHistory = await window.app.loadWeightHistory();
        if (weightEl) {
            if (weightHistory && weightHistory.length > 0) {
                const lastWeight = weightHistory[weightHistory.length - 1].weight;
                weightEl.innerHTML = `${lastWeight} кг`;
                weightEl.style.color = '#1e1e1e';
            } else {
                weightEl.innerHTML = '—';
                weightEl.style.color = '#666';
            }
        }
        
        if (weightContainer) {
            weightContainer.style.cursor = 'pointer';
            weightContainer.onclick = () => window.app.openWeightModal();
        }
        
        if (weightChartContainer) {
            weightChartContainer.style.display = 'block';
            await window.app.renderWeightChart();
        }
    } else {
        // Режим "Здоровье" — скрываем вес и график
        if (weightEl && weightContainer) {
            weightEl.innerHTML = '—';
            weightContainer.style.cursor = 'default';
            weightContainer.onclick = null;
        }
        if (weightChartContainer) {
            weightChartContainer.style.display = 'none';
        }
    }
};

// --- Загрузка истории веса (только для режима снижения) ---
window.app.loadWeightHistory = async function() {
    if (!window.app.currentUser) return [];
    
    const { data, error } = await window.app.sb
        .from('weight_history')
        .select('weight, weigh_date, target_strength_weekly, target_cardio_weekly')
        .eq('user_id', window.app.currentUser.id)
        .order('weigh_date', { ascending: true });
    
    if (error) {
        console.error('Ошибка загрузки истории веса:', error);
        return [];
    }
    
    return data || [];
};

// --- Сохранение нового веса (только для режима снижения) ---
window.app.saveWeight = async function(weight) {
    if (!window.app.currentUser) return false;
    
    // Проверка режима
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('fitness_goal')
        .eq('id', window.app.currentUser.id)
        .single();
    
    if (profile?.fitness_goal === 'wellness') {
        alert('В режиме "Здоровье" взвешивание не требуется');
        return false;
    }
    
    const today = new Date();
    const isMonday = today.getDay() === 1;
    
    if (!isMonday) {
        alert('Взвешивание возможно только в понедельник!');
        return false;
    }
    
    const weighDate = today.toISOString().split('T')[0];
    
    const { data: profileData } = await window.app.sb
        .from('profiles')
        .select('target_strength_weekly, target_cardio_weekly')
        .eq('id', window.app.currentUser.id)
        .single();
    
    const targetStrength = profileData?.target_strength_weekly || 3;
    const targetCardio = profileData?.target_cardio_weekly || 1;
    
    const { error: historyError } = await window.app.sb
        .from('weight_history')
        .insert({
            user_id: window.app.currentUser.id,
            weight: parseFloat(weight),
            weigh_date: weighDate,
            target_strength_weekly: targetStrength,
            target_cardio_weekly: targetCardio
        });
    
    if (historyError) {
        console.error('Ошибка сохранения в историю:', historyError);
        alert('Ошибка сохранения: ' + historyError.message);
        return false;
    }
    
    const { error: profileError } = await window.app.sb
        .from('profiles')
        .update({ weight: parseFloat(weight) })
        .eq('id', window.app.currentUser.id);
    
    if (profileError) {
        console.error('Ошибка обновления профиля:', profileError);
    }
    
    return true;
};

// --- Проверка, можно ли добавить новый вес ---
window.app.canAddWeight = function(history) {
    if (!history || history.length === 0) return true;
    
    const lastWeighDate = new Date(history[history.length - 1].weigh_date);
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const daysSinceLast = Math.floor((today - lastWeighDate) / (1000 * 60 * 60 * 24));
    
    return isMonday && daysSinceLast >= 7;
};

// --- Открытие модального окна для взвешивания ---
window.app.openWeightModal = async function() {
    // Проверка режима
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('fitness_goal')
        .eq('id', window.app.currentUser.id)
        .single();
    
    if (profile?.fitness_goal === 'wellness') {
        alert('В режиме "Здоровье" взвешивание не требуется');
        return;
    }
    
    const history = await window.app.loadWeightHistory();
    const canAdd = window.app.canAddWeight(history);
    const modal = document.getElementById('weight-modal');
    const weightInput = document.getElementById('weight-input');
    const errorDiv = document.getElementById('weight-error');
    const saveBtn = document.getElementById('weight-save-btn');
    const cancelBtn = document.getElementById('weight-cancel-btn');
    
    errorDiv.style.display = 'none';
    weightInput.disabled = false;
    weightInput.value = '';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    cancelBtn.disabled = false;
    cancelBtn.style.opacity = '1';
    
    if (!canAdd) {
        const today = new Date();
        const isMonday = today.getDay() === 1;
        
        if (!isMonday) {
            errorDiv.textContent = '⚠️ Взвешивание возможно только по понедельникам.';
        } else {
            errorDiv.textContent = '⚠️ Взвешивание возможно не чаще 1 раза в неделю.';
        }
        errorDiv.style.display = 'block';
        weightInput.disabled = true;
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
    }
    
    modal.style.display = 'flex';
    
    const cleanup = () => {
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleClickOutside);
    };
    
    const handleSave = async () => {
        const weight = weightInput.value;
        if (!weight || weight <= 0) {
            alert('Введите корректный вес');
            return;
        }
        
        const success = await window.app.saveWeight(weight);
        if (success) {
            alert('✅ Вес сохранен!');
            modal.style.display = 'none';
            await window.app.loadMyProfile();
            if (typeof window.app.updateWeeklyMessage === 'function') {
                await window.app.updateWeeklyMessage();
            }
        } else {
            alert('❌ Ошибка сохранения. Возможно, вы уже взвешивались на этой неделе.');
        }
        
        cleanup();
    };
    
    const handleCancel = () => {
        modal.style.display = 'none';
    };
    
    const handleClickOutside = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleClickOutside);
    
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleClickOutside);
};

// --- Отрисовка графика веса ---
window.app.renderWeightChart = async function() {
    // Проверка режима
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('fitness_goal')
        .eq('id', window.app.currentUser.id)
        .single();
    
    if (profile?.fitness_goal === 'wellness') {
        return;
    }
    
    const history = await window.app.loadWeightHistory();
    const container = document.getElementById('weight-chart-container');
    const totalLossEl = document.getElementById('total-loss');
    const canvas = document.getElementById('weight-chart');
    
    if (!container) return;
    
    container.style.display = 'block';
    
    if (!history || history.length < 2) {
        totalLossEl.innerHTML = '📊 Добавьте вес в понедельник, чтобы увидеть динамику';
        totalLossEl.style.color = '#999';
        
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#999';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Нет данных для графика', canvas.width / 2, canvas.height / 2);
        }
        return;
    }
    
    const ctx = canvas?.getContext('2d');
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
                borderColor: '#36B647',
                backgroundColor: 'rgba(54, 182, 71, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#36B647',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.raw} кг`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'кг', font: { size: 12 } },
                    min: Math.floor(Math.min(...weights) - 2),
                    max: Math.ceil(Math.max(...weights) + 2)
                },
                x: {
                    title: { display: true, text: 'Дата', font: { size: 12 } }
                }
            }
        }
    });
    
    const firstWeight = history[0].weight;
    const lastWeight = history[history.length - 1].weight;
    const loss = (firstWeight - lastWeight).toFixed(1);
    
    if (loss > 0) {
        totalLossEl.innerHTML = `📉 Общая потеря: ${loss} кг`;
        totalLossEl.style.color = '#36B647';
    } else if (loss < 0) {
        totalLossEl.innerHTML = `📈 Общий набор: ${Math.abs(loss)} кг`;
        totalLossEl.style.color = '#dc3545';
    } else {
        totalLossEl.innerHTML = `⚖️ Вес стабилен: ${loss} кг`;
        totalLossEl.style.color = '#666';
    }
};

// --- Обновление мотивационного сообщения (адаптировано под цель) ---
window.app.updateWeeklyMessage = async function() {
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('fitness_goal, min_steps, target_strength_weekly, target_cardio_weekly')
        .eq('id', window.app.currentUser.id)
        .single();
    
    const isWellnessMode = profile?.fitness_goal === 'wellness';
    const targetStrength = profile?.target_strength_weekly || 3;
    const targetCardio = profile?.target_cardio_weekly || 1;
    const dailyNorm = profile?.min_steps || 10000;
    
    const today = new Date();
    const startOfWeek = window.app.getMoscowStartOfWeek?.(today) || (() => {
        const mskDate = new Date(today.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
        const day = mskDate.getDay();
        const diff = (day === 0 ? 6 : day - 1);
        mskDate.setDate(mskDate.getDate() - diff);
        mskDate.setHours(0, 0, 0, 0);
        return mskDate;
    })();
    
    const startDateStr = startOfWeek.toISOString().split('T')[0];
    const endDate = new Date(startOfWeek);
    endDate.setDate(startOfWeek.getDate() + 6);
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const { data: reports } = await window.app.sb
        .from('daily_reports')
        .select('*')
        .eq('user_id', window.app.currentUser.id)
        .gte('report_date', startDateStr)
        .lte('report_date', endDateStr);
    
    let actualStrength = 0, actualCardio = 0, socialDays = 0;
    let lowStepsDays = 0;
    let totalDays = 0;
    
    reports?.forEach(r => {
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
    const stepsOk = totalDays === 0 ? true : lowStepsDays === 0;
    
    const messageDiv = document.getElementById('weekly-message');
    const messageText = document.getElementById('weekly-message-text');
    
    if (!messageDiv || !messageText) return;
    
    if (isWellnessMode) {
        // Режим "Здоровье" — хвалим за выполнение рекомендаций
        const allCompliant = stepsOk && strengthOk && cardioOk && socialOk;
        
        if (allCompliant) {
            messageDiv.style.background = '#e8f5e9';
            messageDiv.style.borderLeftColor = '#36B647';
            messageText.innerHTML = `🌟 <strong>Отличная неделя!</strong> Ты выполнил(а) все рекомендации: шаги, тренировки и питание (без соц. событий)! Так держать! 💪✨`;
            messageDiv.style.display = 'block';
        } else {
            let failures = [];
            if (!stepsOk && totalDays > 0) failures.push(`👣 Шаги: в ${lowStepsDays} днях ниже нормы ${dailyNorm.toLocaleString()}`);
            if (!strengthOk) failures.push(`💪 Силовые: ${actualStrength} из ${targetStrength}`);
            if (!cardioOk) failures.push(`🏃 Кардио: ${actualCardio} из ${targetCardio}`);
            if (!socialOk) failures.push(`🎉 Социальные приемы пищи: ${socialDays} дней (допустимо не более 1)`);
            
            messageDiv.style.background = '#fff3e0';
            messageDiv.style.borderLeftColor = '#ff9800';
            messageText.innerHTML = `📋 <strong>На этой неделе не все рекомендации выполнены.</strong><br><br>Давай посмотрим, над чем поработать:<br>${failures.map(f => `• ${f}`).join('<br>')}<br><br>На следующей неделе ты точно справишься! 🔥`;
            messageDiv.style.display = 'block';
        }
    } else {
        // Режим "Снижение веса" — анализируем вес
        const { data: weights } = await window.app.sb
            .from('weight_history')
            .select('weight, weigh_date')
            .eq('user_id', window.app.currentUser.id)
            .order('weigh_date', { ascending: false })
            .limit(2);
        
        if (!weights || weights.length < 2) {
            messageDiv.style.display = 'none';
            return;
        }
        
        const currentWeight = weights[0].weight;
        const prevWeight = weights[1].weight;
        const weightChange = currentWeight - prevWeight;
        
        const allCompliant = stepsOk && strengthOk && cardioOk && socialOk;
        
        if (weightChange < -0.2) {
            messageDiv.style.background = '#e8f5e9';
            messageDiv.style.borderLeftColor = '#36B647';
            messageText.innerHTML = `🎉 <strong>Поздравляю!</strong> Ты похудел(а) на ${Math.abs(weightChange).toFixed(1)} кг за эту неделю! Отличная работа! Продолжай в том же духе 💪`;
            messageDiv.style.display = 'block';
        } 
        else if (!allCompliant) {
            let failures = [];
            if (!stepsOk && totalDays > 0) failures.push(`👣 Шаги: в ${lowStepsDays} днях ниже нормы ${dailyNorm.toLocaleString()}`);
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
            messageDiv.style.borderLeftColor = '#36B647';
            messageText.innerHTML = `🤔 <strong>На этой неделе отвеса не случилось, но все рекомендации выполнены!</strong><br><br>Организм — сложная штука. Иногда ему нужно время, чтобы "переварить" изменения. Главное — ты не сдаешься! Продолжай в том же ритме, результат обязательно придет. 🙌`;
            messageDiv.style.display = 'block';
        }
    }
};
