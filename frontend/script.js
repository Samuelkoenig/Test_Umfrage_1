document.addEventListener('DOMContentLoaded', function() {
    let currentPage = 1;
    const totalPages = 5;
    const participantID = generateParticipantID();
    const pages = document.querySelectorAll('.page');
    const progressBar = document.getElementById('progress');
    const consentCheckbox = document.getElementById('consent');
    const next1 = document.getElementById('next1');
    const chatbotIframe = document.getElementById('chatbot-iframe');

    // Anzeigen der ersten Seite
    showPage(currentPage);

    // Fortschrittsleiste aktualisieren
    updateProgressBar();

    // Event Listener für den Consent-Checkbox
    consentCheckbox.addEventListener('change', function() {
        next1.disabled = !this.checked;
    });

    // Event Listener für die Navigationsbuttons
    document.querySelectorAll('.next-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                showPage(currentPage);
                updateProgressBar();
            }
        });
    });

    document.querySelectorAll('.back-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                showPage(currentPage);
                updateProgressBar();
            }
        });
    });

    // Absenden-Button
    document.getElementById('submit').addEventListener('click', function() {
        // Daten sammeln
        const data = collectData();
        // Daten an den Server senden
        submitData(data);
        // Danke-Seite anzeigen
        currentPage++;
        showPage('thankyou');
        updateProgressBar();
    });

    // Chatbot iframe src setzen mit Participant-ID
    chatbotIframe.src = `https://europe.webchat.botframework.com/embed/Test_Chatbot_1?s=si-b8q3yFxU.0DqzJZPYL9lkSHvdTIs4jr761v6C7fkSrtBB95hL6EE&userID=${participantID}`;

    // Funktionen
    function showPage(pageNumber) {
        pages.forEach(function(page) {
            page.classList.remove('active');
        });
        if (pageNumber === 'thankyou') {
            document.getElementById('thankyou').classList.add('active');
        } else {
            document.getElementById(`page${pageNumber}`).classList.add('active');
        }
        window.scrollTo(0, 0); // Scrollt nach oben bei Seitenwechsel
    }

    function updateProgressBar() {
        const progress = ((currentPage - 1) / totalPages) * 100;
        progressBar.style.width = `${progress}%`;
    }

    function generateParticipantID() {
        return 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    function collectData() {
        const data = {
            participantID: participantID,
            gender: document.querySelector('input[name="gender"]:checked')?.value || '',
            experience: document.querySelector('input[name="experience"]:checked')?.value || '',
            satisfaction: document.querySelector('input[name="satisfaction"]:checked')?.value || '',
        };
        return data;
    }

    function submitData(data) {
        // AJAX Request an den Server senden
        fetch('/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(function(response) {
            if (response.ok) {
                console.log('Daten erfolgreich gesendet');
            } else {
                console.error('Fehler beim Senden der Daten');
            }
        })
        .catch(function(error) {
            console.error('Netzwerkfehler:', error);
            alert('Netzwerkfehler. Bitte überprüfe deine Verbindung und versuche es erneut.');
        });
    }
});
