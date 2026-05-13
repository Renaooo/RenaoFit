// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

// --- Авторизация / регистрация ---
window.app.loginWithPhone = async function(phone, name) {
    // Очищаем телефон и приводим к единому формату (7XXXXXXXXXX)
    const cleanPhone = window.app.cleanPhone(phone);
    const email = `${cleanPhone}@gmail.com`;
    const password = cleanPhone + 'simplepass';
    
    console.log('Попытка входа с email:', email);
    
    let { data, error } = await window.app.sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    let isNewUser = false;
    
    // Если пользователь не найден - регистрируем
    if (error && error.message.includes('Invalid login credentials')) {
        console.log('Пользователь не найден, регистрируем...');
        const { data: signUpData, error: signUpError } = await window.app.sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { 
                    name: name, 
                    phone: cleanPhone 
                }
            }
        });
        
        if (signUpError) throw signUpError;
        data = signUpData;
        isNewUser = true;
    } else if (error && !error.message.includes('Invalid login credentials')) {
        throw error;
    }
    
    // Сохраняем профиль в таблицу profiles
    const profileData = {
        id: data.user.id,
        phone: cleanPhone,
        name: name
    };
    
    // Создаём или обновляем профиль
    const { error: profileError } = await window.app.sb
        .from('profiles')
        .upsert(profileData);
    
    if (profileError) {
        console.error('Ошибка сохранения профиля:', profileError);
    }
    
    return data.user;
};

// --- Выход из аккаунта ---
window.app.logout = async function() {
    await window.app.sb.auth.signOut();
    window.app.currentUser = null;
    window.app.selectedSlotIds.clear();
    window.app.showScreen('auth');
};

// --- Проверка, является ли пользователь админом ---
window.app.isAdmin = async function(userId) {
    if (!userId) return false;
    
    const { data, error } = await window.app.sb
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Ошибка проверки админа:', error);
        return false;
    }
    
    return data?.is_admin === true;
};

// --- Получение текущего пользователя с его профилем ---
window.app.getCurrentUserProfile = async function() {
    const { data: { user } } = await window.app.sb.auth.getUser();
    if (!user) return null;
    
    const { data: profile } = await window.app.sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    return { ...user, profile };
};
