// Конфигурация
const API_BASE_URL = 'https://yourdomain.com/api';
let userId = null;
let userToken = null;
let userData = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Получаем параметры из URL
    const urlParams = new URLSearchParams(window.location.search);
    userId = urlParams.get('user_id');
    userToken = urlParams.get('token');
    
    if (userId && userToken) {
        document.getElementById('userId').textContent = `ID: ${userId}`;
        loadUserData();
        updateDepositInfo();
    } else {
        showError('Не удалось загрузить данные пользователя. Пожалуйста, откройте MiniApp через бота.');
    }
    
    // Слушатели событий
    document.getElementById('phoneNumbers').addEventListener('input', updateSmsStats);
    document.getElementById('smsText').addEventListener('input', function() {
        const count = this.value.length;
        document.getElementById('charCount').textContent = `${count}/1000 символов`;
        updateSmsStats();
    });
});

// Загрузка данных пользователя
async function loadUserData() {
    showLoader();
    try {
        const response = await fetch(`${API_BASE_URL}/user_data/${userId}/${userToken}`);
        const data = await response.json();
        
        if (response.ok) {
            userData = data;
            updateDashboard(data);
        } else {
            showError(data.error || 'Ошибка загрузки данных');
        }
    } catch (error) {
        showError('Ошибка соединения с сервером');
    } finally {
        hideLoader();
    }
}

// Обновление дашборда
function updateDashboard(data) {
    document.getElementById('balanceUsdt').textContent = data.balance_USDT.toFixed(2);
    document.getElementById('balanceTon').textContent = data.balance_TON.toFixed(2);
    document.getElementById('priceUsdt').textContent = data.sms_price_usdt;
    document.getElementById('priceTon').textContent = data.sms_price_ton;
    
    // Обновление транзакций
    const transactionsContainer = document.getElementById('transactions');
    transactionsContainer.innerHTML = '';
    
    if (data.transactions && data.transactions.length > 0) {
        data.transactions.slice().reverse().forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            
            const type = transaction.type === 'deposit' ? '📥 Пополнение' : '📤 Списание';
            const amount = `${transaction.amount} ${transaction.currency}`;
            const date = new Date(transaction.timestamp).toLocaleDateString('ru-RU');
            
            item.innerHTML = `
                <div>
                    <div><strong>${type}</strong></div>
                    <small>${date}</small>
                </div>
                <div class="transaction-amount ${transaction.type}">${amount}</div>
            `;
            transactionsContainer.appendChild(item);
        });
    } else {
        transactionsContainer.innerHTML = '<div class="transaction-item">Нет транзакций</div>';
    }
}

// Обновление статистики SMS
function updateSmsStats() {
    const numbersText = document.getElementById('phoneNumbers').value;
    const numbers = numbersText.split(';').filter(n => n.trim()).map(n => n.trim());
    const count = numbers.length;
    
    document.getElementById('numberCount').textContent = count;
    
    if (userData) {
        const costUsdt = count * userData.sms_price_usdt;
        const costTon = count * userData.sms_price_ton;
        
        document.getElementById('costUsdt').textContent = costUsdt.toFixed(2);
        document.getElementById('costTon').textContent = costTon.toFixed(2);
    }
}

// Отправка запроса на SMS рассылку
async function submitSmsRequest() {
    const numbersText = document.getElementById('phoneNumbers').value;
    const message = document.getElementById('smsText').value;
    
    if (!numbersText.trim()) {
        showError('Введите номера телефонов');
        return;
    }
    
    if (!message.trim()) {
        showError('Введите текст сообщения');
        return;
    }
    
    const numbers = numbersText.split(';').filter(n => n.trim()).map(n => n.trim());
    
    // Валидация номеров
    for (const number of numbers) {
        if (!/^(\+7|7|8)\d{10}$/.test(number.replace(/\s/g, ''))) {
            showError(`Неверный формат номера: ${number}`);
            return;
        }
    }
    
    showLoader();
    
    try {
        const response = await fetch(`${API_BASE_URL}/submit_sms_request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                token: userToken,
                numbers: numbers,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess(data.message || 'Заявка успешно отправлена на модерацию');
            document.getElementById('phoneNumbers').value = '';
            document.getElementById('smsText').value = '';
            updateSmsStats();
            loadUserData(); // Обновляем баланс
        } else {
            showError(data.error || 'Ошибка при отправке заявки');
        }
    } catch (error) {
        showError('Ошибка соединения с сервером');
    } finally {
        hideLoader();
    }
}

// Обновление информации о депозите
async function updateDepositInfo() {
    const currency = document.getElementById('depositCurrency').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/get_payment_address/${currency}`);
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('paymentAddress').textContent = data.address;
            document.getElementById('networkInfo').textContent = data.network;
        }
    } catch (error) {
        console.error('Error fetching payment address:', error);
    }
}

// Отправка платежа на проверку
async function submitPayment() {
    const currency = document.getElementById('depositCurrency').value;
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const txHash = document.getElementById('transactionHash').value.trim();
    
    if (amount < 10) {
        showError('Минимальная сумма пополнения: 10');
        return;
    }
    
    if (!txHash || txHash.length < 10) {
        showError('Введите корректный хеш транзакции');
        return;
    }
    
    showLoader();
    
    try {
        const response = await fetch(`${API_BASE_URL}/submit_payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                token: userToken,
                amount: amount,
                currency: currency,
                tx_hash: txHash
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess(data.message || 'Платеж отправлен на проверку');
            document.getElementById('transactionHash').value = '';
            document.getElementById('depositAmount').value = '10';
        } else {
            showError(data.error || 'Ошибка при отправке платежа');
        }
    } catch (error) {
        showError('Ошибка соединения с сервером');
    } finally {
        hideLoader();
    }
}

// Переключение вкладок
function switchTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Убрать активный класс со всех табов
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    document.getElementById(tabName).classList.add('active');
    
    // Активировать соответствующий таб
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.textContent.includes(getTabTitle(tabName))) {
            tab.classList.add('active');
        }
    });
    
    // Обновить данные при переключении на дашборд
    if (tabName === 'dashboard') {
        loadUserData();
    } else if (tabName === 'deposit') {
        updateDepositInfo();
    }
}

function getTabTitle(tabName) {
    const titles = {
        'dashboard': 'Дашборд',
        'sms': 'Рассылка',
        'deposit': 'Пополнение'
    };
    return titles[tabName];
}

// Вспомогательные функции
function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('statusMessage');
    messageDiv.textContent = text;
    messageDiv.className = `status-message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(text) {
    showMessage(text, 'success');
}

function showError(text) {
    showMessage(text, 'error');
}

function showInfo(text) {
    showMessage(text, 'info');
}

// Автообновление данных каждые 30 секунд
setInterval(() => {
    if (userId && userToken) {
        loadUserData();
    }
}, 30000);