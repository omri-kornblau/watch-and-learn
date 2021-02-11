const ChildProcess = require("child_process")
const Chokidar = require("chokidar")
const Path = require("path")
const Fs = require("fs").promises

const promisify = require("util").promisify
const rimraf = promisify(require("rimraf"))

const TEMP_OUTPUT_DIR = "./.java_build"
const COMPILE_TIMEOUT = 10000
const RUN_TIMEOUT = 60000

const spawnJavaCompile = (path, outputDir) => ChildProcess.spawn("javac.exe", [ "-d", outputDir, "-cp", TEMP_OUTPUT_DIR, path])
const spawnJavaRun = (path) => ChildProcess.spawn("java.exe", ["-cp", TEMP_OUTPUT_DIR, "Main"])

const compileDir = async (dir, outputDir=TEMP_OUTPUT_DIR, compileTimeoutLimit=COMPILE_TIMEOUT) => (
  new Promise((resolve, reject) => {
    let compileError = ""

    const compileTimeout = setTimeout(resolve, compileTimeoutLimit)

    const javaCompileProcess = spawnJavaCompile(Path.resolve(dir, "*.java"), outputDir)

    javaCompileProcess
      .on("exit", () => {
        clearTimeout(compileTimeout)

        if (!!compileError) return reject(new Error(`[COMPILATION_ERROR] \n${compileError.toString()}`))

        javaCompileProcess.removeAllListeners()

        resolve()
      })
      .on("error", (error) => reject(new Error(`[SPAWN_ERROR] \n${error}`)))

    javaCompileProcess
      .stderr.on("data", (error) => compileError += error)
  })
)

const runDir = async (dir, runTimeoutLimit=RUN_TIMEOUT) => (
  new Promise((resolve, reject) => {
    const runTimeout = setTimeout(resolve, runTimeoutLimit)
    const javaRunProcess = spawnJavaRun(dir)

    javaRunProcess
      .on("exit", () => {
        clearTimeout(runTimeout)

        javaRunProcess.removeAllListeners()

        resolve()
      })
      .on("error", (error) => reject(new Error(`[SPAWN_ERROR] \n${error}`)))

    javaRunProcess.stderr.on("data", (error) => console.log(`[RUNTIME_ERROR]: \n${error.toString()}\n`))
    javaRunProcess.stdout.on("data", (data) => console.log(`out: \n${data.toString()}\n`))
  })
)

const onUpdate = (path) => (async () => {
  console.log(`File update: ${path}`)

  const fileDir = Path.parse(path).dir

  await rimraf(TEMP_OUTPUT_DIR)

  try { 
    await compileDir(fileDir)

    console.log(`Done compiling ${path}\n`)
  } catch(err) {
    console.log(err.toString())
    return
  }

  await runDir(fileDir)
})()

const run = async (dir) => {
  const filesInDir = await Fs.readdir(dir)

  await rimraf(TEMP_OUTPUT_DIR)
  await Fs.mkdir(TEMP_OUTPUT_DIR)

  const filesPaths = filesInDir.map(file => Path.resolve(dir, file))

  if (filesPaths.length > 0) {
    onUpdate(filesPaths[0])
  }

  const watchOptions = { 
    awaitWriteFinish: true,
    usePolling: true,
    interval: 1
  }

  Chokidar.watch(filesPaths , watchOptions)
    .on("change", onUpdate)
}

run("./java_files")
