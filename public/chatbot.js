// public/chatbot.js

document.addEventListener("DOMContentLoaded", async () => {
  const messagesDiv = document.getElementById('messages');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');

  let conversationId = null;

  // Funktion zum Anzeigen einer Nachricht in der Oberfläche
  function displayMessage(text, isBot) {
      const messageBubble = document.createElement('div');
      messageBubble.classList.add('message-bubble');
      messageBubble.textContent = text;
      if (isBot) {
          messageBubble.classList.add('bot-message');
      } else {
          messageBubble.classList.add('user-message');
      }
      messagesDiv.appendChild(messageBubble);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Konversation starten
  async function startConversation() {
      const response = await fetch('/api/startConversation');
      const data = await response.json();
      conversationId = data.conversationId;
      if (data.welcomeMessage) {
          displayMessage(data.welcomeMessage, true);
      }
  }

  // Nachricht an den Server (und somit an den Bot) senden
  async function sendMessageToBot(text) {
      const response = await fetch('/api/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, text })
      });
      const data = await response.json();
      if (data.botMessage) {
          displayMessage(data.botMessage, true);
      } else if (data.error) {
          console.error(data.error);
      }
  }

  // Event Listener für den Senden-Button
  sendBtn.addEventListener('click', async () => {
      const text = userInput.value.trim();
      if (!text) return;

      displayMessage(text, false); // Nutzernachricht anzeigen
      userInput.value = '';
      await sendMessageToBot(text); // An Server (und dann an Bot) senden
  });

  // Event Listener für Enter-Taste im Eingabefeld
  userInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
          const text = userInput.value.trim();
          if (!text) return;
          displayMessage(text, false);
          userInput.value = '';
          await sendMessageToBot(text);
      }
  });

  // Konversation beim Laden der Seite starten
  await startConversation();
});
