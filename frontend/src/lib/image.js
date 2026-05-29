const MAX_SIDE = 1280;

// Resize obrazu klientem do max MAX_SIDE × MAX_SIDE (JPEG q=0.85) — szybszy upload + tańsze API
export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nie można odczytać pliku'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Nie można załadować obrazu'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const ratio = MAX_SIDE / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
