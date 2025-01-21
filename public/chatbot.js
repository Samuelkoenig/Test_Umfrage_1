/**
 * @fileoverview This script contains the logic of the chatbot interface and is executed by the 
 * client in the browser. 
 * @author Samuel König <koenigsamuel99@gmx.de>
 * @version 1.0.0
 */

/**************************************************************************
 * Initialization of page elements, variables and event listeners
 **************************************************************************/

/**
 * Definition of the variables used in the script.
 * - enterMeansSent @type {boolean}: Variable to specify whether a message is sent when pressing enter. 
 * - typingAnimationDelay @type {number}: The delay in milliseconds until the typing indicator is 
 *   displayed after a user message. 
 * - initialTypingAnimationDelay @type {number}: The delay in milliseconds until the typing indicator 
 *   is displayed for the initial welcome message by the chatbot. 
 * - initialBotMessageDelay @type {number}: The delay in milliseconds until the initial welcome message 
 *   by the chatbot is displayed. 
 * - conversationId @type {string}: The conversationId generated by the bot framework.
 * - watermark @type {number}: The watermark per chatbot activity retrieval.
 * - typingIndicatorTimeout @type {number|null}: The timer id for the typing animation delay. 
 * - continueBtnEnabled @type {boolean}: Variable to specify whether the continueSurveytBtn ist enabled.
 */
const enterMeansSend = true;             // To be specified: whether a message is sent when pressing enter!
const typingAnimationDelay = 500         // To be specified: delay of the typing animation!
const initialTypingAnimationDelay = 250  // To be specified: typing animation delay of initial bot message!
const initialBotMessageDelay = 800       // To be specified: delay of the initial bot message!

let conversationId = null;
let watermark = null;
let typingIndicatorTimeout = null;
let continueBtnEnabled = sessionStorage.getItem('continueBtnEnabled') === 'true';

let startY = 0;
let activeContainer = null;

/**
 * Event Listener for initializing the chatbot interface.
 * Executes the initializeChatbotUi() function as soon as the "surveyDataInitialized" event 
 * (see script.js) has been triggered.
 */
document.addEventListener('surveyDataInitialized', initializeChatbotUi);

/**
 * Initializes the chatbot interface.
 * This function is executed as soon as the "surveyDataInitialized" event has been triggered. 
 * 
 * - Starts a new conversation or restores an existing conversation.
 * - Attaches all event listeners.
 * - Sets the state of the continueSurveytBtn (disabled vs. enabled).
 * 
 * @returns {void}
 */
function initializeChatbotUi() {
  const storedConversation = sessionStorage.getItem('conversation');
  if (storedConversation) {
    restoreConversation(storedConversation);
  } else {
    startConversation();
  }

  attachMobileChatbotEventListeners();
  attachChatbotEventListeners();
  continueBtnStateMgmt();
}

/**
 * Adds event listeners to all relevant DOM elements (buttons and inputs).
 * 
 * - When the user clicks on the send button, the sendUserMessage() function is called and 
 *   the height of the textarea is adjusted. 
 * - Optionally: When the user clicks enter in the textarea, this is treated as clicking the 
 *   send button (this applies when the variable enterMeansSent is set to true). 
 * - The height of the textarea is adjusted each time the user interacts with the textarea. 
 * - Each time the size of the browser window is adjusted or the chatbot interface is opened, 
 *   the dialogue space gets automatically scrolled down to the newest messages and the height 
 *   of the input text area is adjusted. 
 * - Initially sets the height of the user message input field. 
 * 
 * @returns {void}
 */
function attachChatbotEventListeners() {
  const textarea = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const maxRows = 6;

  sendBtn.addEventListener('click', function() {
    sendUserMessage();
    adjustTextareaHeight(textarea, maxRows);
  });

  if (enterMeansSend) {
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  } // Optional if pressing enter should cause the user message to be sent. 

  textarea.addEventListener('input', function() {
    adjustTextareaHeight(textarea, maxRows);
  });

  window.addEventListener('resize', function () {
    scrollMessagesToBottom();
    adjustTextareaHeight(textarea, maxRows);
  });

  document.addEventListener('chatbotInterfaceOpened', function () {
    scrollMessagesToBottom();
    adjustTextareaHeight(textarea, maxRows);
  });

  adjustTextareaHeight(textarea, maxRows);
}

function attachMobileChatbotEventListeners() {
  const textarea = document.getElementById('userInput');

  window.addEventListener('resize', updateVh);
  window.addEventListener('orientationchange', updateVh);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateVh);
  }
  textarea.addEventListener('focus', () => {
    window.scrollTo(0, 0);
    scrollMessagesToBottom();
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 100);
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 200);
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 300);
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 400);
  });

  attachNoBounceListeners();

  updateVh();
}

function onTouchStart(e) {
  startY = e.touches[0].clientY;

  // Prüfe, ob das Touchziel in .chatbot-messages-container ODER textarea liegt
  const scrollableSelector = '.chatbot-messages-container, .input-container textarea';
  let potentialContainer = e.target.closest(scrollableSelector) || null;

  // Wenn der potenzielle Container die textarea ist,
  // prüfen, ob der Touch-Punkt tatsächlich innerhalb der textarea liegt.
  if (potentialContainer && potentialContainer.id === 'userInput') {
    const rect = potentialContainer.getBoundingClientRect();
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;

    // Falls der Berührungspunkt außerhalb der textarea-Grenzen liegt:
    if (touchX < rect.left || touchX > rect.right || touchY < rect.top || touchY > rect.bottom) {
      potentialContainer = null;
    }
  }

  activeContainer = potentialContainer;
}

function onTouchMove(e) {
  // Wenn wir keinen scrollbaren Container haben: blockieren
  if (!activeContainer) {
    e.preventDefault();
    return;
  }

  //console.log(`activeContainer: ${activeContainer}`); // Nur zum Testen
  if (activeContainer.id === 'userInput') {
    const textarea = document.getElementById('userInput');
    if (textarea.style.overflowY === "hidden") {
      e.preventDefault();
      return;
    }
  }

  // Ist der Container überhaupt scrollbar?
  if (activeContainer.scrollHeight <= activeContainer.clientHeight) {
    // Nein => blockieren
    e.preventDefault();
    return;
  }

  // Container ist scrollbar. Jetzt schauen wir, ob man am oberen oder unteren Ende ist
  const scrollTop = activeContainer.scrollTop;
  const atTop = (scrollTop <= 0);
  const atBottom = (scrollTop + activeContainer.clientHeight >= activeContainer.scrollHeight);

  // Aktuelle Fingerposition:
  const currentY = e.touches[0].clientY;
  // positive deltaY => Wischen nach unten, negative => Wischen nach oben
  const deltaY = currentY - startY;

  // Bouncing an Top oder Bottom verhindern
  if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
    e.preventDefault();
  }
}

function onTouchEnd(e) {
  activeContainer = null;
}

// An dein #chatbot-interface anhängen, z. B.:
function attachNoBounceListeners() {
  const chatbotInterface = document.getElementById('chatbot-interface');
  chatbotInterface.addEventListener('touchstart', onTouchStart, { passive: false });
  chatbotInterface.addEventListener('touchmove', onTouchMove, { passive: false });
  chatbotInterface.addEventListener('touchend', onTouchEnd, { passive: false });
}

/**************************************************************************
 * Conversation initialization
 **************************************************************************/

/**
 * Requests the server to start a conversation with the chatbot.
 * 
 * - Passes the treatmentGroup value to the server.
 * - Receives the conversationId value from the server.
 * - Calls the getActivities() function to receive the initial welcome message by the chatbot. 
 * 
 * @async
 * @returns {void}
 */
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

/**************************************************************************
 * Chatbot activity retrieval
 **************************************************************************/

/**
 * Requests the server to start retrieve new chatbot activities.
 * 
 * - Passes the conversationId, watermark and treatmentGroup values to the server.
 * - Receives the chatbot activities from the server.
 * - Calls the processActivities(data) function to update the conversation state and 
 *   display new messages (calls the processInitialActivities(data) function instead 
 *   if the chatbot is opened for the first time in a session).
 * 
 * @async
 * @returns {void}
 */
async function getActivities() {
  const treatmentGroup = sessionStorage.getItem('treatmentGroup')
  const res = await fetch('/getactivities', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversationId, watermark, treatmentGroup })
  });
  const data = await res.json();

  let chatbotAlreadyOpenedCopy = sessionStorage.getItem('chatbotAlreadyOpened') === 'true';
  if (data.activities) {
    //await new Promise(resolve => setTimeout(resolve, 4000)); // Nur zum Testen
    chatbotAlreadyOpenedCopy ? processActivities(data) : processInitialActivities(data);
  }
}

/**
 * Updates the conversation state and displays new messages. 
 * 
 * - Retrieves the conversation state from the session storage. 
 * - Hides the chatbot typing animation.
 * - Iterates through all chatbot activities, adds all new messages and their corresponding 
 *   activityIds to the conversation state, and displays all new messages.
 * - Adds the conversationId value to the conversation state when the chatbot activities are 
 *   retrieved for the first time.
 * - Updates the watermark value. The watermark value indicates which activities have been 
 *   added since the chatbot activities were last called up. This ensures that only new 
 *   activities are requested from the chatbot.
 * - Saves the updated conversation state object in the session storage.
 * - Sets the state of the continueSurveytBtn (disabled vs. enabled).
 * 
 * @param {Array<{parameter: value}>} data - The data object containing the chatbot activities. 
 * @returns {void}
 */
function processActivities(data) {
  let state = loadConversationState();
  const newMessages = [];

  if (!state.processedActivities) {
    state.processedActivities = [];
  }
  toggleTypingIndicator('hide', typingAnimationDelay);

  data.activities.forEach(act => {
    if (act.type === 'message' && !state.processedActivities.includes(act.id)) {
      const from = (act.from.id === 'user1') ? 'user' : 'bot';
      addMessage(act.text, from);
      newMessages.push({ text: act.text, from, activityId: act.id });
      state.processedActivities.push(act.id);
    }
  });

  if (data.watermark) {
    watermark = data.watermark;
  }
  state.watermark = watermark;
  state.conversationId = conversationId;

  state.messages = state.messages.concat(newMessages);
  saveConversationState(state);
  continueBtnStateMgmt();
  state.messages.forEach(msg => console.log(`Current state messages: ${msg.text}`)); //diese Zeile ist nur zum Testen in der Browser-Konsole
}

/**
 * Processes the initial bot welcome message when the chatbot is opened for the first time.
 * 
 * - This function acts as a buffer for the initial welcome message by the chatbot. The 
 *   chatbot's welcome message is retrieved from the server as soon as the user opens the 
 *   survey, however it is rendered only when the user opens the chatbot interface. 
 * - Receives the data object of the initial activity retrival.
 * - Keeps this data obejct until the user opens the chatbot interface for the first time. 
 * - When the user opens the chatbot interface for the first time: displays the initial bot 
 *   message typing animation (using the toggleTypingIndicator function) and executes the 
 *   processActivities(data) function to update the conversation state and display the initial 
 *   welcome message by the chatbot. 
 * 
 * @param {Array<{parameter: value}>} data - The data object containing the chatbot activities. 
 * @returns {void}
 */
function processInitialActivities(data) {
  document.addEventListener('userArrivedAtChatbot', function() {
    toggleTypingIndicator('show', initialTypingAnimationDelay);
    setTimeout(() => {processActivities(data)}, initialBotMessageDelay);
  })
}

/**************************************************************************
 * User message processing
 **************************************************************************/

/**
 * Processes new user messages. 
 * 
 * - Deletes the user message from the user input field.
 * - Displays the new user messages and the chatbot typing animation in the dialogue space.
 * - Adds new user messages (without an activityId) to the conversation state. 
 * - Sets the state of the continueSurveytBtn (disabled vs. enabled).
 * - Requests the server to send a new user message to the chatbot.
 * - Retrieves the corresponding activityId assigned by the chatbot and adds it to the 
 *   conversation state using the linkLastUserMessageWithActivityId(activityId) function. 
 * - Calls the getActivities() function to receive the chatbot's response.  
 * 
 * @async
 * @returns {void}
 */
async function sendUserMessage() {
  const treatmentGroup = sessionStorage.getItem('treatmentGroup');
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  addMessage(text, 'user');
  addMessageToState(text, 'user', null); 
  toggleTypingIndicator('show', typingAnimationDelay);
  continueBtnStateMgmt();

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

/**
 * Adds a new message to the conversation state. 
 * 
 * - Retrieves the conversation state from the session storage.
 * - Adds the message to the conversation state object.
 * - Saves the updated conversation state object in the session storage. 
 * 
 * @returns {void}
 */
function addMessageToState(text, from, activityId) {
  let state = loadConversationState();
  state.messages.push({ text, from, activityId });
  saveConversationState(state);
}

/**
 * Adds the activityId of the latest user message to the conversation state. 
 * 
 * - Retrieves the conversation state from the session storage. 
 * - Adds the activityId of the latest user message to this message and the processedActivities 
 *   array in the conversation state object. 
 * - Saves the updated conversation state object in the session storage. 
 * 
 * @param {string} activityId - The activityId to be added. 
 * @returns {void}
 */
function linkLastUserMessageWithActivityId(activityId) {
  let state = loadConversationState();
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].from === 'user' && !state.messages[i].activityId) {
      state.messages[i].activityId = activityId;
      if (!state.processedActivities.includes(activityId)) {
        state.processedActivities.push(activityId);
      }
      break;
    }
  }
  saveConversationState(state);
}

/**************************************************************************
 * Conversation state management
 **************************************************************************/

/**
 * Restores the saved conversation from the session storage.
 * 
 * - The purpose of this function is to retain the conversation if the page is accidentally 
 *   reloaded.
 * - This function is called as soon as the "surveyDataInitialized" is triggered if there is a 
 *   conversation stored in the session storage. 
 * - Retrieves the conversationId value and the latest stored watermark value.
 * - Restores all previously generated messages from the conversation.
 * 
 * @returns {void}
 */
function restoreConversation(storedConversation) {
  const conv = JSON.parse(storedConversation);
  conversationId = conv.conversationId;
  watermark = conv.watermark;
  conv.messages.forEach(msg => addMessage(msg.text, msg.from));
}

/**
 * Loads the stored conversation from the session storage.
 * 
 * @returns {{conversationId: string, 
 *            watermark: number, 
 *            messages: any[], 
 *            processedActivities: any[]}} The conversation state object. 
 */
function loadConversationState() {
  const stored = sessionStorage.getItem('conversation');
  return stored ? JSON.parse(stored) : { conversationId, watermark, messages: [], processedActivities: [] };
}

/**
 * Stores the conversation state object in the session storage. 
 * 
 * @param {{conversationId: string, 
*            watermark: number, 
*            messages: any[], 
*            processedActivities: any[]}} state - The conversation state object.
* @returns {void} 
*/
function saveConversationState(state) {
  sessionStorage.setItem('conversation', JSON.stringify(state));
}

/**
 * Manages the state of the continueSurveytBtn.
 * 
 * - If the continueBtnEnabled value is true, enables the continueSurveytBtn.
 * - If the continueBtnEnabled value is false, checks whether the continueBtnActivationTest is 
 *   true and if this is the case, enables the continueSurveyBtn and sets the continueBtnEnabled 
 *   variable to true. 
 * 
 * @returns {void}
 */
function continueBtnStateMgmt() {
  if (continueBtnEnabled) {
    document.getElementById('continueSurveytBtn').disabled = false;
    return;
  }
  if (continueButtonActivationTest()) {
    document.getElementById('continueSurveytBtn').disabled = false;
    continueBtnEnabled = true;
    sessionStorage.setItem('continueBtnEnabled', continueBtnEnabled);
  }
}

/**
 * Logic to check whether the continueSurveytBtn should be enabled.
 * 
 * - Implemented logic: The continueSurveytBtn should be enabled when the user has typed in at 
 *   least two messages. 
 * 
 * @returns {boolean} Whether the continueSurveytBtn should be enabled. 
 */
function continueButtonActivationTest() {
  let testResult = false;
  let state = loadConversationState();
  if (state.messages.filter(message => message.from === 'user').length >= 2) {
    testResult = true;
  }
  return testResult;
}

/**************************************************************************
 * Chatbot interface
 **************************************************************************/

/**
 * Displays new messages in the chatbot interface.
 * 
 * - Creates a new html element with the message. 
 * - Scrolls to the bottom in the dialogue space. 
 * 
 * @param {string} text - The text of the message to be added. 
 * @param {string} from - The author of the message ("user1" vs. "Test_Chatbot_1"). // TODO: "user1" und "Test_Chatbot_1" noch korrigieren. 
 * @returns {void}
 */
function addMessage(text, from) {
  const messagesDiv = document.getElementById('messages');
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', from === 'user' ? 'user-message' : 'bot-message');
  msgDiv.textContent = text;
  messagesDiv.appendChild(msgDiv);
  scrollMessagesToBottom();
}

/**
 * Toggles the chatbot typing indicator in the chatbot interface.
 * 
 * - If action is "show": Creates the html structure for the typing indicator (and deletes all 
 *   existing typing indicator html structures), and scrolls to the bottom of the messages area. 
 *   The creation of the html structure of the typing indicator is delayed by the value of 
 *   typingAnimationDelay.
 * - If action is "hide": removes the typing indicator from the messages area and removes the 
 *   timeout for a potentially queued typing indicator. 
 * 
 * @param {string} action - The action to perform: "show" vs. "hide".
 * @param {number} delay - Delay in milliseconds before showing the typing indicator.
 * @returns {void}
 */
function toggleTypingIndicator(action, delay) {
  const messagesDiv = document.getElementById('messages');
  let typingIndicator = document.getElementById('typingIndicator'); 

  // Logic to remove the typing indicator:
  if (action === 'hide') {
    if (typingIndicatorTimeout) {
      clearTimeout(typingIndicatorTimeout);
      typingIndicatorTimeout = null;
    }
    if (typingIndicator) {
      messagesDiv.removeChild(typingIndicator); 
    }
    return;
  }

  // Logic to show the typing indicator:
  if (action === 'show') {
    typingIndicatorTimeout = setTimeout(() => {
      if (typingIndicator) {
        messagesDiv.removeChild(typingIndicator);
      }

      typingIndicator = document.createElement('div');
      typingIndicator.id = 'typingIndicator';
      typingIndicator.classList.add('typing-indicator');
      typingIndicator.innerHTML = `
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      `;
      messagesDiv.appendChild(typingIndicator);
      
      scrollMessagesToBottom();
      typingIndicatorTimeout = null;
    }, delay); 
  }
}

/**
 * Scrolls to the bottom in the dialogue space. 
 * 
 * - This function is called each time a new message is added to the chatbot interface.  
 * 
 * @returns {void}
 */
function scrollMessagesToBottom() {
  const messagesContainer = document.querySelector('.chatbot-messages-container');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


function updateVh() {
  if (window.visualViewport) {
    const vh = window.visualViewport.height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    const offset = window.visualViewport.offsetTop;
    const chatbotInterface = document.getElementById('chatbot-interface');
    const progressBar = document.getElementById('progress-bar');
    chatbotInterface.style.transform = `translateY(${offset}px)`;
    progressBar.style.transform = `translateY(${offset}px)`;
    scrollMessagesToBottom()

  } else {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
}

/**
 * Dynamically adjusts the height of the user message input field. 
 * 
 * - This function is called each time the user interacts with the input field in the 
 *   chatbot interface. 
 * 
 * @param {HTMLTextAreaElement} textarea - The textarea html element. 
 * @param {number} maxRows - The maximum number of rows in the text input field. 
 * @returns {void}
 */
function adjustTextareaHeight(textarea, maxRows = 6) {
  textarea.style.height = 'auto';
  const scrollHeight = textarea.scrollHeight;
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = parseInt(computedStyle.lineHeight);
  const paddingTop = parseInt(computedStyle.paddingTop);
  const paddingBottom = parseInt(computedStyle.paddingBottom);
  const borderTop = parseInt(computedStyle.borderTopWidth);
  const borderBottom = parseInt(computedStyle.borderBottomWidth);
  const totalVerticalPadding = paddingTop + paddingBottom + borderTop + borderBottom;
  const maxHeight = (lineHeight * maxRows) + totalVerticalPadding;

  console.log(`scrollHeight: ${scrollHeight}`); // Nur zum Testen
  console.log(`maxHeight: ${maxHeight}`); // Nur zum Testen

  if (scrollHeight <= maxHeight + 2) {
    textarea.style.overflowY = 'hidden'; //hidden
    textarea.style.height = scrollHeight + 'px';
  } else {
    textarea.style.overflowY = 'auto';
    textarea.style.height = maxHeight + 'px';
    textarea.scrollTop = textarea.scrollHeight;
  }

  scrollMessagesToBottom();
}
