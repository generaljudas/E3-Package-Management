const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// Start the Express backend server
function startBackend() {
  const backendPath = path.join(__dirname, '../backend/src/index.js');
  
  console.log('Starting backend server...');
  backendProcess = spawn('node', [backendPath], {
    env: {
      ...process.env,
      ELECTRON_MODE: 'true',
      USER_DATA_PATH: app.getPath('userData')
    },
    stdio: 'inherit'
  });

  backendProcess.on('error', (error) => {
    console.error('Backend process error:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../frontend/public/icon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    backgroundColor: '#1e293b',
    show: false
  });

  // In development, load from Vite dev server
  // In production, load from built files
  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Wait for backend to be ready before creating window
function waitForBackend(callback) {
  const http = require('http');
  const checkInterval = setInterval(() => {
    http.get('http://localhost:3001/api/health', (res) => {
      if (res.statusCode === 200) {
        clearInterval(checkInterval);
        console.log('Backend is ready!');
        callback();
      }
    }).on('error', () => {
      // Backend not ready yet, keep waiting
    });
  }, 500);
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged;
  
  if (!isDev) {
    // Only start backend in production mode
    // In dev mode, assume backend is already running from npm run dev
    startBackend();
  }
  
  // Wait for backend to be ready, then create window
  setTimeout(() => {
    waitForBackend(() => {
      createWindow();
    });
  }, isDev ? 500 : 2000); // Shorter wait in dev since backend is already running

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill backend process
  if (backendProcess) {
    backendProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Ensure backend is killed on app quit
  if (backendProcess) {
    backendProcess.kill();
  }
});
