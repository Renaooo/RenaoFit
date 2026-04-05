// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ
// ============================================

// --- Очистка телефона от лишних символов ---
function cleanPhone(phone) {
    return phone.replace(/[^0-9]/g, '');
}

// --- Авторизация / регистрация ---
async function loginWithPhone(phone, name) {
    const cleanPhoneNumber = cleanPhone(phone);
    const email = `${cleanPhoneNumber}@gmail.com`;
    const password = cleanPhoneNumber + 'simplepass';
    
    // Сначала пробуем войти
    let { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    // Если пользователь не найден — регистрируем
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
    
    // Сохраняем/обновляем профиль
    const { error: profileError } = await sb
        .from('profiles')
        .upsert({ id: data.user.id, phone: phone, name: name });
    
    if (profileError) console.error('Ошибка сохранения профиля:', profileError);
    
    return data.user;
}

// --- Выход из аккаунта ---
async function logout() {
    await sb.auth.signOut();
    currentUser = null;
    showScreen('auth');
}

// --- Проверка, является ли пользователь админом ---
function isAdmin(user) {
    return user && user.user_metadata?.is_admin === true;
}
