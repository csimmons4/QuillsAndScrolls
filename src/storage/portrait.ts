// Character portraits are stored on the character itself as a small JPEG data URL, so they save,
// export, import and back up along with everything else.

const MAX_SIDE = 512

/** Shrink an image file to at most 512 px on its longest side and return it as a JPEG data URL.
 *  Throws if the browser can't read the file as an image (e.g. HEIC photos in some browsers). */
export async function imageFileToPortrait(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This browser can’t open that image. Try a JPEG or PNG.')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'  // JPEG has no transparency: transparent PNGs get a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
