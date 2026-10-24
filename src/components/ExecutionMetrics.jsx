function formatSizeInMb(bytes) {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  }).format(bytes / 1_000_000);
}

function ExecutionMetrics({ metrics }) {
  if (!metrics) return null;

  return (
    <section className="metrics-panel" aria-label="Métricas de ejecución">
      <h3>Métricas de ejecución</h3>
      <div className="metrics-grid">
        <article className="metric-card">
          <span className="metric-label">Tiempo de ejecución</span>
          <strong className="metric-value">{metrics.executionTimeMs.toFixed(2)} ms</strong>
          <span className="metric-detail">Incluye inicio del contenedor y compilación, si aplica.</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Tamaño del programa</span>
          <strong className="metric-value">{formatSizeInMb(metrics.programSizeBytes)} MB</strong>
          <span className="metric-detail">{metrics.programSizeBytes.toLocaleString('es-MX')} bytes de código fuente.</span>
        </article>
      </div>
    </section>
  );
}

export default ExecutionMetrics;