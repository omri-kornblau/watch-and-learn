const { app, screen, BrowserWindow } = require('electron')
const Path = require('path')
const Sharp = require("sharp")

const screenshot = require("screenshot-desktop")

const {
  Runner,
  initWatcher,
  events
} = require("./run_java")

const {
  COMPILATION_ERROR,
  RUNTIME_ERROR,
  DATA,
  COMPILED,
  COMPILING
} = events

const SCREENSHOT_FILE = "screenshot.jpg"
const TASKBAR_HEIGHT = 100

const createWindow = (width, height) => {
  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: Path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    },
    // skipTaskbar: true,
    kiosk: true,
    transparent: true,
    alwaysOnTop: true,
    frame: false,
  })

  mainWindow.loadFile('index.html')
  
  mainWindow.setIgnoreMouseEvents(true)

  // mainWindow.webContents.openDevTools()

  return mainWindow
}

const run = async () => {
  await app.whenReady()

  const desktopScreenshot = await screenshot()

  const imageScreenshot = Sharp(desktopScreenshot)

  const screenshopMetadata = await imageScreenshot.metadata()
  const { width, height } = screenshopMetadata

  imageScreenshot
    .extract({ width, height: TASKBAR_HEIGHT, left: 0, top: height - TASKBAR_HEIGHT })
    .toFile(SCREENSHOT_FILE)

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  const windowTaskbarHeight = Math.ceil(TASKBAR_HEIGHT / (height / screenHeight))

  const window = createWindow(screenWidth, windowTaskbarHeight)

  const runner = new Runner()

  Object.keys(events).forEach(eventName => 
    runner.on(events[eventName], (data) => window.webContents.send(events[eventName], data))
  )

  initWatcher("./java_files", () => runner.compileAndRun("./java_files"))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

run()
