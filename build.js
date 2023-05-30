import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import got from 'got'
import intoStream from 'into-stream'
import combine from 'ordered-read-streams'

build({
  serverUrl: 'https://tube.arthack.nz',
  channelName: 'intertwingled',
  filePath: './README.md',
  chunkSize: 10,
})

async function build(options) {
  const { chunkSize } = options

  await pipeline(
    combine([
      getChannelTitleTextSource(options),
      getChannelVideosObjsSource(options, { count: chunkSize })
        .map(
          mapChannelVideoObjToText(options),
          {
            concurrency: chunkSize,
          },
        ),
    ]),
    getFileSink(options),
  )
}

function getFileSink({ filePath }) {
  return createWriteStream(new URL(filePath, import.meta.url))
}

function getChannelTitleTextSource(options) {
  return intoStream(getChannelTitleText(options))
}

async function getChannelTitleText({ channelName, serverUrl }) {
  const { displayName, description } = await got({
    prefixUrl: serverUrl,
    url: `api/v1/video-channels/${channelName}`
  }).json()

  const text = [
    `# ${displayName}`,
    ``,
    `![](./banner.jpg)`,
    ``,
    description.replace(newlineRegex, '\n')
  ].join('\n')

  return text + '\n\n'
}

function getChannelVideosObjsSource(options, pos) {
  return intoStream.object(getChannelVideosObjs(options, pos))
}

async function* getChannelVideosObjs(options, pos) {
  const { channelName, serverUrl } = options
  const { start = 0, count } = pos
  
  console.log(start)

  const { data } = await got(
    `api/v1/video-channels/${channelName}/videos`,
    {
      prefixUrl: serverUrl,
      searchParams: {
        count,
        start,
        sort: "-publishedAt",
        skipCount: "true",
      }
    }
  ).json()

  for (const video of data) {
    yield video
  }

  if (!(data.length < count)) {
    yield* getChannelVideosObjs(options, { start: start + data.length, count }) 
  }
}

function mapChannelVideoObjToText(options) {
  const { serverUrl } = options

  return async (video) => {
    const { id, name, thumbnailPath, url } = video

    const { description } = await got(
      `api/v1/videos/${id}/description`,
      {
        prefixUrl: serverUrl,
      }
    ).json()

    const shortDescription = description
      .split(newlineRegex)
      .slice(0, 3)
      .join('\n')

    const text = [
      `## [${name}](${url})`,
      ``,
      `[![${name}](${serverUrl}${thumbnailPath})](${url})`,
      ``,
      shortDescription,
    ].join('\n')

    return text + '\n\n'
  }
}

const newlineRegex = /\r?\n|\r/g
