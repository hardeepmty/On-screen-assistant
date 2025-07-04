// preload.js

// Import contextBridge and ipcRenderer from Electron
const { contextBridge, ipcRenderer } = require('electron');

// Expose a global API (electronAPI) to the renderer process (your HTML/JS app)
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Function to send a prompt and optional image data to the main process for Gemini API interaction.
   * @param {string} prompt - The text prompt to send to Gemini.
   * @param {string} [imageData] - Optional base64 encoded image data of the screen.
   * @returns {Promise<string>} - A promise that resolves with Gemini's response text or an error message.
   */
  askGemini: (prompt, imageData) => ipcRenderer.invoke('ask-gemini', prompt, imageData),

  /**
   * Function to request a screen capture from the main process.
   * @returns {Promise<string|null>} - A promise that resolves with base64 encoded image data or null on error.
   */
  captureScreen: () => ipcRenderer.invoke('capture-screen')
});