function OutputConsole({ output, error, exitCode, timedOut }) {
  const status = timedOut
    ? 'Tiempo agotado (límite: 10 s)'
    : exitCode === null
      ? 'Listo'
      : exitCode === 0
        ? 'Finalizado correctamente'
        : `Finalizó con código ${exitCode}`;

  return (
    <section className="output-panel">
      <div className="output-heading">
        <h3>Salida</h3>
        <span className={exitCode !== null && exitCode !== 0 || timedOut ? 'status status-error' : 'status'}>{status}</span>
      </div>
      <pre>{error || output || 'La salida aparecerá aquí.'}</pre>
    </section>
  );
}

export default OutputConsole;
