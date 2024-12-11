document.addEventListener('DOMContentLoaded', function() {
    const messagesContainer = document.getElementById('chat-messages');
    const inputField = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');

    let participantID = sessionStorage.getItem('participantID');
    let directLineSecret = null;
    let conversationId = null;
    let token = null;
    let watermark = null;
    let isBotTyping = false;
    let chatHistory = JSON.parse(sessionStorage.getItem('chatHistory-' + participantID)) || [];

    // Chatverlauf wiederherstellen
    renderChatHistory(chatHistory);

    // Beim Laden das neueste Ende scrollen
    scrollToBottom();

    // Fetch Secret und initialisiere Konversation
    initChat();

    // Event Listener fürs Senden
    sendButton.addEventListener('click', sendMessage);
    inputField.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Dynamische Höhe des Textareas
    inputField.addEventListener('input', adjustTextareaHeight);

    // Neue Nachrichten vom Bot abrufen
    const pollInterval = setInterval(fetchMessagesFromBot, 1000);

    // Beim Seitenwechsel/Reload Status speichern
    window.addEventListener('beforeunload', saveState);

    function adjustTextareaHeight() {
        // Höhe zurücksetzen, um erneute Berechnung zu ermöglichen
        inputField.style.height = 'auto';
        // Höhe anpassen je nach Inhalt
        inputField.style.height = Math.min(inputField.scrollHeight, 5 * 1.2 * 16 + 10) + 'px';
    }

    async function initChat() {
        // Direct Line Token vom Server holen
        const configResponse = await fetch('/config');
        const configData = await configResponse.json();
        directLineSecret = configData.secret;
        
        // Konversation mit DirectLine starten
        const res = await fetch('https://germanywestcentral.directline.botframework.com/v3/directline/conversations', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + directLineSecret,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();
        conversationId = data.conversationId;
        token = data.token;
    }

    async function sendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        // Nachricht anzeigen
        addMessage(text, 'user');

        // Nachricht an Bot senden
        await fetch(`https://germanywestcentral.directline.botframework.com/v3/directline/conversations/${conversationId}/activities`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'message',
                from: { id: participantID },
                text: text
            })
        });

        inputField.value = '';
        adjustTextareaHeight();
        showTypingIndicator(true);
    }

    async function fetchMessagesFromBot() {
        if (!conversationId) return;

        const res = await fetch(`https://germanywestcentral.directline.botframework.com/v3/directline/conversations/${conversationId}/activities${watermark ? '?watermark=' + watermark : ''}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        const data = await res.json();
        watermark = data.watermark;

        // Activities auswerten
        for (const activity of data.activities) {
            if (activity.from.id !== participantID && activity.type === 'message') {
                addMessage(activity.text, 'bot');
                showTypingIndicator(false);
            }
        }
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        msgDiv.classList.add(sender === 'bot' ? 'bot-message' : 'user-message');
        msgDiv.innerText = text;
        messagesContainer.appendChild(msgDiv);

        // Nachricht in History speichern
        chatHistory.push({ sender: sender, text: text });
        saveState();

        scrollToBottom();
    }

    function showTypingIndicator(show) {
        if (show) {
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderChatHistory(history) {
        messagesContainer.innerHTML = '';
        for (const msg of history) {
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('message', msg.sender === 'bot' ? 'bot-message' : 'user-message');
            msgDiv.innerText = msg.text;
            messagesContainer.appendChild(msgDiv);
        }
    }

    function saveState() {
        sessionStorage.setItem('chatHistory-' + participantID, JSON.stringify(chatHistory));
    }
});


