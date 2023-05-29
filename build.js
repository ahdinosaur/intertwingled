import got from 'got'
import { createWriteStream } from 'node:fs'


build({
  serverUrl: 'https://tube.arthack.nz',
  channelName: 'intertwingled',
  filePath: './README.md',
})

async function build(options) {
  const { serverUrl, channelName, filePath } = options

  const stream = getFileStream(options)
  
  await writeChannelTitle(stream, options)

  await writeChannelVideos(stream, options)
}

function getFileStream({ filePath }) {
    return createWriteStream(new URL(filePath, import.meta.url))
}

async function writeChannelTitle(stream, { channelName, serverUrl }) {
  const { displayName, description } = await got({
    prefixUrl: serverUrl,
    url: `api/v1/video-channels/${channelName}`
  }).json()

  const text = [
    `# ${displayName}`,
    ``,
    description.replace('\r', '')
  ].join('\n')

  stream.write(
    text + '\n\n',
    'utf-8'
  )
}

async function writeChannelVideos(stream, options, { start = 0, count = 10 } = {}) {
  console.log(start)

  const { channelName, serverUrl } = options

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
    const { id, name, thumbnailPath, url } = video

    const { description } = await got(
      `api/v1/videos/${id}/description`,
      {
        prefixUrl: serverUrl,
      }
    ).json()

    const shortDescription = description
      .split(/\r?\n|\r/g)
      .slice(0, 3)
      .join('\n')

    const text = [
      `## [${name}](${url})`,
      ``,
      `[![${name}](${serverUrl}${thumbnailPath})](${url})`,
      ``,
      shortDescription,
    ].join('\n')

    await new Promise((resolve, reject) => {
      stream.write(
        text + '\n\n',
        'utf-8',
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }

  if (!(data.length < count)) {
    await writeChannelVideos(stream, options, { start: start + data.length, count }) 
  }
}
