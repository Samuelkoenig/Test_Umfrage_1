/**
 * @fileoverview This script contains the logic for the mobile view and is executed by the 
 * client in the browser. 
 * @author Samuel König <koenigsamuel99@gmx.de>
 * @version 1.0.0
 */

/**************************************************************************
 * Initialization of variables and mobile device event listeners
 **************************************************************************/

/**
 * Definition of the variables used in the script.
 * - startY @type {number}: The y-coordinate of a touch point. 
 * - activeContainer @type {Element|null}: The DOM element to which a scroll movement refers. 
 * - pageUrl @type {string}: The URL of the page. 
 */
let startY = 0;
let activeContainer = null;
let pageUrl = 'https://studie-sprachverhalten-in-chatbots.de'  // To be specified: The URL of the page. 

/**
 * Adds event listeners to all mobile display-related events.
 * 
 * - The purpose of this function is to improve the view and robustness of the chatbot 
 *   interface on mobile devices. 
 * - Initially checks whether the page is opened in an in-app browser (for example on 
 *   Instagran, LinkedIn or Facebook). If this is the case, an overlay is displayed to 
 *   guide the user to open the page in an external mobile browser. 
 * - When the visual size of the window is changed ('resize' and 'orientationchange' events, 
 *   e.g. by showing or hiding the virtual keyboard or browser bar), the new height of the 
 *   visual area of the window is calculated (using updateVh()) and the chatbot interface is 
 *   re-aligend so that it is displayed fullscreen on mobile devices (using alignChatbotUi()).
 * - The function attachNoBounceListeners() is executed to implement the desired scrolling 
 *   behaviour within the chatbot interface on mobile devices. 
 * - The function updateVh() is executed to initially get the height of the visual window
 *   area. 
 * 
 * @returns {void}
 */
function attachMobileChatbotEventListeners() {

  if (checkInAppBrowser()) showOpenInBrowserBanner();

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

  attachNoBounceListeners();

  updateVh();
}

/**
 * Adds event listeners to scroll events within the chatbot interface.
 * 
 * - Captures every scrolling movement of the user within the chatbot interface on mobile 
 *   devices and executes the functions onTouchStart, onTouchMove and onTouchEnd to ensure 
 *   the desired scrolling behaviour of the chatbot interface on mobile devices. 
 * 
 * @returns {void}
 */
function attachNoBounceListeners() {
  const chatbotInterface = document.getElementById('chatbot-interface');
  chatbotInterface.addEventListener('touchstart', onTouchStart, { passive: false });
  chatbotInterface.addEventListener('touchmove', onTouchMove, { passive: false });
  chatbotInterface.addEventListener('touchend', onTouchEnd, { passive: false });
}

/**************************************************************************
 * Chatbot touch scroll behaviour
 **************************************************************************/

/**
 * Captures the start position of any touch movement by the user. 
 * 
 * - This function is executes when the user starts a touch move. 
 * - Tracks the y-coordinate of the first touch point.
 * - Checks whether the nearest DOM element of the first touch point is the either the 
 *   chatbot-messages-container or the userInput textarea; defines the potentialContainer 
 *   variable either as one of these elements or null otherwise. 
 * - If the potentialContainer is the userInput textarea, checks again whether the first 
 *   touch point is indeed within the boundaries of the message input field; if this is not 
 *   the case sets the potentialContainer variable to null. 
 * - Defines the activeContainer variable as the resulting value of the potentialContainer. 
 * 
 * @param {TouchEvent} e - The touch event object.
 * @returns {void}
 */
function onTouchStart(e) {
  startY = e.touches[0].clientY;

  const scrollableSelector = '.chatbot-messages-container, .input-container textarea';
  let potentialContainer = e.target.closest(scrollableSelector) || null;

  if (potentialContainer && potentialContainer.id === 'userInput') {
    const rect = potentialContainer.getBoundingClientRect();
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    if (touchX < rect.left || touchX > rect.right || touchY < rect.top || touchY > rect.bottom) {
      potentialContainer = null;
    }
  }

  activeContainer = potentialContainer;
}

/**
 * Controls scrolling within the active container. 
 * 
 * - This function is executed when the user moves their finger across the screen. 
 * - The purpose of this function is to prevent overscrolling on mobile devices in the
 *   chatbot interface (e.g. scrolling beyond the virtual keyboard) to ensure a fullscreen
 *   chatbot view. 
 * - (a) If the start of the touch movement is outside the chatbot-messages-container and 
 *   outside the userInput textarea (so when activeContainer is null), scrolling gets 
 *   disabled. 
 * - (b) If the start of the touch movement is inside the userInput textarea, it is checked
 *   whether this input field is permitted for scrolling (this is the case when the number of 
 *   rows of the user message in the input field exceeds the maximum number of rows). 
 *   If the userInput is not permitted for scrolling (textarea.style.overflowY === "hidden"), 
 *   scrolling gets disabled. 
 * - (c) If the start of the touch movement is inside the chatbot-messages-container, it is
 *   checked whether this container is permitted for scrolling (this is the case when the 
 *   total height of this container (scrollHeight) is larger than the visible height 
 *   (cleintHeight)). If the chatbot-messages-container is not permitted for scrolling, 
 *   scrolling gets disabled. 
 * - (d) If the start of the touch move is inside the userInput textarea or the 
 *   chatbot-messages-container, scrolling is enabled. However, when the user is on top of the 
 *   scrollable area and tries to scroll further upwards, or when the user is on the botton of
 *   the scrollable area and tries to scroll further downwards, scrolling is disabled in order 
 *   to prevent the scroll move to be transferred to the parent element. 
 * 
 * @param {TouchEvent} e - The touch event object.
 * @returns {void}
 */
function onTouchMove(e) {
  // (a) Disable scrolling for non-permitted areas:
  if (!activeContainer) {
    e.preventDefault();
    return;
  }

  // (b) Check whether scrolling in the userIpnut is allowed:
  if (activeContainer.id === 'userInput') {
    const textarea = document.getElementById('userInput');
    if (textarea.style.overflowY === "hidden") {
      e.preventDefault();
      return;
    }
  }

  // (c) Check whether scrolling in the chatbot-messages-container is allowed: 
  if (activeContainer.scrollHeight <= activeContainer.clientHeight) {
    e.preventDefault();
    return;
  }

  // (d) Conditionally enable scrolling in permitted areas: 
  const scrollTop = activeContainer.scrollTop;
  const atTop = (scrollTop <= 0);
  const atBottom = (scrollTop + activeContainer.clientHeight >= activeContainer.scrollHeight);
  const currentY = e.touches[0].clientY;
  const deltaY = currentY - startY;
  if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
    e.preventDefault();
  }
}

/**
 * Resets the active container at the end of any touch movement by the user.
 * 
 * - This function is executes when the user finishes a touch move. 
 * - Resets the activeContainer variable at the end of the touch move. 
 * 
 * @param {TouchEvent} e - The touch event object.
 * @returns {void}
 */
function onTouchEnd(e) {
  activeContainer = null;
}

/**************************************************************************
 * Chatbot display adjustements
 **************************************************************************/

/**
 * Updates the visual height (vh) value. 
 * 
 * - The purpose of this function is to update the height of the visible area for the css 
 *   specifications each time this value changes, so that the height of the chatbot interface 
 *   can be dynamically adjusted to the available space. 
 * - Determines the height of the visible area in the browser window. 
 * - Sets the css --vh property to the corresponding height. 
 * 
 * @returns {void}
 */
function updateVh() {
  if (window.visualViewport) {
    const vh = window.visualViewport.height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  } else {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
}

/**
 * Ensures that the chatbot interface is displayed correctly after visual height changes. 
 * 
 * - (a) Standard behaviour: Sets a timeout of 100 milliseconds after a visual height change 
 *   (to ensure that all layout changes are finished), and then initiates an automatic scroll 
 *   to the top of the page and scrolls to the bottom of the message container. 
 * - (b) Fallback: If the chatbot interface is still not aligned on top of the visible area,
 *   the offset is determined and added as an additional margin via the css specification 
 *   translateY to the chatbot-interface and the progress-bar. Additionally, it is scrolled 
 *   to the bottom of the message container. When the chatbot interface is closed, this 
 *   additional margin is resetted to 0. For this operations, the requestAnimationFrame 
 *   function and a timeout are used to ensure that all prior layout changes have been 
 *   finished. 
 * - This function is designed to catch default browser behaviours which are undesired in 
 *   this use case (especially the behaviour of safari and firefox to move a focused textare
 *   element to the center of the visible area). 
 * 
 * @returns {void}
 */
function alignChatbotUi() {
  if (window.visualViewport) {
    const page = parseInt(sessionStorage.getItem('currentPage'), 10);
    const chatbotInterface = document.getElementById('chatbot-interface');
    const progressBar = document.getElementById('progress-bar');

    // (a) Standard behaviour: Scroll to the top of the page:
    if (page === chatbotPage) {
      setTimeout(() => {
        window.scrollTo({
          top: 0
        });
        scrollMessagesToBottom();
      }, 100)
    }

    // (b) Fallback: Set an artificial margin: 
    if (page >= (chatbotPage - 1) && page <= (chatbotPage + 1)) {
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

/**
 * Automatically scrolls to the bottom when the chatbot interface is opened. 
 * 
 * - This function is executed when the chatbot interface is opened in order to trigger a
 *   re-calculation of the height of the visible area. 
 * - After that, the new height of the visible area is determined using the updateVh()
 *   function. 
 * 
 * @returns {void}
 */
function mobileChatbotActivation() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth' 
  });
  updateVh();
}

/**************************************************************************
 * Overlay when the page is opened in an in-app browser
 **************************************************************************/

/**
 * Function to check whether the webpage is opened in an in-app browser
 * 
 * - Returns true if the webpage is opened in an in-app browser and false otherwise. 
 * 
 * @returns {boolean} Whether the client is in an in-app browser
 */
function checkInAppBrowser() {
  const userAgent = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|LinkedIn/.test(userAgent);
}

/**
 * Adds an overlay over the page when it is opened. 
 * 
 * - This function is executed when the client opened the webpage in an in-app
 *   browser. If this is the case, an overlay is added with a button to copy 
 *   copy the url. 
 * - The reason for this is that in-app browsers may be unable to display the 
 *   interactive chatbot interface elements correctly. 
 * 
 * @returns {void}
 */
function showOpenInBrowserBanner() {

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'open-in-browser-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0',
    width: '100%', height: '100%',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '2rem 1rem',
    boxSizing: 'border-box',
    zIndex: '10000'
  });

  // Title
  const header = document.createElement('h1');
  header.textContent = 'Willkommen';
  Object.assign(header.style, {
    margin: '0 0 1rem',
    width: '100%',
    textAlign: 'left'
  });

  // Descriptive content
  const p1 = document.createElement('p');
  p1.innerHTML = `
    Vielen Dank, dass Sie sich die Zeit für meine Studie nehmen. 
    Damit die interaktiven Inhalte der Studie korrekt angezeigt werden können, 
    <b>öffnen Sie die Studie bitte im Browser.</b> 
    Gehen Sie dazu bitte auf die <b>drei Punkte und klicken auf "Öffnen mit ..." bzw. "Im Browser öffnen"</b>.
  `;
  Object.assign(p1.style, {
    margin: '0 0 1rem',
    textAlign: 'left',
    lineHeight: '1.6',
    maxWidth: '100%'
  });
  const p2 = document.createElement('p');
  p2.innerHTML = `
    Alternativ können Sie die <b>URL kopieren und in der Adresszeile ihres mobilen Browsers einfügen:</b>
  `;
  Object.assign(p2.style, {
    margin: '0 0 1.5rem',
    textAlign: 'left',
    lineHeight: '1.6',
    maxWidth: '100%'
  });
  const p3 = document.createElement('p');
  p3.textContent = pageUrl;
  Object.assign(p3.style, {
    margin: '0 0 1.5rem',
    textAlign: 'left',
    lineHeight: '1.6',
    maxWidth: '100%'
  });

  // Button for copying the URL
  const button = document.createElement('button');
  button.className = 'next-btn';
  button.style.alignSelf = 'center';
  button.textContent = 'URL kopieren';
  button.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        button.textContent = 'Kopiert!';
        setTimeout(() => { button.textContent = 'URL kopieren'; }, 2000);
      })
      .catch(() => {
        button.textContent = 'Fehler beim Kopieren';
      });
  });

  overlay.appendChild(header);
  overlay.appendChild(p1);
  overlay.appendChild(p2);
  overlay.appendChild(p3);
  overlay.appendChild(button);
  document.body.appendChild(overlay);
}
