/**************************************************************************
 * Definition of variables
 **************************************************************************/

const totalPages = 6;   // To be specified: the actual number of pages in the survey
const chatbotPage = 4;  // To be specified: the page number where the chatbot appears
let currentPage = 1;

let pages;
let progressBar;
let consentCheckbox;
let next1;

let historyStates = [];
let bypassPopState = false;

/**************************************************************************
 * Load and initialize page
 **************************************************************************/

document.addEventListener('DOMContentLoaded', async function () {
    initializeElements();

    if (!sessionStorage.getItem('participantId') || !sessionStorage.getItem('treatmentGroup')) {
        surveyData = await fetchSurveyDataFromServer();
    }
    const participantId = sessionStorage.getItem('participantId') || surveyData.participantId;
    const treatmentGroup = sessionStorage.getItem('treatmentGroup') || surveyData.treatmentGroup;
    sessionStorage.setItem('participantId', participantId);
    sessionStorage.setItem('treatmentGroup', treatmentGroup);
    console.log(`Treatment value: ${treatmentGroup}`); // Nur zum Testen

    restoreState();
    showPage(currentPage);
    updateProgressBar();
    attachEventListeners();

    initializeHistory(currentPage);
    window.addEventListener('popstate', handlePopState);

    //console.log(`Current page: ${currentPage}`); // Nur zum Testen
    //console.log("History States:", historyStates); // Nur zum Testen
    //console.log(window.history.state); // Nur zum Testen

    document.dispatchEvent(new Event('surveyDataInitialized'));
});

function initializeElements() {
    pages = document.querySelectorAll('.page');
    progressBar = document.getElementById('progress');
    consentCheckbox = document.getElementById('consent');
    next1 = document.getElementById('next1');
}

/**************************************************************************
 * Event listeners
 **************************************************************************/

function attachEventListeners() {
    consentCheckbox.addEventListener('change', function () {
        next1.disabled = !this.checked;
        saveState();
    });

    document.querySelectorAll('.next-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            if (currentPage < totalPages - 1) {
                currentPage++;
                showPage(currentPage);
                updateProgressBar();
                saveState();
            }

            if (!historyStates.some(obj => obj.page === currentPage)) {
                pushPageToHistory(currentPage);
              } else {
                bypassPopState = true;
                window.history.forward();
              }
        });
    });

    document.querySelectorAll('.back-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            if (currentPage > 1 && currentPage <= totalPages - 1) {
                currentPage--;
                showPage(currentPage);
                updateProgressBar();
                saveState();

                bypassPopState = true;
                window.history.back();
            }
        });
    });

    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (input) {
        input.addEventListener('change', function() {
            saveState();
        });
    });

    document.getElementById('openChatbotBtn').addEventListener('click', openChatbot);
    document.getElementById('closeChatbotBtn').addEventListener('click', closeChatbot);

    document.getElementById('submit').addEventListener('click', async function () {
        const data = collectData();
        const conversation = sessionStorage.getItem('conversation') || '';
        data.conversation_log = conversation;

        await submitData(data);

        currentPage++;
        showPage(currentPage);
        updateProgressBar();
        saveState()
        clearState();
        pushPageToHistory(currentPage);
    });
}

/**************************************************************************
 * Page display and progress bar
 **************************************************************************/

function showPage(pageNumber) {
    console.log("Aktuelle History States:", historyStates); // Nur zum Testen
    console.log("Current page:", currentPage); // Nur zum Testen
    console.log(window.history.state); // Nur zum Testen
    pages.forEach(page => page.classList.remove('active'));
    if (pageNumber === totalPages) {
        document.getElementById('thankyou').classList.add('active');
    } else {
        document.getElementById(`page${pageNumber}`).classList.add('active');
    }
    window.scrollTo(0, 0);

    if (pageNumber === chatbotPage) {
        let openChatbotState = sessionStorage.getItem('openChatbot');
        if (openChatbotState === null) {
            sessionStorage.setItem('openChatbot', '0');
        }
        applyChatbotViewState();
    } else {
        sessionStorage.setItem('openChatbot', '0');
        applyChatbotViewState();
    }
}

function updateProgressBar() {
    const progress = ((currentPage - 1) / (totalPages - 1)) * 100;
    progressBar.style.width = `${progress}%`;
}

/**************************************************************************
 * Chatbot page
 **************************************************************************/

function applyChatbotViewState() {
    const openChatbot = sessionStorage.getItem('openChatbot') === '1';
    const scenarioDiv = document.getElementById('chatbot-scenario');
    const chatbotInterface = document.getElementById('chatbot-interface');
    const navigation = document.getElementById('chatbot-navigation');
    const openBtnContainer = document.getElementById('open-chatbot-button-container');
    const surveyContainer = document.getElementById('survey-container');

    if (!scenarioDiv || !chatbotInterface || !navigation || !openBtnContainer || !surveyContainer) return;      

    if (openChatbot) {
        scenarioDiv.style.display = 'none';
        chatbotInterface.classList.remove('chatbot-hidden');
        chatbotInterface.classList.add('chatbot-visible');
        navigation.style.display = 'none';
        openBtnContainer.style.display = 'none';
        surveyContainer.classList.add('chatbot-visible');
    } else {
        scenarioDiv.style.display = 'block';
        chatbotInterface.classList.remove('chatbot-visible');
        chatbotInterface.classList.add('chatbot-hidden');
        navigation.style.display = 'flex';
        openBtnContainer.style.display = 'flex';
        surveyContainer.classList.remove('chatbot-visible');
    }
}

function openChatbot() {
    sessionStorage.setItem('openChatbot', '1');
    applyChatbotViewState();
}

function closeChatbot() {
    sessionStorage.setItem('openChatbot', '0');
    applyChatbotViewState();
}

/**************************************************************************
 * Data and metadata management
 **************************************************************************/

function collectData() {
    return {
        participantId: sessionStorage.getItem('participantId'),
        treatmentGroup: sessionStorage.getItem('treatmentGroup'),
        gender: document.querySelector('input[name="gender"]:checked')?.value || '',
        experience: document.querySelector('input[name="experience"]:checked')?.value || '',
        satisfaction: document.querySelector('input[name="satisfaction"]:checked')?.value || ''
    };
}

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

async function fetchSurveyDataFromServer() {
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

function saveState() {
    sessionStorage.setItem('currentPage', currentPage);
    sessionStorage.setItem('historyStates', JSON.stringify(historyStates));
    const genderVal = document.querySelector('input[name="gender"]:checked')?.value || '';
    const experienceVal = document.querySelector('input[name="experience"]:checked')?.value || '';
    const satisfactionVal = document.querySelector('input[name="satisfaction"]:checked')?.value || '';
    const consentVal = consentCheckbox.checked;

    const state = {
        consent: consentVal,
        gender: genderVal,
        experience: experienceVal,
        satisfaction: satisfactionVal
    };
    sessionStorage.setItem('formData', JSON.stringify(state));
}

function restoreState() {
    const savedPage = sessionStorage.getItem('currentPage');
    if (savedPage) {
        currentPage = parseInt(savedPage, 10);
    }
    
    const savedHistoryStates = sessionStorage.getItem('historyStates');
    if (savedHistoryStates) {
        historyStates = JSON.parse(savedHistoryStates);
    }

    const savedData = sessionStorage.getItem('formData');
    if (savedData) {
        const state = JSON.parse(savedData);
        if (state.consent) {
            consentCheckbox.checked = true;
            next1.disabled = false;
        }
        if (state.gender) {
            const genderRadio = document.querySelector(`input[name="gender"][value="${state.gender}"]`);
            if (genderRadio) genderRadio.checked = true;
        }
        if (state.experience) {
            const expRadio = document.querySelector(`input[name="experience"][value="${state.experience}"]`);
            if (expRadio) expRadio.checked = true;
        }
        if (state.satisfaction) {
            const satRadio = document.querySelector(`input[name="satisfaction"][value="${state.satisfaction}"]`);
            if (satRadio) satRadio.checked = true;
        }
    }
}

function clearState() {
    //sessionStorage.clear();
    //sessionStorage.removeItem('currentPage');
    sessionStorage.removeItem('participantId');
    sessionStorage.removeItem('treatmentGroup');
    sessionStorage.removeItem('formData');
    sessionStorage.removeItem('conversation');
    sessionStorage.removeItem('openChatbot');
    resetAllInputs()
}

function resetAllInputs() {
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
        input.checked = false;
    });

    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.value = "";
    });
}

/**************************************************************************
 * History management
 **************************************************************************/

function initializeHistory(page) {
    const stateObj = {page: page};
    historyStates.push(stateObj);
    window.history.replaceState(stateObj, "", "");
}

function pushPageToHistory(page) {
    const stateObj = {page: page};
    historyStates.push(stateObj);
    window.history.pushState(stateObj, "", "");
}

function handlePopState(event) {
    if (bypassPopState) {
        bypassPopState = false;
        return;
    }

    const consentIsChecked = consentCheckbox.checked; 
    if (currentPage === 1 && event.state.page === 2 && !consentIsChecked) {
        bypassPopState = true;
        window.history.back();
        return;
    }
    
    const currentlyOpen = (sessionStorage.getItem('openChatbot') === '1');
    if (currentlyOpen) {
        //console.log("event.state.page:", event.state.page); // Nur zum Testen
        closeChatbot();
        if (event.state.page === chatbotPage - 1) {
            bypassPopState = true;
            window.history.forward();
        } else {
            currentPage++;
            showPage(currentPage);
        }
        updateProgressBar();
        saveState();
        return;
    }

    if (currentPage === totalPages) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
    }

    console.log("event.state.page:", event.state.page); // Nur zum Testen
    if (event.state.page < currentPage) {
        currentPage--;
    } else {
        currentPage++;
    }
    
    showPage(currentPage);
    updateProgressBar();
    saveState();
}
