/**
 * @fileoverview This script contains the logic for the mobile view and is executed by the 
 * client in the browser. 
 * @author Samuel König <koenigsamuel99@gmx.de>
 * @version 1.0.0
 */

/**************************************************************************
 * Initialization of mobile device event listeners
 **************************************************************************/

function attachMobileChatbotEventListeners() {
  //const textarea = document.getElementById('userInput');

  window.addEventListener('resize', () => {
    updateVh();
    alignChatbotUi();
  });

  window.addEventListener('orientationchange', () => {
    updateVh();
    alignChatbotUi();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      updateVh();
      alignChatbotUi();
    });
  }

  /*textarea.addEventListener('focus', () => {
    window.scrollTo(0, 0);
    scrollMessagesToBottom();
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 50);
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 100);
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 200);
    setTimeout(() => { window.scrollTo(0,0); scrollMessagesToBottom() }, 300);
  });*/

  attachNoBounceListeners();

  updateVh();
}

// An dein #chatbot-interface anhängen, z. B.:
function attachNoBounceListeners() {
  const chatbotInterface = document.getElementById('chatbot-interface');
  chatbotInterface.addEventListener('touchstart', onTouchStart, { passive: false });
  chatbotInterface.addEventListener('touchmove', onTouchMove, { passive: false });
  chatbotInterface.addEventListener('touchend', onTouchEnd, { passive: false });
}

/**************************************************************************
 * Touch scroll behaviour
 **************************************************************************/

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

/**************************************************************************
 * 
 **************************************************************************/

function updateVh() {
  if (window.visualViewport) {
    const vh = window.visualViewport.height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  } else {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
}

function alignChatbotUi() {
  if (window.visualViewport) {
    const currentlyOpenCopy = (sessionStorage.getItem('openChatbot') === '1');
    const page = parseInt(sessionStorage.getItem('currentPage'), 10);
    const chatbotInterface = document.getElementById('chatbot-interface');
    const progressBar = document.getElementById('progress-bar');

    if ((page === chatbotPage) && currentlyOpenCopy) {
      setTimeout(() => {
        window.scrollTo({
          top: 0
        });
        scrollMessagesToBottom();
      }, 100)
    }

    if ((page === chatbotPage) && currentlyOpenCopy) {
      window.requestAnimationFrame(() => {
        setTimeout(() => {
          const offset = window.visualViewport.offsetTop;
          chatbotInterface.style.transform = `translateY(${offset}px)`;
          progressBar.style.transform = `translateY(${offset}px)`;
          scrollMessagesToBottom();
        }, 100)
      })
    } else {
      window.requestAnimationFrame(() => {
        setTimeout(() => {
          chatbotInterface.style.transform = `translateY(0px)`;
          progressBar.style.transform = `translateY(0px)`;
      }, 100)
      })
    }

  }
}

/*
function alignChatbotUi() {
  if (window.visualViewport) {
    const currentlyOpenCopy = (sessionStorage.getItem('openChatbot') === '1');
    const page = parseInt(sessionStorage.getItem('currentPage'), 10);
    const chatbotInterface = document.getElementById('chatbot-interface');
    const progressBar = document.getElementById('progress-bar');

    window.requestAnimationFrame(() => { 
      setTimeout(() => {

        //addMessage(`Offset: ${offset})`, 'user') //Nur zum Testen
        if ((page === chatbotPage) && currentlyOpenCopy) {
          
          window.scrollTo({
            top: 0
          });
          
          //const offset = window.visualViewport.offsetTop;
          //chatbotInterface.style.transform = `translateY(${offset}px)`;
          //progressBar.style.transform = `translateY(${offset}px)`;
          
          /*inputTest = document.getElementById('userInput');
          if (inputTest.matches(':focus')) {
            window.requestAnimationFrame(() => {
              document.getElementById('userInput').focus()
            })
          }*/

          /*setTimeout(() => {
            progressBar.scrollIntoView({
              behavior: 'smooth'
            }, 200)
          })*/ /*

          scrollMessagesToBottom();
        } else {
          //chatbotInterface.style.transform = `translateY(0px)`;
          //progressBar.style.transform = `translateY(0px)`;
        }

      }, 100)
      
    });



    /*setTimeout(() => { 
      const offset = window.visualViewport.offsetTop;
      if ((page === chatbotPage) && currentlyOpenCopy) {
        chatbotInterface.style.transform = `translateY(${offset}px)`;
        progressBar.style.transform = `translateY(${offset}px)`;
        inputTest = document.getElementById('userInput');
        if (inputTest.matches(':focus')) {
          window.requestAnimationFrame(() => {
            document.getElementById('userInput').focus()
          })
        }
        //document.getElementById('userInput').focus();
        //chatbotInterface.offsetHeight;
        scrollMessagesToBottom();
      } else {
        chatbotInterface.style.transform = `translateY(0px)`;
        progressBar.style.transform = `translateY(0px)`;
      }
    }, 200);*/ /*
  } 
} */


