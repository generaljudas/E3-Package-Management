const { app, BrowserWindow, utilityProcess, dialog } = require('electron');
const path = require('path');
const http = require('http');

const BACKEND_PORT = 3001;
const BACKEND_STARTUP_TIMEOUT_MS = 30000;

let mainWindow = null;
let backendProcess = null;
let startupFailed = false;

// Only one instance may run — two would fight over the port and the database.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// When packaged, the backend lives in Resources/backend, outside the asar
// archive, so its node_modules (including the native SQLite driver) load
// normally from the real filesystem.
function backendEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'index.js')
    : path.join(__dirname, '..', 'backend', 'src', 'index.js');
}

// Run the backend with Electron's bundled Node runtime — end users don't
// have (and shouldn't need) their own Node installation.
function startBackend() {
  backendProcess = utilityProcess.fork(backendEntryPath(), [], {
    serviceName: 'e3-backend',
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_MODE: 'true',
      USER_DATA_PATH: app.getPath('userData'),
      PORT: String(BACKEND_PORT),
    },
  });

  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (code !== 0 && !mainWindow) {
      showStartupError(
        `The local server exited unexpectedly (code ${code}).\n\n` +
        `If another application is using port ${BACKEND_PORT}, close it and try again.`
      );
    }
  });
}

function showStartupError(detail) {
  if (startupFailed) return;
  startupFailed = true;
  dialog.showErrorBox('E3 Package Manager could not start', detail);
  app.quit();
}

function waitForBackend(onReady) {
  const deadline = Date.now() + BACKEND_STARTUP_TIMEOUT_MS;

  const retry = () => {
    if (startupFailed) return;
    if (Date.now() > deadline) {
      showStartupError(
        `The local server did not respond within ${BACKEND_STARTUP_TIMEOUT_MS / 1000} seconds.\n\n` +
        `If another application is using port ${BACKEND_PORT}, close it and try again.`
      );
      return;
    }
    setTimeout(check, 500);
  };

  const check = () => {
    if (startupFailed) return;
    http
      .get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) onReady();
        else retry();
      })
      .on('error', retry);
  };

  check();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#1e293b',
    show: false,
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged;

  if (isDev) {
    // In dev the backend and Vite are already running via npm run dev.
    waitForBackend(createWindow);
  } else {
    startBackend();
    waitForBackend(createWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !startupFailed) {
      createWindow();
    }
  });
});

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', stopBackend);
