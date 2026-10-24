import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import LanguageSelector from './components/LanguageSelector';
import CodeEditor from './components/CodeEditor';
import FileUploader from './components/FileUploader';
import OutputConsole from './components/OutputConsole';
import ExecutionMetrics from './components/ExecutionMetrics';
import RunButton from './components/RunButton';

const LANGUAGE_DEFAULTS = {
  python: "print('Hola desde Python')\n",
  java: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hola desde Java");
  }
}
`,
  c: `#include <stdio.h>\n\nint main() {\n  printf("Hola desde C\\n");\n  return 0;\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hola desde C++" << endl;\n  return 0;\n}\n`,
};
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const API_BASE_URL = import.meta.env.VITE_API_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/api` : '/api');
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ? { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
    : {},
});

function App() {
  const [language, setLanguage] = useState('python');
  const [drafts, setDrafts] = useState({});
  const [exercises, setExercises] = useState([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState('A');
  const [activeTab, setActiveTab] = useState('problems');
  const [ranking, setRanking] = useState([]);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('code-runner-token') || '');
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('code-runner-refresh-token') || '');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [exitCode, setExitCode] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef(null);
  const code = drafts[language] ?? LANGUAGE_DEFAULTS[language] ?? LANGUAGE_DEFAULTS.python;
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId);

  const loadRanking = async () => {
    try {
      const response = await api.get('/ranking');
      setRanking(response.data.users || []);
    } catch {
      setRanking([]);
    }
  };

  useEffect(() => {
    api.get('/exercises')
      .then((response) => setExercises(response.data.exercises || []))
      .catch(() => setError('No se pudieron cargar los ejercicios.'));
    loadRanking();
  }, []);

  useEffect(() => {
    if (!token) return;
    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => setUser(response.data.user))
      .catch(async () => {
        if (refreshToken) {
          try {
            const refreshed = await api.post('/auth/refresh', { refreshToken });
            localStorage.setItem('code-runner-token', refreshed.data.token);
            localStorage.setItem('code-runner-refresh-token', refreshed.data.refreshToken);
            setToken(refreshed.data.token);
            setRefreshToken(refreshed.data.refreshToken);
            setUser(refreshed.data.user);
            return;
          } catch {
            // Expired or revoked refresh token: sign out locally.
          }
        }
        localStorage.removeItem('code-runner-token');
        localStorage.removeItem('code-runner-refresh-token');
        setToken('');
        setRefreshToken('');
        setUser(null);
      });
  }, [token]);

  const handleRun = async () => {
    setIsLoading(true);
    setOutput('');
    setError('');
    setExitCode(null);
    setTimedOut(false);
    setMetrics(null);

    try {
      const response = await api.post('/run', {
        language,
        code,
        input,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      if (response.data.error) {
        setError(response.data.error || 'Error desconocido');
        return;
      }

      setOutput([response.data.stdout || '', response.data.stderr || ''].filter(Boolean).join('\n')
        || (response.data.success ? 'Ejecución finalizada sin salida.' : 'El programa terminó sin generar salida.'));
      setExitCode(response.data.exitCode);
      setTimedOut(Boolean(response.data.timedOut));
      setMetrics({
        executionTimeMs: response.data.executionTimeMs,
        programSizeBytes: response.data.programSizeBytes,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'register' ? 'register' : 'login';
      const response = await api.post(`/auth/${endpoint}`, authForm);
      if (!response.data.token || !response.data.refreshToken || !response.data.user) {
        throw new Error('Cuenta creada. Inicia sesión para continuar.');
      }
      localStorage.setItem('code-runner-token', response.data.token);
      localStorage.setItem('code-runner-refresh-token', response.data.refreshToken);
      setToken(response.data.token);
      setRefreshToken(response.data.refreshToken);
      setUser(response.data.user);
      setAuthForm({ username: '', password: '' });
      await loadRanking();
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message || 'No se pudo autenticar.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('code-runner-token');
    localStorage.removeItem('code-runner-refresh-token');
    setToken('');
    setRefreshToken('');
    setUser(null);
  };

  const handleSubmit = async () => {
    if (!user || !selectedExercise) return;
    setIsSubmitting(true);
    setSubmission(null);
    setError('');
    try {
      const response = await api.post('/submit', {
        exerciseId: selectedExercise.id,
        language,
        code,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSubmission(response.data);
      const profile = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      setUser(profile.data.user);
      await loadRanking();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar la solución.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditorChange = (value) => {
    setDrafts((current) => ({ ...current, [language]: value || '' }));
  };

  const handleFileUpload = (fileContent) => {
    setDrafts((current) => ({ ...current, [language]: fileContent }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">&lt;/&gt;</div>
          <div><h1>Tecla-Ton</h1><span>Juez de programación</span></div>
        </div>
        <div className="topbar-actions">
          {user ? (
            <div className="user-chip"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><strong>{user.username}</strong><button type="button" onClick={handleLogout}>Salir</button></div>
          ) : <span className="session-hint">Inicia sesión para guardar tus puntos</span>}
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
      </header>

      <nav className="main-tabs" aria-label="Secciones">
        <button className={activeTab === 'problems' ? 'active' : ''} onClick={() => setActiveTab('problems')}>Ejercicios <span>10</span></button>
        <button className={activeTab === 'ranking' ? 'active' : ''} onClick={() => { setActiveTab('ranking'); loadRanking(); }}>Ranking</button>
      </nav>

      {activeTab === 'problems' ? (
        <main className="workspace-layout">
          <aside className="problem-sidebar">
            <div className="section-heading"><div><span className="eyebrow">COMPETENCIA</span><h2>Ejercicios</h2></div><span className="problem-count">{exercises.length}</span></div>
            <div className="problem-table-wrap">
              <table className="problem-table">
                <thead><tr><th>Problema</th><th>Pts</th></tr></thead>
                <tbody>{exercises.map((exercise) => (
                  <tr key={exercise.id} className={selectedExerciseId === exercise.id ? 'selected' : ''} onClick={() => { setSelectedExerciseId(exercise.id); setSubmission(null); }}>
                    <td><span className="problem-id">{exercise.id}</span><span className="problem-name">{exercise.title}</span></td>
                    <td className={user?.scores?.[exercise.id] ? 'solved-score' : 'empty-score'}>{user?.scores?.[exercise.id] ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {user && <div className="total-score-card"><span>Puntaje total</span><strong>{Object.values(user.scores || {}).reduce((sum, score) => sum + score, 0)} <small>pts</small></strong></div>}
          </aside>

          <section className="coding-workspace">
            {selectedExercise ? <>
              <div className="exercise-heading">
                <div><span className="eyebrow">PROBLEMA {selectedExercise.id}</span><h2>{selectedExercise.title}</h2></div>
                <div className="limits"><span>◷ {selectedExercise.timeLimitMs / 1000}s</span><span>▣ {selectedExercise.memoryLimitMb} MB</span></div>
              </div>
              <details className="statement-box"><summary>Leer enunciado completo</summary><pre>{selectedExercise.statement}</pre></details>
            </> : <div className="loading-card">Cargando ejercicios…</div>}

            {!user && <form className="auth-card" onSubmit={handleAuth}>
              <div className="auth-copy"><span className="eyebrow">TU PROGRESO</span><h3>{authMode === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'}</h3><p>Guarda tus resultados y aparece en el ranking.</p></div>
              <label>Usuario<input autoComplete="username" value={authForm.username} onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })} required minLength={3} maxLength={20} /></label>
              <label>Contraseña<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required minLength={authMode === 'register' ? 8 : 1} /></label>
              <button className="auth-submit" disabled={authLoading}>{authLoading ? 'Procesando…' : authMode === 'register' ? 'Crear cuenta' : 'Entrar'}</button>
              <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}>{authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button>
              {authError && <p className="form-error">{authError}</p>}
            </form>}

            <div className="editor-toolbar">
              <div><span className="editor-label">TU SOLUCIÓN</span>{user && <span className="attempt-count">Intentos incorrectos: {user.wrongAttempts?.[selectedExerciseId] || 0}</span>}</div>
              <div className="editor-actions"><FileUploader onFileRead={handleFileUpload} onError={setError} /><RunButton onClick={handleRun} loading={isLoading} /></div>
            </div>
            <CodeEditor language={language} value={code} onChange={handleEditorChange} editorRef={editorRef} />

            <section className="stdin-panel">
              <label htmlFor="stdin-input">Prueba manual · entrada estándar</label>
              <textarea id="stdin-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribe aquí los datos de entrada…" rows={3} />
            </section>
            <div className="submit-row">
              <span>El juez ejecuta {selectedExercise?.testCount || 3} casos de prueba.</span>
              <button className="submit-button" onClick={handleSubmit} disabled={!user || isSubmitting || Boolean(user?.scores?.[selectedExerciseId])}>
                {isSubmitting ? 'Evaluando…' : user?.scores?.[selectedExerciseId] ? 'Ejercicio resuelto' : 'Enviar solución'}
              </button>
            </div>
            {submission && <div className={`verdict-card ${submission.verdict === 'AC' ? 'accepted' : 'rejected'}`}>
              <strong>{submission.verdict === 'AC' ? '✓ Aceptado' : submission.verdict === 'TLE' ? '◷ Tiempo excedido' : submission.verdict === 'MLE' ? 'Memoria excedida' : submission.verdict === 'CE/RE' ? 'Error de compilación / ejecución' : '✕ Respuesta incorrecta'}</strong>
              <span>{submission.alreadySolved ? 'Este ejercicio ya estaba resuelto.' : `${submission.passedTests}/${submission.totalTests} casos aprobados${submission.failedTest ? ` · falló el caso ${submission.failedTest}` : ''}`}</span>
              {submission.verdict === 'AC' && !submission.alreadySolved && <span>+{submission.score} pts{submission.penalty ? ` · penalización de ${submission.penalty} pts` : ''}</span>}
            </div>}
            <OutputConsole output={output} error={error} exitCode={exitCode} timedOut={timedOut} />
            <ExecutionMetrics metrics={metrics} />
          </section>
        </main>
      ) : (
        <main className="ranking-page">
          <div className="ranking-heading"><div><span className="eyebrow">TECLA-TON · CLASIFICACIÓN</span><h2>Ranking de competidores</h2><p>Los puntos por problema se suman al total. ¡Sigue resolviendo!</p></div><div className="ranking-trophy">♜</div></div>
          <div className="ranking-table-wrap"><table className="ranking-table"><thead><tr><th>#</th><th>Usuario</th>{exercises.map((exercise) => <th key={exercise.id}>{exercise.id}</th>)}<th>Total</th></tr></thead>
            <tbody>{ranking.length ? ranking.map((entry, index) => <tr key={entry.id} className={entry.id === user?.id ? 'current-user' : ''}><td className="rank-number">{String(index + 1).padStart(2, '0')}</td><td className="rank-username"><span className="avatar">{entry.username.slice(0, 1).toUpperCase()}</span>{entry.username}{entry.id === user?.id && <small>TÚ</small>}</td>{exercises.map((exercise) => <td key={exercise.id} className={entry.scores[exercise.id] ? 'solved-score' : 'empty-score'}>{entry.scores[exercise.id] ?? '—'}</td>)}<td className="rank-total">{entry.total}<small> pts</small></td></tr>) : <tr><td className="empty-ranking" colSpan={exercises.length + 3}>Aún no hay competidores. ¡Sé el primero en registrarte!</td></tr>}</tbody>
          </table></div>
          <div className="ranking-note">Cada ejercicio vale 10 puntos. Después de 3 envíos incorrectos, cada nuevo error reduce en 1 punto el premio al resolverlo (hasta un mínimo de 1 punto).</div>
        </main>
      )}
    </div>
  );
}

export default App;
