// main.js

// Import Electron modules
const { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer } = require('electron');
// Import Node.js path module for resolving file paths
const path = require('path');
// Load environment variables from .env file (for GEMINI_API_KEY)
require('dotenv').config();

// Import Google Generative AI SDK
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
// NOTE: activeWindow module has been removed due to persistent ffi-napi errors.
// Context will now primarily rely on user prompt and screen capture.

// Initialize the Gemini AI client with the API key from environment variables
// Ensure you have a .env file in your project root with GEMINI_API_KEY="YOUR_API_KEY"
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let win; // Declare the BrowserWindow instance globally so it can be accessed

/**
 * Creates the main application window.
 */
function createWindow() {
  win = new BrowserWindow({
    width: 500, // Initial width of the window
    height: 600, // Initial height of the window
    frame: false, // Removes the default window frame (title bar, minimize/maximize/close buttons)
    show: false, // Do not show the window immediately on creation
    alwaysOnTop: true, // Keep the window always on top of other applications
    transparent: true, // Makes the window background transparent
    webPreferences: {
      // Preload script to expose Node.js APIs to the renderer process securely
      preload: path.join(__dirname, 'preload.js'),
      // Recommended security settings for production:
      contextIsolation: true, // Protects against prototype pollution
      nodeIntegration: false,  // Disables Node.js integration in renderer process
    },
  });

  // Load the HTML file directly
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Optional: Open DevTools for debugging during development
  // win.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow(); // Create the main window

  // Register a global keyboard shortcut (Ctrl+I)
  // This shortcut will work even when the app is in the background
  globalShortcut.register('Control+I', () => {
    if (win) { // Ensure the window instance exists
      // Toggle window visibility: if visible, hide it; if hidden, show it
      win.isVisible() ? win.hide() : win.show();
    }
  });

  /**
   * ipcMain.handle listens for 'capture-screen' messages from the renderer process.
   * It captures a screenshot of the primary display and returns it as a base64 string.
   */
  ipcMain.handle('capture-screen', async () => {
    try {
      // Get all available desktop sources (screens, windows)
      const sources = await desktopCapturer.getSources({
        types: ['screen'], // Only capture screens
        thumbnailSize: { width: 1920, height: 1080 } // Request a reasonable thumbnail size
      });

      // Find the primary display source (usually the first one, or you can iterate)
      const primarySource = sources[0];
      if (primarySource) {
        // Get the image buffer from the thumbnail
        const imageBuffer = primarySource.thumbnail.toPNG();
        // Convert the image buffer to a base64 string
        return imageBuffer.toString('base64');
      }
      return null; // Return null if no primary source found
    } catch (error) {
      console.error('Error capturing screen:', error);
      return null;
    }
  });

  /**
   * ipcMain.handle listens for 'ask-gemini' messages from the renderer process.
   * It takes a user prompt and optional image data, sends it to the Gemini API,
   * and returns the response.
   */
  ipcMain.handle('ask-gemini', async (event, userPrompt, imageData) => {
    try {
      // Removed activeWindow to resolve ffi-napi error.
      // The prompt will now rely on the user's question and the screen image.
      const textPart = `
You are an AI assistant.
User's question: ${userPrompt}

Please provide a concise and helpful response based on the question and the provided image (if any).
`;

      // Prepare the content parts for the Gemini API call
      const parts = [{ text: textPart }];

      // If image data is provided, add it to the parts array for multimodal input
      if (imageData) {
        parts.push({
          inlineData: {
            mimeType: 'image/png', // Assuming PNG format from desktopCapturer
            data: imageData
          }
        });
      }

      // Get the generative model (using 'gemini-2.0-flash' for multimodal capabilities)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Configure safety settings (optional, but good practice)
      const generationConfig = {
        temperature: 0.7,
        topP: 0.95,
        topK: 60,
        maxOutputTokens: 800,
      };

      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ];


      // Generate content using the prepared parts
      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig,
        safetySettings
      });

      // Extract the text response from the API result
      const response = result.response;
      return response.text();
    } catch (err) {
      // Log any errors that occur during the API call in the main process console
      console.error("Error asking Gemini:", err);
      // Return an error message to the renderer process
      return 'Error: ' + err.message;
    }
  });

  // On macOS, re-create a window when the dock icon is clicked and no other windows are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// This event is emitted when the application is about to quit.
app.on('will-quit', () => {
  // Unregister all global shortcuts to clean up resources
  globalShortcut.unregisterAll();
});

// Quit the app when all windows are closed, except on macOS.
// On macOS, it's common for applications to stay active until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});