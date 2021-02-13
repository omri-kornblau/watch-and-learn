const ChildProcess = require("child_process")
const Chokidar = require("chokidar")
const Path = require("path")
const Fs = require("fs").promises
const EventEmitter = require("events").EventEmitter

const promisify = require("util").promisify
const rimraf = promisify(require("rimraf"))

const TEMP_OUTPUT_DIR = "./.java_build"
const COMPILE_TIMEOUT = 10000
const RUN_TIMEOUT = 60000

const events = {
  COMPILED: "compiled",
  SPAWN_ERROR: "spawn_error",
  COMPILATION_ERROR: "compilation_error",
  DATA: "data",
  RUNTIME_ERROR: "runtime_error",
  COMPILING: "compiling",
}

const {
  COMPILED,
  SPAWN_ERROR,
  COMPILATION_ERROR,
  DATA,
  RUNTIME_ERROR,
  COMPILING
} = events

const spawnJavaCompile = (path, outputDir) => ChildProcess.spawn("javac.exe", [ "-d", outputDir, "-cp", TEMP_OUTPUT_DIR, path])
const spawnJavaRun = (path) => ChildProcess.spawn("java.exe", ["-cp", TEMP_OUTPUT_DIR, "Main"])

class Runner extends EventEmitter {
  constructor() {
    super()
  }

  compileDir = (dir, outputDir=TEMP_OUTPUT_DIR, compileTimeoutLimit=COMPILE_TIMEOUT) => {
    this.emit(COMPILING)

    const compileTimeout = setTimeout(() => this.emit(SPAWN_ERROR, new Error("Timeout")), compileTimeoutLimit)

    const javaCompileProcess = spawnJavaCompile(Path.resolve(dir, "*.java"), outputDir)

    let compileError = ""

    javaCompileProcess
      .on("exit", () => {
        clearTimeout(compileTimeout)

        javaCompileProcess.removeAllListeners()

        if (!!compileError) return this.emit(COMPILATION_ERROR, new Error(compileError.toString()))

        this.emit(COMPILED)
      })
      .on("error", (error) => {
        this.emit(SPAWN_ERROR, error)
      })

    javaCompileProcess
      .stderr.on("data", (error) => compileError += error)
  } 

  runDir = (dir, runTimeoutLimit=RUN_TIMEOUT) => {
    const runTimeout = setTimeout(() => this.emit(SPAWN_ERROR, new Error("Timeout"), runTimeoutLimit))
    const javaRunProcess = spawnJavaRun(dir)

    javaRunProcess
      .on("exit", () => {
        clearTimeout(runTimeout)

        javaRunProcess.removeAllListeners()
      })
      .on("error", (error) => this.emit(SPAWN_ERROR, error))

    javaRunProcess.stderr.on("data", (error) => this.emit(RUNTIME_ERROR, error))
    javaRunProcess.stdout.on("data", (data) => this.emit(DATA, data.toString()))
  }

  compileAndRun = async (dir) => {
    this.once(COMPILED, () => this.runDir(dir))

    this.compileDir(dir)
  }
}

const initWatcher = async (dir, callback) => {
  const filesInDir = await Fs.readdir(dir)

  await rimraf(TEMP_OUTPUT_DIR)
  await Fs.mkdir(TEMP_OUTPUT_DIR)

  const filesPaths = filesInDir.map(file => Path.resolve(dir, file))

  const watchOptions = { 
    awaitWriteFinish: true,
    usePolling: true,
    interval: 1
  }

  Chokidar.watch(filesPaths , watchOptions).on("change", callback)
}

module.exports = {
  initWatcher,
  Runner,
  events
}