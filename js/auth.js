// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

// --- Авторизация / регистрация ---
window.app.loginWithPhone = async function(phone, name) {
    const cleanPhoneNumber = window.app.cleanPhone(phone);
    const email = `${cleanPhoneNumber}@gmail.com`;
    const password = cleanPhoneNumber + 'simplepass';
    
    console.log('Попытка входа с email:', email);
    
    let { data, error } = await window.app.sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    let isNewUser = false;
    
    if (error && error.message.includes('Invalid login credentials')) {
        console.log('Пользователь не найден, регистрируем...');
        const { data: signUpData, error: signUpError } = await window.app.sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { name: name, phone: phone }
            }
        });
        
        if (signUpError) throw signUpError;
        data = signUpData;
        isNewUser = true;
    } else if (error && !error.message.includes('Invalid login credentials')) {
        throw error;
    }
    
    // Сохраняем профиль
    const profileData = {
        id: data.user.id,
        phone: phone,
        name: name
    };
    
    // Для новых пользователей добавляем цель по умолчанию
    if (isNewUser) {
        profileData.fitness_goal = 'weight_loss';
    }
    
    const { error: profileError } = await window.app.sb
        .from('profiles')
        .upsert(profileData);
    
    if (profileError) console.error('Ошибка сохранения профиля:', profileError);
    
    return data.user;
};

// --- Выход из аккаунта ---
window.app.logout = async function() {
    await window.app.sb.auth.signOut();
    window.app.currentUser = null;
    window.app.showScreen('auth');
};

// --- Проверка, является ли пользователь админом ---
window.app.isAdmin = function(user) {
    return user && user.user_metadata?.is_admin === true;
};

// --- Сохранение цели тренировки (для профиля) ---
window.app.saveGoal = async function() {
    if (!window.app.currentUser) {
        alert('Пользователь не авторизован');
        return;
    }
    
    const selectedGoal = document.querySelector('input[name="profile-goal"]:checked');
    if (!selectedGoal) {
        alert('Выберите цель');
        return;
    }
    
    const newGoal = selectedGoal.value;
    
    const { error } = await window.app.sb
        .from('profiles')
        .update({ fitness_goal: newGoal })
        .eq('id', window.app.currentUser.id);
    
    if (error) {
        console.error('Ошибка сохранения цели:', error);
        alert('Ошибка сохранения: ' + error.message);
        return;
    }
    
    alert('✅ Цель сохранена!');
    
    // Обновляем интерфейс профиля
    if (typeof window.app.loadMyProfile === 'function') {
        await window.app.loadMyProfile();
    }
};
