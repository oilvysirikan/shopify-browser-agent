import { useEffect, useMemo, useState } from 'react';

type HealthResponse = {
  status: string;
  service: string;
  time: string;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const healthUrl = useMemo(() => `${apiBaseUrl}/api/v1/health`, []);

  useEffect(() => {
    fetch(healthUrl)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        const payload = (await res.json()) as HealthResponse;
        setHealth(payload);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [healthUrl]);

  return (
    <main className="container">
      <h1>Seafood Marketplace Frontend</h1>
      <p>Connected API: {apiBaseUrl}</p>

      {health && (
        <section className="card success">
          <h2>API Status</h2>
          <p>Service: {health.service}</p>
          <p>Status: {health.status}</p>
          <p>Time: {health.time}</p>
        </section>
      )}

      {error && (
        <section className="card error">
          <h2>API Error</h2>
          <p>{error}</p>
        </section>
      )}
    </main>
  );
}
