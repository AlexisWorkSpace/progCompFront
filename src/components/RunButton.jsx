function RunButton({ onClick, loading }) {
  return (
    <button className="run-button" onClick={onClick} disabled={loading}>
      {loading ? 'Ejecutando...' : 'Run'}
    </button>
  );
}

export default RunButton;
