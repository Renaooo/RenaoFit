// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

// --- Авторизация / регистрация ---
window.app.loginWithPhone = async function(phone, name) {
    const cleanPhoneNumber = window.app.cleanPhone(phone);
    const email = `${cleanPhoneNumber}@gmail.com`;
    const password = cleanPhoneNumber + 'simplepass';
    
    // Сначала пробуем войти
    let { data, error } = await window.app.sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    // Если пользователь не найден — регистрируем
    if (error && error.message.includes('Invalid login credentials')) {
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
    
    // Сохраняем/обновляем профиль
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
