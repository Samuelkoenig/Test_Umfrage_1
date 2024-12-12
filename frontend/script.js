document.addEventListener('DOMContentLoaded', async function() {
    let currentPage = 1;
    const totalPages = 5;
    const pages = document.querySelectorAll('.page');
    const progressBar = document.getElementById('progress');
    const consentCheckbox = document.getElementById('consent');
    const next1 = document.getElementById('next1');
    const chatbotIframe = document.getElementById('chatbot-iframe');

    let participantID = sessionStorage.getItem('participantID');

    if (!participantID) {
        participantID = await fetchParticipantIDFromServer();
        sessionStorage.setItem('participantID', participantID);
    }

    restoreState();
    showPage(currentPage);
    updateProgressBar();

    const secret = await fetchSecret();
    if (secret) {
        chatbotIframe.src = `https://webchat.botframework.com/embed/Test_Chatbot_1?s=${secret}&userID=${participantID}`;
    }

    consentCheckbox.addEventListener('change', function() {
        next1.disabled = !this.checked;
        saveState();
    });

    document.querySelectorAll('.next-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                showPage(currentPage);
                updateProgressBar();
                saveState();
            }
        });
    });

    document.querySelectorAll('.back-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            if (currentPage > 1 && currentPage <= totalPages) {
                currentPage--;
                showPage(currentPage);
                updateProgressBar();
                saveState();
            }
        });
    });

    document.getElementById('submit').addEventListener('click', async function() {
        const data = collectData();
        await submitData(data);
        currentPage++;
        showPage('thankyou');
        updateProgressBar();
        sessionStorage.clear();
    });

    function showPage(pageNumber) {
        pages.forEach(page => page.classList.remove('active'));
        if (pageNumber === 'thankyou') {
            document.getElementById('thankyou').classList.add('active');
        } else {
            document.getElementById(`page${pageNumber}`).classList.add('active');
        }
        window.scrollTo(0, 0);
    }

    function updateProgressBar() {
        const progress = ((currentPage - 1) / totalPages) * 100;
        progressBar.style.width = `${progress}%`;
    }

    function collectData() {
        return {
            participantID: participantID,
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

    async function fetchParticipantIDFromServer() {
        const response = await fetch('/generateParticipantId');
        const json = await response.json();
        return json.participantID;
    }

    async function fetchSecret() {
        const response = await fetch('/config');
        const json = await response.json();
        return json.secret;
    }

    function saveState() {
        sessionStorage.setItem('currentPage', currentPage);
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
});
