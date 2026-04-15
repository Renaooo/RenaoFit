// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

// --- Очистка телефона (8 и +7 равнозначны, приводим к 7XXXXXXXXXX) ---
window.app.cleanPhone = function(phone) {
    // Удаляем все символы, кроме цифр
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    // Если номер начинается с 8, заменяем на 7 (для единого формата)
    if (cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.substring(1);
    }
    
    return cleaned;
};

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
    } else if (error && !error.message.includes('Invalid login credentials')) {
        throw error;
    }
    
    const { error: profileError } = await window.app.sb
        .from('profiles')
        .upsert({ id: data.user.id, phone: phone, name: name });
    
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
