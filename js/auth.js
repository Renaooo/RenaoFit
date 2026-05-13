// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

// --- Авторизация / регистрация ---
window.app.loginWithPhone = async function(phone, name) {
    const cleanPhone = window.app.cleanPhone(phone);
    const email = `${cleanPhone}@gmail.com`;
    const password = cleanPhone + 'simplepass';
    
    console.log('Попытка входа с email:', email);
    
    let user = null;
    let isNewUser = false;
    
    // Пробуем войти
    let { data, error } = await window.app.sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    // Если не получилось — регистрируем
    if (error && error.message.includes('Invalid login credentials')) {
        console.log('Регистрация нового пользователя...');
        const { data: signUpData, error: signUpError } = await window.app.sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { name: name, phone: cleanPhone }
            }
        });
        
        if (signUpError) throw signUpError;
        data = signUpData;
        isNewUser = true;
    } else if (error) {
        throw error;
    }
    
    user = data.user;
    
    // Проверяем, существует ли профиль
    const { data: existingProfile, error: profileError } = await window.app.sb
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
    
    if (!existingProfile) {
        // Создаём профиль
        const { error: insertError } = await window.app.sb
            .from('profiles')
            .insert({
                id: user.id,
                phone: cleanPhone,
                name: name,
                is_admin: false
            });
        
        if (insertError) {
            console.error('Ошибка создания профиля:', insertError);
        } else {
            console.log('Профиль создан');
        }
    }
    
    return user;
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
    
    try {
        const { data, error } = await window.app.sb
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .maybeSingle();  // вместо .single()
        
        if (error) {
            console.warn('Ошибка проверки админа:', error.message);
            return false;
        }
        
        return data?.is_admin === true;
    } catch (e) {
        console.warn('Исключение в isAdmin:', e.message);
        return false;
    }
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
