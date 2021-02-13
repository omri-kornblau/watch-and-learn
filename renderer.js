const { ipcRenderer } = require("electron")

const {
  DATA,
  COMPILED,
  COMPILATION_ERROR,
  COMPILING,
  RUNTIME_ERROR
} = require("./run_java").events

const $titleBar = document.getElementById("title-bar")
const $main = document.getElementById("main")
const $compileIndicator = document.getElementById("compilation-indicator")
const $dataIndicator = document.getElementById("data-indicator")

ipcRenderer.on(COMPILED, () => {
  $compileIndicator.innerHTML = "V"
  $dataIndicator.innerHTML = ""
})
ipcRenderer.on(DATA, (_, data) => $dataIndicator.innerHTML += data)
ipcRenderer.on(COMPILATION_ERROR, () => {
  $compileIndicator.innerHTML = "X"
  $dataIndicator.innerHTML = ""
})
ipcRenderer.on(COMPILING, () => $compileIndicator.innerHTML = "...")
