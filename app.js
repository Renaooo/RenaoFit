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
    profile: document.getElementById('profile-screen'),
    admin: document.getElementById('admin-screen')
};

let currentUser = null;
let selectedSlotIds = new Set();
let isLoggingIn = false;

// --- Загрузка профиля пользователя ---
// --- Загрузка профиля пользователя ---
async function loadMyProfile() {
    if (!currentUser) return;
    
    const { data: profile, error } = await sb
        .from('profiles')
        .select('weight, subscription_until')
        .eq('id', currentUser.id)
        .single();
    
    if (error) {
        console.error('Ошибка загрузки профиля:', error);
        return;
    }
    
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
    
    // Отображаем последний вес из истории
    const weightHistory = await loadWeightHistory();
    const weightEl = document.getElementById('profile-weight');
    const weightContainer = document.getElementById('profile-weight-container');
    
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
    
    // Делаем вес кликабельным
    if (weightContainer) {
        weightContainer.style.cursor = 'pointer';
        weightContainer.onclick = () => openWeightModal();
    }
    
    // Отрисовываем график
    await renderWeightChart();
}

// --- Открытие модального окна для взвешивания ---
// --- Открытие модального окна для взвешивания ---
async function openWeightModal() {
    const history = await loadWeightHistory();
    const canAdd = canAddWeight(history);
    const modal = document.getElementById('weight-modal');
    const weightInput = document.getElementById('weight-input');
    const errorDiv = document.getElementById('weight-error');
    const saveBtn = document.getElementById('weight-save-btn');
    const cancelBtn = document.getElementById('weight-cancel-btn');
    
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
    } else {
        errorDiv.style.display = 'none';
        weightInput.disabled = false;
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        weightInput.value = '';
    }
    
    modal.style.display = 'flex';
    
    // Функция очистки обработчиков
    const cleanup = () => {
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleClickOutside);
    };
    
    // Обработчик сохранения
    const handleSave = async () => {
        const weight = weightInput.value;
        if (!weight || weight <= 0) {
            alert('Введите корректный вес');
            return;
        }
        
        const success = await saveWeight(weight);
        if (success) {
            alert('✅ Вес сохранен!');
            modal.style.display = 'none';
            await loadMyProfile();
        } else {
            alert('❌ Ошибка сохранения. Возможно, вы уже взвешивались на этой неделе.');
        }
        
        cleanup();
    };
    
    // Обработчик отмены
    const handleCancel = () => {
        modal.style.display = 'none';
        cleanup();
    };
    
    // Обработчик клика вне модального окна
    const handleClickOutside = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            cleanup();
        }
    };
    
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleClickOutside);
}


// --- Функция переключения экранов ---
function showScreen(name) {
    Object.keys(screens).forEach(k => screens[k].classList.remove('active'));
    screens[name].classList.add('active');
}




// --- Очистка телефона от лишних символов ---
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
    
    const { error: profileError } = await sb
        .from('profiles')
        .upsert({ id: data.user.id, phone: phone, name: name });
    
    if (profileError) console.error('Ошибка сохранения профиля:', profileError);
    
    return data.user;
}

// --- Загрузка истории веса пользователя ---
async function loadWeightHistory() {
    if (!currentUser) return [];
    
    const { data, error } = await sb
        .from('weight_history')
        .select('weight, weigh_date')
        .eq('user_id', currentUser.id)
        .order('weigh_date', { ascending: true });
    
    if (error) {
        console.error('Ошибка загрузки истории веса:', error);
        return [];
    }
    
    return data || [];
}

// --- Проверка, можно ли добавить новый вес ---
function canAddWeight(history) {
    if (!history || history.length === 0) return true;
    
    const lastWeighDate = new Date(history[history.length - 1].weigh_date);
    const today = new Date();
    
    // Проверяем, что сегодня понедельник
    const isMonday = today.getDay() === 1;
    if (!isMonday) return false;
    
    // Проверяем, что прошла неделя с последнего взвешивания
    const daysSinceLast = Math.floor((today - lastWeighDate) / (1000 * 60 * 60 * 24));
    return daysSinceLast >= 7;
}

// --- Сохранение нового веса ---
async function saveWeight(weight) {
    if (!currentUser) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weighDate = today.toISOString().split('T')[0];
    
    const { error } = await sb
        .from('weight_history')
        .insert({
            user_id: currentUser.id,
            weight: parseFloat(weight),
            weigh_date: weighDate
        });
    
    if (error) {
        console.error('Ошибка сохранения веса:', error);
        return false;
    }
    
    return true;
}

// --- Отрисовка графика веса ---
async function renderWeightChart() {
    const history = await loadWeightHistory();
    const container = document.getElementById('weight-chart-container');
    const totalLossEl = document.getElementById('total-loss');
    
    if (!history || history.length < 2) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    
    // Загружаем Chart.js
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = () => drawChart(history, totalLossEl);
        document.head.appendChild(script);
    } else {
        drawChart(history, totalLossEl);
    }
}

function drawChart(history, totalLossEl) {
    const ctx = document.getElementById('weight-chart').getContext('2d');
    
    const labels = history.map(h => {
        const date = new Date(h.weigh_date);
        return `${date.getDate()}.${date.getMonth() + 1}`;
    });
    
    const weights = history.map(h => h.weight);
    
    // Уничтожаем старый график, если есть
    if (window.weightChart) {
        window.weightChart.destroy();
    }
    
    window.weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Вес (кг)',
                data: weights,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#007aff',
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
                legend: {
                    display: false
                },
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
                    title: {
                        display: true,
                        text: 'кг',
                        font: { size: 12 }
                    },
                    min: Math.floor(Math.min(...weights) - 2),
                    max: Math.ceil(Math.max(...weights) + 2)
                },
                x: {
                    title: {
                        display: true,
                        text: 'Дата',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
    
    // Вычисляем общую потерю веса
    const firstWeight = history[0].weight;
    const lastWeight = history[history.length - 1].weight;
    const loss = (firstWeight - lastWeight).toFixed(1);
    
    if (loss > 0) {
        totalLossEl.innerHTML = `📉 Общая потеря: ${loss} кг`;
        totalLossEl.style.color = '#34c759';
    } else if (loss < 0) {
        totalLossEl.innerHTML = `📈 Общий набор: ${Math.abs(loss)} кг`;
        totalLossEl.style.color = '#ff3b30';
    } else {
        totalLossEl.innerHTML = `⚖️ Вес стабилен: ${loss} кг`;
        totalLossEl.style.color = '#666';
    }
}


// --- Загрузка свободных слотов для клиента ---
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




// --- Отображение слотов для клиента с подсветкой рекомендуемых ---
async function renderSlots(slots) {
    const container = document.getElementById('slots-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (!slots || slots.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет свободных слотов на ближайшую неделю</p>';
        return;
    }
    
    // Создаем список занятых слотов для каждого дня
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
    
    // Функция проверки соседней записи
    function hasAdjacentBooking(dayKey, timeStr) {
        const [hours] = timeStr.split(':').map(Number);
        const prevHour = `${(hours - 1).toString().padStart(2,'0')}:00`;
        const nextHour = `${(hours + 1).toString().padStart(2,'0')}:00`;
        const bookedTimes = bookedTimesByDay[dayKey] || [];
        return bookedTimes.includes(prevHour) || bookedTimes.includes(nextHour);
    }
    
    // Группируем слоты по дням
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
    
    const sortedDays = Object.keys(groupedByDay).sort((a, b) => {
        const dateA = new Date(a.split(',')[1] + ' ' + a.split(',')[0]);
        const dateB = new Date(b.split(',')[1] + ' ' + b.split(',')[0]);
        return dateA - dateB;
    });
    
    for (let displayDay of sortedDays) {
        const dayData = groupedByDay[displayDay];
        const daySlots = dayData.slots;
        const dayKey = dayData.dayKey;
        
        daySlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const morning = daySlots.filter(s => new Date(s.start_time).getHours() < 15);
        const evening = daySlots.filter(s => new Date(s.start_time).getHours() >= 15);
        
        const dayDiv = document.createElement('div');
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${displayDay}</h3>`;
        
        // Утро
        if (morning.length > 0) {
            const morningDiv = document.createElement('div');
            morningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin-bottom: 5px;">☀️ Утро</div>';
            
            morning.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const hasAdjacent = hasAdjacentBooking(dayKey, timeStr);
                
                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-item';
                if (selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
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
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                
                const checkbox = slotDiv.querySelector('.slot-select');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedSlotIds.add(slot.id);
                    } else {
                        selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${selectedSlotIds.size})`;
                    }
                });
                
                morningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(morningDiv);
        }
        
        // Вечер
        if (evening.length > 0) {
            const eveningDiv = document.createElement('div');
            eveningDiv.innerHTML = '<div style="font-size: 12px; color: #666; margin: 10px 0 5px;">🌙 Вечер</div>';
            
            evening.forEach(slot => {
                const start = new Date(slot.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const hasAdjacent = hasAdjacentBooking(dayKey, timeStr);
                
                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-item';
                if (selectedSlotIds.has(slot.id)) slotDiv.classList.add('selected');
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
                    <input type="checkbox" class="slot-select" data-id="${slot.id}" ${selectedSlotIds.has(slot.id) ? 'checked' : ''} style="width: 22px; height: 22px;">
                `;
                
                const checkbox = slotDiv.querySelector('.slot-select');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedSlotIds.add(slot.id);
                    } else {
                        selectedSlotIds.delete(slot.id);
                    }
                    const confirmBtn = document.getElementById('confirm-booking-btn');
                    if (confirmBtn) {
                        confirmBtn.style.display = selectedSlotIds.size > 0 ? 'block' : 'none';
                        confirmBtn.textContent = `✅ Подтвердить запись (${selectedSlotIds.size})`;
                    }
                });
                
                eveningDiv.appendChild(slotDiv);
            });
            dayDiv.appendChild(eveningDiv);
        }
        
        container.appendChild(dayDiv);
    }
}




// --- Подтверждение записи клиентом ---
async function confirmBooking() {
    if (!currentUser) return;
    
    if (selectedSlotIds.size === 0) {
        alert('Выберите слоты для записи');
        return;
    }
    
    for (let slotId of selectedSlotIds) {
        const { error: updateError } = await sb
            .from('slots')
            .update({ is_available: false })
            .eq('id', slotId);
        
        if (updateError) {
            alert('Ошибка при бронировании');
            return;
        }
    }
    
    const bookingsToInsert = Array.from(selectedSlotIds).map(slotId => ({
        slot_id: slotId,
        user_id: currentUser.id
    }));
    
    const { error: insertError } = await sb
        .from('bookings')
        .insert(bookingsToInsert);
    
    if (insertError) {
        for (let slotId of selectedSlotIds) {
            await sb
                .from('slots')
                .update({ is_available: true })
                .eq('id', slotId);
        }
        alert('Ошибка записи');
    } else {
        alert('Успешно записано!');
        selectedSlotIds.clear();
        showScreen('menu');
    }
}




// --- Загрузка и отображение записей клиента ---
async function loadMyBookings() {
    const { data: bookings, error } = await sb
        .from('bookings')
        .select('id, slot_id, slots(start_time, end_time)')
        .eq('user_id', currentUser.id);
    
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
        dayDiv.style.cssText = 'margin-bottom: 20px; border-left: 3px solid #007aff; padding-left: 12px;';
        dayDiv.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 16px;">📅 ${day}</h3>`;
        
        for (let booking of dayBookings) {
            const start = new Date(booking.slots.start_time);
            const formatted = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;';
            div.innerHTML = `
                <span style="font-weight: 500;">${formatted}</span>
                <button class="cancel-btn" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 14px; cursor: pointer;">Отменить</button>
            `;
            
            const cancelBtn = div.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', async () => {
                if (confirm('Отменить запись?')) {
                    const { error: deleteError } = await sb
                        .from('bookings')
                        .delete()
                        .eq('id', booking.id);
                    
                    if (deleteError) {
                        alert('Ошибка отмены');
                        return;
                    }
                    
                    await sb
                        .from('slots')
                        .update({ is_available: true })
                        .eq('id', booking.slot_id);
                    
                    alert('Запись отменена');
                    await loadMyBookings();
                }
            });
            
            dayDiv.appendChild(div);
        }
        container.appendChild(dayDiv);
    }
}




// --- Функция автоматического обновления расписания ---
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



// --- Переключение между вкладками в админ-панели ---
function setupAdminTabs() {
    const slotsTab = document.getElementById('admin-slots-tab');
    const clientsTab = document.getElementById('admin-clients-tab');
    const slotsPanel = document.getElementById('admin-slots-panel');
    const clientsPanel = document.getElementById('admin-clients-panel');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (!slotsTab || !clientsTab) return;
    
    // Убираем старые обработчики, если были
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
        
        // Загружаем список клиентов
        if (typeof renderClientsList === 'function') {
            await renderClientsList();
        }
    });
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
    
    // Настраиваем вкладки (добавляем эту строку)
    setupAdminTabs();
}


// --- Загрузка списка клиентов (все пользователи, кроме админа) ---
async function loadClientsList() {
    const adminId = 'edafd00c-3f7d-47aa-8d69-9efbe95de98e';
    
    // Получаем всех пользователей из таблицы profiles, кроме админа
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
        // Получаем количество записей клиента
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
                    <span style="color: #999; font-size: 12px; margin-left: 10px;">🆔 ${client.id.substring(0, 8)}...</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="background: #007aff; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${count || 0} записей</span>
                    <button class="delete-client-btn" data-id="${client.id}" data-name="${client.name || client.phone || 'клиента'}" style="background: #ff3b30; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 14px;">✖ Удалить</button>
                </div>
            </div>
        `;
        
        // Клик по карточке (не по кнопке) открывает детали
        const clientInfoDiv = clientCard.querySelector('div:first-child');
        clientInfoDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            showClientDetails(client);
        });
        
        // Кнопка удаления
        const deleteBtn = clientCard.querySelector('.delete-client-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const clientName = client.name || client.phone || 'клиента';
            
            if (confirm(`⚠️ Удалить клиента "${clientName}"?\n\nЭто действие:\n- Удалит все записи клиента\n- Удалит профиль клиента\n- Клиент больше не сможет войти\n\nУчетная запись в системе останется (для безопасности).\n\nПродолжить?`)) {
                try {
                    // 1. Удаляем все бронирования клиента
                    const { error: bookingsError } = await sb
                        .from('bookings')
                        .delete()
                        .eq('user_id', client.id);
                    
                    if (bookingsError) throw bookingsError;
                    
                    // 2. Удаляем профиль клиента
                    const { error: profileError } = await sb
                        .from('profiles')
                        .delete()
                        .eq('id', client.id);
                    
                    if (profileError) throw profileError;
                    
                    alert(`✅ Клиент "${clientName}" удален.\n\nВсе записи удалены.\nУчетная запись сохранена (при необходимости можно восстановить через Supabase).`);
                    
                    // Обновляем список клиентов и админ-панель
                    await renderClientsList();
                    await loadAdminData();
                    
                } catch (error) {
                    console.error('Ошибка удаления:', error);
                    alert('❌ Ошибка при удалении клиента: ' + error.message);
                }
            }
        });
        
        container.appendChild(clientCard);
    }
}



// --- Отображение карточки клиента с его записями и редактированием ---
async function showClientDetails(client) {
    // Получаем все записи клиента
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
        max-height: 80vh;
        overflow-y: auto;
        padding: 20px;
    `;
    
    let bookingsHtml = '';
    if (bookings && bookings.length > 0) {
        const groupedByDay = {};
        bookings.forEach(booking => {
            const date = new Date(booking.slots.start_time);
            const dayKey = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'numeric' });
            if (!groupedByDay[dayKey]) groupedByDay[dayKey] = [];
            groupedByDay[dayKey].push(booking);
        });
        
        for (let [day, dayBookings] of Object.entries(groupedByDay)) {
            bookingsHtml += `<h4 style="margin: 15px 0 8px 0; color: #007aff;">📅 ${day}</h4>`;
            
            dayBookings.forEach(booking => {
                const start = new Date(booking.slots.start_time);
                const timeStr = start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                
                bookingsHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 8px;">
                        <span style="font-weight: 500;">🕐 ${timeStr}</span>
                        <button class="delete-booking-from-client" data-id="${booking.id}" data-slot="${booking.slot_id}" style="background: #ff3b30; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">✖ Удалить</button>
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
            <p><strong>🆔 ID:</strong> ${client.id.substring(0, 8)}...</p>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 16px;">✏️ Редактировать профиль</h3>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Вес (кг)</label>
                <input type="number" id="edit-weight" step="0.1" value="${client.weight || ''}" placeholder="например: 75.5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Абонемент до</label>
                <input type="date" id="edit-subscription" value="${client.subscription_until || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
            </div>
            
            <button id="save-profile-btn" style="background: #007aff; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; width: 100%;">💾 Сохранить</button>
        </div>
        
        <h3 style="margin: 20px 0 10px 0;">📋 Записи клиента</h3>
        <div id="client-bookings-list">
            ${bookingsHtml}
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Закрытие модального окна
    const closeBtn = modalContent.querySelector('#close-client-modal');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // Сохранение профиля
    const saveBtn = modalContent.querySelector('#save-profile-btn');
    saveBtn.addEventListener('click', async () => {
        const weight = modalContent.querySelector('#edit-weight').value;
        const subscriptionUntil = modalContent.querySelector('#edit-subscription').value;
        
        const updateData = {};
        if (weight) updateData.weight = parseFloat(weight);
        if (subscriptionUntil) updateData.subscription_until = subscriptionUntil;
        
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
    
    // Обработчики для кнопок удаления записей
    const deleteButtons = modalContent.querySelectorAll('.delete-booking-from-client');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookingId = btn.dataset.id;
            const slotId = btn.dataset.slot;
            
            if (confirm('Удалить эту запись? Слот снова станет доступным.')) {
                const { error: deleteError } = await sb
                    .from('bookings')
                    .delete()
                    .eq('id', bookingId);
                
                if (deleteError) {
                    alert('Ошибка удаления записи');
                    return;
                }
                
                await sb
                    .from('slots')
                    .update({ is_available: true })
                    .eq('id', slotId);
                
                alert('Запись удалена, слот свободен');
                modal.remove();
                await renderClientsList();
                await loadAdminData();
            }
        });
    });
}




// --- Переключение между вкладками в админ-панели ---
function setupAdminTabs() {
    const slotsTab = document.getElementById('admin-slots-tab');
    const clientsTab = document.getElementById('admin-clients-tab');
    const slotsPanel = document.getElementById('admin-slots-panel');
    const clientsPanel = document.getElementById('admin-clients-panel');
    const adminBookingsDiv = document.getElementById('admin-bookings');
    
    if (!slotsTab || !clientsTab) return;
    
    slotsTab.addEventListener('click', () => {
        slotsTab.style.background = '#007aff';
        slotsTab.style.color = 'white';
        clientsTab.style.background = '#e9ecef';
        clientsTab.style.color = '#1e1e1e';
        slotsPanel.style.display = 'block';
        clientsPanel.style.display = 'none';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'block';
    });
    
    clientsTab.addEventListener('click', async () => {
        clientsTab.style.background = '#007aff';
        clientsTab.style.color = 'white';
        slotsTab.style.background = '#e9ecef';
        slotsTab.style.color = '#1e1e1e';
        slotsPanel.style.display = 'none';
        clientsPanel.style.display = 'block';
        if (adminBookingsDiv) adminBookingsDiv.style.display = 'none';
        
        await renderClientsList();
    });
}



// --- Инициализация при загрузке страницы ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await sb.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        const nameSpan = document.getElementById('user-name');
        if (nameSpan) nameSpan.innerText = session.user.user_metadata.name || 'Друг';
        
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
            console.error('Ошибка:', e);
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
    
    document.getElementById('confirm-booking-btn')?.addEventListener('click', confirmBooking);
    
    document.getElementById('admin-btn')?.addEventListener('click', async () => {
        await loadAdminData();
        showScreen('admin');
    });
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen('menu'));
    });
    
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await sb.auth.signOut();
        currentUser = null;
        showScreen('auth');
    });

    // Кнопка "Мой профиль"
document.getElementById('my-profile-btn')?.addEventListener('click', async () => {
    await loadMyProfile();
    showScreen('profile');
});

    
    
    document.getElementById('admin-add-slot')?.addEventListener('click', async () => {
        const start = document.getElementById('admin-start').value;
        if (!start) return alert('Выберите начало слота');
        
        const startDate = new Date(start);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        const end = endDate.toISOString().slice(0, 16);
        
        const { error } = await sb.from('slots').insert({ 
            start_time: start, 
            end_time: end, 
            is_available: true 
        });
        
        if (error) {
            alert('Ошибка: ' + error.message);
        } else { 
            alert('Слот добавлен (1 час)'); 
            loadAdminData();
            document.getElementById('admin-start').value = '';
        }
    });
});
