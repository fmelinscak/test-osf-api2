/**
 * app.js — OSF Submission App
 *
 * Handles:
 *  - OAuth 2.0 implicit-flow login/logout with CSRF-state verification
 *  - Fetching the authenticated user's profile from the OSF JSON-API
 *  - Uploading a JSON submission file to OSF project storage via WaterButler
 */
(function () {
  'use strict';

  // sessionStorage keys
  var TOKEN_KEY = 'osf_access_token';
  var STATE_KEY  = 'osf_oauth_state';

  // ── Token helpers ─────────────────────────────────────────────────────────

  function getToken()        { return sessionStorage.getItem(TOKEN_KEY); }
  function setToken(t)       { sessionStorage.setItem(TOKEN_KEY, t); }
  function clearSession()    {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(STATE_KEY);
  }

  // ── Misc helpers ──────────────────────────────────────────────────────────

  function randomHex(len) {
    var arr = new Uint8Array(len);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('').slice(0, len);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function currentPageUrl() {
    return window.location.origin + window.location.pathname;
  }

  // ── OAuth 2.0 implicit flow ───────────────────────────────────────────────

  function startLogin() {
    var state = randomHex(16);
    sessionStorage.setItem(STATE_KEY, state);

    var url = new URL(CONFIG.OSF_AUTH_URL);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('client_id',     CONFIG.OSF_CLIENT_ID);
    url.searchParams.set('redirect_uri',  currentPageUrl());
    url.searchParams.set('scope',         CONFIG.OSF_SCOPES);
    url.searchParams.set('state',         state);

    window.location.href = url.toString();
  }

  /**
   * Parse the URL fragment after OSF redirects back.
   * Returns the access_token string, or null if absent / state mismatch.
   */
  function consumeOAuthCallback() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return null;

    var params        = new URLSearchParams(hash.slice(1));
    var token         = params.get('access_token');
    var returnedState = params.get('state');
    if (!token) return null;

    var savedState = sessionStorage.getItem(STATE_KEY);
    if (!savedState || savedState !== returnedState) {
      showStatus(
        'Authentication failed: state parameter mismatch. Please try again.',
        'error'
      );
      return null;
    }

    setToken(token);
    // Remove the fragment from the URL so the token is not visible / bookmarked
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return token;
  }

  // ── OSF API calls ─────────────────────────────────────────────────────────

  function apiFetch(url, options) {
    options = options || {};
    options.headers = Object.assign(
      {
        'Authorization': 'Bearer ' + getToken(),
        'Accept':        'application/vnd.api+json',
      },
      options.headers || {}
    );
    return fetch(url, options);
  }

  /** GET /users/me/ — returns the JSONAPI data object for the current user */
  function fetchCurrentUser() {
    return apiFetch(CONFIG.OSF_API_URL + '/users/me/').then(function (res) {
      if (!res.ok) {
        throw new Error('Could not fetch user profile (HTTP ' + res.status + ').');
      }
      return res.json();
    }).then(function (body) {
      return body.data;
    });
  }

  /**
   * Upload a JSON file to the project's OSF Storage root via WaterButler.
   * The filename encodes the user's OSF ID and a timestamp so that each
   * submission is unique and cannot accidentally overwrite another user's file.
   */
  function uploadSubmission(userId, payload) {
    var ts       = new Date().toISOString().replace(/[:.]/g, '-');
    var filename = 'submission_' + userId + '_' + ts + '.json';
    var body     = JSON.stringify(payload, null, 2);

    var url = (
      CONFIG.OSF_FILES_URL
      + '/resources/' + CONFIG.OSF_PROJECT_ID
      + '/providers/osfstorage/?kind=file&name='
      + encodeURIComponent(filename)
    );

    return apiFetch(url, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    body,
    }).then(function (res) {
      if (res.status !== 200 && res.status !== 201) {
        return res.text().then(function (text) {
          throw new Error('Upload failed (HTTP ' + res.status + '): ' + text);
        });
      }
      return res.json();
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  var el = {}; // cached DOM element references

  function cacheElements() {
    el.configError     = document.getElementById('config-error');
    el.authSection     = document.getElementById('auth-section');
    el.formSection     = document.getElementById('form-section');
    el.loginBtn        = document.getElementById('login-btn');
    el.logoutBtn       = document.getElementById('logout-btn');
    el.userDisplayName = document.getElementById('user-display-name');
    el.form            = document.getElementById('submission-form');
    el.submitBtn       = document.getElementById('submit-btn');
    el.nameInput       = document.getElementById('name-input');
    el.ageInput        = document.getElementById('age-input');
    el.statusSection   = document.getElementById('status-section');
  }

  function showStatus(message, type) {
    var cls = type === 'success' ? 'alert-success'
            : type === 'info'    ? 'alert-info'
            :                      'alert-error';
    el.statusSection.innerHTML =
      '<div class="alert ' + cls + '">' + escapeHtml(message) + '</div>';
  }

  function clearStatus() {
    el.statusSection.innerHTML = '';
  }

  function showLoginUI() {
    el.authSection.classList.remove('hidden');
    el.formSection.classList.add('hidden');
  }

  function showFormUI(displayName) {
    el.authSection.classList.add('hidden');
    el.formSection.classList.remove('hidden');
    el.userDisplayName.textContent = displayName;
  }

  // ── Application state ─────────────────────────────────────────────────────

  var currentUserId = null;

  function loadUserSession() {
    fetchCurrentUser()
      .then(function (user) {
        currentUserId = user.id;
        var name = (user.attributes && user.attributes.full_name)
          || (user.attributes && user.attributes.login)
          || user.id;
        showFormUI(name);
      })
      .catch(function () {
        // Token may be expired or invalid
        clearSession();
        showLoginUI();
        showStatus('Your session has expired. Please log in again.', 'error');
      });
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function onLoginClick() {
    startLogin();
  }

  function onLogoutClick() {
    clearSession();
    currentUserId = null;
    el.form.reset();
    showLoginUI();
    clearStatus();
  }

  function onFormSubmit(evt) {
    evt.preventDefault();

    var name = el.nameInput.value.trim();
    var age  = parseInt(el.ageInput.value, 10);

    // Client-side validation
    var valid = true;
    el.nameInput.classList.remove('invalid');
    el.ageInput.classList.remove('invalid');

    if (!name) {
      el.nameInput.classList.add('invalid');
      valid = false;
    }
    if (isNaN(age) || age < 0 || age > 150) {
      el.ageInput.classList.add('invalid');
      valid = false;
    }
    if (!valid) {
      showStatus('Please correct the highlighted fields and try again.', 'error');
      return;
    }

    if (!getToken()) {
      showStatus('No active session. Please log in first.', 'error');
      return;
    }

    el.submitBtn.disabled = true;
    showStatus('Submitting…', 'info');

    var payload = {
      name:        name,
      age:         age,
      submitted_at: new Date().toISOString(),
      osf_user_id: currentUserId,
    };

    uploadSubmission(currentUserId, payload)
      .then(function () {
        showStatus('Your submission was saved successfully. Thank you!', 'success');
        el.form.reset();
      })
      .catch(function (err) {
        showStatus('Submission failed: ' + err.message, 'error');
      })
      .then(function () {
        // always re-enable the button (finally-equivalent for older browsers)
        el.submitBtn.disabled = false;
      });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    cacheElements();

    // Guard: configuration placeholders not replaced yet
    if (
      CONFIG.OSF_PROJECT_ID === 'YOUR_PROJECT_ID' ||
      CONFIG.OSF_CLIENT_ID  === 'YOUR_CLIENT_ID'
    ) {
      el.configError.classList.remove('hidden');
      el.loginBtn.disabled = true;
      return;
    }

    // Wire up event listeners
    el.loginBtn.addEventListener('click',  onLoginClick);
    el.logoutBtn.addEventListener('click', onLogoutClick);
    el.form.addEventListener('submit',     onFormSubmit);

    // Handle OAuth redirect-back (token in URL fragment)
    consumeOAuthCallback();

    // If we have a token (either just received or from a previous page load),
    // fetch the user's profile and show the form.
    if (getToken()) {
      loadUserSession();
    } else {
      showLoginUI();
    }
  });
})();
