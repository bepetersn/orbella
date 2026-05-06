/**
 * @fileoverview Settings modal management.
 *
 * Handles opening/closing the settings modal with a gear icon button and
 * manages the interactions within the settings panel.
 */
let settingsModal = null;
  let settingsToggle = null;
  let settingsClose = null;

  /**
   * Initialize the settings modal and button elements.
   */
  function initializeElements() {
    settingsModal = document.getElementById("settings-modal");
    settingsToggle = document.getElementById("settings-toggle");
    settingsClose = document.getElementById("settings-close");
  }

  /**
   * Check if the settings modal is currently visible.
   * @returns {boolean}
   */
export function isModalOpen() {
    return settingsModal && !settingsModal.hasAttribute("hidden");
  }

  /**
   * Open the settings modal.
   */
export function openModal() {
    if (settingsModal) {
      settingsModal.removeAttribute("hidden");
      settingsToggle?.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
  }

  /**
   * Close the settings modal.
   */
export function closeModal() {
    if (settingsModal) {
      settingsModal.setAttribute("hidden", "");
      settingsToggle?.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  }

  /**
   * Toggle the settings modal open/closed.
   */
export function toggleModal() {
    if (isModalOpen()) {
      closeModal();
    } else {
      openModal();
    }
  }

  /**
   * Close the modal when clicking outside of the settings panel.
   * @param {MouseEvent} event
   */
  function handleBackdropClick(event) {
    const settingsPanel = document.getElementById("settings-panel");
    if (event.target === settingsModal || event.target === document.getElementById("settings-backdrop")) {
      closeModal();
    }
  }

  /**
   * Close the modal when pressing Escape key.
   * @param {KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === "Escape" && isModalOpen()) {
      closeModal();
      settingsToggle?.focus();
    }
  }

  /**
   * Bind event listeners for modal interactions.
   */
  function bindEventListeners() {
    initializeElements();

    if (settingsToggle) {
      settingsToggle.addEventListener("click", toggleModal);
    }

    if (settingsClose) {
      settingsClose.addEventListener("click", closeModal);
    }

    if (settingsModal) {
      settingsModal.addEventListener("click", handleBackdropClick);
    }

    document.addEventListener("keydown", handleKeyDown);
  }

// Backward-compat shim — remove once all callers use import
window.worldleLiteSettings = {
  openModal,
  closeModal,
  toggleModal,
  isModalOpen
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEventListeners);
} else {
  bindEventListeners();
}
