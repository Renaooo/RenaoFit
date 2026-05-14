// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

window.app.loginWithPhone = async function(phone, name) {
    const cleanPhone = window.app.cleanPhone(phone);
    const email = `${cleanPhone}@gmail.com`;
    const password = cleanPhone + 'simplepass';
    
    console.log('Попытка входа/регистрации:', email);
    
    let user = null;
    
    // Пробуем войти
    let { data, error } = await window.app.sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    // Если нет — регистрируем
    if (error && error.message.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await window.app.sb.auth.signUp({
            email: email,
            password: password,
            options: { data: { name: name, phone: cleanPhone } }
        });
        if (signUpError) throw signUpError;
        data = signUpData;
    } else if (error) {
        throw error;
    }
    
    user = data.user;
    
    // Сохраняем/обновляем профиль
    const { error: profileError } = await window.app.sb
        .from('profiles')
        .upsert({ id: user.id, phone: cleanPhone, name: name });
    
    if (profileError) console.error('Ошибка профиля:', profileError);
    
    return user;
};

window.app.logout = async function() {
    await window.app.sb.auth.signOut();
    window.app.currentUser = null;
    window.app.selectedSlotIds.clear();
};

window.app.isAdmin = async function(userId) {
    if (!userId) return false;
    const { data } = await window.app.sb
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();
    return data?.is_admin === true;
};
