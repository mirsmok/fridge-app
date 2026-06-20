const MAX_SIDE = 1280;

export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nie można odczytać pliku'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Nie można załadować obrazu'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > MAX_SIDE || height > MAX_SIDE) {
            const ratio = MAX_SIDE / Math.max(width, height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas 2D niedostępny')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
