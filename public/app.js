(function() {
  'use strict';

  var elements = {};

  var sarcasticMessages = [
    'KEYBOARD.VXD: Keystroke logged and discarded.',
    'VHUMANITY.VXD: Free will driver not responding.',
    'Exception 0E in HOPE.VXD: Optimism stack overflow.',
    'VREASON.VXD has performed an illegal operation.',
    'Cannot find COMMONSENSE.DLL. Humanity continues anyway.',
    'CTRL+ALT+DEL: Insufficient karma to restart civilization.',
    'General Protection Fault in module EMPATHY.VXD.',
    'This program has performed an illegal operation and will be blamed on someone else.',
    'VLOGIC.VXD: Cannot process request. Too much cognitive dissonance.',
    'Warning: DENIAL.SYS is using 99% of available resources.',
    'Fatal exception in PROGRESS.VXD: Humanity moving backwards.',
    'VMEMORY.VXD: Unable to learn from history. Buffer full.',
    'Invalid page fault in ATTENTION_SPAN.VXD at 0000:00000005.',
    'EGO.VXD has caused an error in SELF_AWARENESS.VXD.',
    'The system is busy waiting for humanity to get its act together.'
  ];

  var countdownInterval = null;
  var expiresAt = null;
  var isRebooting = false;
  var isWaitingForCron = false;
  var sarcasticTimeout = null;
  var secretKeysPressed = {};
  var secretSequenceActive = false;
  var secretCheckTimeout = null;

  function initElements() {
    elements.errorCode = document.getElementById('error-code');
    elements.errorAddress = document.getElementById('error-address');
    elements.errorVxd = document.getElementById('error-vxd');
    elements.errorOffset = document.getElementById('error-offset');
    elements.errorMessage = document.getElementById('error-message');
    elements.countdown = document.getElementById('countdown');
    elements.bsod = document.querySelector('.bsod');
    elements.sarcasticOverlay = document.getElementById('sarcastic-overlay');
    elements.sarcasticMessage = document.getElementById('sarcastic-message');
    elements.shutdownScreen = document.getElementById('shutdown-screen');
    elements.blackScreen = document.getElementById('black-screen');
    elements.bootScreen = document.getElementById('boot-screen');
    elements.bootProgressBar = document.getElementById('boot-progress-bar');
    elements.shellScreen = document.getElementById('shell-screen');
    elements.shellContent = document.getElementById('shell-content');
    elements.bootTagline = document.getElementById('boot-tagline');
  }

  function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function getRemainingSeconds() {
    if (!expiresAt) return 0;
    var now = Date.now();
    var remaining = Math.floor((expiresAt - now) / 1000);
    return Math.max(0, remaining);
  }

  function updateCountdown() {
    var remaining = getRemainingSeconds();
    elements.countdown.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      localStorage.removeItem('humanity-bsod-cache');
      waitForNewData();
    }
  }

  function waitForNewData() {
    if (isWaitingForCron || isRebooting) return;
    isWaitingForCron = true;

    var pollStartTime = Date.now();
    var maxPollDuration = 2 * 60 * 1000;

    elements.bsod.style.display = 'none';
    elements.blackScreen.classList.remove('hidden');

    setTimeout(function() {
      elements.blackScreen.classList.add('hidden');
      elements.bootScreen.classList.remove('hidden');
      if (elements.bootTagline) elements.bootTagline.textContent = 'Waiting for CRON.VXD...';
      if (elements.bootProgressBar) elements.bootProgressBar.style.width = '90%';

      pollForCachedData(pollStartTime, maxPollDuration);
    }, 500);
  }

  function pollForCachedData(startTime, maxDuration) {
    fetch('/api/generate')
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP error');
        return response.json();
      })
      .then(function(data) {
        if (data.error) throw new Error(data.error);

        var elapsed = Date.now() - startTime;

        if (data.cached) {
          finishWaitingForCron(data);
        } else if (elapsed >= maxDuration) {
          finishWaitingForCron(data);
        } else {
          setTimeout(function() {
            pollForCachedData(startTime, maxDuration);
          }, 5000);
        }
      })
      .catch(function() {
        var elapsed = Date.now() - startTime;
        if (elapsed >= maxDuration) {
          finishWaitingForCron(null);
        } else {
          setTimeout(function() {
            pollForCachedData(startTime, maxDuration);
          }, 5000);
        }
      });
  }

  function finishWaitingForCron(data) {
    if (elements.bootProgressBar) elements.bootProgressBar.style.width = '100%';
    if (elements.bootTagline) elements.bootTagline.textContent = 'Rebooting civilization...';

    setTimeout(function() {
      elements.bootScreen.classList.add('hidden');
      if (elements.bootProgressBar) elements.bootProgressBar.style.width = '0%';
      elements.bsod.style.display = '';
      isWaitingForCron = false;
      if (data) {
        updateBSOD(data);
      } else {
        fetchBSOD();
      }
    }, 800);
  }

  function startCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  function cacheData(data) {
    try {
      localStorage.setItem('humanity-bsod-cache', JSON.stringify(data));
    } catch (e) {}
  }

  function updateBSOD(data) {
    var bsod = data.bsod;
    elements.errorCode.textContent = bsod.errorCode;
    elements.errorAddress.textContent = bsod.address;
    elements.errorVxd.textContent = bsod.vxd;
    elements.errorOffset.textContent = bsod.offset || '00000000';
    elements.errorMessage.textContent = bsod.message;
    expiresAt = new Date(data.expiresAt).getTime();

    var remaining = Math.floor((expiresAt - Date.now()) / 1000);
    if (remaining <= 5) {
      elements.bsod.classList.remove('loading');
      elements.bsod.classList.remove('error-state');
      setTimeout(fetchBSOD, 2000);
      return;
    }

    cacheData(data);
    elements.bsod.classList.remove('loading');
    elements.bsod.classList.remove('error-state');
    startCountdown();
  }

  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.bsod.classList.add('error-state');
    elements.bsod.classList.remove('loading');
    setTimeout(fetchBSOD, 30000);
  }

  function fetchBSOD() {
    elements.bsod.classList.add('loading');
    fetch('/api/generate')
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (data.error) throw new Error(data.error);
        updateBSOD(data);
      })
      .catch(function(error) {
        showError('SYSTEM_FETCH_ERROR: Unable to connect to HUMANITY.SYS - ' + error.message);
      });
  }

  function getCachedData() {
    var cached = localStorage.getItem('humanity-bsod-cache');
    if (!cached) return null;
    try {
      var data = JSON.parse(cached);
      var now = Date.now();
      var expires = new Date(data.expiresAt).getTime();
      if (expires > now) return data;
    } catch (e) {
      localStorage.removeItem('humanity-bsod-cache');
    }
    return null;
  }

  function showSarcasticMessage() {
    if (sarcasticTimeout) clearTimeout(sarcasticTimeout);
    var randomMessage = sarcasticMessages[Math.floor(Math.random() * sarcasticMessages.length)];
    elements.sarcasticMessage.textContent = randomMessage;
    elements.sarcasticOverlay.classList.add('visible');
    sarcasticTimeout = setTimeout(function() {
      elements.sarcasticOverlay.classList.remove('visible');
    }, 2000);
  }

  function simulateReboot() {
    if (isRebooting) return;
    isRebooting = true;

    var cachedData = getCachedData();
    var fetchedData = null;
    var fetchComplete = false;
    var progressReady = false;

    if (!cachedData) {
      fetch('/api/generate')
        .then(function(response) {
          if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
          return response.json();
        })
        .then(function(data) {
          if (data.error) throw new Error(data.error);
          fetchedData = data;
          fetchComplete = true;
          checkReady();
        })
        .catch(function() {
          fetchComplete = true;
          checkReady();
        });
    } else {
      fetchComplete = true;
    }

    function checkReady() {
      if (fetchComplete && progressReady) finishBoot();
    }

    function finishBoot() {
      if (elements.bootProgressBar) elements.bootProgressBar.style.width = '100%';
      setTimeout(function() {
        elements.bootScreen.classList.add('hidden');
        if (elements.bootProgressBar) elements.bootProgressBar.style.width = '0%';
        elements.bsod.style.display = '';
        isRebooting = false;
        if (cachedData) updateBSOD(cachedData);
        else if (fetchedData) updateBSOD(fetchedData);
        else fetchBSOD();
      }, 800);
    }

    elements.bsod.style.display = 'none';
    elements.blackScreen.classList.remove('hidden');

    setTimeout(function() {
      elements.blackScreen.classList.add('hidden');
      elements.bootScreen.classList.remove('hidden');
      if (elements.bootProgressBar) elements.bootProgressBar.style.width = '0%';

      var progress = 0;
      var progressInterval = setInterval(function() {
        progress += Math.random() * 8 + 2;
        if (progress >= 90) {
          progress = 90;
          clearInterval(progressInterval);
          progressReady = true;
          checkReady();
        }
        if (elements.bootProgressBar) elements.bootProgressBar.style.width = progress + '%';
      }, 200);
    }, 500);
  }

  var shellMessage = null;

  function typeText(text, element, className, charDelay, callback) {
    var index = 0;
    var span = document.createElement('span');
    span.className = className;
    element.appendChild(span);

    function typeChar() {
      if (index < text.length) {
        span.textContent += text.charAt(index);
        index++;
        elements.shellScreen.scrollTop = elements.shellScreen.scrollHeight;
        setTimeout(typeChar, charDelay);
      } else if (callback) {
        callback();
      }
    }
    typeChar();
  }

  function typeLabelAndText(label, text, element, labelClass, textClass, charDelay, callback) {
    if (label) {
      var labelSpan = document.createElement('span');
      labelSpan.className = labelClass;
      labelSpan.textContent = label;
      element.appendChild(labelSpan);
    }
    typeText(text, element, textClass, charDelay, callback);
  }

  function showRebootCountdown(seconds, callback) {
    var countdownSpan = document.createElement('span');
    countdownSpan.className = 'system-msg';
    elements.shellContent.appendChild(countdownSpan);

    function tick() {
      if (seconds > 0) {
        countdownSpan.textContent = 'Rebooting in ' + seconds + '...\n';
        elements.shellScreen.scrollTop = elements.shellScreen.scrollHeight;
        seconds--;
        setTimeout(tick, 1000);
      } else {
        countdownSpan.textContent = 'Rebooting now...\n';
        elements.shellScreen.scrollTop = elements.shellScreen.scrollHeight;
        setTimeout(callback, 500);
      }
    }
    tick();
  }

  function verifyAndFetchMessage(keys, callback) {
    fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys })
    })
      .then(function(response) {
        if (response.status === 403) {
          callback(false, true);
          return null;
        }
        if (!response.ok) throw new Error('Failed to load message');
        return response.json();
      })
      .then(function(data) {
        if (data) {
          shellMessage = data.message;
          callback(true, false);
        }
      })
      .catch(function() {
        callback(false, false);
      });
  }

  function trySecretSequence(keys) {
    if (secretSequenceActive || isRebooting) return;
    secretSequenceActive = true;

    verifyAndFetchMessage(keys, function(success, wrongCombo) {
      if (wrongCombo || !success || !shellMessage) {
        secretSequenceActive = false;
        return;
      }

      isRebooting = true;
      if (countdownInterval) clearInterval(countdownInterval);

      elements.bsod.style.display = 'none';
      elements.shellContent.innerHTML = '';
      elements.shellScreen.classList.remove('hidden');

      var messageIndex = 0;

      function typeNextMessage() {
        if (messageIndex < shellMessage.length) {
          var msg = shellMessage[messageIndex];
          var textClass = msg.type + '-msg';
          var labelClass = 'label-' + msg.type;
          var delay = msg.type === 'dots' ? 150 : (msg.type === 'poem' ? 40 : 50);

          typeLabelAndText(msg.label, msg.text, elements.shellContent, labelClass, textClass, delay, function() {
            messageIndex++;
            var pauseTime = msg.type === 'dots' ? 1500 : (msg.type === 'poem' ? 1000 : 500);
            setTimeout(typeNextMessage, pauseTime);
          });
        } else {
          showRebootCountdown(10, function() {
            elements.shellScreen.classList.add('hidden');
            secretSequenceActive = false;
            isRebooting = false;
            simulateReboot();
          });
        }
      }

      setTimeout(typeNextMessage, 500);
    });
  }

  function handleKeydown(event) {
    if (isRebooting || isWaitingForCron) return;

    var key = event.key.toLowerCase();

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      simulateReboot();
      return;
    }

    if (event.key === 'Control' || event.key === 'Alt' || event.key === 'Shift' || event.key === 'Meta') {
      return;
    }

    if (key.length === 1 && key >= 'a' && key <= 'z') {
      secretKeysPressed[key] = true;
      if (secretCheckTimeout) clearTimeout(secretCheckTimeout);

      var pressedKeys = Object.keys(secretKeysPressed).filter(function(k) {
        return secretKeysPressed[k];
      });

      if (pressedKeys.length >= 4) {
        secretCheckTimeout = setTimeout(function() {
          trySecretSequence(pressedKeys);
        }, 100);
        return;
      }
    }

    showSarcasticMessage();
  }

  function handleKeyup(event) {
    var key = event.key.toLowerCase();
    if (key.length === 1 && key >= 'a' && key <= 'z') {
      secretKeysPressed[key] = false;
    }
  }

  function isFirstVisit() {
    return !localStorage.getItem('humanity-visited');
  }

  function markVisited() {
    localStorage.setItem('humanity-visited', 'true');
  }

  function initialBoot() {
    isRebooting = true;

    if (elements.bootTagline) elements.bootTagline.textContent = 'Booting civilization...';
    elements.bsod.style.display = 'none';

    var fetchedData = null;
    var fetchComplete = false;
    var progressReady = false;

    fetch('/api/generate')
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (data.error) throw new Error(data.error);
        fetchedData = data;
        fetchComplete = true;
        checkReady();
      })
      .catch(function() {
        fetchComplete = true;
        checkReady();
      });

    function checkReady() {
      if (fetchComplete && progressReady) finishBoot();
    }

    function finishBoot() {
      if (elements.bootProgressBar) elements.bootProgressBar.style.width = '100%';

      setTimeout(function() {
        elements.bootScreen.classList.add('hidden');
        if (elements.bootProgressBar) elements.bootProgressBar.style.width = '0%';
        if (elements.bootTagline) elements.bootTagline.textContent = 'Rebooting civilization...';

        elements.bsod.style.display = '';
        isRebooting = false;

        if (fetchedData) updateBSOD(fetchedData);
        else fetchBSOD();

        markVisited();
      }, 800);
    }

    elements.bootScreen.classList.remove('hidden');
    if (elements.bootProgressBar) elements.bootProgressBar.style.width = '0%';

    var progress = 0;
    var progressInterval = setInterval(function() {
      progress += Math.random() * 8 + 2;
      if (progress >= 90) {
        progress = 90;
        clearInterval(progressInterval);
        progressReady = true;
        checkReady();
      }
      if (elements.bootProgressBar) elements.bootProgressBar.style.width = progress + '%';
    }, 200);
  }

  function init() {
    initElements();

    if (isFirstVisit()) {
      initialBoot();
    } else {
      var cachedData = getCachedData();
      if (cachedData) updateBSOD(cachedData);
      else fetchBSOD();
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('keyup', handleKeyup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
