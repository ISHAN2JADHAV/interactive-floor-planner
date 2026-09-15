/**
 * FloorPlan Pro - Authentication & User Session Manager
 * Handles aesthetic login modal, demo credentials, persistent session token,
 * profile dropdown, role switching, and saved projects synchronization.
 */

(function () {
  'use strict';

  // --- State & Storage Keys ---
  const STORAGE_KEY_TOKEN = 'fp_auth_token';
  const STORAGE_KEY_USER = 'fp_auth_user';

  let currentUser = null;
  let authToken = null;
  let activeTab = 'login'; // 'login' | 'register'

  // --- DOM Elements ---
  const modalAuthPortal = document.getElementById('modal-auth-portal');
  const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
  const tabAuthLogin = document.getElementById('tab-auth-login');
  const tabAuthRegister = document.getElementById('tab-auth-register');
  const authForm = document.getElementById('auth-form');
  const groupAuthName = document.getElementById('group-auth-name');
  const groupAuthRole = document.getElementById('group-auth-role');
  const authNameInput = document.getElementById('auth-name-input');
  const authEmailInput = document.getElementById('auth-email-input');
  const authPasswordInput = document.getElementById('auth-password-input');
  const btnTogglePassword = document.getElementById('btn-toggle-password');
  const btnForgotPassword = document.getElementById('btn-forgot-password');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const authSubmitText = document.getElementById('auth-submit-text');
  const authAlert = document.getElementById('auth-alert');
  const btnGuestContinue = document.getElementById('btn-guest-continue');
  const demoProfilesContainer = document.getElementById('demo-profiles-container');

  // Header Elements
  const userProfileBtn = document.getElementById('user-profile-btn');
  const btnHeaderLogin = document.getElementById('btn-header-login');
  const userProfileDropdown = document.getElementById('user-profile-dropdown');
  const headerUserAvatar = document.getElementById('header-user-avatar');
  const headerUserInitials = document.getElementById('header-user-initials');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserRole = document.getElementById('header-user-role');
  const dropdownUserAvatar = document.getElementById('dropdown-user-avatar');
  const dropdownUserName = document.getElementById('dropdown-user-name');
  const dropdownUserEmail = document.getElementById('dropdown-user-email');
  const dropdownUserRole = document.getElementById('dropdown-user-role');
  const headerRoleSelector = document.getElementById('header-role-selector');
  const savedProjectsList = document.getElementById('saved-projects-list');
  const btnOpenLoginModal = document.getElementById('btn-open-login-modal');
  const btnLogout = document.getElementById('btn-logout');

  // Helpers
  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      const container = document.getElementById('toast-container');
      if (container) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    }
  }

  function playSound(name) {
    if (typeof window.playUiSound === 'function') {
      window.playUiSound(name);
    }
  }

  // --- Modal Open / Close ---
  function openAuthModal(tab = 'login') {
    if (!modalAuthPortal) return;
    setTab(tab);
    clearAlert();
    modalAuthPortal.style.display = 'flex';
    modalAuthPortal.classList.add('fade-in');
    playSound('click');
  }

  function closeAuthModal() {
    if (!modalAuthPortal) return;
    modalAuthPortal.style.display = 'none';
    clearAlert();
  }

  function setTab(tab) {
    activeTab = tab;
    if (tab === 'login') {
      tabAuthLogin.classList.add('active');
      tabAuthRegister.classList.remove('active');
      if (groupAuthName) groupAuthName.style.display = 'none';
      if (groupAuthRole) groupAuthRole.style.display = 'none';
      if (authSubmitText) authSubmitText.textContent = 'Enter Spatial Studio';
    } else {
      tabAuthLogin.classList.remove('active');
      tabAuthRegister.classList.add('active');
      if (groupAuthName) groupAuthName.style.display = 'block';
      if (groupAuthRole) groupAuthRole.style.display = 'block';
      if (authSubmitText) authSubmitText.textContent = 'Create Account & Enter';
    }
  }

  function showAlert(msg, isError = true) {
    if (!authAlert) return;
    authAlert.textContent = msg;
    authAlert.className = isError ? 'auth-alert error' : 'auth-alert success';
    authAlert.style.display = 'block';
  }

  function clearAlert() {
    if (!authAlert) return;
    authAlert.style.display = 'none';
    authAlert.textContent = '';
  }

  // --- Authentication API Calls ---
  async function performLogin(email, password, rememberMe = true) {
    setLoading(true);
    clearAlert();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }

      setAuthSession(data.token, data.user);
      closeAuthModal();
      showToast(data.message || `Welcome back, ${data.user.name}!`, 'success');
      playSound('success');
    } catch (err) {
      showAlert(err.message || 'Login failed.');
      playSound('pop');
    } finally {
      setLoading(false);
    }
  }

  async function performRegister(name, email, password, role) {
    setLoading(true);
    clearAlert();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      setAuthSession(data.token, data.user);
      closeAuthModal();
      showToast(data.message || `Welcome to FloorPlan Pro, ${data.user.name}!`, 'success');
      playSound('success');
    } catch (err) {
      showAlert(err.message || 'Registration failed.');
      playSound('pop');
    } finally {
      setLoading(false);
    }
  }

  function setAuthSession(token, user) {
    authToken = token;
    currentUser = user;
    if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token);
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    updateUIForUser();
    syncWithAppState();
  }

  function clearAuthSession() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    updateUIForUser();
  }

  function setLoading(loading) {
    if (!btnAuthSubmit) return;
    btnAuthSubmit.disabled = loading;
    if (loading) {
      btnAuthSubmit.classList.add('loading');
      if (authSubmitText) authSubmitText.textContent = 'Authenticating...';
    } else {
      btnAuthSubmit.classList.remove('loading');
      if (authSubmitText) {
        authSubmitText.textContent = activeTab === 'login' ? 'Enter Spatial Studio' : 'Create Account & Enter';
      }
    }
  }

  // --- UI Updates ---
  function updateUIForUser() {
    if (currentUser) {
      // Show user profile pill in header
      if (userProfileBtn) userProfileBtn.style.display = 'flex';
      if (btnHeaderLogin) btnHeaderLogin.style.display = 'none';

      // Update header details
      if (headerUserName) headerUserName.textContent = currentUser.name || 'User';
      if (headerUserRole) headerUserRole.textContent = currentUser.roleTitle || 'Event Architect';
      if (headerUserInitials) headerUserInitials.textContent = currentUser.initials || 'FP';
      if (headerUserAvatar && currentUser.avatarGradient) {
        headerUserAvatar.style.background = currentUser.avatarGradient;
      }

      // Update dropdown details
      if (dropdownUserName) dropdownUserName.textContent = currentUser.name;
      if (dropdownUserEmail) dropdownUserEmail.textContent = currentUser.email;
      if (dropdownUserRole) dropdownUserRole.textContent = currentUser.roleTitle;
      if (dropdownUserAvatar) {
        dropdownUserAvatar.textContent = currentUser.initials;
        if (currentUser.avatarGradient) dropdownUserAvatar.style.background = currentUser.avatarGradient;
      }

      // Sync role pills in dropdown
      if (headerRoleSelector) {
        const buttons = headerRoleSelector.querySelectorAll('.role-pill-btn');
        buttons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.role === currentUser.role);
        });
      }

      // Populate saved blueprints in dropdown
      renderSavedProjects(currentUser.projects || []);
    } else {
      // Logged out / Guest view
      if (userProfileBtn) userProfileBtn.style.display = 'none';
      if (btnHeaderLogin) btnHeaderLogin.style.display = 'inline-flex';
      if (userProfileDropdown) userProfileDropdown.style.display = 'none';
    }
  }

  function renderSavedProjects(projects) {
    if (!savedProjectsList) return;
    if (!projects || projects.length === 0) {
      savedProjectsList.innerHTML = `<div class="text-xs text-muted" style="padding: 8px 12px;">No saved blueprints yet.</div>`;
      return;
    }

    savedProjectsList.innerHTML = projects.map(p => `
      <div class="saved-project-item" data-project-id="${p.id}" data-project-name="${p.name}">
        <div class="project-item-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10"/></svg>
        </div>
        <div class="project-item-info">
          <span class="project-item-name">${p.name}</span>
          <span class="project-item-meta">${p.guests} guests • ${p.tables} tables • ${p.modified}</span>
        </div>
        <button class="project-item-load" title="Load Blueprint">&rarr;</button>
      </div>
    `).join('');

    // Wire up project item click
    savedProjectsList.querySelectorAll('.saved-project-item').forEach(item => {
      item.addEventListener('click', () => {
        const pName = item.dataset.projectName;
        const projectTitleInput = document.getElementById('project-title-input');
        if (projectTitleInput) projectTitleInput.value = pName;
        if (window.STATE) window.STATE.projectName = pName;
        userProfileDropdown.style.display = 'none';
        showToast(`Loaded blueprint: "${pName}"`, 'success');
        playSound('click');
      });
    });
  }

  function syncWithAppState() {
    if (!currentUser || !window.STATE) return;

    // Sync role
    if (currentUser.role && window.STATE.role !== currentUser.role) {
      window.STATE.role = currentUser.role;
      const roleSelect = document.getElementById('role-select');
      if (roleSelect) roleSelect.value = currentUser.role;
      if (typeof window.applyCollaborationUI === 'function') {
        window.applyCollaborationUI();
      }
    }
  }

  // --- Event Listeners Initialization ---
  function initEventListeners() {
    // Header Profile toggle
    if (userProfileBtn) {
      userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!userProfileDropdown) return;
        const isOpen = userProfileDropdown.style.display === 'block';
        userProfileDropdown.style.display = isOpen ? 'none' : 'block';
        userProfileBtn.classList.toggle('active', !isOpen);
        playSound('click');
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (userProfileDropdown && userProfileDropdown.style.display === 'block') {
        if (!userProfileDropdown.contains(e.target) && !userProfileBtn.contains(e.target)) {
          userProfileDropdown.style.display = 'none';
          userProfileBtn.classList.remove('active');
        }
      }
    });

    // Header Login button
    if (btnHeaderLogin) {
      btnHeaderLogin.addEventListener('click', () => {
        openAuthModal('login');
      });
    }

    // Modal Close
    if (btnCloseAuthModal) {
      btnCloseAuthModal.addEventListener('click', closeAuthModal);
    }
    if (modalAuthPortal) {
      modalAuthPortal.addEventListener('click', (e) => {
        if (e.target === modalAuthPortal) closeAuthModal();
      });
    }

    // Tab Switching
    if (tabAuthLogin) {
      tabAuthLogin.addEventListener('click', () => setTab('login'));
    }
    if (tabAuthRegister) {
      tabAuthRegister.addEventListener('click', () => setTab('register'));
    }

    // Toggle Password Visibility
    if (btnTogglePassword && authPasswordInput) {
      btnTogglePassword.addEventListener('click', () => {
        const isPassword = authPasswordInput.type === 'password';
        authPasswordInput.type = isPassword ? 'text' : 'password';
        btnTogglePassword.innerHTML = isPassword
          ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      });
    }

    // Forgot Password Simulation
    if (btnForgotPassword) {
      btnForgotPassword.addEventListener('click', () => {
        const email = authEmailInput.value.trim() || 'your account email';
        showToast(`Password reset link sent to ${email}`, 'info');
        playSound('pop');
      });
    }

    // Role radio cards in register tab
    const roleOptions = document.querySelectorAll('.role-grid-picker .role-option');
    roleOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        roleOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    // Form Submit
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value.trim();
        const rememberMe = document.getElementById('auth-remember-me')?.checked ?? true;

        if (activeTab === 'login') {
          performLogin(email, password, rememberMe);
        } else {
          const name = authNameInput.value.trim();
          const roleRadio = document.querySelector('input[name="auth-role"]:checked');
          const role = roleRadio ? roleRadio.value : 'planner';
          performRegister(name, email, password, role);
        }
      });
    }

    // 1-Click Demo Profiles
    if (demoProfilesContainer) {
      demoProfilesContainer.querySelectorAll('.demo-profile-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const email = chip.dataset.email;
          const name = chip.dataset.name;
          authEmailInput.value = email;
          authPasswordInput.value = 'password123';
          performLogin(email, 'password123', true);
        });
      });
    }

    // Guest Explorer Mode
    if (btnGuestContinue) {
      btnGuestContinue.addEventListener('click', () => {
        const guestUser = {
          id: 'usr_guest',
          name: 'Guest Architect',
          email: 'guest@floorplanpro.local',
          role: 'planner',
          roleTitle: 'Guest Explorer',
          initials: 'GA',
          avatarGradient: 'linear-gradient(135deg, #64748b, #475569)',
          projects: [
            { id: 'proj_demo', name: 'Grand Ballroom Gala 2026', guests: 96, tables: 12, modified: 'Live' }
          ]
        };
        setAuthSession(null, guestUser);
        closeAuthModal();
        showToast('Exploring as Guest Architect (all tools unlocked)', 'info');
        playSound('click');
      });
    }

    // Switch Role inside Dropdown
    if (headerRoleSelector) {
      headerRoleSelector.querySelectorAll('.role-pill-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const newRole = btn.dataset.role;
          if (currentUser) {
            currentUser.role = newRole;
            const titles = {
              planner: 'Lead Event Architect',
              venue: 'Venue Operations Director',
              client: 'Event Host & VIP Client',
              caterer: 'Catering & Banquet Director'
            };
            currentUser.roleTitle = titles[newRole] || 'Event Architect';
            setAuthSession(authToken, currentUser);

            // Notify server
            if (authToken) {
              fetch('/api/auth/switch-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ role: newRole })
              }).catch(() => {});
            }
          }
          showToast(`Switched active role to: ${btn.textContent}`, 'info');
          playSound('click');
        });
      });
    }

    // Switch Account Button in Dropdown
    if (btnOpenLoginModal) {
      btnOpenLoginModal.addEventListener('click', () => {
        if (userProfileDropdown) userProfileDropdown.style.display = 'none';
        openAuthModal('login');
      });
    }

    // Logout Button
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (authToken) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {});
        }
        clearAuthSession();
        showToast('Signed out of FloorPlan Pro', 'info');
        playSound('pop');
        openAuthModal('login');
      });
    }
  }

  // --- Session Bootstrapper ---
  async function initSession() {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedUserJson = localStorage.getItem(STORAGE_KEY_USER);

    if (savedToken) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setAuthSession(savedToken, data.user);
            return;
          }
        }
      } catch (_e) {
        // Fallback to cached local storage user
      }
    }

    if (savedUserJson) {
      try {
        const user = JSON.parse(savedUserJson);
        setAuthSession(savedToken || 'cached', user);
        return;
      } catch (_e) {}
    }

    // Initial default: Auto-sign in with premier planner profile for immediate usability,
    // while keeping the Sign In / Profile fully interactive
    const defaultUser = {
      id: 'usr_ishan_01',
      name: 'Ishan Jadhav',
      email: 'ishan@floorplanpro.com',
      role: 'planner',
      roleTitle: 'Lead Event Architect',
      initials: 'IJ',
      avatarGradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
      projects: [
        { id: 'proj_01', name: 'Grand Ballroom Gala 2026', guests: 96, tables: 12, modified: 'Just now' },
        { id: 'proj_02', name: 'Rooftop Summit Keynote', guests: 64, tables: 8, modified: '2 hours ago' },
        { id: 'proj_03', name: 'Sunset Terrace Reception', guests: 120, tables: 15, modified: 'Yesterday' }
      ]
    };
    setAuthSession('fpsess_default', defaultUser);
  }

  // --- DOM Ready Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initEventListeners();
      initSession();
    });
  } else {
    initEventListeners();
    initSession();
  }

  // Expose global module
  window.AUTH_MODULE = {
    getCurrentUser: () => currentUser,
    getToken: () => authToken,
    openAuthModal,
    closeAuthModal,
    performLogin,
    performRegister
  };
})();
