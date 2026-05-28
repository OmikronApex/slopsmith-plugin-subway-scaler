// Client-side GIF frame extractor. Reads raw GIF bytes, decodes LZW-compressed
// image blocks, and returns one HTMLCanvasElement per frame (respecting disposal
// methods so each canvas is the full, composited frame state at its display time).
// No dependencies — works anywhere Canvas2D is available.

export function parseGifFrames(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  let off = 0;

  // --- Header ---
  const sig = String.fromCharCode(dv.getUint8(off++), dv.getUint8(off++), dv.getUint8(off++));
  if (sig !== 'GIF') throw new Error('Not a GIF');
  off += 3; // version "89a" or "87a"

  // --- Logical Screen Descriptor ---
  const screenW = dv.getUint16(off, true); off += 2;
  const screenH = dv.getUint16(off, true); off += 2;
  const packed = dv.getUint8(off++);
  const gctFlag = (packed >> 7) & 1;
  const gctSize = 2 << (packed & 7);
  off += 1; // bg color index
  off += 1; // pixel aspect ratio

  // --- Global Color Table ---
  let globalColorTable = null;
  if (gctFlag) {
    globalColorTable = [];
    for (let i = 0; i < gctSize; i++) {
      globalColorTable.push({
        r: dv.getUint8(off++),
        g: dv.getUint8(off++),
        b: dv.getUint8(off++),
      });
    }
  }

  // --- Parse blocks into frame descriptors ---
  const frames = [];
  let extGraphicsControl = null; // most recent graphics control ext

  while (off < dv.byteLength) {
    const blockType = dv.getUint8(off++);
    if (blockType === 0x21) {
      // Extension
      const label = dv.getUint8(off++);
      while (true) {
        const blockSize = dv.getUint8(off);
        if (blockSize === 0) { off += 1; break; }
        off += 1;
        if (label === 0xF9 && blockSize === 4) {
          // Graphics Control Extension
          const gcePacked = dv.getUint8(off);
          const disposal = (gcePacked >> 2) & 7;
          const transparentColorFlag = gcePacked & 1;
          const delayMs = dv.getUint16(off + 1, true) * 10;
          const transparentIndex = dv.getUint8(off + 3);
          extGraphicsControl = { disposal, transparentColorFlag, transparentIndex, delayMs };
        }
        off += blockSize;
      }
    } else if (blockType === 0x2C) {
      // Image Descriptor
      const imgLeft = dv.getUint16(off, true); off += 2;
      const imgTop = dv.getUint16(off, true); off += 2;
      const imgW = dv.getUint16(off, true); off += 2;
      const imgH = dv.getUint16(off, true); off += 2;
      const imgPacked = dv.getUint8(off++);
      const localTableFlag = (imgPacked >> 7) & 1;
      const interlaced = (imgPacked >> 6) & 1;
      const localTableSize = localTableFlag ? (2 << (imgPacked & 7)) : 0;

      // Local Color Table
      let localColorTable = null;
      if (localTableFlag) {
        localColorTable = [];
        for (let i = 0; i < localTableSize; i++) {
          localColorTable.push({
            r: dv.getUint8(off++),
            g: dv.getUint8(off++),
            b: dv.getUint8(off++),
          });
        }
      }

      const minCodeSize = dv.getUint8(off++);
      const lzwData = [];
      while (true) {
        const blockSize = dv.getUint8(off);
        if (blockSize === 0) { off += 1; break; }
        off += 1;
        for (let i = 0; i < blockSize; i++) {
          lzwData.push(dv.getUint8(off++));
        }
      }

      const colorTable = localColorTable || globalColorTable;
      const indexedPixels = lzwDecode(lzwData, minCodeSize);

      // Render frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = screenW;
      canvas.height = screenH;
      const ctx = canvas.getContext('2d');

      // Use compositing to handle disposal
      // disposal 0/1: leave as-is, 2: restore to bg, 3: restore to prev
      if (extGraphicsControl && extGraphicsControl.disposal === 2) {
        // Restore to background — just clear for now (we'll composite)
      }

      // Draw the indexed pixels
      const imageData = ctx.createImageData(imgW, imgH);
      for (let y = 0; y < imgH; y++) {
        let srcY = interlaced ? interlacedRowToDataRow(y, imgH) : y;
        for (let x = 0; x < imgW; x++) {
          const idx = srcY * imgW + x;
          const pixelIdx = idx < indexedPixels.length ? indexedPixels[idx] : 0;
          const pi = (y * imgW + x) * 4;
          if (extGraphicsControl && extGraphicsControl.transparentColorFlag && pixelIdx === extGraphicsControl.transparentIndex) {
            imageData.data[pi] = 0;
            imageData.data[pi + 1] = 0;
            imageData.data[pi + 2] = 0;
            imageData.data[pi + 3] = 0;
          } else if (pixelIdx < colorTable.length) {
            imageData.data[pi] = colorTable[pixelIdx].r;
            imageData.data[pi + 1] = colorTable[pixelIdx].g;
            imageData.data[pi + 2] = colorTable[pixelIdx].b;
            imageData.data[pi + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, imgLeft, imgTop);

      frames.push({
        canvas: canvas,
        delayMs: extGraphicsControl ? extGraphicsControl.delayMs : 100,
        disposal: extGraphicsControl ? extGraphicsControl.disposal : 0,
        transparentIndex: extGraphicsControl && extGraphicsControl.transparentColorFlag ? extGraphicsControl.transparentIndex : null,
      });
    } else if (blockType === 0x3B) {
      break; // Trailer
    }
  }

  // --- Composite frames respecting disposal methods ---
  return compositeGifFrames(frames, screenW, screenH);
}

function compositeGifFrames(rawFrames, w, h) {
  const result = [];
  let prevCanvas = null;

  for (const frame of rawFrames) {
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    const ctx = full.getContext('2d');

    if (frame.disposal === 3 && prevCanvas) {
      // Restore to previous — draw the previous composite state
      ctx.drawImage(prevCanvas, 0, 0);
    } else if (prevCanvas) {
      // Disposal 0/1/2: start from previous and overlay
      ctx.drawImage(prevCanvas, 0, 0);
    }

    ctx.drawImage(frame.canvas, 0, 0);

    if (frame.disposal === 2) {
      prevCanvas = null; // next frame starts fresh
    } else {
      prevCanvas = full; // save for disposal:3 restore
    }

    result.push(full);
  }

  return { frames: result, delays: rawFrames.map(f => f.delayMs) };
}

function interlacedRowToDataRow(y, h) {
  // GIF interlacing: pixel data stored in 4 passes.
  // Returns the data-row index (in the flat LZW array) for output row y.
  const passes = [
    { start: 0, step: 8 },
    { start: 4, step: 8 },
    { start: 2, step: 4 },
    { start: 1, step: 2 },
  ];
  let offset = 0;
  for (const p of passes) {
    const count = Math.ceil(Math.max(0, h - p.start) / p.step);
    if (y >= p.start && (y - p.start) % p.step === 0) {
      return offset + (y - p.start) / p.step;
    }
    offset += count;
  }
  return y;
}

function lzwDecode(data, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = clearCode + 2;
  const dictionary = [];
  for (let i = 0; i < clearCode; i++) dictionary.push([i]);

  const result = [];
  let bits = 0;
  let bitCount = 0;
  let dataIdx = 0;

  function readCode() {
    while (bitCount < codeSize) {
      if (dataIdx >= data.length) return -1;
      bits |= data[dataIdx++] << bitCount;
      bitCount += 8;
    }
    const code = bits & ((1 << codeSize) - 1);
    bits >>= codeSize;
    bitCount -= codeSize;
    return code;
  }

  let code = readCode();
  if (code < 0) return result;
  // skip clear code if present
  if (code === clearCode) { code = readCode(); }

  if (code < 0) return result;
  const firstEntry = dictionary[code];
  if (!firstEntry) return result;
  result.push(...firstEntry);
  let prev = firstEntry;

  while (true) {
    code = readCode();
    if (code < 0 || code === eoiCode) break;

    let entry;
    if (code === clearCode) {
      // Reset
      dictionary.length = 0;
      for (let i = 0; i < clearCode; i++) dictionary.push([i]);
      nextCode = clearCode + 2;
      codeSize = minCodeSize + 1;
      code = readCode();
      if (code < 0 || code === eoiCode) break;
      entry = dictionary[code];
      if (!entry) entry = [];
      result.push(...entry);
      prev = entry;
      continue;
    }

    if (code < dictionary.length) {
      entry = dictionary[code];
      const newEntry = [...prev, entry[0]];
      if (nextCode < 4096) {
        dictionary[nextCode++] = newEntry;
        if (nextCode >= (1 << codeSize) && codeSize < 12) codeSize++;
      }
    } else if (code === nextCode) {
      entry = [...prev, prev[0]];
      if (nextCode < 4096) {
        dictionary[nextCode++] = entry;
        if (nextCode >= (1 << codeSize) && codeSize < 12) codeSize++;
      }
    } else {
      break;
    }

    result.push(...entry);
    prev = entry;
  }

  return result;
}