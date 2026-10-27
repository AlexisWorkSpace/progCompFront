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
  const [authMode, setAuthMode] = useState('register');
  const [authForm, setAuthForm] = useState({
    username: '', password: '', fullName: '', career: '', teamMode: 'pair',
    teamName: '', teammateName: '', inviteCode: '',
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [queueStatus, setQueueStatus] = useState('');
  const [judgeHealth, setJudgeHealth] = useState(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [exitCode, setExitCode] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef(null);
    // Cada borrador pertenece a un ejercicio y lenguaje concretos, para que una entrega
  // nunca incluya el código escrito para otro ejercicio.
  const draftKey = `${selectedExerciseId}:${language}`;
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;

  const code = drafts[draftKey] ?? LANGUAGE_DEFAULTS[language] ?? LANGUAGE_DEFAULTS.python;
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId);

  const loadRanking = async () => {
    try {
      const response = await api.get('/ranking');
      setRanking(response.data.users || []);
    } catch {
      setRanking([]);
    }
  };

  const loadJudgeHealth = async () => {
    try {
      const response = await api.get('/health');
      setJudgeHealth(response.data.judge || null);
    } catch {
      setJudgeHealth(null);
    }
  };

  const waitForJob = async (job, onStatus) => {
    let current = job;
    const deadline = Date.now() + 10 * 60 * 1000;
    while (current.jobId && !['completed', 'failed'].includes(current.status)) {
      if (Date.now() > deadline) throw new Error('El trabajo sigue en la cola. Vuelve a consultar en unos instantes.');
      onStatus?.(current);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await api.get(`/jobs/${current.jobId}`, { headers: { Authorization: `Bearer ${token}` } });
      current = response.data;
    }
    return current;
  };

  useEffect(() => {
    api.get('/exercises')
      .then((response) => setExercises(response.data.exercises || []))
      .catch(() => setError('No se pudieron cargar los ejercicios.'));
    loadRanking();
    loadJudgeHealth();
    const healthTimer = setInterval(loadJudgeHealth, 20000);
    return () => clearInterval(healthTimer);
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

      let result = response.data;
      if (result.jobId) {
        setQueueStatus('En cola para ejecutar…');
        result = await waitForJob(result, (job) => setQueueStatus(job.status === 'queued'
          ? `En cola · posición ${job.queuePosition}`
          : 'Ejecutando en el juez local…'));
        setQueueStatus('');
        if (result.status === 'failed' || result.result?.error) {
          setError(result.result?.error || result.error || 'Falló la ejecución en el juez.');
          return;
        }
        result = result.result;
      }

      if (result?.error) {
        setError(result.error || 'Error desconocido');
        return;
      }

      setOutput([result?.stdout || '', result?.stderr || ''].filter(Boolean).join('\n')
        || (result?.success ? 'Ejecución finalizada sin salida.' : 'El programa terminó sin generar salida.'));
      setExitCode(result?.exitCode);
      setTimedOut(Boolean(result?.timedOut));
      setMetrics({
        executionTimeMs: result?.executionTimeMs,
        programSizeBytes: result?.programSizeBytes,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el backend.');
    } finally {
      setQueueStatus('');
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
      setAuthForm({ username: '', password: '', fullName: '', career: '', teamMode: 'pair', teamName: '', teammateName: '', inviteCode: '' });
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
    // Se fija el ejercicio, lenguaje y código al momento de enviar.
    const submittedExerciseId = selectedExercise.id;
    const submittedLanguage = language;
    const submittedCode = code;
    setIsSubmitting(true);
    setSubmission(null);
    setQueueStatus('Enviando a la cola del juez…');
    setError('');
    try {
      const response = await api.post('/submit', {
                exerciseId: submittedExerciseId,
        language: submittedLanguage,
        code: submittedCode,
      }, { headers: { Authorization: `Bearer ${token}` } });
      const jobResult = response.data.jobId
        ? await waitForJob(response.data, (job) => setQueueStatus(job.status === 'queued'
          ? `En cola · posición ${job.queuePosition}`
          : 'El juez está evaluando tu solución…'))
        : response.data;
      if (jobResult.status === 'failed' || jobResult.result?.error) {
        setError(jobResult.result?.error || jobResult.error || 'Falló la evaluación.');
        return;
      }
            const result = jobResult.result || jobResult;
      if (result.result) {
        setSubmission({ ...result.result, exerciseId: submittedExerciseId });
      } else {
        setSubmission({ ...result, exerciseId: submittedExerciseId });
      }
      if ((result.result || result).verdict) {
        const profile = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        setUser(profile.data.user);
        await loadRanking();
      }
      setQueueStatus('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar la solución.');
      setQueueStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditorChange = (value) => {
    // El editor conserva la primera versión de este callback; la referencia evita escribir en otro ejercicio.
    const key = draftKeyRef.current;
    setDrafts((current) => ({ ...current, [key]: value || '' }));
  };

  const handleFileUpload = (fileContent) => {
    setDrafts((current) => ({ ...current, [draftKey]: fileContent }));
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
            <div className="user-chip"><span className="avatar">{(user.team?.name || user.fullName || user.username).slice(0, 1).toUpperCase()}</span><span className="user-chip-identity"><strong>{user.team?.name || user.username}</strong><small>{user.fullName} · {user.career}</small></span><button type="button" onClick={handleLogout}>Salir</button></div>
          ) : <span className="session-hint">Inicia sesión para guardar tus puntos</span>}
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
      </header>

      <nav className="main-tabs" aria-label="Secciones">
        <button className={activeTab === 'problems' ? 'active' : ''} onClick={() => setActiveTab('problems')}>Ejercicios <span>10</span></button>
        <button className={activeTab === 'ranking' ? 'active' : ''} onClick={() => { setActiveTab('ranking'); loadRanking(); }}>Ranking</button>
      </nav>

      {judgeHealth && !judgeHealth.online && <div className="judge-offline-banner"><span>●</span><div><strong>Juez local desconectado</strong><small>Los envíos quedarán guardados en cola hasta que la PC juez vuelva a conectarse.</small></div></div>}
      {judgeHealth?.online && <div className="judge-online-indicator"><span>●</span> Juez conectado · {judgeHealth.active}/{judgeHealth.concurrency} trabajos activos · {judgeHealth.queued} en cola</div>}

      {activeTab === 'problems' ? (
        <main className="workspace-layout">
          <aside className="problem-sidebar">
            <div className="section-heading"><div><span className="eyebrow">COMPETENCIA</span><h2>Ejercicios</h2></div><span className="problem-count">{exercises.length}</span></div>
                        <div className="problem-select-wrap">
              <label htmlFor="exercise-select">Selecciona un problema</label>
              <select
                id="exercise-select"
                className="problem-select"
                value={selectedExerciseId}
                disabled={isSubmitting}
                onChange={(event) => { setSelectedExerciseId(event.target.value); setSubmission(null); }}
              >
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.id} · {exercise.title} · {user?.scores?.[exercise.id] ? `${user.scores[exercise.id]} pts` : '—'}
                  </option>
                ))}
              </select>
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

            {!user && <form className="auth-card registration-card" onSubmit={handleAuth}>
              <div className="auth-copy"><span className="eyebrow">COMPETENCIA · 80 PARTICIPANTES</span><h3>{authMode === 'register' ? 'Registra tu equipo' : 'Inicia sesión'}</h3><p>{authMode === 'register' ? 'Hasta 40 equipos de una o dos personas. Ambos integrantes comparten puntaje e intentos.' : 'Accede a la cuenta del participante.'}</p></div>
              {authMode === 'register' && <>
                <label>Nombre completo<input autoComplete="name" value={authForm.fullName} onChange={(event) => setAuthForm({ ...authForm, fullName: event.target.value })} required minLength={2} maxLength={100} /></label>
                <label>Carrera<input value={authForm.career} onChange={(event) => setAuthForm({ ...authForm, career: event.target.value })} required minLength={2} maxLength={100} placeholder="Ej. Ingeniería en Sistemas" /></label>
              </>}
              <label>Usuario<input autoComplete="username" value={authForm.username} onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })} required minLength={3} maxLength={20} /></label>
              <label>Contraseña<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required minLength={authMode === 'register' ? 8 : 1} /></label>
              {authMode === 'register' && <>
                <fieldset className="team-mode-fieldset"><legend>¿Cómo participas?</legend>
                  <label className="radio-option"><input type="radio" name="team-mode" checked={authForm.teamMode === 'pair'} onChange={() => setAuthForm({ ...authForm, teamMode: 'pair' })} /> Crear equipo de dos</label>
                  <label className="radio-option"><input type="radio" name="team-mode" checked={authForm.teamMode === 'solo'} onChange={() => setAuthForm({ ...authForm, teamMode: 'solo' })} /> Participar solo</label>
                  <label className="radio-option"><input type="radio" name="team-mode" checked={authForm.teamMode === 'join'} onChange={() => setAuthForm({ ...authForm, teamMode: 'join' })} /> Ya tengo invitación</label>
                </fieldset>
                {authForm.teamMode !== 'join' && <label>Nombre del equipo<input value={authForm.teamName} onChange={(event) => setAuthForm({ ...authForm, teamName: event.target.value })} required minLength={2} maxLength={60} /></label>}
                {authForm.teamMode === 'pair' && <label>Nombre completo de tu compañero/a<input value={authForm.teammateName} onChange={(event) => setAuthForm({ ...authForm, teammateName: event.target.value })} required minLength={2} maxLength={100} /></label>}
                {authForm.teamMode === 'join' && <label>Código de invitación del equipo<input autoCapitalize="characters" value={authForm.inviteCode} onChange={(event) => setAuthForm({ ...authForm, inviteCode: event.target.value.toUpperCase() })} required minLength={10} maxLength={10} /></label>}
              </>}
              <button className="auth-submit" disabled={authLoading}>{authLoading ? 'Procesando…' : authMode === 'register' ? 'Crear cuenta y equipo' : 'Entrar'}</button>
              <button className="auth-switch" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}>{authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button>
              {authError && <p className="form-error">{authError}</p>}
            </form>}

            {user?.team?.inviteCode && <div className="team-invite"><div><span className="eyebrow">COMPARTE CON TU COMPAÑERO/A</span><strong>El segundo integrante debe registrarse con este código</strong></div><code>{user.team.inviteCode}</code></div>}

            <div className="editor-toolbar">
              <div><span className="editor-label">TU SOLUCIÓN</span>{user && <span className="attempt-count">Intentos incorrectos: {user.wrongAttempts?.[selectedExerciseId] || 0}</span>}</div>
              <div className="editor-actions"><FileUploader onFileRead={handleFileUpload} onError={setError} /><RunButton onClick={handleRun} loading={isLoading} /></div>
            </div>
            <CodeEditor language={language} value={code} onChange={handleEditorChange} editorRef={editorRef} />

            <section className="stdin-panel">
              <label htmlFor="stdin-input">Prueba manual · entrada estándar</label>
              <textarea id="stdin-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribe aquí los datos de entrada…" rows={3} />
            </section>
                        <OutputConsole output={output} error={error} exitCode={exitCode} timedOut={timedOut} />
            <ExecutionMetrics metrics={metrics} />
            {submission && submission.exerciseId === selectedExerciseId && <div className={`verdict-card ${submission.verdict === 'AC' ? 'accepted' : 'rejected'}`}>
              <strong>{submission.verdict === 'AC' ? '✓ Aceptado' : submission.verdict === 'TLE' ? '◷ Tiempo excedido' : submission.verdict === 'MLE' ? 'Memoria excedida' : submission.verdict === 'CE/RE' ? 'Error de compilación / ejecución' : '✕ Respuesta incorrecta'}</strong>
              <span>{submission.alreadySolved ? 'Este ejercicio ya estaba resuelto.' : `${submission.passedTests}/${submission.totalTests} casos aprobados${submission.failedTest ? ` · falló el caso ${submission.failedTest}` : ''}`}</span>
              {submission.verdict === 'AC' && !submission.alreadySolved && <span>+{submission.score} pts{submission.penalty ? ` · penalización de ${submission.penalty} pts` : ''}</span>}
                        </div>}
            <div className="submit-row">
              <span>El juez ejecuta {selectedExercise?.testCount || 1} {selectedExercise?.testCount === 1 ? 'caso' : 'casos'} de prueba.</span>
              <button className="submit-button" onClick={handleSubmit} disabled={!user || isSubmitting || Boolean(user?.scores?.[selectedExerciseId])}>
                {isSubmitting ? (queueStatus || 'Evaluando…') : user?.scores?.[selectedExerciseId] ? 'Ejercicio resuelto' : 'Enviar solución'}
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className="ranking-page">
          <div className="ranking-heading"><div><span className="eyebrow">TECLA-TON · CLASIFICACIÓN</span><h2>Ranking de competidores</h2><p>Los puntos por problema se suman al total. ¡Sigue resolviendo!</p></div><div className="ranking-trophy">♜</div></div>
          <div className="ranking-table-wrap"><table className="ranking-table"><thead><tr><th>#</th><th>Equipo</th><th>Participantes</th>{exercises.map((exercise) => <th key={exercise.id}>{exercise.id}</th>)}<th>Total</th></tr></thead>
            <tbody>{ranking.length ? ranking.map((entry, index) => <tr key={entry.id} className={entry.id === user?.teamId ? 'current-user' : ''}><td className="rank-number">{String(index + 1).padStart(2, '0')}</td><td className="rank-username">{entry.teamName}{entry.id === user?.teamId && <small>TÚ</small>}</td><td className="team-members-cell">{(entry.members || []).join(' + ')}</td>{exercises.map((exercise) => <td key={exercise.id} className={entry.scores[exercise.id] ? 'solved-score' : 'empty-score'}>{entry.scores[exercise.id] ?? '—'}</td>)}<td className="rank-total">{entry.total}<small> pts</small></td></tr>) : <tr><td className="empty-ranking" colSpan={exercises.length + 4}>Aún no hay equipos. ¡Sé el primero en registrarte!</td></tr>}</tbody>
          </table></div>
          <div className="ranking-note">Cada ejercicio vale 10 puntos. Después de 3 envíos incorrectos, cada nuevo error reduce en 1 punto el premio al resolverlo (hasta un mínimo de 1 punto).</div>
        </main>
      )}
    </div>
  );
}

export default App;
