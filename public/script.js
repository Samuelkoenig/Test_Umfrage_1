/**
 * @fileoverview This script contains the logic of the survey webpage and is executed by the 
 * client in the browser. 
 * @author Samuel König <koenigsamuel99@gmx.de>
 * @version 1.0.0
 */

/**************************************************************************
 * Definition of variables
 **************************************************************************/

/**
 * Definition of the variables used in the script.
 * 
 * - totalPages @type {number}: the number of pages in the survey.
 * - chatbotPage @type {number}: the page number where the chatbot appears.
 * - emailCollection @type {boolean}: Whether users have the possibility to submit an email 
 *   at the end of the survey. 
 * - textareaReplacement @type {boolean}: Whether the user message input field should be 
 *   replaced by a button to move to the next page when the final dialogue state has been 
 *   reached. 
 * - likertQuestions @type {string[]}: an array with the names of all likert scale questions.
 * - questionSetClasses @type {Array<[string, string]>}: An array with html class names of
 *   elements to be arranged in a randomized order. Each entry is a list with two class names: 
 *   The first is the class name of the parent class container, which holds the elements that
 *   should be shuffled, and the second is the class name of the elements within that 
 *   container to be shuffled. 
 * - pages @type {NodeListOf<HTMLElement>}: DOM element.
 * - progressBar @type {HTMLElement}: DOM element.
 * - consentCheckbox @type {HTMLInputElement}: DOM element.
 * - next1 @type {HTMLButtonElement}: DOM element.
 * - currentPage @type {number}: the number of the current page.
 * - historyStates @type {Array<{page: number}>}: an array which stores the state history 
 *   of the webpage to artificially replicate the browser history.
 * - scrollPositions @type {Object.<string, number>}: A dictionary which stores the last 
 *   scroll positions on each page.
 * - scrollFrame1Id @type {number}: The id of the first animation frame used to queue the 
 *   automated scrolling process until a new page has been fully rendered. 
 * - scrollFrame2Id @type {number}: The id of the second animation frame used to queue the 
 *   automated scrolling process until a new page has been fully rendered. 
 * - bypassPopState @type {boolean}: a flag for controlling navigation events. 
 * - chatbotAlreadyOpened @type {boolean}: a flag indicating whether the chatbot has 
 *   already been opened in the session. 
 * - emailSent @type {boolean}: a flag indicating whether the client has submitted an email
 * - dialogueFinished @type {boolean}: a flag indicating whether the final dialgoue state 
 *   has been reached.
 *   on the final page. 
 */
const totalPages = 8;    // To be specified: the actual number of pages in the survey!
const chatbotPage = 4;   // To be specified: the page number where the chatbot appears!
const emailCollection = true  //To be specified: Whether users can submit an email!
const textareaReplacement = true  //To be specified: Whether the textarea should be replaced!
const likertQuestions = [
    "gender", 
    "age", 
    "service-quality-1", 
    "service-quality-2", 
    "service-quality-3", 
    "service-quality-4", 
    "service-quality-5", 
    "satisfaction-1", 
    "satisfaction-2", 
    "satisfaction-3", 
    "satisfaction-4", 
    "satisfaction-5", 
    "empathy-1", 
    "empathy-2", 
    "empathy-3", 
    "empathy-4", 
    "empathy-5"
];                      // To be specified: the likert question names used in the survey!
const questionSetClasses = [
    [".random-order-constructs", ".construct"],
    [".construct-service-quality", ".question"],
    [".construct-satisfaction", ".question"],
    [".construct-empathy", ".question"]
]                       // To be specified: the class names of the randomized question sets! 

let pages;
let progressBar;
let consentCheckbox;
let next1;

let currentPage = 1;
let historyStates = [];
let scrollPositions = {};
let scrollFrame1Id = null;
let scrollFrame2Id = null;
let bypassPopState = false;
let chatbotAlreadyOpened = sessionStorage.getItem('chatbotAlreadyOpened') === 'true';
let emailSent = sessionStorage.getItem('emailSent') === 'true';
let dialogueFinished = sessionStorage.getItem('dialogueFinished') === 'true';

/**************************************************************************
 * Initialization of page elements and event listeners
 **************************************************************************/

/**
 * Event Listener for initializing the page.
 * Executes the initializePage() function as soon as the DOM has been fully loaded.
 */
document.addEventListener('DOMContentLoaded', initializePage);

/**
 * Initializes the page.
 * This function is executed as soon as the DOM has been fully loaded.
 * 
 * - References important DOM elements.
 * - Initializes metadata (participantId and treatmentGroup).
 * - Randomizes the order of the specified sets of questions. 
 * - Restores previously saved data.
 * - Adds an initial state to the browser history.
 * - Displays the current page.
 * - Attaches all event listeners.
 * - Releases the event "surveyDataInitialized" to trigger the chatbot interface 
 *   initialization in chatbot.js.
 * 
 * @returns {void}
 */
async function initializePage() {
    referenceElements();
    await getMetadata();

    randomizeQuestionSets(questionSetClasses);
    restoreState();
    initializeHistory(currentPage);

    showPage(currentPage);
    attachEventListeners();

    document.dispatchEvent(new Event('surveyDataInitialized'));
}

/**
 * References important DOM elements.
 * 
 * - Additionally saves the chatbotAlreadyOpened value in the session storage so that the 
 *   chatbot.js file can access it. 
 * 
 * @returns {void}
 */
function referenceElements() {
    pages = document.querySelectorAll('.page');
    progressBar = document.getElementById('progress');
    consentCheckbox = document.getElementById('consent');
    next1 = document.getElementById('next1');

    sessionStorage.setItem('chatbotAlreadyOpened', chatbotAlreadyOpened);
}

/**
 * Adds event listeners to all relevant survey DOM elements (buttons and inputs).
 * 
 * - Logic for clicking on the consent checkbox to activate/ deactivate the start 
 *   survey button. 
 * - Logic for clicking on the back and next buttons to switch the page. 
 * - Logic for automatically saving changes in the user input fields. 
 * - Logic for clicking on the open chatbot button, close chatbot button and continue 
 *   survey button to navigate with regards to the chatbot interface.
 * - Logic for processing the "dialogueFininshedEvent" (which replaces the input 
 *   message field and the send button by the dialogueFinishedButton and is triggered 
 *   by the achievement of the final dialogue state).
 * - Logic for the finishedDialogueButton, moving to the next page. 
 * - Logic for clicking on the submit button to send all data to the server and move on 
 *   to the final thankyou page. 
 * - Logic for clicking on the email submit button to send an email to the server. 
 * - Logic for saving the page scroll position when the user reloads the page. 
 * - Logic for the popstate event caused by the browser when the user uses the navigation 
 *   buttons of the browser. 
 * 
 * @returns {void}
 */
function attachEventListeners() {
    consentCheckbox.addEventListener('change', consentCheckboxLogic);

    document.querySelectorAll('.next-btn').forEach(function (button) {
        button.addEventListener('click', nextButtonLogic);
    });

    document.querySelectorAll('.back-btn').forEach(function (button) {
        button.addEventListener('click', backButtonLogic);
    });

    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (input) {
        input.addEventListener('change', inputFieldLogic);
    });

    document.getElementById('openChatbotBtn').addEventListener('click', nextButtonLogic);
    document.getElementById('closeChatbotBtn').addEventListener('click', closeChatbotLogic);
    document.getElementById('continueSurveytBtn').addEventListener('click', continueSurveyLogic);
    
    document.addEventListener('dialogueFinishedEvent', handleFinishedDialogue);
    document.getElementById('finishedDialogueBtn').addEventListener('click', continueSurveyLogic);

    document.getElementById('submit').addEventListener('click', submitButtonLogic);
    document.getElementById('emailSubmitBtn').addEventListener('click', emailSubmitLogic);

    window.addEventListener('beforeunload', () => {
        saveScrollPositions(currentPage)
    });

    window.addEventListener('popstate', handlePopState);
}

/**************************************************************************
 * Page display and progress bar
 **************************************************************************/

/**
 * Switches to the specified page and updates the displayed content.
 * 
 * - Hides all pages and only shows the active page.
 * - When the user navigates to the chatbot page or back from the chatbot page, executes the 
 *   applyChatbotViewState() function to display the correct view. 
 * - When the user navigates to the chatbot page, calls the trackChatbotArrival() function to check 
 *   whether the user arrives there for the first time. 
 * - Updates the progress bar.
 * - Scrolls to the saved scroll position of the active page, using animation frames to ensure the 
 *   new page has been fully rendered when the scroll action is performed (at the beginning of the 
 *   function, cancelScrollDelays() is called to clear potentially queued animation frames).
 * 
 * @param {number} pageNumber - The number of the page to be displayed.
 * @returns {void}
 */
function showPage(pageNumber) {
    cancelScrollDelays();

    pages.forEach(page => page.classList.remove('active'));
    if (pageNumber === totalPages) {
        document.getElementById('thankyou').classList.add('active');
    } else {
        document.getElementById(`page${pageNumber}`).classList.add('active');
    }

    if (pageNumber >= (chatbotPage - 1) && pageNumber <= (chatbotPage + 1)) {
        applyChatbotViewState();
    }
    if (pageNumber === chatbotPage) {
        trackChatbotArrival();
    }

    updateProgressBar();

    if (!(pageNumber === chatbotPage)) {
        const pageElement = document.getElementById(`page${pageNumber}`);
        scrollPos = scrollPositions[pageNumber];
        console.log(`ScrollPosition: ${scrollPos}`); // Nur zum Testen
        if (scrollPos !== undefined) {
            scrollFrame1Id = requestAnimationFrame(() => {
                const dummy = pageElement.offsetHeight;
                scrollFrame2Id = requestAnimationFrame(() => {
                    setTimeout(() => {
                        window.scrollTo({ top: scrollPos, behavior: 'smooth' });
                    }, 50)
                });
            });
        } else {
            window.scrollTo(0, 0);
        }
    }
}

/**
 * Updates the progress bar based on the current page.
 * 
 * @returns {void}
 */
function updateProgressBar() {
    const progress = ((currentPage - 1) / (totalPages - 1)) * 100;
    progressBar.style.width = `${progress}%`;
}

/**
 * Clears all queued animation frames.
 * 
 * - This function is called at the beginning of the showPage(pageNmber) function in order to clear 
 *   all old queued animation frames.
 * 
 * @returns {void}
 */
function cancelScrollDelays() {
    if (scrollFrame1Id !== null) {
      cancelAnimationFrame(scrollFrame1Id);
      scrollFrame1Id = null;
    }
    if (scrollFrame2Id !== null) {
      cancelAnimationFrame(scrollFrame2Id);
      scrollFrame2Id = null;
    }
}

/**
 * Shows or hides text elements.
 * 
 * - This function shows and element (if action = "sho") of hides it (if action = 'hide).
 * 
 * @param {str} action - Whether to show or hide an element.
 * @param {str} elementId - The id of the html element.
 * @returns {void}
 */
function toggleNotification(action, elementId) {
    const notification = document.getElementById(elementId);
    if (notification) {
        notification.style.display = action === 'show' ? 'block' : 'none';
    }
}

/**************************************************************************
 * Chatbot page
 **************************************************************************/

/**
 * Adjusts the visibility of the chatbot interface.
 * 
 * - Switches between (a) the survey view and (b) the chatbot interface view by 
 *   manipulating the relevant css specifications. 
 * - Displays the correct view based on the currentPage value.
 * - When opening the chatbot interface, calls the mobileChatbotActivation() function to 
 *   ensure that the chatbot is correctly displayed on mobile devices.
 * - If the chatbot interface gets opened, triggers the event "chatbotInterfaceOpened".
 * 
 * @returns {void}
 */
function applyChatbotViewState() {
    const documentBody = document.body;
    const scenarioDiv = document.getElementById('chatbot-scenario');
    const chatbotInterface = document.getElementById('chatbot-interface');
    const navigation = document.getElementById('chatbot-navigation');
    const openBtnContainer = document.getElementById('open-chatbot-button-container');
    const surveyContainer = document.getElementById('survey-container');
    const pageContainers = document.getElementsByClassName('page');

    if (!scenarioDiv || !chatbotInterface || !navigation || !openBtnContainer || !surveyContainer) return; 

    // (b) Chatbot interface view:
    if (currentPage === chatbotPage) {
        scenarioDiv.style.display = 'none';
        chatbotInterface.classList.remove('chatbot-hidden');
        chatbotInterface.classList.add('chatbot-visible');
        navigation.style.display = 'none';
        openBtnContainer.style.display = 'none';
        surveyContainer.classList.add('chatbot-visible');
        pageContainers[chatbotPage - 1].classList.add('chatbot-visible');

        setTimeout(() => {
            mobileChatbotActivation()
            surveyContainer.classList.add('chatbot-visible-locked');
            pageContainers[chatbotPage - 1].classList.add('chatbot-visible-locked');
            documentBody.classList.add('chatbot-visible');
        }, 100);

        document.dispatchEvent(new Event('chatbotInterfaceOpened'));
    
    // (a) Survey view:
    } else {
        documentBody.classList.remove('chatbot-visible');
        scenarioDiv.style.display = 'block';
        chatbotInterface.classList.remove('chatbot-visible');
        chatbotInterface.classList.add('chatbot-hidden');
        navigation.style.display = 'flex';
        openBtnContainer.style.display = 'flex';
        surveyContainer.classList.remove('chatbot-visible');
        surveyContainer.classList.remove('chatbot-visible-locked');
        pageContainers[chatbotPage - 1].classList.remove('chatbot-visible');
        pageContainers[chatbotPage - 1].classList.remove('chatbot-visible-locked');
    }
}

/**
 * Fires an event when the user arrives at the chatbot for the first time.
 * 
 * - If the chatbot is opened for the first time: sets the chatbotAlreadyOpened value 
 *   to false, updates it in the session storage and triggers the event 
 *   "userArrivedAtChatbot" to initialte the loading of the welcome message.
 * 
 * @returns {void}
 */
function trackChatbotArrival() {
    if (chatbotAlreadyOpened === false) {
        chatbotAlreadyOpened = true
        sessionStorage.setItem('chatbotAlreadyOpened', chatbotAlreadyOpened);
        document.dispatchEvent(new CustomEvent('userArrivedAtChatbot'));
    }
}

/**
 * Closes the chatbot interface.
 * 
 * - Applies the backButtonLogic() function. 
 * - This function is called each time the user clicks on the "Close Chatbot" button.
 * 
 * @returns {void}
 */
function closeChatbotLogic() {
    backButtonLogic();
}

/**
 * Processes the dialogueFinishedEvent.
 * 
 * - This function is applied when the client receives the finalState = true value from
 *   the chatbot api metadata, meaning the the chatbot has reached the final dialogue 
 *   state. 
 * - Sets the dialogueFinished value to true, stores it in the session storage and calls
 *   the setFinishedDialogueState function to replace the input message text area and 
 *   the send button by the finishedDialogueBtn. 
 * 
 * @returns {void}
 */
function handleFinishedDialogue(){ 
    dialogueFinished = true;
    sessionStorage.setItem('dialogueFinished', dialogueFinished);
    setFinishedDialogueState();
}

/**************************************************************************
 * Data and metadata management
 **************************************************************************/

/**
 * Saves new information provided by the participant in the input fields. 
 * 
 * - Updates the session storage using saveData().
 * - This function is called each time a change in the input fields is detected.
 *
 * @returns {void}
 */
function inputFieldLogic() {
    saveData();
}

/**
 * Saves the survey data.
 * 
 * - Saves the the consentCheckbox value and all input field data in the session storage.
 * - This function is called each time the participant makes changes in an input field. 
 * 
 * @returns {void}
 */
function saveData() {
    const consentVal = consentCheckbox.checked;
    const formData = { consent: consentVal };

    likertQuestions.forEach(question => {
        const value = document.querySelector(`input[name="${question}"]:checked`)?.value || '';
        formData[question] = value;
    });

    sessionStorage.setItem('formData', JSON.stringify(formData));
}

/**
 * Implements the logic of the submit button. 
 * 
 * - Shows the notification the the data is transmitted. 
 * - Collects all required data when the user clicks on the submit button and 
 *   tries to send it to the server.
 * - Calls the submitData function to try to send the data to the server. If the 
 *   response of the server is successfull, moves forward to the final page (the
 *   "thankyou" page) and deletes the participant data. If the response of the 
 *   server is not successfull (meaning the submitData function returns an error),
 *   shows a notification that there was a network error. 
 * 
 * @async
 * @returns {void}
 */
async function submitButtonLogic() {
    toggleNotification('hide', 'submit-error-message');
    toggleNotification('show', 'submit-data-notification');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    const data = collectData();
    try {
        await submitData(data, 4);
        toggleNotification('hide', 'submit-data-notification');
        moveToFinalPage();
        clearState();
    } catch (error) {
        console.error('Netzwerkfehler:', error);
        toggleNotification('hide', 'submit-data-notification');
        toggleNotification('show', 'submit-error-message');
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
}

/**
 * Collects all relevant participant data and sends it to the server.
 * 
 * - This function is called when a participant submits the data.
 * - Collects the metadata (participantId and treatmentGroup), the chatbot conversation 
 *   log (see chatbot.js file), and the participant's selection in the survey questions. 
 * 
 * @returns {Array<{parameter: value}>} The data array to be sent to the server. 
 */
function collectData() {
    const data = {
        participantId: sessionStorage.getItem('participantId'),
        treatmentGroup: sessionStorage.getItem('treatmentGroup'),
        conversationLog: sessionStorage.getItem('conversation') || ''
    };
    likertQuestions.forEach(question => {
        data[question] = document.querySelector(`input[name="${question}"]:checked`)?.value || '';
    });
    return data;
}

/**
 * Sends the participant data to the server. 
 * 
 * - This function is called when the participant submits the survey.
 * - If the server responded successfully, returns the response.
 * - If the server did not respond successfully, retries sending the data
 *   to the server for up to the number of retries times. If the server 
 *   response ie still unsuccessfull after 4 tries, throws an error. 
 * 
 * @async
 * @param {Array<{parameter: value}>} data - The data array to be sent to the server.
 * @param {int} retries - The number of retries when the server did not respond successfull.  
 * @returns {void}
 */
async function submitData(data, retries = 4) {
    let lastError = null;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            return response
        } catch (error) {
            console.error(`Fehler beim Senden der Daten.`, error);
            await new Promise(r => setTimeout(r, 500)); 
            lastError = error;
        }
    }
    throw lastError;
}

/**
 * Sends the email to the server. 
 * 
 * - This function is called when the participant submits the email.
 * - If the server responded successfully, returns the response.
 * - If the server did not respond successfully, retries sending the email
 *   to the server for up to the number of retries times. If the server 
 *   response ie still unsuccessfull after 4 tries, throws an error. 
 * 
 * @async
 * @param {str} email - The email string to be sent to the server.
 * @param {int} retries - The number of retries when the server did not respond successfull.  
 * @returns {void}
 */
async function submitEmail(email, retries = 4) {
    let lastError = null;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch('/submit-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            return response
        } catch (error) {
            console.error(`Fehler beim Senden der E-Mail.`, error);
            await new Promise(r => setTimeout(r, 500)); 
            lastError = error;
        }
    }
    throw lastError;
}

/**
 * Implements the logic of the email submit button. 
 * - Collects the email string from the email input textarea and clears this textarea. 
 * - Shows the notification the the email is transmitted. 
 * - Calls the submitEmail function to try to send the data to the server. If the 
 *   response of the server is successfull, sets the emailSent variable to true and 
 *   calls the setThankyouPageState function to move forward to the final state of the 
 *   final thankyou page. If the response of the server is not successfull (meaning the 
 *   submitEmail function returns an error), shows a notification that there was a network error. 
 * - If the participant clicked on the submit email button without having specified an email,
 *   nothing happens.
 * 
 * @async
 * @returns {void}
 */
async function emailSubmitLogic() {
    const emailInput = document.getElementById('emailInput');
    const email = emailInput.value.trim();
    if (!email) return;
    toggleNotification('hide', 'submit-emmail-error-message');
    toggleNotification('show', 'submit-email-notification');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    try {
        await submitEmail(email, 4);
        toggleNotification('hide', 'submit-email-notification');
        emailSent = true;
        sessionStorage.setItem('emailSent', emailSent);
        setThankyouPageState();
    } catch (error) {
        console.error('Netzwerkfehler:', error);
        toggleNotification('hide', 'submit-email-notification');
        toggleNotification('show', 'submit-emmail-error-message');
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
}

/**
 * Loads the metadata (participantId and treatmentGroup).
 * 
 * - This function is called as soon as the DOM is fully loaded.
 * - Requests the metadata from the server when the page is loaded for the 
 *   first time, otherwise the metadata is retrieved from the session storage. 
 * 
 * @async
 * @returns {void}
 */
async function getMetadata() {
    if (!sessionStorage.getItem('participantId') || !sessionStorage.getItem('treatmentGroup')) {
        surveyData = await fetchMetadataFromServer();
    }
    const participantId = sessionStorage.getItem('participantId') || surveyData.participantId;
    const treatmentGroup = sessionStorage.getItem('treatmentGroup') || surveyData.treatmentGroup;
    sessionStorage.setItem('participantId', participantId);
    sessionStorage.setItem('treatmentGroup', treatmentGroup);
}

/**
 * Requests the metadata from the server (participantId and treatmentGroup).
 * 
 * @async
 * @returns {{participantId: string, treatmentGroup: string}} The metadata.
 */
async function fetchMetadataFromServer() {
    const response = await fetch('/generateSurveyData');
    const json = await response.json();
    return {
        participantId: json.participantId,
        treatmentGroup: json.treatmentGroup
    };
}

/**************************************************************************
 * State management
 **************************************************************************/

/**
 * Saves the current navigation state of the survey webpage.
 * 
 * - Saves the currentPage value and the historyStates value in the session storage.
 * - This function is called each time the participant navigates within the single 
 *   page application. 
 * 
 * @returns {void}
 */
function saveNavigationState() {
    sessionStorage.setItem('currentPage', currentPage);
    sessionStorage.setItem('historyStates', JSON.stringify(historyStates));
}

/**
 * Saves the scroll position of a page.
 * 
 * - Determines the current scroll position and saves it as value for the specified page in 
 *   the scrollPositions object.
 * - Saves the updated scrollPositions object in the session storage. 
 * - Excludes the view where the chatbot interface is opened from the procedure. 
 * 
 * @param {number} pageNumber - The page number for which the scroll posotion should be saved. 
 * @returns {void}
 */
function saveScrollPositions(pageNumber) {
    const scrollY = window.scrollY;
    if (!(currentPage === chatbotPage)) {
        scrollPositions[pageNumber] = scrollY;
        sessionStorage.setItem('scrollPositions', JSON.stringify(scrollPositions));
    }
}

/**
 * Sets the view of the final page.
 * 
 * - Switches the view on the final page between the view where the user is asked to provide 
 *   an email and the subsequent view where the user has provided an email. 
 * - The view to display is determined based on the value of the emailSent variable. 
 * - If the variable emailCollection is set to false, the possibility to submit an email 
 *   is not shown at all. 
 * 
 * @returns {void}
 */
function setThankyouPageState() {
    const emailInfoSection = document.getElementById('emailInfoSection');
    const emailSuccessSection = document.getElementById('emailSuccessSection');
    if (!emailCollection) {
        emailSuccessSection.classList.add('hidden');
        emailInfoSection.classList.add('hidden');
        return;
    }
    if (!emailSent) {
        emailSuccessSection.classList.add('hidden');
        emailInfoSection.classList.remove('hidden');
    } else {
        emailInfoSection.classList.add('hidden');
        emailSuccessSection.classList.remove('hidden');
    }
}

/**
 * Sets the view of the bottom in the chatbot interface.
 * 
 * - Switches the view on the bottom area of the chatbot interface between the view 
 *   showing the input message text area and the send button and the view showing the 
 *   finishedDialogueBtn. 
 * - The view to display is determined based on the value of the dialogueFInished variable. 
 * - If the variable textareaReplacement is set to false, the user message input field is not
 *   replaced by the finishedDialogueButton even when the final dialogue state has been 
 *   reached. 
 * 
 * @returns {void}
 */
function setFinishedDialogueState() { 
    const inputContainer = document.getElementById('input-container');
    const finishedDialogueButton = document.getElementById('finished-dialogue-container');
    if (!textareaReplacement) {
        finishedDialogueButton.classList.add('hidden');
        inputContainer.classList.remove('hidden');
        return;
    }
    if (!dialogueFinished) {
        finishedDialogueButton.classList.add('hidden');
        inputContainer.classList.remove('hidden');
    }
    else {
        inputContainer.classList.add('hidden');
        finishedDialogueButton.classList.remove('hidden');
    }
}

/**
 * Restores the saved state from the session storage.
 * 
 * - The purpose of this function is to retain the progress of the survey if the page 
 *   is accidentally reloaded.
 * - This function is called as soon as the DOM is fully loaded. 
 * - Retrieves the currentPage value, the historyStates value, the scrollPositions value, 
 *   the consentCheckbox value and all input field data in the session storage.
 * - Restores the view of the bottom area in the chatbot interface by calling the 
 *   setFinishedDialogueState() function. 
 * - Restores the state of the final page by calling the setThankyouPageState() function.
 * 
 * @returns {void}
 */
function restoreState() {
    const savedPage = sessionStorage.getItem('currentPage');
    if (savedPage) {
        currentPage = parseInt(savedPage, 10);
    }
    
    const savedHistoryStates = sessionStorage.getItem('historyStates');
    if (savedHistoryStates) {
        historyStates = JSON.parse(savedHistoryStates);
    }

    const savedScrollPositions = sessionStorage.getItem('scrollPositions');
    if (savedScrollPositions) {
        scrollPositions = JSON.parse(savedScrollPositions);
    }

    const savedData = sessionStorage.getItem('formData');
    if (savedData) {
        const state = JSON.parse(savedData);
        if (state.consent) {
            consentCheckbox.checked = true;
            next1.disabled = false;
        }
        likertQuestions.forEach(question => {
            if (state[question]) {
                const radio = document.querySelector(`input[name="${question}"][value="${state[question]}"]`);
                if (radio) radio.checked = true;
            }
        });
    }

    setFinishedDialogueState()
    setThankyouPageState()
}

/**
 * Deletes all participant data from the session storage.
 * 
 * - This function is called after the pafticipant has submitted the survey. 
 * 
 * @returns {void}
 */
function clearState() {
    sessionStorage.removeItem('participantId');
    sessionStorage.removeItem('treatmentGroup');
    sessionStorage.removeItem('formData');
    sessionStorage.removeItem('conversation');
}

/**************************************************************************
 * Navigation and history management
 **************************************************************************/

/**
 * Manages the state of the "Start survey" button.
 * 
 * - Deactivates the "Start survey" button as soon as the consentCheckbox is not 
 *   activated and activates this button as soon as the consentCheckbox is activated.
 * 
 * @returns {void}
 */
function consentCheckboxLogic() {
    next1.disabled = !this.checked;
    saveData();
}

/**
 * Manages the navigation within the webpage via the next buttons. 
 * 
 * - This function is called each time the user navigates within the webpage using the 
 *   next buttons.
 * - Saves the scroll position on the current page. 
 * - Updates the currentPage value, displays the new page and saves the new state of 
 *   the survey webpage. 
 * - If the user accessses a new survey page for the first time, this new page is added
 *   to the history; otherwise the browser history is manually set one step forward so 
 *   that the browser history is still synchronized with the currentPage value (in this 
 *   case the bypassPopState flag is set to true to prevent the automatically fired 
 *   handlePopState(event) function call to be executed). 
 * 
 * @returns {void}
 */
function nextButtonLogic() {
    if (currentPage < totalPages) {
        saveScrollPositions(currentPage);
        currentPage++;
        showPage(currentPage);
        saveNavigationState();
    }

    if (!historyStates.some(obj => obj.page === currentPage)) {
        pushPageToHistory(currentPage);
    } else {
        bypassPopState = true;
        window.history.forward();
    }
}

/**
 * Manages the navigation within the webpage via the back buttons.
 * 
 * - This function is called each time the user navigates within the webpage using the 
 *   back buttons.
 * - Saves the scroll position on the current page. 
 * - Updates the currentPage value, displays the new page and saves the new state of 
 *   the survey webpage. 
 * - The browser history is manually set one step backwards so that the browser history 
 *   is still synchronized with the currentPage value (in this case the bypassPopState 
 *   flag is set to true to prevent the automatically fired handlePopState(event) function 
 *   call to be executed). 
 * 
 * @returns {void}
 */
function backButtonLogic() {
    if (currentPage > 1 && currentPage < totalPages) {
        saveScrollPositions(currentPage);
        currentPage--;
        showPage(currentPage);
        saveNavigationState();

        bypassPopState = true;
        window.history.back();
    }
}

/**
 * Closes the chatbot interface and moves to the next page of the survey.
 * 
 * - Calls the function nextButtonLogic() to move to the next paage of the survey. 
 * - This function is called each time the user clicks on the "Continue survey" button.
 * 
 * @returns {void}
 */
function continueSurveyLogic() {
    nextButtonLogic();
}

/**
 * Moves to the final page. 
 * 
 * - This function is called when the user pressed the submit button and the data was
 *   successfully sent to the server. 
 * - Saves the scroll position on the current page. 
 * - Sets the currentPage value to the final page number, displays the new page and 
 *   saves the new state of the survey webpage. 
 * - If the user accessses a new survey page for the first time, this new page is added
 *   to the history; otherwise the browser history is manually set one step forward so 
 *   that the browser history is still synchronized with the currentPage value (in this 
 *   case the bypassPopState flag is set to true to prevent the automatically fired 
 *   handlePopState(event) function call to be executed). 
 * 
 * @returns {void}
 */
function moveToFinalPage() {
    if (currentPage < totalPages) {
        saveScrollPositions(currentPage);
        currentPage = totalPages;
        showPage(currentPage);
        saveNavigationState();
    }

    if (!historyStates.some(obj => obj.page === currentPage)) {
        pushPageToHistory(currentPage);
    } else {
        bypassPopState = true;
        window.history.forward();
    }
}

/**
 * Initializes the current browser history state.
 * 
 * - This function is called at the beginning when the page is initially loaded or when 
 *   it is reloaded.
 * - A state with the corresponding page is attached to the automatically generated entry
 *   in the browser history when the page is loaded or reloaded. 
 * - If the current page is not part of the historyStates array, this page is added to the 
 *   historyStates array (this should only be the case when the page is initially loaded 
 *   and not when the page is reloaded).
 * - Saves the new webpage state in the session storage using saveNavigationState().
 * 
 * @param {number} page - The page to be attached to the browser history.
 * @returns {void}
 */
function initializeHistory(page) {
    const stateObj = { page: page };
    if (!historyStates.some(obj => obj.page === currentPage)) historyStates.push(stateObj);
    window.history.replaceState(stateObj, "", "");
    saveNavigationState();
}

/**
 * Adds a new state with the specified page number to the browser history.
 * 
 * - This function is called each time the user accessses a new survey page for the first time. 
 *   In this case, this new page is added as a new state to the browser history and the internal
 *   historyStates array. 
 * - Saves the new webpage state in the session storage using saveNavigationState().
 * 
 * @param {number} page - The page to be added to the browser history.
 * @returns {void}
 */
function pushPageToHistory(page) {
    const stateObj = { page: page };
    historyStates.push(stateObj);
    window.history.pushState(stateObj, "", "");
    saveNavigationState();
}

/**
 * Manages the navigation via the navigation buttons of the browser.
 * 
 * - The popstate event is fired automatically by the browser each time the user uses the back 
 *   or forward navigation button of the browser, or if you manually jump forwards or backwards 
 *   in the browser history in the javascript file. In this case, the popstate event listener calls
 *   this function. 
 * - (a) If the user navigates back or forward within the survey webpage using the navigation buttons
 *   of the browser, this function saves the current scroll position, synchronizes the currentPage 
 *   value, displays the corresponding survey page using showPage(currentPage) and saves the new state 
 *   using saveNavigationState().
 * - (b) This function additionally prevents the possibility to move forward in the survey via the 
 *   navigation button of the browser when the user is on page 1 and has not activated the consent 
 *   checkbox. 
 * - (c) When the participant has submitted the survey, is on the final page ("thankyou" page) and 
 *   presses the back button of the browser, the popstate event listener is destroyed so that the 
 *   currentPage value is not decremented and the webpage stil displays the "thankyou" page.
 * - (d) If the bypassPopState flag is set to true, a pre-check prevents this function to be executed.
 * 
 * @param {PopStateEvent} event - The event triggered by pressing the navigation button of the browser.
 * @returns {void}
 */
function handlePopState(event) {

    // (d) Prevent execution of the function if bypassPopState flag is set to true: 
    if (bypassPopState) {
        bypassPopState = false;
        return;
    }

    // (b) Behaviour when the user is on page one and has not activated the consent checkbox:
    const consentIsChecked = consentCheckbox.checked; 
    if (currentPage === 1 && event.state.page === 2 && !consentIsChecked) {
        bypassPopState = true;
        window.history.back();
        return;
    }

    // (c) Behaviour when the user is on the final page:
    if (currentPage === totalPages) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
    }

    // (a) Default behaviour:
    if (event.state.page < currentPage) {
        saveScrollPositions(currentPage);
        currentPage--;
    } else {
        saveScrollPositions(currentPage);
        currentPage++;
    }
    
    showPage(currentPage);
    saveNavigationState();
}

/**************************************************************************
 * Question order randomization
 **************************************************************************/

/**
 * Shuffles an array using the Fisher-Yates shuffle algorithm.
 * 
 * - This function is used to create a random order of the elements in an array, representing the 
 *   randomized question order of all questions within the same random-order-div html class. 
 * 
 * @param {string[]} array - An array whose length corresponds to the number of questions whose 
 * order is to be randomized. 
 * @returns {array} The shuffled array. 
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Rearranges the order of all elements in a set of questions that should be randomized. 
 * 
 * - This function is called at the beginning when the page is loaded or reloaded.
 * - If the page is initially loaded, it creates a random array representing the new order of
 *   the questions and saves it in the session storage. If the page is reloaded, it retrieves 
 *   this random array from the session storage. 
 * - Rearranges all elements within the respective html class according to the new random 
 *   order from the generated array. 
 * 
 * @param {string} htmlParentClassName - The name of the css class which contains the questions whose
 * order should be randomized.
 * @param {string} htmlElementClassName - The name of the css class of the individual elements whose
 * order should be randomized.
 * @returns {void} 
 */
function randomizeQuestionOrder(htmlParentClassName, htmlElementsClassName) {
    // Selects all random-order-div classes and the questions contained therein: 
    const containers = document.querySelectorAll(htmlParentClassName);
    const allRandomizedElements = [];
    const containerSizes = [];
    containers.forEach(container => {
      const elements = Array.from(container.querySelectorAll(htmlElementsClassName));
      containerSizes.push(elements.length);
      allRandomizedElements.push(...elements);
    });
    const NumberElements = allRandomizedElements.length;

    // Load the random question order from the session storage, or if not existing, 
    // generate a random question order and save it in the session storage:
    let storedOrder = sessionStorage.getItem("randomOrder" + htmlParentClassName + htmlElementsClassName);
    let randomOrder;
    if (storedOrder) {
      randomOrder = JSON.parse(storedOrder);
    } else {
      randomOrder = [...Array(NumberElements).keys()];
      shuffleArray(randomOrder);
      sessionStorage.setItem("randomOrder" + htmlParentClassName + htmlElementsClassName, JSON.stringify(randomOrder));
    }

    // Rearrange the questions according to the generated random order:
    const newOrder = randomOrder.map(index => allRandomizedElements[index]);
    containers.forEach(container => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    });
    let pointer = 0;
    containers.forEach((container, containerIndex) => {
      const size = containerSizes[containerIndex];
      for (let i = 0; i < size; i++) {
        container.appendChild(newOrder[pointer]);
        pointer++;
      }
    });
  }

/**
 * Executes the randomizeQuestionOrder for a range of html classes. 
 * 
 * - This function is called to execute the randomizeQuestionOrder for any number of 
 *   question sets. 
 * 
 * @param {Array<[string, string]>} questionSetClasses - A list of class name pairs, where
 * each pair consists of 
 * - The first string being the parent container class.
 * - The second string being the class of the elements whose order should be randomized.
 * @returns {void} 
 */
function randomizeQuestionSets(questionSetClasses) {
    questionSetClasses.forEach(([htmlParentClassName, htmlElementsClassName]) => {
        randomizeQuestionOrder(htmlParentClassName, htmlElementsClassName);
    });
}
