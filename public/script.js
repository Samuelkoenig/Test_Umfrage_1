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
 * - totalPages @type {number}: the number of pages in the survey.
 * - chatbotPage @type {number}: the page number where the chatbot appears.
 * - automaticScrollDelay @type {number}: The delay in milliseconds before the page 
 *   automatically scrolls to the last position of a page the user has already opened. 
 * - likertQuestions @type {string[]}: an array with the names of all likert scale questions.
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
 */
const totalPages = 6;    // To be specified: the actual number of pages in the survey!
const chatbotPage = 4;   // To be specified: the page number where the chatbot appears!
const automaticScrollDelay = 0  // To be specifiec: the automatic scroll delay!
const likertQuestions = [
    "gender", 
    "experience", 
    "satisfaction"
];                      // To be specified: the likert question names used in the survey!

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
 * Adds event listeners to all relevant DOM elements (buttons and inputs).
 * 
 * - Logic for clicking on the consent checkbox to activate/ deactivate the start 
 *   survey button. 
 * - Logic for clicking on the back and next buttons to switch the page. 
 * - Logic for automatically saving changes in the user input fields. 
 * - Logic for clicking on the open chatbot button, close chatbot button and continue 
 *   survey button to navigate with regards to the chatbot interface.
 * - Logic for clicking on the submit button to send all data to the server and move on 
 *   to the final thankyou page. 
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

    document.getElementById('openChatbotBtn').addEventListener('click', () => {
        openChatbotLogic();
        closeChatbotLogic();
        openChatbotLogic();
    });
    document.getElementById('closeChatbotBtn').addEventListener('click', closeChatbotLogic);
    document.getElementById('continueSurveytBtn').addEventListener('click', continueSurveyLogic);

    document.getElementById('submit').addEventListener('click', submitButtonLogic);

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

    if (pageNumber === chatbotPage) {
        let openChatbotState = sessionStorage.getItem('openChatbot');
        if (openChatbotState === null) {
            sessionStorage.setItem('openChatbot', '0');
        }
        applyChatbotViewState();
    } else {
        //sessionStorage.setItem('openChatbot', '0'); // If active, chatbot ui is closed automatically. 
        applyChatbotViewState();
    }

    updateProgressBar();

    const pageElement = document.getElementById(`page${pageNumber}`);
    scrollPos = scrollPositions[pageNumber];
    console.log(`ScrollPosition: ${scrollPos}`); // Nur zum Testen
    if (scrollPos !== undefined) {
        scrollFrame1Id = requestAnimationFrame(() => {
            const dummy = pageElement.offsetHeight;
            scrollFrame2Id = requestAnimationFrame(() => {
                window.scrollTo({ top: scrollPos, behavior: 'smooth' });
            });
        });
    } else {
        window.scrollTo(0, 0);
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

/**************************************************************************
 * Chatbot page
 **************************************************************************/

/**
 * Adjusts the visibility of the chatbot interface.
 * 
 * - Checks the value of the openChatbot variable in the session storage.
 * - Switches between the survey view and the chatbot interface view. 
 *   Displays the correct view based on the values of openChatbot and currentPage.
 * - If the chatbot interface gets opened, triggers the event "chatbotInterfaceOpened".
 * 
 * @returns {void}
 */
function applyChatbotViewState() {
    const openChatbot = sessionStorage.getItem('openChatbot') === '1';
    const documentBody = document.body;
    const scenarioDiv = document.getElementById('chatbot-scenario');
    const chatbotInterface = document.getElementById('chatbot-interface');
    const navigation = document.getElementById('chatbot-navigation');
    const openBtnContainer = document.getElementById('open-chatbot-button-container');
    const surveyContainer = document.getElementById('survey-container');
    const pageContainers = document.getElementsByClassName('page');

    if (!scenarioDiv || !chatbotInterface || !navigation || !openBtnContainer || !surveyContainer) return; 

    if (openChatbot && currentPage === chatbotPage) {
        //documentBody.classList.add('chatbot-visible');
        scenarioDiv.style.display = 'none';
        chatbotInterface.classList.remove('chatbot-hidden');
        chatbotInterface.classList.add('chatbot-visible');
        navigation.style.display = 'none';
        openBtnContainer.style.display = 'none';
        surveyContainer.classList.add('chatbot-visible');
        pageContainers[chatbotPage - 1].classList.add('chatbot-visible');
        //documentBody.classList.add('chatbot-visible');

        //window.scrollTo(0, 0);
        //document.body.offsetHeight;
        setTimeout(() => {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth' 
            });
            updateVh();
            //surveyContainer.classList.add('chatbot-visible');
            //pageContainers[chatbotPage - 1].classList.add('chatbot-visible');
            surveyContainer.classList.add('chatbot-visible-locked');
            pageContainers[chatbotPage - 1].classList.add('chatbot-visible-locked');
            documentBody.classList.add('chatbot-visible');
        }, 10000);

        document.dispatchEvent(new Event('chatbotInterfaceOpened'));

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
 * Opens the chatbot interface.
 * 
 * - Saves the scroll position on the current page. 
 * - If the chatbot is opened for the first time: sets the chatbotAlreadyOpened value 
 *   to false, updates it in the session storage and triggers the event 
 *   "userArrivedAtChatbot".
 * - Sets the value of openChatbot in the sessionStorage to 1 and calls the 
 *   applyChatbotViewState() to switch the view to the chatbot interface. 
 * - This function is called each time the user clicks on the "Open Chatbot" button.
 * 
 * @returns {void}
 */
function openChatbotLogic() {
    saveScrollPositions(currentPage);
    if (chatbotAlreadyOpened === false) {
        chatbotAlreadyOpened = true
        sessionStorage.setItem('chatbotAlreadyOpened', chatbotAlreadyOpened);
        document.dispatchEvent(new CustomEvent('userArrivedAtChatbot'));
    }
    sessionStorage.setItem('openChatbot', '1');
    applyChatbotViewState();
}

/**
 * Closes the chatbot interface.
 * 
 * - Sets the value of openChatbot in the sessionStorage to 0 and calls the 
 *   applyChatbotViewState() to switch the view to the survey view. 
 * - Displays the new page. 
 * - This function is called each time the user clicks on the "Close Chatbot" button
 *   or navigates back using the browser's navigation button while having the chatbot 
 *   interface opened.
 * 
 * @returns {void}
 */
function closeChatbotLogic() {
    sessionStorage.setItem('openChatbot', '0');
    applyChatbotViewState();
    showPage(currentPage);
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
 * - Collects all required data when the user clicks on the submit button and sends 
 *   it to the server.
 * - Moves forward to the final survey page (the "thankyou" page) and deletes the 
 *   participant data. 
 * 
 * @async
 * @returns {void}
 */
async function submitButtonLogic() {
    const data = collectData();
    await submitData(data);
    nextButtonLogic();
    clearState();
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
 * 
 * @async
 * @param {Array<{parameter: value}>} data - The data array to be sent to the server. 
 * @returns {void}
 */
async function submitData(data) {
    try {
        const response = await fetch('/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            console.error('Fehler beim Senden der Daten');
        }
    } catch (error) {
        console.error('Netzwerkfehler:', error);
        alert('Netzwerkfehler. Bitte überprüfe deine Verbindung und versuche es erneut.');
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
    const currentlyOpen = (sessionStorage.getItem('openChatbot') === '1');
    if (!currentlyOpen || !(currentPage === chatbotPage)) {
        scrollPositions[pageNumber] = scrollY;
        sessionStorage.setItem('scrollPositions', JSON.stringify(scrollPositions));
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
    sessionStorage.removeItem('openChatbot');
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
 * - (b) If the chatbot interface is opened when the popstate event is fired, the webpage reacts as 
 *   follows: if the event was caused by the back button, the chatbot interface is closed and the survey 
 *   page with the "Open Chatbot" button is displayed, otherwise if the event was caused by the forward 
 *   button, the next survey page is displayed. Additionally, the browser history and the currentPage 
 *   value are synchronized. 
 * - (c) This function additionally prevents the possibility to move forward in the survey via the 
 *   navigation button of the browser when the user is on page 1 and has not activated the consent 
 *   checkbox. 
 * - (d) When the participant has submitted the survey, is on the final page ("thankyou" page) and 
 *   presses the back button of the browser, the popstate event listener is destroyed so that the 
 *   currentPage value is not decremented and the webpage stil displays the "thankyou" page.
 * - (e) If the bypassPopState flag is set to true, a pre-check prevents this function to be executed.
 * 
 * @param {PopStateEvent} event - The event triggered by pressing the navigation button of the browser.
 * @returns {void}
 */
function handlePopState(event) {

    // (e) Prevent execution of the function if bypassPopState flag is set to true: 
    if (bypassPopState) {
        bypassPopState = false;
        return;
    }

    // (c) Behaviour when the user is on page one and has not activated the consent checkbox:
    const consentIsChecked = consentCheckbox.checked; 
    if (currentPage === 1 && event.state.page === 2 && !consentIsChecked) {
        bypassPopState = true;
        window.history.back();
        return;
    }
    
    // (b) Behaviour when the chatbot interface is opened: 
    const currentlyOpen = (sessionStorage.getItem('openChatbot') === '1');
    if (currentlyOpen && currentPage === chatbotPage) {
        if (event.state.page === chatbotPage - 1) {
            closeChatbotLogic();
            bypassPopState = true;
            window.history.forward();
        } else {
            currentPage++;
            showPage(currentPage);
            saveNavigationState();
        }
        return;
    }

    // (d) Behaviour when the user is on the final page:
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
