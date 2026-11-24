interface DecodeRequest {
  id: number;
  blob: Blob;
  crop?: { x: number; y: number; w: number; h: number };
}

const decoder = self as unknown as {
  onmessage: (event: MessageEvent<DecodeRequest>) => void;
  postMessage: (data: { id: number; bitmap?: ImageBitmap; error?: string }, transfer?: Transferable[]) => void;
};

decoder.onmessage = async (event) => {
  const { id, blob, crop } = event.data;
  try {
    const bitmap = crop
      ? await createImageBitmap(blob, crop.x, crop.y, crop.w, crop.h)
      : await createImageBitmap(blob);
    decoder.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    decoder.postMessage({ id, error: String(error) });
  }
};
