const { createReadStream } = require("fs")
const png = require("pngjs-image")
const express = require("express")

const NS_PER_SEC = 1e9

const app = express()

const imageConfig = {
  width: 1920,
  height: 1080,
  numberOfBytesPerColor: 9 // 9 in order to have the rgb value for a pixel (= 9 digits = 3 * 3 digits)
}
const digits = 1000000000000

const getDuration = startTime => process.hrtime(startTime)
const formatDuration = ([seconds, nanoseconds]) => `${seconds + parseInt(nanoseconds) / NS_PER_SEC}s`
const extractPixels = bytes => bytes.match(/.{9}/g)

function extractColors(bytes) {
  const [red, green, blue] = bytes.match(/.{3}/g)

  return {
    red: Number.parseInt(red) % 256,
    green: Number.parseInt(green) % 256,
    blue: Number.parseInt(blue) % 256,
    alpha: 200
  }
}

function createImage(data, index) {
  return new Promise((resolve, reject) => {
    const image = png.createImage(imageConfig.width, imageConfig.height)
    const pixels = extractPixels(data)
    let nextPixel = 0

    for (let x = 0; x < imageConfig.width; x++) {
      for (let y = 0; y < imageConfig.height; y++) {
        image.setAt(x, y, extractColors(pixels[nextPixel]))
        nextPixel++
      }
    }

    image.writeImage(`./images/${index}.png`, error => (error ? reject(error) : resolve()))
  })
}

app.get("/images", (req, res) => {
  const chunkSize = imageConfig.width * imageConfig.height * imageConfig.numberOfBytesPerColor
  const stream = createReadStream("./pi.txt", {
    highWaterMark: chunkSize,
    encoding: "ascii",
    start: 2 // ignore 3.
  })
  let imageIndex = 1

  stream.on("data", piChunk => {
    const data = piChunk.toString()

    if (data.length === chunkSize) {
      createImage(data, imageIndex)
      imageIndex++
    }
  })

  stream.on("end", () => res.status(200))
})

app.get("/:sequence", (req, res) => {
  const startTime = process.hrtime()
  const oneChunkSize = 64 * 1024;
  const stream = createReadStream("./pi.txt", { highWaterMark: oneChunkSize })
  let chunksCount = 0;
  let lastChunk = ''

  stream.on("data", chunk => {
    const bloc = lastChunk.toString() + chunk.toString()
    const indexOfSequence = bloc.indexOf(req.params.sequence)

    if (indexOfSequence !== -1) {
      stream.close()
      res.send({
        indexOfSequence: oneChunkSize * (chunksCount) + indexOfSequence - lastChunk.toString().length,
        duration: formatDuration(getDuration(startTime)),
        digits
      })
    }

    lastChunk = chunk
    chunksCount++
  })

  stream.on("end", () => {
    res.send({
      indexOfSequence: "not found",
      duration: formatDuration(getDuration(startTime)),
      digits
    })
  })
})

app.listen(8000, () => console.log("Server listening on http://localhost:8000"))
