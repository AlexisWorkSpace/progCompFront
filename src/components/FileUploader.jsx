function FileUploader({ onFileRead, onError }) {
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 512 * 1024) {
        throw new Error('El archivo supera el límite de 512 KB.');
      }
      onFileRead(await file.text());
    } catch (error) {
      onError?.(error.message || 'No se pudo leer el archivo.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <label className="upload-button">
      <input type="file" accept=".py,.java,.c,.cpp" onChange={handleUpload} />
      <span>Subir archivo</span>
    </label>
  );
}

export default FileUploader;
