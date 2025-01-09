// Load DOM and initialize variables
document.addEventListener('surveyDataInitialized', init);

let conversationId = null;
let watermark = null;

// Function to initialize the page
function init() {
  const storedConversation = sessionStorage.getItem('conversation');
  if (storedConversation) {
    const conv = JSON.parse(storedConversation);
    conversationId = conv.conversationId;
    watermark = conv.watermark;
    conv.messages.forEach(msg => addMessage(msg.text, msg.from));
  } else {
    startConversation();
  }

  document.getElementById('sendBtn').addEventListener('click', sendUserMessage);
  document.getElementById('userInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendUserMessage();
    }
  });

  setupTextareaAutoResize();
  window.addEventListener('resize', scrollMessagesToBottom);
}

// Function to load the Chatbot's initial welcome message
async function startConversation() {
  const treatmentGroup = sessionStorage.getItem('treatmentGroup')
  const res = await fetch('/startconversation', {
    method: 'POST', 
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ treatmentGroup })
  });
  console.log(`Treatment value: ${treatmentGroup}`); // Nur zum Testen
  const data = await res.json();
  conversationId = data.conversationId;
  await getActivities();
}

// Function to receive new messages from the chatbot
async function getActivities() {
  const treatmentGroup = sessionStorage.getItem('treatmentGroup')
  const res = await fetch('/getactivities', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversationId, watermark, treatmentGroup })
  });
  const data = await res.json();

  if (data.activities) {
    const newMessages = [];
    const stored = sessionStorage.getItem('conversation');
    let state = stored ? JSON.parse(stored) : {conversationId, watermark, messages: [], processedActivities: []};

    if (!state.processedActivities) {
      state.processedActivities = [];
    }

    data.activities.forEach(act => {
      if (act.type === 'message') {
        if (!state.processedActivities.includes(act.id)) {
          const from = (act.from.id === 'user1') ? 'user' : 'bot';
          addMessage(act.text, from);
          newMessages.push({ text: act.text, from: from, activityId: act.id });
          state.processedActivities.push(act.id);
        }
      }
    });
    if (data.watermark) {
      watermark = data.watermark;
    }
    // Update current state
    state.conversationId = conversationId;
    state.watermark = watermark;
    state.messages = state.messages.concat(newMessages); 
    sessionStorage.setItem('conversation', JSON.stringify(state));
    state.messages.forEach(msg => console.log(`Current state messages: ${msg.text}`)); //diese Zeile ist nur zum Testen in der Browser-Konsole
  }
}

// Function to process user input
async function sendUserMessage() {
  const treatmentGroup = sessionStorage.getItem('treatmentGroup')
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  addMessage(text, 'user');
  addMessageToState(text, 'user', null); 

  const res = await fetch('/sendmessage', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversationId, text, treatmentGroup })
  });
  const respData = await res.json();
  const activityId = respData.id;

  linkLastUserMessageWithActivityId(activityId);

  await getActivities();
}

function addMessage(text, from) {
  const messagesDiv = document.getElementById('messages');
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', from === 'user' ? 'user-message' : 'bot-message');
  msgDiv.textContent = text;
  messagesDiv.appendChild(msgDiv);
  scrollMessagesToBottom()
}

function scrollMessagesToBottom() {
  const messagesContainer = document.querySelector('.chatbot-messages-container');
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 50);
}

function addMessageToState(text, from, activityId) {
  const stored = sessionStorage.getItem('conversation');
  let state = stored ? JSON.parse(stored) : {conversationId, watermark, messages: [], processedActivities: []};
  state.messages.push({ text, from, activityId });
  sessionStorage.setItem('conversation', JSON.stringify(state));
}

function linkLastUserMessageWithActivityId(activityId) {
  const stored = sessionStorage.getItem('conversation');
  if (!stored) return;
  let state = JSON.parse(stored);
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].from === 'user' && !state.messages[i].activityId) {
      state.messages[i].activityId = activityId;
      if (!state.processedActivities.includes(activityId)) {
        state.processedActivities.push(activityId);
      }
      break;
    }
  }
  sessionStorage.setItem('conversation', JSON.stringify(state));
}

// Funktion zur automatischen Anpassung des Textarea
function setupTextareaAutoResize() {
  const textarea = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const maxRows = 6;

  if (!textarea) {
      console.error('Textarea mit der ID "userInput" nicht gefunden.');
      return;
  }

  // Funktion zur automatischen Größenanpassung
  function adjustTextareaHeight() {
      textarea.style.height = 'auto'; // Höhe zurücksetzen
      const scrollHeight = textarea.scrollHeight;
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computedStyle.lineHeight);
      const paddingTop = parseInt(computedStyle.paddingTop);
      const paddingBottom = parseInt(computedStyle.paddingBottom);
      const borderTop = parseInt(computedStyle.borderTopWidth);
      const borderBottom = parseInt(computedStyle.borderBottomWidth);
      const totalVerticalPadding = paddingTop + paddingBottom + borderTop + borderBottom;
      const maxHeight = (lineHeight * maxRows) + totalVerticalPadding;

      if (scrollHeight <= maxHeight) {
          textarea.style.overflowY = 'hidden';
          textarea.style.height = scrollHeight + 'px';
      } else {
          textarea.style.overflowY = 'auto';
          textarea.style.height = maxHeight + 'px';
      }
  }

  // Initiale Anpassung
  adjustTextareaHeight();

  // Event Listener für Eingabe
  textarea.addEventListener('input', adjustTextareaHeight);

  // Optional: Event Listener für Senden (z.B. beim Drücken von Enter)
  textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn.click();
      }
  });

  // Event Listener für das Leeren des Textarea nach dem Senden
  sendBtn.addEventListener('click', function() {
      // Nach dem Senden das Textarea leeren und die Höhe anpassen
      textarea.value = "";
      adjustTextareaHeight();
  });
}
